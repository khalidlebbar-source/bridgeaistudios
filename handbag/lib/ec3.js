/* ════════════════════════════════════════════════════════════════════
   HandBag — Charpente métallique (NF EN 1993-1-1, -1-5, -1-8, -1-9, -2)
   Unités : mm pour les dimensions de section, kN, kN·m, MPa.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt, BOULONS } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, logRange, gauge } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), E = 210000, G = 81000;
const NUANCES = [["235", "S235"], ["275", "S275"], ["355", "S355"], ["420", "S420M"], ["460", "S460M"]];
/* limites d'élasticité et de rupture selon l'épaisseur (EN 10025-2 et -4) */
const FY = { 235: [[16, 235], [40, 225], [63, 215], [80, 215], [100, 215], [150, 195]], 275: [[16, 275], [40, 265], [63, 255], [80, 245], [100, 235], [150, 225]],
  355: [[16, 355], [40, 345], [63, 335], [80, 325], [100, 315], [150, 295]], 420: [[16, 420], [40, 400], [63, 390], [80, 380], [100, 370], [120, 365]], 460: [[16, 460], [40, 440], [63, 430], [80, 410], [100, 400], [120, 385]] };
const FU = { 235: [[100, 360], [150, 350]], 275: [[100, 410], [150, 400]], 355: [[100, 470], [150, 450]], 420: [[40, 520], [63, 500], [80, 480], [100, 470], [120, 460]], 460: [[40, 540], [63, 530], [80, 510], [100, 500], [120, 490]] };
const pick = (tab, t) => (tab.find(r => t <= r[0]) || tab[tab.length - 1])[1];
const fyOf = (n, t) => pick(FY[n], t), fuOf = (n, t) => pick(FU[n], t);
const BW = { 235: 0.8, 275: 0.85, 355: 0.9, 420: 1, 460: 1 };
const CLS = [["4.6", "4.6"], ["5.6", "5.6"], ["6.8", "6.8"], ["8.8", "8.8"], ["10.9", "10.9"]], FUB = c => ({ "4.6": 400, "5.6": 500, "6.8": 600, "8.8": 800, "10.9": 1000 }[c]);
const MB = Object.keys(BOULONS).map(k => [k, k]);

/* section en I soudée à semelles inégales (mm) — z depuis la fibre inférieure */
function props(o) {
  const parts = [[o.bf2, o.tf2, o.tf2 / 2], [o.tw, o.hw, o.tf2 + o.hw / 2], [o.bf1, o.tf1, o.tf2 + o.hw + o.tf1 / 2]], h = o.tf1 + o.hw + o.tf2;
  const A = parts.reduce((s, p) => s + p[0] * p[1], 0), zG = parts.reduce((s, p) => s + p[0] * p[1] * p[2], 0) / A;
  const I = parts.reduce((s, p) => s + p[0] * p[1] ** 3 / 12 + p[0] * p[1] * (p[2] - zG) ** 2, 0);
  /* axe neutre plastique : aire égale de part et d'autre */
  const below = z => parts.reduce((s, p) => s + p[0] * max(0, min(p[1], z - (p[2] - p[1] / 2))), 0);
  let a = 0, b = h; for (let i = 0; i < 70; i++) { const m = (a + b) / 2; below(m) < A / 2 ? a = m : b = m; } const zp = (a + b) / 2;
  const Wpl = parts.reduce((s, p) => { const z1 = p[2] - p[1] / 2, z2 = p[2] + p[1] / 2, lo = min(z2, zp) - z1, hi = z2 - max(z1, zp);
    return s + (lo > 0 ? p[0] * lo * (zp - (z1 + lo / 2)) : 0) + (hi > 0 ? p[0] * hi * ((max(z1, zp) + hi / 2) - zp) : 0); }, 0);
  return { A, zG, I, h, Wsup: I / (h - zG), Winf: I / zG, Wpl, zp, Aw: o.hw * o.tw };
}
const SECI = [H("Section en I soudée (mm)"), N("bf1", "Semelle supérieure : largeur", "mm", 800, L`b_{f1}`), N("tf1", "Semelle supérieure : épaisseur", "mm", 40, L`t_{f1}`),
  N("hw", "Âme : hauteur", "mm", 2300, L`h_w`), N("tw", "Âme : épaisseur", "mm", 20, L`t_w`), N("bf2", "Semelle inférieure : largeur", "mm", 1000, L`b_{f2}`), N("tf2", "Semelle inférieure : épaisseur", "mm", 60, L`t_{f2}`)];
const SYMI = [H("Section en I symétrique (mm)"), N("h", "Hauteur totale", "mm", 1200, "h"), N("b", "Largeur des semelles", "mm", 500, "b"), N("tf", "Épaisseur des semelles", "mm", 30, L`t_f`), N("tw", "Épaisseur de l'âme", "mm", 16, L`t_w`)];
const iFig = (o, extra = {}) => KIT.iSection(Object.assign({ h: o.h / 1000, bf: o.bf1 / 1000, tf: o.tf1 / 1000, tw: o.tw / 1000, bf2: o.bf2 / 1000, tf2: o.tf2 / 1000 }, extra));

HB.add("Matériaux", [
{ id: "acier-charpente", t: "Acier de construction : limites selon l'épaisseur", ref: "NF EN 10025-2 et -4 ; NF EN 1993-1-1 §3.2 ; NF EN 1993-2 §3.2",
  desc: "Limite d'élasticité et résistance à la traction d'une tôle en fonction de sa nuance et de son épaisseur, paramètre ε et caractéristiques élastiques.",
  inputs: [SEL("nu", "Nuance", NUANCES, "355", ""), N("t", "Épaisseur de la tôle", "mm", 60, "t")],
  calc(I) {
    const fy = fyOf(I.nu, I.t), fu = fuOf(I.nu, I.t), eps = sqrt(235 / fy);
    return { steps: [R("fy", L`f_y`, "~norme de produit (palier d'épaisseur)", fy, "MPa", 0), R("fu", L`f_u`, "~norme de produit", fu, "MPa", 0), S("eps", L`\varepsilon`, L`\sqrt{\dfrac{235}{f_y}}`, eps, "", 3),
      S("ratio", L`f_u/f_y`, "", fu / fy, "", 3), S("E", "E", "~module d'élasticité", E, "MPa", 0), S("G", "G", L`\dfrac{E}{2\,(1 + \nu)}`, G, "MPa", 0), S("alpha", L`\alpha`, "~dilatation thermique", 1.2e-5, "/°C", "e")],
      checks: [C("Ductilité : $f_u/f_y \\ge 1{,}10$ (§3.2.2)", fu / fy >= 1.1, f2(fu / fy, 2))],
      notes: ["L'AN française de l'EN 1993-1-1 renvoie aux valeurs de la norme de produit (option b du §3.2.1). S420M et S460M : aciers thermomécaniques (EN 10025-4). Le choix de la qualité (JR, J0, J2, K2, N, NL, M, ML) dépend de l'épaisseur et de la température minimale (NF EN 1993-1-10)."] };
  },
  fig(I, g) { const pts = FY[I.nu].flatMap((r, i, a) => [[i ? a[i - 1][0] : 0, r[1]], [r[0], r[1]]]); return plot({ series: [{ pts, l: `fy ${NUANCES.find(n => n[0] === I.nu)[1]}` }], marks: [{ x: min(I.t, pts.at(-1)[0]), y: g("fy"), l: `${g("fy")} MPa à ${f2(I.t, 0)} mm` }], xl: "épaisseur t (mm)", yl: "fy (MPa)", ymin: +I.nu * 0.75, ymax: +I.nu * 1.05 }); },
  clair: (I, g) => `Une tôle ${NUANCES.find(n => n[0] === I.nu)[1]} de ${f2(I.t, 0)} mm n'a qu'une limite d'élasticité de ${g("fy")} MPa : plus l'acier est épais, plus sa limite baisse.` },
]);

