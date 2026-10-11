/* ════════════════════════════════════════════════════════════════════
   HandBag — Règlements anciens : répartition transversale sur bipoutre (classeur Biblio 2004 « Surchmix »)
   Fascicule 61 titre II (A(l), Bc, Bt, Mc80, Mc120), règle du levier entre deux poutres.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
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

HB.add("Règlements anciens", [
{ id: "anc-mixte-cisaillement-dalle", t: "Poutre mixte : cisaillement longitudinal de la dalle à l'ELS (circulaire 81-63)", ref: "Circulaire n° 81-63 du 28 juillet 1981 (ponts mixtes) — Biblio 2004 « To_mixt »",
  desc: "Contraintes de cisaillement dans les coupes A (gousset et dalle), B (dalle) et C (contour de la zone des connecteurs) d'une section mixte, armatures transversales nécessaires et glissement à l'interface.",
  inputs: [N("V", "Effort tranchant", "kN", 3000, "V"), H("Poutre métallique (mm)"), LST("pm", "h, bs × ts (sup.), tw, bi × ti (inf.)", "", "1500 500 45 26 600 40", ""),
    H("Dalle (cm)"), LST("dl", "Largeur, épaisseur ; gousset : largeur, hauteur", "", "300 27 80 5", ""), LST("zc", "Zone C des connecteurs : largeur, hauteur", "", "30 17", ""),
    N("fc", "Résistance du béton", "MPa", 30, L`f_{c28}`), N("n", "Coefficient d'équivalence", "", 18, "n"), N("fe", "Limite élastique des aciers", "MPa", 500, L`f_e`),
    SEL("arm", "Armatures longitudinales de la dalle", [["0", "négligées"], ["1", "prises en compte"], ["2", "prises en compte, au moins 1 % du béton"]], "0", ""),
    LST("as", "Armatures sup. et inf. : section (cm²), enrobage (cm)", "", "75 5 30 6", "")],
  calc(I) {
    const [hm, bs, ts, tw, bi, ti] = (I.pm || []).map(x => x / 1000), [bb, hb, br, hr] = (I.dl || []).map(x => x / 100), [bc, hc] = (I.zc || []).map(x => x / 100), [A1, c1, A2, c2] = (I.as || [0, 0, 0, 0]);
    if (!ti || !hr && hr !== 0 || !hc) throw new Error("dimensions incomplètes");
    const n = I.n, ac = br * hr + bb * hb;
    let As = 0, Ai = 0; if (I.arm !== "0") { As = A1 / 1e4; Ai = A2 / 1e4; if (I.arm === "2") { As = max(As, 2 / 300 * ac); Ai = max(Ai, 1 / 300 * ac); } }
    const ys = hm + hr + hb - c1 / 100, yi = hm + hr + c2 / 100;
    /* aire, moment statique et d'inertie (depuis la base de la poutre) d'un rectangle de largeur b entre z1 et z2 */
    const rq = (b, z1, z2, k = 1) => [b * (z2 - z1) / k, b * (z2 * z2 - z1 * z1) / 2 / k, b * (z2 ** 3 - z1 ** 3) / 3 / k];
    const add = (...rs) => rs.reduce((a, r) => [a[0] + r[0], a[1] + r[1], a[2] + r[2]], [0, 0, 0]);
    const ar = [As + Ai, As * ys + Ai * yi, As * ys * ys + Ai * yi * yi], be = add(rq(br, hm, hm + hr, n), rq(bb, hm + hr, hm + hr + hb, n)), st = add(rq(bi, 0, ti), rq(tw, ti, hm - ts), rq(bs, hm - ts, hm)), tot = add(ar, be, st);
    const y = tot[1] / tot[0], Ih = tot[2] - tot[0] * y * y, ft = I.fc <= 60 ? 0.6 + 0.06 * I.fc : 0.275 * I.fc ** (2 / 3), V = I.V / 1000;
    const wA = max(0, bb - bs) / 2, wB = max(0, bb - max(br, bs)) / 2;
    const cA = add([ar[0] * wA / bb, ar[1] * wA / bb, 0], rq(max(0, br - bs) / 2, hm, hm + hr, n), rq(wA, hm + hr, hm + hr + hb, n)), cB = add([ar[0] * wB / bb, ar[1] * wB / bb, 0], rq(wB, hm + hr, hm + hr + hb, n));
    const inC = z => (z - hc - hm) * (z - hm) <= 0, aS = As * (1 - (inC(ys) ? bc / bb : 0)), aI = Ai * (1 - (inC(yi) ? bc / bb : 0)), zC = rq(bc, hm, hm + hc, n);
    const cC = [aS + aI + be[0] - zC[0], aS * ys + aI * yi + be[1] - zC[1], 0];
    const cut = (c, b, legs) => { const m = c[1] - c[0] * y, tau = V * m / (Ih * b), At = tau * b / (2 / 3 * I.fe) * 1e4 / legs; return { m, b, tau, At }; };
    const A = cut(cA, (br > bs ? hr : 0) + hb, 1), B = cut(cB, hb, 1), Cc = cut(cC, 2 * hc + bc, 2), inf = max(A.At / 2, B.At / 2, Cc.At), sup = max(0, max(A.At, B.At) - inf), gl = V / Ih * (ar[1] + be[1] - y * (ar[0] + be[0])) * 1000;
    return { steps: [S("y", "y", "~axe neutre depuis la base de la poutre (section homogénéisée)", y, "m", 4), S("I", L`I_h`, "", Ih, "m⁴", 6), S("ft", L`f_{t28}`, L`0{,}6 + 0{,}06\,f_{c28}`, ft, "MPa", 2),
      H("Coupe A (gousset et dalle)"), S("mA", L`m_A`, "~moment statique de la partie extérieure", A.m, "m³", 6), R("tA", L`\tau_A`, L`\dfrac{V\,m_A}{I_h\,b_A}` + `\\quad b_A = ${fmt(A.b, 2).replace(",", "{,}")}\\ \\text{m}`, A.tau, "MPa", 3), S("AtA", L`A_{t,A}`, L`\dfrac{\tau_A\,b_A}{\tfrac{2}{3} f_e}`, A.At, "cm²/m", 2),
      H("Coupe B (dalle)"), S("mB", L`m_B`, "", B.m, "m³", 6), R("tB", L`\tau_B`, `~largeur de coupe ${fmt(B.b, 2)} m`, B.tau, "MPa", 3), S("AtB", L`A_{t,B}`, "", B.At, "cm²/m", 2),
      H("Coupe C (contour des connecteurs)"), S("mC", L`m_C`, "", Cc.m, "m³", 6), R("tC", L`\tau_C`, `~largeur de coupe 2 hc + bc = ${fmt(Cc.b, 2)} m`, Cc.tau, "MPa", 3), S("AtC", L`A_{t,C}`, L`\dfrac{\tau_C\,b_C}{2\cdot\tfrac{2}{3} f_e}` + "\\quad\\text{(deux brins)}", Cc.At, "cm²/m", 2),
      R("inf", L`A_{t,inf}`, L`\max\left(\tfrac{A_{t,A}}{2} ; \tfrac{A_{t,B}}{2} ; A_{t,C}\right)`, inf, "cm²/m", 2), R("sup", L`A_{t,sup}`, L`\max(A_{t,A} ; A_{t,B}) - A_{t,inf} \ge 0`, sup, "cm²/m", 2), S("gl", "g", L`\dfrac{V}{I_h}\,m_{dalle}` + "\\quad\\text{(glissement à l'interface)}", gl, "kN/m", 1)],
      checks: [C("$\\tau \\le f_{t28}$ dans les trois coupes", max(A.tau, B.tau, Cc.tau) <= ft, `${f2(max(A.tau, B.tau, Cc.tau), 2)} ≤ ${f2(ft, 2)} MPa`, max(A.tau, B.tau, Cc.tau) / ft)],
      vals: { hm, bs, ts, tw, bi, ti, bb, hb, br, hr, bc, hc, y, Ih, ft, A, B, Cc },
      notes: ["Section homogénéisée : béton divisé par n, armatures avec un coefficient de 1 (option du classeur « coefficient 1,05 » non retenue). Les coupes A et B sont menées d'un seul côté de la poutre (moitié extérieure) ; la coupe C entoure la zone des connecteurs (deux brins). Les armatures longitudinales sont supposées réparties uniformément dans la largeur de la dalle."] };
  },
  fig(I, g, r) { const v = r.vals, W = 330, Hh = 200, k = min(300 / v.bb, 150 / (v.hm + v.hr + v.hb)), cx = W / 2, Y = z => 185 - z * k, X = x => cx + x * k;
    let s = Rc(X(-v.bi / 2), Y(v.ti), v.bi * k, v.ti * k, { f: K.steel, c: "#5a6f8e" }) + Rc(X(-v.tw / 2), Y(v.hm - v.ts), max(1.5, v.tw * k), (v.hm - v.ts - v.ti) * k, { f: K.steel, c: "#5a6f8e" }) + Rc(X(-v.bs / 2), Y(v.hm), v.bs * k, v.ts * k, { f: K.steel, c: "#5a6f8e" });
    s += Rc(X(-v.br / 2), Y(v.hm + v.hr), v.br * k, v.hr * k, { f: "#e8e2d5", c: "#9b8f78" }) + Rc(X(-v.bb / 2), Y(v.hm + v.hr + v.hb), v.bb * k, v.hb * k, { f: "#e8e2d5", c: "#9b8f78" });
    const xa = X(v.bs / 2), xb = X(max(v.br, v.bs) / 2); s += P(`M${xa} ${Y(v.hm)}V${Y(v.hm + v.hr + v.hb) - 6}`, { c: K.red, w: 1.4, dash: "4 2" }) + T(xa - 3, Y(v.hm + v.hr + v.hb) - 9, "A", { a: "end", s: 9.5, c: K.red, w: 600 });
    s += P(`M${xb + 10} ${Y(v.hm + v.hr)}V${Y(v.hm + v.hr + v.hb) - 6}`, { c: K.blue, w: 1.4, dash: "4 2" }) + T(xb + 13, Y(v.hm + v.hr + v.hb) - 9, "B", { s: 9.5, c: K.blue, w: 600 });
    s += P(`M${X(-v.bc / 2)} ${Y(v.hm)}V${Y(v.hm + v.hc)}H${X(v.bc / 2)}V${Y(v.hm)}`, { c: K.gold, w: 1.4, dash: "4 2" }) + T(X(-v.bc / 2) - 3, Y(v.hm + v.hc) + 10, "C", { a: "end", s: 9.5, c: K.gold, w: 600 });
    s += P(`M${X(-v.bb / 2) - 6} ${Y(v.y)}H${X(v.bb / 2) + 6}`, { c: K.mute, w: .7, dash: "6 3" }) + T(X(v.bb / 2) + 2, Y(v.y) - 3, `y = ${f2(v.y, 3)} m`, { a: "end", s: 9, c: K.mute });
    return svg(W, Hh, s); },
  clair: (I, g) => `Il faut ${f2(g("inf"), 1)} cm²/m d'armatures transversales en nappe inférieure et ${f2(g("sup"), 1)} cm²/m en nappe supérieure ; le glissement à l'interface vaut ${f2(g("gl"), 0)} kN/m.` },
]);

