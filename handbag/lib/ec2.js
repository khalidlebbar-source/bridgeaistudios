/* ════════════════════════════════════════════════════════════════════
   HandBag — Béton armé selon l'Eurocode 2 (NF EN 1992-1-1 et AN française)
   Unités : m, kN, kN·m, MPa, cm² (sauf mention).
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, min, max, abs, L, S, R, C, N, SEL, H, fmt, ACIER_HA } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, tag, plot, range, logRange } = HB.FIG, KIT = HB.KIT;
const cbrt = Math.cbrt, ln = Math.log, f2 = (v, d = 2) => fmt(v, d);

/* ─── matériaux ─── */
function beton(fck, gc = 1.5, acc = 1) {
  const fcm = fck + 8, fctm = fck <= 50 ? 0.3 * pow(fck, 2 / 3) : 2.12 * ln(1 + fcm / 10);
  return { fck, fcm, fctm, fctk05: 0.7 * fctm, Ecm: 22000 * pow(fcm / 10, 0.3), fcd: acc * fck / gc, fctd: 0.7 * min(fctm, 2.12 * ln(1 + 6.8)) / gc,
    eta: fck <= 50 ? 1 : 1 - (fck - 50) / 200, lam: fck <= 50 ? 0.8 : 0.8 - (fck - 50) / 400,
    ecu: fck <= 50 ? 3.5e-3 : (2.6 + 35 * pow((90 - fck) / 100, 4)) * 1e-3, ec2: fck <= 50 ? 2e-3 : (2 + 0.085 * pow(fck - 50, 0.53)) * 1e-3,
    n: fck <= 50 ? 2 : 1.4 + 23.4 * pow((90 - fck) / 100, 4), nu: 0.6 * (1 - fck / 250) };
}
const Es = 200000;
/* contrainte parabole-rectangle (§3.1.7) */
const sigC = (e, B) => e <= 0 ? 0 : e < B.ec2 ? B.fcd * (1 - pow(1 - e / B.ec2, B.n)) : B.fcd;
const sigS = (e, fyd) => max(-fyd, min(fyd, Es * e));
/* déformation à la profondeur y pour l'axe neutre x (pivots B et C, fig. 6.1) */
const strain = (y, x, h, B) => x <= h ? B.ecu * (x - y) / x : B.ec2 * (x - y) / (x - h * (1 - B.ec2 / B.ecu));
/* efforts résistants d'une section par fibres : width(y) largeur à la profondeur y, bars [{y, A(m²)}] */
function NM(x, h, width, bars, B, fyd, nf = 120) {
  let Nc = 0, Mc = 0; const dy = h / nf;
  for (let i = 0; i < nf; i++) { const y = (i + 0.5) * dy, s = sigC(strain(y, x, h, B), B), F = s * width(y) * dy; Nc += F; Mc += F * (h / 2 - y); }
  let Ns = 0, Ms = 0; bars.forEach(b => { const e = strain(b.y, x, h, B), s = sigS(e, fyd) - (e > 0 ? sigC(e, B) : 0), F = s * b.A; Ns += F; Ms += F * (h / 2 - b.y); });
  return { N: Nc + Ns, M: Mc + Ms };
}
const XS = logRange(1e-4, 60, 140);
function interaction(h, width, bars, B, fyd) {
  const pos = XS.map(x => NM(x * h, h, width, bars, B, fyd)), flip = bars.map(b => ({ y: h - b.y, A: b.A })), wf = y => width(h - y);
  const neg = XS.map(x => NM(x * h, h, wf, flip, B, fyd));
  return { pos, neg };
}
/* moment résistant sous effort normal donné (bisection sur l'axe neutre) */
function mrdAt(Ned, h, width, bars, B, fyd) {
  let a = 1e-5 * h, b = 60 * h; const f = x => NM(x, h, width, bars, B, fyd).N - Ned;
  if (f(a) > 0 || f(b) < 0) return { M: NaN, x: NaN };
  for (let i = 0; i < 80; i++) { const m = (a + b) / 2; f(m) > 0 ? b = m : a = m; }
  const x = (a + b) / 2; return { M: NM(x, h, width, bars, B, fyd).M, x };
}
/* section rectangulaire fissurée (ELS) avec aciers comprimés */
function crackRect(b, d, As, As2, d2, n) {           // m, m², retourne x, I
  const A = b / 2, Bq = n * (As + As2), Cq = -n * (As * d + As2 * d2);
  const x = (-Bq + sqrt(Bq * Bq - 4 * A * Cq)) / (2 * A), I = b * x ** 3 / 3 + n * As * (d - x) ** 2 + n * As2 * (x - d2) ** 2;
  return { x, I };
}
const fyd = (fyk, gs = 1.15) => fyk / gs;
const vminFR = (type, k, fck, gc) => type === "p" ? 0.053 / gc * pow(k, 1.5) * sqrt(fck) : type === "d" ? 0.34 / gc * sqrt(fck) : type === "v" ? 0.35 / gc * sqrt(fck) : 0.035 * pow(k, 1.5) * sqrt(fck);
const VMIN_SEL = [["p", "Poutre ou dalle sans redistribution (AN : 0,053/γc·k^1,5·√fck)"], ["d", "Dalle avec redistribution transversale (AN : 0,34/γc·√fck)"], ["v", "Voile (AN : 0,35/γc·√fck)"], ["r", "Valeur recommandée EN (0,035·k^1,5·√fck)"]];
const vminTex = t => t === "p" ? L`\dfrac{0{,}053}{\gamma_c}\,k^{3/2}\sqrt{f_{ck}}` : t === "d" ? L`\dfrac{0{,}34}{\gamma_c}\sqrt{f_{ck}}` : t === "v" ? L`\dfrac{0{,}35}{\gamma_c}\sqrt{f_{ck}}` : L`0{,}035\,k^{3/2}\sqrt{f_{ck}}`;
const PHI = Object.keys(ACIER_HA).map(k => [k, "HA " + k]);
const BET = ["20", "25", "30", "35", "40", "45", "50", "55", "60"].map(k => [k, `C${k}/${HB.DSL.EC2_CUBE[k]}`]);
const lbrqd = (phi, ssd, fbd) => phi / 4 * ssd / fbd;               // mm
function fbdOf(fck, phi, bond, gc = 1.5) { const fctk = 0.7 * 0.3 * pow(min(fck, 60), 2 / 3), fctd = fctk / gc, e1 = bond === "b" ? 1 : 0.7, e2 = phi <= 32 ? 1 : (132 - phi) / 100; return { fctd, e1, e2, fbd: 2.25 * e1 * e2 * fctd }; }
const ratio = (a, b) => b > 0 ? a / b : Infinity;

HB.EC2 = { beton, sigC, sigS, NM, interaction, mrdAt, crackRect, Es, fbdOf, vminFR };

const COMMON_MAT = [N("fck", "Résistance du béton", "MPa", 35, L`f_{ck}`), N("fyk", "Limite élastique de l'acier", "MPa", 500, L`f_{yk}`)];

