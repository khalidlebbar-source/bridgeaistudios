/* ════════════════════════════════════════════════════════════════════
   HandBag — croquis, courbes et lecture « en clair » de chaque calcul.
   FIGS[id](I, g)  → SVG (I : données, g(k) : valeur calculée de clé k)
   CLAIR[id](I, g) → phrase de synthèse pour un lecteur non spécialiste
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG || (typeof require !== "undefined" ? require("./calcs.js") : {});
const fmt = (v, d = 2) => typeof v === "number" && isFinite(v) ? (abs(v) < 1e-9 ? 0 : v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : (v === Infinity ? "∞" : String(v));
const { min, max, PI, exp, sqrt, log10, pow, abs } = Math;

/* ─── palette ─── */
const K = { ink: "#3c3f4d", mute: "#9a9daa", grid: "#e8e3db", gold: "#a07828", goldL: "#e9d9a8", blue: "#1a4fd6", blueL: "#c9d7f7", red: "#c0392b", redL: "#f3c9c4",
  teal: "#0a8a78", tealL: "#bfe5dd", conc: "#ddd7cb", concD: "#b9b2a3", steel: "#8aa4c8", soil: "#d9c7a6", soilD: "#b49a6c" };

/* ─── primitives ─── */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const svg = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="Outfit,Arial,sans-serif" font-size="10" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const T = (x, y, s, o = {}) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${o.c || K.ink}" font-size="${o.s || 10}" ${o.a ? `text-anchor="${o.a}"` : ""} ${o.w ? `font-weight="${o.w}"` : ""} ${o.i ? 'font-style="italic"' : ""}>${esc(s)}</text>`;
const P = (d, o = {}) => `<path d="${d}" stroke="${o.c || K.ink}" stroke-width="${o.w || 1.2}" fill="${o.f || "none"}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ""} ${o.op ? `opacity="${o.op}"` : ""}/>`;
const Rc = (x, y, w, h, o = {}) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${max(w, 0).toFixed(1)}" height="${max(h, 0).toFixed(1)}" fill="${o.f || K.conc}" stroke="${o.c || K.concD}" stroke-width="${o.w || 0.8}" ${o.r ? `rx="${o.r}"` : ""} ${o.op ? `opacity="${o.op}"` : ""}/>`;
const Ci = (x, y, r, o = {}) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${o.f || K.conc}" stroke="${o.c || K.concD}" stroke-width="${o.w || 0.8}"/>`;
function arrow(x1, y1, x2, y2, c = K.red, w = 1.6) {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 6;
  return P(`M${x1} ${y1}L${x2} ${y2}`, { c, w }) + P(`M${x2 - h * Math.cos(a - 0.45)} ${y2 - h * Math.sin(a - 0.45)}L${x2} ${y2}L${x2 - h * Math.cos(a + 0.45)} ${y2 - h * Math.sin(a + 0.45)}`, { c, w, f: c });
}
const pin = (x, y) => P(`M${x} ${y}l-7 11h14z`, { c: K.ink, w: 1, f: "#cfd3dc" }) + P(`M${x - 10} ${y + 13}h20`, { c: K.ink, w: 1 });
const roller = (x, y) => P(`M${x} ${y}l-7 9h14z`, { c: K.ink, w: 1, f: "#cfd3dc" }) + Ci(x - 4, y + 11.5, 2, { f: "#fff", c: K.ink }) + Ci(x + 4, y + 11.5, 2, { f: "#fff", c: K.ink }) + P(`M${x - 10} ${y + 14}h20`, { c: K.ink, w: 1 });
function ground(x1, x2, y) { let d = `M${x1} ${y}H${x2}`; for (let x = x1 + 4; x < x2; x += 7) d += `M${x} ${y}l-5 6`; return P(d, { c: K.ink, w: 1 }); }
function dim(x1, x2, y, label, c = K.mute) {
  return P(`M${x1} ${y}H${x2}M${x1} ${y - 4}v8M${x2} ${y - 4}v8`, { c, w: 0.8 }) + T((x1 + x2) / 2, y - 3, label, { a: "middle", c: K.ink, s: 9.5 });
}
function dimV(x, y1, y2, label, c = K.mute, side = -1) {
  return P(`M${x} ${y1}V${y2}M${x - 4} ${y1}h8M${x - 4} ${y2}h8`, { c, w: 0.8 }) + T(x + side * 5, (y1 + y2) / 2 + 3, label, { a: side < 0 ? "end" : "start", s: 9.5 });
}
const tag = (x, y, s, c = K.ink, bg = "#fff") => { const w = s.length * 5.6 + 10; return `<rect x="${(x - w / 2).toFixed(1)}" y="${(y - 10).toFixed(1)}" width="${w.toFixed(1)}" height="15" rx="4" fill="${bg}" stroke="${c}" stroke-width=".8"/>` + T(x, y + 1, s, { a: "middle", c, s: 9.5, w: 500 }); };
function udl(x1, x2, y, n, c = K.red, h = 14) { let s = P(`M${x1} ${y - h}H${x2}`, { c, w: 1.2 }); for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n; s += arrow(x, y - h, x, y - 1, c, 1); } return s; }

/* ─── jauge « demande / capacité » ─── */
function gauge(x, y, w, ratio, label, okLabel) {
  const r = max(0, ratio), ok = r <= 1, fillW = min(r, 1.5) / 1.5 * w, c = ok ? K.teal : K.red;
  return T(x, y - 6, label, { s: 9.5 }) + Rc(x, y, w, 10, { f: "#f1eee8", c: "#ddd7cb", r: 4 }) + Rc(x, y, fillW, 10, { f: c, c, r: 4, op: .85 }) +
    P(`M${x + w / 1.5} ${y - 2}v14`, { c: K.ink, w: 1, dash: "2 2" }) + (w >= 130 ? T(x + w / 1.5, y + 21, "limite", { a: "middle", s: 8, c: K.mute }) : "") +
    T(x + w, y + 21, `${fmt(r * 100, 0)} % ${okLabel !== undefined ? okLabel : ok ? "✓" : "✗"}`, { a: "end", s: 9.5, c, w: 500 });
}