/* section mixte bipoutre (poutre en I + gousset + dalle) : contraintes ELS avec béton tendu fissuré au-delà de ft */
function mixteELS(g, o) {
  const { hm, bs, ts, tw, bi, ti, bb, hb, br, hr, As, ys, Ai, yi } = g, n = o.n, na = o.na || 1, NS = 120;
  const steel = [[bi, 0, ti], [tw, ti, hm - ts], [bs, hm - ts, hm]], conc = []; [[br, hm, hm + hr], [bb, hm + hr, hm + hr + hb]].forEach(([b, z1, z2]) => { if (z2 > z1) for (let i = 0; i < NS; i++) { const a = z1 + (z2 - z1) * i / NS, c = z1 + (z2 - z1) * (i + 1) / NS; conc.push([b * (c - a), (a + c) / 2]); } });
  const bars = [[As, ys], [Ai, yi]];
  /* forces et moments (autour de yN) d'un état de contrainte σ(z) = a + b z (MPa, acier) */
  const res = (a, b, lin) => { let F = 0, M = 0, K = [[0, 0], [0, 0]], add = (A, z, f) => { const sg = (a + b * z) / f; if (lin && !lin(sg, f)) return; F += A * sg; M += A * sg * (z - o.yN); K[0][0] += A / f; K[0][1] += A * z / f; K[1][0] += A * (z - o.yN) / f; K[1][1] += A * z * (z - o.yN) / f; };
    steel.forEach(([w, z1, z2]) => { const A = w * (z2 - z1), zg = (z1 + z2) / 2, Iz = w * (z2 - z1) ** 3 / 12, s0 = a + b * zg; F += A * s0; M += A * s0 * (zg - o.yN) + b * Iz; K[0][0] += A; K[0][1] += A * zg; K[1][0] += A * (zg - o.yN); K[1][1] += A * zg * (zg - o.yN) + Iz; });
    conc.forEach(([A, z]) => add(A, z, n)); bars.forEach(([A, z]) => { if (!A) return; const sg = (a + b * z) / na; if ((sg >= 0 && o.barC) || (sg < 0 && o.barT)) add(A, z, na); });
    return { F, M, K }; };
  const ok = (sg) => o.noT ? sg >= 0 : sg >= -o.ft;
  let a = 0, b = 0, it = 0;
  for (; it < 200; it++) { const r = res(a, b, (sg, f) => f === n ? ok(sg) : true), d = r.K[0][0] * r.K[1][1] - r.K[0][1] * r.K[1][0];
    const fN = o.N - r.F, fM = o.M - r.M; if (abs(fN) < 1e-9 && abs(fM) < 1e-9 && it) break;
    const da = (fN * r.K[1][1] - r.K[0][1] * fM) / d, db = (r.K[0][0] * fM - r.K[1][0] * fN) / d; a += da; b += db; if (abs(da) + abs(db) < 1e-10) break; }
  const sg = z => a + b * z, cz = z => { const v = sg(z) / n; return ok(v) ? v : null; };
  return { a, b, it, sg, cz, y: b ? -a / b : null };
}
const SG_E = [[16, 355], [40, 345], [63, 335], [80, 325], [100, 315], [150, 295], [1e9, 295]];
const sgE = t => SG_E.find(r => t <= r[0])[1];

