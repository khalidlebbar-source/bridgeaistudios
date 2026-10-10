/* ════════════════════════════════════════════════════════════════════
   HandBag — boîte à outils des modules complémentaires
   · croquis génériques (sections, poutres, murs, semelles, pieux, canaux…)
   · figFor / clairFor : croquis et synthèse d'un calcul (FIGS/CLAIR, puis
     propriétés fig/clair du calcul, puis repli automatique)
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG;
const { K, svg, T, P, Rc, Ci, arrow, pin, roller, ground, dim, dimV, tag, udl, gauge, plot, range, fmt } = HB.FIG;
const { min, max, abs, PI, sqrt } = Math;

/* ─── jauges des vérifications (taux de travail) ─── */
function gauges(checks, title) {
  const list = (checks || []).filter(c => typeof c.ratio === "number" && isFinite(c.ratio)).slice(0, 6);
  if (!list.length) return "";
  const W = 330, dy = 34, H = 14 + list.length * dy + (title ? 12 : 0); let s = title ? T(10, 14, title, { s: 10, w: 500 }) : "";
  list.forEach((c, i) => { s += gauge(10, (title ? 36 : 24) + i * dy, W - 20, c.ratio, strip(c.short || c.l).slice(0, 58)); });
  return svg(W, H, s);
}
const strip = s => String(s).replace(/\$([^$]+)\$/g, (_, t) => t.replace(/\\(dfrac|frac|text|mathrm|left|right|,|;|quad)/g, "").replace(/[{}\\^_]/g, "").replace(/\s+/g, " ")).replace(/<[^>]+>/g, "");

/* ─── barres horizontales comparées (valeur / limite) ─── */
function barsH(items, o = {}) {
  const W = o.w || 330, rowH = o.rowH || 24, L = o.left || 112, H = 16 + items.length * rowH + (o.foot ? 14 : 0);
  const vmax = (o.max || max(...items.map(i => max(i.v, i.lim || 0)))) * 1.12, X = v => L + v / vmax * (W - L - 54);
  let s = o.title ? T(8, 11, o.title, { s: 9.5, w: 500 }) : "";
  items.forEach((it, i) => {
    const y = 16 + i * rowH, c = it.c || (it.lim !== undefined ? (it.v <= it.lim ? K.teal : K.red) : K.gold);
    s += T(L - 6, y + 10, it.l, { a: "end", s: 9.5 }) + Rc(L, y + 2, X(max(it.v, 0)) - L, rowH - 9, { f: c, c, r: 3, op: .85 });
    s += T(X(max(it.v, 0)) + 4, y + 11, fmt(it.v, it.d ?? 2) + (it.u ? " " + it.u : ""), { s: 9, c: K.ink, w: 500 });
    if (it.lim !== undefined) s += P(`M${X(it.lim)} ${y}V${y + rowH - 4}`, { c: K.ink, w: 1.2, dash: "3 2" });
  });
  if (o.foot) s += T(W - 6, H - 3, o.foot, { a: "end", s: 8.5, c: K.mute });
  return svg(W, H, s);
}

