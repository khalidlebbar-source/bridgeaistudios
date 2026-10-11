/* ════════════════════════════════════════════════════════════════════
   HandBag — RDM : poutres continues générales (classeurs Biblio 2004)
   Poutre continue, enveloppes (groupes de surcharges, pianotage), convoi roulant,
   poutre sur sol élastique. Moteur : handbag/lib/beam.js (éléments finis de poutre).
   Unités : m, kN, kN/m, kN·m ; EI en MN·m² ; flèches en mm (positives vers le bas).
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, BM = HB.BEAM, { PI, sqrt, min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
const { K, svg, T, P, Ci, pin, roller, udl, arrow } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d);
const ENDS = [["a", "appui simple"], ["e", "encastrement"], ["c", "console (bout libre)"]];
const supList = (Ls, left, right) => { const s = [0]; Ls.forEach(l => s.push(s.at(-1) + l)); return s.filter((x, i) => !(i === 0 && left === "c") && !(i === s.length - 1 && right === "c")); };
const fixList = (Ls, left, right) => { const Lt = Ls.reduce((a, b) => a + b, 0), f = []; if (left === "e") f.push(0); if (right === "e") f.push(Lt); return f; };
const interp = (pts, k) => x => { let a = pts[0], b = pts[pts.length - 1]; for (let i = 0; i < pts.length - 1; i++) if (pts[i][0] <= x && pts[i + 1][0] >= x) { a = pts[i]; b = pts[i + 1]; break; } return b[0] - a[0] < 1e-12 ? a[k] : a[k] + (b[k] - a[k]) * (x - a[0]) / (b[0] - a[0]); };
const valAt = (pts, x, k) => BM.at(pts, x, k);
function checkSpans(Ls) { if (!Ls || !Ls.length || Ls.some(l => !(l > 0))) throw new Error("portées à saisir (nombres positifs séparés par « ; »)"); }

/* croquis d'enveloppe : courbes max et min sous la poutre (moments positifs vers le bas) */
function envFig(o) {
  const W = 330, Hh = 190, x1 = 26, x2 = W - 18, yb = 40, X = x => x1 + (x2 - x1) * x / o.L, y0 = 120;
  const vm = max(1e-9, ...o.env.map(p => max(abs(p[1]), abs(p[2])))), sc = 52 / vm;
  let s = P(`M${x1} ${yb}H${x2}`, { c: K.ink, w: 3 });
  o.sup.forEach((x, i) => { s += o.fix.includes(x) ? P(`M${X(x)} ${yb - 12}V${yb + 12}`, { c: K.ink, w: 3 }) : i === 0 ? pin(X(x), yb + 1) : roller(X(x), yb + 1); });
  const line = k => o.env.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)} ${(y0 + p[k] * sc).toFixed(1)}`).join("");
  s += P(`${line(1)}L${X(o.L)} ${y0}L${X(0)} ${y0}Z`, { c: "none", f: K.gold, op: .16 }) + P(`${line(2)}L${X(o.L)} ${y0}L${X(0)} ${y0}Z`, { c: "none", f: K.blue, op: .12 });
  s += P(line(1), { c: K.gold, w: 1.7 }) + P(line(2), { c: K.blue, w: 1.4, dash: "5 3" }) + P(`M${x1} ${y0}H${x2}`, { c: K.mute, w: .8 });
  (o.marks || []).forEach(m => { const yy = y0 + m.v * sc, xx = X(m.x), dx = xx > W / 2 ? -8 : 8; s += Ci(xx, yy, 2.8, { f: m.c || K.gold, c: "#fff" }) + T(xx + dx, yy + (m.v >= 0 ? 12 : -5), m.l, { a: dx < 0 ? "end" : "start", s: 9.5, w: 500, c: m.c || K.ink }); });
  s += T(x1, 11, o.label || "moments (kN·m) : max ─── min - - -", { s: 9, c: K.mute }) + T(x2, 11, o.span, { a: "end", s: 9, c: K.mute });
  if (o.top) s += o.top(X, yb);
  return svg(W, Hh, s);
}
const z = v => abs(v) < 1e-7 ? 0 : v;
const loadsTop = (ld, Lt) => (X, yb) => { let s = ""; (ld.q || []).forEach(([a, qa, b2, qb]) => { s += udl(X(min(a, b2)), X(max(a, b2)), yb - 4, 10, K.red, 10); }); (ld.P || []).forEach(([x]) => { s += arrow(X(x), yb - 26, X(x), yb - 4, K.red, 1.6); }); return s; };

/* poutre continue : modèle et charges permanentes depuis les saisies */
function build(I, extraPts = []) {
  checkSpans(I.Ls);
  const nsp = I.Ls.length, EI = I.EIs && I.EIs.length === nsp ? I.EIs.map(v => v * 1000) : I.EI * 1000, Lt = I.Ls.reduce((a, b) => a + b, 0);
  const rows = BM.loadsFromRows(I.G || []), q = rows.q.slice(), Pp = rows.P.slice(), Cc = (I.C || []).map(r => [r[0], r[1]]);
  if (I.Pc) I.Pc.forEach(r => Pp.push([r[0], r[1]])); if (I.qr) I.qr.forEach(r => q.push(r.slice(0, 4)));
  if (I.g) q.push([0, I.g, Lt, I.g]);
  const pts = [...Pp.map(p => p[0]), ...Cc.map(p => p[0]), ...q.flatMap(r => [r[0], r[2]]), ...extraPts];
  const m = BM.model({ spans: I.Ls, EI, left: I.left, right: I.right, points: pts, nel: max(240, 60 * nsp) });
  return { m, ld: { P: Pp, q, C: Cc }, Lt, nsp };
}

HB.add("RDM et formulaire", [

{ id: "rdm-continue-n", t: "Poutre continue : travées, appuis et charges quelconques", ref: "Biblio 2004 « Poutre continue » — méthode des déplacements (éléments finis de poutre)",
  desc: "Moments, efforts tranchants, flèches et réactions d'une poutre continue de 1 à 20 travées, avec encastrement ou console aux extrémités, charges ponctuelles, réparties trapézoïdales et couples.",
  inputs: [H("Poutre"), LST("Ls", "Portées des travées (séparées par « ; »)", "m", "12 ; 10 ; 12", L`L_i`), N("EI", "Rigidité de flexion", "MN·m²", 21, "EI"),
    LST("EIs", "Rigidités par travée (vide = EI partout)", "MN·m²", "", L`EI_i`),
    SEL("left", "Extrémité gauche", ENDS, "a", ""), SEL("right", "Extrémité droite", ENDS, "a", ""),
    H("Charges (positives vers le bas, abscisses depuis l'extrémité gauche)"), N("g", "Charge uniforme sur toute la poutre", "kN/m", 10, "g"),
    LST("Pc", "Charges ponctuelles : x P ; x P …", "kN", "", "P", { cols: 2 }), LST("qr", "Charges réparties : x₁ q₁ x₂ q₂ ; …", "kN/m", "", "q", { cols: 4 }),
    LST("C", "Couples (sens horaire > 0) : x C ; …", "kN·m", "", "C", { cols: 2 })],
  calc(I) {
    const { m, ld, Lt } = build(I), r = BM.solve(m, ld), Mx = BM.extremes(r.pts, 1), Vx = BM.extremes(r.pts, 2), Wx = BM.extremes(r.pts, 3);
    const supX = m.supp.map(s => s.x), Ms = supX.map(x => { const a = r.pts.filter(p => abs(p[0] - x) < 1e-7).map(p => p[1]); return a.length ? a.reduce((s, v) => abs(v) > abs(s) ? v : s, 0) : 0; });
    const sumF = ld.P.reduce((s, p) => s + p[1], 0) + ld.q.reduce((s, [a, qa, b, qb]) => s + (qa + qb) / 2 * abs(b - a), 0), sumR = r.reac.reduce((s, x) => s + x.R, 0);
    const vals = {}; r.reac.forEach((x, i) => { vals["R" + i] = x.R; vals["Ma" + i] = Ms[i]; if (x.Menc) vals["Me" + i] = x.Menc; });
    return { steps: [S("Lt", L`L_{tot}`, L`\textstyle\sum L_i`, Lt, "m", 2), S("nsup", "", "~nombre d'appuis", m.supp.length, "", 0),
      R("Mmax", L`M_{max}`, `~en x = ${f2(Mx.xmax, 2)} m`, Mx.max, "kN·m", 1), R("Mmin", L`M_{min}`, `~en x = ${f2(Mx.xmin, 2)} m`, Mx.min, "kN·m", 1),
      S("Vmax", L`|V|_{max}`, "", max(abs(Vx.max), abs(Vx.min)), "kN", 1), R("wmax", L`f_{max}`, `~en x = ${f2(abs(Wx.max) >= abs(Wx.min) ? Wx.xmax : Wx.xmin, 2)} m`, abs(Wx.max) >= abs(Wx.min) ? Wx.max : Wx.min, "mm", 2),
      S("eq", L`\textstyle\sum R - \sum F`, "~contrôle d'équilibre vertical", sumR - sumF, "kN", 3)],
      tables: [{ title: "Appuis", head: ["n°", "x (m)", "M (kN·m)", "R (kN)"], rows: r.reac.map((x, i) => [i + 1, x.x, z(Ms[i]), z(x.R)]), d: [2, 1, 1] }],
      vals, notes: ["Résolution par la méthode des déplacements (éléments de poutre d'Euler-Bernoulli, découpage fin) : résultats exacts aux nœuds pour les charges ponctuelles et les couples, à quelques 10⁻⁵ près pour les charges réparties. Effort tranchant sans déformation d'effort tranchant."] };
  },
  fig(I, g, r) { const { m, ld, Lt } = build(I), s = BM.solve(m, ld), f = interp(s.pts, 1), Mx = BM.extremes(s.pts, 1);
    return KIT.beamDiag({ L: Lt, sup: supList(I.Ls, I.left, I.right), fix: fixList(I.Ls, I.left, I.right), f, q: I.g ? `g = ${f2(I.g, 1)} kN/m` : "", loads: (I.Pc || []).map(p => ({ x: p[0], l: `${f2(p[1], 0)}` })),
      marks: [{ x: Mx.xmax, l: f2(Mx.max, 0) }], y0: 0.3, span: I.Ls.map(l => f2(l, 1)).join(" + ") + " m" }); },
  clair: (I, g) => `Le moment varie de ${f2(g("Mmin"), 0)} à ${f2(g("Mmax"), 0)} kN·m le long de la poutre ; la flèche maximale atteint ${f2(abs(g("wmax")), 1)} mm.` },

{ id: "rdm-enveloppe", t: "Poutre continue : enveloppe des efforts sous charges variables", ref: "Biblio 2004 « Efforts enveloppe » et « pianotage » — superposition des cas de charge",
  desc: "Enveloppe des moments, efforts tranchants, flèches et réactions d'une poutre continue : charges permanentes, jusqu'à trois groupes de surcharges et charge uniforme placée travée par travée (pianotage).",
  inputs: [H("Poutre"), LST("Ls", "Portées des travées", "m", "10 ; 20 ; 10", L`L_i`), N("EI", "Rigidité de flexion", "MN·m²", 10, "EI"),
    SEL("left", "Extrémité gauche", ENDS, "a", ""), SEL("right", "Extrémité droite", ENDS, "a", ""),
    H("Charges : « x P » ponctuelle, « x₁ q₁ x₂ q₂ » répartie, séparées par « ; »"), N("g", "Permanente uniforme", "kN/m", 0, "g"),
    LST("G", "Permanentes", "", "4 50 ; 25 20 ; 37 30 ; 0 10 10 20 ; 10 5 30 5 ; 30 10 40 10", "G", { cols: 0 }),
    N("qp", "Surcharge uniforme en pianotage (travée par travée)", "kN/m", 0, L`q_p`),
    LST("Q1", "Surcharges — groupe 1", "", "4 180 ; 0 50 10 0", L`Q_1`, { cols: 0 }), LST("Q2", "Surcharges — groupe 2", "", "27 40 ; 12 40 28 20", L`Q_2`, { cols: 0 }),
    LST("Q3", "Surcharges — groupe 3", "", "35 80 ; 32 20 40 30", L`Q_3`, { cols: 0 }),
    SEL("mode", "Groupes de surcharges", [["x", "exclusifs (un seul à la fois)"], ["c", "cumulables"]], "x", ""), N("xo", "Abscisse d'étude", "m", 4, L`x_0`)],
  calc(I) {
    const groups = [I.Q1, I.Q2, I.Q3].map(BM.loadsFromRows), extra = groups.flatMap(gq => [...gq.P.map(p => p[0]), ...gq.q.flatMap(r => [r[0], r[2]])]);
    const { m, ld, Lt } = build({ ...I, C: [] }, [...extra, I.xo]), G = BM.solve(m, ld), cases = groups.filter(gq => gq.P.length + gq.q.length).map(gq => BM.solve(m, gq));
    if (I.qp) { let x0 = 0; I.Ls.forEach(l => { cases.push(BM.solve(m, { q: [[x0, I.qp, x0 + l, I.qp]] })); x0 += l; }); }
    const nG = groups.filter(gq => gq.P.length + gq.q.length).length;
    /* pianotage : cumulable entre travées ; groupes : exclusifs ou cumulables */
    const comb = (k, j, which) => { const gv = which === "R" ? G.reac[j].R : G.pts[j][k]; let up = 0, dn = 0, gup = 0, gdn = 0;
      cases.forEach((c, i) => { const v = which === "R" ? c.reac[j].R : c.pts[j][k]; if (i >= nG || I.mode === "c") { if (v > 0) up += v; else dn += v; } else { gup = max(gup, v); gdn = min(gdn, v); } });
      return [gv + up + gup, gv + dn + gdn]; };
    const env = G.pts.map((p, j) => { const a = comb(1, j), b = comb(2, j), w = comb(3, j); return [p[0], a[0], a[1], b[0], b[1], w[0], w[1]]; });
    const jo = env.reduce((b, p, j) => abs(p[0] - I.xo) < abs(env[b][0] - I.xo) ? j : b, 0), ex = (k, f) => env.reduce((b, p) => f(p[k], b[k]) ? p : b, env[0]);
    const Rr = G.reac.map((s, j) => comb(0, j, "R")), vals = {};
    const supMoments = m.supp.map(s => { const near = env.filter(p => abs(p[0] - s.x) < 1e-7); return [near.reduce((a, p) => max(a, p[1]), -1e99), near.reduce((a, p) => min(a, p[2]), 1e99)]; });
    m.supp.forEach((s, i) => { vals["Ma" + i + "max"] = supMoments[i][0]; vals["Ma" + i + "min"] = supMoments[i][1]; vals["R" + i + "max"] = Rr[i][0]; vals["R" + i + "min"] = Rr[i][1]; });
    const Mmx = ex(1, (a, b) => a > b), Mmn = ex(2, (a, b) => a < b);
    return { steps: [S("nc", "", "~cas de charge variables superposés", cases.length, "", 0),
      R("Mmax", L`M_{max}`, `~en x = ${f2(Mmx[0], 2)} m`, Mmx[1], "kN·m", 1), R("Mmin", L`M_{min}`, `~en x = ${f2(Mmn[0], 2)} m`, Mmn[2], "kN·m", 1),
      H(`Abscisse d'étude x₀ = ${f2(env[jo][0], 2)} m`), S("Mo_max", L`M_{max}(x_0)`, L`M_G + \textstyle\sum M_{Q}^{+}`, env[jo][1], "kN·m", 1), S("Mo_min", L`M_{min}(x_0)`, L`M_G + \textstyle\sum M_{Q}^{-}`, env[jo][2], "kN·m", 1),
      S("Vo_max", L`V_{max}(x_0)`, "", env[jo][3], "kN", 1), S("Vo_min", L`V_{min}(x_0)`, "", env[jo][4], "kN", 1), S("wo_max", L`f_{max}(x_0)`, "", env[jo][5], "mm", 2), S("wo_min", L`f_{min}(x_0)`, "", env[jo][6], "mm", 2)],
      tables: [{ title: "Appuis : moments et réactions extrêmes", head: ["n°", "x", "M max", "M min", "R max", "R min"], rows: m.supp.map((s, i) => [i + 1, s.x, ...supMoments[i].map(z), ...Rr[i].map(z)]), d: [2, 1, 1, 1, 1] }],
      vals, notes: [`Enveloppe = permanentes + ${I.mode === "c" ? "somme des effets favorables ou défavorables de chaque groupe" : "effet le plus défavorable d'un seul groupe à la fois (convention du classeur Biblio 2004)"}${I.qp ? " + charge uniforme placée sur les seules travées dont l'effet est défavorable (pianotage)" : ""}. Les coefficients de pondération sont à appliquer aux charges saisies.`] };
  },
  fig(I, g) { const groups = [I.Q1, I.Q2, I.Q3].map(BM.loadsFromRows), Lt = I.Ls.reduce((a, b) => a + b, 0);
    const B0 = build({ ...I, C: [] }), m = B0.m, G = BM.solve(m, B0.ld);
    const env = (() => { const c = groups.filter(gq => gq.P.length + gq.q.length).map(gq => BM.solve(m, gq)); if (I.qp) { let x0 = 0; I.Ls.forEach(l => { c.push(BM.solve(m, { q: [[x0, I.qp, x0 + l, I.qp]] })); x0 += l; }); } const nG = groups.filter(gq => gq.P.length + gq.q.length).length;
      return G.pts.map((p, j) => { let up = 0, dn = 0, gu = 0, gd = 0; c.forEach((cc, i) => { const v = cc.pts[j][1]; if (i >= nG || I.mode === "c") { if (v > 0) up += v; else dn += v; } else { gu = max(gu, v); gd = min(gd, v); } }); return [p[0], p[1] + up + gu, p[1] + dn + gd]; }); })();
    return envFig({ L: Lt, env, sup: supList(I.Ls, I.left, I.right), fix: fixList(I.Ls, I.left, I.right), span: I.Ls.map(l => f2(l, 1)).join(" + ") + " m",
      marks: [{ x: env.find(p => p[1] === g("Mmax"))?.[0] ?? 0, v: g("Mmax"), l: f2(g("Mmax"), 0) }, { x: env.find(p => p[2] === g("Mmin"))?.[0] ?? 0, v: g("Mmin"), l: f2(g("Mmin"), 0), c: K.blue }] }); },
  clair: (I, g) => `Sous l'ensemble des cas de charge, le moment reste compris entre ${f2(g("Mmin"), 0)} et ${f2(g("Mmax"), 0)} kN·m ; à x = ${f2(I.xo, 1)} m il varie de ${f2(g("Mo_min"), 0)} à ${f2(g("Mo_max"), 0)} kN·m.` },