HB.add("Règlements anciens", [
{ id: "anc-mixte-els", t: "Poutre mixte : contraintes à l'ELS sous moment et effort normal (circulaire 81-63)", ref: "Circulaire n° 81-63 du 28 juillet 1981 (ponts mixtes) — Biblio 2004 « Ver_mixt », feuille Calcul ELS",
  desc: "Diagramme des contraintes d'une section mixte (poutre en I, gousset, dalle armée) sous un moment et un effort normal, le béton tendu au-delà de sa résistance à la traction étant négligé, et comparaison aux contraintes limites.",
  inputs: [N("M", "Moment (positif : fibre inférieure tendue)", "kN·m", 12000, "M"), N("N", "Effort normal (+ compression)", "kN", 0, "N"), N("yN", "Point d'application de N depuis la base", "m", 0, L`y_N`),
    H("Poutre métallique (mm)"), LST("pm", "h, bs × ts (sup.), tw, bi × ti (inf.)", "", "1500 500 45 26 600 40", ""),
    H("Dalle (cm)"), LST("dl", "Largeur, épaisseur ; gousset : largeur, hauteur", "", "300 27 80 5", ""), LST("as", "Armatures sup. et inf. : section (cm²), enrobage (cm)", "", "35.06 5 35.06 6", ""),
    SEL("min1", "Armatures au moins égales à 1 % du béton (2/3 sup., 1/3 inf.)", [["1", "oui"], ["0", "non"]], "1", ""), SEL("bt", "Béton tendu", [["ft", "pris en compte jusqu'à ft"], ["0", "entièrement négligé"]], "ft", ""),
    N("fc", "Résistance du béton", "MPa", 30, L`f_{c28}`), N("n", "Coefficient d'équivalence", "", 18, "n"), N("fe", "Limite élastique des armatures", "MPa", 500, L`f_e`)],
  calc(I) {
    const [hm, bs, ts, tw, bi, ti] = (I.pm || []).map(x => x / 1000), [bb, hb, br, hr] = (I.dl || []).map(x => x / 100), [A1, c1, A2, c2] = I.as || [0, 0, 0, 0]; if (!ti || !hb) throw new Error("dimensions incomplètes");
    const ac = bb * hb + br * hr; let As = A1 / 1e4, Ai = A2 / 1e4; if (I.min1 === "1") { As = max(As, 2 / 300 * ac); Ai = max(Ai, 1 / 300 * ac); }
    const g = { hm, bs, ts, tw, bi, ti, bb, hb, br, hr, As, Ai, ys: hm + hr + hb - c1 / 100, yi: hm + hr + c2 / 100 }, ft = I.fc <= 60 ? 0.6 + 0.06 * I.fc : 0.275 * I.fc ** (2 / 3);
    const r = mixteELS(g, { n: I.n, N: I.N / 1000, M: I.M / 1000, yN: I.yN, ft, noT: I.bt === "0", barC: true, barT: true }), z0 = hm + hr + hb;
    const sb = I.fe ? min(2 / 3 * I.fe, 240) : 240, lim = { s: sgE(ts * 1000) / 1.15, w: sgE(tw * 1000) / 1.15, i: sgE(ti * 1000) / 1.15, c: 0.6 * I.fc };
    const v = { cTop: r.cz(z0), cH: r.cz(hm), aS: r.sg(g.ys), aI: r.sg(g.yi), sS: abs(r.sg(hm)) >= abs(r.sg(hm - ts)) ? r.sg(hm) : r.sg(hm - ts), wH: r.sg(hm - ts), wB: r.sg(ti), sI: abs(r.sg(ti)) >= abs(r.sg(0)) ? r.sg(ti) : r.sg(0) };
    const fmtc = x => x == null ? "fissuré" : x;
    return { steps: [S("As", L`A_s\ ;\ A_i`, `~${fmt(Ai * 1e4, 2)} cm² en nappe inférieure`, As * 1e4, "cm²", 2), S("ft", L`f_{t28}`, L`0{,}6 + 0{,}06\,f_{c28}`, ft, "MPa", 2),
      R("s0", L`\sigma_0`, "~contrainte en pied de poutre (compression +)", r.a, "MPa", 2), S("k", "k", L`d\sigma/dz`, r.b, "MPa/m", 2), R("y", "y", L`-\sigma_0/k` + "\\quad\\text{(axe neutre depuis la base)}", r.y ?? 0, "m", 4),
      S("cTop", L`\sigma_{b,sup}`, L`\sigma(z_{sup})/n`, v.cTop ?? 0, "MPa", 3), S("cH", L`\sigma_{b,h}`, "~béton au niveau de la poutre", v.cH ?? 0, "MPa", 3), S("aS", L`\sigma_{a,sup}`, "~armatures supérieures", v.aS, "MPa", 2), S("aI", L`\sigma_{a,inf}`, "~armatures inférieures", v.aI, "MPa", 2),
      S("sS", L`\sigma_{ss}`, "~semelle supérieure", v.sS, "MPa", 2), S("wH", L`\sigma_{w,h}\ ;\ \sigma_{w,b}`, `~âme en haut ; en bas ${fmt(v.wB, 2)} MPa`, v.wH, "MPa", 2), R("sI", L`\sigma_{si}`, "~semelle inférieure", v.sI, "MPa", 2)],
      checks: [C(`Béton : $\\sigma_b \\le 0{,}6 f_{c28}$`, (v.cTop ?? 0) <= lim.c && (v.cH ?? 0) <= lim.c, `${f2(max(v.cTop ?? 0, v.cH ?? 0), 2)} ≤ ${f2(lim.c, 1)} MPa`, max(v.cTop ?? 0, v.cH ?? 0) / lim.c),
        C("Armatures : $|\\sigma_a| \\le \\min(2f_e/3 ; 240)$", max(abs(v.aS), abs(v.aI)) <= sb, `${f2(max(abs(v.aS), abs(v.aI)), 1)} ≤ ${f2(sb, 0)} MPa`, max(abs(v.aS), abs(v.aI)) / sb),
        (() => { const q = [abs(v.sS) / lim.s, max(abs(v.wH), abs(v.wB)) / lim.w, abs(v.sI) / lim.i], m = max(...q); return C("Acier : $|\\sigma| \\le \\sigma_e/1{,}15$ (semelles, âme)", m <= 1, `taux ${q.map(x => f2(x * 100, 0)).join(" ; ")} %`, m); })()],
      vals: { g, r: { a: r.a, b: r.b }, z0, ft, n: I.n, noT: I.bt === "0" },
      notes: [`Béton découpé en bandes, supprimé au-delà de ft en traction. Limites du classeur : acier σe/1,15 selon l'épaisseur, béton 0,6 fc28, armatures min(2/3 fe ; 240 MPa). Moment pris autour du point d'application de N.`] };
  },
  fig(I, g, r) { const v = r.vals, gg = v.g, W = 330, Hh = 200, zmax = v.z0, k = 165 / zmax, Y = z => 185 - z * k, sec = 120;
    let s = Rc(30, Y(gg.ti), 60, gg.ti * k, { f: K.steel, c: "#5a6f8e" }) + Rc(57, Y(gg.hm - gg.ts), 6, (gg.hm - gg.ts - gg.ti) * k, { f: K.steel, c: "#5a6f8e" }) + Rc(35, Y(gg.hm), 50, gg.ts * k, { f: K.steel, c: "#5a6f8e" }) + Rc(10, Y(v.z0), 100, gg.hb * k, { f: "#e8e2d5", c: "#9b8f78" }) + Rc(45, Y(gg.hm + gg.hr), 30, gg.hr * k, { f: "#e8e2d5", c: "#9b8f78" });
    const sa = z => v.r.a + v.r.b * z, smax = max(abs(sa(0)), abs(sa(gg.hm)), 1), X = x => 220 + x / smax * 90;
    s += P(`M220 ${Y(0)}V${Y(v.z0)}`, { c: K.ink, w: .8 }) + P(`M220 ${Y(0)}L${X(sa(0))} ${Y(0)}L${X(sa(gg.hm))} ${Y(gg.hm)}L220 ${Y(gg.hm)}Z`, { c: K.blue, f: K.blue, op: .15, w: 1.2 });
    const zc = []; for (let i = 0; i <= 40; i++) { const z = gg.hm + (v.z0 - gg.hm) * i / 40, c = sa(z) / v.n; zc.push([z, (v.noT ? c >= 0 : c >= -v.ft) ? c * v.n : 0]); }
    s += P(`M220 ${Y(gg.hm)}` + zc.map(([z, c]) => `L${X(c)} ${Y(z)}`).join("") + `L220 ${Y(v.z0)}Z`, { c: K.gold, f: K.gold, op: .25, w: 1.2 });
    if (r.vals.r.b) { const y = -v.r.a / v.r.b; if (y > 0 && y < v.z0) s += P(`M8 ${Y(y)}H320`, { c: K.red, w: .8, dash: "5 3" }) + T(318, Y(y) - 3, `y = ${f2(y, 3)} m`, { a: "end", s: 9, c: K.red }); }
    s += T(X(sa(0)), Y(0) + 12, `${f2(sa(0), 0)} MPa`, { a: "middle", s: 9, c: K.blue }) + T(225, 14, "acier (bleu) — béton × n (or)", { s: 9, c: K.mute });
    return svg(W, Hh, s); },
  clair: (I, g) => `Sous ce moment, la semelle inférieure travaille à ${f2(abs(g("sI")), 0)} MPa et le béton à ${f2(g("cTop"), 1)} MPa en fibre supérieure ; l'axe neutre est à ${f2(g("y"), 2)} m de la base.` },
]);

