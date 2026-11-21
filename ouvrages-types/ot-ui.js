/* BridgeAI Studios — Ouvrages types SETRA (PICF-EL, PIPO-EL, PSIDA-EL, PSIDP-EL)
   Socle d'interface commun : saisie guidée du bordereau sur un seul écran,
   schéma de principe + ouvrage à l'échelle, texte SETRA, calcul, note.
   Chaque programme fournit une définition : OTUI.mount(root, def). */
(function (G) {
  'use strict';

  /* ───────────── utilitaires ───────────── */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (r, s) => r.querySelector(s);
  const $$ = (r, s) => Array.from(r.querySelectorAll(s));
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : (v === '' || v == null ? NaN : Number(String(v).replace(',', '.')));
  const fmt = (v, d) => {
    const n = num(v); if (!isFinite(n)) return v == null ? '' : String(v);
    if (d == null || d < 0) return String(Math.round(n * 1e6) / 1e6);
    return n.toFixed(d);
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } },
  };

  /* ───────────── mini-bibliothèque SVG (unités = mètres) ─────────────
     d = OTUI.svg(box) ; d.rect(...), d.line(...), d.dim(...), d.text(...) ; d.toString()
     box = {x0, y0, x1, y1} en mètres, y vers le HAUT ; le rendu s'adapte au panneau. */
  function svg(box, opt) {
    opt = opt || {};
    const pad = opt.pad == null ? 0.12 : opt.pad;
    const W = box.x1 - box.x0, H = box.y1 - box.y0;
    const px = Math.max(W, H * 1.6) * pad, py = Math.max(H, W / 2.2) * pad;
    const vb = { x: box.x0 - px, y: -(box.y1 + py), w: W + 2 * px, h: H + 2 * py };
    const u = Math.max(vb.w, vb.h * 1.6) / 100;          // « unité visuelle » ~1 % de la largeur
    const out = [];
    const X = x => +x.toFixed(4), Y = y => +(-y).toFixed(4);
    const attrs = a => Object.keys(a || {}).filter(k => a[k] != null).map(k => ` ${k}="${esc(a[k])}"`).join('');
    const kAttr = k => k ? ` data-k="${esc(Array.isArray(k) ? k.join(' ') : k)}"` : '';
    const api = {
      u,
      raw(s) { out.push(s); return api; },
      rect(x, y, w, h, cls, k) { out.push(`<rect x="${X(x)}" y="${Y(y + h)}" width="${X(w)}" height="${X(h)}" class="${cls || 'b'}"${kAttr(k)}/>`); return api; },
      poly(pts, cls, k) { out.push(`<polygon points="${pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" class="${cls || 'b'}"${kAttr(k)}/>`); return api; },
      path(pts, cls, k) { out.push(`<polyline points="${pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" class="${cls || 'l'}" fill="none"${kAttr(k)}/>`); return api; },
      line(x1, y1, x2, y2, cls, k) { out.push(`<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" class="${cls || 'l'}"${kAttr(k)}/>`); return api; },
      circle(x, y, r, cls, k) { out.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="${X(r)}" class="${cls || 'b'}"${kAttr(k)}/>`); return api; },
      text(x, y, s, o) {
        o = o || {};
        const fs = (o.size || 1) * u * 2.0 * (globalThis.OT_FONT || 1) * (opt.font || 1);   // OT_FONT : agrandissement des textes propre à la page
        const anchor = o.a || 'middle';
        const rot = o.rot ? ` transform="rotate(${-o.rot} ${X(x)} ${Y(y)})"` : '';
        out.push(`<text x="${X(x)}" y="${Y(y)}" font-size="${+fs.toFixed(4)}" text-anchor="${anchor}" dominant-baseline="${o.base || 'middle'}" class="${o.cls || 't'}"${kAttr(o.k)}${rot}>${esc(s)}</text>`);
        return api;
      },
      /* cote : de (x1,y1) à (x2,y2), décalée de off (m, perpendiculaire), libellé lab */
      dim(x1, y1, x2, y2, lab, off, k, o) {
        o = o || {};
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L, ny = dx / L;
        const a1 = [x1 + nx * off, y1 + ny * off], a2 = [x2 + nx * off, y2 + ny * off];
        const t = u * 1.1, ex = Math.sign(off || 1) * u * 0.9;
        out.push(`<g class="dim"${kAttr(k)}>`);
        out.push(`<line x1="${X(x1 + nx * ex * 0.3)}" y1="${Y(y1 + ny * ex * 0.3)}" x2="${X(a1[0] + nx * ex)}" y2="${Y(a1[1] + ny * ex)}" class="dx"/>`);
        out.push(`<line x1="${X(x2 + nx * ex * 0.3)}" y1="${Y(y2 + ny * ex * 0.3)}" x2="${X(a2[0] + nx * ex)}" y2="${Y(a2[1] + ny * ex)}" class="dx"/>`);
        out.push(`<line x1="${X(a1[0])}" y1="${Y(a1[1])}" x2="${X(a2[0])}" y2="${Y(a2[1])}" class="dl"/>`);
        for (const p of [a1, a2]) out.push(`<line x1="${X(p[0] - (dx / L + nx) * t * 0.5)}" y1="${Y(p[1] - (dy / L + ny) * t * 0.5)}" x2="${X(p[0] + (dx / L + nx) * t * 0.5)}" y2="${Y(p[1] + (dy / L + ny) * t * 0.5)}" class="dt"/>`);
        if (lab !== '' && lab != null) {
          const ang = Math.atan2(dy, dx) * 180 / Math.PI;
          const rot = Math.abs(ang) > 90 ? ang + 180 : ang;
          const g = (o.inside ? -1 : 1) * u * 1.5 * Math.sign(off || 1);
          const mx = (a1[0] + a2[0]) / 2 + nx * g, my = (a1[1] + a2[1]) / 2 + ny * g;
          out.push(`<text x="${X(mx)}" y="${Y(my)}" font-size="${+(u * 1.9 * (o.size || 1) * (globalThis.OT_FONT || 1) * (opt.font || 1)).toFixed(4)}" text-anchor="middle" dominant-baseline="middle" class="dv" transform="rotate(${+(-rot).toFixed(2)} ${X(mx)} ${Y(my)})">${esc(lab)}</text>`);
        }
        out.push('</g>');
        return api;
      },
      /* sol hachuré sous une ligne (pts) */
      soil(pts, depth, k) {
        const d = depth || u * 3;
        const poly = pts.concat(pts.slice().reverse().map(p => [p[0], p[1] - d]));
        api.poly(poly, 'soil', k);
        api.path(pts, 'ground');
        return api;
      },
      /* remblai (zone pointillée) */
      fill(pts, k) { return api.poly(pts, 'fillz', k); },
      toString() {
        return `<svg viewBox="${X(vb.x)} ${X(vb.y)} ${X(vb.w)} ${X(vb.h)}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">`
          + `<defs><pattern id="hatch" width="${X(u * 1.4)}" height="${X(u * 1.4)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${X(u * 1.4)}" class="hl-line"/></pattern>`
          + `<pattern id="dots" width="${X(u * 1.6)}" height="${X(u * 1.6)}" patternUnits="userSpaceOnUse"><circle cx="${X(u * 0.8)}" cy="${X(u * 0.8)}" r="${X(u * 0.18)}" class="dot"/></pattern></defs>`
          + `<g style="--sw:${+(u * 0.16).toFixed(4)}px">` + out.join('') + '</g></svg>';
      },
    };
    return api;
  }

  /* ───────────── courbes (enveloppes, lignes d'influence, diagrammes) ─────────────
     OTUI.chart({ w, h, x:[...], series:[{ y:[...], name, cls:'mx'|'mn'|'s1'..'s4'|'perm', dash }], fill:[[iA,iB,'cls']],
                  xlab, ylab, unit, down:true (valeurs positives vers le BAS, convention des moments), xticks:[...], marks:[{x,label}],
                  labels:'ends'|'extremes' }) → chaîne <svg> (unités écran, texte lisible à l'impression). */
  function chart(o) {
    const W = o.w || 900, H = o.h || 300, ml = o.ml || 64, mr = o.mr || 18, mt = o.mt || 26, mb = o.mb || 40;
    const xs = o.x, all = [];
    for (const s of o.series) for (const v of s.y) if (isFinite(v)) all.push(v);
    let y0 = Math.min(0, ...all), y1 = Math.max(0, ...all); if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
    const nice = (r) => { const p = Math.pow(10, Math.floor(Math.log10(r))); const f = r / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
    const st = nice((y1 - y0) / 5); y0 = Math.floor(y0 / st) * st; y1 = Math.ceil(y1 / st) * st;
    const xa = Math.min(...xs), xb = Math.max(...xs);
    const PX = x => ml + (x - xa) / ((xb - xa) || 1) * (W - ml - mr);
    const PY = v => o.down ? mt + (v - y0) / (y1 - y0) * (H - mt - mb) : H - mb - (v - y0) / (y1 - y0) * (H - mt - mb);
    const f2 = v => +v.toFixed(2), out = [];
    out.push(`<svg class="ot-chart" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">`);
    for (let v = y0; v <= y1 + st / 2; v += st) { const y = f2(PY(v)); out.push(`<line x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}" class="g"/><text x="${ml - 6}" y="${y}" class="yl">${esc(fmt(v, st < 1 ? (st < 0.1 ? 2 : 1) : 0))}</text>`); }
    const xt = o.xticks || xs; for (const x of xt) out.push(`<line x1="${f2(PX(x))}" x2="${f2(PX(x))}" y1="${mt}" y2="${H - mb}" class="g2"/><text x="${f2(PX(x))}" y="${H - mb + 15}" class="xl">${esc(fmt(x, 2))}</text>`);
    out.push(`<line x1="${ml}" x2="${W - mr}" y1="${f2(PY(0))}" y2="${f2(PY(0))}" class="z"/>`);
    for (const [a, b, c] of (o.fill || [])) { const A = o.series[a].y, B = o.series[b].y;
      const pts = xs.map((x, i) => `${f2(PX(x))},${f2(PY(A[i]))}`).concat(xs.map((x, i) => `${f2(PX(x))},${f2(PY(B[i]))}`).reverse());
      out.push(`<polygon points="${pts.join(' ')}" class="fz ${c || ''}"/>`); }
    for (const s of o.series) { const pts = xs.map((x, i) => isFinite(s.y[i]) ? `${f2(PX(x))},${f2(PY(s.y[i]))}` : null).filter(Boolean);
      out.push(`<polyline points="${pts.join(' ')}" class="c ${s.cls || 's1'}"${s.dash ? ' stroke-dasharray="6 4"' : ''}/>`);
      if (o.labels !== 'none') { let im = 0; s.y.forEach((v, i) => { if (Math.abs(v) > Math.abs(s.y[im])) im = i; });
        const v = s.y[im]; if (isFinite(v) && Math.abs(v) > 1e-9) out.push(`<text x="${f2(PX(xs[im]))}" y="${f2(PY(v) + ((v >= 0) === !o.down ? -7 : 13))}" class="vl ${s.cls || 's1'}">${esc(fmt(v, Math.abs(v) < 10 ? 2 : 1))}</text>`); } }
    for (const m of (o.marks || [])) out.push(`<line x1="${f2(PX(m.x))}" x2="${f2(PX(m.x))}" y1="${mt - 6}" y2="${H - mb}" class="mk"/><text x="${f2(PX(m.x))}" y="${mt - 10}" class="mkl">${esc(m.label)}</text>`);
    if (o.ylab) out.push(`<text x="12" y="${mt + (H - mt - mb) / 2}" class="al" transform="rotate(-90 12 ${mt + (H - mt - mb) / 2})">${esc(o.ylab)}</text>`);
    if (o.xlab) out.push(`<text x="${(W + ml - mr) / 2}" y="${H - 6}" class="al">${esc(o.xlab)}</text>`);
    const leg = o.series.filter(s => s.name); let lx = ml + 6;
    for (const s of leg) { out.push(`<line x1="${lx}" x2="${lx + 22}" y1="${mt - 14}" y2="${mt - 14}" class="c ${s.cls || 's1'}"${s.dash ? ' stroke-dasharray="6 4"' : ''}/><text x="${lx + 27}" y="${mt - 14}" class="lg">${esc(s.name)}</text>`); lx += 34 + 7.2 * s.name.length; }
    out.push('</svg>'); return out.join('');
  }
  /* page de croquis intercalée dans la note : OTUI.figPage(titre, sous-titre, corps HTML (svg…), légende) */
  function figPage(title, sub, body, cap) {
    return `<section class="ot-figpg"><header><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</header><div class="ot-figbody">${body}</div>${cap ? `<p class="ot-figcap">${esc(cap)}</p>` : ''}</section>`;
  }

  /* ───────────── styles ───────────── */
  const CSS = `
.ot{--bg:#f9f8f5;--bg2:#f0ede8;--white:#fff;--ink:#18191f;--ink2:#3c3f4d;--ink3:#7a7e8e;--gold:#a07828;--gold2:#c9a84c;--gold-bg:#fdf8ee;--gold-border:#e8d5a0;--blue:#1a4fd6;--teal:#0a8a78;--red:#c0392b;--orange:#b86a14;--border:#e2ddd6;--shadow:0 1px 8px rgba(0,0,0,.06);
 font-family:'Outfit',sans-serif;color:var(--ink);display:flex;flex-direction:column;height:100%;min-height:0;gap:8px}
.ot *{box-sizing:border-box}
.ot [hidden]{display:none!important}
.ot button{font-family:inherit}
.ot-bar{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;min-height:38px}
.ot-tabs{display:flex;gap:2px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:3px}
.ot-tabs button{display:flex;align-items:center;gap:7px;padding:5px 13px;border:none;border-radius:6px;background:transparent;color:var(--ink3);font-size:12.5px;cursor:pointer;white-space:nowrap}
.ot-tabs button i{width:6px;height:6px;border-radius:50%;display:inline-block}
.ot-tabs button.on{background:var(--white);color:var(--ink);box-shadow:var(--shadow)}
.ot-tabs button:disabled{opacity:.45;cursor:default}
.ot-sp{flex:1}
.ot-btn{height:32px;padding:0 13px;border-radius:7px;border:1px solid var(--border);background:var(--white);color:var(--ink2);font-size:12.5px;cursor:pointer;white-space:nowrap}
.ot-btn:hover{border-color:var(--ink3);color:var(--ink)}
.ot-btn.pri{background:var(--gold);border-color:var(--gold);color:#fff}
.ot-btn.pri:hover{opacity:.9}
.ot-btn.ghost{border-style:dashed;border-color:var(--gold-border);color:var(--gold);background:var(--gold-bg)}
.ot-sel{height:32px;border-radius:7px;border:1px solid var(--border);background:var(--white);font-family:inherit;font-size:12.5px;color:var(--ink2);padding:0 8px;max-width:210px}
.ot-steps{display:flex;gap:5px;align-items:center;min-height:34px}
.ot-steps .arw{width:30px;height:30px;border-radius:7px;border:1px solid var(--border);background:var(--white);cursor:pointer;color:var(--ink3);flex:0 0 auto}
.ot-steps .list{display:flex;gap:5px;flex:1;overflow:hidden}
.ot-st{position:relative;display:flex;align-items:center;gap:7px;padding:4px 11px 4px 5px;border-radius:8px;border:1px solid var(--border);background:var(--white);cursor:pointer;font-size:12.5px;color:var(--ink2);white-space:nowrap;flex:0 1 auto;min-width:0}
.ot-st b{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:10.5px;font-weight:500;background:var(--bg2);color:var(--ink3);flex:0 0 auto}
.ot-st span{overflow:hidden;text-overflow:ellipsis}
.ot-st.on{border-color:var(--gold-border);background:var(--gold-bg);color:var(--ink)}
.ot-st.on b{background:var(--gold);color:#fff}
.ot-st.warn::after,.ot-st.err::after{content:'';position:absolute;top:3px;right:4px;width:6px;height:6px;border-radius:50%;background:var(--orange)}
.ot-st.err::after{background:var(--red)}
.ot-main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.ot-pan{background:var(--white);border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.ot-pan-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px 0;min-height:32px}
.ot-pan-h h3{margin:0;font-size:9.5px;font-weight:500;color:var(--gold);letter-spacing:.16em;text-transform:uppercase}
.ot-views{display:flex;gap:2px;background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:2px}
.ot-views:empty{display:none}
.ot-main.single{grid-template-rows:minmax(0,1fr)!important}
.ot-main.single>.ot-pan:last-child{display:none}
.ot svg .rowon{fill:#fdf8ee;stroke:#e8d5a0;stroke-width:1px;vector-effect:non-scaling-stroke;cursor:pointer}
.ot svg .rowoff{fill:#fff;fill-opacity:0;stroke:#ece8e0;stroke-width:1px;stroke-dasharray:3 3;vector-effect:non-scaling-stroke;cursor:pointer}
.ot svg .rowoff:hover,.ot svg .rowon:hover{stroke:#a07828}
.ot-flow .go{background:var(--gold);color:#fff;border-radius:6px;margin:0 4px;font-weight:500}
.ot-flow .go:hover{opacity:.9}
/* mode « une page » (def.onePage) : tout le bordereau sur un écran ; dessins (SETRA / ouvrage) à gauche, cases compactes à droite */
.ot.one [data-r=guide]{display:grid;grid-template-columns:minmax(0,31fr) minmax(0,69fr);grid-template-rows:minmax(0,1fr);gap:10px}
.ot.one .ot-steps,.ot.one .ot-pages{display:none}
.ot.one .ot-main{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:8px;min-height:0}
.ot.one .ot-fields{min-height:0;overflow:hidden}
.ot.one .ot-groups{height:100%;display:flex;gap:6px;align-items:flex-start}
.ot.one.rows .ot-groups{display:block;overflow:hidden;height:100%}
.ot.one.rows .ot-fit{display:flex;flex-direction:column;gap:5px}
.ot.one.rows .ot-blk{display:flex;gap:10px;align-items:center;padding:4px 8px}
.ot.one.rows .ot-blk>h4{flex:0 0 118px;margin:0;font-size:10px}
.ot.one.rows .ot-blk>.row{flex:1;min-width:0;gap:3px 8px}
.ot.one.rows .ot-blk>.msgs{flex:0 1 34%;font-size:11px;line-height:1.35;color:#9a5b00;text-align:right}
.ot.one.rows .ot-blk>.msgs:empty{display:none}
.ot.one .ot-col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:6px}
.ot-blk{border:1px solid var(--border);border-radius:9px;background:var(--white);padding:3px 6px 4px;min-width:0;}
.ot-blk.wide{grid-column:1/-1}
.ot-blk.on{border-color:var(--gold2);box-shadow:0 0 0 2px var(--gold-bg)}
.ot-blk>h4{margin:0 0 2px;font-size:9.5px;font-weight:500;color:var(--gold);letter-spacing:.12em;text-transform:uppercase;display:flex;gap:8px;align-items:baseline}
.ot-blk>h4 small{font-size:9px;letter-spacing:.04em;text-transform:none;color:var(--ink3)}
.ot-blk .row{display:flex;flex-wrap:wrap;gap:2px 4px;align-items:flex-end}
.ot-blk .sg{display:flex;flex-direction:column;flex:0 1 auto;max-width:100%;padding:1px 3px 2px;border-radius:6px;min-width:0}
.ot-blk .sg.full{flex:1 1 100%}
.ot-blk .sg>.fs{display:flex;flex-wrap:wrap;gap:2px 4px;align-items:flex-end}
.ot-blk .sg.alt{background:var(--gold-bg)}
.ot-blk .sg>i{font-style:normal;font-size:8.5px;color:var(--ink3);letter-spacing:.05em;text-transform:uppercase;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0;min-width:100%}
.ot.one .ot-f{width:var(--w,62px);gap:0}
.ot.one .ot-f label{font-size:9px}
.ot.one .ot-f label code{font-size:9.5px}
.ot.one .ot-f label span{display:none}
.ot.one .ot-f label{white-space:nowrap}
.ot.one .ot-f label em{display:inline;font-style:normal;font-family:'Outfit',sans-serif;font-size:8.5px;font-weight:400;color:var(--ink3);margin-left:4px;letter-spacing:0;text-transform:none}
.ot.one .ot-f input,.ot.one .ot-f select{height:22px;font-size:11.5px;padding:0 4px;border-radius:5px}
.ot.one .ot-f select{padding:0 1px}
.ot.one .ot-f.pick{width:auto}
.ot-f.pick .pk{display:flex;gap:6px}
.ot-f.pick .pk button{display:flex;flex-direction:column;align-items:center;gap:1px;padding:3px 6px 2px;border:1px solid var(--border);border-radius:7px;background:var(--white);cursor:pointer;font:inherit;color:var(--ink3)}
.ot-f.pick .pk button svg{width:64px;height:20px;display:block}
.ot-f.pick .pk button span{font-size:9px;line-height:1.1;white-space:nowrap}
.ot-f.pick .pk button.on{border-color:var(--gold);background:var(--gold-bg);color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
.ot-f.pick .pk button:hover{border-color:var(--gold2)}
.ot-f.auto input{background:#eef3fd;color:#1a4fd6;border-color:#cdd9f3;cursor:default}
.ot.one .ot-f.ck{width:auto;height:20px;margin:0 10px 0 0;gap:4px}
.ot.one .ot-f.ck input{width:13px;height:13px}
.ot.one .ot-f.wtxt{width:100%;flex:1 1 200px}
.ot.one .ot-tbl{border-collapse:collapse;font-size:9.5px}
.ot.one .ot-tbl th{font-weight:500;color:var(--ink3);padding:0 3px;text-align:left}
.ot.one .ot-tbl td{padding:1px 2px}
.ot.one .ot-tbl .ot-f{width:40px}
.ot.one .ot-tbl .ot-f select{font-size:10.5px}
.ot.one .ot-tbl .ot-f label{display:none}
@media (max-width:980px){.ot.one [data-r=guide]{grid-template-columns:1fr}.ot.one .ot-main{grid-template-rows:300px 300px}.ot.one .ot-groups{flex-direction:column}.ot.one .ot-col{width:100%}}
.ot.one .ot-mx th span{writing-mode:vertical-rl;transform:rotate(180deg);font-family:'Courier New',monospace;font-size:9px;color:var(--gold);font-weight:600;line-height:1}
.ot.one .ot-mx th{vertical-align:bottom;padding:0 1px}
.ot.one .ot-mx td{text-align:center;padding:0}
.ot.one .ot-mx .ot-f.ck{width:15px;justify-content:center}
.ot-views button{border:none;background:transparent;border-radius:5px;padding:3px 10px;font-size:11.5px;color:var(--ink3);cursor:pointer}
.ot-views button.on{background:var(--white);color:var(--ink);box-shadow:var(--shadow)}
.ot-fig{flex:1;min-height:0;padding:6px 10px 10px;display:flex}
.ot-fig svg{width:100%;height:100%}
.ot-fig .cap{position:absolute}
.ot-fields{display:flex;flex-direction:column;gap:6px;flex:0 0 auto}
.ot-pages{display:flex;align-items:center;gap:5px;min-height:28px}
.ot-pg{display:flex;align-items:center;gap:6px;padding:3px 10px 3px 4px;border-radius:7px;border:1px solid var(--border);background:var(--white);font-size:12px;color:var(--ink2);cursor:pointer}
.ot-pg b{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:500;background:var(--bg2);color:var(--ink3)}
.ot-pg.on{border-color:var(--gold);color:var(--ink)}
.ot-pg.on b{background:var(--gold);color:#fff}
.ot-pg-n{margin-left:auto;font-size:11px;color:var(--ink3)}
.ot-groups{display:flex;gap:10px;align-items:stretch;height:var(--fh,130px)}
.ot-grp{border:1px solid var(--border);border-radius:10px;background:var(--white);padding:4px 10px 8px;margin:0;min-width:0;display:flex;flex-direction:column}
.ot-grp legend{font-size:9.5px;font-weight:500;color:var(--gold);letter-spacing:.14em;text-transform:uppercase;padding:0 5px}
.ot-grp.alt{background:var(--gold-bg);border-color:var(--gold-border)}
.ot-grid{display:grid;grid-template-columns:repeat(var(--c,6),minmax(0,1fr));gap:6px 10px;align-content:start}
.ot-f{display:flex;flex-direction:column;gap:2px;min-width:0}
.ot-f label{display:flex;align-items:baseline;gap:5px;font-size:10.5px;color:var(--ink3);white-space:nowrap;overflow:hidden}
.ot-f label code{font-family:'Courier New',monospace;font-size:10.5px;color:var(--gold);font-weight:600}
.ot-f label span{overflow:hidden;text-overflow:ellipsis;flex:1}
.ot-f label em{font-style:normal;font-size:9.5px}
.ot-f input,.ot-f select{height:30px;width:100%;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--ink);font-family:inherit;font-size:13px;padding:0 9px;outline:none;transition:border-color .15s,background .15s}
.ot-f input:focus,.ot-f select:focus{border-color:var(--gold2);background:var(--white)}
.ot-f.chg input,.ot-f.chg select{color:var(--blue)}
.ot-f.bad input{border-color:#f0b4ae;background:#fdf3f2}
.ot-f.hl label code{background:var(--gold-bg);border-radius:3px}
.ot-f.ck{flex-direction:row;align-items:center;gap:7px;height:30px;margin-top:15px}
.ot-f.ck input{width:16px;height:16px;accent-color:var(--gold)}
.ot-f.ck label{white-space:normal}
.ot-help{display:flex;align-items:center;gap:10px;min-height:30px;padding:5px 12px;border-radius:8px;background:var(--bg2);border:1px solid var(--border);font-size:12px;color:var(--ink2);overflow:hidden;min-width:0}
.ot-help code{font-family:'Courier New',monospace;color:var(--gold);font-weight:600}
.ot-help .msg{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ot-help .chk{flex:0 0 auto;font-size:11.5px;padding:2px 9px;border-radius:99px;cursor:pointer;border:1px solid}
.ot-help .chk.ok{color:var(--teal);border-color:#bfe3dc;background:#eef8f6}
.ot-help .chk.w{color:var(--orange);border-color:#efd9b0;background:#fdf7ee}
.ot-help .chk.e{color:var(--red);border-color:#f5c0be;background:#fdf2f2}
.ot-pop{position:absolute;right:12px;bottom:44px;width:min(560px,90%);max-height:40%;overflow:auto;background:var(--white);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.12);padding:10px 12px;font-size:12px;z-index:20}
.ot-pop div{padding:5px 0;border-bottom:1px solid var(--bg2);cursor:pointer}
.ot-pop div:last-child{border:none}
.ot-pop .e{color:var(--red)}.ot-pop .w{color:var(--orange)}
.ot-text{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px}
.ot-text textarea{flex:1;min-height:0;width:100%;resize:none;border-radius:10px;border:1px solid var(--border);background:var(--white);font-family:'Courier New',monospace;font-size:11.5px;line-height:1.4;padding:10px 12px;white-space:pre;overflow:auto;outline:none;color:var(--ink)}
.ot-text textarea:focus{border-color:var(--gold2)}
.ot-sec{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px}
.ot-res{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;align-content:start}
.ot-card{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:12px 14px}
.ot-card h4{margin:0 0 8px;font-size:9.5px;font-weight:500;color:var(--gold);letter-spacing:.16em;text-transform:uppercase}
.ot-kv{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:3px 0;border-bottom:1px solid var(--bg2)}
.ot-kv:last-child{border:none}
.ot-kv b{font-weight:500;font-variant-numeric:tabular-nums}
.ot-kv .ok{color:var(--teal)}.ot-kv .ko{color:var(--red)}
.ot-note-tools{display:flex;gap:8px;align-items:center}
.ot-note-tools input{height:32px;border-radius:7px;border:1px solid var(--border);background:var(--white);padding:0 10px;font-family:inherit;font-size:12.5px;width:240px}
.ot-note{flex:1;min-height:0;overflow:auto;background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px 18px}
.ot-note pre{font-family:'Courier New',monospace;font-size:10.5px;line-height:1.3;margin:0 0 14px;padding-bottom:14px;border-bottom:1px dashed var(--border);white-space:pre;color:#222}
.ot-note pre mark{background:#fbe7b5;color:inherit}
.ot-figpg{margin:0 0 14px;padding:12px 4px 16px;border-bottom:1px dashed var(--border);break-inside:avoid}
.ot-figpg>header{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;font-family:'Courier New',monospace;font-size:11px;color:#222;border-bottom:1px solid #222;padding-bottom:4px;margin-bottom:10px}
.ot-figpg>header b{font-weight:700;letter-spacing:.04em}
.ot-figpg>header span{color:var(--ink3)}
.ot-figbody{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:14px 22px;align-items:start}
.ot-figbody>.wide{grid-column:1/-1}
.ot-figbody h5{font-family:'Courier New',monospace;font-size:10.5px;font-weight:700;margin:0 0 4px;color:#222}
.ot-figbody svg{max-width:100%;height:auto;display:block}
.ot-figcap{font-size:11.5px;color:var(--ink3);margin-top:8px}
.ot-chart .g{stroke:#ece8e0;stroke-width:1}.ot-chart .g2{stroke:#f3f0ea;stroke-width:1}.ot-chart .z{stroke:#3c3f4d;stroke-width:1.2}
.ot-chart text{font-family:'Courier New',monospace;font-size:11px;fill:#3c3f4d}
.ot-chart .yl{text-anchor:end;dominant-baseline:middle}.ot-chart .xl{text-anchor:middle}.ot-chart .al{text-anchor:middle;fill:#7a7e8e;font-family:'Outfit',sans-serif}
.ot-chart .lg{dominant-baseline:middle;font-family:'Outfit',sans-serif}
.ot-chart .vl{text-anchor:middle;font-weight:700;font-size:10.5px}
.ot-chart .c{fill:none;stroke-width:2;stroke-linejoin:round}
.ot-chart .mx{stroke:#c0392b}.ot-chart text.mx{fill:#c0392b;stroke:none}
.ot-chart .mn{stroke:#1a4fd6}.ot-chart text.mn{fill:#1a4fd6;stroke:none}
.ot-chart .perm{stroke:#3c3f4d}.ot-chart text.perm{fill:#3c3f4d;stroke:none}
.ot-chart .s1{stroke:#a07828}.ot-chart text.s1{fill:#a07828;stroke:none}
.ot-chart .s2{stroke:#0a8a78}.ot-chart text.s2{fill:#0a8a78;stroke:none}
.ot-chart .s3{stroke:#7b4fb0}.ot-chart text.s3{fill:#7b4fb0;stroke:none}
.ot-chart .s4{stroke:#b86a14}.ot-chart text.s4{fill:#b86a14;stroke:none}
.ot-chart .fz{fill:#c0392b;opacity:.08}.ot-chart .fz.b{fill:#1a4fd6}.ot-chart .fz.y{fill:#a07828}
.ot-chart .mk{stroke:#7a7e8e;stroke-dasharray:3 3}.ot-chart .mkl{text-anchor:middle;font-size:10px;fill:#7a7e8e}
.ot-empty{margin:auto;color:var(--ink3);font-size:13px;text-align:center;padding:30px}
.ot-busy{position:absolute;inset:0;background:rgba(249,248,245,.7);display:grid;place-items:center;font-size:13px;color:var(--ink2);z-index:30}
.ot-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:var(--ink);color:#fff;font-size:12.5px;padding:8px 16px;border-radius:99px;opacity:0;transition:opacity .25s;pointer-events:none;z-index:50}
.ot-toast.on{opacity:.92}
/* dessin */
.ot svg .b{fill:#e9e3d6;stroke:#5d5545;stroke-width:var(--sw);vector-effect:non-scaling-stroke}
.ot svg .b2{fill:#d9d1c0;stroke:#5d5545;stroke-width:var(--sw);vector-effect:non-scaling-stroke}
.ot svg .road{fill:#4a4d57;stroke:none}
.ot svg .fillz{fill:url(#dots);stroke:#b9ad92;stroke-width:var(--sw);stroke-dasharray:3 3;vector-effect:non-scaling-stroke}
.ot svg .soil{fill:url(#hatch);stroke:none}
.ot svg .ground{stroke:#8a7d62;stroke-width:1.4px;vector-effect:non-scaling-stroke}
.ot svg .hl-line{stroke:#c9bfa8;stroke-width:1px;vector-effect:non-scaling-stroke}
.ot svg .dot{fill:#c9bfa8}
.ot svg .l{stroke:#5d5545;stroke-width:1px;vector-effect:non-scaling-stroke}
.ot svg .ax{stroke:#1a4fd6;stroke-width:1px;stroke-dasharray:7 4 2 4;vector-effect:non-scaling-stroke;opacity:.7}
.ot svg .car{fill:#fff;stroke:#7a7e8e;stroke-width:1px;vector-effect:non-scaling-stroke}
.ot svg .wheel{fill:#7a7e8e}
.ot svg .la{fill:#1a4fd6;fill-opacity:.10;stroke:#1a4fd6;stroke-width:.8px;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}
.ot svg .veh{fill:#f4efe4;stroke:#5d5545;stroke-width:1px;vector-effect:non-scaling-stroke}
.ot svg .tyre{fill:#3c3f4d}
.ot svg .real{fill:none;stroke:#c0392b;stroke-width:1.4px;stroke-dasharray:6 3;vector-effect:non-scaling-stroke}
.ot svg .realt{fill:#c0392b;font-family:'Outfit',sans-serif}
.ot svg .lane{stroke:#b9ad92;stroke-width:1px;stroke-dasharray:3 3;vector-effect:non-scaling-stroke}
.ot svg .vl{fill:#1a4fd6;font-family:'Outfit',sans-serif}
.ot svg.sch .vl{fill:#a07828;font-family:'Courier New',monospace;font-weight:700}
.ot svg .hl.veh,.ot svg .hl.la{fill:#f6e3b0;fill-opacity:1;stroke:#a07828}
.ot svg .t{fill:#3c3f4d;font-family:'Outfit',sans-serif}
.ot svg .tc{fill:#a07828;font-family:'Courier New',monospace;font-weight:700}
.ot svg .ts{fill:#7a7e8e;font-family:'Outfit',sans-serif;font-style:italic}
.ot svg .dim .dl,.ot svg .dim .dx,.ot svg .dim .dt{stroke:#1a4fd6;stroke-width:.8px;vector-effect:non-scaling-stroke}
.ot svg .dim .dx{opacity:.5}
.ot svg .dim .dv{fill:#1a4fd6;font-family:'Outfit',sans-serif}
.ot svg.sch .dim .dl,.ot svg.sch .dim .dx,.ot svg.sch .dim .dt{stroke:#3c3f4d}
.ot svg.sch .dim .dv{fill:#a07828;font-family:'Courier New',monospace;font-weight:700}
.ot svg .hl.b,.ot svg .hl.b2{fill:#f6e3b0;stroke:#a07828}
.ot svg .hl.fillz{stroke:#a07828}
.ot svg .hl .dl,.ot svg .hl .dx,.ot svg .hl .dt{stroke:#c0392b!important;stroke-width:1.6px}
.ot svg .hl .dv,.ot svg text.hl{fill:#c0392b!important}
.ot svg .hl.l,.ot svg .hl.ax{stroke:#c0392b;stroke-width:2px}
.ot svg .hl.car{stroke:#c0392b;stroke-width:2px}
@media (max-width:980px){
 .ot{height:auto}.ot-main{grid-template-columns:1fr}.ot-pan{min-height:300px}.ot-groups{height:auto;flex-direction:column}
 .ot-grid{--c:2!important}.ot-bar{flex-wrap:wrap}.ot-sp{display:none}
}
@media print{
 body.ot-print *{visibility:hidden}
 body.ot-print .ot-note,body.ot-print .ot-note *{visibility:visible}
 body.ot-print .ot-note{position:absolute;left:0;top:0;border:none;overflow:visible;padding:0}
 body.ot-print .ot-note pre{font-size:7.4px;line-height:1.22;border:none;page-break-after:always;margin:0;padding:0}
 body.ot-print .ot-figpg{page-break-after:always;border:none}
 @page{size:A4 landscape;margin:8mm}
}`;

  /* ───────────── montage ───────────── */
  function mount(root, def) {
    if (!document.getElementById('ot-css')) {
      const st = document.createElement('style'); st.id = 'ot-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const E = def.engine;
    const KEY = 'bai-ot-' + def.prog;
    const S = {
      model: null, ref: null, step: 0, page: 0, view: null, focus: null, tab: 'bord', mode: 'guide',
      results: null, note: null, noteFor: null, issues: [],
    };

    root.classList.add('ot'); if (def.onePage) root.classList.add('one'); if (def.rows) root.classList.add('rows');
    root.style.position = 'relative';
    root.innerHTML = `
${def.simpleBar ? `<div class="ot-bar">
  <div class="ot-tabs ot-flow" data-r="tabs">
    <button data-t="bord" class="on"><i style="background:var(--gold)"></i>Données</button>
    <button class="go" data-a="run">Lancer le calcul ›</button>
    <button data-t="note"><i style="background:var(--blue)"></i>Sorties</button>
  </div>
  <div hidden data-r="mode"><button data-m="guide" class="on"></button><button data-m="texte"></button></div>
  <select hidden data-r="ex"><option value=""></option></select>
  <div class="ot-sp"></div>
  <input type="file" accept=".txt,.ndc,.don,.dat" hidden data-r="file">
  <button class="ot-btn" data-a="import" title="Ouvrir un bordereau ${esc(def.prog)} (.txt)">Ouvrir</button>
  <button class="ot-btn" data-a="saveas" title="Enregistrer le bordereau au format SETRA">Enregistrer sous</button>
` : `<div class="ot-bar">
  <div class="ot-tabs" data-r="tabs">
    <button data-t="bord" class="on"><i style="background:var(--gold)"></i>1 · Bordereau</button>
    <button data-t="res"><i style="background:var(--teal)"></i>2 · Résultats</button>
    <button data-t="note"><i style="background:var(--blue)"></i>3 · Note de calcul</button>
  </div>
  <div class="ot-tabs" data-r="mode"><button data-m="guide" class="on">Saisie guidée</button><button data-m="texte">Texte ${esc(def.prog)}</button></div>
  <div class="ot-sp"></div>
  <button class="ot-btn ghost" data-a="import" title="Importer un bordereau ou une note ${esc(def.prog)} (.txt)">Importer…</button>
  <input type="file" accept=".txt,.ndc,.don,.dat" hidden data-r="file">
  <select class="ot-sel" data-r="ex" title="Charger un exemple"><option value="">Exemples…</option>${(def.examples || []).map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join('')}</select>
  <button class="ot-btn" data-a="new">Nouveau</button>
  <button class="ot-btn" data-a="save" title="Télécharger le bordereau au format SETRA">Enregistrer</button>
  <button class="ot-btn pri" data-a="run">Lancer le calcul</button>
`}</div>
<div class="ot-sec" data-s="bord">
  <div class="ot-sec" data-r="guide">
    <div class="ot-steps"><button class="arw" data-a="prev" aria-label="Étape précédente">‹</button><div class="list" data-r="steps"></div><button class="arw" data-a="next" aria-label="Étape suivante">›</button></div>
    <div class="ot-main">
      <div class="ot-pan"><div class="ot-pan-h"><h3>Schéma de principe</h3><span class="ts" data-r="schcap" style="font-size:11px;color:var(--ink3)"></span></div><div class="ot-fig" data-r="sch"></div></div>
      <div class="ot-pan"><div class="ot-pan-h"><h3>Votre ouvrage</h3><div class="ot-views" data-r="views"></div></div><div class="ot-fig" data-r="live"></div></div>
    </div>
    <div class="ot-fields"><div class="ot-pages" data-r="pages"></div><div class="ot-groups" data-r="groups"></div></div>
  </div>
  <div class="ot-text" data-r="texte" hidden>
    <textarea spellcheck="false" data-r="ta" aria-label="Bordereau au format SETRA"></textarea>
  </div>
  <div class="ot-help" data-r="help"><span class="msg" data-r="msg"></span><span class="chk ok" data-r="chk">Bordereau cohérent</span></div>
</div>
<div class="ot-sec" data-s="res" hidden><div class="ot-res" data-r="res"><div class="ot-empty">Lancez le calcul depuis le bordereau.</div></div></div>
<div class="ot-sec" data-s="note" hidden>
  <div class="ot-note-tools"><input type="search" placeholder="Rechercher dans la note…" data-r="find"><span class="ts" data-r="nfo" style="font-size:12px;color:var(--ink3)"></span><div class="ot-sp"></div>
    <button class="ot-btn" data-a="copy">Copier</button><button class="ot-btn" data-a="dl">Télécharger .txt</button><button class="ot-btn" data-a="print">Imprimer</button></div>
  <div class="ot-note" data-r="note"><div class="ot-empty">Aucune note pour l'instant.</div></div>
</div>`;
    const R = {}; $$(root, '[data-r]').forEach(e => { R[e.dataset.r] = e; });
    const toast = (() => { let t = document.querySelector('.ot-toast'); if (!t) { t = document.createElement('div'); t.className = 'ot-toast'; document.body.appendChild(t); } let h; return m => { t.textContent = m; t.classList.add('on'); clearTimeout(h); h = setTimeout(() => t.classList.remove('on'), 2400); }; })();

    /* modèle */
    const get = k => def.get(S.model, k);
    const set = (k, v) => { def.set(S.model, k, v); };
    function setModel(m, ref) {
      S.model = m; S.ref = ref ? JSON.stringify(def.snapshot ? def.snapshot(ref) : null) : S.ref;
      S.results = null; S.note = null;
      save(); renderAll();
    }
    function save() { try { store.set(KEY, E.formatBordereau(S.model)); } catch (e) { /* format impossible : on ne sauve pas */ } }

    /* champs */
    const steps = def.steps;
    function fieldsOf(step) { const out = []; for (const p of step.pages) for (const g of p.groups) for (const f of g.fields) out.push(f); return out; }
    function fieldByKey(k) { for (const st of steps) for (const f of fieldsOf(st)) if (f.k === k) return f; return null; }

    function renderSteps() {
      const iss = S.issues;
      R.steps.innerHTML = steps.map((st, i) => {
        const e = iss.some(x => x.step === st.id && x.level === 'e'), w = iss.some(x => x.step === st.id && x.level === 'w');
        return `<button class="ot-st${i === S.step ? ' on' : ''}${e ? ' err' : w ? ' warn' : ''}" data-i="${i}" title="${esc(st.label)}"><b>${i + 1}</b><span>${esc(st.label)}</span></button>`;
      }).join('');
      const on = R.steps.children[S.step]; if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function fieldHTML(f) {
      const v = get(f.k);
      const ch = def.isChanged ? def.isChanged(S.model, f.k) : false;
      const id = 'f_' + String(f.k).replace(/[^\w]/g, '_');
      const lab = `<label for="${id}"><code>${esc(f.code || f.k)}</code><span>${esc(f.label || '')}</span>${f.unit ? `<em>${esc(f.unit)}</em>` : ''}</label>`;
      if (f.type === 'pick') {   // boutons à vignette (ex. allure de la dalle) ; un second clic sur le bouton actif le désélectionne
        return `<div class="ot-f pick" data-k="${esc(f.k)}">${lab}<div class="pk">${f.opts.map(o => `<button type="button" data-v="${esc(o[0])}" class="${String(o[0]) === String(v) ? 'on' : ''}" title="${esc(o[1])}">${o[2] || ''}<span>${esc(o[1])}</span></button>`).join('')}</div></div>`;
      }
      if (f.type === 'chk') {
        return `<div class="ot-f ck" data-k="${esc(f.k)}"><input type="checkbox" id="${id}" ${num(v) === (f.on == null ? 1 : f.on) ? 'checked' : ''}${f.locked ? ' disabled' : ''}>${lab}</div>`;
      }
      if (f.type === 'sel') {
        const opts = f.opts.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(v) ? 'selected' : ''}>${esc(o[1])}</option>`).join('');
        const known = f.opts.some(o => String(o[0]) === String(v));
        return `<div class="ot-f${ch ? ' chg' : ''}" data-k="${esc(f.k)}">${lab}<select id="${id}">${known ? '' : `<option value="${esc(v)}" selected>${esc(v)}</option>`}${opts}</select></div>`;
      }
      const shown = f.type === 'txt' ? (v == null ? '' : v) : fmt(v, f.dec);
      const ro = f.ro && f.ro(S.model);   // case calculée automatiquement (lecture seule)
      return `<div class="ot-f${ch ? ' chg' : ''}${ro ? ' auto' : ''}" data-k="${esc(f.k)}">${lab}<input id="${id}" ${f.type === 'txt' ? '' : 'inputmode="decimal"'} value="${esc(shown)}" autocomplete="off"${ro ? ' readonly tabindex="-1"' : ''}></div>`;
    }
    function renderOne() {
      // blocs = étapes ; sous-groupes = groupes des pages ; groupes « par appui » (g.appui) regroupés en tableau
      const W = f => f.type === 'txt' ? (f.w ? `--w:${f.w}px;flex:0 0 auto` : '') : f.type === 'sel' ? `--w:${f.w || 84}px` : `--w:${f.w || 52}px`;
      const fh = f => { let x = fieldHTML(f).replace('class="ot-f', `style="${W(f)}" class="ot-f${f.type === 'txt' && !f.w ? ' wtxt' : ''}`); if (f.bare) x = x.replace(/<label[^>]*>[\s\S]*?<\/label>/, ''); return x; };
      const blk = steps.map((st, si) => {
        const vis = x => !x.show || x.show(S.model);   // cases et groupes conditionnels (ex. portées D1…DNT, appuis 1…NT + 1)
        const gs = st.pages.flatMap(p => p.groups).filter(vis).map(g => g.fields.every(vis) ? g : Object.assign({}, g, { fields: g.fields.filter(vis) })).filter(g => g.fields.length);
        const tabs = gs.filter(g => g.appui), mx = gs.filter(g => g.mtx), plain = gs.filter(g => !g.appui && !g.mtx);
        let h = plain.map(g => `<div class="sg${g.alt ? ' alt' : ''}${g.fields.some(f => f.type === 'txt' && !f.w) ? ' full' : ''}" title="${esc(g.title)}">${g.short === '' ? '' : `<i>${esc((g.short || g.title).replace(/\s*\((?:lignes? )?A\d+[^)]*\)/g, ''))}</i>`}<div class="fs">${g.fields.map(fh).join('')}</div></div>`).join('');
        if (mx.length) {   // matrice de cases à cocher : colonnes = codes, lignes = groupes (ex. A3 calculé / A4 imprimé)
          const rws = [...new Set(mx.map(g => g.short || g.title))].map(rw => mx.filter(g => (g.short || g.title) === rw).flatMap(g => g.fields));
          const cols = []; [...rws].sort((a, b) => b.length - a.length).forEach(fs => fs.forEach(f => { if (!cols.includes(f.code)) cols.push(f.code); }));
          h += `<table class="ot-tbl ot-mx"><tr><th></th>${cols.map(c => `<th><span>${esc(c)}</span></th>`).join('')}</tr>` +
            [...new Set(mx.map(g => g.short || g.title))].map(rw => { const gg = mx.filter(g => (g.short || g.title) === rw).flatMap(g => g.fields);
              return `<tr><th>${esc(rw)}</th>${cols.map(c => { const f = gg.find(x => x.code === c); return `<td>${f ? fieldHTML(f) : ''}</td>`; }).join('')}</tr>`; }).join('') + '</table>';
        }
        if (tabs.length) {
          const kinds = [...new Set(tabs.map(g => g.appui))], cols = tabs.filter(g => g.appui === kinds[0]);
          let rws = '';
          for (const kd of kinds) { const gk = tabs.filter(g => g.appui === kd); gk[0].fields.forEach((f0, r) => { rws += `<tr><th>${esc(f0.rowLabel || f0.code)}${f0.unit ? ` <small style="font-size:8.5px;color:var(--ink3)">${esc(f0.unit)}</small>` : ''}</th>${gk.map(g => `<td>${fieldHTML(g.fields[r])}</td>`).join('')}</tr>`; }); }
          h += `<table class="ot-tbl"><tr><th></th>${cols.map(g => `<th>${esc(g.title)}</th>`).join('')}</tr>${rws}</table>`;
        }
        return `<section class="ot-blk${st.wide ? ' wide' : ''}${si === S.step ? ' on' : ''}" data-si="${si}"><h4>${esc(st.label)}</h4><div class="row">${h}</div></section>`;
      });
      if (def.rows) { R.groups.innerHTML = `<div class="ot-fit">${blk.join('')}</div>`; markBad(); fitInputs(); fitRows(); return; }   // une rubrique par ligne, dans l'ordre du bordereau
      const nc = Math.max(1, ...steps.map(st => (st.col || 0) + 1));
      R.groups.innerHTML = Array.from({ length: nc }, (_, c) => `<div class="ot-col">${blk.filter((_, si) => (steps[si].col || 0) === c).join('')}</div>`).join('');
      markBad();
    }
    // lisibilité : chaque case s'élargit pour montrer tout son texte (valeur saisie ou choix affiché)
    const meas = document.createElement('canvas').getContext('2d');
    function fitInputs(only) {
      for (const el of only ? [only] : $$(R.groups, '.ot-f input:not([type=checkbox]), .ot-f select')) {
        const box = el.closest('.ot-f'); if (!box || box.classList.contains('wtxt')) continue;
        const cs = getComputedStyle(el); meas.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const txt = el.tagName === 'SELECT' ? ((el.options[el.selectedIndex] || {}).text || '') : el.value;
        const need = Math.ceil(meas.measureText(txt).width + (el.tagName === 'SELECT' ? 30 : 14));
        if (!box.dataset.w0) box.dataset.w0 = box.getBoundingClientRect().width / (parseFloat((R.groups.querySelector('.ot-fit') || {}).style?.zoom) || 1);
        const lb = box.querySelector('label'), lw = lb && lb.offsetParent !== null ? lb.scrollWidth + 2 : 0;   // le libellé (code + unité) doit tenir aussi
        const w = Math.max(+box.dataset.w0, need, lw); box.style.width = w + 'px'; box.style.setProperty('--w', w + 'px');
      }
    }
    function fitRows() {   // pas de scroll : la grille des données est réduite au besoin pour tenir dans la hauteur disponible
      const w = R.groups.querySelector('.ot-fit'); if (!w) return;
      w.style.zoom = 1;
      requestAnimationFrame(() => { const H = R.groups.clientHeight, h = w.scrollHeight; if (H > 50 && h > H) w.style.zoom = Math.max(0.6, (H - 2) / h).toFixed(3); });
    }
    function locate(k) {   // étape / page qui portent la case k
      for (let si = 0; si < steps.length; si++) { const pi = steps[si].pages.findIndex(pg => pg.groups.some(g => g.fields.some(f => f.k === k))); if (pi >= 0) return [si, pi]; }
      return null;
    }
    function followField(k) {   // mode une page : le dessin suit la case survolée ou active
      const L = locate(k); if (!L) return;
      const before = pairOf(), ob = steps[S.step].one; const os = S.step; S.step = L[0]; S.page = L[1];
      if (os !== S.step) $$(R.groups, '.ot-blk').forEach(b => b.classList.toggle('on', +b.dataset.si === S.step));
      if (pairOf() !== before || steps[S.step].one !== ob) { renderSchema(); renderLive(); }
    }
    function renderFields() {
      if (def.onePage) return renderOne();
      const st = steps[S.step];
      if (S.page >= st.pages.length) S.page = 0;
      R.pages.innerHTML = st.pages.map((p, i) => `<button class="ot-pg${i === S.page ? ' on' : ''}" data-p="${i}"><b>${i + 1}</b>${esc(p.label)}</button>`).join('')
        + `<span class="ot-pg-n">${esc(st.label)} · page ${S.page + 1} / ${st.pages.length}</span>`;
      const pg = st.pages[S.page];
      R.groups.innerHTML = pg.groups.map(g => {
        const c = g.cols || Math.min(6, g.fields.length);
        return `<fieldset class="ot-grp${g.alt ? ' alt' : ''}" style="flex:${g.flex || c} 1 0"><legend>${esc(g.title)}</legend><div class="ot-grid" style="--c:${c}">${g.fields.map(fieldHTML).join('')}</div></fieldset>`;
      }).join('');
      markBad();
      if (pairOf() && S._pk !== S.step + '.' + S.page) { S._pk = S.step + '.' + S.page; renderSchema(); renderLive(); }
    }
    /* mode « paire » (def.pairs) : chaque page (ou étape) porte draw(svg, modèle, sch) ; à gauche le schéma SETRA coté par les
       noms des paramètres, à droite le même dessin de l'ouvrage saisi, à l'échelle — pas de boutons de vue. */
    function pairOf() { if (!def.pairs) return null; const st = steps[S.step]; const pg = st.pages[S.page] || {}; return pg.draw || st.draw || null; }
    function markBad() {
      const bad = new Set(S.issues.filter(x => x.level === 'e' && x.k).map(x => x.k));
      $$(R.groups, '.ot-f').forEach(el => el.classList.toggle('bad', bad.has(el.dataset.k)));
      if (def.rows) $$(R.groups, '.ot-blk').forEach(b => {   // mode lignes : avertissements affichés au bout de la rubrique concernée
        const id = steps[+b.dataset.si].id, ms = [...new Set(S.issues.filter(x => x.step === id).map(x => (x.level === 'e' ? '⛔ ' : '⚠ ') + x.msg))];
        let el = b.querySelector(':scope > .msgs'); if (!el) { el = document.createElement('div'); el.className = 'msgs'; b.appendChild(el); }
        el.innerHTML = ms.map(t => `<div>${esc(t)}</div>`).join('');
      });
    }

    /* dessins */
    function hl(container, k) {
      $$(container, '.hl').forEach(e => e.classList.remove('hl'));
      if (!k) return;
      $$(container, '[data-k]').forEach(e => { if (e.getAttribute('data-k').split(' ').includes(k)) e.classList.add('hl'); });
    }
    function renderSchema() {
      const st = steps[S.step];
      let h = '';
      const one = def.pairs && steps[S.step].one;   // étape à schéma unique (ex. charges) : un seul grand dessin, cliquable
      R.sch.closest('.ot-main').classList.toggle('single', !!one);
      if (one) { R.schcap.textContent = 'cliquez une charge pour la cocher ou la décocher'; let h1 = ''; try { h1 = one(svg, S.model); } catch (e) { console.error(e); } R.sch.innerHTML = h1; const s1 = R.sch.querySelector('svg'); if (s1) s1.style.cursor = 'pointer'; hl(R.sch, S.focus); return; }
      const dp = pairOf(); const pc = dp && (steps[S.step].pages[S.page] || {}).caption;
      try { h = dp ? dp(svg, def.schemaModel ? def.schemaModel(S.model) : S.model, true) : st.schema ? st.schema(svg, S.model) : ''; } catch (e) { h = `<div class="ot-empty">Schéma indisponible.</div>`; console.error(e); }
      R.sch.innerHTML = h; const s = R.sch.querySelector('svg'); if (s) s.classList.add('sch');
      R.schcap.textContent = pc || st.caption || '';
      hl(R.sch, S.focus);
    }
    function renderLive() {
      if (def.pairs && steps[S.step].one) { R.live.innerHTML = ''; return; }
      const dp = pairOf();
      if (dp) {
        R.views.innerHTML = ''; let h = '';
        try { h = dp(svg, S.model, false); } catch (e) { h = `<div class="ot-empty">Dessin impossible avec ces valeurs.</div>`; console.error(e); }
        R.live.innerHTML = h; hl(R.live, S.focus); return;
      }
      const views = def.views;
      const st = steps[S.step];
      if (!S.view || !views.some(v => v.id === S.view)) S.view = st.view || views[0].id;
      R.views.innerHTML = views.map(v => `<button data-v="${v.id}" class="${v.id === S.view ? 'on' : ''}">${esc(v.label)}</button>`).join('');
      const v = views.find(x => x.id === S.view);
      let h = '';
      try { h = v.draw(svg, S.model); } catch (e) { h = `<div class="ot-empty">Dessin impossible avec ces valeurs.</div>`; console.error(e); }
      R.live.innerHTML = h;
      hl(R.live, S.focus);
    }

    /* aide / contrôles */
    function helpFor(k) {
      const f = fieldByKey(k); if (!f) return '';
      return `<code>${esc(f.code || f.k)}</code> — ${esc(f.help || f.label || '')}${f.def != null ? ` <span style="color:var(--ink3)">· défaut ${esc(f.def)}</span>` : ''}`;
    }
    function renderHelp() {
      R.msg.innerHTML = S.focus ? helpFor(S.focus) : esc(steps[S.step].hint || 'Survolez ou sélectionnez une case : sa définition s\'affiche ici et la cote correspondante s\'allume sur les dessins.');
      const e = S.issues.filter(x => x.level === 'e').length, w = S.issues.filter(x => x.level === 'w').length;
      R.chk.className = 'chk ' + (e ? 'e' : w ? 'w' : 'ok');
      R.chk.textContent = e ? `${e} erreur${e > 1 ? 's' : ''}${w ? ` · ${w} remarque${w > 1 ? 's' : ''}` : ''}` : w ? `${w} remarque${w > 1 ? 's' : ''}` : 'Bordereau cohérent';
    }
    function runChecks() {
      try { S.issues = def.checks ? def.checks(S.model) : []; } catch (e) { S.issues = []; console.error(e); }
    }
    function showIssues() {
      const old = root.querySelector('.ot-pop'); if (old) { old.remove(); return; }
      if (!S.issues.length) return;
      const p = document.createElement('div'); p.className = 'ot-pop';
      p.innerHTML = S.issues.map((x, i) => `<div class="${x.level}" data-i="${i}">${x.level === 'e' ? 'Erreur' : 'À vérifier'} — ${esc(x.msg)}</div>`).join('');
      p.addEventListener('click', ev => {
        const d = ev.target.closest('[data-i]'); if (!d) return;
        const x = S.issues[+d.dataset.i];
        const si = steps.findIndex(s => s.id === x.step);
        if (si >= 0) { S.step = si; S.page = 0; if (x.k) { const pi = steps[si].pages.findIndex(pg => pg.groups.some(g => g.fields.some(f => f.k === x.k))); if (pi >= 0) S.page = pi; } }
        p.remove(); S.focus = x.k || null; renderGuide();
        if (x.k) { const inp = R.groups.querySelector(`[data-k="${window.CSS.escape(x.k)}"] input, [data-k="${window.CSS.escape(x.k)}"] select`); if (inp) inp.focus(); }
      });
      root.appendChild(p);
    }

    function renderGuide() { renderSteps(); renderFields(); renderSchema(); renderLive(); renderHelp(); }
    function renderAll() {
      runChecks();
      if (S.mode === 'guide') renderGuide(); else { R.ta.value = safeText(); renderHelp(); }
      renderResults(); renderNote();
    }
    function safeText() { try { return E.formatBordereau(S.model); } catch (e) { return '« bordereau impossible à écrire : ' + e.message + ' »'; } }

    /* saisie */
    let redrawT;
    function onEdit(el) {
      const box = el.closest('.ot-f'); if (!box) return;
      const k = box.dataset.k, f = fieldByKey(k);
      let v;
      if (f.type === 'chk') v = el.checked ? (f.on == null ? 1 : f.on) : (f.off == null ? 0 : f.off);
      else if (f.type === 'sel') v = isNaN(Number(el.value)) || el.value === '' ? el.value : Number(el.value);
      else if (f.type === 'txt') v = el.value;
      else { const n = num(el.value); if (!isFinite(n)) { box.classList.add('bad'); return; } v = f.type === 'int' ? Math.round(n) : n; }
      box.classList.remove('bad');
      set(k, v);
      if (def.onChange) def.onChange(S.model, k, v);
      box.classList.toggle('chg', def.isChanged ? def.isChanged(S.model, k) : false);
      S.results = null;
      clearTimeout(redrawT);
      redrawT = setTimeout(() => { runChecks(); renderSteps(); renderSchema(); renderLive(); renderHelp(); markBad(); save(); if (f.relayout) renderFields(); }, 120);
    }
    R.groups.addEventListener('input', e => { if (e.target.matches('input:not([type=checkbox])') && !e.target.readOnly) onEdit(e.target); });
    R.groups.addEventListener('click', e => {   // champs « pick »
      const b = e.target.closest('.pk button'); if (!b) return;
      const box = b.closest('.ot-f'), k = box.dataset.k, cur = String(get(k)), v = b.dataset.v === cur ? 0 : (isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v);
      set(k, v); if (def.onChange) def.onChange(S.model, k, v); S.results = null; S._pk = null;
      runChecks(); renderFields(); renderSteps(); renderSchema(); renderLive(); renderHelp(); markBad(); save();
    });
    if (def.rows) { R.groups.addEventListener('input', e => { if (e.target.matches('input:not([type=checkbox])')) fitInputs(e.target); }); R.groups.addEventListener('change', e => { if (e.target.matches('select')) fitInputs(e.target); }); }
    R.groups.addEventListener('change', e => { if (e.target.matches('select,input[type=checkbox]')) { onEdit(e.target); const f = fieldByKey(e.target.closest('.ot-f').dataset.k); if (f && f.relayout) setTimeout(renderFields, 130); } });
    R.groups.addEventListener('focusin', e => { const b = e.target.closest('.ot-f'); if (b) { S.focus = b.dataset.k; if (def.onePage) followField(S.focus); hl(R.sch, S.focus); hl(R.live, S.focus); renderHelp(); } });
    R.groups.addEventListener('mouseover', e => { const b = e.target.closest('.ot-f'); if (b && b.dataset.k !== S.hover) { S.hover = b.dataset.k; if (def.onePage) followField(S.hover); hl(R.sch, S.hover); hl(R.live, S.hover); R.msg.innerHTML = helpFor(S.hover); } });
    R.groups.addEventListener('mouseleave', () => { S.hover = null; hl(R.sch, S.focus); hl(R.live, S.focus); renderHelp(); });
    R.groups.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const all = $$(R.groups, 'input,select'); const i = all.indexOf(e.target);
      if (i >= 0 && i < all.length - 1) { all[i + 1].focus(); if (all[i + 1].select) all[i + 1].select(); e.preventDefault(); }
      else if (i === all.length - 1) { e.preventDefault(); next(); }
    });
    /* clic sur une cote du dessin → focus sur la case */
    function figClick(e) {
      const t = e.target.closest('[data-k]'); if (!t) return;
      const k = t.getAttribute('data-k').split(' ')[0];
      for (let si = 0; si < steps.length; si++) {
        const pi = steps[si].pages.findIndex(pg => pg.groups.some(g => g.fields.some(f => f.k === k)));
        if (pi >= 0) {
          if (def.onePage) followField(k); else if (si !== S.step || pi !== S.page) { S.step = si; S.page = pi; renderGuide(); }
          const inp = R.groups.querySelector(`[data-k="${window.CSS.escape(k)}"] input, [data-k="${window.CSS.escape(k)}"] select`);
          if (inp && inp.type === 'checkbox') { if (!inp.disabled) inp.click(); return; }   // clic sur une charge du dessin : coche / décoche
          if (inp) { inp.focus(); if (inp.select) inp.select(); }
          return;
        }
      }
    }
    R.sch.addEventListener('click', figClick); R.live.addEventListener('click', figClick);
    R.sch.style.cursor = R.live.style.cursor = 'default';

    function go(i) { S.step = Math.max(0, Math.min(steps.length - 1, i)); S.page = 0; S.focus = null; S.view = steps[S.step].view || S.view; renderGuide(); }
    function next() { const st = steps[S.step]; if (S.page < st.pages.length - 1) { S.page++; renderFields(); } else go(S.step + 1); }
    R.steps.addEventListener('click', e => { const b = e.target.closest('.ot-st'); if (b) go(+b.dataset.i); });
    R.pages.addEventListener('click', e => { const b = e.target.closest('.ot-pg'); if (b) { S.page = +b.dataset.p; renderFields(); } });
    R.views.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { S.view = b.dataset.v; renderLive(); } });
    R.chk.addEventListener('click', showIssues);

    /* mode texte */
    let taT;
    R.ta.addEventListener('input', () => {
      clearTimeout(taT);
      taT = setTimeout(() => {
        try { const m = E.parseBordereau(R.ta.value); S.model = m; S.results = null; runChecks(); renderHelp(); save(); R.msg.textContent = 'Bordereau relu : les modifications sont reprises dans la saisie guidée.'; }
        catch (e) { R.msg.textContent = 'Lecture impossible : ' + e.message; }
      }, 400);
    });
    function setMode(m) {
      S.mode = m;
      $$(R.mode, 'button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
      R.guide.hidden = m !== 'guide'; R.texte.hidden = m !== 'texte';
      if (m === 'texte') { R.ta.value = safeText(); renderHelp(); } else renderGuide();
    }
    R.mode.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });

    /* onglets */
    function setTab(t) {
      S.tab = t;
      $$(R.tabs, 'button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
      $$(root, '[data-s]').forEach(s => { s.hidden = s.dataset.s !== t; });
      if (t === 'res') renderResults(); if (t === 'note') renderNote(); if (t === 'bord' && def.rows) fitRows();
    }
    R.tabs.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.t) setTab(b.dataset.t); });

    /* calcul */
    function run() {
      runChecks();
      const errs = S.issues.filter(x => x.level === 'e');
      if (errs.length) { toast('Corrigez d\'abord : ' + errs[0].msg); showIssues(); return; }
      const busy = document.createElement('div'); busy.className = 'ot-busy'; busy.textContent = 'Calcul en cours…'; root.appendChild(busy);
      setTimeout(() => {
        try {
          const m = JSON.parse(JSON.stringify(S.model));
          const r = E.compute(m);
          const d = new Date(), p = n => String(n).padStart(2, '0');
          const note = E.renderNote(m, r, { numero: def.numero ? def.numero(S.model) : '0001', date: `${p(d.getDate())}-${p(d.getMonth() + 1)}-${String(d.getFullYear()).slice(2)}` });
          S.results = r; S.note = note;
          setTab(def.simpleBar ? 'note' : 'res');
        } catch (e) { console.error(e); toast('Le calcul a échoué : ' + e.message); }
        busy.remove();
      }, 30);
    }
    function renderResults() {
      if (!S.results) { R.res.innerHTML = '<div class="ot-empty">Lancez le calcul depuis le bordereau.</div>'; return; }
      let h = '';
      try { h = def.summary ? def.summary(S.model, S.results, S.note) : ''; } catch (e) { console.error(e); }
      R.res.innerHTML = (h || '') + tocCard();
      if (!R.res.innerHTML.trim()) R.res.innerHTML = '<div class="ot-empty">Calcul terminé : voir la note de calcul.</div>';
    }
    function tocCard() {
      if (!S.note) return '';
      const L = String(S.note).split('\n'); const i0 = L.findIndex(l => /SOMMAIRE/.test(l)); if (i0 < 0) return '';
      const rows = []; let grp = '';
      for (let i = i0 + 1; i < Math.min(L.length, i0 + 120); i++) {
        const l = L[i]; if (/\bPAGE\s+\d+\s*$/.test(l)) break;
        const g = l.match(/^\s*\*\s*([^*]+?)\s*\*\s*$/); if (g) { grp = g[1]; continue; }
        const m = l.match(/^\s*P\.\s*(\d+)\s+(.*\S)/); if (m) rows.push([+m[1], m[2].replace(/\s{2,}/g, ' · '), grp]);
      }
      if (!rows.length) return '';
      return `<div class="ot-card" style="grid-column:1/-1"><h4>Sommaire de la note</h4>${rows.map(r => `<div class="ot-kv" style="cursor:pointer" data-pg="${r[0]}"><span>${esc(r[1])}</span><b style="color:var(--gold)">p. ${r[0]}</b></div>`).join('')}</div>`;
    }
    R.res.addEventListener('click', e => {
      const d = e.target.closest('[data-pg]'); if (!d) return;
      setTab('note');
      const n = +d.dataset.pg; const pre = $$(R.note, 'pre').find(p => new RegExp('PAGE\\s+' + n + '\\s*\\n').test(p.textContent + '\n'));
      if (pre) pre.scrollIntoView({ block: 'start' });
    });
    function pagesOf(note) { return String(note).split(/\f|\n(?=[^\n]*\bPAGE\s+\d+[ \t]*$)/m).filter(x => x.trim()); }
    function renderNote() {
      if (!S.note) { R.note.innerHTML = '<div class="ot-empty">Aucune note pour l\'instant.</div>'; R.nfo.textContent = ''; return; }
      const q = R.find.value.trim();
      const pgs = pagesOf(S.note);
      let hits = 0;
      // croquis intercalés (def.figures : [{ after: indice de page (0 = première), html }]), séquence SETRA conservée
      let figs = []; try { figs = (def.figures && S.results) ? (def.figures(S.model, S.results, pgs) || []) : []; } catch (e) { console.error(e); figs = []; }
      R.note.innerHTML = pgs.map((p, i) => {
        let t = esc(p);
        if (q) { const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); t = t.replace(re, m => { hits++; return `<mark>${m}</mark>`; }); }
        return `<pre>${t}</pre>` + figs.filter(f => f.after === i).map(f => f.html).join('');
      }).join('') + figs.filter(f => f.after == null || f.after >= pgs.length).map(f => f.html).join('');
      R.nfo.textContent = `${pgs.length} pages${figs.length ? ` + ${figs.length} planche${figs.length > 1 ? 's' : ''}` : ''}${q ? ` · ${hits} occurrence${hits > 1 ? 's' : ''}` : ''}`;
      if (q) { const mk = R.note.querySelector('mark'); if (mk) mk.scrollIntoView({ block: 'center' }); }
    }
    let fT; R.find.addEventListener('input', () => { clearTimeout(fT); fT = setTimeout(renderNote, 250); });

    function download(name, text) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    async function saveAs(name, text) {   // « Enregistrer sous » : choix du fichier quand le navigateur le permet, sinon téléchargement
      if (window.showSaveFilePicker) {
        try { const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Bordereau ' + def.prog, accept: { 'text/plain': ['.txt'] } }] });
          const w = await h.createWritable(); await w.write(text); await w.close(); toast('Bordereau enregistré : ' + h.name); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      download(name, text);
    }
    const barEl = root.querySelector('.ot-bar');   // la barre peut être déplacée hors de root (bandeau de la page) : écouteur propre
    if (barEl) barEl.addEventListener('click', e => { e.stopPropagation(); onAct(e); });
    root.addEventListener('click', e => onAct(e));
    function onAct(e) {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'run') run();
      else if (a === 'prev') { if (S.page > 0) { S.page--; renderFields(); } else go(S.step - 1); }
      else if (a === 'next') next();
      else if (a === 'new') { if (confirmNew()) { setModel(def.blank(), null); S.step = 0; S.page = 0; renderAll(); toast('Nouveau bordereau'); } }
      else if (a === 'save') download(`${def.prog}-bordereau.txt`, safeText());
      else if (a === 'saveas') saveAs(`${def.prog}-bordereau.txt`, safeText());
      else if (a === 'import') R.file.click();
      else if (a === 'copy') { if (S.note && navigator.clipboard) navigator.clipboard.writeText(S.note).then(() => toast('Note copiée')); }
      else if (a === 'dl') { if (S.note) download(`${def.prog}-note.txt`, S.note); }
      else if (a === 'print') { if (!S.note) return; document.body.classList.add('ot-print'); setTimeout(() => { window.print(); document.body.classList.remove('ot-print'); }, 50); }
   }
    function confirmNew() { return true; }
    R.ex.addEventListener('change', () => {
      const i = R.ex.value; if (i === '') return;
      const x = def.examples[+i];
      try { setModel(E.parseBordereau(x.text), true); S.step = 0; S.page = 0; renderAll(); toast('Exemple chargé : ' + x.label); } catch (e) { toast('Exemple illisible : ' + e.message); }
      R.ex.value = '';
    });
    R.file.addEventListener('change', () => {
      const f = R.file.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { setModel(E.parseBordereau(String(rd.result)), true); S.step = 0; S.page = 0; renderAll(); toast('Bordereau importé : ' + f.name); }
        catch (e) { toast('Fichier illisible : ' + e.message); }
        R.file.value = '';
      };
      rd.readAsText(f, 'latin1');
    });

    /* démarrage : brouillon, sinon exemple */
    let start = null;
    const draft = store.get(KEY);
    if (draft) { try { start = E.parseBordereau(draft); } catch (e) { start = null; } }
    if (!start && def.examples && def.examples[0]) { try { start = E.parseBordereau(def.examples[0].text); } catch (e) { start = null; } }
    if (!start) start = def.blank();
    S.model = start;
    let rows = 1;
    for (const st of steps) for (const pg of st.pages) for (const g of pg.groups) { const c = g.cols || Math.min(6, g.fields.length); rows = Math.max(rows, Math.ceil(g.fields.length / c)); }
    root.style.setProperty('--fh', (34 + rows * 52) + 'px');
    renderAll();
    window.addEventListener('resize', () => { if (S.tab === 'bord' && S.mode === 'guide') { renderSchema(); renderLive(); if (def.rows) fitRows(); } });
    return { get model() { return S.model; }, run, setTab, go };
  }

  G.OTUI = { mount, svg, chart, figPage, esc, fmt, num };
})(typeof globalThis !== 'undefined' ? globalThis : this);
