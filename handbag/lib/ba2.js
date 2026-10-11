/* ════════════════════════════════════════════════════════════════════
   HandBag — Béton armé : sections (classeurs Biblio 2004)
   Flexion déviée ELS d'une section quelconque (fissurée ou non), courbes
   d'interaction N–M à l'ELS et à l'ELU (BAEL) pour sections rectangulaires,
   circulaires et annulaires.
   Unités : m, kN, kN·m ; contraintes en MPa ; compression positive.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, GEO = HB.GEO, { PI, sqrt, pow, min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d);

/* découpe d'un polygone par le demi-plan a + bx·x + by·y ≥ 0 (Sutherland-Hodgman) */
function clip(poly, a, bx, by) {
  const out = [], s = p => a + bx * p[0] + by * p[1];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = s(p), sq = s(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
  }
  return out;
}
const props0 = pp => pp.length >= 3 ? GEO.polyProps(pp) : { A: 0, Sx: 0, Sy: 0, Ixx: 0, Iyy: 0, Ixy: 0 };
/* armatures : « x y A » (barre, A en cm²) ou « x0 y0 x1 y1 A n » (n barres régulièrement réparties) */
function barsFrom(rows) {
  const b = []; (rows || []).forEach(r => { if (r.length >= 6) { const n = max(1, Math.round(r[5])); for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1); b.push([r[0] + t * (r[2] - r[0]), r[1] + t * (r[3] - r[1]), r[4] / 1e4]); } } else if (r.length >= 3) b.push([r[0], r[1], r[2] / 1e4]); });
  return b;
}
/* équilibre ELS : σ(x, y) = a + bx·x + by·y (kPa), béton tendu négligé si fiss, aciers n·σ ;
   N au point (x0, y0), Mx positif comprimant les y croissants, My positif comprimant les x croissants */