/* ─── section rectangulaire / en T armée, avec axe neutre et bloc de contraintes ─── */
function section(o) {
  const W = 330, H = o.H || 175, top = 16, hh = H - 42;
  const bf = o.beff || o.b, k = min(132 / bf, hh / o.h), x0 = 60 + (132 - bf * k) / 2, X = v => x0 + v * k, Y = v => top + v * k;
  const bw = o.bw || o.b, hf = o.hf || 0, xw = X((bf - bw) / 2);
  let s = "";
  if (o.beff) s += Rc(X(0), Y(0), bf * k, hf * k) + Rc(xw, Y(hf) - .5, bw * k, (o.h - hf) * k + .5);
  else s += Rc(X(0), Y(0), o.b * k, o.h * k);
  if (o.x > 0) { const xx = min(o.x, o.h); s += `<rect x="${X(0).toFixed(1)}" y="${Y(0).toFixed(1)}" width="${(bf * k).toFixed(1)}" height="${(min(o.lam || 1, 1) * xx * k).toFixed(1)}" fill="${K.blue}" opacity=".12"/>`;
    s += P(`M${X(0) - 6} ${Y(xx)}H${X(bf) + 6}`, { c: K.blue, w: 1, dash: "4 3" }) + T(X(bf) + 8, Y(xx) + 3, "axe neutre", { s: 8.5, c: K.blue }); }
  const bars = (n, y, c) => { n = max(1, min(Math.round(n), 12)); const span = bw * k - 12, r = 3.2; let b = ""; for (let i = 0; i < n; i++) b += Ci(n === 1 ? xw + bw * k / 2 : xw + 6 + span * i / (n - 1), y, r, { f: c, c: "#fff", w: .8 }); return b; };
  if (o.As) s += bars(o.nb || 4, Y(o.d), K.red);
  if (o.As2) s += bars(o.nb2 || 3, Y(o.d2), K.blue);
  s += dim(X(0), X(bf), H - 12, o.beff ? `beff = ${fmt(bf, 2)}` : `b = ${fmt(o.b, 2)}`) + dimV(x0 - 8, Y(0), Y(o.h), `h = ${fmt(o.h, 2)}`);
  if (o.d) s += P(`M${X(bf) + 2} ${Y(o.d)}h12`, { c: K.mute, w: .8 });
  /* diagramme de contraintes */
  if (o.block !== false && o.x > 0) {
    const gx = 220, xx = min(o.x, o.h), lam = o.lam || 0.8, bwid = 34;
    s += P(`M${gx} ${Y(0)}V${Y(o.h)}`, { c: K.ink, w: 1 });
    s += Rc(gx - bwid, Y(0), bwid, lam * xx * k, { f: K.blueL, c: K.blue, w: .8 }) + T(gx - bwid / 2, Y(0) - 4, o.fcl || "fcd", { a: "middle", s: 9, c: K.blue });
    if (o.As) s += arrow(gx, Y(o.d), gx + 44, Y(o.d), K.red, 1.6) + T(gx + 48, Y(o.d) + 3, o.Fs || "As·fyd", { s: 9, c: K.red });
    s += arrow(gx - bwid / 2, Y(lam * xx / 2), gx - bwid / 2 - 0.1, Y(lam * xx / 2), K.blue, 0);
    if (o.z) s += dimV(gx + 18, Y(lam * xx / 2), Y(o.d), "z", K.mute, 1);
  }
  /* diagramme triangulaire (ELS, section fissurée) */
  if (o.tri && o.x > 0) {
    const gx = 236, xx = min(o.x, o.h), w = 40;
    s += P(`M${gx} ${Y(0)}V${Y(o.h)}`, { c: K.ink, w: 1 }) + P(`M${gx} ${Y(0)}h${-w}L${gx} ${Y(xx)}Z`, { c: K.blue, f: K.blueL, w: .8 });
    s += T(gx - w - 3, Y(0) + 9, o.tri.sc, { a: "end", s: 9, c: K.blue }) + arrow(gx, Y(o.d), gx + 40, Y(o.d), K.red, 1.6) + T(gx + 3, Y(o.d) - 5, o.tri.ss, { s: 9, c: K.red });
    if (o.As2 && o.d2 < xx) s += arrow(gx, Y(o.d2), gx - 18, Y(o.d2), K.blue, 1.2);
  }
  if (o.title) s += T(W - 6, 12, o.title, { a: "end", s: 9.5, c: K.mute });
  return svg(W, H, s);
}