/* ─── graphique XY ─── */
function nice(v) { const e = pow(10, Math.floor(log10(v || 1))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; }
function plot(o) {
  const W = o.w || 330, L = o.left ?? 42, Rr = 12;
  /* légende (séries + lignes de repère) dans un bandeau au-dessus du graphique : jamais sur les courbes */
  const items = o.series.filter(s => s.l).map(s => ({ l: s.l, c: s.c || K.gold, w: s.w || 2, dash: s.dash }))
    .concat((o.hlines || []).filter(h => h.l).map(h => ({ l: h.l, c: h.c || K.mute, w: 1, dash: "4 3" })));
  const tw = t => t.length * 4.75 + 26, rows = []; let cur = [], cw = 0;
  items.forEach(it => { const w = tw(it.l); if (cw + w > W - L - Rr + 30 && cur.length) { rows.push(cur); cur = []; cw = 0; } cur.push([it, w]); cw += w + 8; });
  if (cur.length) rows.push(cur);
  const legH = rows.length * 13, Tt = 8 + legH + (legH ? 4 : 0);
  const hasVl = (o.vlines || []).some(v => v.l), B = 26 + (hasVl ? 12 : 0) + (o.xl ? 10 : 0);
  const ph = max(70, (o.h || 170) - Tt - B), H = Tt + ph + B, pw = W - L - Rr;
  const xs = o.series.flatMap(s => s.pts.map(p => p[0])), ys = o.series.flatMap(s => s.pts.map(p => p[1])).concat(o.extraY || [], (o.hlines || []).map(h => h.y));
  const x0 = o.xmin ?? min(...xs), x1 = o.xmax ?? max(...xs), y0 = o.ymin ?? min(0, ...ys), y1 = o.ymax ?? max(...ys) * 1.1;
  const lx = o.logx, fx = x => lx ? (log10(x) - log10(x0)) / (log10(x1) - log10(x0)) : (x - x0) / (x1 - x0);
  const X = x => L + fx(x) * pw, Y = y => Tt + ph - (y - y0) / (y1 - y0) * ph;
  let g = "";
  const yst = nice((y1 - y0) / 4); for (let v = Math.ceil(y0 / yst - 1e-9) * yst; v <= y1 + 1e-9; v += yst) g += P(`M${L} ${Y(v)}H${L + pw}`, { c: K.grid, w: .8 }) + T(L - 5, Y(v) + 3, fmt(v, yst < 0.01 ? 3 : yst < 0.1 ? 2 : yst < 1 ? 1 : 0), { a: "end", s: 8.5, c: K.mute });
  const xt = []; if (lx) { for (let e = Math.ceil(log10(x0)); e <= log10(x1) + 1e-9; e++) xt.push(pow(10, e)); } else { const xst = o.xstep || nice((x1 - x0) / 5); for (let v = Math.ceil(x0 / xst - 1e-9) * xst; v <= x1 + 1e-9; v += xst) xt.push(v); }
  const xd = !lx && (o.xstep || nice((x1 - x0) / 5)) < 1 ? 1 : 0;
  xt.forEach(v => g += P(`M${X(v)} ${Tt}V${Tt + ph}`, { c: K.grid, w: .8 }) + T(X(v), Tt + ph + 12, fmt(v, xd), { a: "middle", s: 8.5, c: K.mute }));
  g += P(`M${L} ${Tt}V${Tt + ph}H${L + pw}`, { c: K.ink, w: 1 });
  (o.areas || []).forEach(a => { if (!a.pts.length) return; g += P(a.pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join("") + `L${X(a.pts.at(-1)[0])} ${Y(y0)}L${X(a.pts[0][0])} ${Y(y0)}Z`, { c: "none", f: a.c, op: a.op || .25 }); });
  (o.hlines || []).forEach(h => { g += P(`M${L} ${Y(h.y)}H${L + pw}`, { c: h.c || K.mute, w: 1, dash: "4 3" }); });
  (o.vlines || []).forEach(v => { g += P(`M${X(v.x)} ${Tt}V${Tt + ph}`, { c: v.c || K.mute, w: 1, dash: "4 3" }) + (v.l ? T(X(v.x), Tt + ph + 24, v.l, { a: "middle", s: 8.5, c: v.c || K.mute, w: 500 }) : ""); });
  o.series.forEach(s => { g += P(s.pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(""), { c: s.c || K.gold, w: s.w || 2, dash: s.dash }); });
  /* étiquettes des points : position choisie pour éviter courbes, autres étiquettes et bords */
  const obst = o.series.flatMap(s => { const out = []; for (let k = 0; k < s.pts.length - 1; k++) for (let t = 0; t <= 1; t += .25) out.push([X(s.pts[k][0] + (s.pts[k + 1][0] - s.pts[k][0]) * t), Y(s.pts[k][1] + (s.pts[k + 1][1] - s.pts[k][1]) * t)]); return out; });
  const boxes = [];
  (o.marks || []).forEach(m => {
    const px = X(m.x), py = Y(m.y), w = m.l.length * 5.3 + 6, h = 12;
    const cands = [[8, -16], [-8 - w, -16], [8, 6], [-8 - w, 6], [-w / 2, -22], [-w / 2, 10], [14, -5], [-14 - w, -5]];
    let best = null, bs = 1e9;
    cands.forEach(([dx, dy]) => { const bx = px + dx, by = py + dy; let sc = 0;
      if (bx < L + 2 || bx + w > L + pw || by < Tt || by + h > Tt + ph - 2) sc += 1000;
      obst.forEach(([ox, oy]) => { if (ox > bx - 2 && ox < bx + w + 2 && oy > by - 2 && oy < by + h + 2) sc += 10; });
      boxes.forEach(b => { if (bx < b[0] + b[2] && bx + w > b[0] && by < b[1] + b[3] && by + h > b[1]) sc += 500; });
      sc += abs(dx) * .02 + abs(dy) * .02; if (sc < bs) { bs = sc; best = [bx, by]; } });
    boxes.push([best[0], best[1], w, h]);
    g += P(`M${px} ${Y(y0)}V${py}H${L}`, { c: m.c || K.red, w: .8, dash: "2 2" }) + Ci(px, py, 4, { f: m.c || K.red, c: "#fff", w: 1.2 }) +
      `<rect x="${best[0].toFixed(1)}" y="${best[1].toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="3" fill="#fff" fill-opacity=".9"/>` + T(best[0] + 3, best[1] + 9.5, m.l, { s: 9.5, w: 500, c: K.ink });
  });
  rows.forEach((r, ri) => { let x = L; r.forEach(([it, w]) => { const y = 8 + ri * 13 + 5; g += P(`M${x} ${y}h16`, { c: it.c, w: it.w, dash: it.dash }) + T(x + 21, y + 3, it.l, { s: 9 }); x += w + 8; }); });
  if (o.yl) g += `<text transform="translate(10 ${(Tt + ph / 2).toFixed(1)}) rotate(-90)" fill="${K.mute}" font-size="9" text-anchor="middle">${esc(o.yl)}</text>`;
  if (o.xl) g += T(L + pw, H - 3, o.xl, { a: "end", s: 9, c: K.mute });
  return svg(W, H, g);
}
const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
const logRange = (a, b, n) => range(log10(a), log10(b), n).map(v => pow(10, v));

/* ─── poutre schématique avec déformée ─── */
function beam(o) {
  const W = o.w || 330, H = o.h || 150, x1 = 30, x2 = W - 30, y = o.y || 70; let s = "";
  s += Rc(x1, y - 7, x2 - x1, 9, { f: K.conc, c: K.concD });
  s += pin(x1, y + 2) + roller(x2, y + 2);
  return { s, x1, x2, y, W, H };
}
const curve = (x1, x2, y, f, n = 40) => range(0, 1, n).map((t, i) => (i ? "L" : "M") + (x1 + (x2 - x1) * t).toFixed(1) + " " + (y + f(t)).toFixed(1)).join("");
const sin_ = t => 16 / 5 * (t - 2 * t ** 3 + t ** 4);   // déformée normalisée d'une poutre sous charge uniforme (max 1 à mi-portée)

/* ════════════════════════ FIGURES ════════════════════════ */
const FIGS = {
"beton-bael"(I, g) {
  const f = j => j >= 28 ? I.fc28 : (I.fc28 <= 40 ? j / (4.76 + 0.83 * j) : j / (1.40 + 0.95 * j)) * I.fc28;
  const pts = range(0.5, 90, 120).map(j => [j, f(j)]);
  return plot({ series: [{ pts, l: "fcj : résistance à j jours" }], hlines: [{ y: I.fc28, l: `fc28 = ${fmt(I.fc28, 0)} MPa` }], vlines: [{ x: 28, l: "28 j" }],
    marks: [{ x: min(I.j, 90), y: g("fcj"), l: `${fmt(g("fcj"), 1)} MPa à ${fmt(I.j, 0)} j`, left: I.j > 55 }], xl: "âge du béton (jours)", yl: "MPa", xmax: 90 });
},
"beton-ec2"(I, g) {
  const fck = +I.fck, fcd = fck / 1.5, e2 = 2, eu = 3.5, n = 2;
  const pts = range(0, eu, 70).map(e => [e, e < e2 ? fcd * (1 - pow(1 - e / e2, n)) : fcd]);
  return plot({ series: [{ pts, l: "loi parabole-rectangle (ELU)" }], hlines: [{ y: fck, l: `fck = ${fck} MPa`, c: K.mute }, { y: fcd, l: `fcd = ${fmt(fcd, 1)} MPa`, c: K.gold }],
    vlines: [{ x: e2, l: "εc2" }, { x: eu, l: "εcu2" }], xl: "raccourcissement ε (‰)", yl: "σ (MPa)", ymax: fck * 1.15, xmax: 3.8 });
},
"retrait-ec2"(I, g) {
  const fcm = I.fck + 8, h0 = g("h0"), kh = g("kh"), e0 = g("ecd0"), eI = g("ecaInf");
  const cd = t => (t - I.ts) <= 0 ? 0 : (t - I.ts) / ((t - I.ts) + 0.04 * pow(h0, 1.5)) * kh * e0, ca = t => (1 - exp(-0.2 * sqrt(t))) * eI;
  const ts = logRange(1, 36500, 90), u = 1e3;
  const marks = isFinite(I.t) ? [{ x: min(max(I.t, 1), 36500), y: (cd(I.t) + ca(I.t)) * u, l: `${fmt((cd(I.t) + ca(I.t)) * u, 3)} ‰` }] : [];
  return plot({ logx: true, series: [{ pts: ts.map(t => [t, (cd(t) + ca(t)) * u]), l: "retrait total εcs" }, { pts: ts.map(t => [t, cd(t) * u]), c: K.blue, w: 1.4, dash: "5 3", l: "dessiccation εcd" }, { pts: ts.map(t => [t, ca(t) * u]), c: K.teal, w: 1.4, dash: "2 2", l: "endogène εca" }],
    hlines: [{ y: g("ecs") * u, l: `à l'infini : ${fmt(g("ecs") * u, 3)} ‰` }], marks, xl: "âge (jours, échelle log)", yl: "‰", xmin: 1, xmax: 36500 });
},
"retrait-fluage"(I, g) {
  const rm = g("rm"), Tm = max(3650, I.t * 1.5), r = t => t / (t + 9 * rm), f = t => t <= I.t1 ? 0 : sqrt(t - I.t1) / (sqrt(t - I.t1) + 5 * sqrt(rm));
  const ts = range(0, Tm, 120);
  return plot({ series: [{ pts: ts.map(t => [t, r(t) * 100]), l: "retrait consommé r(t)" }, { pts: ts.map(t => [t, f(t) * 100]), c: K.blue, w: 1.6, dash: "5 3", l: "fluage consommé f(t)" }],
    areas: [{ pts: ts.filter(t => t <= I.t).map(t => [t, r(t) * 100]), c: K.gold }],
    marks: [{ x: I.t, y: r(I.t) * 100, l: `retrait ${fmt(r(I.t) * 100, 0)} %` }, { x: I.t, y: f(I.t) * 100, l: `fluage ${fmt(f(I.t) * 100, 0)} %`, c: K.blue, dy: 14 }],
    vlines: [{ x: I.t, l: `t = ${fmt(I.t, 0)} j`, c: K.red }], xl: "jours", yl: "% consommé", ymax: 100, legRight: true });
},
"acier-precontrainte"(I, g) {
  const bars = [["fprg", I.fprg, K.mute], ["0,8 fprg", 0.8 * I.fprg, K.blueL], ["fpeg", I.fpeg, K.mute], ["0,9 fpeg", 0.9 * I.fpeg, K.blueL]], W = 330, H = 160, mx = I.fprg * 1.1, X0 = 70, bw = 36;
  let s = ""; bars.forEach(([l, v, c], i) => { const h = v / mx * 110, x = X0 + i * 62; s += Rc(x, 140 - h, bw, h, { f: c, c: "none" }) + T(x + bw / 2, 134, fmt(v, 0), { a: "middle", s: 9, c: "#fff", w: 500 }) + T(x + bw / 2, 153, l, { a: "middle", s: 9.5 }); });
  const y = 140 - g("sp0") / mx * 110;
  s += P(`M50 ${y}H${W - 10}`, { c: K.gold, w: 2 }) + P("M60 12h16", { c: K.gold, w: 2 }) + T(82, 15, `σp0 = ${fmt(g("sp0"), 0)} MPa : la plus petite des deux limites`, { c: K.gold, s: 10, w: 500 }) + P(`M50 140H${W - 10}`, { c: K.ink, w: 1 });
  return svg(W, 160, s);
},
"section-mixte"(I, g) {
  const Ht = I.H + I.hr + I.hh, Wm = max(I.bh, I.bs, I.bi), sc = min(250 / Wm, 150 / Ht), cx = 150, y0 = 165, hw = I.H - I.ts - I.ti;
  const r = (b, h, z, f, c) => Rc(cx - b * sc / 2, y0 - (z + h) * sc, b * sc, h * sc, { f, c });
  let s = r(I.bi, I.ti, 0, K.steel, "#5d7aa3") + r(I.tw, hw, I.ti, K.steel, "#5d7aa3") + r(I.bs, I.ts, I.ti + hw, K.steel, "#5d7aa3") + r(I.br, I.hr, I.H, K.conc, K.concD) + r(I.bh, I.hh, I.H + I.hr, K.conc, K.concD);
  const ym = y0 - g("vm") * 10 * sc, ya = y0 - g("va") * 10 * sc;
  s += P(`M8 ${ym}H292`, { c: K.gold, w: 1.4, dash: "6 3" }) + tag(48, ym - 2, `G mixte ${fmt(g("vm"), 1)} cm`, K.gold);
  s += P(`M60 ${ya}H240`, { c: K.blue, w: 1.2, dash: "2 3" }) + tag(258, ya + 4, `G acier ${fmt(g("va"), 1)} cm`, K.blue);
  s += T(cx, y0 - (Ht - I.hh / 2) * sc + 3, "béton (÷ n)", { a: "middle", s: 9, c: K.ink }) + P(`M20 ${y0}H280`, { c: K.mute, w: .6 }) + T(282, y0 + 3, "fibre inf.", { s: 8.5, c: K.mute });
  return svg(300, 180, s);
},
"raideur-appui"(I, g) {
  let s = ground(60, 180, 160) + Rc(105, 40, 30, 120) + Rc(95, 30, 50, 10, { f: "#3c3f4d", c: "#3c3f4d" });
  for (let i = 0; i < 3; i++) s += Rc(97 + i * 16, 22, 14, 8, { f: "#555", c: "#333" });
  s += Rc(80, 12, 80, 10, { f: K.conc }) + arrow(230, 17, 165, 17) + T(234, 20, `F = ${fmt(I.F, 0)} kN`, { c: K.red, s: 10, w: 500 });
  s += P(`M120 160 Q123 90 ${120 + 26} 30`, { c: K.gold, w: 1.6, dash: "5 3" }) + T(150, 60, `u = ${fmt(I.u, 1)} mm`, { c: K.gold, s: 10 });
  s += dimV(70, 40, 160, `H = ${fmt(I.H, 1)} m`);
  s += tag(250, 75, `Iéq = ${fmt(g("Ieq"), 3)} m⁴`) + tag(250, 100, `K appui = ${fmt(g("K") / 1000, 0)} MN/m`) + tag(250, 125, `K AA = ${fmt(g("Kaa") / 1000, 1)} MN/m`);
  return svg(330, 175, s);
},
"fleche-prefa"(I, g) {
  const b = beam({ y: 70, h: 165 }), sc = 42 / max(g("Fg"), I.CF, 1);
  let s = b.s;
  const lines = [[g("F1"), K.blue, "4 3", "F1 à la pose"], [g("F1") + 2 / 3 * g("F2"), K.teal, "6 3", "F1 + 2/3 F2"], [g("Fg"), K.red, "", "flèche globale"]];
  lines.forEach(([f, c, d, l], i) => { s += P(curve(b.x1, b.x2, b.y + 4, t => sin_(t) * f * sc), { c, w: 1.6, dash: d }); s += T(b.x1, 130 + i * 12, `— ${l} : ${fmt(f, 1)} mm`, { c, s: 9.5 }); });
  s += P(curve(b.x1, b.x2, b.y - 8, t => -sin_(t) * I.CF * sc), { c: K.gold, w: 2 }) + T(165, b.y - 8 - I.CF * sc - 5, `contre-flèche ${fmt(I.CF, 0)} mm`, { a: "middle", c: K.gold, s: 10, w: 500 });
  s += T(b.x2 - 2, 158, "(échelle verticale amplifiée)", { a: "end", s: 8, c: K.mute });
  return svg(330, 165, s);
},
"fleche-tablier"(I, g) {
  const b = beam({ y: 76, h: 150 }), sc = 34 / max(g("Fv"), I.CF, 1);
  let s = udl(b.x1, b.x2, b.y - 8, 12) + T(165, b.y - 27, `p = ${fmt(g("p"), 0)} kN/ml`, { a: "middle", c: K.red, s: 10, w: 500 }) + b.s;
  s += P(curve(b.x1, b.x2, b.y + 4, t => sin_(t) * g("Fv") * sc), { c: K.red, w: 1.8, dash: "5 3" }) + T(165, b.y + 14 + g("Fv") * sc, `flèche différée ${fmt(g("Fv"), 1)} mm`, { a: "middle", c: K.red, s: 10 });
  s += P(curve(b.x1, b.x2, b.y - 6, t => -sin_(t) * I.CF * sc * 0.4), { c: K.gold, w: 1.6, op: .8 }) + T(165, 140, `contre-flèche à donner : ${fmt(I.CF, 0)} mm`, { a: "middle", c: K.gold, s: 10, w: 500 });
  return svg(330, 150, s);
},
"contre-fleche"(I, g) {
  const x1 = 30, x2 = 300, y = 120, sc = 80 / I.f, a = -4 * I.f / I.L ** 2, b = 4 * I.f / I.L;
  let s = P(`M${x1} ${y}H${x2}`, { c: K.mute, dash: "4 3" }) + pin(x1, y) + roller(x2, y);
  s += P(curve(x1, x2, y, t => -(a * (t * I.L) ** 2 + b * t * I.L) * sc), { c: K.gold, w: 2.2 });
  for (let k = 1; k < 10; k++) { const t = k / 10, v = a * (t * I.L) ** 2 + b * t * I.L, x = x1 + (x2 - x1) * t; s += P(`M${x} ${y}V${y - v * sc}`, { c: K.gold, w: .8, dash: "2 2" }) + T(x, y - v * sc - 4, fmt(v, 0), { a: "middle", s: 8.5 }); }
  s += dim(x1, x2, y + 24, `L = ${fmt(I.L, 2)} m`) + T(x1, 14, "ordonnées en mm, à chaque dixième de portée", { s: 9, c: K.mute });
  return svg(330, 160, s);
},
"fleche-mur"(I, g) {
  const y0 = 150, yt = 18, hW = y0 - yt, x = 90;
  let s = ground(30, 300, y0) + Rc(x - 14, yt, 14, hW) + P(`M${x - 40} ${y0}H${x + 30}`, { c: K.ink, w: 1 });
  s += P(`M${x} ${yt}L${x} ${y0}L${x + 110} ${y0}Z`, { c: K.red, w: 1, f: K.redL }) + T(x + 116, y0 - 5, `poussée des terres`, { s: 9.5, c: K.red });
  for (let i = 1; i <= 5; i++) { const yy = yt + hW * i / 5.5, len = 110 * (yy - yt) / hW; s += arrow(x + len, yy, x + 2, yy, K.red, 1); }
  s += Rc(x, yt, 26, hW, { f: "#c9d7f744", c: K.blue }) + T(x + 30, yt + 12, "surcharge q", { s: 9.5, c: K.blue });
  s += P(`M${x - 7} ${y0} Q${x - 9} ${yt + 60} ${x - 7 - 30} ${yt}`, { c: K.gold, w: 2, dash: "5 3" }) + T(x - 40, yt - 4, `f = ${fmt(g("f"), 1)} mm`, { a: "middle", c: K.gold, s: 10, w: 500 });
  s += dimV(x - 60, yt, y0, `l = ${fmt(I.l, 1)} m`) + tag(255, 60, `terres ${fmt(g("ft"), 1)} mm`, K.red) + tag(255, 82, `surcharge ${fmt(g("fq"), 1)} mm`, K.blue);
  return svg(330, 165, s);
},
"fleche-pile"(I, g) {
  let s = ground(40, 170, 150) + Rc(95, 30, 24, 120) + arrow(190, 32, 125, 32) + T(194, 35, `F = ${fmt(I.F, 0)} kN`, { c: K.red, s: 10, w: 500 });
  s += P(`M107 150 Q110 85 ${107 + 34} 30`, { c: K.gold, w: 1.8, dash: "5 3" }) + T(146, 56, `u = ${fmt(g("uv"), 2)} mm`, { c: K.gold, s: 10, w: 500 }) + T(146, 68, "à long terme", { c: K.gold, s: 8.5 }) + dimV(70, 30, 150, `H = ${fmt(I.H, 1)} m`);
  const cx = 272, cy = 112; s += T(cx, 88, "section", { a: "middle", s: 9, c: K.mute });
  if (I.sec === "P") { const n = max(1, min(6, Math.round(I.n))); for (let i = 0; i < n; i++) s += Ci(cx - (n - 1) * 9 + i * 18, cy, 7); }
  else if (I.sec === "B") { const n = max(1, min(6, Math.round(I.n))); for (let i = 0; i < n; i++) s += Rc(cx - (n - 1) * 8 + i * 16 - 5, cy - 14, 10, 28); }
  else s += Rc(cx - 22, cy - 14, 44, 28);
  s += T(cx, cy + 30, `I = ${fmt(g("In"), 2)} m⁴`, { a: "middle", s: 9.5 });
  return svg(330, 160, s);
},
"rotation"(I, g) {
  const b = beam({ y: 70, h: 150 }); let s = I.cas === "q" ? udl(b.x1, b.x2, b.y - 8, 12) + T(165, b.y - 26, `p = ${fmt(I.p, 0)} kN/ml`, { a: "middle", c: K.red, s: 10 }) : arrow(165, 20, 165, b.y - 9) + T(170, 26, `P = ${fmt(I.p, 0)} kN`, { c: K.red, s: 10 });
  s += b.s + P(curve(b.x1, b.x2, b.y + 4, t => sin_(t) * 30), { c: K.gold, w: 1.8, dash: "5 3" });
  s += P(`M${b.x1} ${b.y + 4}L${b.x1 + 70} ${b.y + 4 + 36}`, { c: K.blue, w: 1 }) + P(`M${b.x1 + 40} ${b.y + 4} A40 40 0 0 1 ${b.x1 + 35} ${b.y + 22}`, { c: K.blue, w: 1.2 }) + T(b.x1 + 46, b.y + 18, "α", { c: K.blue, s: 12, w: 500 });
  s += T(165, 130, `α instantané = ${fmt(g("ai") * 1000, 2)} ‰   ·   α différé = ${fmt(g("av") * 1000, 2)} ‰`, { a: "middle", s: 10, w: 500 }) + T(165, 144, "rotation de la poutre sur son appareil d'appui", { a: "middle", s: 9, c: K.mute });
  return svg(330, 150, s);
},
"maj-dyn"(I, g) {
  const r = I.G / I.S, f = L => 1 + 0.4 / (1 + 0.2 * L) + 0.6 / (1 + 4 * r);
  return plot({ series: [{ pts: range(1, 100, 100).map(L => [L, f(L)]), l: `δ(L) pour G/S = ${fmt(r, 2)}` }], hlines: [{ y: 1, l: "sans majoration" }],
    marks: [{ x: min(I.L, 100), y: g("delta"), l: `δ = ${fmt(g("delta"), 3)}` }], xl: "longueur L (m)", yl: "δ", ymin: 0.9, ymax: max(1.6, g("delta") * 1.05), legRight: true });
},
"charge-al"(I, g) {
  return plot({ series: [{ pts: range(1, 200, 120).map(L => [L, 0.23 + 36 / (L + 12)]), l: "A(L) = 0,23 + 36/(L+12)" }], hlines: [{ y: 0.4, l: "plancher 0,4 t/m²" }],
    marks: [{ x: min(I.L, 200), y: g("AL"), l: `A(L) = ${fmt(g("AL"), 2)} t/m²` }], xl: "longueur chargée L (m)", yl: "t/m²", ymax: 3.2, legRight: true });
},
"courbon"(I, g) {
  const n = max(2, Math.round(I.n)), W = 330, x0 = 40, w = 250, dx = w / (n - 1), et = range(1, n, n - 1).map(i => (1 + 6 * (n + 1 - 2 * i) / (n * n - 1) * I.e / I.bp) / n), mx = max(...et, 1 / n);
  let s = Rc(x0 - 20, 40, w + 40, 8, { f: K.conc }) ;
  for (let i = 0; i < n; i++) { const x = x0 + i * dx, h = et[i] / mx * 70; s += Rc(x - 6, 48, 12, 18) + Rc(x - 11, 140 - h, 22, h, { f: i === 0 ? K.gold : K.goldL, c: "none" }) + T(x, 136 - h, fmt(et[i] * 100, 0) + " %", { a: "middle", s: 9.5, w: i === 0 ? 500 : 400 }) + T(x, 152, "poutre " + (i + 1), { a: "middle", s: 8.5, c: K.mute }); }
  const xc = x0 + w / 2 - I.e / (I.bp * (n - 1)) * w;
  s += arrow(xc, 6, xc, 38) + T(xc - 6, 14, "charge", { a: "end", c: K.red, s: 9.5 }) + P(`M${x0 + w / 2} 26v14`, { c: K.mute, dash: "2 2" }) +
    (I.e ? P(`M${min(xc, x0 + w / 2)} 30H${max(xc, x0 + w / 2)}`, { c: K.mute, w: .8 }) + T(max(xc, x0 + w / 2) + 5, 33, `e = ${fmt(I.e, 2)} m`, { s: 9.5 }) : "");
  s += P(`M${x0 - 20} 140H${x0 + w + 20}`, { c: K.ink, w: 1 }) + T(x0 + w + 18, 76, "part de la charge", { a: "end", s: 9, c: K.mute }) + T(x0 + w + 18, 87, "reprise par poutre", { a: "end", s: 9, c: K.mute });
  return svg(W, 160, s);
},
"freinage-lgv"(I, g) {
  const Lm = max(60, I.L * 1.6), Ls = range(0, Lm, 100);
  const fb = L => (I.mod === "SW2" ? 35 * L : min(20 * L, 6000)) * I.a;
  return plot({ series: [{ pts: Ls.map(L => [L, min(33 * L, 1000) * I.a]), l: "démarrage", c: K.blue }, { pts: Ls.map(L => [L, fb(L)]), l: "freinage", c: K.red }],
    marks: [{ x: I.L, y: g("Qla"), l: `${fmt(g("Qla"), 0)} kN`, c: K.blue }, { x: I.L, y: g("Qlb"), l: `${fmt(g("Qlb"), 0)} kN`, c: K.red, dy: 12 }],
    xl: "longueur d'influence L (m)", yl: "kN" });
},
"allongement"(I, g) {
  const L = I.L, xs = range(0, 2 * L, 120), s0 = I.s0, al = I.al, sx = x => { const d = x <= L ? x : 2 * L - x; return s0 * exp(-(I.f * al * d / L + I.phi * d)); };
  return plot({ series: [{ pts: xs.map(x => [x, sx(x)]), l: "tension dans le câble σ(x)" }], areas: [{ pts: xs.map(x => [x, sx(x)]), c: K.gold, op: .15 }],
    hlines: [{ y: s0, l: `σ0 = ${fmt(s0, 0)} MPa (vérin)` }], marks: [{ x: L, y: g("sm"), l: `milieu : ${fmt(g("sm"), 0)} MPa`, dy: 14 }],
    xl: "abscisse le long du câble (m) — deux ancrages actifs", yl: "MPa", ymin: g("sm") * 0.8, ymax: s0 * 1.04 });
},
"cis-ec2"(I, g) {
  let s = Rc(20, 30, 200, 80, { f: "#f4f1ec" }) + P("M20 30H220M20 110H220", { c: K.ink, w: 2 });
  const th = Math.atan(1 / I.cot1), dx = 80 / Math.tan(th);
  for (let x = 20; x + dx <= 220; x += 36) s += P(`M${x} 110L${x + dx} 30`, { c: K.gold, w: 1.4, dash: "5 3" });
  for (let x = 32; x < 220; x += 24) s += P(`M${x} 30V110`, { c: K.blue, w: 1.2 });
  s += T(120, 22, "bielles de béton (compression)", { a: "middle", s: 9, c: K.gold }) + T(120, 124, "cadres (traction) : A sw / s", { a: "middle", s: 9, c: K.blue });
  const a1 = g("A1"), a2 = g("A2"), m = max(a1, a2);
  s += Rc(245, 110 - a1 / m * 80, 26, a1 / m * 80, { f: a1 >= a2 ? K.gold : K.goldL, c: "none" }) + Rc(285, 110 - a2 / m * 80, 26, a2 / m * 80, { f: a2 > a1 ? K.gold : K.goldL, c: "none" });
  s += T(258, 104 - a1 / m * 80, fmt(a1, 1), { a: "middle", s: 9.5 }) + T(298, 104 - a2 / m * 80, fmt(a2, 1), { a: "middle", s: 9.5 }) + T(258, 124, "ELU", { a: "middle", s: 9 }) + T(298, 124, "ELA", { a: "middle", s: 9 }) + T(278, 140, "cm²/ml", { a: "middle", s: 8.5, c: K.mute });
  return svg(330, 145, s);
},
"cis-circulaire"(I, g) {
  const R = 58, r = R * (I.D - 2 * I.e) / I.D, cx = 90, cy = 75;
  let s = Ci(cx, cy, R) + `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="#fff" stroke="${K.concD}" stroke-width=".8"/>` + P(`M${cx - R - 10} ${cy}H${cx + R + 10}`, { c: K.mute, dash: "4 3" }) + T(cx + R + 12, cy + 3, "axe neutre", { s: 8.5, c: K.mute });
  s += arrow(cx, cy - R - 16, cx, cy - R + 2) + T(cx + 6, cy - R - 8, `V = ${fmt(I.V, 0)} kN`, { c: K.red, s: 9.5 });
  const x0 = 200; s += P(`M${x0} ${cy - R}V${cy + R}`, { c: K.ink, w: 1 });
  s += P(range(-1, 1, 40).map((t, i) => (i ? "L" : "M") + (x0 + 60 * (1 - t * t)).toFixed(1) + " " + (cy + t * R).toFixed(1)).join("") , { c: K.red, w: 1.8, f: K.redL });
  s += T(x0 + 64, cy - 6, "τmax", { s: 9.5, w: 500 }) + T(x0 + 64, cy + 7, `${fmt(g("tau"), 2)} MPa`, { s: 9.5, w: 500 }) + T(x0 - 6, cy + R + 14, "répartition de τ", { s: 8.5, c: K.mute });
  return svg(330, 150, s);
},
"frettage"(I, g) {
  const n = Math.ceil(g("n")), cx = 110, cy = 78, a = 100; let s = Rc(cx - a / 2 - 15, cy - a / 2 - 15, a + 30, a + 30, { f: "#f4f1ec" }) + Rc(cx - a / 2, cy - a / 2, a, a, { f: "#55555533", c: "#333" });
  for (let i = 0; i < n; i++) { const t = cx - a / 2 + 8 + i * (a - 16) / max(1, n - 1); s += P(`M${t} ${cy - a / 2 - 10}V${cy + a / 2 + 10}`, { c: K.red, w: 2 }) + P(`M${cx - a / 2 - 10} ${t - cx + cy}H${cx + a / 2 + 10}`, { c: K.red, w: 2 }); }
  s += T(cx, cy + a / 2 + 30, `${n} Ø${I.phi} dans chaque sens`, { a: "middle", s: 10, w: 500 }) + T(230, 50, "vue en plan", { s: 9, c: K.mute }) + T(230, 70, `Rmax = ${fmt(I.R, 0)} kN`, { s: 9.5, c: K.red }) + T(230, 90, `A = ${fmt(g("A"), 2)} cm²/sens`, { s: 9.5, w: 500 });
  return svg(330, 160, s);
},
"levage-trous"(I, g) {
  const x1 = 30, x2 = 300, y = 90; let s = Rc(x1, y, x2 - x1, 22);
  [x1 + 25, x2 - 25].forEach(x => { s += Ci(x, y + 11, 5, { f: "#fff", c: K.ink }) + P(`M${x} ${y + 6}L165 20`, { c: K.ink, w: 1, dash: "3 2" }) + arrow(x, y - 4, x, y - 30, K.blue) + T(x, y - 34, `${fmt(g("F"), 1)} t`, { a: "middle", c: K.blue, s: 10, w: 500 }); });
  s += P("M150 20h30", { c: K.ink, w: 3 }) + arrow(165, y + 30, 165, y + 54) + T(171, y + 50, `poids ${fmt(g("P"), 1)} t`, { c: K.red, s: 10 }) + dim(x1, x2, y + 78, `L = ${fmt(g("Lp"), 2)} m`);
  return svg(330, 176, s);
},
"levage-crochets"(I, g) {
  const x1 = 25, x2 = 305, Lp = g("Lp"), sx = (x2 - x1) / Lp, xa = x1 + I.a * sx, xb = x2 - I.a * sx, y = 40; let s = Rc(x1, y, x2 - x1, 14);
  [xa, xb].forEach(x => s += arrow(x, y - 2, x, y - 26, K.blue) + T(x, y - 29, "crochet", { a: "middle", s: 8.5, c: K.blue }));
  const q = 25 * I.A, Ma = q * I.a ** 2 / 2, Mmid = q * I.Lc ** 2 / 8 - Ma, mx = max(Ma, abs(Mmid)), sc = 40 / mx, y0 = 110;
  const M = x => { const xl = x / sx; if (xl < I.a) return -q * xl ** 2 / 2; if (xl > Lp - I.a) return -q * (Lp - xl) ** 2 / 2; const u = xl - I.a; return -Ma + q * u * (I.Lc - u) / 2; };
  s += P(`M${x1} ${y0}H${x2}`, { c: K.ink, w: .8 }) + P(range(0, x2 - x1, 120).map((x, i) => (i ? "L" : "M") + (x1 + x).toFixed(1) + " " + (y0 + M(x) * sc).toFixed(1)).join("") + `L${x2} ${y0}L${x1} ${y0}Z`, { c: K.gold, w: 1.4, f: K.goldL + "88" });
  s += T(xa, y0 - Ma * sc - 4, `M = −${fmt(Ma, 1)} kN·m`, { a: "middle", s: 9.5, w: 500, c: K.red }) + T(165, y0 + Mmid * sc - 6, `+${fmt(Mmid, 0)} kN·m`, { a: "middle", s: 9 }) + T(x1, 172, "moment au levage — négatif (fibre sup. tendue) au droit des crochets", { s: 8.5, c: K.mute });
  return svg(330, 178, s);
},
"predalles"(I, g) {
  const x1 = 40, x2 = 230, y = 95; let s = Rc(x1, y - 50, x2 - x1, 50, { f: "#e9e4d9", c: K.concD }) + T((x1 + x2) / 2, y - 25, "béton frais coulé", { a: "middle", s: 9.5, c: K.ink }) + Rc(x1, y, x2 - x1, 7, { f: K.steel, c: "#5d7aa3" });
  s += pin(x1, y + 7) + pin(x2, y + 7) + T((x1 + x2) / 2, y + 18, "prédalle seule porte tout", { a: "middle", s: 9, c: K.blue });
  s += dim(x1, x2, y + 40, `L = ${fmt(I.L, 2)} m`) + gauge(245, 65, 75, 1 / g("Fs"), "σ / σ̄", g("Fs") >= 1 ? "✓" : "✗");
  return svg(330, 150, s);
},
"serrage"(I, g) {
  let s = Rc(30, 70, 70, 14, { f: K.conc }) + Rc(30, 84, 70, 14, { f: "#e2dccf" }) + Rc(58, 40, 14, 80, { f: "#bfc6d2", c: "#5f677a" }) + Rc(48, 32, 34, 10, { f: "#8b93a3", c: "#5f677a" }) + Rc(48, 118, 34, 10, { f: "#8b93a3", c: "#5f677a" });
  s += P("M100 37a14 6 0 1 1 -1 0", { c: K.red, w: 1.4 }) + arrow(99, 37, 104, 33) + T(108, 30, "couple", { c: K.red, s: 9 }) + T(65, 145, I.M, { a: "middle", s: 10, w: 500 });
  const bars = [["75 %", 0.75], ["100 %", 1], ["110 %", 1.1]], Mr = g("Mr");
  bars.forEach(([l, k], i) => { const h = k / 1.1 * 90, x = 170 + i * 50; s += Rc(x, 130 - h, 30, h, { f: k === 1 ? K.gold : K.goldL, c: "none" }) + T(x + 15, 126 - h, fmt(k * Mr, 0), { a: "middle", s: 9.5 }) + T(x + 15, 144, l, { a: "middle", s: 9 }); });
  s += P("M160 130H320", { c: K.ink, w: 1 }) + T(245, 20, "couples de serrage (N·m)", { a: "middle", s: 9, c: K.mute });
  return svg(330, 150, s);
},
"tassement-aa"(I, g) {
  const n = Math.round(I.nint) + 2, layers = [I.text, ...Array(n - 2).fill(I.tint), I.text], tot = layers.reduce((a, b) => a + b, 0) + (n - 1) * 3, k = 110 / tot;
  let y = 20, s = arrow(85, 2, 85, 17) + T(92, 12, `Fz = ${fmt(I.Fz, 0)} kN`, { c: K.red, s: 9.5 });
  const v = [], A1 = (I.a - 2 * I.enr / 1000) * (I.b - 2 * I.enr / 1000), lp = 2 * (I.a + I.b - 4 * I.enr / 1000);
  layers.forEach((t, i) => { const te = (i === 0 || i === n - 1) ? 1.4 * t : t, Si = A1 / (lp * te / 1000), vz = (I.Fz / 1000) * (t / 1000) / A1 * (1 / (5 * I.G * Si ** 2) + 1 / I.Eb) * 1000; v.push([y + t * k / 2, vz]);
    s += Rc(25, y, 120, t * k, { f: "#4a4f5c55", c: "none" }); y += t * k; if (i < n - 1) { s += Rc(20, y, 130, 3 * k, { f: K.steel, c: "none" }); y += 3 * k; } });
  const mv = max(...v.map(a => a[1]));
  v.forEach(([yy, vz]) => { s += Rc(180, yy - 4, vz / mv * 110, 8, { f: K.gold, c: "none" }) + T(184 + vz / mv * 110, yy + 3, fmt(vz, 3), { s: 8.5 }); });
  s += T(180, 15, "tassement par couche (mm)", { s: 9, c: K.mute }) + T(85, 148, "élastomère / frettes", { a: "middle", s: 8.5, c: K.mute }) + tag(255, 145, `total ${fmt(g("vz"), 2)} mm`);
  return svg(330, 155, s);
},
"pieux-min-sis"(I, g) {
  const cx = 75, cy = 78, R = 60, n = g("n"); let s = Ci(cx, cy, R) + `<circle cx="${cx}" cy="${cy}" r="${R - 8}" stroke="${K.blue}" stroke-width="1.6" fill="none"/>`;
  for (let i = 0; i < n; i++) { const a = 2 * PI * i / n; s += Ci(cx + (R - 13) * Math.cos(a), cy + (R - 13) * Math.sin(a), 3.5, { f: K.red, c: "#7d2318" }); }
  s += T(cx, cy + 4, `${n} HA${I.phi}`, { a: "middle", s: 10, w: 500 }) + T(cx, cy + R + 14, `Ø ${fmt(I.D, 2)} m`, { a: "middle", s: 9, c: K.mute });
  s += gauge(165, 45, 150, g("rho") / g("rr"), "longitudinal : mini / posé") + T(165, 100, `cerces : ${fmt(g("rc"), 2)} % (critique)`, { s: 9.5, c: K.blue }) + T(165, 116, `cerces : ${fmt(g("rk"), 2)} % (courante)`, { s: 9.5, c: K.blue });
  return svg(330, 155, s);
},
"groupe-v"(I, g) {
  const m = max(1, min(4, Math.round(I.m))), n = max(1, min(8, Math.round(I.n))), d = min(30, 200 / n), r = min(d * 0.4 * I.B / I.d * 2.6, d * 0.45); let s = "";
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) s += Ci(30 + i * d, 40 + j * d, r);
  s += dim(30, 30 + d, 40 + (m - 1) * d + r + 22, `d = ${fmt(I.d, 2)} m`) + T(30, 20, `${m} × ${n} pieux Ø ${fmt(I.B, 2)} m`, { s: 9.5 });
  s += gauge(30, 128, 270, g("Ce"), "efficacité du groupe (Converse-Labarre)", "");
  return svg(330, 160, s.replace(/limite/, "100 %"));
},
"groupe-h"(I, g) {
  const nx = max(1, min(5, Math.round(I.nx))), ny = max(1, min(4, Math.round(I.ny))), dx = 42, dy = 34; let s = "";
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) s += Ci(40 + i * dx, 30 + j * dy, 10);
  s += arrow(40 + nx * dx, 30, 40 + nx * dx + 30, 30) + T(40 + nx * dx + 34, 33, "X", { c: K.red, s: 10, w: 500 }) + arrow(25, 30 + ny * dy - 10, 25, 30 + ny * dy + 18) + T(18, 30 + ny * dy + 26, "Y", { c: K.red, s: 10, w: 500 });
  s += tag(260, 30, `Kx = ${fmt(g("Kx"), 2)}`) + tag(260, 52, `Rfx = ${fmt(g("Rfx"), 2)}`) + tag(260, 82, `Ky = ${fmt(g("Ky"), 2)}`) + tag(260, 104, `Rfy = ${fmt(g("Rfy"), 2)}`);
  s += T(10, 150, "coefficients < 1 : chaque pieu du groupe résiste moins qu'un pieu isolé", { s: 8.5, c: K.mute });
  return svg(330, 155, s);
},
"barrettes"(I, g) {
  const law = (K1, K2, R1, R2) => { const y1 = R1 / K1, y2 = y1 + (R2 - R1) / K2; return K1 === K2 || R1 === 0 ? [[0, 0], [R2 / K2 * 1000, R2], [R2 / K2 * 1000 * 1.6, R2]] : [[0, 0], [y1 * 1000, R1], [y2 * 1000, R2], [y2 * 1600, R2]]; };
  const X = law(g("KfX") + (g("RsX") ? g("KfX") : 0), g("KfX"), g("R1X"), g("R2X")), Xg = law(g("gR1X") > 0 ? 2 * g("KfX") : g("KfX"), g("KfX"), g("gR1X"), g("gR2X"));
  const Yg = [[0, 0], [g("gR2Y") / g("gKfY") * 1000, g("gR2Y")], [g("gR2Y") / g("gKfY") * 1600, g("gR2Y")]];
  return plot({ series: [{ pts: X, l: "X isolé", c: K.mute, w: 1.4, dash: "4 3" }, { pts: Xg, l: "X en groupe", c: K.gold }, { pts: Yg, l: "Y en groupe", c: K.blue }],
    xl: "déplacement latéral y (mm)", yl: "réaction p (kN/m)", legRight: true, left: 46 });
},
"barrettes-sis"(I, g) {
  const kx = g("KX"), ky = g("KY"), m = max(kx, ky); let s = Rc(30, 50, I.L / max(I.L, I.B) * 110, I.B / max(I.L, I.B) * 110, { f: K.conc });
  s += arrow(30 + I.L / max(I.L, I.B) * 110 + 8, 50 + 10, 30 + I.L / max(I.L, I.B) * 110 + 40, 60) + T(30 + I.L / max(I.L, I.B) * 110 + 44, 63, "X", { c: K.red, s: 10 });
  s += Rc(200, 130 - kx / m * 90, 30, kx / m * 90, { f: K.gold, c: "none" }) + Rc(250, 130 - ky / m * 90, 30, ky / m * 90, { f: K.blue, c: "none", op: .7 }) + P("M190 130H300", { c: K.ink, w: 1 });
  s += T(215, 126 - kx / m * 90, fmt(kx / 1000, 0), { a: "middle", s: 9.5 }) + T(265, 126 - ky / m * 90, fmt(ky / 1000, 0), { a: "middle", s: 9.5 }) + T(215, 144, "kX", { a: "middle", s: 9.5 }) + T(265, 144, "kY", { a: "middle", s: 9.5 }) + T(245, 20, "raideur du sol (MN/m³)", { a: "middle", s: 9, c: K.mute });
  return svg(330, 150, s);
},
"barrettes-min-sis"(I, g) {
  const sc = 220 / max(I.B, I.e * 2.2), w = I.B * sc, h = I.e * sc, x0 = 20, y0 = 30; let s = Rc(x0, y0, w, h);
  const nb = max(4, Math.round(I.B / 0.15)); for (let i = 0; i < nb; i++) { const x = x0 + 8 + i * (w - 16) / (nb - 1); s += Ci(x, y0 + 7, 2.5, { f: K.red, c: "#7d2318" }) + Ci(x, y0 + h - 7, 2.5, { f: K.red, c: "#7d2318" }); }
  s += Rc(x0 + 4, y0 + 4, w - 8, h - 8, { f: "none", c: K.blue, w: 1.4 }) + dim(x0, x0 + w, y0 + h + 16, `B = ${fmt(I.B, 2)} m`) + dimV(x0 + w + 12, y0, y0 + h, `e = ${fmt(I.e, 2)} m`, K.mute, 1);
  s += gauge(20, y0 + h + 44, 290, g("Amin") / g("Amax"), `acier longitudinal mini ${fmt(g("Amin"), 0)} cm² — maxi ${fmt(g("Amax"), 0)} cm²`, "");
  return svg(330, y0 + h + 72, s.replace(/>limite</, ">maxi<"));
},
"inclusions"(I, g) {
  let s = Rc(10, 10, 150, 46, { f: K.soil, c: K.soilD }) + T(85, 36, `remblai ${fmt(I.Hr, 1)} m`, { a: "middle", s: 9.5 }) + Rc(10, 56, 150, 90, { f: "#efe7d6", c: "none" }) + T(85, 100, "sol", { a: "middle", s: 8.5, c: K.mute }) + T(85, 111, "compressible", { a: "middle", s: 8.5, c: K.mute });
  [45, 125].forEach(x => { s += Rc(x - 7, 56, 14, 92, { f: K.conc }) + Rc(x - 22, 50, 44, 6, { f: "#bbb", c: "#999" }); });
  s += arrow(85, 2, 85, 12) + T(91, 8, `q = ${fmt(I.q, 0)} kPa`, { c: K.red, s: 9 }) + dim(45, 125, 64, `maille ${fmt(I.ma, 1)} m`);
  s += gauge(175, 40, 145, g("s1") / g("s2"), "béton : σ1 / 0,3 fc") + gauge(175, 105, 145, g("F1") / g("F2"), "portance : F1 / (Qu/Fs)");
  return svg(330, 155, s);
},
"spectre-ec8"(I, g, r) {
  const pts = r.curve || [];
  return plot({ series: [{ pts: pts.map(p => [p[0], p[1]]), l: "horizontal Se" }, { pts: pts.map(p => [p[0], p[2]]), l: "vertical Sve", c: K.blue, w: 1.6, dash: "5 3" }],
    marks: [{ x: 0.55, y: pts.find(p => p[0] >= 0.55)?.[1] ?? 0, l: `${fmt(g("plH"), 2)} m/s² au palier`, c: K.gold }].filter(() => false),
    hlines: [{ y: g("plH"), l: `palier ${fmt(g("plH"), 2)} m/s²` }], xl: "période T (s)", yl: "m/s²", xmin: 0, xmax: 4 });
},
};

