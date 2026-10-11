/* ════════════════════════════════════════════════════════════════════
   HandBag — Précontrainte : tracé d'un câble par points de passage (classeur Biblio 2004 « CABLE »)
   Polynômes de degré ≤ 3 par tronçon, raccordés en tangence ; rayons de courbure, déviations, frottement.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { min, max, abs, exp, L, S, R, C, N, LST, fmt } = HB.DSL;
const { K, plot } = HB.FIG;
const f2 = (v, d = 2) => fmt(v, d);

/* tronçon [x1, x2] : z1, z2, pentes p1 et p2 éventuelles → coefficients (A, B, C, D) de z = A x³ + B x² + C x + D */
function seg(x1, z1, x2, z2, p1, p2) {
  const h = x2 - x1, s = (z2 - z1) / h; let a = 0, b = 0, c = 0;   // en variable locale u = x − x1
  if (p1 != null && p2 != null) { c = p1; b = (3 * s - 2 * p1 - p2) / h; a = (p1 + p2 - 2 * s) / (h * h); }
  else if (p1 != null) { c = p1; b = (s - p1) / h; }
  else if (p2 != null) { b = (p2 - s) / h; c = s - b * h; }
  else c = s;
  /* passage en variable x : z = a (x − x1)³ + b (x − x1)² + c (x − x1) + z1 */
  return [a, b - 3 * a * x1, c - 2 * b * x1 + 3 * a * x1 * x1, z1 - c * x1 + b * x1 * x1 - a * x1 ** 3];
}
const ev = (k, x) => k[0] * x ** 3 + k[1] * x * x + k[2] * x + k[3], d1 = (k, x) => 3 * k[0] * x * x + 2 * k[1] * x + k[2], d2 = (k, x) => 6 * k[0] * x + 2 * k[1];

HB.add("Précontrainte", [
{ id: "pc-trace-cable", t: "Tracé d'un câble de précontrainte par points de passage", ref: "Biblio 2004 « CABLE » ; NF EN 1992-1-1 §5.10.5.2 (frottement), §8.10.4 (rayon minimal)",
  desc: "Tracé continu en tangence d'un câble passant par des points imposés, pente imposée ou libre en chaque point, rayon de courbure minimal, déviation angulaire cumulée et pertes par frottement.",
  inputs: [LST("pts", "Points : x (m), z (m), pente imposée (– si libre) ; …", "", "0 0.90 – ; 12 0.15 0 ; 27 1.40 – ; 30 1.55 0 ; 33 1.40 – ; 48 0.15 0 ; 60 0.90 –", "", { cols: 0 }),
    N("xe", "Abscisse d'étude", "m", 30, L`x_e`), N("mu", "Coefficient de frottement en courbe", "", 0.19, L`\mu`), N("kk", "Déviation parasite", "rad/m", 0.005, "k"), N("n", "Points de calcul", "", 100, "n")],
  calc(I) {
    const P = (I.pts || []).filter(r => r.length >= 2).map(r => [r[0], r[1], r.length > 2 && Number.isFinite(r[2]) ? r[2] : null]).sort((a, b) => a[0] - b[0]);
    if (P.length < 2) throw new Error("au moins deux points de passage");
    const segs = []; let p = P[0][2];
    for (let i = 0; i < P.length - 1; i++) { const k = seg(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], p, P[i + 1][2]); segs.push({ x1: P[i][0], x2: P[i + 1][0], k }); p = d1(k, P[i + 1][0]); }
    const at = x => segs.find(s => x <= s.x2 + 1e-12) || segs.at(-1), x0 = P[0][0], x1 = P.at(-1)[0], n = max(10, Math.round(I.n));
    const xs = Array.from({ length: n + 1 }, (_, i) => x0 + (x1 - x0) * i / n), cur = x => { const s = at(x), q = d1(s.k, x); return d2(s.k, x) / (1 + q * q) ** 1.5; };
    let kmax = 0, xk = x0; xs.concat(P.map(q => q[0])).forEach(x => { const c = abs(cur(x)); if (c > kmax) { kmax = c; xk = x; } });
    /* déviation angulaire cumulée (somme des |Δθ| sur un découpage fin) et frottement */
    const th = x => Math.atan(d1(at(x).k, x)); let dev = 0, prev = th(x0); const NF = 2000; for (let i = 1; i <= NF; i++) { const t = th(x0 + (x1 - x0) * i / NF); dev += abs(t - prev); prev = t; }
    const len = (x1 - x0), ratio = exp(-I.mu * (dev + I.kk * len)), se = at(I.xe);
    const rows = segs.map((s, i) => [`${f2(s.x1, 2)} → ${f2(s.x2, 2)}`, s.k[0], s.k[1], s.k[2], s.k[3]]);
    return { steps: [S("ze", L`z(x_e)`, L`A\,x_e^3 + B\,x_e^2 + C\,x_e + D`, ev(se.k, I.xe), "m", 4), S("pe", L`z'(x_e)`, "", d1(se.k, I.xe), "", 4), S("ce", L`1/R(x_e)`, L`\dfrac{z''}{(1 + z'^2)^{3/2}}`, cur(I.xe), "1/m", 5),
      R("Rmin", L`R_{min}`, `~atteint en x = ${fmt(xk, 2)} m`, kmax ? 1 / kmax : 0, "m", 3), S("dev", L`\alpha`, L`\textstyle\sum|\Delta\theta|` + "\\quad\\text{(déviation cumulée)}", dev, "rad", 4),
      R("ratio", L`P(L)/P_0`, L`e^{-\mu\,(\alpha + k\,L)}`, ratio, "", 4), S("loss", "", "~perte par frottement à l'extrémité", (1 - ratio) * 100, "%", 2)],
      tables: [{ title: "Coefficients du tracé z = A x³ + B x² + C x + D", head: ["tronçon (m)", "A", "B", "C", "D"], rows, d: [6, 6, 5, 4] }],
      vals: { P, segs, xs, z: xs.map(x => ev(at(x).k, x)), rmin: kmax ? 1 / kmax : 0, xk, ze: ev(se.k, I.xe) },
      notes: ["Chaque tronçon reçoit le polynôme de plus bas degré qui passe par ses deux points en respectant la pente de départ (celle du tronçon précédent, ou la pente imposée au premier point) et la pente imposée à son extrémité : cubique si les deux pentes sont connues, parabole si l'une est libre, droite sinon. Le rayon minimal est à comparer au rayon admissible de la gaine (ATE du procédé, ordre de grandeur 2,5 à 6 m) ; μ et k selon le procédé (EN 1992-1-1 §5.10.5.2)."] };
  },
  fig(I, g, r) { const v = r.vals; return plot({ series: [{ pts: v.xs.map((x, i) => [x, v.z[i]]), c: K.gold, w: 2, l: "tracé du câble" }], marks: v.P.map(p => ({ x: p[0], y: p[1], l: "", c: K.blue, dot: true })).concat([{ x: v.xk, y: v.z[v.xs.findIndex(x => x >= v.xk)] ?? 0, l: `Rmin = ${f2(v.rmin, 2)} m`, c: K.red }]),
    xl: "x (m) — z (m)", h: 185, ymin: min(...v.z) - 0.1, ymax: max(...v.z) + 0.15 }); },
  clair: (I, g) => `Le câble a un rayon de courbure minimal de ${f2(g("Rmin"), 2)} m et dévie au total de ${f2(g("dev"), 3)} rad ; le frottement laisse ${f2(g("ratio") * 100, 1)} % de la tension à l'extrémité.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