{ id: "rdm-convoi", t: "Poutre continue sous convoi roulant : enveloppe des efforts", ref: "Biblio 2004 « Poutre continue sous charge roulante » — lignes d'influence",
  desc: "Enveloppe des moments, efforts tranchants et réactions d'une poutre continue parcourue par un convoi d'essieux dans une zone de chargement donnée.",
  inputs: [H("Poutre"), LST("Ls", "Portées des travées", "m", "10", L`L_i`), N("EI", "Rigidité de flexion", "MN·m²", 10, "EI"),
    SEL("left", "Extrémité gauche", ENDS, "a", ""), SEL("right", "Extrémité droite", ENDS, "e", ""),
    H("Convoi"), LST("ax", "Essieux : distance au 1er essieu, charge ; …", "m, kN", "0 60 ; 5 20", "P", { cols: 2 }),
    N("z1", "Début de la zone de chargement", "m", 1, L`z_1`), N("z2", "Fin de la zone de chargement", "m", 9, L`z_2`),
    SEL("sens", "Sens de défilement", [["d", "vers la droite (1er essieu en tête à gauche)"], ["g", "vers la gauche"], ["b", "les deux sens"]], "d", ""), N("xo", "Abscisse d'étude", "m", 3.5, L`x_0`)],
  calc(I) {
    checkSpans(I.Ls); if (!I.ax.length) throw new Error("convoi à saisir");
    const Lt = I.Ls.reduce((a, b) => a + b, 0), m = BM.model({ spans: I.Ls, EI: I.EI * 1000, left: I.left, right: I.right, points: [I.xo, I.z1, I.z2], nel: max(200, 50 * I.Ls.length) });
    const c = BM.convoy(m, I.ax, max(0, I.z1), min(Lt, I.z2), I.sens), env = c.env, jo = env.reduce((b, p, j) => abs(p[0] - I.xo) < abs(env[b][0] - I.xo) ? j : b, 0);
    const ex = (k, f) => env.reduce((b, p) => f(p[k], b[k]) ? p : b, env[0]), Mmx = ex(1, (a, b) => a > b), Mmn = ex(2, (a, b) => a < b), Vmx = ex(3, (a, b) => a > b), Vmn = ex(4, (a, b) => a < b);
    const Ptot = I.ax.reduce((s, a) => s + a[1], 0), vals = {}; c.R.forEach((r, i) => { vals["R" + i + "max"] = r[0]; vals["R" + i + "min"] = r[1]; });
    const sm = m.supp.map(s => { const near = env.filter(p => abs(p[0] - s.x) < 1e-7); return [near.reduce((a, p) => max(a, p[1]), -1e99), near.reduce((a, p) => min(a, p[2]), 1e99)]; }); sm.forEach((v, i) => { vals["Ma" + i + "max"] = v[0]; vals["Ma" + i + "min"] = v[1]; });
    return { steps: [S("Pt", L`\textstyle\sum P`, "~poids total du convoi", Ptot, "kN", 1), S("lc", L`\ell_c`, "~longueur du convoi", max(...I.ax.map(a => a[0])), "m", 2),
      R("Mmax", L`M_{max}`, `~en x = ${f2(Mmx[0], 2)} m`, Mmx[1], "kN·m", 1), R("Mmin", L`M_{min}`, `~en x = ${f2(Mmn[0], 2)} m`, Mmn[2], "kN·m", 1), S("Vmax", L`|V|_{max}`, "", max(Vmx[3], -Vmn[4]), "kN", 1),
      H(`Abscisse d'étude x₀ = ${f2(env[jo][0], 2)} m`), R("Mo_max", L`M_{max}(x_0)`, L`\max_{p}\textstyle\sum P_i\,\eta_M(x_0, p + d_i)`, env[jo][1], "kN·m", 1), S("Mo_min", L`M_{min}(x_0)`, "", env[jo][2], "kN·m", 1),
      S("Vo_max", L`V_{max}(x_0)`, "", env[jo][3], "kN", 1), S("Vo_min", L`V_{min}(x_0)`, "", env[jo][4], "kN", 1)],
      tables: [{ title: "Appuis", head: ["n°", "x", "M max", "M min", "R max", "R min"], rows: m.supp.map((s, i) => [i + 1, s.x, ...sm[i].map(z), ...c.R[i].map(z)]), d: [2, 1, 1, 1, 1] }],
      vals, notes: ["Le convoi avance par pas fins ; seuls les essieux situés dans la zone de chargement sont comptés (convoi entrant ou sortant partiellement). Efforts obtenus par lignes d'influence ; appliquer ensuite majoration dynamique et pondérations."] };
  },
  fig(I, g) { const Lt = I.Ls.reduce((a, b) => a + b, 0), m = BM.model({ spans: I.Ls, EI: I.EI * 1000, left: I.left, right: I.right, points: [I.xo, I.z1, I.z2], nel: 160 }), c = BM.convoy(m, I.ax, max(0, I.z1), min(Lt, I.z2), I.sens);
    const env = c.env.map(p => [p[0], p[1], p[2]]), mx = env.reduce((b, p) => p[1] > b[1] ? p : b), mn = env.reduce((b, p) => p[2] < b[2] ? p : b);
    return envFig({ L: Lt, env, sup: supList(I.Ls, I.left, I.right), fix: fixList(I.Ls, I.left, I.right), span: `zone ${f2(I.z1, 1)} → ${f2(I.z2, 1)} m`,
      marks: [{ x: mx[0], v: mx[1], l: f2(mx[1], 0) }, { x: mn[0], v: mn[2], l: f2(mn[2], 0), c: K.blue }],
      top: (X, yb) => { let s = P(`M${X(I.z1)} ${yb - 20}H${X(I.z2)}`, { c: K.red, w: 1, dash: "3 2" }); I.ax.forEach(([d, F]) => { const x = I.z1 + d; if (x <= Lt) s += arrow(X(x), yb - 26, X(x), yb - 4, K.red, 1.6); }); return s; } }); },
  clair: (I, g) => `En faisant défiler le convoi de ${f2(g("Pt"), 0)} kN, le moment maximal atteint ${f2(g("Mmax"), 0)} kN·m et le moment minimal ${f2(g("Mmin"), 0)} kN·m.` },