/* ════════════════════════ EN CLAIR ════════════════════════ */
const CLAIR = {
  "beton-bael": (I, g) => `À ${fmt(I.j, 0)} jours, le béton n'a atteint que ${fmt(g("fcj") / I.fc28 * 100, 0)} % de sa résistance finale (${fmt(g("fcj"), 1)} MPa sur ${fmt(I.fc28, 0)} MPa).`,
  "beton-ec2": (I, g) => `Un béton C${I.fck} résiste à ${I.fck} MPa en compression (sur cylindre) mais seulement à ${fmt(g("fctm"), 1)} MPa en traction : c'est pour cela qu'on l'arme.`,
  "retrait-ec2": (I, g) => `Le béton se raccourcit en séchant : ${fmt(g("ecs") * 1000, 2)} mm par mètre${isFinite(I.t) ? ` à ${fmt(I.t, 0)} jours` : " à long terme"}, soit ${fmt(g("ecs") * 1e5, 1)} mm pour 100 m de tablier.`,
  "retrait-fluage": (I, g) => `À ${fmt(I.t, 0)} jours, il reste encore ${fmt(g("ratio") * 100, 0)} % du retrait et du fluage à venir : c'est ce qui déplacera encore les appareils d'appui.`,
  "acier-precontrainte": (I, g) => `On tend les câbles à ${fmt(g("sp0"), 0)} MPa : la plus petite des deux limites, pour rester en sécurité sous la rupture et l'élasticité de l'acier.`,
  "section-mixte": (I, g) => `Avec le hourdis, l'inertie passe de ${fmt(g("Ia") / 1e8, 3)} m⁴ (acier seul) à ${fmt(g("Im") / 1e8, 3)} m⁴, soit ${fmt(g("Im") / g("Ia"), 1)} fois plus : la dalle béton rend la poutre beaucoup plus raide.`,
  "raideur-appui": (I, g) => `Il faut ${fmt(g("K") / 1000, 0)} kN pour déplacer la tête de l'appui de 1 mm ; les appareils d'appui, ${fmt(g("Kaa") / 1000, 1)} kN/mm, sont bien plus souples.`,
  "fleche-prefa": (I, g) => `À long terme, la poutre descendra d'environ ${fmt(g("Fg"), 0)} mm ; en la fabriquant cintrée de ${fmt(I.CF, 0)} mm vers le haut, ${I.CF >= g("Fg") ? "le tablier restera légèrement bombé" : "elle restera creusée : augmenter la contre-flèche"}.`,
  "fleche-tablier": (I, g) => `Sous son poids, le tablier descendra de ${fmt(g("Fv"), 0)} mm à long terme ; la contre-flèche de ${fmt(I.CF, 0)} mm ${I.CF >= g("Fv") ? "compense cette flèche" : "est insuffisante"}.`,
  "contre-fleche": (I, g) => `On donne à la poutre une forme de parabole, haute de ${fmt(I.f, 0)} mm au milieu et nulle sur appuis.`,
  "fleche-mur": (I, g) => `Sous la poussée des terres et de la surcharge, le haut du mur se déplace de ${fmt(g("f"), 0)} mm vers l'avant.`,
  "fleche-pile": (I, g) => `Sous ${fmt(I.F, 0)} kN, la tête d'appui se déplace de ${fmt(g("ui"), 1)} mm tout de suite et de ${fmt(g("uv"), 1)} mm à long terme.`,
  "rotation": (I, g) => `La poutre tourne sur son appui de ${fmt(g("av") * 1000, 2)} millièmes de radian à long terme : l'appareil d'appui doit accepter cette rotation.`,
  "maj-dyn": (I, g) => `Les camions qui roulent sollicitent l'ouvrage ${fmt((g("delta") - 1) * 100, 0)} % de plus que s'ils étaient arrêtés.`,
  "charge-al": (I, g) => `Sur ${fmt(I.L, 1)} m, la circulation est représentée par ${fmt(g("A"), 2)} t/m², et le freinage pousse l'ouvrage de ${fmt(g("F"), 1)} t dans le sens de la route.`,
  "courbon": (I, g) => `La poutre de rive reprend ${fmt(g("max") * 100, 0)} % de la charge, au lieu de ${fmt(100 / Math.round(I.n), 0)} % si elle se répartissait également.`,
  "freinage-lgv": (I, g) => `Un train qui freine sur ${fmt(I.L, 0)} m pousse l'ouvrage de ${fmt(g("Qlb"), 0)} kN ; au démarrage, ${fmt(g("Qla"), 0)} kN.`,
  "allongement": (I, g) => `Le câble s'allonge de ${fmt(g("dl"), 0)} mm de chaque côté ; au milieu, il ne garde que ${fmt(g("sm") / I.s0 * 100, 0)} % de la tension donnée au vérin à cause des frottements.`,
  "cis-ec2": (I, g) => `Il faut ${fmt(g("Amax"), 1)} cm² de cadres par mètre de poutre pour reprendre l'effort tranchant.`,
  "cis-circulaire": (I, g) => `Le cisaillement est maximal au niveau de l'axe neutre (${fmt(g("tau"), 2)} MPa) : ${fmt(g("A"), 1)} cm²/ml d'armatures dans l'épaisseur du fût.`,
  "frettage": (I, g) => `Sous l'appareil d'appui, il faut un quadrillage de ${Math.ceil(g("n"))} barres Ø${I.phi} dans chaque sens pour diffuser la réaction.`,
  "levage-trous": (I, g) => `Chaque point de levage porte ${fmt(g("F"), 1)} t ; ${fmt(g("A"), 2)} cm² d'acier autour de chaque réservation suffisent.`,
  "levage-crochets": (I, g) => `Au levage, la poutre est suspendue à ses crochets : le haut est tendu au droit des crochets ; chaque crochet travaille à ${fmt(g("sc"), 0)} MPa.`,
  "predalles": (I, g) => g("Fs") >= 1 ? `La prédalle porte le béton frais avec une marge de ${fmt((g("Fs") - 1) * 100, 0)} %.` : `La prédalle est trop sollicitée (${fmt(1 / g("Fs") * 100, 0)} % de sa limite) : réduire la portée ou étayer.`,
  "serrage": (I, g) => `Un boulon ${I.M} se serre à ${fmt(g("Mr"), 0)} N·m pour être tendu à ${fmt(g("Fp"), 0)} kN ; on serre d'abord à 75 %, puis on termine.`,
  "tassement-aa": (I, g) => `Sous ${fmt(I.Fz, 0)} kN, l'appareil d'appui s'écrase de ${fmt(g("vz"), 2)} mm en théorie (environ ${fmt(g("vz2"), 2)} mm en réalité).`,
  "pieux-min-sis": (I, g) => `Il faut au minimum ${g("n")} barres HA${I.phi} dans le pieu pour résister au séisme.`,
  "groupe-v": (I, g) => `Groupés, les pieux portent ${fmt(g("Ce") * 100, 0)} % de ce qu'ils porteraient s'ils étaient éloignés les uns des autres.`,
  "groupe-h": (I, g) => `Dans le groupe, un pieu ne résiste latéralement qu'à ${fmt(min(g("Kx"), g("Rfx")) * 100, 0)} % (sens X) et ${fmt(min(g("Ky"), g("Rfy")) * 100, 0)} % (sens Y) d'un pieu isolé.`,
  "barrettes": (I, g) => `Le sol réagit d'abord comme un ressort, puis plafonne : en groupe, ${fmt(g("gR2X"), 0)} kN/m au maximum dans le sens X et ${fmt(g("gR2Y"), 0)} kN/m dans le sens Y.`,
  "barrettes-sis": (I, g) => `Sous séisme, le sol est ${fmt(g("KX") / g("KY"), 1)} fois plus raide sur la petite face (X) que sur la grande (Y), rapporté à la largeur.`,
  "barrettes-min-sis": (I, g) => `Il faut entre ${fmt(g("Amin"), 0)} et ${fmt(g("Amax"), 0)} cm² d'acier longitudinal, et ${fmt(max(g("t1"), g("t2")), 0)} cm²/ml d'acier transversal au minimum.`,
  "inclusions": (I, g) => `Chaque inclusion reprend ${fmt(g("F1"), 2)} MN pour une capacité admissible de ${fmt(g("F2"), 2)} MN (taux ${fmt(g("F1") / g("F2") * 100, 0)} %).`,
  "spectre-ec8": (I, g) => `Un ouvrage de période courte (palier du spectre) subit jusqu'à ${fmt(g("plH"), 2)} m/s² horizontalement, soit ${fmt(g("plH") / 9.81, 2)} g ; verticalement ${fmt(g("plV"), 2)} m/s².`,
};

const api = { FIGS, CLAIR, plot, gauge };
if (typeof module !== "undefined" && module.exports) module.exports = api; else Object.assign(root.HANDBAG, api);
})(typeof window !== "undefined" ? window : globalThis);