HB.add("Béton armé — Eurocode 2", [

/* ─────────── FLEXION SIMPLE — SECTION RECTANGULAIRE ─────────── */
{ id: "ec2-flexion-rect", t: "Flexion simple ELU : section rectangulaire", ref: "NF EN 1992-1-1 — §3.1.7 (3), §6.1, §9.2.1.1",
  desc: "Armatures tendues (et comprimées si nécessaire) d'une section rectangulaire, diagramme rectangulaire simplifié, acier à palier horizontal.",
  inputs: [N("M", "Moment ultime", "kN·m", 850, L`M_{Ed}`), N("b", "Largeur", "m", 0.5, "b"), N("h", "Hauteur", "m", 1.0, "h"), N("d", "Hauteur utile", "m", 0.92, "d"),
    N("d2", "Enrobage des aciers comprimés (axe)", "m", 0.05, L`d'`), ...COMMON_MAT, N("gc", "Coefficient béton", "", 1.5, L`\gamma_c`), N("gs", "Coefficient acier", "", 1.15, L`\gamma_s`)],
  calc(I) {
    const B = HB.EC2.beton(I.fck, I.gc), fy = I.fyk / I.gs, fc = B.eta * B.fcd, M = I.M / 1000, eyd = fy / Es;
    const mu = M / (I.b * I.d ** 2 * fc), al = B.ecu / (B.ecu + eyd), mul = B.lam * al * (1 - B.lam * al / 2);
    let As, As2 = 0, al1, z;
    if (mu <= mul) { al1 = (1 - sqrt(1 - 2 * mu)) / B.lam; z = I.d * (1 - B.lam * al1 / 2); As = M / (z * fy); }
    else { al1 = al; z = I.d * (1 - B.lam * al / 2); const Ml = mul * I.b * I.d ** 2 * fc, e2 = B.ecu * (al * I.d - I.d2) / (al * I.d), s2 = min(fy, Es * e2);
      As2 = (M - Ml) / ((I.d - I.d2) * s2); As = Ml / (z * fy) + As2 * s2 / fy; }
    const Asmin = max(0.26 * B.fctm / I.fyk, 0.0013) * I.b * I.d * 1e4, Asmax = 0.04 * I.b * I.h * 1e4;
    return { steps: [S("fcd", L`f_{cd}`, L`\alpha_{cc}\,\dfrac{f_{ck}}{\gamma_c}`, B.fcd, "MPa", 2), S("fyd", L`f_{yd}`, L`\dfrac{f_{yk}}{\gamma_s}`, fy, "MPa", 1),
      R("mu", L`\mu_{cu}`, L`\dfrac{M_{Ed}}{b\,d^2\,\eta f_{cd}}`, mu, "", 4), S("mul", L`\mu_{lim}`, L`\lambda\,\alpha_{l}\left(1 - \tfrac{\lambda}{2}\alpha_{l}\right),\ \ \alpha_{l} = \dfrac{\varepsilon_{cu3}}{\varepsilon_{cu3} + \varepsilon_{yd}}`, mul, "", 4),
      S("alpha", L`\alpha_u = \dfrac{x_u}{d}`, mu <= mul ? L`\dfrac{1 - \sqrt{1 - 2\,\mu_{cu}}}{\lambda}` : L`\alpha_{l}\ \text{(pivot limite)}`, al1, "", 4),
      S("z", "z", L`d\left(1 - \tfrac{\lambda}{2}\,\alpha_u\right)`, z, "m", 3),
      R("As", L`A_s`, mu <= mul ? L`\dfrac{M_{Ed}}{z\,f_{yd}}` : L`\dfrac{M_{lim}}{z\,f_{yd}} + A_s'\,\dfrac{\sigma_{s2}}{f_{yd}}`, As * 1e4, "cm²", 2),
      R("As2", L`A_s'`, mu <= mul ? "~aucune armature comprimée nécessaire" : L`\dfrac{M_{Ed} - M_{lim}}{(d - d')\,\sigma_{s2}}`, As2 * 1e4, "cm²", 2),
      S("Asmin", L`A_{s,min}`, L`\max\left(0{,}26\,\dfrac{f_{ctm}}{f_{yk}}\ ;\ 0{,}0013\right) b\,d`, Asmin, "cm²", 2)],
      checks: [C("Pivot : $\\mu_{cu} \\le \\mu_{lim}$ (pas d'aciers comprimés)", mu <= mul, `${f2(mu, 3)} ≤ ${f2(mul, 3)}`, mu / mul),
        C("Pourcentage minimal : $A_s \\ge A_{s,min}$", As * 1e4 >= Asmin, `${f2(As * 1e4)} ≥ ${f2(Asmin)} cm² (sinon retenir $A_{s,min}$)`, Asmin / (As * 1e4)),
        C("Pourcentage maximal : $A_s + A_s' \\le 0{,}04\\,A_c$", (As + As2) * 1e4 <= Asmax, `${f2((As + As2) * 1e4)} ≤ ${f2(Asmax, 0)} cm²`, (As + As2) * 1e4 / Asmax)],
      notes: [`$\\eta = ${f2(B.eta, 2)}$, $\\lambda = ${f2(B.lam, 2)}$, $\\varepsilon_{cu3} = ${f2(B.ecu * 1000, 2)}$ ‰. Acier à palier horizontal (§3.2.7) : pas de limite de déformation. $\\alpha_{cc} = 1$ (AN).`] };
  },
  fig(I, g) { return KIT.section({ b: I.b, h: I.h, d: I.d, As: g("As"), nb: 5, As2: g("As2") > 0 ? 1 : 0, d2: I.d2, x: g("alpha") * I.d, lam: 0.8, z: true, fcl: "η fcd", Fs: `As = ${f2(g("As"))} cm²` }); },
  clair: (I, g) => `Pour reprendre ${f2(I.M, 0)} kN·m, il faut ${f2(g("As"))} cm² d'acier en fibre tendue${g("As2") > 0 ? ` et ${f2(g("As2"))} cm² en fibre comprimée (béton seul insuffisant)` : ""}, avec un bras de levier de ${f2(g("z"), 2)} m.` },

/* ─────────── FLEXION SIMPLE — SECTION EN T ─────────── */
{ id: "ec2-flexion-t", t: "Flexion simple ELU : section en T", ref: "NF EN 1992-1-1 — §3.1.7 (3), §5.3.2.1, §6.1",
  desc: "Section en T (table comprimée) : vérification de la position de l'axe neutre, puis décomposition table / nervure.",
  inputs: [N("M", "Moment ultime", "kN·m", 4200, L`M_{Ed}`), N("beff", "Largeur participante de la table", "m", 2.4, L`b_{eff}`), N("hf", "Épaisseur de la table", "m", 0.2, L`h_f`),
    N("bw", "Largeur de l'âme", "m", 0.4, L`b_w`), N("h", "Hauteur totale", "m", 1.5, "h"), N("d", "Hauteur utile", "m", 1.38, "d"), ...COMMON_MAT],
  calc(I) {
    const B = HB.EC2.beton(I.fck), fy = fyd(I.fyk), fc = B.eta * B.fcd, M = I.M / 1000, eyd = fy / Es;
    const Mt = I.beff * I.hf * fc * (I.d - I.hf / 2), al = B.ecu / (B.ecu + eyd), mul = B.lam * al * (1 - B.lam * al / 2);
    let As, mu, z, x, M1 = 0;
    if (M <= Mt) { mu = M / (I.beff * I.d ** 2 * fc); const a = (1 - sqrt(1 - 2 * mu)) / B.lam; x = a * I.d; z = I.d * (1 - B.lam * a / 2); As = M / (z * fy); }
    else { M1 = (I.beff - I.bw) * I.hf * fc * (I.d - I.hf / 2); const As1 = M1 / ((I.d - I.hf / 2) * fy); mu = (M - M1) / (I.bw * I.d ** 2 * fc);
      const a = (1 - sqrt(1 - 2 * min(mu, 0.5))) / B.lam; x = a * I.d; z = I.d * (1 - B.lam * a / 2); As = As1 + (M - M1) / (z * fy); }
    const Asmin = max(0.26 * B.fctm / I.fyk, 0.0013) * I.bw * I.d * 1e4;
    return { steps: [S("fcd", L`f_{cd}`, L`\dfrac{f_{ck}}{\gamma_c}`, B.fcd, "MPa", 2),
      R("Mt", L`M_{t}`, L`b_{eff}\,h_f\,\eta f_{cd}\left(d - \dfrac{h_f}{2}\right)`, Mt * 1000, "kN·m", 0),
      S("cas", "", "~" + (M <= Mt ? "$M_{Ed} \\le M_t$ : axe neutre dans la table, section rectangulaire de largeur $b_{eff}$" : "$M_{Ed} > M_t$ : axe neutre dans la nervure, décomposition table + nervure"), "", "", 0),
      ...(M > Mt ? [S("M1", L`M_{1}`, L`(b_{eff} - b_w)\,h_f\,\eta f_{cd}\left(d - \dfrac{h_f}{2}\right)`, M1 * 1000, "kN·m", 0)] : []),
      R("mu", L`\mu_{cu}`, M <= Mt ? L`\dfrac{M_{Ed}}{b_{eff}\,d^2\,\eta f_{cd}}` : L`\dfrac{M_{Ed} - M_1}{b_w\,d^2\,\eta f_{cd}}`, mu, "", 4),
      S("x", L`x_u`, L`\dfrac{1 - \sqrt{1 - 2\mu_{cu}}}{\lambda}\,d`, x, "m", 3), S("z", "z", L`d - \tfrac{\lambda}{2}\,x_u`, z, "m", 3),
      R("As", L`A_s`, M <= Mt ? L`\dfrac{M_{Ed}}{z\,f_{yd}}` : L`\dfrac{M_1}{(d - h_f/2)\,f_{yd}} + \dfrac{M_{Ed} - M_1}{z\,f_{yd}}`, As * 1e4, "cm²", 2),
      S("Asmin", L`A_{s,min}`, L`\max\left(0{,}26\,\dfrac{f_{ctm}}{f_{yk}}\ ;\ 0{,}0013\right) b_w\,d`, Asmin, "cm²", 2)],
      checks: [C("Pivot : $\\mu_{cu} \\le \\mu_{lim}$", mu <= mul, `${f2(mu, 3)} ≤ ${f2(mul, 3)}`, mu / mul), C("$A_s \\ge A_{s,min}$", As * 1e4 >= Asmin, `${f2(As * 1e4)} ≥ ${f2(Asmin)} cm²`)],
      notes: ["Largeur participante $b_{eff}$ : voir §5.3.2.1 ($b_{eff} = \\sum b_{eff,i} + b_w$, $b_{eff,i} = 0{,}2\\,b_i + 0{,}1\\,l_0 \\le 0{,}2\\,l_0$)."] };
  },
  fig(I, g) { return KIT.section({ beff: I.beff, hf: I.hf, bw: I.bw, h: I.h, d: I.d, As: g("As"), nb: 4, x: g("x"), lam: 0.8, z: true, fcl: "η fcd", Fs: `As = ${f2(g("As"))} cm²` }); },
  clair: (I, g) => `${I.M / 1000 <= g("Mt") / 1000 ? "La table suffit à équilibrer la compression" : "La table ne suffit pas : la nervure est aussi comprimée"} ; il faut ${f2(g("As"))} cm² d'acier tendu.` },

/* ─────────── MOMENT RÉSISTANT D'UNE SECTION DONNÉE ─────────── */
{ id: "ec2-mrd", t: "Moment résistant d'une section armée connue", ref: "NF EN 1992-1-1 — §6.1 (équilibre et compatibilité des déformations)",
  desc: "Moment résistant ultime d'une section rectangulaire avec armatures tendues et comprimées données, contraintes des aciers selon leur déformation réelle.",
  inputs: [N("b", "Largeur", "m", 0.4, "b"), N("h", "Hauteur", "m", 0.8, "h"), N("d", "Hauteur utile", "m", 0.73, "d"), N("As", "Armatures tendues", "cm²", 24.5, L`A_s`),
    N("As2", "Armatures comprimées", "cm²", 6.28, L`A_s'`), N("d2", "Position des aciers comprimés", "m", 0.05, L`d'`), N("M", "Moment agissant", "kN·m", 600, L`M_{Ed}`), ...COMMON_MAT],
  calc(I) {
    const B = HB.EC2.beton(I.fck), fy = fyd(I.fyk), fc = B.eta * B.fcd, As = I.As / 1e4, As2 = I.As2 / 1e4;
    const F = x => { const e1 = B.ecu * (I.d - x) / x, e2 = B.ecu * (x - I.d2) / x; return B.lam * x * I.b * fc + As2 * sigS(e2, fy) - As * sigS(e1, fy); };
    let a = 1e-4, b2 = I.h / B.lam; for (let i = 0; i < 80; i++) { const m = (a + b2) / 2; F(m) > 0 ? b2 = m : a = m; }
    const x = (a + b2) / 2, e1 = B.ecu * (I.d - x) / x, e2 = B.ecu * (x - I.d2) / x, s1 = sigS(e1, fy), s2 = sigS(e2, fy);
    const Mr = B.lam * x * I.b * fc * (I.d - B.lam * x / 2) + As2 * s2 * (I.d - I.d2);
    return { steps: [S("fcd", L`f_{cd}`, L`\dfrac{f_{ck}}{\gamma_c}`, B.fcd, "MPa", 2),
      R("x", L`x_u`, "~équilibre : $\\lambda\\,x_u\\,b\\,\\eta f_{cd} + A_s'\\,\\sigma_{s2} = A_s\\,\\sigma_{s1}$", x, "m", 4),
      S("e1", L`\varepsilon_{s1}`, L`\varepsilon_{cu3}\,\dfrac{d - x_u}{x_u}`, e1 * 1000, "‰", 2), S("s1", L`\sigma_{s1}`, L`\min\left(E_s\,\varepsilon_{s1}\ ;\ f_{yd}\right)`, s1, "MPa", 1),
      S("e2", L`\varepsilon_{s2}`, L`\varepsilon_{cu3}\,\dfrac{x_u - d'}{x_u}`, e2 * 1000, "‰", 2), S("s2", L`\sigma_{s2}`, L`E_s\,\varepsilon_{s2}\ \ (\le f_{yd})`, s2, "MPa", 1),
      R("MRd", L`M_{Rd}`, L`\lambda x_u\,b\,\eta f_{cd}\left(d - \tfrac{\lambda}{2}x_u\right) + A_s'\,\sigma_{s2}\,(d - d')`, Mr * 1000, "kN·m", 1),
      S("xd", L`x_u/d`, "~ductilité", x / I.d, "", 3)],
      checks: [C("$M_{Ed} \\le M_{Rd}$", I.M <= Mr * 1000, `${f2(I.M, 0)} ≤ ${f2(Mr * 1000, 0)} kN·m`, I.M / (Mr * 1000)),
        C("Aciers tendus plastifiés : $\\varepsilon_{s1} \\ge \\varepsilon_{yd}$", e1 >= fy / Es, `${f2(e1 * 1000)} ≥ ${f2(fy / Es * 1000)} ‰`)],
      notes: ["Diagramme rectangulaire simplifié du béton, acier à palier horizontal ; la contrainte des aciers comprimés est déduite de leur déformation (déduction du béton déplacé négligée)."] };
  },
  fig(I, g) { return KIT.section({ b: I.b, h: I.h, d: I.d, As: I.As, nb: 5, As2: I.As2, nb2: 3, d2: I.d2, x: g("x"), lam: 0.8, z: true, fcl: "η fcd", Fs: `MRd = ${f2(g("MRd"), 0)} kN·m` }); },
  clair: (I, g) => `Cette section résiste à ${f2(g("MRd"), 0)} kN·m ; le moment appliqué en utilise ${f2(I.M / g("MRd") * 100, 0)} %.` },

/* ─────────── FLEXION COMPOSÉE — RECTANGLE ─────────── */
{ id: "ec2-nm-rect", t: "Flexion composée : diagramme d'interaction N–M (rectangle)", ref: "NF EN 1992-1-1 — §3.1.7 (parabole-rectangle), §6.1 (pivots, fig. 6.1)",
  desc: "Courbe d'interaction d'une section rectangulaire armée sur deux faces, et vérification d'un couple (N, M). Compression comptée positivement.",
  inputs: [N("b", "Largeur", "m", 1.2, "b"), N("h", "Hauteur (dans le plan de flexion)", "m", 1.2, "h"), N("As1", "Aciers inférieurs", "cm²", 49.1, L`A_{s1}`), N("As2", "Aciers supérieurs", "cm²", 49.1, L`A_{s2}`),
    N("c", "Distance des aciers aux parements", "m", 0.07, "c"), N("Ned", "Effort normal (compression +)", "kN", 9000, L`N_{Ed}`), N("Med", "Moment", "kN·m", 3500, L`M_{Ed}`), ...COMMON_MAT],
  calc(I) {
    const B = HB.EC2.beton(I.fck), fy = fyd(I.fyk), bars = [{ y: I.h - I.c, A: I.As1 / 1e4 }, { y: I.c, A: I.As2 / 1e4 }], w = () => I.b;
    const Nmax = NM(60 * I.h, I.h, w, bars, B, fy).N, Nmin = -(I.As1 + I.As2) / 1e4 * fy;
    const side = I.Med >= 0 ? bars : bars.map(b => ({ y: I.h - b.y, A: b.A })), m = HB.EC2.mrdAt(I.Ned / 1000, I.h, w, side, B, fy);
    const Mr = abs(m.M) * 1000, ok = isFinite(Mr) && abs(I.Med) <= Mr;
    return { steps: [S("fcd", L`f_{cd}`, L`\dfrac{f_{ck}}{\gamma_c}`, B.fcd, "MPa", 2), S("fyd", L`f_{yd}`, L`\dfrac{f_{yk}}{\gamma_s}`, fy, "MPa", 1),
      R("NRd", L`N_{Rd,max}`, L`\textstyle\int \sigma_c\,dA + \sum A_s\,\sigma_s\ \ (\varepsilon = \varepsilon_{c2})`, Nmax * 1000, "kN", 0), S("NRt", L`N_{Rd,min}`, L`-(A_{s1} + A_{s2})\,f_{yd}`, Nmin * 1000, "kN", 0),
      S("x", L`x_u`, "~axe neutre sous $N_{Ed}$ (équilibre)", m.x, "m", 3), R("MRd", L`M_{Rd}(N_{Ed})`, L`\textstyle\int \sigma_c\,(h/2 - y)\,dA + \sum A_s\,\sigma_s\,(h/2 - y_s)`, Mr, "kN·m", 0),
      S("rho", L`\rho`, L`\dfrac{A_{s1} + A_{s2}}{b\,h}`, (I.As1 + I.As2) / 1e4 / (I.b * I.h) * 100, "%", 2)],
      checks: [C("$N_{Rd,min} \\le N_{Ed} \\le N_{Rd,max}$", I.Ned / 1000 >= Nmin && I.Ned / 1000 <= Nmax, `${f2(I.Ned, 0)} kN`), C("$|M_{Ed}| \\le M_{Rd}(N_{Ed})$", ok, `${f2(abs(I.Med), 0)} ≤ ${f2(Mr, 0)} kN·m`, abs(I.Med) / Mr)],
      vals: { Nmax: Nmax * 1000 },
      notes: ["Intégration par fibres avec la loi parabole-rectangle et l'acier à palier horizontal ; pivots A–B–C de la figure 6.1. Les effets du second ordre et l'excentricité minimale $e_0 = \\max(h/30 ; 20\\ \\text{mm})$ sont à inclure dans $M_{Ed}$."] };
  },
  fig(I, g) {
    const B = HB.EC2.beton(I.fck), fy = fyd(I.fyk), bars = [{ y: I.h - I.c, A: I.As1 / 1e4 }, { y: I.c, A: I.As2 / 1e4 }], it = HB.EC2.interaction(I.h, () => I.b, bars, B, fy);
    const pts = it.pos.map(p => [p.M * 1000, p.N * 1000]), ptn = it.neg.map(p => [-p.M * 1000, p.N * 1000]);
    return plot({ series: [{ pts, l: "frontière M > 0" }, { pts: ptn, c: K.blue, w: 1.4, dash: "5 3", l: "frontière M < 0" }], marks: [{ x: I.Med, y: I.Ned, l: `(MEd ; NEd)` }], xl: "M (kN·m)", yl: "N (kN)", ymin: min(0, ...pts.map(p => p[1])) * 1.1, ymax: g("Nmax") * 1.08 });
  },
  clair: (I, g) => `Sous ${f2(I.Ned, 0)} kN de compression, la section peut reprendre jusqu'à ${f2(g("MRd"), 0)} kN·m ; le point de calcul est ${abs(I.Med) <= g("MRd") ? "à l'intérieur de la courbe : la section convient" : "à l'extérieur de la courbe : renforcer"}.` },

/* ─────────── FLEXION COMPOSÉE — SECTION CIRCULAIRE ─────────── */
{ id: "ec2-nm-circ", t: "Flexion composée : section circulaire (pieu, fût de pile)", ref: "NF EN 1992-1-1 — §3.1.7, §6.1 ; barres réparties sur un cercle",
  desc: "Moment résistant sous effort normal d'une section circulaire pleine à barres régulièrement réparties, et courbe d'interaction.",
  inputs: [N("D", "Diamètre", "m", 1.2, "D"), N("n", "Nombre de barres", "U", 20, "n"), SEL("phi", "Diamètre des barres", PHI, "25", L`\varnothing`),
    N("c", "Distance de l'axe des barres au parement", "m", 0.075, "c"), N("Ned", "Effort normal (compression +)", "kN", 6000, L`N_{Ed}`), N("Med", "Moment", "kN·m", 2000, L`M_{Ed}`), ...COMMON_MAT],
  calc(I) {
    const B = HB.EC2.beton(I.fck), fy = fyd(I.fyk), Rr = I.D / 2, rs = Rr - I.c, nb = max(4, Math.round(I.n)), Ab = ACIER_HA[I.phi] / 1e4;
    const bars = range(0, nb - 1, nb - 1).map(i => ({ y: Rr - rs * Math.cos(2 * PI * i / nb), A: Ab })), w = y => 2 * sqrt(max(0, Rr * Rr - (y - Rr) ** 2));
    const m = HB.EC2.mrdAt(I.Ned / 1000, I.D, w, bars, B, fy), Mr = abs(m.M) * 1000, Nmax = NM(60 * I.D, I.D, w, bars, B, fy).N * 1000, As = nb * Ab, Ac = PI * Rr * Rr;
    return { steps: [S("As", L`A_s`, L`n\,\dfrac{\pi\varnothing^2}{4}`, As * 1e4, "cm²", 2), S("rho", L`\rho`, L`\dfrac{A_s}{A_c}`, As / Ac * 100, "%", 2),
      S("fcd", L`f_{cd}`, L`\dfrac{f_{ck}}{\gamma_c}`, B.fcd, "MPa", 2), R("NRd", L`N_{Rd,max}`, "~compression centrée (déformation uniforme $\\varepsilon_{c2}$)", Nmax, "kN", 0),
      S("x", L`x_u`, "~axe neutre sous $N_{Ed}$", m.x, "m", 3), R("MRd", L`M_{Rd}(N_{Ed})`, "~intégration par fibres", Mr, "kN·m", 0),
      S("Asmin", L`A_{s,min}`, L`\max\left(0{,}10\,\dfrac{N_{Ed}}{f_{yd}}\ ;\ 0{,}002\,A_c\right)`, max(0.1 * I.Ned / 1000 / fy, 0.002 * Ac) * 1e4, "cm²", 2)],
      checks: [C("$|M_{Ed}| \\le M_{Rd}(N_{Ed})$", abs(I.Med) <= Mr, `${f2(abs(I.Med), 0)} ≤ ${f2(Mr, 0)} kN·m`, abs(I.Med) / Mr), C("$A_s \\ge A_{s,min}$ (§9.5.2)", As >= max(0.1 * I.Ned / 1000 / fy, 0.002 * Ac), `${f2(As * 1e4)} cm²`)],
      vals: { Nmax },
      notes: ["Pour les pieux forés, l'AN et la NF P94-262 imposent en outre une réduction de la résistance du béton ($f_{ck}^*$) et un minimum de 0,5 % (pieux) — voir rubrique Géotechnique."] };
  },
  fig(I, g) {
    const B = HB.EC2.beton(I.fck), fy = fyd(I.fyk), Rr = I.D / 2, rs = Rr - I.c, nb = max(4, Math.round(I.n)), Ab = ACIER_HA[I.phi] / 1e4;
    const bars = range(0, nb - 1, nb - 1).map(i => ({ y: Rr - rs * Math.cos(2 * PI * i / nb), A: Ab })), w = y => 2 * sqrt(max(0, Rr * Rr - (y - Rr) ** 2));
    const pts = HB.EC2.interaction(I.D, w, bars, B, fy).pos.map(p => [p.M * 1000, p.N * 1000]);
    return plot({ series: [{ pts, l: "frontière de résistance" }, { pts: pts.map(p => [-p[0], p[1]]), c: K.gold, w: 2 }], marks: [{ x: I.Med, y: I.Ned, l: "(MEd ; NEd)" }], xl: "M (kN·m)", yl: "N (kN)", ymin: min(...pts.map(p => p[1])) * 1.1, ymax: g("NRd") * 1.08 });
  },
  clair: (I, g) => `Avec ${Math.round(I.n)} HA${I.phi}, ce fût de ${f2(I.D, 2)} m résiste à ${f2(g("MRd"), 0)} kN·m sous ${f2(I.Ned, 0)} kN ; taux de travail ${f2(abs(I.Med) / g("MRd") * 100, 0)} %.` },

/* ─────────── EFFORT TRANCHANT SANS ARMATURES ─────────── */
{ id: "ec2-vrdc", t: "Effort tranchant résistant sans armatures VRd,c", ref: "NF EN 1992-1-1 — §6.2.2 (6.2a), (6.2b) et AN française",
  desc: "Résistance à l'effort tranchant des éléments sans armatures transversales (dalles, voiles, poutres), avec l'effet favorable de la compression.",
  inputs: [N("V", "Effort tranchant", "kN", 380, L`V_{Ed}`), N("bw", "Largeur (1 m pour une dalle)", "m", 1, L`b_w`), N("h", "Épaisseur", "m", 0.35, "h"), N("d", "Hauteur utile", "m", 0.30, "d"),
    N("Asl", "Armatures longitudinales tendues ancrées", "cm²", 15.7, L`A_{sl}`), N("Ned", "Effort normal (compression +)", "kN", 0, L`N_{Ed}`), N("fck", "Résistance du béton", "MPa", 35, L`f_{ck}`),
    N("gc", "Coefficient béton", "", 1.5, L`\gamma_c`), SEL("type", "Type d'élément (valeur de vmin)", VMIN_SEL, "d", "")],
  calc(I) {
    const k = min(1 + sqrt(0.2 / I.d), 2), rl = min(I.Asl / 1e4 / (I.bw * I.d), 0.02), fcd = I.fck / I.gc, scp = min(I.Ned / 1000 / (I.bw * I.h), 0.2 * fcd);
    const CR = 0.18 / I.gc, v1 = CR * k * cbrt(100 * rl * I.fck), vm = vminFR(I.type, k, I.fck, I.gc), Vr = (max(v1, vm) + 0.15 * scp) * I.bw * I.d * 1000;
    const nu = 0.6 * (1 - I.fck / 250), Vmax = 0.5 * I.bw * I.d * nu * fcd * 1000;
    return { steps: [S("k", "k", L`1 + \sqrt{\dfrac{200}{d}} \le 2`, k, "", 3), S("rl", L`\rho_l`, L`\dfrac{A_{sl}}{b_w\,d} \le 0{,}02`, rl * 100, "%", 3),
      S("scp", L`\sigma_{cp}`, L`\dfrac{N_{Ed}}{A_c} < 0{,}2\,f_{cd}`, scp, "MPa", 2), S("v1", L`v_{Rd,c}`, L`\dfrac{0{,}18}{\gamma_c}\,k\,(100\,\rho_l\,f_{ck})^{1/3}`, v1, "MPa", 3),
      S("vmin", L`v_{min}`, vminTex(I.type), vm, "MPa", 3), R("VRdc", L`V_{Rd,c}`, L`\left[\max\left(v_{Rd,c}\ ;\ v_{min}\right) + 0{,}15\,\sigma_{cp}\right] b_w\,d`, Vr, "kN", 1),
      S("Vmax", L`V_{Ed,max}`, L`0{,}5\,b_w\,d\,\nu\,f_{cd}`, Vmax, "kN", 0)],
      checks: [C("$V_{Ed} \\le V_{Rd,c}$ : pas d'armatures d'effort tranchant requises", I.V <= Vr, `${f2(I.V, 0)} ≤ ${f2(Vr, 0)} kN`, I.V / Vr), C("$V_{Ed} \\le 0{,}5\\,b_w d\\,\\nu f_{cd}$ (6.5)", I.V <= Vmax, `${f2(I.V, 0)} ≤ ${f2(Vmax, 0)} kN`, I.V / Vmax)],
      notes: ["$C_{Rd,c} = 0{,}18/\\gamma_c$ et $k_1 = 0{,}15$. $A_{sl}$ doit être prolongée d'au moins $l_{bd} + d$ au-delà de la section étudiée. Si $V_{Ed} > V_{Rd,c}$ : voir « Effort tranchant : armatures et bielles »."] };
  },
  fig(I, g) {
    const k = g("k"), pts = range(0.1, 2, 40).map(r => [r, max(0.18 / I.gc * k * cbrt(r * I.fck), g("vmin")) * I.bw * I.d * 1000 + 0.15 * g("scp") * I.bw * I.d * 1000]);
    return plot({ series: [{ pts, l: "VRd,c selon ρl" }], hlines: [{ y: I.V, l: `VEd = ${f2(I.V, 0)} kN`, c: K.red }], marks: [{ x: min(g("rl"), 2), y: g("VRdc"), l: `${f2(g("VRdc"), 0)} kN` }], xl: "ρl (%)", yl: "kN", xmin: 0, ymin: 0 });
  },
  clair: (I, g) => I.V <= g("VRdc") ? `Le béton seul reprend ${f2(g("VRdc"), 0)} kN d'effort tranchant : les ${f2(I.V, 0)} kN appliqués ne nécessitent pas d'étriers.` : `Le béton seul ne reprend que ${f2(g("VRdc"), 0)} kN : il faut des armatures d'effort tranchant.` },

/* ─────────── POINÇONNEMENT ─────────── */
{ id: "ec2-poinconnement", t: "Poinçonnement d'une dalle sous charge concentrée", ref: "NF EN 1992-1-1 — §6.4.2 à 6.4.5 (A1:2014 pour vRd,max)",
  desc: "Contrôle au contour de référence u₁ (à 2d), au nu de l'aire chargée u₀, et armatures de poinçonnement éventuelles.",
  inputs: [N("V", "Effort de poinçonnement", "kN", 1100, L`V_{Ed}`), N("c1", "Dimension de l'aire chargée", "m", 0.6, L`c_1`), N("c2", "Autre dimension", "m", 0.6, L`c_2`),
    N("d", "Hauteur utile moyenne", "m", 0.32, L`d_{eff}`), N("rx", "Pourcentage d'acier sens x", "%", 0.8, L`\rho_{lx}`), N("ry", "Pourcentage d'acier sens y", "%", 0.8, L`\rho_{ly}`),
    SEL("beta", "Position", [["1.15", "Intérieure (β = 1,15)"], ["1.4", "De rive (β = 1,4)"], ["1.5", "D'angle (β = 1,5)"]], "1.15", L`\beta`),
    N("fck", "Résistance du béton", "MPa", 35, L`f_{ck}`), N("fyk", "Acier des armatures de poinçonnement", "MPa", 500, L`f_{ywk}`)],
  calc(I) {
    const be = +I.beta, d = I.d, k = min(1 + sqrt(0.2 / d), 2), rl = min(sqrt(I.rx * I.ry) / 100, 0.02), fcd = I.fck / 1.5, nu = 0.6 * (1 - I.fck / 250), V = I.V / 1000;
    const u0 = 2 * (I.c1 + I.c2), u1 = u0 + 4 * PI * d, vr = max(0.18 / 1.5 * k * cbrt(100 * rl * I.fck), 0.035 * pow(k, 1.5) * sqrt(I.fck));
    const v1 = be * V / (u1 * d), v0 = be * V / (u0 * d), vmax = 0.4 * nu * fcd, fyef = min(250 + 0.25 * d * 1000, I.fyk / 1.15);
    const Asw = v1 > vr ? (v1 - 0.75 * vr) * u1 * d / (1.5 * d * fyef) * 1e4 : 0, uout = be * V / (vr * d);
    return { steps: [S("u0", L`u_0`, L`2\,(c_1 + c_2)`, u0, "m", 3), S("u1", L`u_1`, L`2\,(c_1 + c_2) + 4\pi d`, u1, "m", 3), S("k", "k", L`1 + \sqrt{200/d} \le 2`, k, "", 3),
      S("rl", L`\rho_l`, L`\sqrt{\rho_{lx}\,\rho_{ly}} \le 0{,}02`, rl * 100, "%", 3), R("v1", L`v_{Ed,1}`, L`\beta\,\dfrac{V_{Ed}}{u_1\,d}`, v1, "MPa", 3),
      S("vRdc", L`v_{Rd,c}`, L`\max\left(\dfrac{0{,}18}{\gamma_c}k\,(100\rho_l f_{ck})^{1/3}\ ;\ 0{,}035\,k^{3/2}\sqrt{f_{ck}}\right)`, vr, "MPa", 3),
      S("v0", L`v_{Ed,0}`, L`\beta\,\dfrac{V_{Ed}}{u_0\,d}`, v0, "MPa", 3), S("vmax", L`v_{Rd,max}`, L`0{,}4\,\nu\,f_{cd}`, vmax, "MPa", 3),
      R("Asw", L`\dfrac{A_{sw}}{s_r}`, v1 > vr ? L`\dfrac{(v_{Ed} - 0{,}75\,v_{Rd,c})\,u_1}{1{,}5\,f_{ywd,ef}}` : "~non nécessaires", Asw, "cm²/m", 2),
      S("uout", L`u_{out}`, L`\beta\,\dfrac{V_{Ed}}{v_{Rd,c}\,d}`, uout, "m", 2)],
      checks: [C("Bielles au nu : $v_{Ed,0} \\le v_{Rd,max}$", v0 <= vmax, `${f2(v0)} ≤ ${f2(vmax)} MPa`, v0 / vmax), C("Contour $u_1$ : $v_{Ed,1} \\le v_{Rd,c}$ (sans armatures)", v1 <= vr, `${f2(v1, 3)} ≤ ${f2(vr, 3)} MPa`, v1 / vr),
        C("Avec armatures : $v_{Ed,1} \\le 1{,}5\\,v_{Rd,c}$ (ordre de grandeur usuel)", v1 <= 1.5 * vr, `${f2(v1, 3)} ≤ ${f2(1.5 * vr, 3)} MPa`)],
      notes: ["Aire chargée intérieure rectangulaire, loin des ouvertures. $\\beta$ : valeurs forfaitaires de la figure 6.21N. $f_{ywd,ef} = 250 + 0{,}25\\,d \\le f_{ywd}$ ; armatures verticales, $s_r = 0{,}75\\,d$. Le contour $u_{out}$ indique jusqu'où les armatures doivent s'étendre (dernier cours à $1{,}5\\,d$ en deçà)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 180, cx = 120, cy = 90, d = I.d, sc = 60 / (max(I.c1, I.c2) / 2 + 2 * d + 0.05), a = I.c1 / 2 * sc, b = I.c2 / 2 * sc, r = 2 * d * sc;
    let s = Rc(10, 10, 220, 160, { f: "#f4f1ea", c: K.concD }) + Rc(cx - a, cy - b, 2 * a, 2 * b, { f: K.concD, c: K.ink });
    s += P(`M${cx - a} ${cy - b - r}H${cx + a}A${r} ${r} 0 0 1 ${cx + a + r} ${cy - b}V${cy + b}A${r} ${r} 0 0 1 ${cx + a} ${cy + b + r}H${cx - a}A${r} ${r} 0 0 1 ${cx - a - r} ${cy + b}V${cy - b}A${r} ${r} 0 0 1 ${cx - a} ${cy - b - r}Z`, { c: K.red, w: 1.6, dash: "6 3" });
    s += T(cx, cy + b + r + 12, "u₁ (à 2d)", { a: "middle", s: 9, c: K.red }) + T(cx, cy + 3, "u₀", { a: "middle", s: 9, c: "#fff" }) + dim(cx + a, cx + a + r, cy - 4, "2d");
    const gx = 238, rr = [["vEd,1 / vRd,c", g("v1") / g("vRdc")], ["vEd,0 / vRd,max", g("v0") / g("vmax")]];
    rr.forEach(([l, v], i) => { s += HB.FIG.gauge(gx, 40 + i * 52, 84, v, l); });
    return svg(W, Hh, s);
  },
  clair: (I, g) => g("v1") <= g("vRdc") ? `La dalle résiste au poinçonnement sans armatures spécifiques (contrainte ${f2(g("v1"), 2)} MPa pour ${f2(g("vRdc"), 2)} MPa admissibles).` : `La dalle doit être armée au poinçonnement : ${f2(g("Asw"), 1)} cm² par mètre de rayon, jusqu'au contour u_out = ${f2(g("uout"), 1)} m.` },

/* ─────────── TORSION ─────────── */
{ id: "ec2-torsion", t: "Torsion : section creuse équivalente", ref: "NF EN 1992-1-1 — §6.3.1, 6.3.2 (6.26) à (6.30)",
  desc: "Armatures transversales et longitudinales de torsion, résistance des bielles et interaction avec l'effort tranchant.",
  inputs: [N("T", "Moment de torsion", "kN·m", 450, L`T_{Ed}`), N("V", "Effort tranchant concomitant", "kN", 600, L`V_{Ed}`), N("b", "Largeur", "m", 0.6, "b"), N("h", "Hauteur", "m", 1.2, "h"),
    N("c", "Axe des armatures longitudinales au parement", "m", 0.06, "c"), N("cot", "Inclinaison des bielles", "", 1.5, L`\cot\theta`), ...COMMON_MAT],
  calc(I) {
    const B = HB.EC2.beton(I.fck), fy = fyd(I.fyk), A = I.b * I.h, u = 2 * (I.b + I.h), tef = max(A / u, 2 * I.c), Ak = (I.b - tef) * (I.h - tef), uk = 2 * (I.b + I.h - 2 * tef);
    const Tm = I.T / 1000, th = Math.atan(1 / I.cot), tau = Tm / (2 * Ak * tef), TRm = 2 * B.nu * B.fcd * Ak * tef * Math.sin(th) * Math.cos(th);
    const z = 0.9 * (I.h - I.c), VRm = I.b * z * B.nu * B.fcd / (I.cot + 1 / I.cot), inter = Tm / TRm + I.V / 1000 / VRm;
    const At = Tm / (2 * Ak * fy * I.cot) * 1e4, Al = Tm * uk * I.cot / (2 * Ak * fy) * 1e4;
    return { steps: [S("tef", L`t_{ef}`, L`\max\left(\dfrac{A}{u}\ ;\ 2\,c\right)`, tef, "m", 3), S("Ak", L`A_k`, L`(b - t_{ef})(h - t_{ef})`, Ak, "m²", 4), S("uk", L`u_k`, L`2\,(b + h - 2\,t_{ef})`, uk, "m", 3),
      S("tau", L`\tau_{t}`, L`\dfrac{T_{Ed}}{2\,A_k\,t_{ef}}`, tau, "MPa", 2), R("At", L`\dfrac{A_{sw}}{s}`, L`\dfrac{T_{Ed}}{2\,A_k\,f_{yd}\cot\theta}` + "\\quad\\text{(par brin)}", At, "cm²/m", 2),
      R("Al", L`\textstyle\sum A_{sl}`, L`\dfrac{T_{Ed}\,u_k\cot\theta}{2\,A_k\,f_{yd}}`, Al, "cm²", 2), S("TRd", L`T_{Rd,max}`, L`2\,\nu\,\alpha_{cw} f_{cd}\,A_k\,t_{ef}\sin\theta\cos\theta`, TRm * 1000, "kN·m", 0),
      S("VRd", L`V_{Rd,max}`, L`\dfrac{b\,z\,\nu f_{cd}}{\cot\theta + \tan\theta}`, VRm * 1000, "kN", 0), R("inter", "", L`\dfrac{T_{Ed}}{T_{Rd,max}} + \dfrac{V_{Ed}}{V_{Rd,max}}`, inter, "", 3)],
      checks: [C("Bielles : $T_{Ed}/T_{Rd,max} + V_{Ed}/V_{Rd,max} \\le 1$", inter <= 1, f2(inter, 3), inter), C("$1 \\le \\cot\\theta \\le 2{,}5$", I.cot >= 1 && I.cot <= 2.5, f2(I.cot, 2))],
      notes: ["Les cadres de torsion s'ajoutent à ceux de l'effort tranchant ($A_{sw}/s$ par brin extérieur) ; les armatures longitudinales sont réparties sur $u_k$, avec au moins une barre à chaque angle. $\\alpha_{cw} = 1$ (pas de précontrainte)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 175, k = min(140 / I.h, 150 / I.b), w = I.b * k, h = I.h * k, x = 40, y = 15, t = g("tef") * k; let s = Rc(x, y, w, h) + Rc(x + t, y + t, w - 2 * t, h - 2 * t, { f: "#fff", c: K.concD, op: .9 });
    s += P(`M${x + t / 2} ${y + t / 2}H${x + w - t / 2}V${y + h - t / 2}H${x + t / 2}Z`, { c: K.red, w: 1.4, dash: "5 3" });
    s += arrow(x + w / 2 - 10, y + t / 2, x + w / 2 + 10, y + t / 2) + arrow(x + w - t / 2, y + h / 2 - 10, x + w - t / 2, y + h / 2 + 10) + arrow(x + w / 2 + 10, y + h - t / 2, x + w / 2 - 10, y + h - t / 2) + arrow(x + t / 2, y + h / 2 + 10, x + t / 2, y + h / 2 - 10);
    s += T(x + w + 8, y + 14, "flux q = T/2Aₖ", { s: 9, c: K.red }) + dim(x, x + t, y + h + 12, "tef") + T(x + w / 2, y + h / 2 + 3, "Aₖ", { a: "middle", s: 10, c: K.mute });
    s += HB.FIG.gauge(200, 120, 120, g("inter"), "interaction T + V");
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La torsion circule comme un flux dans une paroi de ${f2(g("tef") * 100, 0)} cm : ${f2(g("At"), 2)} cm²/m de cadres (par brin) et ${f2(g("Al"), 1)} cm² de barres longitudinales en plus.` },

/* ─────────── OUVERTURE DES FISSURES ─────────── */
{ id: "ec2-fissuration", t: "Ouverture des fissures wk", ref: "NF EN 1992-1-1 — §7.3.4 (7.8) à (7.11), AN française (k₃), tableau 7.1NF",
  desc: "Calcul direct de l'ouverture des fissures d'une section rectangulaire fléchie sous combinaison quasi permanente (ou fréquente selon la classe).",
  inputs: [N("M", "Moment de service", "kN·m", 420, L`M_{ser}`), N("b", "Largeur", "m", 1, "b"), N("h", "Hauteur", "m", 0.8, "h"), N("d", "Hauteur utile", "m", 0.73, "d"),
    N("As", "Armatures tendues", "cm²", 31.4, L`A_s`), N("phi", "Diamètre des barres", "mm", 20, L`\varnothing`), N("cnom", "Enrobage des barres", "mm", 50, "c"),
    N("fck", "Résistance du béton", "MPa", 35, L`f_{ck}`), N("ae", "Coefficient d'équivalence (long terme)", "", 15, L`\alpha_e`),
    N("kt", "Coefficient de durée", "", 0.4, L`k_t`), N("wmax", "Ouverture admissible", "mm", 0.3, L`w_{max}`)],
  calc(I) {
    const B = HB.EC2.beton(I.fck), As = I.As / 1e4, cr = crackRect(I.b, I.d, As, 0, 0, I.ae), M = I.M / 1000, ss = I.ae * M * (I.d - cr.x) / cr.I;
    const hc = min(2.5 * (I.h - I.d), (I.h - cr.x) / 3, I.h / 2), rp = As / (I.b * hc), ae2 = Es / B.Ecm;
    const de = max((ss - I.kt * B.fctm / rp * (1 + ae2 * rp)) / Es, 0.6 * ss / Es), k3 = I.cnom > 25 ? 3.4 * pow(25 / I.cnom, 2 / 3) : 3.4;
    const sr = k3 * I.cnom + 0.8 * 0.5 * 0.425 * I.phi / rp, wk = sr * de;
    return { steps: [S("x", "x", L`\tfrac{1}{2}\,b\,x^2 = \alpha_e A_s\,(d - x)`, cr.x, "m", 3), R("ss", L`\sigma_s`, L`\alpha_e\,\dfrac{M_{ser}\,(d - x)}{I_{cf}}`, ss, "MPa", 1),
      S("hc", L`h_{c,ef}`, L`\min\left(2{,}5\,(h - d)\ ;\ \dfrac{h - x}{3}\ ;\ \dfrac{h}{2}\right)`, hc, "m", 3), S("rp", L`\rho_{p,eff}`, L`\dfrac{A_s}{b\,h_{c,ef}}`, rp, "", 4),
      S("de", L`\varepsilon_{sm} - \varepsilon_{cm}`, L`\dfrac{\sigma_s - k_t\,\dfrac{f_{ct,eff}}{\rho_{p,eff}}\,(1 + \alpha_e'\rho_{p,eff})}{E_s} \ge 0{,}6\,\dfrac{\sigma_s}{E_s}`, de * 1000, "‰", 3),
      S("k3", L`k_3`, I.cnom > 25 ? L`3{,}4\left(\dfrac{25}{c}\right)^{2/3}` : L`3{,}4`, k3, "", 3),
      S("sr", L`s_{r,max}`, L`k_3\,c + k_1 k_2 k_4\,\dfrac{\varnothing}{\rho_{p,eff}}`, sr, "mm", 0), R("wk", L`w_k`, L`s_{r,max}\,(\varepsilon_{sm} - \varepsilon_{cm})`, wk, "mm", 3)],
      checks: [C("$w_k \\le w_{max}$", wk <= I.wmax, `${f2(wk, 3)} ≤ ${f2(I.wmax, 2)} mm`, wk / I.wmax)],
      notes: [`$f_{ct,eff} = f_{ctm} = ${f2(B.fctm)}$ MPa, $\\alpha_e' = E_s/E_{cm} = ${f2(ae2)}$, $k_1 = 0{,}8$ (HA), $k_2 = 0{,}5$ (flexion), $k_4 = 0{,}425$. Espacement des barres supposé $\\le 5\\,(c + \\varnothing/2)$. Valeurs de $w_{max}$ : tableau 7.1NF et NF EN 1992-2/AN pour les ponts.`] };
  },
  fig(I, g) {
    const B = HB.EC2.beton(I.fck), As = I.As / 1e4, cr = crackRect(I.b, I.d, As, 0, 0, I.ae), hc = min(2.5 * (I.h - I.d), (I.h - cr.x) / 3, I.h / 2), rp = As / (I.b * hc), ae2 = Es / B.Ecm, sr = g("sr");
    const wk = Mk => { const ss = I.ae * Mk / 1000 * (I.d - cr.x) / cr.I; return sr * max((ss - I.kt * B.fctm / rp * (1 + ae2 * rp)) / Es, 0.6 * ss / Es); };
    const pts = range(0, 1.6 * I.M, 60).map(m => [m, wk(m)]);
    return plot({ series: [{ pts, l: "wk selon le moment de service" }], hlines: [{ y: I.wmax, l: `wmax = ${f2(I.wmax, 2)} mm`, c: K.red }], marks: [{ x: I.M, y: g("wk"), l: `${f2(g("wk"), 3)} mm` }], xl: "M (kN·m)", yl: "wk (mm)", ymin: 0 });
  },
  clair: (I, g) => `Les fissures s'ouvrent d'environ ${f2(g("wk"), 2)} mm (limite ${f2(I.wmax, 2)} mm), espacées au plus de ${f2(g("sr"), 0)} mm ; l'acier travaille à ${f2(g("ss"), 0)} MPa.` },

/* ─────────── FERRAILLAGE MINIMAL DE NON-FRAGILITÉ / FISSURATION ─────────── */
{ id: "ec2-asmin-fiss", t: "Section minimale d'armatures de maîtrise de la fissuration", ref: "NF EN 1992-1-1 — §7.3.2 (7.1), (7.2), §7.3.3 tableau 7.2N et (7.6N)",
  desc: "Armatures minimales dans les zones tendues, avec la contrainte d'acier admissible déduite du diamètre des barres et de l'ouverture visée.",
  inputs: [SEL("cas", "Sollicitation", [["f", "Flexion simple (kc = 0,4)"], ["t", "Traction pure (kc = 1)"]], "f", ""), N("b", "Largeur", "m", 1, "b"), N("h", "Hauteur", "m", 0.6, "h"),
    N("d", "Hauteur utile", "m", 0.54, "d"), N("sc", "Contrainte moyenne de compression", "MPa", 0, L`\sigma_c`), N("fct", "Résistance en traction au moment de la fissuration", "MPa", 3.2, L`f_{ct,eff}`),
    N("phi", "Diamètre des barres", "mm", 16, L`\varnothing`), SEL("wk", "Ouverture visée", [["0.4", "0,4 mm"], ["0.3", "0,3 mm"], ["0.2", "0,2 mm"]], "0.3", L`w_k`)],
  calc(I) {
    const hs = min(I.h, 1), k = I.h <= 0.3 ? 1 : I.h >= 0.8 ? 0.65 : 1 - 0.35 * (I.h - 0.3) / 0.5;
    const kc = I.cas === "t" ? 1 : min(1, max(0, 0.4 * (1 - I.sc / (1.5 * (I.h / hs) * I.fct))));
    const Act = I.cas === "t" ? I.b * I.h : I.b * I.h / 2 * I.fct / (I.sc + I.fct), hcr = Act / I.b;
    const phis = I.cas === "t" ? I.phi * 2.9 / I.fct * 8 * (I.h - I.d) / (kc * hcr) : I.phi * 2.9 / I.fct * 2 * (I.h - I.d) / (kc * hcr);
    const tab = { "0.4": [40, 32, 20, 16, 12, 10, 8, 6], "0.3": [32, 25, 16, 12, 10, 8, 6, 5], "0.2": [25, 16, 12, 8, 6, 5, 4, 0] }[I.wk], sig = [160, 200, 240, 280, 320, 360, 400, 450];
    const nv = I.wk === "0.2" ? 7 : 8; let ss = sig[nv - 1];
    if (phis >= tab[0]) ss = 160; else for (let i = 0; i < nv - 1; i++) if (phis <= tab[i] && phis >= tab[i + 1]) { ss = sig[i] + (sig[i + 1] - sig[i]) * (tab[i] - phis) / (tab[i] - tab[i + 1]); break; }
    const As = kc * k * I.fct * Act / ss * 1e4;
    return { steps: [S("k", "k", "~effet des contraintes non uniformes autoéquilibrées", k, "", 3), S("kc", L`k_c`, I.cas === "t" ? "~traction pure" : L`0{,}4\left[1 - \dfrac{\sigma_c}{k_1\,(h/h^*)\,f_{ct,eff}}\right] \le 1`, kc, "", 3),
      S("Act", L`A_{ct}`, "~aire de béton tendu juste avant la fissuration", Act, "m²", 4), S("phis", L`\varnothing_s^*`, I.cas === "t" ? L`\varnothing\,\dfrac{2{,}9}{f_{ct,eff}}\,\dfrac{8\,(h - d)}{k_c\,h_{cr}}` : L`\varnothing\,\dfrac{2{,}9}{f_{ct,eff}}\,\dfrac{2\,(h - d)}{k_c\,h_{cr}}`, phis, "mm", 1),
      S("ss", L`\sigma_s`, "~tableau 7.2N (interpolé)", ss, "MPa", 0), R("As", L`A_{s,min}`, L`\dfrac{k_c\,k\,f_{ct,eff}\,A_{ct}}{\sigma_s}`, As, "cm²", 2)],
      notes: ["Le tableau 7.2N donne le diamètre maximal $\\varnothing_s^*$ en fonction de $\\sigma_s$ pour $f_{ct,eff} = 2{,}9$ MPa ; la formule (7.6N) ramène le diamètre réel au diamètre du tableau. $f_{ct,eff} = f_{ctm}(t)$ à l'âge de la fissuration attendue (au jeune âge pour le retrait gêné).", "Pour la traction pure, l'armature est à répartir sur les deux faces."] };
  },
  fig(I, g) {
    const tab = { "0.4": [40, 32, 20, 16, 12, 10, 8, 6], "0.3": [32, 25, 16, 12, 10, 8, 6, 5], "0.2": [25, 16, 12, 8, 6, 5, 4, 0] }, sig = [160, 200, 240, 280, 320, 360, 400, 450];
    return plot({ series: [{ pts: sig.map((s, i) => [s, tab["0.4"][i]]), l: "wk 0,4", c: K.mute, w: 1.2 }, { pts: sig.map((s, i) => [s, tab["0.3"][i]]), l: "wk 0,3" }, { pts: sig.slice(0, 7).map((s, i) => [s, tab["0.2"][i]]), l: "wk 0,2", c: K.blue, w: 1.4, dash: "5 3" }],
      marks: [{ x: g("ss"), y: min(g("phis"), 40), l: `σs = ${f2(g("ss"), 0)} MPa` }], xl: "σs (MPa)", yl: "∅s* (mm)", xmin: 160, xmax: 450, ymin: 0, ymax: 42 });
  },
  clair: (I, g) => `Pour que les fissures de retrait ou de flexion restent fines (${I.wk.replace(".", ",")} mm) avec des HA${f2(I.phi, 0)}, il faut au moins ${f2(g("As"), 1)} cm² d'acier dans la zone tendue.` },

/* ─────────── CONTRAINTES ELS ─────────── */
{ id: "ec2-els", t: "Contraintes de service d'une section fissurée", ref: "NF EN 1992-1-1 — §7.2 (2), (3), (5) ; section rectangulaire homogénéisée",
  desc: "Contraintes du béton et de l'acier sous combinaisons caractéristique et quasi permanente, comparées aux limites de l'Eurocode 2.",
  inputs: [N("Mc", "Moment ELS caractéristique", "kN·m", 520, L`M_{car}`), N("Mq", "Moment ELS quasi permanent", "kN·m", 360, L`M_{qp}`), N("b", "Largeur", "m", 1, "b"), N("h", "Hauteur", "m", 0.8, "h"),
    N("d", "Hauteur utile", "m", 0.73, "d"), N("As", "Armatures tendues", "cm²", 31.4, L`A_s`), N("As2", "Armatures comprimées", "cm²", 10, L`A_s'`), N("d2", "Position des aciers comprimés", "m", 0.06, L`d'`),
    N("ae", "Coefficient d'équivalence", "", 15, L`\alpha_e`), ...COMMON_MAT, SEL("xd", "Classe d'exposition XD, XF ou XS ?", [["o", "Oui (σc ≤ 0,6 fck)"], ["n", "Non"]], "o", "")],
  calc(I) {
    const cr = crackRect(I.b, I.d, I.As / 1e4, I.As2 / 1e4, I.d2, I.ae), sc = M => M / 1000 * cr.x / cr.I, ss = M => I.ae * M / 1000 * (I.d - cr.x) / cr.I;
    const sc1 = sc(I.Mc), sq = sc(I.Mq), s1 = ss(I.Mc);
    return { steps: [S("x", "x", L`\tfrac{1}{2}b\,x^2 + \alpha_e A_s'(x - d') = \alpha_e A_s\,(d - x)`, cr.x, "m", 4), S("I", L`I_{cf}`, L`\tfrac{1}{3}b\,x^3 + \alpha_e A_s(d - x)^2 + \alpha_e A_s'(x - d')^2`, cr.I, "m⁴", 5),
      R("sc", L`\sigma_{c,car}`, L`\dfrac{M_{car}\,x}{I_{cf}}`, sc1, "MPa", 2), R("sq", L`\sigma_{c,qp}`, L`\dfrac{M_{qp}\,x}{I_{cf}}`, sq, "MPa", 2), R("ss", L`\sigma_{s,car}`, L`\alpha_e\,\dfrac{M_{car}\,(d - x)}{I_{cf}}`, s1, "MPa", 1),
      S("ssq", L`\sigma_{s,qp}`, L`\alpha_e\,\dfrac{M_{qp}\,(d - x)}{I_{cf}}`, ss(I.Mq), "MPa", 1)],
      checks: [C(I.xd === "o" ? "$\\sigma_{c,car} \\le 0{,}6\\,f_{ck}$ (§7.2 (2))" : "$\\sigma_{c,car} \\le 0{,}6\\,f_{ck}$ (non exigé hors XD/XF/XS)", sc1 <= 0.6 * I.fck || I.xd === "n", `${f2(sc1)} ≤ ${f2(0.6 * I.fck, 1)} MPa`, sc1 / (0.6 * I.fck)),
        C("$\\sigma_{c,qp} \\le 0{,}45\\,f_{ck}$ (fluage linéaire, §7.2 (3))", sq <= 0.45 * I.fck, `${f2(sq)} ≤ ${f2(0.45 * I.fck, 2)} MPa`, sq / (0.45 * I.fck)),
        C("$\\sigma_{s,car} \\le 0{,}8\\,f_{yk}$ (§7.2 (5))", s1 <= 0.8 * I.fyk, `${f2(s1, 0)} ≤ ${f2(0.8 * I.fyk, 0)} MPa`, s1 / (0.8 * I.fyk))],
      notes: ["Section fissurée, béton tendu négligé. $\\alpha_e = E_s/E_{c,eff}$ : de l'ordre de 6 à 7 à court terme et 15 à 18 sous charges de longue durée."] };
  },
  fig(I, g) { return KIT.section({ b: I.b, h: I.h, d: I.d, As: I.As, nb: 5, As2: I.As2, nb2: 3, d2: I.d2, x: g("x"), block: false, tri: { sc: `σc = ${f2(g("sc"), 1)}`, ss: `σs = ${f2(g("ss"), 0)}` } }); },
  clair: (I, g) => `En service, le béton est comprimé à ${f2(g("sc"), 1)} MPa (${f2(g("sc") / I.fck * 100, 0)} % de fck) et l'acier tendu à ${f2(g("ss"), 0)} MPa (${f2(g("ss") / I.fyk * 100, 0)} % de fyk).` },

/* ─────────── ÉLANCEMENT L/d ─────────── */
{ id: "ec2-ld", t: "Flèche : élancement limite L/d", ref: "NF EN 1992-1-1 — §7.4.2 (7.16a), (7.16b), tableau 7.4N, (7.17)",
  desc: "Dispense de calcul des flèches par le rapport portée / hauteur utile, en fonction du pourcentage d'armatures et du système statique.",
  inputs: [N("L", "Portée", "m", 7, "L"), N("d", "Hauteur utile", "m", 0.32, "d"), N("b", "Largeur", "m", 1, "b"), N("As", "Armatures tendues nécessaires", "cm²", 14, L`A_{s,req}`),
    N("Asp", "Armatures tendues mises en place", "cm²", 15.7, L`A_{s,prov}`), N("As2", "Armatures comprimées", "cm²", 0, L`A_s'`), N("fck", "Résistance du béton", "MPa", 30, L`f_{ck}`), N("fyk", "Acier", "MPa", 500, L`f_{yk}`),
    SEL("K", "Système statique", [["1", "Travée isostatique (K = 1,0)"], ["1.3", "Travée de rive continue (1,3)"], ["1.5", "Travée intermédiaire (1,5)"], ["1.2", "Plancher-dalle (1,2)"], ["0.4", "Console (0,4)"]], "1", "K"),
    SEL("T", "Section en T (beff/bw > 3)", [["n", "Non"], ["o", "Oui (× 0,8)"]], "n", "")],
  calc(I) {
    const K_ = +I.K, r0 = sqrt(I.fck) * 1e-3, r = I.As / 1e4 / (I.b * I.d), r2 = I.As2 / 1e4 / (I.b * I.d), sf = sqrt(I.fck);
    const base = r <= r0 ? K_ * (11 + 1.5 * sf * r0 / r + 3.2 * sf * pow(r0 / r - 1, 1.5)) : K_ * (11 + 1.5 * sf * r0 / (r - r2) + sf / 12 * sqrt(r2 / r0));
    const k1 = min(500 / I.fyk * I.Asp / I.As, 1.5), k2 = I.T === "o" ? 0.8 : 1, k3 = I.L > 7 && K_ !== 0.4 ? 7 / I.L : 1, lim = base * k1 * k2 * k3, act = I.L / I.d;
    return { steps: [S("r0", L`\rho_0`, L`\sqrt{f_{ck}}\cdot 10^{-3}`, r0 * 100, "%", 3), S("r", L`\rho`, L`\dfrac{A_{s,req}}{b\,d}`, r * 100, "%", 3),
      S("base", L`\left(\tfrac{L}{d}\right)_{0}`, r <= r0 ? L`K\left[11 + 1{,}5\sqrt{f_{ck}}\,\dfrac{\rho_0}{\rho} + 3{,}2\sqrt{f_{ck}}\left(\dfrac{\rho_0}{\rho} - 1\right)^{3/2}\right]` : L`K\left[11 + 1{,}5\sqrt{f_{ck}}\,\dfrac{\rho_0}{\rho - \rho'} + \dfrac{1}{12}\sqrt{f_{ck}}\sqrt{\dfrac{\rho'}{\rho_0}}\right]`, base, "", 2),
      S("k1", L`\dfrac{310}{\sigma_s}`, L`\dfrac{500}{f_{yk}}\,\dfrac{A_{s,prov}}{A_{s,req}}\ \ (\le 1{,}5)`, k1, "", 3), S("k3", L`k_L`, I.L > 7 ? L`\dfrac{7}{L}\ \ (L > 7\ \text{m})` : "~sans objet ($L \\le 7$ m)", k3, "", 3),
      R("lim", L`\left(\tfrac{L}{d}\right)_{lim}`, L`\left(\tfrac{L}{d}\right)_{0} \times \dfrac{310}{\sigma_s} \times k_T \times k_L`, lim, "", 2), R("act", L`\tfrac{L}{d}`, "~élancement réel", act, "", 2)],
      checks: [C("$L/d \\le (L/d)_{lim}$ : calcul de flèche non nécessaire", act <= lim, `${f2(act, 1)} ≤ ${f2(lim, 1)}`, act / lim)],
      notes: ["Le coefficient $k_L = 7/L$ s'applique aux poutres et dalles supportant des cloisons fragiles (§7.4.2 (2)). Au-delà, calculer la flèche (§7.4.3)."] };
  },
  fig(I, g) {
    const K_ = +I.K, r0 = sqrt(I.fck) * 1e-3, sf = sqrt(I.fck), f = r => (r <= r0 ? K_ * (11 + 1.5 * sf * r0 / r + 3.2 * sf * pow(r0 / r - 1, 1.5)) : K_ * (11 + 1.5 * sf * r0 / r)) * g("k1") * (I.T === "o" ? 0.8 : 1) * g("k3");
    const pts = range(0.3, 2, 60).map(p => [p, f(p / 100)]);
    return plot({ series: [{ pts, l: "(L/d) limite selon ρ" }], hlines: [{ y: g("act"), l: `L/d réel = ${f2(g("act"), 1)}`, c: K.red }], vlines: [{ x: r0 * 100, l: "ρ0" }], marks: [{ x: min(max(g("r"), 0.3), 2), y: g("lim"), l: `${f2(g("lim"), 1)}` }], xl: "ρ (%)", yl: "L/d", ymin: 0, ymax: max(40, g("act") * 1.2) * K_ });
  },
  clair: (I, g) => g("act") <= g("lim") ? `L'élancement (${f2(g("act"), 1)}) reste sous la limite de ${f2(g("lim"), 1)} : la flèche n'a pas besoin d'être calculée.` : `L'élancement (${f2(g("act"), 1)}) dépasse la limite (${f2(g("lim"), 1)}) : calculer la flèche ou épaissir.` },

/* ─────────── ANCRAGE ─────────── */
{ id: "ec2-ancrage", t: "Longueur d'ancrage des armatures", ref: "NF EN 1992-1-1 — §8.4.2 (8.2), §8.4.3 (8.3), §8.4.4 (8.4), tableau 8.2",
  desc: "Contrainte d'adhérence ultime, longueur d'ancrage de référence et longueur de calcul d'une barre tendue (ancrage droit ou courbe).",
  inputs: [SEL("phi", "Diamètre de la barre", PHI, "20", L`\varnothing`), N("fck", "Résistance du béton", "MPa", 35, L`f_{ck}`), N("ssd", "Contrainte de calcul de la barre", "MPa", 434.8, L`\sigma_{sd}`),
    SEL("bond", "Conditions d'adhérence", [["b", "Bonnes (η₁ = 1)"], ["m", "Médiocres (η₁ = 0,7)"]], "b", L`\eta_1`), SEL("forme", "Forme de l'ancrage", [["d", "Droit"], ["c", "Crochet, coude ou boucle"]], "d", ""),
    N("cd", "Enrobage ou demi-entraxe déterminant", "mm", 40, L`c_d`), N("a3", "Effet du confinement par armatures transversales", "", 1, L`\alpha_3`), N("a5", "Effet de la pression transversale", "", 1, L`\alpha_5`)],
  calc(I) {
    const phi = +I.phi, b = fbdOf(I.fck, phi, I.bond), lb = lbrqd(phi, I.ssd, b.fbd), a1 = I.forme === "c" && I.cd > 3 * phi ? 0.7 : 1;
    const a2 = I.forme === "d" ? min(1, max(0.7, 1 - 0.15 * (I.cd - phi) / phi)) : min(1, max(0.7, 1 - 0.15 * (I.cd - 3 * phi) / phi)), p235 = max(a2 * I.a3 * I.a5, 0.7);
    const lbd = a1 * p235 * lb, lmin = max(0.3 * lb, 10 * phi, 100);
    return { steps: [S("fctd", L`f_{ctd}`, L`\dfrac{\alpha_{ct}\,f_{ctk;0,05}}{\gamma_c}`, b.fctd, "MPa", 3), S("e2", L`\eta_2`, phi <= 32 ? L`1\ \ (\varnothing \le 32)` : L`\dfrac{132 - \varnothing}{100}`, b.e2, "", 2),
      S("fbd", L`f_{bd}`, L`2{,}25\,\eta_1\,\eta_2\,f_{ctd}`, b.fbd, "MPa", 3), R("lb", L`l_{b,rqd}`, L`\dfrac{\varnothing}{4}\,\dfrac{\sigma_{sd}}{f_{bd}}`, lb, "mm", 0),
      S("a1", L`\alpha_1`, "~forme (0,7 pour une barre courbe si $c_d > 3\\varnothing$)", a1, "", 2), S("a2", L`\alpha_2`, I.forme === "d" ? L`1 - 0{,}15\,\dfrac{c_d - \varnothing}{\varnothing}\in[0{,}7 ; 1]` : L`1 - 0{,}15\,\dfrac{c_d - 3\varnothing}{\varnothing}\in[0{,}7 ; 1]`, a2, "", 3),
      S("lmin", L`l_{b,min}`, L`\max\left(0{,}3\,l_{b,rqd}\ ;\ 10\varnothing\ ;\ 100\ \text{mm}\right)`, lmin, "mm", 0),
      R("lbd", L`l_{bd}`, L`\alpha_1\,\max(\alpha_2\alpha_3\alpha_5\ ;\ 0{,}7)\;l_{b,rqd} \ge l_{b,min}`, max(lbd, lmin), "mm", 0), S("lphi", L`l_{bd}/\varnothing`, "", max(lbd, lmin) / phi, "", 1)],
      notes: ["$f_{ctk;0,05}$ plafonné à la valeur du C60/75. $\\sigma_{sd} = f_{yd}$ pour un ancrage total ; peut être réduit à la contrainte réellement mobilisée. Conditions médiocres : barres horizontales à plus de 250 mm du fond pour des hauteurs de bétonnage > 250 mm (figure 8.2)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 150, x0 = 40, x1 = 300, y = 70, lb = g("lbd"), k = (x1 - x0 - 40) / lb, xe = x0 + 40 + lb * k;
    let s = Rc(x0 + 40, 25, x1 - x0 - 40, 90) + P(`M${x0} ${y}H${xe}`, { c: K.red, w: 5 }) + (I.forme === "c" ? P(`M${xe} ${y}q14 0 14 14v12`, { c: K.red, w: 5 }) : "");
    s += arrow(x0 + 30, y, x0 - 2, y, K.red, 2) + T(x0 - 2, y - 8, "Fs", { s: 9.5, c: K.red });
    for (let i = 1; i < 9; i++) { const x = x0 + 40 + lb * k * i / 9; s += arrow(x, y + 12, x + 12, y + 12, K.teal, 1) + arrow(x, y - 12, x + 12, y - 12, K.teal, 1); }
    s += dim(x0 + 40, xe, 132, `lbd = ${f2(lb, 0)} mm (${f2(g("lphi"), 0)} ∅)`) + T(x0 + 44, 40, `fbd = ${f2(g("fbd"), 2)} MPa`, { s: 9.5, c: K.teal });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Une barre HA${I.phi} doit être scellée sur ${f2(g("lbd") / 10, 0)} cm (${f2(g("lphi"), 0)} fois son diamètre) pour transmettre tout son effort au béton.` },

/* ─────────── RECOUVREMENT ─────────── */
{ id: "ec2-recouvrement", t: "Longueur de recouvrement des armatures", ref: "NF EN 1992-1-1 — §8.7.3 (8.10), (8.11), tableau 8.3",
  desc: "Longueur de recouvrement des barres tendues selon la proportion de barres recouvertes dans la même section.",
  inputs: [SEL("phi", "Diamètre des barres", PHI, "16", L`\varnothing`), N("fck", "Résistance du béton", "MPa", 35, L`f_{ck}`), N("ssd", "Contrainte de calcul", "MPa", 434.8, L`\sigma_{sd}`),
    SEL("bond", "Conditions d'adhérence", [["b", "Bonnes (η₁ = 1)"], ["m", "Médiocres (η₁ = 0,7)"]], "b", L`\eta_1`), N("cd", "Enrobage ou demi-entraxe déterminant", "mm", 35, L`c_d`),
    N("p1", "Proportion de barres recouvertes", "%", 50, L`\rho_1`), N("a3", "Confinement transversal", "", 1, L`\alpha_3`)],
  calc(I) {
    const phi = +I.phi, b = fbdOf(I.fck, phi, I.bond), lb = lbrqd(phi, I.ssd, b.fbd), a2 = min(1, max(0.7, 1 - 0.15 * (I.cd - phi) / phi)), a6 = min(1.5, max(1, sqrt(I.p1 / 25)));
    const l0 = max(a2 * I.a3, 0.7) * a6 * lb, lmin = max(0.3 * a6 * lb, 15 * phi, 200);
    return { steps: [S("fbd", L`f_{bd}`, L`2{,}25\,\eta_1\,\eta_2\,f_{ctd}`, b.fbd, "MPa", 3), S("lb", L`l_{b,rqd}`, L`\dfrac{\varnothing}{4}\,\dfrac{\sigma_{sd}}{f_{bd}}`, lb, "mm", 0),
      S("a2", L`\alpha_2`, L`1 - 0{,}15\,\dfrac{c_d - \varnothing}{\varnothing}\in[0{,}7 ; 1]`, a2, "", 3), S("a6", L`\alpha_6`, L`\left(\dfrac{\rho_1}{25}\right)^{0{,}5}\in[1 ; 1{,}5]`, a6, "", 3),
      S("lmin", L`l_{0,min}`, L`\max\left(0{,}3\,\alpha_6\,l_{b,rqd}\ ;\ 15\varnothing\ ;\ 200\ \text{mm}\right)`, lmin, "mm", 0),
      R("l0", L`l_0`, L`\alpha_1\,\alpha_6\,\max(\alpha_2\alpha_3\alpha_5\ ;\ 0{,}7)\;l_{b,rqd} \ge l_{0,min}`, max(l0, lmin), "mm", 0), S("lphi", L`l_0/\varnothing`, "", max(l0, lmin) / phi, "", 1)],
      notes: ["$\\rho_1$ : pourcentage de barres recouvertes dont l'axe se situe à moins de $0{,}65\\,l_0$ de l'axe du recouvrement considéré. Distance libre entre barres recouvertes $\\le 4\\varnothing$ et $\\le 50$ mm, sinon augmenter $l_0$ de la distance excédentaire (§8.7.2)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 140, l = g("l0"), k = 200 / l, x0 = 65; let s = Rc(20, 30, 290, 80);
    s += P(`M25 62H${x0 + l * k}`, { c: K.red, w: 5 }) + P(`M${x0} 78H305`, { c: K.blue, w: 5 }) + dim(x0, x0 + l * k, 124, `l0 = ${f2(l, 0)} mm`) + arrow(60, 62, 22, 62, K.red, 1.6) + arrow(270, 78, 308, 78, K.blue, 1.6);
    s += T(165, 46, `${f2(I.p1, 0)} % des barres recouvertes → α6 = ${f2(g("a6"), 2)}`, { a: "middle", s: 9.5 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Deux barres HA${I.phi} se transmettent leur effort si elles se chevauchent sur ${f2(g("l0") / 10, 0)} cm.` },

/* ─────────── ENROBAGE ─────────── */
{ id: "ec2-enrobage", t: "Enrobage nominal des armatures", ref: "NF EN 1992-1-1 — §4.4.1, tableaux 4.3N, 4.4N ; NF EN 1992-2 (ponts : durée 100 ans)",
  desc: "Classe structurale, enrobage minimal de durabilité et enrobage nominal à indiquer sur les plans.",
  inputs: [SEL("X", "Classe d'exposition", [["0/30", "X0"], ["1/30", "XC1"], ["2/35", "XC2 / XC3"], ["3/40", "XC4"], ["4/40", "XD1"], ["4/40s", "XS1"], ["5/40", "XD2"], ["5/45", "XS2"], ["6/45", "XD3"], ["6/45s", "XS3"]], "3/40", ""),
    SEL("duree", "Durée d'utilisation de projet", [["50", "50 ans"], ["100", "100 ans (ponts)"]], "100", ""), N("fck", "Classe de résistance (fck)", "MPa", 35, L`f_{ck}`),
    SEL("dalle", "Géométrie de type dalle", [["n", "Non"], ["o", "Oui (−1 classe)"]], "n", ""), SEL("qc", "Maîtrise particulière de la qualité", [["n", "Non"], ["o", "Oui (−1 classe)"]], "n", ""),
    N("phi", "Diamètre des barres (ou équivalent)", "mm", 25, L`\varnothing`), N("dev", "Tolérance d'exécution", "mm", 10, L`\Delta c_{dev}`), N("dadd", "Réduction pour protection additionnelle", "mm", 0, L`\Delta c_{dur,add}`)],
  calc(I) {
    const x = parseInt(I.X), thr = parseInt(I.X.split("/")[1]), TAB = [[10, 10, 10, 15, 20, 25, 30], [10, 10, 15, 20, 25, 30, 35], [10, 10, 20, 25, 30, 35, 40], [10, 15, 25, 30, 35, 40, 45], [15, 20, 30, 35, 40, 45, 50], [20, 25, 35, 40, 45, 50, 55]];
    let cls = 4 + (I.duree === "100" ? 2 : 0) - (I.fck >= thr ? 1 : 0) - (I.dalle === "o" ? 1 : 0) - (I.qc === "o" ? 1 : 0); cls = min(6, max(1, cls));
    const cdur = TAB[cls - 1][x], cmin = max(I.phi, cdur - I.dadd, 10), cnom = cmin + I.dev;
    return { steps: [S("cls", "S", "~classe structurale : S4 + 2 (100 ans) − 1 (résistance) − 1 (dalle) − 1 (qualité)", "S" + cls, "", 0), S("cdur", L`c_{min,dur}`, "~tableau 4.4N", cdur, "mm", 0),
      S("cminb", L`c_{min,b}`, L`\varnothing`, I.phi, "mm", 0), S("cmin", L`c_{min}`, L`\max\left(c_{min,b}\ ;\ c_{min,dur} - \Delta c_{dur,add}\ ;\ 10\ \text{mm}\right)`, cmin, "mm", 0),
      R("cnom", L`c_{nom}`, L`c_{min} + \Delta c_{dev}`, cnom, "mm", 0)],
      vals: { clsN: cls },
      notes: [`Réduction de classe pour résistance si $f_{ck} \\ge$ C${thr}/${HB.DSL.EC2_CUBE[thr]} (tableau 4.3N, valeurs recommandées). L'AN française (tableau 4.3NF) module en outre selon le type de ciment et l'enrobage compact ; pour les ponts, le fascicule 65 et le marché peuvent imposer des valeurs supérieures.`, "Majorer $c_{min,b}$ de 5 mm si le granulat dépasse 32 mm ; bétonnage contre le sol : $c_{nom} \\ge 40$ mm (sol préparé) ou 75 mm (§4.4.1.3 (4))."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, cn = g("cnom"), k = 100 / (cn + I.phi + 10), x0 = 40, y0 = 30; let s = Rc(x0, y0, 250, 120) + P(`M${x0} ${y0}H${x0 + 250}`, { c: K.ink, w: 1.5 });
    const r = I.phi / 2 * k, cyb = y0 + cn * k + r; s += Ci(150, cyb, r, { f: K.red, c: "#fff" }) + P(`M${x0} ${cyb + r + 4}H${x0 + 250}`, { c: K.mute, w: .6, dash: "2 2" });
    s += dimV(110, y0, y0 + g("cmin") * k, `cmin = ${f2(g("cmin"), 0)}`, K.mute) + dimV(200, y0, y0 + cn * k, `cnom = ${f2(cn, 0)} mm`, K.red, 1) + T(150, y0 + 105, `classe ${g("cls")} · ∅${f2(I.phi, 0)}`, { a: "middle", s: 9.5, c: K.mute });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Il faut ${f2(g("cnom"), 0)} mm de béton entre le parement et la première armature (dont ${f2(I.dev, 0)} mm de tolérance de pose).` },

/* ─────────── DIAMÈTRE DE MANDRIN ─────────── */
{ id: "ec2-mandrin", t: "Diamètre minimal de mandrin de cintrage", ref: "NF EN 1992-1-1 — §8.3 (8.1) et tableau 8.1N",
  desc: "Diamètre de cintrage pour éviter la fissuration de l'acier et l'écrasement du béton à l'intérieur de la courbure.",
  inputs: [SEL("phi", "Diamètre de la barre", PHI, "25", L`\varnothing`), N("Fbt", "Effort de traction dans la barre (ELU)", "kN", 213, L`F_{bt}`), N("ab", "Demi-entraxe des barres (ou enrobage latéral + ∅/2)", "mm", 75, L`a_b`),
    N("fck", "Résistance du béton", "MPa", 35, L`f_{ck}`)],
  calc(I) {
    const phi = +I.phi, m1 = phi <= 16 ? 4 * phi : 7 * phi, fcd = I.fck / 1.5, m2 = I.Fbt * 1000 * (1 / I.ab + 1 / (2 * phi)) / fcd;
    return { steps: [S("m1", L`\varnothing_{m,min}^{acier}`, phi <= 16 ? L`4\,\varnothing\ \ (\varnothing \le 16)` : L`7\,\varnothing\ \ (\varnothing > 16)`, m1, "mm", 0),
      S("fcd", L`f_{cd}`, L`\dfrac{f_{ck}}{\gamma_c}`, fcd, "MPa", 2), S("m2", L`\varnothing_{m,min}^{b\acute{e}ton}`, L`F_{bt}\,\dfrac{\tfrac{1}{a_b} + \tfrac{1}{2\varnothing}}{f_{cd}}`, m2, "mm", 0),
      R("m", L`\varnothing_{m}`, L`\max\left(\varnothing_{m,min}^{acier}\ ;\ \varnothing_{m,min}^{b\acute{e}ton}\right)`, max(m1, m2), "mm", 0), S("mp", L`\varnothing_m/\varnothing`, "", max(m1, m2) / phi, "", 1)],
      notes: ["La condition béton (8.1) n'est pas à vérifier si l'ancrage ne dépasse pas $5\\varnothing$ au-delà de la courbe, si la barre n'est pas la plus proche du parement et si une barre transversale de diamètre $\\ge \\varnothing$ est placée dans la courbe (§8.3 (3))."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, phi = +I.phi, Rm = g("m") / 2, k = min(55 / Rm, 1.2), cx = 160, cy = 95, r = Rm * k;
    let s = P(`M40 ${cy - r}H${cx}A${r} ${r} 0 0 1 ${cx} ${cy + r}H90`, { c: K.red, w: max(phi * k, 3) }) + Ci(cx, cy, 2, { f: K.ink, c: K.ink });
    s += P(`M${cx} ${cy}L${cx + r * 0.7} ${cy - r * 0.7}`, { c: K.mute, w: .8, dash: "2 2" }) + T(cx + r * 0.7 + 4, cy - r * 0.7, `∅m = ${f2(g("m"), 0)} mm`, { s: 9.5, w: 500 });
    s += T(W - 10, Hh - 8, `soit ${f2(g("mp"), 1)} ∅`, { a: "end", s: 9.5, c: K.mute }) + arrow(80, cy - r - 14, 44, cy - r - 14, K.red, 1.4) + T(84, cy - r - 11, "Fbt", { s: 9, c: K.red });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La barre HA${I.phi} doit être cintrée sur un mandrin d'au moins ${f2(g("m"), 0)} mm de diamètre.` },

/* ─────────── CONSOLE COURTE ─────────── */
{ id: "ec2-console", t: "Console courte (corbeau) : bielles et tirants", ref: "NF EN 1992-1-1 — §6.5, annexe J.3 ; AN française",
  desc: "Modèle bielle-tirant d'une console courte : tirant principal, contrainte sous l'appui et armatures secondaires.",
  inputs: [N("F", "Charge verticale", "kN", 900, L`F_{Ed}`), N("Hc", "Effort horizontal concomitant", "kN", 180, L`H_{Ed}`), N("ac", "Distance de la charge au nu", "m", 0.25, L`a_c`),
    N("hc", "Hauteur de la console au nu", "m", 0.7, L`h_c`), N("d", "Hauteur utile", "m", 0.64, "d"), N("b", "Largeur", "m", 0.5, "b"), N("ap", "Longueur de l'appui", "m", 0.25, L`a_p`), ...COMMON_MAT],
  calc(I) {
    const B = HB.EC2.beton(I.fck), fy = fyd(I.fyk), F = I.F / 1000, H = I.Hc / 1000, nu2 = 1 - I.fck / 250;
    /* hauteur de la bielle : équilibre du nœud inférieur (contrainte k2 ν' fcd) */
    const sR = 0.85 * nu2 * B.fcd, a = (I.d - sqrt(max(I.d * I.d - 2 * F * I.ac / (I.b * sR), 0))), z0 = I.d - a / 2;
    const Ft = F * I.ac / z0 + H * (1 + (I.hc - I.d) / z0), As = Ft / fy * 1e4, th = Math.atan(z0 / I.ac) * 180 / PI, sp = F / (I.b * I.ap);
    const sec = I.ac <= 0.5 * I.hc ? 0.25 * As : 0.5 * F / fy * 1e4;
    return { steps: [S("sR", L`\sigma_{Rd,max}`, L`k_2\,\nu'\,f_{cd}\ \ (k_2 = 0{,}85,\ \nu' = 1 - f_{ck}/250)`, sR, "MPa", 2), S("a", "a", "~hauteur de la bielle inférieure (équilibre des moments)", a, "m", 3),
      S("z0", L`z_0`, L`d - \dfrac{a}{2}`, z0, "m", 3), S("th", L`\theta`, L`\arctan\dfrac{z_0}{a_c}`, th, "°", 1),
      R("Ft", L`F_{td}`, L`F_{Ed}\,\dfrac{a_c}{z_0} + H_{Ed}\,\dfrac{z_0 + (h_c - d)}{z_0}`, Ft * 1000, "kN", 0), R("As", L`A_{s,main}`, L`\dfrac{F_{td}}{f_{yd}}`, As, "cm²", 2),
      S("sp", L`\sigma_{appui}`, L`\dfrac{F_{Ed}}{b\,a_p}`, sp, "MPa", 2),
      R("sec", L`\textstyle\sum A_{s,lnk}`, I.ac <= 0.5 * I.hc ? L`0{,}25\,A_{s,main}\ \ \text{(cadres horizontaux, }a_c \le 0{,}5\,h_c)` : L`0{,}5\,\dfrac{F_{Ed}}{f_{yd}}\ \ \text{(cadres verticaux)}`, sec, "cm²", 2)],
      checks: [C("Nœud sous l'appui (CCT) : $\\sigma \\le 0{,}85\\,\\nu' f_{cd}$", sp <= sR, `${f2(sp)} ≤ ${f2(sR)} MPa`, sp / sR), C("Inclinaison de la bielle : $\\theta \\ge 45°$ (console courte)", th >= 45 && th <= 68.2, `${f2(th, 1)}°`),
        C("$H_{Ed} \\ge 0{,}2\\,F_{Ed}$ recommandé (retrait, dilatation)", I.Hc >= 0.2 * I.F, `${f2(I.Hc, 0)} kN`)],
      notes: ["Le tirant principal doit être ancré au-delà de l'appui (boucles ou barres soudées) ; $1 \\le \\tan\\theta \\le 2{,}5$ (§6.5.2, J.3). Prendre $H_{Ed} \\ge 0{,}2\\,F_{Ed}$ en l'absence de dispositions particulières."] };
  },
  fig(I, g) {
    const W = 330, Hh = 175, k = 150 / (I.ac + 0.4 + I.hc * 0.2), x0 = 120, yt = 30, hc = I.hc * k, ac = I.ac * k, z = g("z0") * k, d = I.d * k;
    let s = Rc(40, 10, 80, 160) + P(`M${x0} ${yt}H${x0 + ac + 50}V${yt + hc * 0.55}L${x0} ${yt + hc}Z`, { c: K.concD, f: K.conc, w: .8 });
    s += P(`M${x0 - 30} ${yt + (hc - d) + 2}H${x0 + ac + 40}`, { c: K.red, w: 3 }) + T(x0 + ac + 44, yt + hc - d - 6, `Ft = ${f2(g("Ft"), 0)} kN`, { s: 9.5, c: K.red, w: 500 });
    s += P(`M${x0 + ac} ${yt + hc - d + 2}L${x0 + 4} ${yt + hc - d + z}`, { c: K.blue, w: 6, op: .35 }) + T(x0 + ac / 2 - 20, yt + hc - d + z / 2 + 18, "bielle", { s: 9, c: K.blue });
    s += arrow(x0 + ac, yt - 22, x0 + ac, yt - 1, K.red, 2) + T(x0 + ac + 5, yt - 12, "FEd", { s: 9.5, c: K.red }) + dim(x0, x0 + ac, yt - 26, `ac = ${f2(I.ac, 2)}`);
    s += dimV(x0 + ac + 60, yt + hc - d + 2, yt + hc - d + z, "z0", K.mute, 1);
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La charge descend dans le poteau par une bielle de béton inclinée à ${f2(g("th"), 0)}° ; le haut de la console doit être armé de ${f2(g("As"), 1)} cm² (tirant de ${f2(g("Ft"), 0)} kN).` },

/* ─────────── PRESSION LOCALISÉE ─────────── */
{ id: "ec2-pression-localisee", t: "Pression localisée et frettage d'éclatement", ref: "NF EN 1992-1-1 — §6.7 (6.63), §6.5.3 (6.58)",
  desc: "Force portante sous une charge concentrée (appareil d'appui, ancrage) et armatures d'éclatement transversales.",
  inputs: [N("F", "Charge concentrée ELU", "kN", 4500, L`F_{Ed}`), N("a1", "Surface chargée : dimension a", "m", 0.4, L`a_1`), N("b1", "Surface chargée : dimension b", "m", 0.5, L`b_1`),
    N("aD", "Dimension a disponible (homothétique)", "m", 1.1, L`a_{dispo}`), N("bD", "Dimension b disponible", "m", 1.3, L`b_{dispo}`), N("hD", "Hauteur disponible pour la diffusion", "m", 1.0, "h"), ...COMMON_MAT],
  calc(I) {
    const fcd = I.fck / 1.5, fy = fyd(I.fyk), Ac0 = I.a1 * I.b1;
    let k = min(I.aD / I.a1, I.bD / I.b1, 3); k = min(k, 1 + I.hD / max(I.a1, I.b1)); k = max(k, 1);
    const a2 = k * I.a1, b2 = k * I.b1, Ac1 = a2 * b2, Fr = min(Ac0 * fcd * sqrt(Ac1 / Ac0), 3 * fcd * Ac0) * 1000;
    const Ta = 0.25 * (1 - I.a1 / a2) * I.F, Tb = 0.25 * (1 - I.b1 / b2) * I.F;
    return { steps: [S("Ac0", L`A_{c0}`, L`a_1\,b_1`, Ac0, "m²", 4), S("k", "", "~rapport d'homothétie retenu ($\\le 3$, diffusion sur $h \\ge a_2 - a_1$)", k, "", 3),
      S("Ac1", L`A_{c1}`, L`(k\,a_1)(k\,b_1)`, Ac1, "m²", 4), R("Fr", L`F_{Rdu}`, L`A_{c0}\,f_{cd}\sqrt{\dfrac{A_{c1}}{A_{c0}}} \le 3\,f_{cd}\,A_{c0}`, Fr, "kN", 0),
      S("Ta", L`T_a`, L`\tfrac{1}{4}\left(1 - \dfrac{a_1}{a_2}\right) F_{Ed}`, Ta, "kN", 0), S("Tb", L`T_b`, L`\tfrac{1}{4}\left(1 - \dfrac{b_1}{b_2}\right) F_{Ed}`, Tb, "kN", 0),
      R("As", L`A_{s}`, L`\dfrac{\max(T_a\ ;\ T_b)}{f_{yd}}` + "\\quad\\text{(par direction)}", max(Ta, Tb) / 1000 / fy * 1e4, "cm²", 2)],
      checks: [C("$F_{Ed} \\le F_{Rdu}$", I.F <= Fr, `${f2(I.F, 0)} ≤ ${f2(Fr, 0)} kN`, I.F / Fr)],
      notes: ["Armatures d'éclatement réparties dans la zone de diffusion (entre $0{,}1\\,a_2$ et $a_2$ sous la surface chargée), modèle de la figure 6.25 (discontinuité partielle). Une frette de surface (« 4 % ») est souvent ajoutée sous les appareils d'appui."] };
  },
  fig(I, g) {
    const W = 330, Hh = 175, k = 120 / max(g("k") * I.b1, I.hD), cx = 110, y0 = 25, w1 = I.b1 * k, w2 = g("k") * I.b1 * k, h = min(I.hD, (g("k") - 1) * I.b1 + 0.01) * k;
    let s = Rc(cx - 90, y0, 180, 140) + Rc(cx - w1 / 2, y0 - 8, w1, 8, { f: K.steel, c: "#5a6f8e" }) + P(`M${cx - w1 / 2} ${y0}L${cx - w2 / 2} ${y0 + h}H${cx + w2 / 2}L${cx + w1 / 2} ${y0}`, { c: K.blue, w: 1.2, dash: "4 3", f: K.blueL, op: .5 });
    s += arrow(cx, y0 - 30, cx, y0 - 10, K.red, 2) + T(cx + 6, y0 - 18, "FEd", { s: 9.5, c: K.red });
    for (let i = 1; i <= 3; i++) s += P(`M${cx - w2 / 2 + 6} ${y0 + h * (0.25 + 0.2 * i)}H${cx + w2 / 2 - 6}`, { c: K.red, w: 2 });
    s += T(cx + w2 / 2 + 6, y0 + h * 0.65, "frettes", { s: 9, c: K.red }) + dim(cx - w2 / 2, cx + w2 / 2, y0 + h + 14, "b₂ = k·b₁");
    s += HB.FIG.gauge(210, 60, 108, I.F / g("Fr"), "FEd / FRdu");
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le béton sous l'appui peut porter ${f2(g("Fr"), 0)} kN grâce à la diffusion ; il faut ${f2(g("As"), 1)} cm² de frettes pour retenir l'éclatement.` },

/* ─────────── ÉLANCEMENT LIMITE D'UN POTEAU ─────────── */
{ id: "ec2-elancement", t: "Poteau ou pile : élancement limite (second ordre)", ref: "NF EN 1992-1-1 — §5.8.3.1 (5.13N), §5.8.3.2 (5.14), (5.15)",
  desc: "Élancement mécanique et élancement limite au-dessous duquel les effets du second ordre peuvent être négligés.",
  inputs: [SEL("sec", "Section", [["r", "Rectangulaire"], ["c", "Circulaire pleine"]], "r", ""), N("h", "Hauteur de section (ou diamètre)", "m", 1.2, "h"), N("b", "Largeur (section rectangulaire)", "m", 2.5, "b"),
    N("l", "Longueur libre", "m", 14, "l"), SEL("beta", "Conditions aux extrémités", [["2", "Console (l₀ = 2 l)"], ["1", "Articulé-articulé (1,0)"], ["0.7", "Encastré-articulé (0,7)"], ["0.5", "Encastré-encastré (0,5)"]], "2", L`\beta`),
    N("Ned", "Effort normal", "kN", 12000, L`N_{Ed}`), N("As", "Armatures longitudinales", "cm²", 120, L`A_s`), N("phief", "Coefficient de fluage effectif", "", 0, L`\varphi_{ef}`),
    N("rm", "Rapport des moments d'extrémité", "", 1, L`r_m`), ...COMMON_MAT],
  calc(I) {
    const Ac = I.sec === "c" ? PI * I.h * I.h / 4 : I.b * I.h, i = I.sec === "c" ? I.h / 4 : I.h / sqrt(12), l0 = +I.beta * I.l, lam = l0 / i;
    const fcd = I.fck / 1.5, fy = fyd(I.fyk), n = I.Ned / 1000 / (Ac * fcd), w = I.As / 1e4 * fy / (Ac * fcd);
    const A = 1 / (1 + 0.2 * I.phief), Bc = sqrt(1 + 2 * w), Cc = 1.7 - I.rm, lim = 20 * A * Bc * Cc / sqrt(n);
    return { steps: [S("l0", L`l_0`, L`\beta\,l`, l0, "m", 2), S("i", "i", I.sec === "c" ? L`\dfrac{D}{4}` : L`\dfrac{h}{\sqrt{12}}`, i, "m", 3), R("lam", L`\lambda`, L`\dfrac{l_0}{i}`, lam, "", 1),
      S("n", "n", L`\dfrac{N_{Ed}}{A_c\,f_{cd}}`, n, "", 3), S("w", L`\omega`, L`\dfrac{A_s\,f_{yd}}{A_c\,f_{cd}}`, w, "", 3),
      S("ABC", "A, B, C", L`\dfrac{1}{1 + 0{,}2\varphi_{ef}}\ ;\ \sqrt{1 + 2\omega}\ ;\ 1{,}7 - r_m`, `${f2(A, 3)} ; ${f2(Bc, 3)} ; ${f2(Cc, 3)}`, "", 0),
      R("lim", L`\lambda_{lim}`, L`\dfrac{20\,A\,B\,C}{\sqrt{n}}`, lim, "", 1)],
      checks: [C("$\\lambda \\le \\lambda_{lim}$ : effets du second ordre négligeables", lam <= lim, `${f2(lam, 1)} ≤ ${f2(lim, 1)}`, lam / lim)],
      notes: ["$r_m = M_{01}/M_{02}$ (moments d'extrémité du premier ordre, $|M_{02}| \\ge |M_{01}|$) ; $r_m = 1$ pour une console ou un moment uniforme ($C = 0{,}7$). Si $\\lambda > \\lambda_{lim}$, voir « Poteau : méthode de la courbure nominale »."] };
  },
  fig(I, g) {
    const A = 1 / (1 + 0.2 * I.phief), Bc = sqrt(1 + 2 * g("w")), Cc = 1.7 - I.rm, pts = range(0.05, 1.2, 60).map(n => [n, 20 * A * Bc * Cc / sqrt(n)]);
    return plot({ series: [{ pts, l: "λlim selon l'effort normal réduit n" }], hlines: [{ y: g("lam"), l: `λ = ${f2(g("lam"), 1)}`, c: K.red }], marks: [{ x: min(g("n"), 1.2), y: g("lim"), l: `λlim = ${f2(g("lim"), 1)}` }], xl: "n = NEd / (Ac fcd)", yl: "élancement", ymin: 0, ymax: max(g("lam"), 80) * 1.15 });
  },
  clair: (I, g) => g("lam") <= g("lim") ? `La pile est assez trapue (élancement ${f2(g("lam"), 0)} pour ${f2(g("lim"), 0)} admis) : on peut négliger les effets du second ordre.` : `La pile est élancée (${f2(g("lam"), 0)} > ${f2(g("lim"), 0)}) : il faut majorer les moments par le second ordre.` },

/* ─────────── COURBURE NOMINALE ─────────── */
{ id: "ec2-courbure", t: "Poteau : méthode de la courbure nominale", ref: "NF EN 1992-1-1 — §5.2 (imperfections), §5.8.8 (5.31) à (5.37)",
  desc: "Moment du second ordre par la courbure nominale, imperfection géométrique incluse ; section rectangulaire armée symétriquement.",
  inputs: [N("h", "Hauteur de section (plan de flambement)", "m", 1.2, "h"), N("b", "Largeur", "m", 2.5, "b"), N("d", "Hauteur utile", "m", 1.12, "d"), N("l", "Longueur réelle", "m", 14, "l"),
    N("l0", "Longueur de flambement", "m", 28, L`l_0`), N("Ned", "Effort normal", "kN", 12000, L`N_{Ed}`), N("M0", "Moment du premier ordre (sans imperfection)", "kN·m", 6000, L`M_{0Ed}`),
    N("As", "Armatures totales", "cm²", 120, L`A_s`), N("phief", "Coefficient de fluage effectif", "", 0.8, L`\varphi_{ef}`), ...COMMON_MAT],
  calc(I) {
    const fcd = I.fck / 1.5, fy = fyd(I.fyk), Ac = I.b * I.h, Nm = I.Ned / 1000, ah = min(1, max(2 / 3, 2 / sqrt(I.l))), thi = ah / 200, ei = thi * I.l0 / 2;
    const e0 = max(I.h / 30, 0.02), M0e = max(I.M0 / 1000 + Nm * ei, Nm * e0), lam = I.l0 / (I.h / sqrt(12)), n = Nm / (Ac * fcd), w = I.As / 1e4 * fy / (Ac * fcd), nu = 1 + w;
    const Kr = min(1, max(0, (nu - n) / (nu - 0.4))), bet = 0.35 + I.fck / 200 - lam / 150, Kp = max(1, 1 + bet * I.phief), r1 = Kr * Kp * (fy / Es) / (0.45 * I.d), e2 = r1 * I.l0 ** 2 / 10, M2 = Nm * e2;
    return { steps: [S("thi", L`\theta_i`, L`\dfrac{1}{200}\,\alpha_h\ \ \left(\alpha_h = \tfrac{2}{\sqrt{l}} \in [\tfrac{2}{3} ; 1]\right)`, thi * 1000, "mrad", 3), S("ei", L`e_i`, L`\theta_i\,\dfrac{l_0}{2}`, ei, "m", 4),
      S("M0e", L`M_{0Ed}^{*}`, L`\max\left(M_{0Ed} + N_{Ed}\,e_i\ ;\ N_{Ed}\,e_0\right)`, M0e * 1000, "kN·m", 0), S("Kr", L`K_r`, L`\dfrac{n_u - n}{n_u - n_{bal}} \le 1,\ \ n_u = 1 + \omega,\ n_{bal} = 0{,}4`, Kr, "", 3),
      S("Kp", L`K_\varphi`, L`1 + \beta\,\varphi_{ef},\ \ \beta = 0{,}35 + \dfrac{f_{ck}}{200} - \dfrac{\lambda}{150}`, Kp, "", 3), S("r1", L`\dfrac{1}{r}`, L`K_r K_\varphi\,\dfrac{\varepsilon_{yd}}{0{,}45\,d}`, r1 * 1000, "‰/m", 4),
      S("e2", L`e_2`, L`\dfrac{1}{r}\,\dfrac{l_0^2}{c}\ \ (c = 10)`, e2, "m", 4), S("M2", L`M_2`, L`N_{Ed}\,e_2`, M2 * 1000, "kN·m", 0), R("Med", L`M_{Ed}`, L`M_{0Ed}^{*} + M_2`, (M0e + M2) * 1000, "kN·m", 0)],
      vals: { lam, amp: (M0e + M2) / M0e },
      notes: ["Le moment $M_{Ed}$ obtenu est à vérifier avec le diagramme d'interaction (« Flexion composée : diagramme N–M »). $c = 10 \\approx \\pi^2$ pour une section constante ; pour un moment du premier ordre constant, $c = 8$ est plus juste (§5.8.8.2 (4))."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "M0Ed + N·ei", v: g("M0e"), c: K.gold, u: "kN·m", d: 0 }, { l: "M2 (2nd ordre)", v: g("M2"), c: K.blue, u: "kN·m", d: 0 }, { l: "MEd total", v: g("Med"), c: K.red, u: "kN·m", d: 0 }], { title: `Amplification du moment : × ${f2(g("amp"), 2)}`, left: 100 }); },
  clair: (I, g) => `En se déformant, la pile ajoute ${f2(g("M2"), 0)} kN·m au moment initial : on dimensionne pour ${f2(g("Med"), 0)} kN·m (× ${f2(g("amp"), 2)}).` },

/* ─────────── CISAILLEMENT À L'INTERFACE ─────────── */
{ id: "ec2-interface", t: "Cisaillement à l'interface de bétons coulés à des dates différentes", ref: "NF EN 1992-1-1 — §6.2.5 (6.23) à (6.25)",
  desc: "Reprise de bétonnage (dalle sur poutre préfabriquée, prédalle) : contrainte de cisaillement et coutures nécessaires.",
  inputs: [N("V", "Effort tranchant", "kN", 800, L`V_{Ed}`), N("beta", "Rapport effort longitudinal dans le béton rapporté / total", "", 1, L`\beta`), N("z", "Bras de levier", "m", 0.9, "z"),
    N("bi", "Largeur de l'interface", "m", 0.6, L`b_i`), N("sn", "Contrainte normale à l'interface (compression +)", "MPa", 0, L`\sigma_n`),
    SEL("surf", "État de surface", [["0.025/0.5", "Très lisse (c = 0,025 ; µ = 0,5)"], ["0.20/0.6", "Lisse (0,20 ; 0,6)"], ["0.40/0.7", "Rugueuse (0,40 ; 0,7)"], ["0.50/0.9", "Avec indentations (0,50 ; 0,9)"]], "0.40/0.7", ""),
    N("Asi", "Coutures traversant l'interface", "cm²/m", 20, L`A_s/s`), ...COMMON_MAT],
  calc(I) {
    const [c, mu] = I.surf.split("/").map(Number), B = HB.EC2.beton(I.fck), fy = fyd(I.fyk), nu = 0.6 * (1 - I.fck / 250);
    const v = I.beta * I.V / 1000 / (I.z * I.bi), rho = I.Asi / 1e4 / I.bi, sn = min(I.sn, 0.6 * B.fcd);
    const vr = min(c * B.fctd + mu * sn + rho * fy * mu, 0.5 * nu * B.fcd), req = max(0, (v - c * B.fctd - mu * sn) / (fy * mu)) * I.bi * 1e4;
    return { steps: [R("v", L`v_{Edi}`, L`\dfrac{\beta\,V_{Ed}}{z\,b_i}`, v, "MPa", 3), S("cf", L`c\,f_{ctd}`, "~cohésion", c * B.fctd, "MPa", 3), S("mus", L`\mu\,\sigma_n`, "~frottement", mu * sn, "MPa", 3),
      S("rho", L`\rho`, L`\dfrac{A_s}{A_i}`, rho * 100, "%", 3), R("vr", L`v_{Rdi}`, L`c\,f_{ctd} + \mu\,\sigma_n + \rho\,f_{yd}\,(\mu\sin\alpha + \cos\alpha) \le 0{,}5\,\nu f_{cd}`, vr, "MPa", 3),
      R("req", L`\left(\tfrac{A_s}{s}\right)_{req}`, L`\dfrac{v_{Edi} - c\,f_{ctd} - \mu\,\sigma_n}{\mu\,f_{yd}}\,b_i`, req, "cm²/m", 2)],
      checks: [C("$v_{Edi} \\le v_{Rdi}$", v <= vr, `${f2(v, 3)} ≤ ${f2(vr, 3)} MPa`, v / vr)],
      notes: ["Coutures perpendiculaires à l'interface ($\\alpha = 90°$). Sous fatigue ou charges dynamiques, $c$ est divisé par deux (§6.2.5 (5)). $\\sigma_n \\le 0{,}6\\,f_{cd}$ ; prendre $c = 0$ si $\\sigma_n$ est une traction."] };
  },
  fig(I, g) {
    const W = 330, Hh = 165; let s = Rc(60, 22, 210, 34, { f: "#efe9dc" }) + Rc(120, 56, 90, 86) + P(`M60 56H270`, { c: K.red, w: 1.6, dash: "6 3" }) + T(275, 59, "interface", { s: 9, c: K.red });
    for (let i = 0; i < 5; i++) s += P(`M${132 + i * 16} 40V80`, { c: K.blue, w: 2 });
    s += arrow(80, 50, 115, 50, K.red, 1.4) + arrow(250, 62, 215, 62, K.red, 1.4) + T(165, 155, "coutures As", { a: "middle", s: 9, c: K.blue });
    s += HB.FIG.gauge(20, 112, 90, g("v") / g("vr"), "vEdi / vRdi");
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La reprise de bétonnage est cisaillée à ${f2(g("v"), 2)} MPa et résiste à ${f2(g("vr"), 2)} MPa ; il faut au moins ${f2(g("req"), 1)} cm²/m de coutures.` },

/* ─────────── CISAILLEMENT ÂME-MEMBRURE ─────────── */
{ id: "ec2-membrure", t: "Cisaillement entre l'âme et les membrures", ref: "NF EN 1992-1-1 — §6.2.4 (6.20) à (6.22)",
  desc: "Effort de glissement entre l'âme et la table d'une section en T ou d'un caisson, armatures transversales de couture.",
  inputs: [N("dM", "Variation du moment sur la longueur Δx", "kN·m", 3000, L`\Delta M`), N("dx", "Longueur considérée", "m", 5, L`\Delta x`), N("z", "Bras de levier", "m", 1.6, "z"),
    N("frac", "Part de la membrure en débord (b_débord / b_eff)", "", 0.42, L`\dfrac{b_{d}}{b_{eff}}`), N("hf", "Épaisseur de la membrure", "m", 0.25, L`h_f`),
    SEL("zone", "Membrure", [["c", "Comprimée (cot θf ≤ 2)"], ["t", "Tendue (cot θf ≤ 1,25)"]], "c", ""), N("cot", "Inclinaison des bielles", "", 2, L`\cot\theta_f`), ...COMMON_MAT],
  calc(I) {
    const B = HB.EC2.beton(I.fck), fy = fyd(I.fyk), dF = I.dM / 1000 / I.z * I.frac, v = dF / (I.hf * I.dx), th = Math.atan(1 / I.cot);
    const vmax = B.nu * B.fcd * Math.sin(th) * Math.cos(th), Af = v * I.hf / (fy * I.cot) * 1e4, small = v <= 0.4 * B.fctd;
    return { steps: [S("dF", L`\Delta F_d`, L`\dfrac{\Delta M}{z}\cdot\dfrac{b_{d}}{b_{eff}}`, dF * 1000, "kN", 0), R("v", L`v_{Ed}`, L`\dfrac{\Delta F_d}{h_f\,\Delta x}`, v, "MPa", 3),
      S("vmax", L`v_{Rd,max}`, L`\nu\,f_{cd}\,\sin\theta_f\cos\theta_f`, vmax, "MPa", 3), S("k", L`k\,f_{ctd}`, L`0{,}4\,f_{ctd}`, 0.4 * B.fctd, "MPa", 3),
      R("Af", L`\dfrac{A_{sf}}{s_f}`, small ? "~non requis ($v_{Ed} \\le k f_{ctd}$) : armatures de flexion transversale suffisantes" : L`\dfrac{v_{Ed}\,h_f}{f_{yd}\cot\theta_f}`, small ? 0 : Af, "cm²/m", 2)],
      checks: [C("Bielles : $v_{Ed} \\le \\nu f_{cd}\\sin\\theta_f\\cos\\theta_f$", v <= vmax, `${f2(v, 2)} ≤ ${f2(vmax, 2)} MPa`, v / vmax), C("Inclinaison admise", I.zone === "c" ? I.cot >= 1 && I.cot <= 2 : I.cot >= 1 && I.cot <= 1.25, f2(I.cot, 2))],
      notes: ["$\\Delta x \\le$ moitié de la distance entre moment nul et moment maximal. En présence de flexion transversale, retenir la plus grande des sections (cisaillement) et (flexion + moitié du cisaillement) (§6.2.4 (5))."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160; let s = Rc(20, 30, 290, 100, { f: "#f1ece2" }) + Rc(20, 66, 290, 28, { f: K.concD, c: K.ink }) + T(165, 84, "âme (vue en plan)", { a: "middle", s: 9, c: "#fff" });
    for (let i = 0; i < 6; i++) { const x = 40 + i * 45; s += P(`M${x} 66L${x + 30} 32`, { c: K.blue, w: 1.6, op: .6 }); s += P(`M${x + 12} 30V66`, { c: K.red, w: 1.4 }); }
    s += arrow(30, 22, 120, 22, K.red, 1.4) + T(125, 25, `ΔFd = ${f2(g("dF"), 0)} kN sur Δx`, { s: 9.5, c: K.red }) + T(165, 148, `bielles à θf = ${f2(Math.atan(1 / I.cot) * 180 / PI, 0)}° · coutures ${f2(g("Af"), 1)} cm²/m`, { a: "middle", s: 9.5 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La table doit être « cousue » à l'âme : ${g("Af") > 0 ? f2(g("Af"), 1) + " cm² d'acier par mètre" : "les aciers de flexion transversale suffisent"}.` },

/* ─────────── FERRAILLAGES MINIMAUX ─────────── */
{ id: "ec2-ferraillage-min", t: "Ferraillages minimaux et maximaux (poutres, poteaux, voiles)", ref: "NF EN 1992-1-1 — §9.2.1.1, 9.2.2, 9.5.2, 9.6.2, 9.6.3",
  desc: "Sections minimales et maximales d'armatures et espacements maximaux des dispositions constructives.",
  inputs: [N("b", "Largeur", "m", 0.5, "b"), N("h", "Hauteur", "m", 1.0, "h"), N("d", "Hauteur utile", "m", 0.92, "d"), N("Ned", "Effort normal (poteau)", "kN", 3000, L`N_{Ed}`), ...COMMON_MAT],
  calc(I) {
    const B = HB.EC2.beton(I.fck), fy = fyd(I.fyk), Ac = I.b * I.h, Asmin = max(0.26 * B.fctm / I.fyk, 0.0013) * I.b * I.d * 1e4, rw = 0.08 * sqrt(I.fck) / I.fyk;
    return { steps: [R("Asmin", L`A_{s,min}^{poutre}`, L`\max\left(0{,}26\,\dfrac{f_{ctm}}{f_{yk}}\ ;\ 0{,}0013\right) b_t\,d`, Asmin, "cm²", 2), S("Asmax", L`A_{s,max}`, L`0{,}04\,A_c`, 0.04 * Ac * 1e4, "cm²", 1),
      S("rw", L`\rho_{w,min}`, L`0{,}08\,\dfrac{\sqrt{f_{ck}}}{f_{yk}}`, rw * 100, "%", 3), R("Aswmin", L`\left(\tfrac{A_{sw}}{s}\right)_{min}`, L`\rho_{w,min}\,b_w`, rw * I.b * 1e4, "cm²/m", 2),
      S("slmax", L`s_{l,max}`, L`0{,}75\,d`, 0.75 * I.d, "m", 2), S("stmax", L`s_{t,max}`, L`\min(0{,}75\,d\ ;\ 600\ \text{mm})`, min(0.75 * I.d, 0.6), "m", 2),
      R("Ascol", L`A_{s,min}^{poteau}`, L`\max\left(\dfrac{0{,}10\,N_{Ed}}{f_{yd}}\ ;\ 0{,}002\,A_c\right)`, max(0.1 * I.Ned / 1000 / fy, 0.002 * Ac) * 1e4, "cm²", 2),
      S("sclt", L`s_{cl,t,max}`, L`\min(20\,\varnothing_{l,min}\ ;\ b\ ;\ 400\ \text{mm})` + "\\quad(\\varnothing_l = 12)", min(0.24, I.b, 0.4), "m", 2),
      S("Asv", L`A_{s,v,min}^{voile}`, L`0{,}002\,A_c` + "\\quad\\text{(sur la hauteur } h\\text{)}", 0.002 * Ac * 1e4, "cm²", 2), S("Ash", L`A_{s,h,min}^{voile}`, L`\max(0{,}25\,A_{s,v}\ ;\ 0{,}001\,A_c)`, max(0.25 * 0.002, 0.001) * Ac * 1e4, "cm²", 2)],
      notes: ["Poteaux : $\\varnothing_l \\ge 8$ mm, cadres $\\varnothing_t \\ge \\max(6\\ \\text{mm} ; \\varnothing_l/4)$, espacement réduit de 40 % près des extrémités et des recouvrements (§9.5.3). $A_{s,max} = 0{,}04\\,A_c$ hors recouvrements (0,08 au droit des recouvrements pour les poteaux)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "poutre As,min", v: g("Asmin"), u: "cm²", c: K.gold }, { l: "poteau As,min", v: g("Ascol"), u: "cm²", c: K.blue }, { l: "voile As,v,min", v: g("Asv"), u: "cm²", c: K.teal }, { l: "As,max (4 %)", v: g("Asmax"), u: "cm²", c: K.mute, d: 0 }], { title: `Section ${f2(I.b, 2)} × ${f2(I.h, 2)} m`, left: 96 }); },
  clair: (I, g) => `Même peu sollicitée, cette section doit recevoir au moins ${f2(g("Asmin"), 1)} cm² en poutre, ou ${f2(g("Ascol"), 1)} cm² si elle travaille en poteau.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