HB.add("Règlements anciens", [
{ id: "anc-mixte-elu", t: "Poutre mixte : moment limite ELU positif ou négatif (circulaire 81-63)", ref: "Circulaire n° 81-63 du 28 juillet 1981 (ponts mixtes) — Biblio 2004 « Ver_mixt », feuilles Calcul ELU positif et négatif",
  desc: "Moment résistant plastique d'une section mixte sous un effort normal donné : béton comprimé à 0,85 fc28/1,5, acier à σe/1,05, armatures à fe/1,15, recherche de l'axe neutre plastique.",
  inputs: [SEL("sg", "Sens du moment", [["1", "positif (fibre inférieure tendue)"], ["-1", "négatif (fibre supérieure tendue)"]], "1", ""), N("N", "Effort normal (+ compression)", "kN", 0, "N"), N("yN", "Point d'application de N depuis la base", "m", 0, L`y_N`),
    H("Poutre métallique (mm)"), LST("pm", "h, bs × ts (sup.), tw, bi × ti (inf.)", "", "1500 500 80 26 600 75", ""),
    H("Dalle (cm)"), LST("dl", "Largeur, épaisseur ; gousset : largeur, hauteur", "", "300 27 80 5", ""), LST("as", "Armatures sup. et inf. : section (cm²), enrobage (cm)", "", "75 5 30 6", ""),
    SEL("arT", "Armatures tendues", [["1", "prises en compte"], ["0", "négligées"]], "1", ""), SEL("arC", "Armatures comprimées", [["0", "négligées"], ["1", "prises en compte"]], "0", ""),
    N("fc", "Résistance du béton", "MPa", 30, L`f_{c28}`), N("fe", "Limite élastique des armatures", "MPa", 500, L`f_e`)],
  calc(I) {
    const [hm, bs, ts, tw, bi, ti] = (I.pm || []).map(x => x / 1000), [bb, hb, br, hr] = (I.dl || []).map(x => x / 100), [A1, c1, A2, c2] = I.as || [0, 0, 0, 0]; if (!ti || !hb) throw new Error("dimensions incomplètes");
    const sg = +I.sg, fb = 0.85 * I.fc / 1.5, fa = I.fe / 1.15, f = t => sgE(t * 1000) / 1.05;
    const pl = [[bi, 0, ti, f(ti)], [tw, ti, hm - ts, f(tw)], [bs, hm - ts, hm, f(ts)]], cc = [[br, hm, hm + hr], [bb, hm + hr, hm + hr + hb]], bars = [[A1 / 1e4, hm + hr + hb - c1 / 100], [A2 / 1e4, hm + hr + c2 / 100]];
    /* efforts (MN, compression +) et moment autour de yN pour un axe neutre plastique y */
    const st = y => { let F = 0, M = 0, parts = { b: 0, a: 0, s: 0 }; const seg = (w, z1, z2, fy, comp) => { if (z2 <= z1) return; const Fi = w * (z2 - z1) * fy * comp; F += Fi; M += Fi * ((z1 + z2) / 2 - I.yN); return Fi; };
      pl.forEach(([w, z1, z2, fy]) => { const up = seg(w, max(z1, y), z2, fy, sg) || 0, lo = seg(w, z1, min(z2, y), fy, -sg) || 0; parts.s += up + lo; });
      cc.forEach(([w, z1, z2]) => { parts.b += (sg > 0 ? seg(w, max(z1, y), z2, fb, 1) : seg(w, z1, min(z2, y), fb, 1)) || 0; });
      bars.forEach(([A, z]) => { if (!A) return; const comp = (z > y) === (sg > 0); if (comp ? I.arC === "1" : I.arT === "1") { const Fi = A * fa * (comp ? 1 : -1); F += Fi; M += Fi * (z - I.yN); parts.a += Fi; } });
      return { F, M, parts }; };
    const zt = hm + hr + hb, Nt = I.N / 1000; let a = 0, b = zt; const g0 = st(a).F - Nt, g1 = st(b).F - Nt; if (g0 * g1 > 0) throw new Error("effort normal hors du domaine plastique de la section");
    for (let i = 0; i < 100; i++) { const m = (a + b) / 2; ((st(m).F - Nt) * g0 > 0) ? a = m : b = m; } const y = (a + b) / 2, r = st(y);
    const Npl = pl.reduce((t, [w, z1, z2, fy]) => t + w * (z2 - z1) * fy, 0);
    return { steps: [S("fb", L`f_{bu}`, L`\dfrac{0{,}85\,f_{c28}}{1{,}5}`, fb, "MPa", 2), S("fs", L`\sigma_e/1{,}05`, `~semelles ${fmt(f(ts), 1)} et ${fmt(f(ti), 1)} MPa, âme`, f(tw), "MPa", 1), S("fa", L`f_e/1{,}15`, "", fa, "MPa", 1),
      S("Npl", L`N_{pl,a}`, "~résistance plastique de la poutre seule", Npl * 1000, "kN", 0), R("y", L`y_{pl}`, L`\textstyle\sum F_i = N` + "\\quad\\text{(axe neutre plastique depuis la base)}", y, "m", 4),
      S("Fb", L`F_b`, "~béton comprimé", r.parts.b * 1000, "kN", 0), S("Fa", L`F_a`, "~armatures", r.parts.a * 1000, "kN", 0), S("Fs", L`F_s`, "~poutre (compression − traction)", r.parts.s * 1000, "kN", 0),
      R("Mu", L`M_u`, L`\textstyle\sum F_i\,(z_i - y_N)`, r.M * 1000, "kN·m", 0)],
      vals: { y, sg, hm, ts, tw, ti, bs, bi, bb, hb, br, hr, zt }, notes: ["Diagramme rectangulaire : béton comprimé à 0,85 fc28/1,5 sur toute sa hauteur au-dessus (moment positif) de l'axe neutre plastique, béton tendu négligé, acier à σe/1,05 selon l'épaisseur des tôles (355 MPa jusqu'à 16 mm…), armatures à fe/1,15. Les feuilles ELU du classeur d'origine ne se calculaient plus (noms de cellules perdus) ; les formules en ont été reprises."] };
  },
  fig(I, g, r) { const v = r.vals, W = 330, Hh = 200, k = 170 / v.zt, Y = z => 190 - z * k;
    let s = Rc(40, Y(v.ti), 70, v.ti * k, { f: K.steel, c: "#5a6f8e" }) + Rc(72, Y(v.hm - v.ts), 6, (v.hm - v.ts - v.ti) * k, { f: K.steel, c: "#5a6f8e" }) + Rc(45, Y(v.hm), 60, v.ts * k, { f: K.steel, c: "#5a6f8e" }) + Rc(55, Y(v.hm + v.hr), 40, v.hr * k, { f: "#e8e2d5", c: "#9b8f78" }) + Rc(15, Y(v.zt), 120, v.hb * k, { f: "#e8e2d5", c: "#9b8f78" });
    const yy = Y(v.y), x0 = 215; s += P(`M8 ${yy}H322`, { c: K.red, w: 1, dash: "5 3" }) + T(140, yy - 4, `axe plastique ${f2(v.y, 3)} m`, { s: 9, c: K.red });
    const up = v.sg > 0; s += Rc(x0, Y(v.zt), 40, yy - Y(v.zt), { f: up ? K.blue : K.redL || "#f4d6d2", c: "none", op: .35 }) + Rc(x0 - 40, yy, 40, Y(0) - yy, { f: up ? K.redL || "#f4d6d2" : K.blue, c: "none", op: .35 });
    s += P(`M${x0} ${Y(0)}V${Y(v.zt)}`, { c: K.ink, w: .8 }) + T(x0 + 44, Y(v.zt) + 12, up ? "compression" : "traction", { s: 9, c: K.mute }) + T(x0 - 44, Y(0) - 4, up ? "traction" : "compression", { a: "end", s: 9, c: K.mute });
    return svg(W, Hh, s); },
  clair: (I, g) => `Le moment limite ${+I.sg > 0 ? "positif" : "négatif"} vaut ${f2(abs(g("Mu")), 0)} kN·m, avec un axe neutre plastique à ${f2(g("y"), 3)} m de la base.` },
]);