/* ─── section circulaire (pleine ou creuse) avec barres réparties ─── */
function circle(o) {
  const W = 330, H = o.H || 175, R = 66, cx = 100, cy = H / 2 - 4; let s = Ci(cx, cy, R);
  if (o.Di) s += Ci(cx, cy, R * o.Di / o.D, { f: "#fff" });
  const n = o.nb ?? 12, rb = R * (o.D / 2 - (o.c || 0.06)) / (o.D / 2);
  for (let i = 0; i < n; i++) { const a = 2 * PI * i / n; s += Ci(cx + rb * Math.cos(a), cy + rb * Math.sin(a), 3, { f: K.red, c: "#fff" }); }
  if (o.x !== undefined) { const yN = cy - R + o.x / o.D * 2 * R; s += P(`M${cx - R - 8} ${yN}H${cx + R + 8}`, { c: K.blue, dash: "4 3" }) + T(cx + R + 10, yN + 3, "axe neutre", { s: 8.5, c: K.blue }); }
  s += dim(cx - R, cx + R, H - 8, `D = ${fmt(o.D, 2)} m`);
  if (o.side) s += o.side;
  return svg(W, H, s);
}

/* ─── poutre schématique + diagramme (moment ou autre) ───
   o.L : longueur ; o.sup : abscisses des appuis ; o.f(x) : valeur ; o.loads : [{x, l}] ou o.q */
function beamDiag(o) {
  const W = 330, H = o.H || 180, x1 = 26, x2 = W - 18, yb = 38, X = x => x1 + (x2 - x1) * x / o.L;
  let s = "";
  if (o.q) s += udl(x1, x2, yb - 4, 14, K.red, 14) + T(x1, yb - 22, o.q, { s: 9.5, c: K.red });
  (o.loads || []).forEach(p => { s += arrow(X(p.x), yb - 34, X(p.x), yb - 4, K.red, 1.8) + T(X(p.x) + 4, yb - 30, p.l, { s: 9.5, c: K.red, w: 500 }); });
  s += P(`M${x1} ${yb}H${x2}`, { c: K.ink, w: 3 });
  (o.sup || [0, o.L]).forEach((x, i) => { s += (o.fix && o.fix.includes(x)) ? P(`M${X(x)} ${yb - 12}V${yb + 12}`, { c: K.ink, w: 3 }) + P(`M${X(x)} ${yb - 12}l${x ? 6 : -6} 6M${X(x)} ${yb - 4}l${x ? 6 : -6} 6M${X(x)} ${yb + 4}l${x ? 6 : -6} 6`, { c: K.ink, w: 1 }) : i === 0 ? pin(X(x), yb + 1) : roller(X(x), yb + 1); });
  const n = 120, xs = range(0, o.L, n), vs = xs.map(o.f), vm = max(...vs.map(abs), 1e-9), y0 = yb + 30 + (H - yb - 44) * (o.y0 ?? 0.45), sc = (H - yb - 44) * 0.52 / vm;
  const pts = xs.map((x, i) => `${X(x).toFixed(1)} ${(y0 + (o.up ? -1 : 1) * vs[i] * sc).toFixed(1)}`);
  s += P(`M${X(0)} ${y0}L${pts.join("L")}L${X(o.L)} ${y0}Z`, { c: "none", f: o.c || K.gold, op: .18 }) + P(`M${pts.join("L")}`, { c: o.c || K.gold, w: 1.8 }) + P(`M${x1} ${y0}H${x2}`, { c: K.mute, w: .8 });
  (o.marks || []).forEach(m => { const yy = y0 + (o.up ? -1 : 1) * o.f(m.x) * sc; s += Ci(X(m.x), yy, 3, { f: o.c || K.gold, c: "#fff" }) + T(min(max(X(m.x), 60), W - 60), yy + ((o.up ? -1 : 1) * o.f(m.x) >= 0 ? 14 : -6), m.l, { a: "middle", s: 9.5, w: 500 }); });
  if (o.label) s += T(x1, H - 4, o.label, { s: 9, c: K.mute });
  if (o.dims !== false) s += T(x2, H - 4, o.span || `L = ${fmt(o.L, 2)} m`, { a: "end", s: 9, c: K.mute });
  return svg(W, H, s);
}