HB.add("Charpente métallique", [

{ id: "ec3-proprietes", t: "Caractéristiques d'une poutre en I soudée (semelles inégales)", ref: "RDM ; NF EN 1993-1-1 — §6.2.5, §6.2.6",
  desc: "Aire, centre de gravité, inertie, modules élastiques et plastique d'une poutre reconstituée soudée de pont (bi-poutre, caisson ouvert).",
  inputs: [...SECI, SEL("nu", "Nuance", NUANCES, "355", "")],
  calc(I) {
    const p = props(I), tmax = max(I.tf1, I.tf2), fy = fyOf(I.nu, tmax), fyw = fyOf(I.nu, I.tw);
    return { steps: [S("h", "h", L`t_{f1} + h_w + t_{f2}`, p.h, "mm", 0), R("A", "A", L`\textstyle\sum b_i\,t_i`, p.A / 100, "cm²", 1), S("zG", L`z_G`, "~depuis la fibre inférieure", p.zG, "mm", 1),
      R("I", L`I_y`, L`\textstyle\sum \left(\dfrac{b_i t_i^3}{12} + b_i t_i\,d_i^2\right)`, p.I / 1e4, "cm⁴", 0), S("Ws", L`W_{el,sup}`, L`\dfrac{I_y}{h - z_G}`, p.Wsup / 1e3, "cm³", 0),
      S("Wi", L`W_{el,inf}`, L`\dfrac{I_y}{z_G}`, p.Winf / 1e3, "cm³", 0), S("zp", L`z_{pl}`, "~axe neutre plastique (aires égales)", p.zp, "mm", 1), R("Wpl", L`W_{pl}`, L`\textstyle\sum |A_i\,z_i|`, p.Wpl / 1e3, "cm³", 0),
      S("Mel", L`M_{el,Rd}`, L`\min(W_{el})\,f_y/\gamma_{M0}`, min(p.Wsup, p.Winf) * fy / 1e6, "kN·m", 0), S("Mpl", L`M_{pl,Rd}`, L`W_{pl}\,f_y/\gamma_{M0}`, p.Wpl * fy / 1e6, "kN·m", 0),
      S("g", "g", L`\rho_a\,A` + "\\quad(78{,}5\\ \\text{kN/m}^3)", p.A / 1e6 * 78.5, "kN/m", 2)],
      vals: { fy, fyw },
      notes: [`$f_y = ${fy}$ MPa pour les semelles (${tmax} mm), $f_{yw} = ${fyw}$ MPa pour l'âme. $M_{pl,Rd}$ n'est mobilisable que pour une section de classe 1 ou 2 (voir « Classification »). Soudures et raidisseurs non comptés dans le poids.`] };
  },
  fig(I, g) { return iFig({ h: g("h"), bf1: I.bf1, tf1: I.tf1, tw: I.tw, bf2: I.bf2, tf2: I.tf2 }, { na: (g("h") - g("zG")) / 1000, naL: "G (élastique)", side: (X, Y) => P(`M${X(-max(I.bf1, I.bf2) / 2000) - 6} ${Y((g("h") - g("zp")) / 1000)}H${X(max(I.bf1, I.bf2) / 2000) + 8}`, { c: K.red, dash: "2 3" }) + T(X(max(I.bf1, I.bf2) / 2000) + 10, Y((g("h") - g("zp")) / 1000) + 12, "axe plastique", { s: 8.5, c: K.red }) }); },
  clair: (I, g) => `Cette poutre de ${f2(g("h") / 1000, 2)} m pèse ${f2(g("g"), 1)} kN/m ; son centre de gravité est à ${f2(g("zG") / 1000, 2)} m du bas, son inertie vaut ${f2(g("I") / 1e8, 4)} m⁴.` },

{ id: "ec3-classe", t: "Classification d'une section en I (flexion composée)", ref: "NF EN 1993-1-1 — §5.5, tableau 5.2",
  desc: "Classe de la semelle comprimée et de l'âme d'une section en I symétrique sous effort normal et moment.",
  inputs: [...SYMI, N("a", "Gorge des soudures âme-semelles", "mm", 6, "a"), N("Ned", "Effort normal (compression +)", "kN", 1500, L`N_{Ed}`), N("Med", "Moment fléchissant", "kN·m", 2500, L`M_{Ed}`), SEL("nu", "Nuance", NUANCES, "355", "")],
  calc(I) {
    const hw = I.h - 2 * I.tf, fy = fyOf(I.nu, I.tf), eps = sqrt(235 / fy), A = 2 * I.b * I.tf + hw * I.tw, Iy = (I.b * I.h ** 3 - (I.b - I.tw) * hw ** 3) / 12;
    const cf = (I.b - I.tw) / 2 - sqrt(2) * I.a, cw = hw - 2 * sqrt(2) * I.a, rf = cf / I.tf, rw = cw / I.tw;
    const al = min(1, max(0, 0.5 * (1 + I.Ned * 1000 / (fy * I.tw * cw)))), s1 = I.Ned * 1000 / A + I.Med * 1e6 * (cw / 2) / Iy, s2 = I.Ned * 1000 / A - I.Med * 1e6 * (cw / 2) / Iy, psi = s2 / s1;
    const cfl = rf <= 9 * eps ? 1 : rf <= 10 * eps ? 2 : rf <= 14 * eps ? 3 : 4;
    const l1 = al > 0.5 ? 396 * eps / (13 * al - 1) : 36 * eps / al, l2 = al > 0.5 ? 456 * eps / (13 * al - 1) : 41.5 * eps / al, l3 = psi > -1 ? 42 * eps / (0.67 + 0.33 * psi) : 62 * eps * (1 - psi) * sqrt(-psi);
    const cwl = rw <= l1 ? 1 : rw <= l2 ? 2 : rw <= l3 ? 3 : 4;
    return { steps: [S("eps", L`\varepsilon`, L`\sqrt{235/f_y}`, eps, "", 3), S("rf", L`c/t_f`, L`\dfrac{(b - t_w)/2 - \sqrt{2}\,a}{t_f}`, rf, "", 2), S("cfl", "", "~classe de la semelle ($9\\varepsilon$ ; $10\\varepsilon$ ; $14\\varepsilon$)", cfl, "", 0),
      S("rw", L`c/t_w`, L`\dfrac{h_w - 2\sqrt{2}\,a}{t_w}`, rw, "", 1), S("al", L`\alpha`, L`\dfrac{1}{2}\left(1 + \dfrac{N_{Ed}}{f_y\,t_w\,c}\right)`, al, "", 3), S("psi", L`\psi`, L`\dfrac{\sigma_2}{\sigma_1}`, psi, "", 3),
      S("lims", "", L`\text{limites cl. 1 / 2 / 3}`, `${f2(l1, 1)} / ${f2(l2, 1)} / ${f2(l3, 1)}`, "", 0), S("cwl", "", "~classe de l'âme", cwl, "", 0), R("cls", L`\text{classe}`, "~classe de la section", max(cfl, cwl), "", 0)],
      vals: { l3, f3: 14 * eps },
      notes: ["Classe 1/2 : distribution plastique ($\\alpha$) ; classe 3 : distribution élastique ($\\psi$). En classe 4, calculer les largeurs efficaces (feuille « Largeur efficace »). Pour une âme de classe 3 ou 4 et une semelle de classe 1 ou 2, l'EN 1993-1-1 §6.2.2.4 permet de considérer une âme efficace de classe 2."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "semelle c/t", v: g("rf"), lim: g("f3"), u: "", d: 1 }, { l: "âme c/t", v: g("rw"), lim: g("l3"), u: "", d: 1 }], { title: `Classe ${g("cls")} (semelle ${g("cfl")}, âme ${g("cwl")}) — trait : limite de classe 3`, left: 80 }); },
  clair: (I, g) => `La section est de classe ${g("cls")} : ${g("cls") <= 2 ? "elle peut se plastifier entièrement avant de voiler" : g("cls") === 3 ? "on se limite à la résistance élastique" : "elle voile avant d'atteindre la limite élastique : utiliser des largeurs efficaces"}.` },

{ id: "ec3-resistance", t: "Résistance d'une section en I : N, V, M et interactions", ref: "NF EN 1993-1-1 — §6.2.4 à 6.2.10 (6.30), (6.36)",
  desc: "Résistances plastiques d'une section en I symétrique de classe 1 ou 2 et interaction moment – effort tranchant – effort normal.",
  inputs: [...SYMI, N("Ned", "Effort normal", "kN", 800, L`N_{Ed}`), N("Ved", "Effort tranchant", "kN", 2200, L`V_{Ed}`), N("Med", "Moment fléchissant", "kN·m", 2600, L`M_{Ed}`),
    SEL("nu", "Nuance", NUANCES, "355", ""), N("eta", "Coefficient η (aire de cisaillement)", "", 1.0, L`\eta`), N("g0", "Coefficient", "", 1.0, L`\gamma_{M0}`)],
  calc(I) {
    const hw = I.h - 2 * I.tf, fy = fyOf(I.nu, I.tf), A = 2 * I.b * I.tf + hw * I.tw, Aw = hw * I.tw, Wpl = I.b * I.tf * (I.h - I.tf) + I.tw * hw * hw / 4;
    const Npl = A * fy / I.g0 / 1000, Vpl = I.eta * Aw * fy / sqrt(3) / I.g0 / 1000, Mpl = Wpl * fy / I.g0 / 1e6, rho = I.Ved > 0.5 * Vpl ? (2 * I.Ved / Vpl - 1) ** 2 : 0;
    const MplV = (Wpl - rho * Aw * Aw / (4 * I.tw)) * fy / I.g0 / 1e6, NplV = (A - rho * Aw) * fy / I.g0 / 1000, n = I.Ned / NplV, a = min((A - rho * Aw - 2 * I.b * I.tf) / (A - rho * Aw), 0.5);
    const MN = min(MplV, MplV * (1 - n) / (1 - 0.5 * a)), small = I.Ned <= min(0.25 * NplV, 0.5 * hw * I.tw * fy / I.g0 / 1000), MRd = small ? MplV : MN;
    return { steps: [S("Wpl", L`W_{pl,y}`, L`b\,t_f\,(h - t_f) + \dfrac{t_w h_w^2}{4}`, Wpl / 1e3, "cm³", 0), S("Npl", L`N_{pl,Rd}`, L`\dfrac{A\,f_y}{\gamma_{M0}}`, Npl, "kN", 0),
      R("Vpl", L`V_{pl,Rd}`, L`\dfrac{\eta\,h_w t_w\,f_y}{\sqrt{3}\,\gamma_{M0}}`, Vpl, "kN", 0), S("Mpl", L`M_{pl,Rd}`, L`\dfrac{W_{pl}\,f_y}{\gamma_{M0}}`, Mpl, "kN·m", 0),
      S("rho", L`\rho`, I.Ved > 0.5 * Vpl ? L`\left(\dfrac{2\,V_{Ed}}{V_{pl,Rd}} - 1\right)^2` : L`0\ \ (V_{Ed} \le 0{,}5\,V_{pl,Rd})`, rho, "", 4),
      S("MplV", L`M_{V,Rd}`, L`\left(W_{pl} - \dfrac{\rho\,A_w^2}{4\,t_w}\right)\dfrac{f_y}{\gamma_{M0}}`, MplV, "kN·m", 0),
      R("MRd", L`M_{N,V,Rd}`, small ? "~effort normal négligeable (§6.2.9.1 (4))" : L`M_{V,Rd}\,\dfrac{1 - n}{1 - 0{,}5\,a}`, MRd, "kN·m", 0)],
      checks: [C("$V_{Ed} \\le V_{pl,Rd}$", I.Ved <= Vpl, `${f2(I.Ved, 0)} ≤ ${f2(Vpl, 0)} kN`, I.Ved / Vpl), C("$N_{Ed} \\le N_{pl,Rd}$", I.Ned <= Npl, `${f2(I.Ned, 0)} ≤ ${f2(Npl, 0)} kN`, I.Ned / Npl),
        C("$M_{Ed} \\le M_{N,V,Rd}$", I.Med <= MRd, `${f2(I.Med, 0)} ≤ ${f2(MRd, 0)} kN·m`, I.Med / MRd)],
      notes: ["Section de classe 1 ou 2, sans trous. Le voilement de l'âme par cisaillement doit être vérifié si $h_w/t_w > 72\\,\\varepsilon/\\eta$ (feuille « Voilement par cisaillement »). L'interaction M–N–V est traitée par réduction de la limite d'élasticité de l'aire de cisaillement $(1 - \\rho)f_y$."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "VEd / Vpl,Rd", v: I.Ved / g("Vpl"), lim: 1, d: 2 }, { l: "NEd / Npl,Rd", v: I.Ned / g("Npl"), lim: 1, d: 2 }, { l: "MEd / MN,V,Rd", v: I.Med / g("MRd"), lim: 1, d: 2 }], { title: "Taux de travail (trait : 1,0)", left: 96, max: 1.2 }); },
  clair: (I, g) => `Avec ${f2(I.Ved, 0)} kN d'effort tranchant${g("rho") > 0 ? ", l'âme est en partie mobilisée par le cisaillement et" : ","} la section reprend au plus ${f2(g("MRd"), 0)} kN·m.` },

