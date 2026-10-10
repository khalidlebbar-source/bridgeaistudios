/* ════════════════════════════════════════════════════════════════════
   HandBag — RDM et formulaire (poutres, sections, plaques, arcs, câbles)
   Unités : m, kN, kN/m, kN·m ; EI en MN·m² ; flèches en mm.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, gauge, udl, pin, roller, ground } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d);
const EIin = (v = 1.2e4) => N("EI", "Rigidité de flexion", "MN·m²", v, "EI");

/* poutre continue : moments sur appuis par l'équation des trois moments (q uniforme par travée, EI constant) */
function threeMoments(Ls, qs) {
  const n = Ls.length - 1; if (n < 1) return [0, 0];
  const A = [], B = [];
  for (let i = 1; i <= n; i++) { const row = new Array(n).fill(0); row[i - 1] = 2 * (Ls[i - 1] + Ls[i]); if (i > 1) row[i - 2] = Ls[i - 1]; if (i < n) row[i] = Ls[i]; A.push(row); B.push(-(qs[i - 1] * Ls[i - 1] ** 3 + qs[i] * Ls[i] ** 3) / 4); }
  for (let i = 0; i < n; i++) { for (let j = i + 1; j < n; j++) { const f = A[j][i] / A[i][i]; for (let k = i; k < n; k++) A[j][k] -= f * A[i][k]; B[j] -= f * B[i]; } }
  const M = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = B[i]; for (let k = i + 1; k < n; k++) s -= A[i][k] * M[k]; M[i] = s / A[i][i]; }
  return [0, ...M, 0];
}
function contMoment(Ls, qs, Ms, x) { let x0 = 0; for (let i = 0; i < Ls.length; i++) { if (x <= x0 + Ls[i] + 1e-9) { const t = x - x0; return qs[i] * t * (Ls[i] - t) / 2 + Ms[i] * (1 - t / Ls[i]) + Ms[i + 1] * t / Ls[i]; } x0 += Ls[i]; } return 0; }
function contFig(Ls, qs, Ms, lab) {
  const Lt = Ls.reduce((a, b) => a + b, 0), sup = [0]; Ls.forEach(l => sup.push(sup.at(-1) + l));
  const marks = [], f = x => contMoment(Ls, qs, Ms, x); sup.slice(1, -1).forEach(x => marks.push({ x, l: f2(f(x), 0) }));
  let x0 = 0; Ls.forEach((l, i) => { const t = min(l, max(0, l / 2 + (Ms[i + 1] - Ms[i]) / (qs[i] * l || 1))); marks.push({ x: x0 + t, l: f2(f(x0 + t), 0) }); x0 += l; });
  return KIT.beamDiag({ L: Lt, sup, f, marks, label: lab || "moment fléchissant (kN·m)", span: Ls.map(l => f2(l, 1)).join(" + ") + " m" });
}