HB.add("Règlements anciens", [
{ id: "anc-mixte-predim", t: "Pont mixte : prédimensionnement des semelles d'une section (circulaire 81-63)", ref: "Circulaire n° 81-63 (ponts mixtes) — Biblio 2004 « DIM_MIXT » (macro de calcul des épaisseurs)",
  desc: "Épaisseurs minimales des semelles d'une poutre mixte, en travée (contraintes phasées acier seul, n = 18, n = 6) ou sur appui (section fissurée avec 1 % d'armatures), et poids de la charpente.",
  inputs: [SEL("ty", "Section", [["t", "travée (ELS, moment positif)"], ["a", "appui (ELU, moment négatif)"]], "t", ""), N("H", "Hauteur de la poutre métallique", "m", 2.4, "H"), N("b", "Largeur de dalle participante", "m", 7.4, "b"), N("e", "Épaisseur de dalle", "m", 0.33, "e"),
    N("a", "Épaisseur de l'âme", "m", 0.022, "a"), LST("lw", "Largeurs des semelles sup. et inf.", "m", "0.8 0.8", L`d\ w`),
    H("Moments (valeurs absolues, MN·m)"), N("Mpp", "Poids propre (charpente et dalle coulée)", "MN·m", 6.5, L`M_{pp}`), N("Mcp", "Permanentes de longue durée (n = 18)", "MN·m", 2.71, L`M_{cp}`), N("Msc", "Surcharges de courte durée (n = 6)", "MN·m", 12, L`M_{sc}`),
    N("el", "Élancement maximal des semelles b/t", "", 30, ""), N("fc", "Résistance du béton", "MPa", 30, L`f_{c28}`), N("fe", "Limite élastique des armatures", "MPa", 400, L`f_e`)],
  calc(I) {
    const [d, w] = I.lw || [], H0 = I.H, tr = I.ty === "t"; if (!w) throw new Error("largeurs des semelles à saisir");
    const Ab = I.b * I.e, A1 = 2 * Ab / 300, A2 = Ab / 300, z1 = H0 + I.e - 0.04, z2 = H0 + 0.04, zb = H0 + I.e / 2;
    /* caractéristiques (m, m², m⁴) depuis la base : semelle inf. r, semelle sup. t, âme, dalle/n, armatures */
    const car = (r, t, n, slab, bars) => { const P = [[w * r, r / 2, w * r ** 3 / 12], [I.a * (H0 - r - t), r + (H0 - r - t) / 2, I.a * (H0 - r - t) ** 3 / 12], [d * t, H0 - t / 2, d * t ** 3 / 12]];
      if (slab) P.push([Ab / n, zb, I.b * I.e ** 3 / 12 / n]); if (bars) P.push([A1, z1, 0], [A2, z2, 0]);
      const A = P.reduce((s, p) => s + p[0], 0), y = P.reduce((s, p) => s + p[0] * p[1], 0) / A, In = P.reduce((s, p) => s + p[2] + p[0] * (p[1] - y) ** 2, 0); return { A, y, I: In }; };
    const lim = t => sgE(t * 1000) / (tr ? 1.15 : 1);
    const stress = (r, t) => { const a0 = car(r, t, 1, false, false); let inf, sup, bet = 0, ar = 0;
      if (tr) { const a18 = car(r, t, 18, true, false), a6 = car(r, t, 6, true, false);
        inf = I.Mpp * a0.y / a0.I + I.Mcp * a18.y / a18.I + I.Msc * a6.y / a6.I; sup = I.Mpp * (H0 - a0.y) / a0.I + I.Mcp * (H0 - a18.y) / a18.I + I.Msc * (H0 - a6.y) / a6.I;
        bet = I.Mcp * (H0 + I.e - a18.y) / a18.I / 18 + I.Msc * (H0 + I.e - a6.y) / a6.I / 6; }
      else { const af = car(r, t, 1, false, true), Mc = I.Mcp + I.Msc; sup = I.Mpp * (H0 - a0.y) / a0.I + Mc * (H0 - af.y) / af.I; inf = I.Mpp * a0.y / a0.I + Mc * af.y / af.I; ar = Mc * (z1 - af.y) / af.I; }
      return { inf, sup, bet, ar, A: a0.A }; };
    const ok = (r, t) => { const q = stress(r, t); return q.inf <= lim(r) && q.sup <= lim(t) && (!tr || q.bet <= 0.6 * I.fc) && (tr || q.ar <= I.fe / 1.15); };
    let best = null; const r0 = Math.ceil(w / I.el * 1000 - 1e-9) / 1000, t0 = Math.ceil(d / I.el * 1000 - 1e-9) / 1000; for (let r = max(0.010, r0); r <= 0.1505; r += 0.001) for (let t = max(0.010, t0); t <= 0.1505; t += 0.001) { if (r + t >= H0) continue; if (ok(r, t)) { const A = stress(r, t).A; if (!best || A < best.A - 1e-12) best = { r, t, A }; break; } }
    if (!best) throw new Error("aucune paire d'épaisseurs ≤ 150 mm ne convient : augmenter la hauteur ou les largeurs");
    const q = stress(best.r, best.t), m = best.A * 7850;
    return { steps: [S("A1", L`A_{s}`, L`\dfrac{2}{3}\cdot 1\,\%\ b\,e` + "\\quad\\text{(et 1/3 en nappe inférieure)}", A1 * 1e4, "cm²", 0),
      R("ti", L`t_{inf}`, "~épaisseur minimale de la semelle inférieure", best.r * 1000, "mm", 0), R("ts", L`t_{sup}`, "~épaisseur minimale de la semelle supérieure", best.t * 1000, "mm", 0),
      S("si", L`\sigma_{inf}`, tr ? L`\dfrac{M_{pp}\,v_i}{I_a} + \dfrac{M_{cp}\,v_i}{I_{18}} + \dfrac{M_{sc}\,v_i}{I_6}` : L`\dfrac{M_{pp}\,v_i}{I_a} + \dfrac{(M_{cp} + M_{sc})\,v_i}{I_{fiss}}`, q.inf, "MPa", 1),
      S("ss", L`\sigma_{sup}`, "~même composition, fibre supérieure", q.sup, "MPa", 1), tr ? S("sb", L`\sigma_b`, L`\dfrac{M_{cp}\,v_b}{18\,I_{18}} + \dfrac{M_{sc}\,v_b}{6\,I_6}`, q.bet, "MPa", 2) : S("sa", L`\sigma_s`, "~armatures supérieures (section fissurée)", q.ar, "MPa", 1),
      S("lim", L`\sigma_e${tr ? "/1{,}15" : ""}`, "~semelle inférieure (selon l'épaisseur)", lim(best.r), "MPa", 1), R("m", "m", "~masse de la poutre métallique", m, "kg/m", 0)],
      checks: [C("Semelle inférieure", q.inf <= lim(best.r), `${f2(q.inf, 0)} ≤ ${f2(lim(best.r), 0)} MPa`, q.inf / lim(best.r)), C("Semelle supérieure", q.sup <= lim(best.t), `${f2(q.sup, 0)} ≤ ${f2(lim(best.t), 0)} MPa`, q.sup / lim(best.t)),
        tr ? C("Béton : $\\sigma_b \\le 0{,}6 f_{c28}$", q.bet <= 0.6 * I.fc, `${f2(q.bet, 2)} ≤ ${f2(0.6 * I.fc, 1)} MPa`, q.bet / (0.6 * I.fc)) : C("Armatures : $\\sigma_s \\le f_e/1{,}15$", q.ar <= I.fe / 1.15, `${f2(q.ar, 0)} ≤ ${f2(I.fe / 1.15, 0)} MPa`, q.ar / (I.fe / 1.15))],
      vals: { r: best.r, t: best.t, d, w, H0, b: I.b, e: I.e, a: I.a, q, ti: best.r * 1000, ts: best.t * 1000 },
      notes: ["Recherche, par pas de 1 mm, du couple d'épaisseurs de semelles de plus faible section d'acier respectant les contraintes limites : en travée, contraintes phasées (poids propre sur l'acier seul, permanentes sur n = 18, surcharges sur n = 6) limitées à σe/1,15 ; sur appui, poids propre sur l'acier seul et autres charges sur la section fissurée (acier + 1 % d'armatures en deux lits à 4 cm des faces), limitées à σe. Les semelles respectent l'élancement b/t imposé (voilement local). Armatures : 2/3 en nappe supérieure, 1/3 en nappe inférieure. La macro du classeur d'origine ne s'exécute plus ; le principe en a été repris."] };
  },
  fig(I, g, r) { const v = r.vals, W = 330, Hh = 200, k = min(150 / (v.H0 + v.e), 300 / v.b), cx = 165, Y = z => 190 - z * k, X = x => cx + x * k, ex = 3;
    let s = Rc(X(-v.w / 2), Y(v.r) , v.w * k, max(2, v.r * k * ex), { f: K.steel, c: "#5a6f8e" }) + Rc(X(-v.a / 2) - 1, Y(v.H0 - v.t), max(2, v.a * k), (v.H0 - v.t - v.r) * k, { f: K.steel, c: "#5a6f8e" }) + Rc(X(-v.d / 2), Y(v.H0), v.d * k, max(2, v.t * k * ex), { f: K.steel, c: "#5a6f8e" });
    s += Rc(X(-v.b / 2), Y(v.H0 + v.e), v.b * k, v.e * k, { f: "#e8e2d5", c: "#9b8f78" });
    s += T(X(v.w / 2) + 6, Y(0) - 2, `semelle inf. ${f2(v.ti, 0)} mm`, { s: 9.5, c: K.red, w: 600 }) + T(X(v.d / 2) + 6, Y(v.H0) + 10, `semelle sup. ${f2(v.ts, 0)} mm`, { s: 9.5, c: K.red, w: 600 }) + T(X(-v.b / 2), Y(v.H0 + v.e) - 6, "épaisseurs de semelles × 3 sur le croquis", { s: 8.5, c: K.mute });
    return svg(W, Hh, s); },
  clair: (I, g) => `Il faut au moins ${f2(g("ti"), 0)} mm de semelle inférieure et ${f2(g("ts"), 0)} mm de semelle supérieure, soit environ ${f2(g("m"), 0)} kg/m de poutre.` },
]);