{ id: "ec3-voilement-cis", t: "Voilement de l'âme par cisaillement", ref: "NF EN 1993-1-5 — §5.2, §5.3, tableau 5.1, annexe A.3",
  desc: "Résistance au voilement par cisaillement d'une âme raidie transversalement (contribution de l'âme seule).",
  inputs: [N("hw", "Hauteur de l'âme", "mm", 2300, L`h_w`), N("tw", "Épaisseur de l'âme", "mm", 18, L`t_w`), N("a", "Espacement des raidisseurs transversaux", "mm", 4000, "a"),
    SEL("nu", "Nuance", NUANCES, "355", ""), N("eta", "Coefficient", "", 1.2, L`\eta`), SEL("post", "Montant d'extrémité", [["n", "Non rigide"], ["r", "Rigide"]], "n", ""),
    N("V", "Effort tranchant", "kN", 3800, L`V_{Ed}`), N("g1", "Coefficient", "", 1.1, L`\gamma_{M1}`)],
  calc(I) {
    const fy = fyOf(I.nu, I.tw), eps = sqrt(235 / fy), r = I.hw / I.a, kt = I.a / I.hw >= 1 ? 5.34 + 4 * r * r : 4 + 5.34 * r * r, lw = I.hw / (37.4 * I.tw * eps * sqrt(kt));
    const chi = lw < 0.83 / I.eta ? I.eta : I.post === "r" && lw >= 1.08 ? 1.37 / (0.7 + lw) : 0.83 / lw, Vbw = min(chi, I.eta) * fy * I.hw * I.tw / (sqrt(3) * I.g1) / 1000;
    const need = I.hw / I.tw > 31 * eps * sqrt(kt) / I.eta, tau = I.V * 1000 / (I.hw * I.tw), tcr = kt * 190000 * (I.tw / I.hw) ** 2;
    return { steps: [S("eps", L`\varepsilon`, L`\sqrt{235/f_{yw}}`, eps, "", 3), S("hwtw", L`h_w/t_w`, "", I.hw / I.tw, "", 1), S("kt", L`k_\tau`, I.a / I.hw >= 1 ? L`5{,}34 + 4\left(\dfrac{h_w}{a}\right)^2` : L`4 + 5{,}34\left(\dfrac{h_w}{a}\right)^2`, kt, "", 3),
      S("tcr", L`\tau_{cr}`, L`k_\tau\,\sigma_E,\ \ \sigma_E = 190\,000\left(\dfrac{t_w}{h_w}\right)^2`, tcr, "MPa", 1), R("lw", L`\bar\lambda_w`, L`\dfrac{h_w}{37{,}4\,t_w\,\varepsilon\sqrt{k_\tau}}`, lw, "", 3),
      S("chi", L`\chi_w`, "~tableau 5.1", min(chi, I.eta), "", 3), R("Vbw", L`V_{bw,Rd}`, L`\dfrac{\chi_w\,f_{yw}\,h_w\,t_w}{\sqrt{3}\,\gamma_{M1}}`, Vbw, "kN", 0), S("tau", L`\tau_{Ed}`, L`\dfrac{V_{Ed}}{h_w\,t_w}`, tau, "MPa", 1)],
      checks: [C("Vérification au voilement requise : $h_w/t_w > 31\\,\\varepsilon\\sqrt{k_\\tau}/\\eta$", true, need ? "oui" : "non (âme compacte)"), C("$\\eta_3 = V_{Ed}/V_{bw,Rd} \\le 1$", I.V <= Vbw, `${f2(I.V, 0)} ≤ ${f2(Vbw, 0)} kN`, I.V / Vbw)],
      notes: ["Contribution des semelles $V_{bf,Rd}$ négligée (sécuritaire). Le plafond $\\eta\\,f_{yw}h_w t_w/(\\sqrt{3}\\gamma_{M1})$ est respecté. $\\eta = 1{,}2$ pour les aciers jusqu'au S460 (EN 1993-1-5 §5.1 (2)). Interaction avec la flexion : §7.1 si $\\bar\\eta_3 > 0{,}5$."] };
  },
  fig(I, g) {
    const pts = range(0.3, 3, 60).map(l => [l, l < 0.83 / I.eta ? I.eta : I.post === "r" && l >= 1.08 ? 1.37 / (0.7 + l) : 0.83 / l]);
    return plot({ series: [{ pts, l: `χw (montant ${I.post === "r" ? "rigide" : "non rigide"})` }, { pts: pts.map(p => [p[0], min(I.eta, 1 / p[0] ** 2)]), l: "voilement élastique 1/λ²", c: K.mute, w: 1, dash: "4 3" }], marks: [{ x: min(g("lw"), 3), y: g("chi"), l: `χw = ${f2(g("chi"), 3)}` }], xl: "élancement λ̄w", yl: "χw", ymin: 0, ymax: 1.3 });
  },
  clair: (I, g) => `L'âme de ${f2(I.tw, 0)} mm est élancée (λw = ${f2(g("lw"), 2)}) : elle ne reprend que ${f2(g("chi") * 100, 0)} % de sa résistance plastique en cisaillement, soit ${f2(g("Vbw"), 0)} kN.` },