function elsSolve(o) {
  const { poly, hole, bars, n, fiss, negl, x0, y0 } = o, Nt = o.N, Mx = o.Mx, My = o.My;
  const conc = (a, bx, by) => {
    let p = fiss ? props0(clip(poly, a, bx, by)) : GEO.polyProps(poly), h = hole ? (fiss ? props0(clip(hole, a, bx, by)) : GEO.polyProps(hole)) : null;
    if (h) p = { A: p.A - h.A, Sx: p.Sx - h.Sx, Sy: p.Sy - h.Sy, Ixx: p.Ixx - h.Ixx, Iyy: p.Iyy - h.Iyy, Ixy: p.Ixy - h.Ixy };
    return p;
  };
  const resid = (a, bx, by) => {
    const p = conc(a, bx, by); let A = p.A, Sx = p.Sx, Sy = p.Sy, Ixx = p.Ixx, Iyy = p.Iyy, Ixy = p.Ixy;
    bars.forEach(([x, y, As]) => { const s = a + bx * x + by * y; if (negl && s > 0) return; const w = n * As; A += w; Sx += w * y; Sy += w * x; Ixx += w * y * y; Iyy += w * x * x; Ixy += w * x * y; });
    /* N = ∫σ ; ∫σ (y − y0) ; ∫σ (x − x0) */
    const Nn = a * A + bx * Sy + by * Sx, Mxx = a * (Sx - y0 * A) + bx * (Ixy - y0 * Sy) + by * (Ixx - y0 * Sx), Myy = a * (Sy - x0 * A) + bx * (Iyy - x0 * Sy) + by * (Ixy - x0 * Sx);
    const J = [[A, Sy, Sx], [Sx - y0 * A, Ixy - y0 * Sy, Ixx - y0 * Sx], [Sy - x0 * A, Iyy - x0 * Sy, Ixy - x0 * Sx]];
    return { F: [Nn - Nt, Mxx - Mx, Myy - My], J };
  };
  const solve3 = (J, F) => { const A = J.map((r, i) => [...r, -F[i]]); for (let i = 0; i < 3; i++) { let p = i; for (let r = i + 1; r < 3; r++) if (abs(A[r][i]) > abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; for (let r = i + 1; r < 3; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < 4; c++) A[r][c] -= f * A[i][c]; } } const x = [0, 0, 0]; for (let i = 2; i >= 0; i--) { let s = A[i][3]; for (let c = i + 1; c < 3; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; } return x; };
  /* départ : section non fissurée (linéaire) */
  let u = [0, 0, 0]; { const r = resid(1e9, 0, 0), saveF = fiss; }
  { const lin = { ...o, fiss: false, negl: false }; const r0 = (() => { const p = GEO.polyProps(poly), h = hole ? GEO.polyProps(hole) : null; let A = p.A - (h ? h.A : 0), Sx = p.Sx - (h ? h.Sx : 0), Sy = p.Sy - (h ? h.Sy : 0), Ixx = p.Ixx - (h ? h.Ixx : 0), Iyy = p.Iyy - (h ? h.Iyy : 0), Ixy = p.Ixy - (h ? h.Ixy : 0);
      bars.forEach(([x, y, As]) => { const w = n * As; A += w; Sx += w * y; Sy += w * x; Ixx += w * y * y; Iyy += w * x * x; Ixy += w * x * y; });
      return [[A, Sy, Sx], [Sx - y0 * A, Ixy - y0 * Sy, Ixx - y0 * Sx], [Sy - x0 * A, Iyy - x0 * Sy, Ixy - x0 * Sx]]; })(); u = solve3(r0, [-Nt, -Mx, -My]); }
  let ok = !fiss && !negl, it = 0;
  if (!ok) for (it = 0; it < 200; it++) {
    const r = resid(...u), nf = abs(r.F[0]) + abs(r.F[1]) + abs(r.F[2]), sc = abs(Nt) + abs(Mx) + abs(My) + 1;
    if (nf < 1e-9 * sc) { ok = true; break; }
    const d = solve3(r.J, r.F); let lam = 1;
    for (let k = 0; k < 30; k++) { const t = u.map((v, i) => v + lam * d[i]), r2 = resid(...t), n2 = abs(r2.F[0]) + abs(r2.F[1]) + abs(r2.F[2]); if (n2 < nf || k === 29) { u = t; break; } lam /= 2; }
    if (!u.every(isFinite)) break;
  }
  return { a: u[0], bx: u[1], by: u[2], ok, it };
}

/* ─── courbes d'interaction N–M (flexion composée droite, sections symétriques) ─── */
function sectionStrips(o, ns = 400) {                 /* bandes horizontales de béton : [y, aire] ; y depuis le centre */
  const st = [], hh = o.forme === "r" ? o.h / 2 : o.D / 2;
  for (let i = 0; i < ns; i++) { const y = -hh + (i + .5) * 2 * hh / ns, dy = 2 * hh / ns;
    let w = o.forme === "r" ? o.b : 2 * sqrt(max(0, hh * hh - y * y)); if (o.forme === "a") w -= 2 * sqrt(max(0, (o.Di / 2) ** 2 - y * y)); st.push([y, w * dy]); }
  return { st, hh };
}
function sectionBars(o) {                              /* [y, A (m²)] */
  const As = o.As / 1e4, b = [];
  if (o.forme === "r") { const d = o.h / 2 - o.c, f = o.rep / 100; if (f > 0) { b.push([d, As * f / 2], [-d, As * f / 2]); } const ns = 40, side = As * (1 - f); if (side > 0) for (let i = 0; i < ns; i++) b.push([-d + (i + .5) * 2 * d / ns, side / ns]); }
  else { const ra = o.D / 2 - o.c, nb = 72; for (let i = 0; i < nb; i++) b.push([ra * Math.sin(2 * PI * (i + .5) / nb), As / nb]); }
  return b;
}
function curveELS(o) {
  const { st, hh } = sectionStrips(o), bars = sectionBars(o), ys = bars.map(b => b[0]), ymaxS = max(...ys), yminS = min(...ys), pts = [];
  for (let k = 0; k <= 180; k++) {
    const ph = PI * k / 180, ca = Math.cos(ph), sa = Math.sin(ph), sig = y => ca + sa * y / hh;      /* plan de contraintes unitaire, compression en haut */
    let s = Infinity; const lim = (v, L0) => { if (L0 > 0 && v > 1e-12) s = min(s, L0 / v); if (L0 < 0 && v < -1e-12) s = min(s, L0 / v); };
    lim(sig(hh), o.sbc); if (o.sbm > 0) lim(sig(0), o.sbm); if (o.sbt < 0) lim(sig(-hh), o.sbt); lim(o.n * sig(yminS), o.sst); if (o.ssc > 0) lim(o.n * sig(ymaxS), o.ssc);
    if (!isFinite(s)) continue;
    let Nn = 0, M = 0; st.forEach(([y, A]) => { const v = s * sig(y); if (v > 0 || o.sbt < 0) { Nn += v * A; M += v * A * y; } });
    bars.forEach(([y, A]) => { const v = s * sig(y); if (o.negl && v > 0) return; Nn += o.n * v * A; M += o.n * v * A * y; });
    pts.push([Nn * 1000, M * 1000]);                   /* MPa·m² → kN */
  }
  return pts;
}
function curveELU(o) {
  const { st, hh } = sectionStrips(o, 500), bars = sectionBars(o), ys = bars.map(b => b[0]), yS = min(...ys), ebl = o.fc <= 60 ? 3.5 : 4.5 - o.fc / 40;
  const fbu = 0.85 * o.fc / 1.5, fed = o.fe / 1.15, Es = 200000, pts = [];
  const sb = e => e <= 0 ? 0 : e >= 2 ? fbu : fbu * (1 - (1 - e / 2) ** 2), ss = e => max(-fed, min(fed, Es * e / 1000));
  const planes = [];                                   /* ε(y) en ‰ = e0 + κ·y */
  for (let k = 0; k <= 60; k++) { const et = -10 + (ebl + 10) * k / 60; planes.push([et, -10, hh, yS]); }       /* pivot A : ε acier = −10 ‰ */
  for (let k = 1; k <= 60; k++) { const eb = -10 + 10 * k / 60; planes.push([ebl, eb, hh, yS]); }            /* pivot B : ε haut = εbc */
  const hb = -hh; for (let k = 1; k <= 40; k++) { const e2 = ebl * (1 - k / 40); planes.push([ebl - (ebl - 2) * k / 40, 0, hh, hb, e2]); }
  planes.forEach(pl => {
    let e0, kap;
    if (pl.length === 4) { const [e1, e2, y1, y2] = pl; kap = (e1 - e2) / (y1 - y2); e0 = e1 - kap * y1; }
    else { /* pivot C : ε = 2 ‰ à 3h/7 de la fibre la plus comprimée */ const yc = hh - 3 / 7 * 2 * hh, et = pl[0], t = (et - 2) / (hh - yc); kap = t; e0 = 2 - kap * yc; }
    let Nn = 0, M = 0; st.forEach(([y, A]) => { const v = sb(e0 + kap * y); Nn += v * A; M += v * A * y; });
    bars.forEach(([y, A]) => { const e = e0 + kap * y; if (o.negl && e > 0) return; const v = ss(e); Nn += v * A; M += v * A * y; });
    pts.push([Nn * 1000, M * 1000]);
  });
  /* compression centrée (ε = 2 ‰) et traction pure */
  { let Nn = 0; st.forEach(([y, A]) => { Nn += fbu * A; }); bars.forEach(([y, A]) => { if (!o.negl) Nn += ss(2) * A; }); pts.push([Nn * 1000, 0]); }
  pts.unshift([-fed * bars.reduce((s, b) => s + b[1], 0) * 1000, 0]);
  return pts.sort((a, b) => a[0] - b[0]);
}
/* moment limite pour un effort normal donné (enveloppe supérieure de la courbe) */
function mLim(pts, Nn) { let best = -1; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const [n1, m1] = pts[i], [n2, m2] = pts[j]; if ((n1 - Nn) * (n2 - Nn) <= 0 && n1 !== n2) { const m = m1 + (m2 - m1) * (Nn - n1) / (n2 - n1); if (m > best) best = m; } } return best; }