/* ─── mur / écran avec diagramme de pression des terres ─── */
function wallFig(o) {
  const W = 330, H = o.H || 180, hw = H - 40, top = 18, k = hw / o.h, xw = 120, tw = 16; let s = "";
  s += Rc(xw - tw, top, tw, hw) + P(`M${xw} ${top}H${W - 12}`, { c: K.soilD, w: 1 }) + Rc(xw, top, W - 12 - xw, hw, { f: K.soil, c: "none", op: .35 });
  if (o.semelle) s += Rc(xw - tw - 40, top + hw, tw + 110, 12);
  if (o.q) s += udl(xw + 14, W - 18, top - 1, 7, K.red, 12) + T(W - 16, top - 15, o.q, { a: "end", s: 9.5, c: K.red });
  const pmax = max(...o.p.map(p => p[1]), 1e-9), sc = 82 / pmax, X = p => xw - tw - p * sc;
  const pts = o.p.map(([z, p]) => `${X(p).toFixed(1)} ${(top + z * k).toFixed(1)}`);
  s += P(`M${xw - tw} ${top}L${pts.join("L")}L${xw - tw} ${top + o.h * k}Z`, { c: K.red, f: K.redL, op: .6, w: 1 });
  (o.labels || []).forEach(l => { s += T(X(l.p) - 4, top + l.z * k + 3, l.t, { a: "end", s: 9, c: K.red }); });
  if (o.R) s += arrow(xw - tw - 50, top + o.R.z * k, xw - tw - 2, top + o.R.z * k, K.ink, 2) + T(xw - tw - 52, top + o.R.z * k - 5, o.R.l, { a: "end", s: 9.5, w: 500 });
  if (o.water) s += P(`M${xw + 2} ${top + o.water * k}H${W - 12}`, { c: K.blue, w: 1.2, dash: "5 3" }) + T(W - 14, top + o.water * k - 3, "nappe", { a: "end", s: 8.5, c: K.blue });
  s += dimV(W - 8, top, top + hw, `H = ${fmt(o.h, 2)} m`, K.mute, -1);
  return svg(W, H, s);
}

/* ─── semelle sur sol avec diagramme des contraintes ─── */
function footingFig(o) {
  const W = 330, H = o.H || 175, gy = 70, x1 = 70, x2 = 260, Bw = x2 - x1; let s = "";
  s += Rc(10, gy, W - 20, H - gy - 20, { f: K.soil, c: "none", op: .4 }) + P(`M10 ${gy - (o.D ? 20 : 0)}H${x1}M${x2} ${gy - (o.D ? 20 : 0)}H${W - 10}`, { c: K.soilD });
  s += Rc(x1, gy - 18, Bw, 18) + Rc((x1 + x2) / 2 - 16, gy - 62, 32, 44);
  const ex = (o.e || 0) / o.B * Bw;
  s += arrow((x1 + x2) / 2 + ex, gy - 92, (x1 + x2) / 2 + ex, gy - 64, K.red, 2) + T((x1 + x2) / 2 + ex + 5, gy - 80, o.N || "V", { s: 9.5, c: K.red, w: 500 });
  if (o.Hf) s += arrow((x1 + x2) / 2 - 60, gy - 50, (x1 + x2) / 2 - 18, gy - 50, K.red, 1.6) + T((x1 + x2) / 2 - 62, gy - 54, o.Hf, { a: "end", s: 9.5, c: K.red });
  const q1 = o.q1 ?? o.q, q2 = o.q2 ?? o.q, qm = max(q1, q2, 1e-9), sc = 52 / qm, xe = o.Beff ? x1 + o.Beff / o.B * Bw : x2;
  s += P(`M${x1} ${gy}L${x1} ${gy + q1 * sc}L${xe} ${gy + q2 * sc}L${xe} ${gy}Z`, { c: K.red, f: K.redL, op: .7, w: 1 });
  s += T(x1 + 4, gy + q1 * sc + 12, o.l1 || fmt(q1, 0), { s: 9, c: K.red }) + (q2 !== q1 ? T(xe - 4, gy + q2 * sc + 12, o.l2 || fmt(q2, 0), { a: "end", s: 9, c: K.red }) : "");
  s += dim(x1, x2, gy - 26, `B = ${fmt(o.B, 2)} m`);
  if (o.D) s += dimV(x1 - 12, gy - 20, gy, `D`, K.mute);
  return svg(W, H, s);
}