{ id: "ec3-flambement", t: "Flambement d'une barre comprimée", ref: "NF EN 1993-1-1 — §6.3.1.2 (6.49), tableaux 6.1 et 6.2",
  desc: "Coefficient de réduction χ selon la courbe de flambement et résistance de calcul d'une barre comprimée (palée, montant, entretoise).",
  inputs: [N("A", "Aire de la section", "cm²", 120, "A"), N("I", "Inertie dans le plan de flambement", "cm⁴", 14000, "I"), N("Lcr", "Longueur de flambement", "m", 8, L`L_{cr}`),
    SEL("nu", "Nuance", NUANCES, "355", ""), N("t", "Épaisseur maximale des parois", "mm", 16, "t"), SEL("cv", "Courbe de flambement", [["0.13", "a0"], ["0.21", "a"], ["0.34", "b"], ["0.49", "c"], ["0.76", "d"]], "0.34", ""),
    N("N", "Effort de compression", "kN", 1800, L`N_{Ed}`), N("g1", "Coefficient", "", 1.1, L`\gamma_{M1}`)],
  calc(I) {
    const fy = fyOf(I.nu, I.t), Ncr = PI * PI * E * I.I * 1e4 / (I.Lcr * 1000) ** 2 / 1000, lam = sqrt(I.A * 100 * fy / 1000 / Ncr), a = +I.cv, ph = 0.5 * (1 + a * (lam - 0.2) + lam * lam), chi = min(1, 1 / (ph + sqrt(ph * ph - lam * lam)));
    const Nb = chi * I.A * 100 * fy / I.g1 / 1000;
    return { steps: [S("i", "i", L`\sqrt{I/A}`, sqrt(I.I / I.A), "cm", 2), S("Ncr", L`N_{cr}`, L`\dfrac{\pi^2 E I}{L_{cr}^2}`, Ncr, "kN", 0), R("lam", L`\bar\lambda`, L`\sqrt{\dfrac{A\,f_y}{N_{cr}}}`, lam, "", 3),
      S("ph", L`\Phi`, L`0{,}5\left[1 + \alpha(\bar\lambda - 0{,}2) + \bar\lambda^2\right]`, ph, "", 4), R("chi", L`\chi`, L`\dfrac{1}{\Phi + \sqrt{\Phi^2 - \bar\lambda^2}} \le 1`, chi, "", 4), R("Nb", L`N_{b,Rd}`, L`\dfrac{\chi\,A\,f_y}{\gamma_{M1}}`, Nb, "kN", 0)],
      checks: [C("$N_{Ed} \\le N_{b,Rd}$", I.N <= Nb, `${f2(I.N, 0)} ≤ ${f2(Nb, 0)} kN`, I.N / Nb), C("Effets du flambement négligeables si $\\bar\\lambda \\le 0{,}2$", true, lam <= 0.2 ? "oui" : "non")],
      notes: ["Courbes (tableau 6.2) : profils laminés $h/b > 1{,}2$, $t_f \\le 40$ : a (axe y-y), b (z-z) ; sections soudées : b (y-y), c (z-z) ; tubes formés à chaud : a ; à froid : c ; cornières : b. Section de classe 1, 2 ou 3 ($A_{eff}$ en classe 4)."] };
  },
  fig(I, g) {
    const cur = [["a0", 0.13, K.mute], ["a", 0.21, K.teal], ["b", 0.34, K.gold], ["c", 0.49, K.blue], ["d", 0.76, K.red]], f = (a, l) => { const ph = 0.5 * (1 + a * (l - 0.2) + l * l); return min(1, 1 / (ph + sqrt(ph * ph - l * l))); };
    return plot({ series: cur.map(([n, a, c]) => ({ pts: range(0, 3, 60).map(l => [l, f(a, l)]), l: n, c, w: +I.cv === a ? 2.2 : 1 })), marks: [{ x: min(g("lam"), 3), y: g("chi"), l: `χ = ${f2(g("chi"), 3)}` }], xl: "élancement réduit λ̄", yl: "χ", ymin: 0, ymax: 1.05 });
  },
  clair: (I, g) => `La barre flambe avant de s'écraser : elle ne garde que ${f2(g("chi") * 100, 0)} % de sa résistance en section, soit ${f2(g("Nb"), 0)} kN.` },

{ id: "ec3-deversement", t: "Déversement d'une poutre en I", ref: "NF EN 1993-1-1 — §6.3.2.2 (cas général), (6.54) à (6.56) ; Mcr selon l'annexe informative de l'ENV",
  desc: "Moment critique de déversement d'une poutre en I bisymétrique, élancement réduit et moment résistant au déversement.",
  inputs: [...SYMI, N("L", "Longueur entre maintiens latéraux", "m", 8, "L"), N("C1", "Coefficient de moment", "", 1.13, L`C_1`), SEL("nu", "Nuance", NUANCES, "355", ""),
    N("Med", "Moment maximal", "kN·m", 2000, L`M_{Ed}`), N("g1", "Coefficient", "", 1.1, L`\gamma_{M1}`)],
  calc(I) {
    const hw = I.h - 2 * I.tf, fy = fyOf(I.nu, I.tf), Iz = 2 * I.tf * I.b ** 3 / 12 + hw * I.tw ** 3 / 12, It = (2 * I.b * I.tf ** 3 + (I.h - I.tf) * I.tw ** 3) / 3, Iw = Iz * (I.h - I.tf) ** 2 / 4;
    const Lm = I.L * 1000, Mcr = I.C1 * PI * PI * E * Iz / Lm ** 2 * sqrt(Iw / Iz + Lm * Lm * G * It / (PI * PI * E * Iz)) / 1e6;
    const Wpl = I.b * I.tf * (I.h - I.tf) + I.tw * hw * hw / 4, lam = sqrt(Wpl * fy / 1e6 / Mcr), aLT = I.h / I.b <= 2 ? 0.49 : 0.76, ph = 0.5 * (1 + aLT * (lam - 0.2) + lam * lam), chi = min(1, 1 / (ph + sqrt(ph * ph - lam * lam)));
    const Mb = chi * Wpl * fy / I.g1 / 1e6;
    return { steps: [S("Iz", L`I_z`, L`\dfrac{2\,t_f b^3 + h_w t_w^3}{12}`, Iz / 1e4, "cm⁴", 0), S("It", L`I_t`, L`\dfrac{2\,b\,t_f^3 + (h - t_f)\,t_w^3}{3}`, It / 1e4, "cm⁴", 1), S("Iw", L`I_w`, L`I_z\,\dfrac{(h - t_f)^2}{4}`, Iw / 1e12, "dm⁶", 3),
      R("Mcr", L`M_{cr}`, L`C_1\,\dfrac{\pi^2 E I_z}{L^2}\sqrt{\dfrac{I_w}{I_z} + \dfrac{L^2 G I_t}{\pi^2 E I_z}}`, Mcr, "kN·m", 0), R("lam", L`\bar\lambda_{LT}`, L`\sqrt{\dfrac{W_{pl}\,f_y}{M_{cr}}}`, lam, "", 3),
      S("aLT", L`\alpha_{LT}`, I.h / I.b <= 2 ? "~courbe c (soudé, $h/b \\le 2$)" : "~courbe d (soudé, $h/b > 2$)", aLT, "", 2), R("chi", L`\chi_{LT}`, L`\dfrac{1}{\Phi_{LT} + \sqrt{\Phi_{LT}^2 - \bar\lambda_{LT}^2}}`, chi, "", 4), R("Mb", L`M_{b,Rd}`, L`\dfrac{\chi_{LT}\,W_{pl}\,f_y}{\gamma_{M1}}`, Mb, "kN·m", 0)],
      checks: [C("$M_{Ed} \\le M_{b,Rd}$", I.Med <= Mb, `${f2(I.Med, 0)} ≤ ${f2(Mb, 0)} kN·m`, I.Med / Mb)],
      notes: ["Charge appliquée au centre de cisaillement, appuis à fourche ($k = k_w = 1$). $C_1 = 1{,}0$ (moment uniforme), 1,13 (charge répartie), 1,35 (charge ponctuelle à mi-portée), 1,88 (moment linéaire de M à 0). Section de classe 1 ou 2 ($W_{pl}$). Pour les membrures comprimées de ponts en U ou de bi-poutres en phase de bétonnage, voir NF EN 1993-2 §6.3.4."] };
  },
  fig(I, g) {
    const f = l => { const a = g("aLT"), ph = 0.5 * (1 + a * (l - 0.2) + l * l); return min(1, 1 / (ph + sqrt(ph * ph - l * l))); };
    return plot({ series: [{ pts: range(0, 2.5, 50).map(l => [l, f(l)]), l: "χLT" }, { pts: range(0.4, 2.5, 40).map(l => [l, min(1, 1 / (l * l))]), l: "Euler 1/λ²", c: K.mute, w: 1, dash: "4 3" }], marks: [{ x: min(g("lam"), 2.5), y: g("chi"), l: `χLT = ${f2(g("chi"), 3)}` }], xl: "λ̄LT", yl: "χLT", ymin: 0, ymax: 1.05 });
  },
  clair: (I, g) => `Sans maintien sur ${f2(I.L, 1)} m, la semelle comprimée peut se dérober latéralement : la poutre ne reprend que ${f2(g("Mb"), 0)} kN·m (${f2(g("chi") * 100, 0)} % de son moment plastique).` },

