/* ════════════════════════════════════════════════════════════════════
   HandBag — Règlements anciens : répartition transversale sur bipoutre (classeur Biblio 2004 « Surchmix »)
   Fascicule 61 titre II (A(l), Bc, Bt, Mc80, Mc120), règle du levier entre deux poutres.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { min, max, abs, L, S, R, C, N, SEL, H, fmt } = HB.DSL;
const { K, svg, T, P, Rc, arrow, dim } = HB.FIG;
const f2 = (v, d = 2) => fmt(v, d);
/* coefficients du fascicule 61 titre II : a1 (art. 4.2), bc (art. 5.22), bt (art. 5.42) — lignes = nombre de voies chargées, colonnes = classe */
const A1 = [[1, 1, 0.9], [1, 0.9, 0.8], [0.9, null, null], [0.75, null, null], [0.7, null, null]];
const BC = [[1.2, 1, 1], [1.1, 1, 0.8], [0.95, null, null], [0.8, null, null], [0.7, null, null]];
const BT = [1, 0.9, null];

HB.add("Règlements anciens", [
{ id: "anc-bipoutre-levier", t: "Bipoutre : répartition transversale des charges du fascicule 61 (règle du levier)", ref: "Fascicule 61 titre II — art. 2 (classes, voies), 4.2 (a1), 5.22 (bc), 5.42 (bt), 9 (Mc80, Mc120) — Biblio 2004 « Surchmix »",
  desc: "Part de chaque système de charges reprise par chacune des deux poutres d'un tablier bipoutre, les voies étant placées contre un bord ou l'autre de la largeur chargeable.",
  inputs: [N("lp", "Entraxe des poutres", "m", 5.7, L`l_p`), N("ec", "Débord du tablier à gauche de la poutre gauche", "m", 3, L`e_g`), N("lr", "Largeur roulable", "m", 7.5, L`L_r`),
    N("nd", "Nombre de dispositifs de retenue (−0,50 m chacun)", "", 0, ""), N("blc", "Bord gauche de la largeur chargeable depuis le bord du tablier", "m", 1.45, L`b_g`)],
  calc(I) {
    const lc = I.lr - 0.5 * I.nd, nv = lc >= 5 && lc < 6 ? 2 : Math.floor(lc / 3), v = lc / nv, cl = I.lr >= 7 ? 1 : I.lr > 5.5 ? 2 : 3, x0 = -(I.lp / 2 + I.ec), xg = x0 + I.blc, xd = xg + lc;
    if (nv < 1) throw new Error("largeur chargeable inférieure à une voie");
    /* charge de largeur w, n fois accolée depuis un bord : coefficient de chaque poutre (levier) × n × coefficient de classe */
    const lev = e => 0.5 - e / I.lp;
    const sys = (nom, w, nmax, coef) => { const out = []; for (let n = 1; n <= nmax; n++) { const k = coef(n); if (k == null) continue; const eg = xg + n * w / 2, ed = xd - n * w / 2; out.push({ n, k, g: n * k * lev(eg), d: n * k * (1 - lev(ed)), eg, ed }); }
      const bg = out.reduce((a, b) => b.g > a.g ? b : a, out[0]), bd = out.reduce((a, b) => b.d > a.d ? b : a, out[0]); return { nom, w, bg, bd, out }; };
    const res = [sys("A(l)", v, nv, n => A1[n - 1] && A1[n - 1][cl - 1]), sys("Bc", 2.5, nv, n => BC[n - 1] && BC[n - 1][cl - 1]), sys("Bt", 3, min(2, nv), () => BT[cl - 1]), sys("Mc80", 3.65, 1, () => 1), sys("Mc120", 4.3, 1, () => 1)].filter(r => r.bg);
    const g = k => res.find(r => r.nom === k);
    return { steps: [S("lc", L`L_c`, L`L_r - 0{,}50\,n_d`, lc, "m", 2), S("nv", L`n_v`, L`E\left(\dfrac{L_c}{3}\right)` + "\\quad(2\\text{ si } 5 \\le L_c < 6)", nv, "", 0), S("v", "v", L`L_c / n_v`, v, "m", 3), S("cl", "", "~classe du pont (art. 3)", cl, "", 0),
      S("bc1", "", "~levier, une file Bc contre le bord gauche", lev(xg + 1.25), "", 4), R("Ag", L`\eta_{A}`, "~poutre la plus chargée, A(l) (× A(l) · v par voie)", max(g("A(l)").bg.g, g("A(l)").bd.d), "", 4), R("Bcg", L`\eta_{Bc}`, "~Bc (× une file de deux camions)", max(g("Bc").bg.g, g("Bc").bd.d), "", 4)],
      tables: [{ title: "Coefficients maximaux à appliquer à une voie (ou file) de chaque système", head: ["système", "largeur (m)", "poutre gauche", "voies", "poutre droite", "voies"], rows: res.map(r => [r.nom, r.w, r.bg.g, r.bg.n, r.bd.d, r.bd.n]), d: [2, 4, 0, 4, 0] }],
      vals: { res, lc, nv, v, cl, x0, xg, xd, Bt: g("Bt") ? max(g("Bt").bg.g, g("Bt").bd.d) : null, Mc80: g("Mc80").bg.g, Mc120: g("Mc120").bg.g, Bc1: g("Bc").out[0].g / g("Bc").out[0].k, Bt1: g("Bt") ? g("Bt").out[0].g / g("Bt").out[0].k : null },
      notes: ["Règle du levier : le tablier est supposé infiniment souple transversalement entre les deux poutres (pièces de pont isostatiques) ; une charge d'excentricité e par rapport à l'axe des poutres donne $1/2 - e/l_p$ à la poutre gauche. Les voies ou files sont accolées contre le bord gauche, puis contre le bord droit, de la largeur chargeable ; Bc : files de 2,50 m, Bt : tandems de 3,00 m, Mc80 : 3,65 m hors tout, Mc120 : 4,30 m. Coefficients a1, bc et bt du fascicule 61 titre II."] };
  },
  fig(I, g, r) {
    const v = r.vals, W = 330, Hh = 175, span = v.xd - v.x0 + 1.5, k = 290 / max(span, I.lp + I.ec + 1), X = x => 20 + (x - v.x0) * k, yd = 110;
    let s = Rc(X(v.x0), yd, (v.xd - v.x0 + 1) * k, 8, { f: K.concrete || "#e8e2d5", c: "#9b8f78" });
    [-I.lp / 2, I.lp / 2].forEach(x => s += Rc(X(x) - 4, yd + 8, 8, 42, { f: K.steel, c: "#5a6f8e" }));
    s += dim(X(-I.lp / 2), X(I.lp / 2), yd + 62, `lp = ${f2(I.lp, 2)} m`) + dim(X(v.xg), X(v.xd), yd - 52, `Lc = ${f2(v.lc, 2)} m · ${v.nv} voies`);
    const bc = r.vals.res.find(x => x.nom === "Bc"), best = bc.bg; for (let i = 0; i < best.n; i++) { const xa = v.xg + i * 2.5 + 0.25, xb = xa + 2; s += arrow(X(xa), yd - 34, X(xa), yd - 2, K.red, 1.6) + arrow(X(xb), yd - 34, X(xb), yd - 2, K.red, 1.6); }
    s += T(X(v.xg), yd - 38, `Bc : ${best.n} file(s) contre le bord gauche → ${f2(best.g, 3)} sur la poutre gauche`, { s: 9, c: K.red });
    return svg(W, Hh, s); },
  clair: (I, g, r) => `La poutre la plus chargée reprend ${f2(g("Bcg"), 3)} file Bc et ${f2(g("Ag"), 3)} voie A(l) ; pont de classe ${r.vals.cl}, ${r.vals.nv} voies de ${f2(r.vals.v, 2)} m.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