/* ─── pieu dans un sol multicouche ─── */
function pileFig(o) {
  const W = 330, H = o.H || 185, top = 22, hh = H - 36, Lt = o.layers.reduce((a, l) => a + l.h, 0), k = hh / max(Lt, o.L), cx = 110, pw = 18; let s = "", z = 0;
  o.layers.forEach((l, i) => { s += Rc(20, top + z * k, 190, l.h * k, { f: i % 2 ? K.soil : "#e9dcc2", c: "#fff", op: .9 }) + T(214, top + (z + l.h / 2) * k + 3, l.t, { s: 9 }); z += l.h; });
  s += Rc(cx - pw / 2, top - 8, pw, o.L * k + 8, { f: K.conc, c: K.concD, w: 1 });
  if (o.Q) s += arrow(cx, top - 22 + 0, cx, top - 9, K.red, 2) + T(cx + 8, top - 10, o.Q, { s: 9.5, c: K.red, w: 500 });
  if (o.Hh) s += arrow(cx - 50, top - 2, cx - pw / 2 - 2, top - 2, K.red, 1.8) + T(cx - 52, top - 6, o.Hh, { a: "end", s: 9.5, c: K.red });
  if (o.qs) for (let i = 1; i < 7; i++) { const y = top + o.L * k * i / 7; s += arrow(cx - pw / 2 - 14, y + 6, cx - pw / 2 - 14, y - 6, K.teal, 1) + arrow(cx + pw / 2 + 14, y + 6, cx + pw / 2 + 14, y - 6, K.teal, 1); }
  if (o.qp) s += arrow(cx, top + o.L * k + 20, cx, top + o.L * k + 3, K.blue, 2);
  if (o.defl) s += P(o.defl(k, top, cx), { c: K.gold, w: 2, dash: "5 3" });
  s += dimV(cx - 26, top, top + o.L * k, `L = ${fmt(o.L, 1)} m`, K.mute);
  return svg(W, H, s);
}

/* ─── canal / lit de rivière ─── */
function channelFig(o) {
  const W = 330, H = o.H || 160, yb = H - 34, k = min(200 / (o.b + 2 * o.m * o.hmax), 100 / o.hmax), cx = W / 2, hb = o.b * k / 2;
  const xl = cx - hb - o.m * o.hmax * k, xr = cx + hb + o.m * o.hmax * k, ytop = yb - o.hmax * k, yw = yb - o.y * k;
  let s = P(`M${xl - 20} ${ytop}H${xl}L${cx - hb} ${yb}H${cx + hb}L${xr} ${ytop}H${xr + 20}`, { c: K.soilD, w: 2 });
  s += P(`M${cx - hb - o.m * o.y * k} ${yw}L${cx - hb} ${yb}H${cx + hb}L${cx + hb + o.m * o.y * k} ${yw}Z`, { c: K.blue, f: K.blueL, op: .8, w: 1 });
  s += P(`M${cx - hb - o.m * o.y * k} ${yw}H${cx + hb + o.m * o.y * k}`, { c: K.blue, w: 1.4 }) + T(cx, yw - 5, "▽", { a: "middle", c: K.blue, s: 9 });
  s += dim(cx - hb, cx + hb, yb + 16, `b = ${fmt(o.b, 2)} m`) + dimV(cx + hb + o.m * o.y * k + 26, yw, yb, `y = ${fmt(o.y, 2)} m`, K.blue, 1);
  if (o.extra) s += o.extra;
  return svg(W, H, s);
}