{ id: "rdm-sol-elastique", t: "Poutre de longueur finie sur sol élastique", ref: "Biblio 2004 « Poutre sur sol élastique » — modèle de Winkler, extrémités libres",
  desc: "Tassements, moments, efforts tranchants et pressions sous une poutre ou une longrine de longueur finie reposant sur un sol élastique, sous charges quelconques.",
  inputs: [N("Lp", "Longueur de la poutre", "m", 10, "L"), N("B", "Largeur d'appui sur le sol", "m", 1, "B"), N("ks", "Module de réaction du sol", "kN/m³", 25000, L`k_s`),
    N("EI", "Rigidité de flexion", "MN·m²", 10, "EI"),
    LST("G", "Charges : « x P » ponctuelle, « x₁ q₁ x₂ q₂ » répartie", "", "0 100 ; 1 100 ; 4 30 8 20", "F", { cols: 0 }),
    LST("C", "Couples (sens horaire > 0) : x C ; …", "kN·m", "", "C", { cols: 2 }), N("xo", "Abscisse d'étude", "m", 5, L`x_0`)],
  calc(I) {
    const kw = I.ks * I.B, EI = I.EI * 1000, lam = Math.pow(kw / (4 * EI), 0.25), ld = BM.loadsFromRows(I.G); ld.C = (I.C || []).map(r => [r[0], r[1]]);
    const m = BM.model({ spans: [I.Lp], EI, kw, free: true, points: [...ld.P.map(p => p[0]), ...ld.q.flatMap(r => [r[0], r[2]]), ...ld.C.map(p => p[0]), I.xo], nel: 400 }), r = BM.solve(m, ld);
    const Mx = BM.extremes(r.pts, 1), Wx = BM.extremes(r.pts, 3), Vx = BM.extremes(r.pts, 2), F = ld.P.reduce((s, p) => s + p[1], 0) + ld.q.reduce((s, [a, qa, b, qb]) => s + (qa + qb) / 2 * abs(b - a), 0);
    const jo = r.pts.reduce((b, p, j) => abs(p[0] - I.xo) < abs(r.pts[b][0] - I.xo) ? j : b, 0), kind = lam * I.Lp < PI / 4 ? "rigide (λL < π/4)" : lam * I.Lp > PI ? "longue (λL > π)" : "de longueur intermédiaire";
    return { steps: [S("kw", L`k = k_s\,B`, "", kw, "kN/m²", 0), R("lam", L`\lambda`, L`\sqrt[4]{\dfrac{k}{4\,EI}}`, lam, "m⁻¹", 4), S("lamL", L`\lambda L`, `~poutre ${kind}`, lam * I.Lp, "", 3), S("l0", L`\ell_0 = 1/\lambda`, "~longueur élastique", 1 / lam, "m", 2),
      R("wmax", L`s_{max}`, `~tassement maximal en x = ${f2(Wx.xmax, 2)} m`, Wx.max, "mm", 2), S("wmin", L`s_{min}`, `~en x = ${f2(Wx.xmin, 2)} m`, Wx.min, "mm", 2), R("pmax", L`p_{max}`, L`k_s\,s_{max}`, I.ks * Wx.max / 1000, "kPa", 1),
      R("Mmax", L`M_{max}`, `~en x = ${f2(Mx.xmax, 2)} m`, Mx.max, "kN·m", 1), R("Mmin", L`M_{min}`, `~en x = ${f2(Mx.xmin, 2)} m`, Mx.min, "kN·m", 1),
      S("Mo", L`M(x_0)`, "", r.pts[jo][1], "kN·m", 2), S("Vo", L`V(x_0)`, "", r.pts[jo][2], "kN", 2), S("wo", L`s(x_0)`, "", r.pts[jo][3], "mm", 3)],
      checks: [C("Pas de décollement (tassement positif partout)", Wx.min >= 0, Wx.min >= 0 ? "le sol reste comprimé sous toute la poutre" : "soulèvement local : le modèle de Winkler bilatéral n'est plus valable")],
      notes: ["Modèle de Winkler bilatéral (le sol peut « tirer ») : en cas de soulèvement, refaire le calcul en supprimant les ressorts tendus. Le module de réaction dépend de la largeur chargée (voir la feuille des modules de Ménard)."] };
  },
  fig(I, g) { const kw = I.ks * I.B, ld = BM.loadsFromRows(I.G); ld.C = (I.C || []).map(r => [r[0], r[1]]); const m = BM.model({ spans: [I.Lp], EI: I.EI * 1000, kw, free: true, points: [...ld.P.map(p => p[0]), ...ld.q.flatMap(r => [r[0], r[2]])], nel: 240 }), r = BM.solve(m, ld);
    const W = 330, Hh = 185, x1 = 22, x2 = W - 18, X = x => x1 + (x2 - x1) * x / I.Lp, yb = 42; let s = "";
    ld.q.forEach(([a, , b]) => { s += udl(X(min(a, b)), X(max(a, b)), yb - 6, 10, K.red, 10); }); ld.P.forEach(([x, F]) => { s += arrow(X(x), yb - 30, X(x), yb - 6, K.red, 1.6) + T(X(x) + 3, yb - 26, f2(F, 0), { s: 8.5, c: K.red }); });
    const wm = max(1e-9, ...r.pts.map(p => abs(p[3]))), mm = max(1e-9, ...r.pts.map(p => abs(p[1])));
    s += P(`M${x1} ${yb - 4}H${x2}V${yb + 4}H${x1}Z`, { c: K.ink, f: K.conc }) + P(`M${x1} ${yb + 5}H${x2}`, { c: K.soilD, w: 1 });
    for (let i = 0; i <= 14; i++) s += P(`M${x1 + (x2 - x1) * i / 14} ${yb + 6}v8`, { c: K.soilD, w: 1 }) + P(`M${x1 + (x2 - x1) * i / 14 - 3} ${yb + 14}h6`, { c: K.soilD, w: 1 });
    const y1 = yb + 34, y2 = 140, line = (k, y0, sc) => r.pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)} ${(y0 + p[k] * sc).toFixed(1)}`).join("");
    s += P(line(3, y1, 22 / wm), { c: K.blue, w: 1.6 }) + P(`M${x1} ${y1}H${x2}`, { c: K.mute, w: .6 }) + T(x2, y1 - 4, `tassement (max ${f2(g("wmax"), 1)} mm)`, { a: "end", s: 8.5, c: K.blue });
    s += P(line(1, y2, 24 / mm), { c: K.gold, w: 1.7 }) + P(`M${x1} ${y2}H${x2}`, { c: K.mute, w: .6 }) + T(x1, Hh - 4, `moments : ${f2(g("Mmin"), 0)} à ${f2(g("Mmax"), 0)} kN·m`, { s: 9, c: K.mute }) + T(x2, Hh - 4, `λL = ${f2(g("lamL"), 2)}`, { a: "end", s: 9, c: K.mute });
    return svg(W, Hh, s); },
  clair: (I, g) => `La poutre s'enfonce au plus de ${f2(g("wmax"), 1)} mm (pression ${f2(g("pmax"), 0)} kPa) ; le moment varie de ${f2(g("Mmin"), 0)} à ${f2(g("Mmax"), 0)} kN·m.` },

]);
})(typeof window !== "undefined" ? window : globalThis);