{ id: "ec3-soudure", t: "Soudure d'angle : méthode simplifiée", ref: "NF EN 1993-1-8 — §4.5.3.3 (4.4), tableau 4.1 ; §4.5.2 (gorge minimale)",
  desc: "Résistance par unité de longueur d'un cordon d'angle et gorge nécessaire pour un effort donné.",
  inputs: [N("F", "Effort de calcul à transmettre", "kN", 900, L`F_{w,Ed}`), N("Lw", "Longueur utile des cordons (somme)", "mm", 1200, L`l_{w}`), SEL("nu", "Nuance de la pièce la plus faible", NUANCES, "355", ""),
    N("t", "Épaisseur de la pièce la plus faible", "mm", 20, "t"), N("a", "Gorge prévue", "mm", 6, "a"), N("g2", "Coefficient", "", 1.25, L`\gamma_{M2}`)],
  calc(I) {
    const fu = fuOf(I.nu, I.t), bw = BW[I.nu], fvw = fu / (sqrt(3) * bw * I.g2), w = I.F * 1000 / I.Lw, areq = w / fvw, FR = fvw * I.a * I.Lw / 1000;
    return { steps: [S("fu", L`f_u`, "", fu, "MPa", 0), S("bw", L`\beta_w`, "~tableau 4.1", bw, "", 2), S("fvw", L`f_{vw,d}`, L`\dfrac{f_u/\sqrt{3}}{\beta_w\,\gamma_{M2}}`, fvw, "MPa", 1),
      S("w", L`F_{w,Ed}`, L`\dfrac{F}{l_w}` + "\\quad\\text{(par mm)}", w, "N/mm", 1), R("areq", L`a_{req}`, L`\dfrac{F_{w,Ed}}{f_{vw,d}}`, areq, "mm", 2), R("FR", L`F_{w,Rd}\,l_w`, L`f_{vw,d}\,a\,l_w`, FR, "kN", 0)],
      checks: [C("$F \\le F_{w,Rd}\\,l_w$", I.F <= FR, `${f2(I.F, 0)} ≤ ${f2(FR, 0)} kN`, I.F / FR), C("Gorge minimale : $a \\ge 3$ mm", I.a >= 3, `${f2(I.a, 0)} mm`), C("Longueur de cordon $\\ge \\max(30\\ \\text{mm} ; 6a)$", I.Lw >= max(30, 6 * I.a), `${f2(I.Lw, 0)} mm`)],
      notes: ["Méthode simplifiée (indépendante de l'orientation de l'effort, sécuritaire). Pour les cordons longs ($l_j > 150\\,a$), réduire par $\\beta_{Lw}$ (§4.11). La méthode directionnelle (§4.5.3.2) donne des cordons plus fins pour les efforts transversaux."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160; let s = Rc(40, 90, 250, 20, { f: K.steel, c: "#5a6f8e" }) + Rc(150, 20, 20, 70, { f: K.steel, c: "#5a6f8e" });
    s += P("M150 90l-16 0 16-16z M170 90l16 0-16-16z", { c: K.red, f: K.redL, w: 1.2 }) + P("M150 90 l-8 -8", { c: K.ink, w: .8 }) + T(110, 70, `a = ${f2(I.a, 0)} mm`, { a: "end", s: 9.5, c: K.red });
    s += arrow(160, 4, 160, 22, K.red, 2) + T(168, 14, `F = ${f2(I.F, 0)} kN`, { s: 9.5, c: K.red }) + T(165, 134, `a requise = ${f2(g("areq"), 1)} mm · fvw,d = ${f2(g("fvw"), 0)} MPa`, { a: "middle", s: 9.5 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Il faut une gorge d'au moins ${f2(g("areq"), 1)} mm ; avec ${f2(I.a, 0)} mm, les cordons reprennent ${f2(g("FR"), 0)} kN.` },

{ id: "ec3-boulon-cis", t: "Boulons ordinaires : cisaillement et pression diamétrale", ref: "NF EN 1993-1-8 — tableau 3.4, §3.5 (pinces et entraxes, tableau 3.3)",
  desc: "Résistance d'un boulon au cisaillement et à la pression diamétrale sur la pièce assemblée, vérification des pinces.",
  inputs: [SEL("M", "Diamètre", MB, "M24", ""), SEL("cl", "Classe", CLS, "8.8", ""), N("ns", "Nombre de plans de cisaillement", "U", 1, "n"), N("t", "Épaisseur de la pièce", "mm", 20, "t"),
    SEL("nu", "Nuance de la pièce", NUANCES, "355", ""), N("e1", "Pince longitudinale", "mm", 50, L`e_1`), N("e2", "Pince transversale", "mm", 40, L`e_2`), N("p1", "Entraxe longitudinal", "mm", 75, L`p_1`), N("p2", "Entraxe transversal", "mm", 80, L`p_2`),
    N("F", "Effort par boulon", "kN", 120, L`F_{v,Ed}`), N("g2", "Coefficient", "", 1.25, L`\gamma_{M2}`)],
  calc(I) {
    const d = +I.M.slice(1), d0 = d <= 24 ? d + 2 : d + 3, As = BOULONS[I.M], fub = FUB(I.cl), fu = fuOf(I.nu, I.t), av = ["4.6", "5.6", "8.8"].includes(I.cl) ? 0.6 : 0.5;
    const Fv = I.ns * av * fub * As / I.g2 / 1000, ad = min(I.e1 / (3 * d0), I.p1 / (3 * d0) - 0.25), ab = min(ad, fub / fu, 1), k1 = min(2.8 * I.e2 / d0 - 1.7, 1.4 * I.p2 / d0 - 1.7, 2.5);
    const Fb = k1 * ab * fu * d * I.t / I.g2 / 1000, Fr = min(Fv, Fb);
    return { steps: [S("d0", L`d_0`, "~diamètre du trou (jeu normal)", d0, "mm", 0), S("As", L`A_s`, "~section résistante", As, "mm²", 0), S("av", L`\alpha_v`, "~plan de cisaillement dans le filetage", av, "", 1),
      R("Fv", L`F_{v,Rd}`, L`n\,\dfrac{\alpha_v\,f_{ub}\,A_s}{\gamma_{M2}}`, Fv, "kN", 1), S("ab", L`\alpha_b`, L`\min\left(\dfrac{e_1}{3d_0}\ ;\ \dfrac{p_1}{3d_0} - \dfrac{1}{4}\ ;\ \dfrac{f_{ub}}{f_u}\ ;\ 1\right)`, ab, "", 3),
      S("k1", L`k_1`, L`\min\left(2{,}8\,\dfrac{e_2}{d_0} - 1{,}7\ ;\ 1{,}4\,\dfrac{p_2}{d_0} - 1{,}7\ ;\ 2{,}5\right)`, k1, "", 3), R("Fb", L`F_{b,Rd}`, L`\dfrac{k_1\,\alpha_b\,f_u\,d\,t}{\gamma_{M2}}`, Fb, "kN", 1), R("Fr", L`F_{Rd}`, L`\min(F_{v,Rd}\ ;\ F_{b,Rd})`, Fr, "kN", 1)],
      checks: [C("$F_{v,Ed} \\le F_{Rd}$", I.F <= Fr, `${f2(I.F, 0)} ≤ ${f2(Fr, 0)} kN`, I.F / Fr), C("Pinces minimales : $e_1, e_2 \\ge 1{,}2\\,d_0$ ; $p_1 \\ge 2{,}2\\,d_0$ ; $p_2 \\ge 2{,}4\\,d_0$", I.e1 >= 1.2 * d0 && I.e2 >= 1.2 * d0 && I.p1 >= 2.2 * d0 && I.p2 >= 2.4 * d0, `d0 = ${d0} mm`)],
      notes: ["Valeurs pour un boulon de rive (min sur $e_1$ et $p_1$ par sécurité). Si le plan de cisaillement passe par la partie lisse : $A$ au lieu de $A_s$ et $\\alpha_v = 0{,}6$. Pour les ouvrages d'art exposés, prévoir des boulons précontraints (assemblages de catégorie B ou C)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 165, k = min(1.1, 125 / (2 * I.e2 + I.p2), 190 / (I.e1 + I.p1 + 30)), x0 = 40, y0 = 25; let s = Rc(x0, y0, (I.e1 + I.p1 + 30) * k, (2 * I.e2 + I.p2) * k, { f: K.steel, c: "#5a6f8e", op: .6 });
    [[I.e1, I.e2], [I.e1 + I.p1, I.e2], [I.e1, I.e2 + I.p2], [I.e1 + I.p1, I.e2 + I.p2]].forEach(([x, y]) => { s += Ci(x0 + x * k, y0 + y * k, g("d0") / 2 * k, { f: "#fff", c: K.ink, w: 1.2 }); });
    s += dim(x0, x0 + I.e1 * k, y0 - 6, "e1") + dim(x0 + I.e1 * k, x0 + (I.e1 + I.p1) * k, y0 - 6, "p1") + dimV(x0 - 8, y0, y0 + I.e2 * k, "e2") + dimV(x0 - 8, y0 + I.e2 * k, y0 + (I.e2 + I.p2) * k, "p2");
    s += arrow(x0 + (I.e1 + I.p1 + 30) * k + 40, y0 + (I.e2 + I.p2 / 2) * k, x0 + (I.e1 + I.p1 + 30) * k + 4, y0 + (I.e2 + I.p2 / 2) * k, K.red, 2) + T(250, 140, `${I.M} ${I.cl}`, { s: 10, w: 500 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Chaque boulon ${I.M} ${I.cl} transmet au plus ${f2(g("Fr"), 0)} kN (${g("Fv") <= g("Fb") ? "le boulon cède en cisaillement" : "la tôle s'ovalise avant le cisaillement du boulon"}).` },

{ id: "ec3-boulon-hr", t: "Boulons précontraints : résistance au glissement", ref: "NF EN 1993-1-8 — §3.9.1 (3.6), (3.7), tableaux 3.6 et 3.7 ; NF EN 1090-2 (classes de surface)",
  desc: "Assemblage par frottement (catégorie B à l'ELS ou C à l'ELU) : effort de précontrainte et résistance au glissement par boulon.",
  inputs: [SEL("M", "Diamètre", MB, "M24", ""), SEL("cl", "Classe", [["8.8", "8.8"], ["10.9", "10.9"]], "10.9", ""), N("n", "Nombre d'interfaces de frottement", "U", 2, "n"),
    SEL("mu", "Classe de surface", [["0.5", "A (µ = 0,50, grenaillée)"], ["0.4", "B (µ = 0,40)"], ["0.3", "C (µ = 0,30, brossée)"], ["0.2", "D (µ = 0,20, non traitée)"]], "0.5", L`\mu`),
    SEL("ks", "Trous", [["1", "Normaux (ks = 1,0)"], ["0.85", "Surdimensionnés (0,85)"], ["0.7", "Oblongs longs (0,70)"]], "1", L`k_s`), N("Ft", "Traction concomitante par boulon", "kN", 0, L`F_{t,Ed}`),
    SEL("cat", "Catégorie", [["1.25", "C : non-glissement à l'ELU (γM3 = 1,25)"], ["1.1", "B : non-glissement à l'ELS (γM3,ser = 1,1)"]], "1.25", L`\gamma_{M3}`), N("F", "Effort de cisaillement par boulon", "kN", 180, L`F_{v,Ed}`)],
  calc(I) {
    const As = BOULONS[I.M], fub = FUB(I.cl), Fp = 0.7 * fub * As / 1000, Fs = +I.ks * I.n * +I.mu * (Fp - 0.8 * I.Ft) / +I.cat;
    return { steps: [S("As", L`A_s`, "", As, "mm²", 0), R("Fp", L`F_{p,C}`, L`0{,}7\,f_{ub}\,A_s`, Fp, "kN", 1), R("Fs", L`F_{s,Rd}`, L`\dfrac{k_s\,n\,\mu}{\gamma_{M3}}\left(F_{p,C} - 0{,}8\,F_{t,Ed}\right)`, Fs, "kN", 1),
      S("nb", "", "~nombre de boulons pour 1 000 kN", 1000 / Fs, "U", 1)],
      checks: [C("$F_{v,Ed} \\le F_{s,Rd}$", I.F <= Fs, `${f2(I.F, 0)} ≤ ${f2(Fs, 0)} kN`, I.F / Fs)],
      notes: ["En catégorie B, vérifier aussi la pression diamétrale et le cisaillement à l'ELU ; en catégorie C, la section nette $N_{net,Rd}$. Couple de serrage : feuille « Couple de serrage des boulons précontraints » (NF EN 1090-2 §8.5)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "FEd par boulon", v: I.F, lim: g("Fs"), u: "kN", d: 0 }, { l: "Fp,C précontrainte", v: g("Fp"), c: K.mute, u: "kN", d: 0 }, { l: "Fs,Rd glissement", v: g("Fs"), c: K.teal, u: "kN", d: 0 }], { title: `${I.M} ${I.cl} · ${Math.round(I.n)} interface(s) · µ = ${I.mu.replace(".", ",")}`, left: 112 }); },
  clair: (I, g) => `Serré à ${f2(g("Fp"), 0)} kN, chaque boulon ${I.M} transmet ${f2(g("Fs"), 0)} kN par frottement sans que les pièces glissent.` },

{ id: "ec3-boulon-traction", t: "Boulons : traction, poinçonnement et interaction", ref: "NF EN 1993-1-8 — tableau 3.4, (3.4.1), interaction cisaillement + traction",
  desc: "Résistance en traction d'un boulon, au poinçonnement de la pièce sous la tête ou l'écrou, et interaction avec le cisaillement.",
  inputs: [SEL("M", "Diamètre", MB, "M24", ""), SEL("cl", "Classe", CLS, "10.9", ""), N("tp", "Épaisseur de la plaque sous tête ou écrou", "mm", 20, L`t_p`), SEL("nu", "Nuance de la plaque", NUANCES, "355", ""),
    N("Ft", "Traction par boulon", "kN", 180, L`F_{t,Ed}`), N("Fv", "Cisaillement par boulon", "kN", 60, L`F_{v,Ed}`), SEL("k2", "Type", [["0.9", "Boulon (k₂ = 0,9)"], ["0.63", "Boulon à tête fraisée (0,63)"]], "0.9", L`k_2`)],
  calc(I) {
    const d = +I.M.slice(1), As = BOULONS[I.M], fub = FUB(I.cl), fu = fuOf(I.nu, I.tp), dm = { M12: 18.9, M14: 21.9, M16: 25.1, M18: 28.3, M20: 31.5, M22: 35.6, M24: 37.8, M27: 43.1, M30: 48.4, M33: 52.7, M36: 57.9 }[I.M];
    const Ftr = +I.k2 * fub * As / 1.25 / 1000, Bp = 0.6 * PI * dm * I.tp * fu / 1.25 / 1000, av = ["4.6", "5.6", "8.8"].includes(I.cl) ? 0.6 : 0.5, Fvr = av * fub * As / 1.25 / 1000, inter = I.Fv / Fvr + I.Ft / (1.4 * Ftr);
    return { steps: [R("Ftr", L`F_{t,Rd}`, L`\dfrac{k_2\,f_{ub}\,A_s}{\gamma_{M2}}`, Ftr, "kN", 1), S("dm", L`d_m`, "~moyenne des cotes de la tête (sur plats / sur angles)", dm, "mm", 1),
      R("Bp", L`B_{p,Rd}`, L`\dfrac{0{,}6\,\pi\,d_m\,t_p\,f_u}{\gamma_{M2}}`, Bp, "kN", 1), S("Fvr", L`F_{v,Rd}`, L`\dfrac{\alpha_v\,f_{ub}\,A_s}{\gamma_{M2}}`, Fvr, "kN", 1),
      R("inter", "", L`\dfrac{F_{v,Ed}}{F_{v,Rd}} + \dfrac{F_{t,Ed}}{1{,}4\,F_{t,Rd}}`, inter, "", 3)],
      checks: [C("$F_{t,Ed} \\le \\min(F_{t,Rd} ; B_{p,Rd})$", I.Ft <= min(Ftr, Bp), `${f2(I.Ft, 0)} ≤ ${f2(min(Ftr, Bp), 0)} kN`, I.Ft / min(Ftr, Bp)), C("Interaction $\\le 1$", inter <= 1, f2(inter, 3), inter)],
      notes: ["$\\gamma_{M2} = 1{,}25$ ; $d_m$ pour une tête hexagonale ISO 4014 (les têtes des boulons HR/HV de l'EN 14399 sont plus larges, donc plus favorables). L'effet de levier (« prying ») doit être ajouté à $F_{t,Ed}$ selon la rigidité de la platine (tronçons en T, §6.2.4)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "Ft,Ed / Ft,Rd", v: I.Ft / g("Ftr"), lim: 1, d: 2 }, { l: "Ft,Ed / Bp,Rd", v: I.Ft / g("Bp"), lim: 1, d: 2 }, { l: "interaction V + T", v: g("inter"), lim: 1, d: 2 }], { title: `${I.M} ${I.cl} — taux de travail`, left: 100, max: 1.2 }); },
  clair: (I, g) => `Le boulon ${I.M} ${I.cl} supporte ${f2(min(g("Ftr"), g("Bp")), 0)} kN en traction ; combiné au cisaillement, il travaille à ${f2(g("inter") * 100, 0)} %.` },

{ id: "ec3-fatigue", t: "Fatigue : résistance d'un détail (courbes S-N)", ref: "NF EN 1993-1-9 — §7, figure 7.1, (8.2) ; NF EN 1993-2 §9 (λ et ΔσE,2)",
  desc: "Courbe de résistance à la fatigue d'une catégorie de détail et vérification de l'étendue de contrainte équivalente à 2 millions de cycles.",
  inputs: [SEL("cat", "Catégorie de détail", ["160", "140", "125", "112", "100", "90", "80", "71", "63", "56", "50", "45", "40", "36"].map(c => [c, "ΔσC = " + c + " MPa"]), "71", L`\Delta\sigma_C`),
    N("dsE", "Étendue équivalente à 2·10⁶ cycles", "MPa", 45, L`\Delta\sigma_{E,2}`), N("gFf", "Coefficient sur les actions", "", 1.0, L`\gamma_{Ff}`),
    SEL("gMf", "Coefficient partiel de résistance", [["1", "Tolérance à l'endommagement, faibles conséquences (1,00)"], ["1.15", "Tolérance, conséquences importantes (1,15)"], ["1.15b", "Durée de vie sûre, faibles conséquences (1,15)"], ["1.35", "Durée de vie sûre, conséquences importantes (1,35)"]], "1.35", L`\gamma_{Mf}`),
    N("Nc", "Nombre de cycles étudié", "", 1e7, "N")],
  calc(I) {
    const dc = +I.cat, gm = parseFloat(I.gMf), dD = 0.737 * dc, dL = 0.549 * dD, R_ = n => n <= 5e6 ? dc * pow(2e6 / n, 1 / 3) : n <= 1e8 ? dD * pow(5e6 / n, 1 / 5) : dL;
    return { steps: [S("dD", L`\Delta\sigma_D`, L`0{,}737\,\Delta\sigma_C\ \ (5\cdot10^6\ \text{cycles})`, dD, "MPa", 1), S("dL", L`\Delta\sigma_L`, L`0{,}549\,\Delta\sigma_D\ \ (10^8\ \text{cycles})`, dL, "MPa", 1),
      S("dR", L`\Delta\sigma_R(N)`, "~courbe de résistance (pentes m = 3 puis 5)", R_(I.Nc), "MPa", 1), R("lim", L`\dfrac{\Delta\sigma_C}{\gamma_{Mf}}`, "", dc / gm, "MPa", 1),
      R("ratio", "", L`\dfrac{\gamma_{Ff}\,\Delta\sigma_{E,2}}{\Delta\sigma_C/\gamma_{Mf}}`, I.gFf * I.dsE / (dc / gm), "", 3)],
      checks: [C("$\\gamma_{Ff}\\,\\Delta\\sigma_{E,2} \\le \\Delta\\sigma_C/\\gamma_{Mf}$", I.gFf * I.dsE <= dc / gm, `${f2(I.gFf * I.dsE, 1)} ≤ ${f2(dc / gm, 1)} MPa`, I.gFf * I.dsE / (dc / gm))],
      notes: ["$\\Delta\\sigma_{E,2} = \\lambda\\,\\phi_2\\,\\Delta\\sigma_p$ (ponts routiers : modèle FLM3, λ selon NF EN 1993-2 §9.5.2). Catégories usuelles : 71 (attaches de raidisseurs, goujons sur semelle tendue : 80), 80 à 90 (soudure transversale bout à bout meulée), 112 à 125 (soudure longitudinale continue)."] };
  },
  fig(I, g) {
    const dc = +I.cat, dD = 0.737 * dc, dL = 0.549 * dD, R_ = n => n <= 5e6 ? dc * pow(2e6 / n, 1 / 3) : n <= 1e8 ? dD * pow(5e6 / n, 1 / 5) : dL, ns = logRange(1e5, 1e9, 80);
    return plot({ logx: true, series: [{ pts: ns.map(n => [n, R_(n)]), l: `catégorie ${dc}` }], hlines: [{ y: I.gFf * I.dsE, l: `γFf ΔσE,2 = ${f2(I.gFf * I.dsE, 0)} MPa`, c: K.red }, { y: dc / parseFloat(I.gMf), l: "ΔσC / γMf", c: K.blue }], vlines: [{ x: 2e6, l: "2·10⁶" }, { x: 5e6 }, { x: 1e8 }], xl: "nombre de cycles (log)", yl: "Δσ (MPa)", xmin: 1e5, xmax: 1e9, ymin: 0, ymax: dc * 2.3 });
  },
  clair: (I, g) => `Le détail de catégorie ${I.cat} supporte ${f2(g("lim"), 0)} MPa d'étendue équivalente avec la sécurité retenue ; la sollicitation en utilise ${f2(g("ratio") * 100, 0)} %.` },

{ id: "ec3-largeur-efficace", t: "Voilement local : largeur efficace d'une paroi comprimée", ref: "NF EN 1993-1-5 — §4.4, tableaux 4.1 et 4.2",
  desc: "Coefficient de voilement, élancement de plaque et facteur de réduction ρ d'une paroi interne ou en console (section de classe 4).",
  inputs: [SEL("type", "Paroi", [["i", "Interne (âme, semelle de caisson)"], ["o", "En console (débord de semelle)"]], "i", ""), N("b", "Largeur de la paroi", "mm", 2300, L`\bar b`), N("t", "Épaisseur", "mm", 18, "t"),
    N("psi", "Rapport des contraintes", "", -1, L`\psi = \sigma_2/\sigma_1`), SEL("nu", "Nuance", NUANCES, "355", "")],
  calc(I) {
    const fy = fyOf(I.nu, I.t), eps = sqrt(235 / fy), p = I.psi; let ks;
    if (I.type === "i") ks = p >= 1 ? 4 : p > 0 ? 8.2 / (1.05 + p) : p === 0 ? 7.81 : p > -1 ? 7.81 - 6.29 * p + 9.78 * p * p : p === -1 ? 23.9 : 5.98 * (1 - p) ** 2;
    else ks = 0.57 - 0.21 * p + 0.07 * p * p;
    const lp = (I.b / I.t) / (28.4 * eps * sqrt(ks)), rho = I.type === "i" ? (lp <= 0.5 + sqrt(0.085 - 0.055 * p) ? 1 : min(1, (lp - 0.055 * (3 + p)) / (lp * lp))) : (lp <= 0.748 ? 1 : min(1, (lp - 0.188) / (lp * lp)));
    const bc = p < 0 && I.type === "i" ? I.b / (1 - p) : I.b, beff = rho * bc;
    return { steps: [S("eps", L`\varepsilon`, L`\sqrt{235/f_y}`, eps, "", 3), S("ks", L`k_\sigma`, I.type === "i" ? "~tableau 4.1" : L`0{,}57 - 0{,}21\,\psi + 0{,}07\,\psi^2`, ks, "", 3),
      R("lp", L`\bar\lambda_p`, L`\dfrac{\bar b/t}{28{,}4\,\varepsilon\sqrt{k_\sigma}}`, lp, "", 3), R("rho", L`\rho`, I.type === "i" ? L`\dfrac{\bar\lambda_p - 0{,}055\,(3 + \psi)}{\bar\lambda_p^2} \le 1` : L`\dfrac{\bar\lambda_p - 0{,}188}{\bar\lambda_p^2} \le 1`, rho, "", 4),
      S("bc", L`b_c`, p < 0 && I.type === "i" ? L`\dfrac{\bar b}{1 - \psi}` + "\\quad\\text{(partie comprimée)}" : L`\bar b`, bc, "mm", 0), R("beff", L`b_{eff}`, L`\rho\,b_c`, beff, "mm", 0),
      S("be12", L`b_{e1}\ ;\ b_{e2}`, p < 0 ? L`0{,}4\,b_{eff}\ ;\ 0{,}6\,b_{eff}` : L`\dfrac{2\,b_{eff}}{5 - \psi}\ ;\ b_{eff} - b_{e1}`, p < 0 ? `${f2(0.4 * beff, 0)} ; ${f2(0.6 * beff, 0)}` : `${f2(2 * beff / (5 - p), 0)} ; ${f2(beff - 2 * beff / (5 - p), 0)}`, "mm", 0)],
      notes: ["Pour une âme fléchie ($\\psi = -1$), la zone tendue reste entièrement efficace ; seule la partie comprimée est réduite. Les contraintes $\\psi$ se déterminent sur la section brute puis, si nécessaire, par itération sur la section efficace (§4.4 (3))."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, x0 = 40, w = 250, y = 70, bc = g("bc"), k = w / I.b, be = g("beff"); let s = Rc(x0, y, w, 12, { f: K.steel, c: "#5a6f8e", op: .4 });
    const e1 = I.psi < 0 ? 0.4 * be : 2 * be / (5 - I.psi); s += Rc(x0, y, e1 * k, 12, { f: K.steel, c: "#5a6f8e" }) + Rc(x0 + (bc - (be - e1)) * k, y, (be - e1) * k, 12, { f: K.steel, c: "#5a6f8e" });
    if (I.psi < 0) s += Rc(x0 + bc * k, y, (I.b - bc) * k, 12, { f: K.steel, c: "#5a6f8e" });
    s += P(`M${x0} ${y - 8}L${x0} ${y - 40}L${x0 + w} ${y - 40 + 32 * (1 - I.psi)}L${x0 + w} ${y - 8}`, { c: K.blue, w: 1, f: K.blueL, op: .5 }) + T(x0 + 4, y - 44, "σ1 (compression)", { s: 9, c: K.blue });
    s += dim(x0, x0 + e1 * k, y + 28, "be1") + dim(x0 + (bc - (be - e1)) * k, x0 + bc * k, y + 28, "be2") + T(165, Hh - 8, `ρ = ${f2(g("rho"), 3)} — parties grisées non efficaces`, { a: "middle", s: 9.5 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => g("rho") < 1 ? `La paroi est trop mince pour être entièrement efficace : seuls ${f2(g("beff"), 0)} mm de la zone comprimée (${f2(g("rho") * 100, 0)} %) sont comptés.` : `La paroi est assez épaisse : elle reste entièrement efficace.` },

{ id: "ec3-patch", t: "Résistance de l'âme aux charges concentrées (lançage)", ref: "NF EN 1993-1-5 — §6.1 à 6.6 (type a), annexe A ; NF EN 1993-2 annexe C",
  desc: "Charge transversale appliquée par la semelle sur une âme non raidie (galets de lançage, appuis provisoires) : longueur chargée et résistance.",
  inputs: [N("F", "Charge concentrée", "kN", 2500, L`F_{Ed}`), N("ss", "Longueur d'appui rigide", "mm", 600, L`s_s`), N("hw", "Hauteur de l'âme", "mm", 2300, L`h_w`), N("tw", "Épaisseur de l'âme", "mm", 20, L`t_w`),
    N("bf", "Largeur de la semelle chargée", "mm", 1000, L`b_f`), N("tf", "Épaisseur de la semelle", "mm", 60, L`t_f`), N("a", "Distance entre raidisseurs", "mm", 8000, "a"), SEL("nu", "Nuance", NUANCES, "355", ""), N("g1", "Coefficient", "", 1.1, L`\gamma_{M1}`)],
  calc(I) {
    const fyw = fyOf(I.nu, I.tw), fyf = fyOf(I.nu, I.tf), kF = 6 + 2 * (I.hw / I.a) ** 2, Fcr = 0.9 * kF * E * I.tw ** 3 / I.hw / 1000, m1 = fyf * I.bf / (fyw * I.tw);
    let m2 = 0.02 * (I.hw / I.tf) ** 2, ly = min(I.ss + 2 * I.tf * (1 + sqrt(m1 + m2)), I.a), lF = sqrt(ly * I.tw * fyw / 1000 / Fcr);
    if (lF <= 0.5) { m2 = 0; ly = min(I.ss + 2 * I.tf * (1 + sqrt(m1)), I.a); lF = sqrt(ly * I.tw * fyw / 1000 / Fcr); }
    const chi = min(1, 0.5 / lF), Leff = chi * ly, FR = fyw * Leff * I.tw / I.g1 / 1000;
    return { steps: [S("kF", L`k_F`, L`6 + 2\left(\dfrac{h_w}{a}\right)^2`, kF, "", 3), S("Fcr", L`F_{cr}`, L`0{,}9\,k_F\,E\,\dfrac{t_w^3}{h_w}`, Fcr, "kN", 0), S("m1", L`m_1`, L`\dfrac{f_{yf}\,b_f}{f_{yw}\,t_w}`, m1, "", 2),
      S("m2", L`m_2`, L`0{,}02\left(\dfrac{h_w}{t_f}\right)^2\ \ \text{si}\ \bar\lambda_F > 0{,}5`, m2, "", 2), S("ly", L`l_y`, L`s_s + 2\,t_f\left(1 + \sqrt{m_1 + m_2}\right) \le a`, ly, "mm", 0),
      S("lF", L`\bar\lambda_F`, L`\sqrt{\dfrac{l_y\,t_w\,f_{yw}}{F_{cr}}}`, lF, "", 3), S("chi", L`\chi_F`, L`\dfrac{0{,}5}{\bar\lambda_F} \le 1`, chi, "", 3), R("FR", L`F_{Rd}`, L`\dfrac{f_{yw}\,\chi_F\,l_y\,t_w}{\gamma_{M1}}`, FR, "kN", 0)],
      checks: [C("$\\eta_2 = F_{Ed}/F_{Rd} \\le 1$", I.F <= FR, `${f2(I.F, 0)} ≤ ${f2(FR, 0)} kN`, I.F / FR)],
      notes: ["Charge introduite par une semelle et équilibrée par le cisaillement de l'âme des deux côtés (type a). Interaction avec la flexion (§7.2) : $\\eta_2 + 0{,}8\\,\\eta_1 \\le 1{,}4$. Pour le lançage, la NF EN 1993-2 (annexe C) recommande de prendre en compte l'excentricité de la charge et les défauts du chemin de roulement."] };
  },
  fig(I, g) {
    const W = 330, Hh = 170, k = 110 / I.hw, x0 = 40, top = 30; let s = Rc(x0, top, 250, I.tf * k + 3, { f: K.steel, c: "#5a6f8e" }) + Rc(x0, top + I.tf * k + 3, 250, I.hw * k, { f: "#e8edf5", c: "#5a6f8e" });
    const cx = 165, ly = g("ly") * k * 0.6; s += P(`M${cx - I.ss * k * 0.3} ${top}L${cx - ly / 2} ${top + I.tf * k + 3}H${cx + ly / 2}L${cx + I.ss * k * 0.3} ${top}`, { c: K.red, w: 1, dash: "3 2" });
    s += Rc(cx - I.ss * k * 0.3, top - 12, I.ss * k * 0.6, 12, { f: K.ink, c: K.ink }) + arrow(cx, top - 32, cx, top - 13, K.red, 2) + T(cx + 6, top - 20, `FEd = ${f2(I.F, 0)} kN`, { s: 9.5, c: K.red });
    s += P(`M${cx - ly / 2} ${top + I.tf * k + 3}q-6 30 0 60M${cx + ly / 2} ${top + I.tf * k + 3}q6 30 0 60`, { c: K.blue, w: 1.2, dash: "4 3" }) + T(cx, Hh - 6, `ly = ${f2(g("ly"), 0)} mm · χF = ${f2(g("chi"), 3)}`, { a: "middle", s: 9.5 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Sous un galet de lançage, l'âme résiste à ${f2(g("FR"), 0)} kN avant de voiler localement ; la charge en utilise ${f2(I.F / g("FR") * 100, 0)} %.` },

{ id: "ec3-traction", t: "Barre tendue : section brute et section nette", ref: "NF EN 1993-1-1 — §6.2.3 (6.6), (6.7) ; §3.10.3 (cornières attachées par une aile)",
  desc: "Résistance plastique de la section brute et résistance ultime de la section nette au droit des trous (tirants, contreventements).",
  inputs: [N("A", "Aire brute", "cm²", 60, "A"), N("n", "Nombre de trous dans la section critique", "U", 2, "n"), N("d0", "Diamètre des trous", "mm", 26, L`d_0`), N("t", "Épaisseur traversée", "mm", 15, "t"),
    SEL("nu", "Nuance", NUANCES, "355", ""), N("N", "Effort de traction", "kN", 1500, L`N_{Ed}`)],
  calc(I) {
    const fy = fyOf(I.nu, I.t), fu = fuOf(I.nu, I.t), An = I.A - I.n * I.d0 * I.t / 100, Npl = I.A * 100 * fy / 1000, Nu = 0.9 * An * 100 * fu / 1.25 / 1000, Nt = min(Npl, Nu);
    return { steps: [S("An", L`A_{net}`, L`A - n\,d_0\,t`, An, "cm²", 2), S("Npl", L`N_{pl,Rd}`, L`\dfrac{A\,f_y}{\gamma_{M0}}`, Npl, "kN", 0), S("Nu", L`N_{u,Rd}`, L`\dfrac{0{,}9\,A_{net}\,f_u}{\gamma_{M2}}`, Nu, "kN", 0),
      R("Nt", L`N_{t,Rd}`, L`\min(N_{pl,Rd}\ ;\ N_{u,Rd})`, Nt, "kN", 0), S("mode", "", "~mode de ruine", Nu >= Npl ? "plastification de la section brute (ductile)" : "rupture de la section nette", "", 0)],
      checks: [C("$N_{Ed} \\le N_{t,Rd}$", I.N <= Nt, `${f2(I.N, 0)} ≤ ${f2(Nt, 0)} kN`, I.N / Nt)],
      notes: ["Trous en quinconce : déduire $\\sum s^2 t/(4p)$ (§6.2.2.2 (4)). Assemblages de catégorie C (boulons précontraints) : $N_{net,Rd} = A_{net} f_y/\\gamma_{M0}$."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "NEd", v: I.N, u: "kN", d: 0, c: K.red }, { l: "Npl,Rd (brute)", v: g("Npl"), u: "kN", d: 0, c: K.gold }, { l: "Nu,Rd (nette)", v: g("Nu"), u: "kN", d: 0, c: K.blue }], { title: `Section nette : ${f2(g("An"), 1)} cm² sur ${f2(I.A, 1)} cm²`, left: 96 }); },
  clair: (I, g) => `La barre reprend ${f2(g("Nt"), 0)} kN en traction ; la rupture se produirait ${g("Nu") < g("Npl") ? "au droit des trous" : "par plastification de la section courante"}.` },

{ id: "ec3-tiges-ancrage", t: "Tiges d'ancrage scellées : traction et scellement", ref: "NF EN 1993-1-8 — §3.6.1 (tiges filetées par enlèvement de matière) ; NF EN 1992-1-1 §8.4 (adhérence)",
  desc: "Résistance en traction d'une tige d'ancrage filetée et longueur de scellement droit nécessaire dans le béton.",
  inputs: [SEL("M", "Diamètre", MB, "M30", ""), SEL("cl", "Classe", [["4.6", "4.6"], ["5.6", "5.6"], ["8.8", "8.8"]], "5.6", ""), N("Ft", "Traction par tige", "kN", 150, L`F_{t,Ed}`),
    N("fck", "Béton de scellement", "MPa", 30, L`f_{ck}`), SEL("ad", "Adhérence", [["1", "Barre crénelée / HA (η = 1)"], ["0.5", "Tige lisse (forfait 0,5)"]], "1", "")],
  calc(I) {
    const d = +I.M.slice(1), As = BOULONS[I.M], fub = FUB(I.cl), Ftr = 0.85 * 0.9 * fub * As / 1.25 / 1000, fctd = 0.7 * 0.3 * pow(I.fck, 2 / 3) / 1.5, fbd = 2.25 * fctd * +I.ad, lb = I.Ft * 1000 / (PI * d * fbd);
    return { steps: [S("As", L`A_s`, "", As, "mm²", 0), R("Ftr", L`F_{t,Rd}`, L`0{,}85 \times \dfrac{0{,}9\,f_{ub}\,A_s}{\gamma_{M2}}`, Ftr, "kN", 1), S("fbd", L`f_{bd}`, L`2{,}25\,f_{ctd}` + (I.ad === "1" ? "" : "\\times 0{,}5"), fbd, "MPa", 2),
      R("lb", L`l_b`, L`\dfrac{F_{t,Ed}}{\pi\,d\,f_{bd}}`, lb, "mm", 0), S("ld", L`l_b/d`, "", lb / d, "", 1)],
      checks: [C("$F_{t,Ed} \\le F_{t,Rd}$", I.Ft <= Ftr, `${f2(I.Ft, 0)} ≤ ${f2(Ftr, 0)} kN`, I.Ft / Ftr)],
      notes: ["Le coefficient 0,85 couvre le filetage par enlèvement de matière (§3.6.1 (3)). Le cône d'arrachement du béton et les distances aux bords sont à vérifier selon la NF EN 1992-4 ; pour les tiges lisses, un ancrage mécanique (plaque, crosse) est recommandé."] };
  },
  fig(I, g) {
    const W = 330, Hh = 165, top = 40, k = 100 / max(g("lb"), 300); let s = Rc(30, top, 270, 115) + Rc(140, top - 18, 50, 18, { f: K.steel, c: "#5a6f8e" });
    s += P(`M165 ${top - 30}V${top + g("lb") * k}`, { c: K.ink, w: 6 }) + arrow(165, top - 30, 165, top - 50 + 0, K.red, 2) + T(172, top - 38, `Ft = ${f2(I.Ft, 0)} kN`, { s: 9.5, c: K.red });
    for (let i = 1; i < 6; i++) { const y = top + g("lb") * k * i / 6; s += arrow(150, y + 6, 150, y - 6, K.teal, 1) + arrow(180, y + 6, 180, y - 6, K.teal, 1); }
    s += dimV(210, top, top + g("lb") * k, `lb = ${f2(g("lb"), 0)} mm`, K.mute, 1);
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Une tige ${I.M} ${I.cl} reprend ${f2(g("Ftr"), 0)} kN ; pour transmettre ${f2(I.Ft, 0)} kN au béton, elle doit être scellée sur ${f2(g("lb") / 10, 0)} cm.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