/* ─── plaque d'acier / profil en I ─── */
function iSection(o) {
  const W = 330, H = o.H || 175, top = 14, hh = H - 40, k = min(hh / o.h, 150 / max(o.bf, o.bf2 || o.bf)), cx = 100, X = v => cx + v * k, Y = v => top + v * k;
  const bf2 = o.bf2 || o.bf, tf2 = o.tf2 || o.tf; let s = "";
  s += Rc(X(-o.bf / 2), Y(0), o.bf * k, max(o.tf * k, 2), { f: K.steel, c: "#5a6f8e" }) + Rc(X(-o.tw / 2), Y(o.tf), max(o.tw * k, 1.6), (o.h - o.tf - tf2) * k, { f: K.steel, c: "#5a6f8e" });
  s += Rc(X(-bf2 / 2), Y(o.h - tf2), bf2 * k, max(tf2 * k, 2), { f: K.steel, c: "#5a6f8e" });
  if (o.slab) s += Rc(X(-o.slab.b / 2 * 0.5), Y(-o.slab.h) - 2, o.slab.b * k * 0.5, o.slab.h * k, {}) ;
  s += dimV(X(-max(o.bf, bf2) / 2) - 10, Y(0), Y(o.h), `h = ${fmt(o.h * 1000, 0)}`) + dim(X(-o.bf / 2), X(o.bf / 2), Y(0) - 4, `bf = ${fmt(o.bf * 1000, 0)}`);
  if (o.na !== undefined) s += P(`M${X(-max(o.bf, bf2) / 2) - 6} ${Y(o.na)}H${X(max(o.bf, bf2) / 2) + 8}`, { c: K.blue, dash: "4 3" }) + T(X(max(o.bf, bf2) / 2) + 10, Y(o.na) + 3, o.naL || "axe neutre", { s: 8.5, c: K.blue });
  if (o.side) s += o.side(X, Y, k);
  return svg(W, H, s);
}

/* ─── croquis et synthèse d'un calcul ─── */
function figFor(c, I, g, r) {
  let f = "";
  try { f = (HB.FIGS[c.id] && HB.FIGS[c.id](I, g, r)) || (c.fig && c.fig(I, g, r)) || r.fig || ""; } catch (e) { f = ""; }
  return f || gauges(r.checks);
}
function clairFor(c, I, g, r) {
  try { const t = (HB.CLAIR[c.id] && HB.CLAIR[c.id](I, g)) || (c.clair && c.clair(I, g, r)); if (t) return t; } catch (e) {}
  const m = (r.steps || []).find(s => s.r && typeof s.v === "number"), ko = (r.checks || []).filter(x => !x.ok).length, n = (r.checks || []).length;
  return (m ? `Résultat principal : ${strip(m.s)} = ${fmt(m.v, m.d)} ${m.u}.` : "") + (n ? (ko ? ` ${ko} vérification${ko > 1 ? "s" : ""} sur ${n} non satisfaite${ko > 1 ? "s" : ""} : à reprendre.` : " Toutes les vérifications sont satisfaites.") : "");
}

/* lecture d'une valeur calculée (étapes, valeurs, tableaux) */
function getter(r) { return k => { const st = (r.steps || []).find(x => x.k === k); if (st) return st.v; if (r.vals && k in r.vals) return r.vals[k];
  for (const t of r.tables || []) if (t.key && t.key[k]) { const [a, b] = t.key[k]; return t.rows[a][b]; } return NaN; }; }

HB.KIT = { gauges, barsH, section, circle, beamDiag, wallFig, footingFig, pileFig, channelFig, iSection, strip };
Object.assign(HB, { figFor, clairFor, getter });
})(typeof window !== "undefined" ? window : globalThis);