HB.add("RDM et formulaire", [

{ id: "rdm-isostatique", t: "Poutre isostatique : charge répartie et charge ponctuelle", ref: "Formulaire de RDM — poutre sur deux appuis simples",
  desc: "Réactions, effort tranchant, moment maximal et flèche d'une poutre sur deux appuis sous charge uniforme et charge concentrée.",
  inputs: [N("L", "Portée", "m", 20, "L"), N("q", "Charge répartie", "kN/m", 45, "q"), N("P", "Charge ponctuelle", "kN", 300, "P"), N("a", "Position de la charge ponctuelle", "m", 8, "a"), EIin()],
  calc(I) {
    const b = I.L - I.a, RA = I.q * I.L / 2 + I.P * b / I.L, RB = I.q * I.L / 2 + I.P * I.a / I.L, M = x => RA * x - I.q * x * x / 2 - (x > I.a ? I.P * (x - I.a) : 0);
    let xm = 0, Mm = -1e99; for (let i = 0; i <= 400; i++) { const x = I.L * i / 400, v = M(x); if (v > Mm) { Mm = v; xm = x; } }
    const EI = I.EI * 1000, fq = 5 * I.q * I.L ** 4 / (384 * EI) * 1000, fp = (I.a <= I.L / 2 ? I.P * I.a * (3 * I.L * I.L - 4 * I.a * I.a) / (48 * EI) : I.P * b * (3 * I.L * I.L - 4 * b * b) / (48 * EI)) * 1000;
    return { steps: [S("RA", L`R_A`, L`\dfrac{qL}{2} + P\,\dfrac{L - a}{L}`, RA, "kN", 1), S("RB", L`R_B`, L`\dfrac{qL}{2} + P\,\dfrac{a}{L}`, RB, "kN", 1), R("V", L`V_{max}`, L`\max(R_A ; R_B)`, max(RA, RB), "kN", 1),
      S("xm", L`x_{M}`, "~abscisse du moment maximal", xm, "m", 2), R("M", L`M_{max}`, L`\max_x\left[R_A x - \dfrac{q x^2}{2} - P\,\langle x - a\rangle\right]`, Mm, "kN·m", 1),
      S("fq", L`f_q`, L`\dfrac{5\,q\,L^4}{384\,EI}`, fq, "mm", 1), S("fp", L`f_P`, L`\dfrac{P\,a\,(3L^2 - 4a^2)}{48\,EI}\ \ (a \le L/2)`, fp, "mm", 1), R("f", L`f_{L/2}`, L`f_q + f_P`, fq + fp, "mm", 1)],
      notes: ["Flèche calculée à mi-portée (voisine de la flèche maximale). Pour une charge concentrée au-delà de mi-portée, la formule est appliquée avec $b = L - a$ par symétrie."] };
  },
  fig(I, g) { const RA = g("RA"), M = x => RA * x - I.q * x * x / 2 - (x > I.a ? I.P * (x - I.a) : 0); return KIT.beamDiag({ L: I.L, q: `q = ${f2(I.q, 0)} kN/m`, loads: [{ x: I.a, l: `P = ${f2(I.P, 0)} kN` }], f: M, marks: [{ x: g("xm"), l: `${f2(g("M"), 0)} kN·m` }] }); },
  clair: (I, g) => `La poutre est le plus sollicitée à ${f2(g("xm"), 1)} m de l'appui gauche (${f2(g("M"), 0)} kN·m) ; elle fléchit d'environ ${f2(g("f"), 0)} mm au milieu.` },

{ id: "rdm-console", t: "Console : charge répartie et charge en bout", ref: "Formulaire de RDM — poutre encastrée à une extrémité",
  desc: "Moment et effort tranchant à l'encastrement, flèche et rotation à l'extrémité libre.",
  inputs: [N("L", "Longueur", "m", 4, "L"), N("q", "Charge répartie", "kN/m", 20, "q"), N("P", "Charge en bout", "kN", 50, "P"), EIin(400)],
  calc(I) {
    const EI = I.EI * 1000, M = I.q * I.L ** 2 / 2 + I.P * I.L, V = I.q * I.L + I.P, f = (I.q * I.L ** 4 / (8 * EI) + I.P * I.L ** 3 / (3 * EI)) * 1000, th = I.q * I.L ** 3 / (6 * EI) + I.P * I.L ** 2 / (2 * EI);
    return { steps: [R("M", L`M_{enc}`, L`\dfrac{q L^2}{2} + P L`, M, "kN·m", 1), R("V", L`V_{enc}`, L`q L + P`, V, "kN", 1), R("f", L`f_{bout}`, L`\dfrac{q L^4}{8\,EI} + \dfrac{P L^3}{3\,EI}`, f, "mm", 2), S("th", L`\theta_{bout}`, L`\dfrac{q L^3}{6\,EI} + \dfrac{P L^2}{2\,EI}`, th * 1000, "mrad", 3)] };
  },
  fig(I, g) {
    const W = 330, Hh = 170, x0 = 50, x1 = 300, y = 50; let s = Rc(30, 20, 20, 70, { f: K.concD, c: K.ink }) + P(`M${x0} ${y}H${x1}`, { c: K.ink, w: 3 }) + udl(x0, x1, y - 3, 12, K.red, 14) + arrow(x1, y - 36, x1, y - 4, K.red, 2) + T(x1 - 4, y - 38, `P = ${f2(I.P, 0)} kN`, { a: "end", s: 9.5, c: K.red });
    s += P(`M${x0} ${y}Q${(x0 + x1) / 2} ${y + 6} ${x1} ${y + 26}`, { c: K.gold, w: 1.6, dash: "5 3" }) + T(x1 - 4, y + 40, `f = ${f2(g("f"), 1)} mm`, { a: "end", s: 9.5, c: K.gold });
    s += P(`M${x0} 130L${x0} ${130 - 28}Q${(x0 + x1) / 2} 128 ${x1} 130Z`, { c: K.gold, f: K.goldL, op: .6 }) + T(x0 + 4, 98, `M = ${f2(g("M"), 0)} kN·m`, { s: 9.5, w: 500 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La console est maximalement sollicitée à l'encastrement (${f2(g("M"), 0)} kN·m) ; son extrémité descend de ${f2(g("f"), 1)} mm.` },

{ id: "rdm-encastree", t: "Poutre bi-encastrée", ref: "Formulaire de RDM — poutre encastrée à ses deux extrémités",
  desc: "Moments d'encastrement et en travée, flèche d'une poutre parfaitement encastrée sous charge répartie et charge centrée.",
  inputs: [N("L", "Portée", "m", 12, "L"), N("q", "Charge répartie", "kN/m", 60, "q"), N("P", "Charge concentrée centrée", "kN", 200, "P"), EIin(3000)],
  calc(I) {
    const EI = I.EI * 1000, Ma = -(I.q * I.L ** 2 / 12 + I.P * I.L / 8), Mt = I.q * I.L ** 2 / 24 + I.P * I.L / 8, f = (I.q * I.L ** 4 / (384 * EI) + I.P * I.L ** 3 / (192 * EI)) * 1000;
    return { steps: [R("Ma", L`M_{app}`, L`-\left(\dfrac{q L^2}{12} + \dfrac{P L}{8}\right)`, Ma, "kN·m", 1), R("Mt", L`M_{trav}`, L`\dfrac{q L^2}{24} + \dfrac{P L}{8}`, Mt, "kN·m", 1),
      S("V", L`V`, L`\dfrac{q L + P}{2}`, (I.q * I.L + I.P) / 2, "kN", 1), R("f", L`f_{max}`, L`\dfrac{q L^4}{384\,EI} + \dfrac{P L^3}{192\,EI}`, f, "mm", 2), S("ratio", "", "~flèche / flèche isostatique (charge répartie)", 1 / 5, "", 2)] };
  },
  fig(I, g) { return KIT.beamDiag({ L: I.L, q: `q = ${f2(I.q, 0)} kN/m`, loads: [{ x: I.L / 2, l: `P` }], fix: [0, I.L], f: x => g("Ma") + (I.q * I.L / 2 + I.P / 2) * x - I.q * x * x / 2 - (x > I.L / 2 ? I.P * (x - I.L / 2) : 0), marks: [{ x: 0.0001, l: f2(g("Ma"), 0) }, { x: I.L / 2, l: f2(g("Mt"), 0) }] }); },
  clair: (I, g) => `Encastrée aux deux bouts, la poutre reporte l'essentiel du moment sur ses appuis (${f2(abs(g("Ma")), 0)} kN·m) et ne garde que ${f2(g("Mt"), 0)} kN·m en travée.` },

{ id: "rdm-continue-2", t: "Poutre continue à deux travées", ref: "Équation des trois moments (Clapeyron) — inertie constante",
  desc: "Moment sur appui intermédiaire, réactions et moments maximaux en travée d'une poutre continue à deux travées inégales sous charges réparties.",
  inputs: [N("L1", "Portée 1", "m", 30, L`L_1`), N("L2", "Portée 2", "m", 40, L`L_2`), N("q1", "Charge sur la travée 1", "kN/m", 150, L`q_1`), N("q2", "Charge sur la travée 2", "kN/m", 150, L`q_2`)],
  calc(I) {
    const Ls = [I.L1, I.L2], qs = [I.q1, I.q2], Ms = threeMoments(Ls, qs), MB = Ms[1], RA = I.q1 * I.L1 / 2 + MB / I.L1, RC = I.q2 * I.L2 / 2 + MB / I.L2, RB = I.q1 * I.L1 + I.q2 * I.L2 - RA - RC;
    const M1 = RA * RA / (2 * I.q1), M2 = RC * RC / (2 * I.q2);
    return { steps: [R("MB", L`M_B`, L`-\dfrac{q_1 L_1^3 + q_2 L_2^3}{8\,(L_1 + L_2)}`, MB, "kN·m", 0), S("RA", L`R_A`, L`\dfrac{q_1 L_1}{2} + \dfrac{M_B}{L_1}`, RA, "kN", 0), R("RB", L`R_B`, L`\sum q_i L_i - R_A - R_C`, RB, "kN", 0),
      S("RC", L`R_C`, L`\dfrac{q_2 L_2}{2} + \dfrac{M_B}{L_2}`, RC, "kN", 0), R("M1", L`M_{1,max}`, L`\dfrac{R_A^2}{2\,q_1}`, M1, "kN·m", 0), R("M2", L`M_{2,max}`, L`\dfrac{R_C^2}{2\,q_2}`, M2, "kN·m", 0)],
      notes: ["Pour les effets les plus défavorables du trafic, charger alternativement les travées (lignes d'influence). Inertie constante ; une variation d'inertie (poutre à hauteur variable) modifie la répartition."] };
  },
  fig(I, g) { const Ls = [I.L1, I.L2], qs = [I.q1, I.q2]; return contFig(Ls, qs, threeMoments(Ls, qs)); },
  clair: (I, g) => `La continuité crée ${f2(abs(g("MB")), 0)} kN·m de moment négatif sur la pile, et soulage les travées (${f2(g("M1"), 0)} et ${f2(g("M2"), 0)} kN·m au lieu de ${f2(I.q1 * I.L1 ** 2 / 8, 0)} et ${f2(I.q2 * I.L2 ** 2 / 8, 0)}).` },

{ id: "rdm-continue-3", t: "Poutre continue à trois travées", ref: "Équation des trois moments (Clapeyron) — résolution du système à deux inconnues",
  desc: "Moments sur les deux appuis intermédiaires et moments en travée d'un tablier continu à trois travées, charges réparties par travée.",
  inputs: [N("L1", "Travée de rive 1", "m", 30, L`L_1`), N("L2", "Travée centrale", "m", 45, L`L_2`), N("L3", "Travée de rive 2", "m", 30, L`L_3`),
    N("q1", "Charge travée 1", "kN/m", 180, L`q_1`), N("q2", "Charge travée 2", "kN/m", 180, L`q_2`), N("q3", "Charge travée 3", "kN/m", 180, L`q_3`)],
  calc(I) {
    const Ls = [I.L1, I.L2, I.L3], qs = [I.q1, I.q2, I.q3], Ms = threeMoments(Ls, qs), m = (i, t) => qs[i] * t * (Ls[i] - t) / 2 + Ms[i] * (1 - t / Ls[i]) + Ms[i + 1] * t / Ls[i];
    const mx = i => { const t = min(Ls[i], max(0, Ls[i] / 2 + (Ms[i + 1] - Ms[i]) / (qs[i] * Ls[i]))); return m(i, t); };
    return { steps: [S("eq", "", L`L_{i}M_{i-1} + 2(L_i + L_{i+1})M_i + L_{i+1}M_{i+1} = -\dfrac{q_i L_i^3 + q_{i+1}L_{i+1}^3}{4}`, "", "", 0),
      R("MB", L`M_B`, "~résolution du système", Ms[1], "kN·m", 0), R("MC", L`M_C`, "", Ms[2], "kN·m", 0), S("M1", L`M_{1,max}`, "", mx(0), "kN·m", 0), R("M2", L`M_{2,max}`, "", mx(1), "kN·m", 0), S("M3", L`M_{3,max}`, "", mx(2), "kN·m", 0),
      S("RA", L`R_A`, L`\dfrac{q_1 L_1}{2} + \dfrac{M_B}{L_1}`, qs[0] * Ls[0] / 2 + Ms[1] / Ls[0], "kN", 0)],
      notes: ["Proportions usuelles d'un pont à trois travées : travées de rive de 0,6 à 0,8 fois la travée centrale. Charges réparties par travée : combiner les cas de charge (travées alternées) pour les enveloppes de trafic."] };
  },
  fig(I, g) { const Ls = [I.L1, I.L2, I.L3], qs = [I.q1, I.q2, I.q3]; return contFig(Ls, qs, threeMoments(Ls, qs)); },
  clair: (I, g) => `Sur les piles, le moment vaut ${f2(g("MB"), 0)} et ${f2(g("MC"), 0)} kN·m ; au milieu de la travée centrale, ${f2(g("M2"), 0)} kN·m.` },

{ id: "rdm-section-t", t: "Caractéristiques d'une section en T ou en I (béton)", ref: "Formulaire de RDM — section composée de rectangles",
  desc: "Aire, centre de gravité, inertie, rendement et modules de résistance d'une poutre béton en T, en I ou en double T.",
  inputs: [N("bs", "Largeur de la table supérieure", "m", 2.5, L`b_s`), N("hs", "Épaisseur de la table", "m", 0.2, L`h_s`), N("bw", "Largeur de l'âme", "m", 0.3, L`b_w`), N("h", "Hauteur totale", "m", 1.6, "h"),
    N("bi", "Largeur du talon (0 si aucun)", "m", 0.7, L`b_i`), N("hi", "Hauteur du talon", "m", 0.25, L`h_i`)],
  calc(I) {
    const parts = [[I.bs, I.hs, I.hs / 2], [I.bw, I.h - I.hs - I.hi, I.hs + (I.h - I.hs - I.hi) / 2], [max(I.bi, I.bw), I.hi, I.h - I.hi / 2]];
    const A = parts.reduce((s, p) => s + p[0] * p[1], 0), v = parts.reduce((s, p) => s + p[0] * p[1] * p[2], 0) / A, In = parts.reduce((s, p) => s + p[0] * p[1] ** 3 / 12 + p[0] * p[1] * (p[2] - v) ** 2, 0), vp = I.h - v;
    return { steps: [R("A", "B", L`\textstyle\sum b_i h_i`, A, "m²", 4), R("v", "v", "~centre de gravité depuis la fibre supérieure", v, "m", 4), S("vp", L`v'`, L`h - v`, vp, "m", 4), R("I", "I", L`\textstyle\sum\left(\dfrac{b_i h_i^3}{12} + b_i h_i\,d_i^2\right)`, In, "m⁴", 5),
      S("Ws", L`I/v`, "", In / v, "m³", 4), S("Wi", L`I/v'`, "", In / vp, "m³", 4), S("rho", L`\rho`, L`\dfrac{I}{B\,v\,v'}`, In / (A * v * vp), "", 4), S("i", "i", L`\sqrt{I/B}`, sqrt(In / A), "m", 3), S("g", "g", L`25\,B`, 25 * A, "kN/m", 2)],
      notes: ["Caractéristiques de la section brute (béton seul). Pour une section précontrainte, déduire les gaines (section nette) avant mise en tension et homogénéiser les câbles injectés ensuite."] };
  },
  fig(I, g) {
    const W = 330, Hh = 175, top = 14, k = min(150 / I.h, 200 / max(I.bs, I.bi)), cx = 120, X = x => cx + x * k, Y = y => top + y * k; let s = Rc(X(-I.bs / 2), Y(0), I.bs * k, I.hs * k) + Rc(X(-I.bw / 2), Y(I.hs) - .5, I.bw * k, (I.h - I.hs - I.hi) * k + 1);
    if (I.bi > 0 && I.hi > 0) s += Rc(X(-I.bi / 2), Y(I.h - I.hi), I.bi * k, I.hi * k);
    s += P(`M${X(-I.bs / 2) - 6} ${Y(g("v"))}H${X(I.bs / 2) + 6}`, { c: K.blue, dash: "4 3" }) + T(X(I.bs / 2) + 8, Y(g("v")) + 3, "G", { s: 9.5, c: K.blue, w: 500 }) + dimV(X(max(I.bw, I.bi) / 2) + 14, Y(0), Y(g("v")), `v = ${f2(g("v"), 3)}`, K.mute, 1) + dimV(X(max(I.bw, I.bi) / 2) + 14, Y(g("v")), Y(I.h), `v' = ${f2(g("vp"), 3)}`, K.mute, 1);
    s += T(W - 8, Hh - 22, `ρ = ${f2(g("rho"), 3)}`, { a: "end", s: 10, w: 500 }) + T(W - 8, Hh - 8, `I = ${f2(g("I"), 4)} m⁴`, { a: "end", s: 9.5 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Cette poutre pèse ${f2(g("g"), 1)} kN/m ; son centre de gravité est à ${f2(g("v"), 2)} m sous le dessus et son rendement vaut ${f2(g("rho"), 2)}.` },

{ id: "rdm-section-circ", t: "Caractéristiques d'une section circulaire pleine ou creuse", ref: "Formulaire de RDM — couronne circulaire",
  desc: "Aire, inertie de flexion, module de résistance, rayon de giration et inertie de torsion d'un fût ou d'un pieu circulaire.",
  inputs: [N("D", "Diamètre extérieur", "m", 2.0, "D"), N("e", "Épaisseur (0 = section pleine)", "m", 0.35, "e")],
  calc(I) {
    const Di = I.e > 0 ? max(0, I.D - 2 * I.e) : 0, A = PI * (I.D ** 2 - Di ** 2) / 4, In = PI * (I.D ** 4 - Di ** 4) / 64;
    return { steps: [S("Di", L`D_i`, L`D - 2\,e`, Di, "m", 3), R("A", "A", L`\dfrac{\pi\,(D^2 - D_i^2)}{4}`, A, "m²", 4), R("I", "I", L`\dfrac{\pi\,(D^4 - D_i^4)}{64}`, In, "m⁴", 5), S("W", "W", L`\dfrac{2\,I}{D}`, 2 * In / I.D, "m³", 4),
      S("i", "i", L`\sqrt{I/A}`, sqrt(In / A), "m", 4), S("J", "J", L`2\,I` + "\\quad\\text{(inertie polaire = torsion)}", 2 * In, "m⁴", 5), S("g", "g", L`25\,A`, 25 * A, "kN/m", 2)] };
  },
  fig(I, g) { return KIT.circle({ D: I.D, Di: g("Di") || undefined, nb: 0, side: T(200, 60, `A = ${f2(g("A"), 3)} m²`, { s: 10 }) + T(200, 78, `I = ${f2(g("I"), 4)} m⁴`, { s: 10 }) + T(200, 96, `i = ${f2(g("i"), 3)} m`, { s: 10 }) }); },
  clair: (I, g) => `Le fût de ${f2(I.D, 2)} m${I.e > 0 ? ` évidé (paroi de ${f2(I.e * 100, 0)} cm)` : ""} pèse ${f2(g("g"), 1)} kN par mètre de hauteur et présente une inertie de ${f2(g("I"), 3)} m⁴.` },

{ id: "rdm-bredt", t: "Torsion d'un caisson à parois minces (Bredt)", ref: "Formules de Bredt — section fermée monocellulaire",
  desc: "Flux de cisaillement, contraintes tangentielles dans les parois et inertie de torsion d'un caisson rectangulaire.",
  inputs: [N("T", "Moment de torsion", "kN·m", 8000, "T"), N("b", "Largeur entre axes des âmes", "m", 6, "b"), N("h", "Hauteur entre feuillets moyens des hourdis", "m", 2.8, "h"),
    N("ts", "Épaisseur du hourdis supérieur", "m", 0.25, L`t_s`), N("ti", "Épaisseur du hourdis inférieur", "m", 0.22, L`t_i`), N("tw", "Épaisseur des âmes", "m", 0.45, L`t_w`), N("G", "Module de cisaillement", "MPa", 15000, "G")],
  calc(I) {
    const Om = I.b * I.h, q = I.T / (2 * Om), J = 4 * Om * Om / (I.b / I.ts + I.b / I.ti + 2 * I.h / I.tw), th = I.T / 1000 / (I.G * J);
    return { steps: [S("Om", L`\Omega`, L`b\,h` + "\\quad\\text{(aire intérieure au feuillet moyen)}", Om, "m²", 3), R("q", "q", L`\dfrac{T}{2\,\Omega}`, q, "kN/m", 1),
      R("tw_", L`\tau_{\hat{a}me}`, L`\dfrac{q}{t_w}`, q / I.tw / 1000, "MPa", 3), S("ts_", L`\tau_{sup}`, L`\dfrac{q}{t_s}`, q / I.ts / 1000, "MPa", 3), S("ti_", L`\tau_{inf}`, L`\dfrac{q}{t_i}`, q / I.ti / 1000, "MPa", 3),
      R("J", "J", L`\dfrac{4\,\Omega^2}{\oint ds/t}`, J, "m⁴", 3), S("th", L`\theta'`, L`\dfrac{T}{G\,J}`, th * 1000, "mrad/m", 4)],
      notes: ["Section fermée à parois minces, flux constant le long du contour. Pour le béton, $G \\approx E/2{,}4$ ; en fissuré, réduire la rigidité de torsion (souvent ÷ 2 à ÷ 4 pour l'analyse)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 165, k = min(220 / I.b, 110 / I.h), x0 = 165 - I.b * k / 2, y0 = 25; let s = Rc(x0 - 20, y0 - I.ts * k / 2, I.b * k + 40, I.ts * k) + Rc(x0, y0 + I.h * k - I.ti * k / 2, I.b * k, I.ti * k);
    s += Rc(x0 - I.tw * k / 2, y0, I.tw * k, I.h * k) + Rc(x0 + I.b * k - I.tw * k / 2, y0, I.tw * k, I.h * k);
    s += P(`M${x0} ${y0}H${x0 + I.b * k}V${y0 + I.h * k}H${x0}Z`, { c: K.red, w: 1.2, dash: "5 3" }) + arrow(150, y0, 180, y0) + arrow(x0 + I.b * k, y0 + I.h * k / 2 - 15, x0 + I.b * k, y0 + I.h * k / 2 + 15) + arrow(180, y0 + I.h * k, 150, y0 + I.h * k) + arrow(x0, y0 + I.h * k / 2 + 15, x0, y0 + I.h * k / 2 - 15);
    s += T(165, y0 + I.h * k / 2 + 3, `q = T/2Ω = ${f2(g("q"), 0)} kN/m`, { a: "middle", s: 9.5, c: K.red, w: 500 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La torsion fait circuler un flux de ${f2(g("q"), 0)} kN/m autour du caisson : les âmes sont cisaillées à ${f2(g("tw_"), 2)} MPa.` },

{ id: "rdm-euler", t: "Flambement d'Euler", ref: "Charge critique d'Euler — longueurs de flambement usuelles",
  desc: "Charge critique élastique, longueur de flambement et contrainte critique selon les conditions aux extrémités.",
  inputs: [N("l", "Longueur réelle", "m", 12, "l"), SEL("beta", "Conditions aux extrémités", [["1", "Articulé – articulé (β = 1)"], ["0.7", "Encastré – articulé (0,7)"], ["0.5", "Encastré – encastré (0,5)"], ["2", "Encastré – libre (2)"], ["1b", "Encastré – encastré glissant (1)"]], "2", L`\beta`),
    EIin(5000), N("A", "Aire de la section", "m²", 1.5, "A")],
  calc(I) {
    const b = parseFloat(I.beta), lf = b * I.l, Ncr = PI * PI * I.EI / (lf * lf), scr = Ncr / I.A;
    return { steps: [S("lf", L`l_f`, L`\beta\,l`, lf, "m", 2), R("Ncr", L`N_{cr}`, L`\dfrac{\pi^2\,EI}{l_f^2}`, Ncr * 1000, "kN", 0), S("scr", L`\sigma_{cr}`, L`\dfrac{N_{cr}}{A}`, scr, "MPa", 2)],
      notes: ["La charge critique d'Euler est une borne théorique : le dimensionnement utilise les méthodes réglementaires (EC2 §5.8, EC3 §6.3) qui tiennent compte des imperfections et de la plasticité."] };
  },
  fig(I, g) {
    const W = 330, Hh = 170, x = 165, y0 = 20, y1 = 150, b = parseFloat(I.beta); let s = P(`M${x} ${y0}V${y1}`, { c: K.mute, w: 1, dash: "3 3" });
    const def = b === 2 ? `M${x} ${y1}Q${x} ${(y0 + y1) / 2} ${x + 30} ${y0}` : b === 1 ? `M${x} ${y1}Q${x + 40} ${(y0 + y1) / 2} ${x} ${y0}` : b === 0.5 ? `M${x} ${y1}C${x} ${y1 - 40} ${x + 40} ${y1 - 50} ${x + 30} ${(y0 + y1) / 2}S${x} ${y0 + 40} ${x} ${y0}` : `M${x} ${y1}C${x} ${y1 - 50} ${x + 45} ${(y0 + y1) / 2} ${x} ${y0}`;
    s += P(def, { c: K.gold, w: 3 }) + ground(x - 25, x + 25, y1) + arrow(x + (b === 2 ? 30 : 0), y0 - 18, x + (b === 2 ? 30 : 0), y0 - 2, K.red, 2) + T(x + 40, 30, `Ncr = ${f2(g("Ncr"), 0)} kN`, { s: 10, c: K.red, w: 500 }) + T(x + 40, 48, `lf = ${f2(g("lf"), 1)} m`, { s: 9.5 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Au-delà de ${f2(g("Ncr"), 0)} kN, l'élément parfaitement droit flamberait élastiquement ; la longueur de flambement vaut ${f2(g("lf"), 1)} m.` },

{ id: "rdm-ligne-influence", t: "Ligne d'influence du moment : tandem TS et charge UDL", ref: "Lignes d'influence d'une travée isostatique ; NF EN 1991-2 §4.3.2 (TS + UDL)",
  desc: "Moment maximal dans une section d'une travée isostatique sous un tandem de deux essieux et une charge répartie sur toute la portée.",
  inputs: [N("L", "Portée", "m", 30, "L"), N("x", "Section étudiée (depuis l'appui gauche)", "m", 15, "x"), N("Q", "Charge par essieu du tandem", "kN", 300, "Q"), N("s", "Entraxe des essieux", "m", 1.2, "s"), N("q", "Charge répartie", "kN/m", 27, "q")],
  calc(I) {
    const y = t => t < 0 || t > I.L ? 0 : t <= I.x ? t * (I.L - I.x) / I.L : I.x * (I.L - t) / I.L, ym = I.x * (I.L - I.x) / I.L;
    const MT = I.Q * max(y(I.x) + y(I.x + I.s), y(I.x) + y(I.x - I.s)), MU = I.q * I.L * ym / 2;
    return { steps: [S("ym", L`\eta_{max}`, L`\dfrac{x\,(L - x)}{L}`, ym, "m", 3), S("MT", L`M_{TS}`, L`Q\,\left[\eta(x) + \eta(x \pm s)\right]`, MT, "kN·m", 0), S("MU", L`M_{UDL}`, L`q\cdot\dfrac{L\,\eta_{max}}{2}`, MU, "kN·m", 0), R("M", L`M_x`, L`M_{TS} + M_{UDL}`, MT + MU, "kN·m", 0)],
      notes: ["Le premier essieu est placé au droit de la section, le second du côté le plus favorable. Pour le LM1 complet, sommer les tandems et UDL des différentes voies avec leurs coefficients α et la répartition transversale."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, x1 = 26, x2 = 304, y0 = 60, X = t => x1 + (x2 - x1) * t / I.L, sc = 70 / g("ym"); let s = P(`M${x1} ${y0}L${X(I.x)} ${y0 + g("ym") * sc}L${x2} ${y0}Z`, { c: K.gold, f: K.goldL, op: .7 });
    s += P(`M${x1} ${y0}H${x2}`, { c: K.ink, w: 1.5 }) + pin(x1, y0) + roller(x2, y0);
    const sd = I.x + I.s <= I.L ? I.s : -I.s; [I.x, I.x + sd].forEach(t => { s += arrow(X(t), y0 - 34, X(t), y0 - 3, K.red, 2); }); s += T(X(I.x) + 6, y0 - 26, "TS", { s: 9.5, c: K.red });
    s += T(X(I.x), y0 + g("ym") * sc + 14, `η = ${f2(g("ym"), 2)} m`, { a: "middle", s: 9.5 }) + T(165, Hh - 6, "ligne d'influence du moment en x", { a: "middle", s: 9, c: K.mute });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `En plaçant le tandem au droit de la section, le moment atteint ${f2(g("M"), 0)} kN·m (${f2(g("MT"), 0)} dus aux essieux et ${f2(g("MU"), 0)} à la charge répartie).` },

{ id: "rdm-arc", t: "Arc parabolique à deux articulations", ref: "Statique des arcs — arc funiculaire des charges uniformes",
  desc: "Poussée, effort normal aux naissances et moment sous charge dissymétrique d'un arc parabolique surbaissé.",
  inputs: [N("L", "Ouverture", "m", 80, "L"), N("f", "Flèche de l'arc", "m", 12, "f"), N("q", "Charge permanente uniforme", "kN/m", 200, "q"), N("p", "Charge d'exploitation sur une demi-portée", "kN/m", 40, "p")],
  calc(I) {
    const H_ = (I.q + I.p / 2) * I.L ** 2 / (8 * I.f), V = I.q * I.L / 2 + 3 * I.p * I.L / 8, Nn = sqrt(H_ * H_ + V * V), Mq = I.p * I.L ** 2 / 64, a = Math.atan(4 * I.f / I.L) * 180 / PI;
    return { steps: [R("H", "H", L`\dfrac{(q + p/2)\,L^2}{8\,f}`, H_, "kN", 0), S("V", L`V_A`, L`\dfrac{qL}{2} + \dfrac{3\,pL}{8}`, V, "kN", 0), R("N", L`N_{naiss}`, L`\sqrt{H^2 + V_A^2}`, Nn, "kN", 0),
      S("a", L`\alpha_0`, L`\arctan\dfrac{4f}{L}`, a, "°", 1), R("M", L`M_{L/4}`, L`\pm\dfrac{p\,L^2}{64}`, Mq, "kN·m", 0), S("r", "", "~surbaissement f/L", I.f / I.L, "", 3)],
      notes: ["Sous la charge uniforme, l'arc parabolique est funiculaire : effort normal pur. La charge sur une demi-portée crée des moments de ±pL²/64 aux quarts (positif côté chargé). Effets du second ordre, raccourcissement élastique et variations de température non pris en compte."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, x1 = 30, x2 = 300, yb = 135, k = (x2 - x1) / I.L, sc = min(1, 90 / (I.f * k)); let s = ground(x1 - 14, x1 + 14, yb + 4) + ground(x2 - 14, x2 + 14, yb + 4);
    s += P(range(0, I.L, 60).map((x, i) => (i ? "L" : "M") + (x1 + x * k).toFixed(1) + " " + (yb - 4 * I.f * x * (I.L - x) / I.L ** 2 * k * sc).toFixed(1)).join(""), { c: K.ink, w: 3 });
    s += udl(x1, x2, yb - I.f * k * sc - 8, 14, K.red, 12) + udl(x1, (x1 + x2) / 2, yb - I.f * k * sc - 24, 7, K.blue, 10);
    s += arrow(x1 + 40, yb, x1 + 2, yb, K.red, 2) + T(x1 + 44, yb + 3, `H = ${f2(g("H"), 0)} kN`, { s: 9.5, c: K.red }) + dimV(165, yb, yb - I.f * k * sc, `f = ${f2(I.f, 1)} m`, K.mute, 1);
    return svg(W, Hh, s);
  },
  clair: (I, g) => `L'arc pousse ses culées horizontalement de ${f2(g("H"), 0)} kN : plus il est surbaissé, plus cette poussée est forte.` },

{ id: "rdm-cable", t: "Câble parabolique sous charge uniforme", ref: "Statique des câbles — câble porteur, suspente, hauban provisoire",
  desc: "Tension horizontale, tension maximale, longueur développée et allongement élastique d'un câble tendu entre deux points de niveau.",
  inputs: [N("L", "Portée", "m", 120, "L"), N("f", "Flèche", "m", 12, "f"), N("q", "Charge par mètre (horizontal)", "kN/m", 30, "q"), N("EA", "Rigidité axiale du câble", "MN", 400, "EA")],
  calc(I) {
    const H_ = I.q * I.L ** 2 / (8 * I.f), V = I.q * I.L / 2, Tm = sqrt(H_ * H_ + V * V), Lc = I.L * (1 + 8 / 3 * (I.f / I.L) ** 2), dl = H_ * I.L * (1 + 16 / 3 * (I.f / I.L) ** 2) / (I.EA * 1000) * 1000;
    return { steps: [R("H", "H", L`\dfrac{q\,L^2}{8\,f}`, H_, "kN", 0), S("V", "V", L`\dfrac{qL}{2}`, V, "kN", 0), R("Tm", L`T_{max}`, L`\sqrt{H^2 + V^2}`, Tm, "kN", 0),
      S("Lc", L`L_c`, L`L\left[1 + \dfrac{8}{3}\left(\dfrac{f}{L}\right)^2\right]`, Lc, "m", 3), S("dl", L`\Delta L`, L`\dfrac{H\,L}{EA}\left[1 + \dfrac{16}{3}\left(\dfrac{f}{L}\right)^2\right]`, dl, "mm", 0), S("a", L`\alpha`, L`\arctan\dfrac{4f}{L}`, Math.atan(4 * I.f / I.L) * 180 / PI, "°", 2)],
      notes: ["Hypothèse de la parabole (charge uniforme en projection horizontale, $f/L \\lesssim 1/8$). Pour un câble sous son poids propre seul, la chaînette donne des valeurs très voisines tant que $f/L$ reste faible."] };
  },
  fig(I, g) {
    const W = 330, Hh = 150, x1 = 30, x2 = 300, yt = 30, k = (x2 - x1) / I.L, sc = min(1, 80 / (I.f * k)); let s = Rc(x1 - 8, yt - 6, 8, 110, { f: K.concD, c: K.ink }) + Rc(x2, yt - 6, 8, 110, { f: K.concD, c: K.ink });
    s += P(range(0, I.L, 60).map((x, i) => (i ? "L" : "M") + (x1 + x * k).toFixed(1) + " " + (yt + 4 * I.f * x * (I.L - x) / I.L ** 2 * k * sc).toFixed(1)).join(""), { c: K.blue, w: 2.5 });
    s += arrow(x1 + 30, yt + 5, x1 + 2, yt + 1, K.red, 2) + T(x1 + 34, yt + 4, `Tmax = ${f2(g("Tm"), 0)} kN`, { s: 9.5, c: K.red }) + dimV(165, yt, yt + I.f * k * sc, `f = ${f2(I.f, 1)} m`, K.mute, 1);
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le câble est tendu à ${f2(g("Tm"), 0)} kN aux ancrages ; il mesure ${f2(g("Lc"), 2)} m pour ${f2(I.L, 0)} m de portée.` },

{ id: "rdm-dalle-navier", t: "Plaque rectangulaire simplement appuyée (Navier)", ref: "Théorie des plaques minces (Timoshenko) — solution de Navier en double série",
  desc: "Flèche et moments au centre d'une dalle rectangulaire appuyée sur ses quatre côtés sous charge uniforme.",
  inputs: [N("a", "Petit côté", "m", 6, "a"), N("b", "Grand côté", "m", 9, "b"), N("h", "Épaisseur", "m", 0.25, "h"), N("q", "Charge uniforme", "kN/m²", 12, "q"), N("E", "Module d'élasticité", "MPa", 32000, "E"), N("nu", "Coefficient de Poisson", "", 0.2, L`\nu`)],
  calc(I) {
    const D = I.E * 1000 * I.h ** 3 / (12 * (1 - I.nu ** 2)); let w = 0, mx = 0, my = 0;
    for (let m = 1; m <= 39; m += 2) for (let n = 1; n <= 39; n += 2) { const A = 16 * I.q / (PI ** 6 * m * n * ((m / I.a) ** 2 + (n / I.b) ** 2) ** 2), s = Math.sin(m * PI / 2) * Math.sin(n * PI / 2);
      w += A * s / D; mx += A * s * PI * PI * ((m / I.a) ** 2 + I.nu * (n / I.b) ** 2); my += A * s * PI * PI * ((n / I.b) ** 2 + I.nu * (m / I.a) ** 2); }
    return { steps: [S("D", "D", L`\dfrac{E\,h^3}{12\,(1 - \nu^2)}`, D / 1000, "MN·m", 2), R("w", L`w_0`, L`\dfrac{16\,q}{\pi^6 D}\sum_{m,n\ \text{impairs}}\dfrac{\sin\frac{m\pi}{2}\sin\frac{n\pi}{2}}{m\,n\left(\frac{m^2}{a^2} + \frac{n^2}{b^2}\right)^2}`, w * 1000, "mm", 2),
      R("mx", L`m_x`, "~moment au centre, direction du petit côté", mx, "kN·m/m", 2), R("my", L`m_y`, "~moment au centre, direction du grand côté", my, "kN·m/m", 2), S("ax", L`\dfrac{m_x}{q\,a^2}`, "", mx / (I.q * I.a ** 2), "", 4), S("ratio", L`b/a`, "", I.b / I.a, "", 2)],
      notes: ["Séries arrêtées à m, n = 39 (convergence largement atteinte pour les moments au centre). Coefficients de Timoshenko pour ν = 0,3 : b/a = 1 → $m_x = 0{,}0479\\,qa^2$ ; b/a = 2 → $0{,}1017\\,qa^2$. Pour les charges concentrées et les bords encastrés, utiliser les abaques de Pigeaud ou un calcul aux éléments finis."] };
  },
  fig(I, g) {
    const pts = range(1, 3, 40).map(r => { let mx = 0; const a = 1, b = r; for (let m = 1; m <= 25; m += 2) for (let n = 1; n <= 25; n += 2) { const A = 16 / (PI ** 6 * m * n * ((m / a) ** 2 + (n / b) ** 2) ** 2), s = Math.sin(m * PI / 2) * Math.sin(n * PI / 2); mx += A * s * PI * PI * ((m / a) ** 2 + I.nu * (n / b) ** 2); } return [r, mx]; });
    return plot({ series: [{ pts, l: `mx / qa² (ν = ${f2(I.nu, 1)})` }, { pts: pts.map(p => [p[0], 0.125]), l: "poutre (b/a → ∞) : 1/8", c: K.mute, w: 1, dash: "4 3" }], marks: [{ x: min(g("ratio"), 3), y: g("ax"), l: f2(g("ax"), 4) }], xl: "b / a", yl: "mx / q a²", ymin: 0, ymax: 0.14 });
  },
  clair: (I, g) => `La dalle porte dans les deux sens : au centre, ${f2(g("mx"), 1)} kN·m/m dans le sens court et ${f2(g("my"), 1)} kN·m/m dans le sens long ; elle fléchit de ${f2(g("w"), 1)} mm.` },

{ id: "rdm-frequence", t: "Fréquences propres d'une poutre", ref: "Dynamique des structures — vibrations de flexion des poutres d'Euler-Bernoulli",
  desc: "Premières fréquences propres de flexion d'une poutre selon ses conditions d'appui.",
  inputs: [N("L", "Portée", "m", 30, "L"), EIin(5e4), N("m", "Masse linéique", "t/m", 12, "m"),
    SEL("cas", "Conditions d'appui", [["ss", "Appuis simples (λ₁ = π)"], ["ff", "Encastré – encastré (λ₁ = 4,730)"], ["fs", "Encastré – appuyé (λ₁ = 3,927)"], ["cl", "Console (λ₁ = 1,875)"]], "ss", "")],
  calc(I) {
    const lam = { ss: [PI, 2 * PI, 3 * PI], ff: [4.730, 7.853, 10.996], fs: [3.927, 7.069, 10.210], cl: [1.875, 4.694, 7.855] }[I.cas], c = sqrt(I.EI * 1e6 / (I.m * 1000)) / (2 * PI * I.L * I.L), f = lam.map(l => l * l * c);
    return { steps: [S("lam", L`\lambda_1\ ;\ \lambda_2\ ;\ \lambda_3`, "", lam.map(l => f2(l, 3)).join(" ; "), "", 0), R("f1", L`f_1`, L`\dfrac{\lambda_1^2}{2\pi L^2}\sqrt{\dfrac{EI}{m}}`, f[0], "Hz", 3), S("f2", L`f_2`, "", f[1], "Hz", 3), S("f3", L`f_3`, "", f[2], "Hz", 3), S("T1", L`T_1`, L`1/f_1`, 1 / f[0], "s", 3)] };
  },
  fig(I, g) { return KIT.barsH([{ l: "mode 1", v: g("f1"), u: "Hz", c: K.gold }, { l: "mode 2", v: g("f2"), u: "Hz", c: K.blue }, { l: "mode 3", v: g("f3"), u: "Hz", c: K.teal }], { title: "Fréquences propres de flexion", left: 60 }); },
  clair: (I, g) => `La poutre vibre naturellement à ${f2(g("f1"), 2)} Hz (une oscillation toutes les ${f2(g("T1"), 2)} s).` },

{ id: "rdm-winkler", t: "Poutre sur appui élastique continu (Winkler)", ref: "Théorie de Hetényi — poutre infinie sur sol élastique",
  desc: "Longueur élastique, enfoncement, moment et pression du sol sous une charge concentrée (longrine, radier, semelle filante).",
  inputs: [N("P", "Charge concentrée", "kN", 800, "P"), N("b", "Largeur de la poutre", "m", 1.5, "b"), N("k", "Module de réaction du sol", "MN/m³", 30, L`k_s`), EIin(900)],
  calc(I) {
    const kb = I.k * 1000 * I.b, lam = pow(kb / (4 * I.EI * 1000), 0.25), w0 = I.P * lam / (2 * kb), M0 = I.P / (4 * lam), p0 = I.k * 1000 * w0, le = 1 / lam;
    return { steps: [S("kb", L`k_s\,b`, "", kb, "kN/m²", 0), R("lam", L`\lambda`, L`\sqrt[4]{\dfrac{k_s\,b}{4\,EI}}`, lam, "m⁻¹", 4), S("le", L`l_e`, L`\dfrac{1}{\lambda}`, le, "m", 2),
      R("w0", L`w_0`, L`\dfrac{P\,\lambda}{2\,k_s\,b}`, w0 * 1000, "mm", 2), R("M0", L`M_0`, L`\dfrac{P}{4\,\lambda}`, M0, "kN·m", 1), S("p0", L`p_0`, L`k_s\,w_0`, p0, "kPa", 0), S("x0", L`x_{M=0}`, L`\dfrac{\pi}{4\,\lambda}` + "\\quad\\text{(premier point de moment nul)}", PI / (4 * lam), "m", 2)],
      notes: ["Poutre infinie (longueur > $\\pi/\\lambda$ de part et d'autre de la charge). Le module $k_s$ dépend de la largeur chargée (feuille « Module de réaction (Ménard) »). Flexion : $M(x) = \\dfrac{P}{4\\lambda}e^{-\\lambda x}(\\cos\\lambda x - \\sin\\lambda x)$."] };
  },
  fig(I, g) { const lam = g("lam"), xs = range(-3 * PI / (2 * lam), 3 * PI / (2 * lam), 120); return plot({ series: [{ pts: xs.map(x => [x, exp(-lam * abs(x)) * (Math.cos(lam * abs(x)) - Math.sin(lam * abs(x))) / (4 * lam) * I.P]), l: "moment M(x)" }, { pts: xs.map(x => [x, -0.6 * g("M0") * exp(-lam * abs(x)) * (Math.cos(lam * abs(x)) + Math.sin(lam * abs(x)))]), l: "enfoncement (allure, échelle libre)", c: K.blue, w: 1.4, dash: "5 3" }], xl: "distance à la charge (m)", yl: "kN·m" }); },
  clair: (I, g) => `Sous ${f2(I.P, 0)} kN, la poutre s'enfonce de ${f2(g("w0"), 1)} mm et le sol réagit sur environ ${f2(1.5 * PI / g("lam"), 1)} m ; le moment maximal vaut ${f2(g("M0"), 0)} kN·m.` },

{ id: "rdm-mohr", t: "État de contrainte plan : cercle de Mohr", ref: "Mécanique des milieux continus — contraintes principales, critère de von Mises",
  desc: "Contraintes principales, cisaillement maximal et orientation à partir des contraintes normales et tangentielles en un point.",
  inputs: [N("sx", "Contrainte normale σx (traction +)", "MPa", 120, L`\sigma_x`), N("sy", "Contrainte normale σy", "MPa", -40, L`\sigma_y`), N("txy", "Cisaillement τxy", "MPa", 60, L`\tau_{xy}`)],
  calc(I) {
    const c = (I.sx + I.sy) / 2, r = sqrt(((I.sx - I.sy) / 2) ** 2 + I.txy ** 2), s1 = c + r, s2 = c - r, th = 0.5 * Math.atan2(2 * I.txy, I.sx - I.sy) * 180 / PI, vm = sqrt(I.sx ** 2 + I.sy ** 2 - I.sx * I.sy + 3 * I.txy ** 2);
    return { steps: [S("c", "c", L`\dfrac{\sigma_x + \sigma_y}{2}`, c, "MPa", 2), S("r", "r", L`\sqrt{\left(\dfrac{\sigma_x - \sigma_y}{2}\right)^2 + \tau_{xy}^2}`, r, "MPa", 2), R("s1", L`\sigma_1`, L`c + r`, s1, "MPa", 2), R("s2", L`\sigma_2`, L`c - r`, s2, "MPa", 2),
      S("th", L`\theta_p`, L`\tfrac{1}{2}\arctan\dfrac{2\tau_{xy}}{\sigma_x - \sigma_y}`, th, "°", 2), S("tm", L`\tau_{max}`, "r", r, "MPa", 2), R("vm", L`\sigma_{VM}`, L`\sqrt{\sigma_x^2 + \sigma_y^2 - \sigma_x\sigma_y + 3\tau_{xy}^2}`, vm, "MPa", 2)],
      notes: ["Critère de von Mises pour l'acier : $\\sigma_{VM} \\le f_y/\\gamma_{M0}$ (NF EN 1993-1-1 (6.1)). Pour le béton, la contrainte principale de traction sert au contrôle de la fissuration d'effort tranchant (zones non fissurées en flexion)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 170, cx = 165, cy = 90, R_ = 60, sc = R_ / g("r"), X = s => cx + (s - g("c")) * sc; let s = P(`M20 ${cy}H310`, { c: K.mute, w: .8 }) + Ci(cx, cy, R_, { f: "none", c: K.gold, w: 2 });
    if (X(0) > 20 && X(0) < 310) s += P(`M${X(0)} 20V160`, { c: K.mute, w: .8 });
    s += Ci(X(I.sx), cy - I.txy * sc, 3.5, { f: K.red, c: "#fff" }) + Ci(X(I.sy), cy + I.txy * sc, 3.5, { f: K.red, c: "#fff" }) + P(`M${X(I.sx)} ${cy - I.txy * sc}L${X(I.sy)} ${cy + I.txy * sc}`, { c: K.red, w: 1, dash: "3 2" });
    s += Ci(X(g("s1")), cy, 3.5, { f: K.blue, c: "#fff" }) + Ci(X(g("s2")), cy, 3.5, { f: K.blue, c: "#fff" }) + T(X(g("s1")) + 4, cy + 14, `σ1 = ${f2(g("s1"), 1)}`, { s: 9, c: K.blue }) + T(X(g("s2")) - 4, cy + 14, `σ2 = ${f2(g("s2"), 1)}`, { a: "end", s: 9, c: K.blue });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `En tournant de ${f2(g("th"), 1)}°, on trouve les contraintes principales ${f2(g("s1"), 1)} et ${f2(g("s2"), 1)} MPa ; la contrainte équivalente de von Mises vaut ${f2(g("vm"), 1)} MPa.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