HB.add("Béton armé — BAEL", [

{ id: "bael-flexion-deviee", t: "Flexion déviée ELS : section quelconque fissurée ou non", ref: "Biblio 2004 « Flexion déviée ELS » (section rectangulaire, section quelconque, section non fissurée) — BAEL 91, section homogénéisée n = 15",
  desc: "Plan des contraintes, contraintes extrêmes du béton et des aciers d'une section de forme quelconque (contour, évidement, armatures) soumise à un effort normal et à deux moments, en section fissurée ou non fissurée.",
  inputs: [H("Section (m)"), LST("pts", "Contour : x y ; …", "m", "0 0 ; 1 0 ; 1 1 ; 0 1", "", { cols: 0 }), LST("hole", "Évidement éventuel", "m", "", "", { cols: 0 }),
    LST("ac", "Aciers (cm²) : « x y A » ou « x₀ y₀ x₁ y₁ A n »", "", "0.05 0.1 0.05 0.5 4.91 5 ; 0.95 0.1 0.95 0.5 8.04 5", "A", { cols: 0 }),
    N("n", "Coefficient d'équivalence", "", 15, "n"), SEL("fiss", "Hypothèse", [["f", "section fissurée (béton tendu négligé)"], ["n", "section non fissurée"]], "f", ""),
    SEL("negl", "Aciers comprimés", [["o", "négligés"], ["c", "pris en compte"]], "o", ""),
    H("Efforts (compression > 0)"), N("Ne", "Effort normal", "kN", -103, "N"), N("Mx", "Moment Mx (> 0 comprime le haut)", "kN·m", -352, L`M_x`), N("My", "Moment My (> 0 comprime la droite)", "kN·m", -230, L`M_y`),
    SEL("app", "Efforts appliqués au", [["g", "centre de gravité du béton"], ["o", "point (0 ; 0)"]], "g", ""),
    N("sbl", "Limite du béton", "MPa", 15, L`\bar\sigma_{bc}`), N("ssl", "Limite des aciers", "MPa", 400, L`\bar\sigma_s`)],
  calc(I) {
    if (!I.pts || I.pts.length < 3) throw new Error("contour à saisir (au moins trois sommets)");
    const poly = GEO.contour(I.pts), hole = I.hole && I.hole.length >= 3 ? GEO.contour(I.hole) : null, bars = barsFrom(I.ac);
    const p = GEO.polyProps(poly), h = hole ? GEO.polyProps(hole) : null, A = p.A - (h ? h.A : 0), xg = (p.Sy - (h ? h.Sy : 0)) / A, yg = (p.Sx - (h ? h.Sx : 0)) / A;
    const [x0, y0] = I.app === "g" ? [xg, yg] : [0, 0];
    const r = elsSolve({ poly, hole, bars, n: I.n, fiss: I.fiss === "f", negl: I.negl === "o", x0, y0, N: I.Ne, Mx: I.Mx, My: I.My });
    if (!r.ok) throw new Error("pas d'équilibre trouvé : effort hors de la capacité de la section fissurée (traction trop forte ?)");
    const sig = (x, y) => (r.a + r.bx * x + r.by * y) / 1000, sv = poly.map(q => sig(...q)), sbmax = max(...sv), sbmin = min(...sv);
    const ssv = bars.map(([x, y]) => I.n * sig(x, y)), ssmin = min(...ssv), ssmax = max(...ssv), As = bars.reduce((s, b) => s + b[2], 0) * 1e4;
    const comp = clip(poly, r.a, r.bx, r.by), Ac = I.fiss === "f" ? props0(comp).A : A;
    return { steps: [S("A", "B", "~aire de béton", A, "m²", 4), S("As", L`A_s`, "~section totale d'acier", As, "cm²", 2), S("xg", L`x_G`, "", xg, "m", 3), S("yg", L`y_G`, "", yg, "m", 3),
      H("Plan des contraintes du béton : σ = a + b·x + c·y"), R("a", "a", "~contrainte à l'origine", r.a / 1000, "MPa", 4), S("b", "b", "", r.bx / 1000, "MPa/m", 4), S("c", "c", "", r.by / 1000, "MPa/m", 4),
      S("Ac", L`B_c`, "~aire de béton comprimé", Ac, "m²", 4), R("sb", L`\sigma_{b,max}`, "", sbmax, "MPa", 2), S("sbm", L`\sigma_{b,min}`, I.fiss === "f" ? "~(béton tendu non pris en compte)" : "~traction du béton", sbmin, "MPa", 2),
      R("ss", L`\sigma_{s,min}`, L`n\,\sigma(x_s, y_s)\ \ \text{(traction)}`, ssmin, "MPa", 2), S("ssc", L`\sigma_{s,max}`, "", ssmax, "MPa", 2)],
      checks: [C("Compression du béton", sbmax <= I.sbl, `σb = ${fmt(sbmax, 2)} ≤ ${fmt(I.sbl, 2)} MPa`, max(0, sbmax) / I.sbl), C("Traction des aciers", -ssmin <= I.ssl, `|σs| = ${fmt(abs(min(0, ssmin)), 1)} ≤ ${fmt(I.ssl, 0)} MPa`, max(0, -ssmin) / I.ssl)],
      tables: [{ title: "Contraintes aux sommets du contour (MPa)", head: ["x", "y", "σ béton"], rows: I.pts.slice(0, 8).map(q => [q[0], q[1], sig(q[0], q[1])]), d: [3, 3, 3] }],
      vals: { plane: [r.a, r.bx, r.by], sbmax, ssmin }, notes: [`Résolution itérative (Newton) de l'équilibre du béton comprimé, découpé exactement par l'axe neutre, et des aciers homogénéisés (n = ${I.n}). Les contraintes sont positives en compression.`] };
  },
  fig(I, g, r) {
    const poly = GEO.contour(I.pts), hole = I.hole && I.hole.length >= 3 ? GEO.contour(I.hole) : null, bars = barsFrom(I.ac), [a, bx, by] = r.vals.plane;
    const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]), x0 = min(...xs), x1 = max(...xs), y0 = min(...ys), y1 = max(...ys), W = 330, Hh = 190, k = min(200 / (x1 - x0 || 1), 150 / (y1 - y0 || 1)), ox = 20, oy = 18;
    const X = x => ox + (x - x0) * k, Y = y => oy + (y1 - y) * k, path = pp => pp.map((q, i) => `${i ? "L" : "M"}${X(q[0]).toFixed(1)} ${Y(q[1]).toFixed(1)}`).join("") + "Z";
    let s = P(path(poly), { c: K.concD, f: "#f4f1ea", w: 1 }); const cp = clip(poly, a, bx, by); if (cp.length >= 3) s += P(path(cp), { c: "none", f: K.gold, op: .35 }); if (hole) s += P(path(hole), { c: K.concD, f: "#fff" });
    /* axe neutre */
    if (abs(bx) + abs(by) > 1e-12) { const pts = []; const L0 = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; for (let i = 0; i < 4; i++) { const p = L0[i], q = L0[(i + 1) % 4], sp = a + bx * p[0] + by * p[1], sq = a + bx * q[0] + by * q[1]; if (sp * sq < 0) { const t = sp / (sp - sq); pts.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); } }
      if (pts.length >= 2) s += P(`M${X(pts[0][0])} ${Y(pts[0][1])}L${X(pts[1][0])} ${Y(pts[1][1])}`, { c: K.blue, w: 1.4, dash: "6 3" }); }
    bars.forEach(([x, y, A]) => { const sv = I.n * (a + bx * x + by * y) / 1000; s += Ci(X(x), Y(y), 2.6, { f: sv < 0 ? K.red : K.ink, c: "#fff" }); });
    s += T(W - 6, 30, `σb max = ${f2(g("sb"), 2)} MPa`, { a: "end", s: 9.5, w: 500, c: K.gold }) + T(W - 6, 46, `σs = ${f2(g("ss"), 1)} MPa`, { a: "end", s: 9.5, w: 500, c: K.red }) + T(W - 6, 62, "axe neutre - - -", { a: "end", s: 9, c: K.blue });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le béton est comprimé au plus à ${f2(g("sb"), 2)} MPa et l'acier le plus tendu travaille à ${f2(abs(g("ss")), 0)} MPa.` },

{ id: "bael-interaction", t: "Courbe d'interaction N–M d'une section rectangulaire, circulaire ou annulaire", ref: "Biblio 2004 « Courbes d'interaction MN à l'ELS et à l'ELU » — BAEL 91 (A.4.3 et A.4.5)",
  desc: "Domaine résistant effort normal – moment à l'ELS (contraintes limites) ou à l'ELU (pivots, parabole-rectangle) et vérification d'une liste de couples d'efforts.",
  inputs: [SEL("et", "État limite", [["s", "ELS (contraintes admissibles)"], ["u", "ELU (BAEL, parabole-rectangle)"]], "s", ""),
    SEL("forme", "Section", [["r", "rectangulaire"], ["c", "circulaire pleine"], ["a", "annulaire"]], "r", ""),
    N("b", "Largeur b (rectangle)", "m", 1, "b"), N("h", "Hauteur h (rectangle)", "m", 0.8, "h"), N("D", "Diamètre D (cercle, anneau)", "m", 0.8, "D"), N("Di", "Diamètre intérieur (anneau)", "m", 0.3, L`D_i`),
    N("As", "Section totale d'acier", "cm²", 200, L`A_s`), N("c", "Enrobage (axe des aciers)", "m", 0.07, "c"), N("rep", "Aciers sur les 2 faces extrêmes (rect.)", "%", 80, ""),
    SEL("negl", "Aciers comprimés", [["c", "pris en compte"], ["o", "négligés"]], "c", ""),
    H("ELS"), N("sbc", "Compression max. du béton", "MPa", 10.8, L`\bar\sigma_{bc}`), N("sbm", "Compression au centre (0 = sans)", "MPa", 0, L`\bar\sigma_{b,G}`), N("sst", "Traction des aciers", "MPa", -200, L`\bar\sigma_s`), N("n", "Coefficient d'équivalence", "", 15, "n"),
    H("ELU"), N("fc", "Résistance du béton", "MPa", 24, L`f_{c28}`), N("fe", "Limite d'élasticité", "MPa", 500, L`f_e`),
    LST("NM", "Efforts à vérifier (kN, kN·m) : N M ; …", "", "6000 800 ; 2000 1200 ; -1500 600", "", { cols: 2 })],
  calc(I) {
    const o = { forme: I.forme, b: I.b, h: I.h, D: I.D, Di: I.Di, As: I.As, c: I.c, rep: I.rep, negl: I.negl === "o", sbc: I.sbc, sbm: I.sbm, sbt: 0, sst: I.sst, ssc: 0, n: I.n, fc: I.fc, fe: I.fe };
    if (I.forme === "a" && !(I.Di > 0 && I.Di < I.D)) throw new Error("diamètre intérieur à revoir");
    const pts = I.et === "s" ? curveELS(o) : curveELU(o), Ns = pts.map(p => p[0]), Nmax = max(...Ns), Nmin = min(...Ns), Mmax = max(...pts.map(p => p[1])), atM = pts.find(p => p[1] === Mmax)[0];
    const Ab = I.forme === "r" ? I.b * I.h : PI / 4 * (I.D ** 2 - (I.forme === "a" ? I.Di ** 2 : 0));
    const rows = (I.NM || []).map(([Nn, M]) => { const ml = Nn < Nmin || Nn > Nmax ? 0 : mLim(pts, Nn); return [Nn, M, ml, ml > 0 ? abs(M) / ml : Infinity]; });
    const worst = rows.reduce((m, r) => max(m, r[3]), 0);
    return { steps: [S("Ab", "B", "~aire du béton", Ab, "m²", 4), S("rho", L`\rho`, L`A_s / B`, I.As / 1e4 / Ab * 100, "%", 2),
      ...(I.et === "u" ? [S("fbu", L`f_{bu}`, L`\dfrac{0{,}85\,f_{c28}}{1{,}5}`, 0.85 * I.fc / 1.5, "MPa", 2), S("fed", L`f_{ed}`, L`f_e / 1{,}15`, I.fe / 1.15, "MPa", 1)] : []),
      R("Nmax", L`N_{max}`, "~compression centrée", Nmax, "kN", 0), R("Nmin", L`N_{min}`, "~traction centrée", Nmin, "kN", 0), R("Mmax", L`M_{max}`, `~atteint pour N = ${fmt(atM, 0)} kN`, Mmax, "kN·m", 1)],
      checks: rows.map(r => C(`N = ${fmt(r[0], 0)} kN, M = ${fmt(r[1], 0)} kN·m`, r[3] <= 1, r[2] > 0 ? `M limite ${fmt(r[2], 0)} kN·m` : "effort normal hors domaine", min(r[3], 9.99))),
      tables: rows.length ? [{ title: "Vérification des efforts", head: ["N (kN)", "M (kN·m)", "M lim (kN·m)", "taux"], rows: rows.map(r => [r[0], r[1], r[2], r[3]]), d: [1, 1, 2] }] : [],
      vals: { pts, worst, rows: rows.map(r => r[3]) }, notes: [I.et === "s" ? "ELS : diagramme linéaire, béton tendu négligé, aciers homogénéisés ; la courbe est obtenue en saturant la première contrainte limite atteinte." : "ELU : diagramme parabole-rectangle ($\\varepsilon_{bc} = 3{,}5$ ‰), acier élasto-plastique sans écrouissage (10 ‰), pivots A, B et C du BAEL. Acier comprimé à $E_s\\,\\varepsilon$ plafonné à $f_{ed}$.",
        I.forme === "r" ? `Rectangle : ${fmt(I.rep / 2, 0)} % des aciers sur chaque face extrême, le reste réparti sur les côtés.` : "Aciers uniformément répartis sur un cercle."] };
  },
  fig(I, g, r) {
    const pts = r.vals.pts, sym = pts.map(p => [p[0], -p[1]]).reverse();
    const cur = [...pts, ...sym.slice(1)].map(p => [p[1], p[0]]), Mm = g("Mmax") * 1.15;
    return plot({ series: [{ pts: cur, c: K.gold, w: 1.8, l: I.et === "s" ? "domaine ELS" : "domaine ELU" }], marks: (I.NM || []).map(([Nn, M], i) => ({ x: M, y: Nn, l: String(i + 1), c: r.vals.rows && r.vals.rows[i] > 1 ? K.red : K.blue })),
      xl: "M (kN·m)", xmin: -Mm, xmax: Mm, ymin: min(0, g("Nmin")) * 1.1, ymax: g("Nmax") * 1.08, h: 185 });
  },
  clair: (I, g, r) => `La section reprend au plus ${f2(g("Nmax"), 0)} kN en compression centrée et ${f2(g("Mmax"), 0)} kN·m en flexion${(I.NM || []).length ? ` ; le couple le plus défavorable utilise ${f2(r.vals.worst * 100, 0)} % du domaine` : ""}.` },

]);
HB.BA = { elsSolve, clip, barsFrom, curveELS, curveELU, mLim };
})(typeof window !== "undefined" ? window : globalThis);