HB.add("Actions sur les ponts", [
{ id: "act-bipoutre-superstructures", t: "Bipoutre : répartition transversale des superstructures (charges mini et maxi)", ref: "Règle du levier ; pondérations des superstructures (valeurs maxi et mini, par ex. NF EN 1991-1-1 AN : chaussée +40 % / −20 %) — Biblio 2004 « Cp_mix »",
  desc: "Charges permanentes de superstructures reprises par chacune des deux poutres d'un tablier bipoutre, en valeurs nominale, maximale et minimale, et moments transversaux dans la dalle.",
  inputs: [N("lp", "Entraxe des poutres", "m", 5.5, L`l_p`),
    LST("pt", "Charges linéiques : q (kN/m), coef. maxi, coef. mini, excentricité (m, + à droite), facultative (1/0) ; …", "", "10 1.05 0.95 -5.4 0 ; 6 1.05 0.95 -4.7 0 ; 10 1.05 0.95 -4.7 0 ; 0.3 1.05 0.95 5.4 0 ; 6.25 1.05 0.95 4 0 ; 12.2 1.05 0.95 4.2 0 ; 18.15 1.05 0.95 3.6 0 ; 0.7 1.05 0.95 4.7 0 ; 10 1 1 -5.4 1", "", { cols: 5 }),
    LST("rp", "Charges réparties : q (kN/m²), coef. maxi, coef. mini, abscisse début, abscisse fin (m) ; …", "", "0.44 1 1 -3 6 ; 1.92 1.4 0.8 -4 4 ; 0.66 1.4 0.8 -4 4 ; 7.5 1.03 0.97 -5 5", "", { cols: 5 })],
  calc(I) {
    const lp = I.lp, xg = -lp / 2, xd = lp / 2, loads = [];
    (I.pt || []).forEach(([q, kM, km, e, opt]) => loads.push({ F: q, kM, km, x: e, opt: !!opt, w: 0 }));
    (I.rp || []).forEach(([q, kM, km, a, b]) => loads.push({ F: q * abs(b - a), kM, km, x: (a + b) / 2, opt: false, w: abs(b - a), a: min(a, b), b: max(a, b), q }));
    if (!loads.length) throw new Error("charges à saisir");
    const cg = x => 0.5 - x / lp, sum = (f) => loads.reduce((t, l) => t + f(l), 0);
    /* valeur défavorable pour un effet de coefficient c : maxi si c > 0, mini sinon ; charge facultative supprimée si favorable */
    const pick = (l, c, worst) => { const up = (c >= 0) === worst; return l.opt ? (up ? l.F * l.kM : 0) : l.F * (up ? l.kM : l.km); };
    const nomT = sum(l => l.F), maxT = sum(l => l.F * l.kM), minT = sum(l => l.opt ? 0 : l.F * l.km);
    const gN = sum(l => l.F * cg(l.x)), gM = sum(l => pick(l, cg(l.x), true) * cg(l.x)), gm = sum(l => pick(l, cg(l.x), false) * cg(l.x));
    const dN = sum(l => l.F * (1 - cg(l.x))), dM = sum(l => pick(l, 1 - cg(l.x), true) * (1 - cg(l.x))), dm = sum(l => pick(l, 1 - cg(l.x), false) * (1 - cg(l.x)));
    /* moments transversaux (kN·m/m) : chaque charge répartie découpée en 400 éléments */
    const pts = []; loads.forEach(l => { if (!l.w) pts.push([l.x, l]); else for (let i = 0; i < 400; i++) pts.push([l.a + (i + 0.5) * l.w / 400, l, 1 / 400]); });
    const force = (p, mode) => { const [x, l, f = 1] = p; const v = mode === "max" ? (l.opt ? l.F * l.kM : l.F * l.kM) : mode === "min" ? (l.opt ? 0 : l.F * l.km) : l.F; return v * f; };
    const Mcons = (mode, side) => -pts.filter(p => side < 0 ? p[0] < xg : p[0] > xd).reduce((t, p) => t + force(p, mode) * abs(p[0] - (side < 0 ? xg : xd)), 0);
    const Mspan = () => { let best = -1e9, xb = 0; for (let k = 0; k <= 100; k++) { const x = xg + lp * k / 100, md = q => q[0] > xg && q[0] < xd ? "max" : "min";
        const Rg = pts.reduce((t, q) => t + force(q, md(q)) * (xd - q[0]), 0) / lp, M = Rg * (x - xg) - pts.filter(q => q[0] < x).reduce((t, q) => t + force(q, md(q)) * (x - q[0]), 0); if (M > best) { best = M; xb = x; } } return [best, xb]; };
    const [Ms, xs] = Mspan(), Mg = Mcons("max", -1), Md = Mcons("max", 1);
    return { steps: [S("nomT", L`q_{tot}`, "~nominale (maxi ; mini dans le tableau)", nomT, "kN/m", 2), S("maxT", L`q_{tot,max}`, "", maxT, "kN/m", 2), S("minT", L`q_{tot,min}`, "", minT, "kN/m", 2),
      R("gM", L`q_{g,max}`, L`\textstyle\sum q_i\,k_i\left(\tfrac{1}{2} - \tfrac{e_i}{l_p}\right)` + "\\quad\\text{(coefficients défavorables)}", gM, "kN/m", 2), S("gm", L`q_{g,min}`, "", gm, "kN/m", 2),
      R("dM", L`q_{d,max}`, L`\textstyle\sum q_i\,k_i\left(\tfrac{1}{2} + \tfrac{e_i}{l_p}\right)`, dM, "kN/m", 2), S("dm", L`q_{d,min}`, "", dm, "kN/m", 2),
      S("Mg", L`M_{cons,g}`, "~dalle au droit de la poutre gauche (charges maxi)", Mg, "kN·m/m", 2), S("Md", L`M_{cons,d}`, "~au droit de la poutre droite", Md, "kN·m/m", 2), S("Ms", L`M_{trav}`, `~maximum entre poutres (en x = ${fmt(xs, 2)} m)`, Ms, "kN·m/m", 2)],
      tables: [{ title: "Charges par poutre (kN/m)", head: ["", "nominal", "maximal", "minimal"], rows: [["ensemble", nomT, maxT, minT], ["poutre gauche", gN, gM, gm], ["poutre droite", dN, dM, dm]], d: [2, 2, 2] }],
      vals: { lp, loads, gN, dN, nomT, maxT, minT },
      notes: ["Règle du levier entre les deux poutres (dalle articulée sur les poutres). Pour chaque poutre, chaque charge prend son coefficient maxi si elle charge la poutre et son coefficient mini sinon ; une charge facultative (caniveau rempli ou non…) n'est retenue que si elle est défavorable. Moment en travée : charges entre poutres au maxi, charges des encorbellements au mini. Le classeur d'origine ne se calculait plus (noms de cellules perdus)."] };
  },
  fig(I, g, r) { const v = r.vals, xs = v.loads.flatMap(l => l.w ? [l.a, l.b] : [l.x]), x0 = min(...xs, -v.lp / 2) - 0.3, x1 = max(...xs, v.lp / 2) + 0.3, W = 330, k = 300 / (x1 - x0), X = x => 15 + (x - x0) * k, yd = 120;
    let s = Rc(X(x0), yd, (x1 - x0) * k, 8, { f: "#e8e2d5", c: "#9b8f78" }); [-v.lp / 2, v.lp / 2].forEach(x => s += Rc(X(x) - 4, yd + 8, 8, 40, { f: K.steel, c: "#5a6f8e" }));
    const qm = max(...v.loads.map(l => l.w ? l.q : l.F / 2), 1); v.loads.forEach((l, i) => { if (l.w) s += Rc(X(l.a), yd - 6 - 40 * l.q / qm, l.w * k, 40 * l.q / qm, { f: K.gold, c: "none", op: .25 }); else s += P(`M${X(l.x)} ${yd - 4 - 50 * l.F / 2 / qm}V${yd - 2}`, { c: l.opt ? K.blue : K.red, w: 1.6 }) + P(`M${X(l.x) - 3} ${yd - 7}L${X(l.x)} ${yd - 2}L${X(l.x) + 3} ${yd - 7}`, { c: l.opt ? K.blue : K.red, w: 1.4 }); });
    s += T(X(-v.lp / 2), yd + 62, `gauche : ${f2(v.gN, 1)} kN/m`, { a: "middle", s: 9.5, w: 600 }) + T(X(v.lp / 2), yd + 62, `droite : ${f2(v.dN, 1)} kN/m`, { a: "middle", s: 9.5, w: 600 }) + T(15, 18, "charges linéiques (rouge ; bleu : facultatives) et réparties (or)", { s: 8.5, c: K.mute });
    return svg(W, 195, s); },
  clair: (I, g) => `La poutre gauche reçoit de ${f2(g("gm"), 1)} à ${f2(g("gM"), 1)} kN/m de superstructures, la poutre droite de ${f2(g("dm"), 1)} à ${f2(g("dM"), 1)} kN/m.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
