/* ════════════════════════════════════════════════════════════════════
   HandBag — Appareils d'appui et équipements (NF EN 1337-2, -3 ; guides Sétra)
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, gauge } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d);

/* appareil d'appui en élastomère fretté rectangulaire de type B (NF EN 1337-3 §5.3.3) */
const AA = [H("Appareil (mm)"), N("a", "Dimension a (parallèle au déplacement principal)", "mm", 400, "a"), N("b", "Dimension b", "mm", 500, "b"), N("c", "Enrobage latéral", "mm", 5, "c"),
  N("ti", "Épaisseur d'un feuillet intermédiaire", "mm", 12, L`t_i`), N("n", "Nombre de feuillets intermédiaires", "U", 4, "n"), N("te", "Épaisseur des enrobages extérieurs (chacun)", "mm", 2.5, L`t_{e}`),
  N("ts", "Épaisseur des frettes", "mm", 4, L`t_s`), N("G", "Module de cisaillement", "MPa", 0.9, "G"),
  H("Sollicitations (ELU)"), N("Fz", "Effort vertical maximal", "kN", 2500, L`F_{z,d}`), N("Fzmin", "Effort vertical minimal (permanent)", "kN", 900, L`F_{z,d,min}`),
  N("vx", "Déplacement selon a", "mm", 20, L`v_{x,d}`), N("vy", "Déplacement selon b", "mm", 0, L`v_{y,d}`), N("aa", "Rotation autour de b (selon a)", "mrad", 6, L`\alpha_{a,d}`), N("ab", "Rotation autour de a", "mrad", 0, L`\alpha_{b,d}`),
  N("Fxy", "Effort horizontal concomitant", "kN", 60, L`F_{xy,d}`)];
function aa(I) {
  const ap = I.a - 2 * I.c, bp = I.b - 2 * I.c, Ap = ap * bp, lp = 2 * (ap + bp), S1 = Ap / (lp * I.ti), Te = I.n * I.ti + 2 * I.te, vxy = sqrt(I.vx ** 2 + I.vy ** 2);
  const Ar = Ap * (1 - I.vx / ap - I.vy / bp), ec = 1.5 * I.Fz * 1000 / (I.G * Ar * S1), eq = vxy / Te;
  const ea = (ap * ap * I.aa / 1000 + bp * bp * I.ab / 1000) * I.ti / (2 * I.n * I.ti ** 3), et = ec + eq + ea;
  const vz = I.n * I.Fz * 1000 * I.ti / Ap * (1 / (5 * I.G * S1 * S1) + 1 / 2000), rot = (ap * I.aa / 1000 + bp * I.ab / 1000) / 3, stab = 2 * ap * I.G * S1 / (3 * Te), sm = I.Fz * 1000 / Ar;
  const smin = I.Fzmin * 1000 / Ar;
  return { ap, bp, Ap, lp, S1, Te, vxy, Ar, ec, eq, ea, et, vz, rot, stab, sm, smin };
}
function aaFig(I, r, extra = "") {
  const W = 330, Hh = 170, k = 200 / I.a, tot = r.Te + (I.n + 1) * I.ts, kz = min(3, 80 / tot), x0 = 165 - I.a * k / 2, y0 = 50; let s = Rc(x0 - 20, y0 - 14, I.a * k + 40, 14, { f: K.concD, c: K.ink }), y = y0;
  const lay = [[I.te, 0]]; for (let i = 0; i < I.n; i++) lay.push([I.ts, 1], [I.ti, 0]); lay.push([I.ts, 1], [I.te, 0]);
  lay.forEach(([t, st]) => { s += Rc(x0 + (st ? 4 : 0), y, I.a * k - (st ? 8 : 0), t * kz, st ? { f: K.steel, c: "#5a6f8e" } : { f: "#3c3f4d", c: "#3c3f4d", op: .25 }); y += t * kz; });
  const sh = r.vxy / r.Te * (y - y0); s += P(`M${x0} ${y}L${x0 + sh} ${y0}M${x0 + I.a * k} ${y}L${x0 + I.a * k + sh} ${y0}`, { c: K.red, w: 1.2, dash: "4 3" });
  s += Rc(x0 - 20, y, I.a * k + 40, 14, { f: K.concD, c: K.ink }) + arrow(165, y0 - 40, 165, y0 - 16, K.red, 2) + T(171, y0 - 26, `Fz = ${f2(I.Fz, 0)} kN`, { s: 9.5, c: K.red });
  s += arrow(x0 + I.a * k + 26, y0 - 7, x0 + I.a * k + 50, y0 - 7, K.red, 1.6) + T(x0 + I.a * k + 28, y0 - 12, `vx = ${f2(I.vx, 0)}`, { s: 9, c: K.red }) + dim(x0, x0 + I.a * k, y + 30, `a = ${f2(I.a, 0)} mm`) + dimV(x0 - 30, y0, y, `Te = ${f2(r.Te, 0)}`);
  return svg(W, Hh, s + extra);
}

HB.add("Appareils d'appui et équipements", [

{ id: "aa-compression", t: "Élastomère fretté : facteur de forme et compression", ref: "NF EN 1337-3 — §5.3.3.1 à 5.3.3.3 (facteur de forme, aire réduite, εc,d)",
  desc: "Surfaces effectives, facteur de forme du feuillet, aire réduite par le déplacement, contrainte moyenne et distorsion due à la compression.",
  inputs: AA, calc(I) { const r = aa(I);
    return { steps: [S("Ap", L`A'`, L`a'\,b' = (a - 2c)(b - 2c)`, r.Ap / 100, "cm²", 0), S("S1", L`S_1`, L`\dfrac{A'}{l_p\,t_i},\ \ l_p = 2\,(a' + b')`, r.S1, "", 2), S("Te", L`T_e`, L`n\,t_i + 2\,t_e`, r.Te, "mm", 1),
      S("Ar", L`A_r`, L`A'\left(1 - \dfrac{v_{x,d}}{a'} - \dfrac{v_{y,d}}{b'}\right)`, r.Ar / 100, "cm²", 0), R("sm", L`\sigma_m`, L`\dfrac{F_{z,d}}{A_r}`, r.sm, "MPa", 2), R("ec", L`\varepsilon_{c,d}`, L`\dfrac{1{,}5\,F_{z,d}}{G\,A_r\,S_1}`, r.ec, "", 3)],
      checks: [C("$\\varepsilon_{c,d}$ dans la plage usuelle ($\\le 3$ à 4) pour garder une marge sur $\\varepsilon_{t,d} \\le 7$", r.ec <= 4, f2(r.ec, 2), r.ec / 7)],
      notes: ["Appareil de type B (frettes enrobées). $t_e$ ne compte pas dans $S_1$ (feuillet intérieur) ; les enrobages extérieurs de plus de 2,5 mm se calculent comme des feuillets avec $t_e \\times 1{,}4$. $G = 0{,}9$ MPa (valeur nominale usuelle en France)."] };
  }, fig(I, g) { return aaFig(I, aa(I)); },
  clair: (I, g) => `Sous ${f2(I.Fz, 0)} kN, l'élastomère est comprimé à ${f2(g("sm"), 1)} MPa ; grâce aux frettes (facteur de forme ${f2(g("S1"), 1)}), sa distorsion reste de ${f2(g("ec"), 2)}.` },

{ id: "aa-distorsion", t: "Élastomère fretté : distorsion totale", ref: "NF EN 1337-3 — §5.3.3.2 (5.1) à (5.4), §5.3.3.3",
  desc: "Somme des distorsions dues à la compression, au déplacement horizontal et à la rotation, comparée à la limite εu,d = 7/γm.",
  inputs: [...AA, N("gm", "Coefficient", "", 1.0, L`\gamma_m`)], calc(I) { const r = aa(I), eu = 7 / I.gm;
    return { steps: [S("ec", L`\varepsilon_{c,d}`, L`\dfrac{1{,}5\,F_{z,d}}{G\,A_r\,S_1}`, r.ec, "", 3), S("eq", L`\varepsilon_{q,d}`, L`\dfrac{v_{xy,d}}{T_q}`, r.eq, "", 3), S("ea", L`\varepsilon_{\alpha,d}`, L`\dfrac{(a'^2\alpha_{a,d} + b'^2\alpha_{b,d})\,t_i}{2\sum t_i^3}`, r.ea, "", 3),
      R("et", L`\varepsilon_{t,d}`, L`K_L\,(\varepsilon_{c,d} + \varepsilon_{q,d} + \varepsilon_{\alpha,d})`, r.et, "", 3), S("eu", L`\varepsilon_{u,d}`, L`\dfrac{\varepsilon_{u,k}}{\gamma_m} = \dfrac{7}{\gamma_m}`, eu, "", 2)],
      checks: [C("$\\varepsilon_{t,d} \\le \\varepsilon_{u,d}$", r.et <= eu, `${f2(r.et, 2)} ≤ ${f2(eu, 2)}`, r.et / eu), C("$\\varepsilon_{q,d} \\le 1{,}0$ (§5.3.3.3)", r.eq <= 1, f2(r.eq, 3), r.eq)],
      notes: ["$K_L = 1$ (charges non répétitives ; 1,5 pour les charges variables fréquentes de trafic ferroviaire selon l'AN). $T_q$ : épaisseur totale d'élastomère en cisaillement ($= T_e$)."] };
  }, fig(I, g) { return KIT.barsH([{ l: "compression εc", v: g("ec"), c: K.blue, d: 2 }, { l: "cisaillement εq", v: g("eq"), c: K.gold, d: 2 }, { l: "rotation εα", v: g("ea"), c: K.teal, d: 2 }, { l: "total εt,d", v: g("et"), lim: g("eu"), d: 2 }], { title: `Distorsion totale / limite ${f2(g("eu"), 1)}`, left: 96, max: g("eu") }); },
  clair: (I, g) => `Compression, glissement et rotation cumulés déforment l'élastomère de ${f2(g("et"), 2)} (limite ${f2(g("eu"), 1)}) : l'appareil ${g("et") <= g("eu") ? "convient" : "est trop sollicité"}.` },

{ id: "aa-stabilite", t: "Élastomère fretté : rotation et stabilité au flambement", ref: "NF EN 1337-3 — §5.3.3.6 (5.10), (5.11) ; §5.3.3.7 (stabilité)",
  desc: "Condition de non-soulèvement en rotation (tassement suffisant) et stabilité au flambement de l'appareil.",
  inputs: AA, calc(I) { const r = aa(I), cond = r.vz - r.rot;
    return { steps: [S("vz", L`\sum v_{z,d}`, L`\sum\dfrac{F_{z,d}\,t_i}{A'}\left(\dfrac{1}{5\,G\,S_1^2} + \dfrac{1}{E_b}\right)`, r.vz, "mm", 3), S("rot", "", L`\dfrac{a'\,\alpha_{a,d} + b'\,\alpha_{b,d}}{K_{r,d}}\ \ (K_{r,d} = 3)`, r.rot, "mm", 3),
      R("cond", "", L`\sum v_{z,d} - \dfrac{a'\alpha_{a,d} + b'\alpha_{b,d}}{K_{r,d}}`, cond, "mm", 3), S("sm", L`\dfrac{F_{z,d}}{A_r}`, "", r.sm, "MPa", 2), R("stab", "", L`\dfrac{2\,a'\,G\,S_1}{3\,T_e}`, r.stab, "MPa", 2)],
      checks: [C("Rotation : $\\sum v_{z,d} - (a'\\alpha_{a,d} + b'\\alpha_{b,d})/K_{r,d} \\ge 0$", cond >= 0, `${f2(cond, 3)} mm`), C("Flambement : $F_{z,d}/A_r < 2\\,a' G S_1 / 3\\,T_e$", r.sm < r.stab, `${f2(r.sm, 2)} < ${f2(r.stab, 2)} MPa`, r.sm / r.stab)],
      notes: ["$E_b = 2\\,000$ MPa (module de compressibilité). La condition de rotation s'écrit avec l'effort vertical concomitant à la rotation maximale ; elle traduit l'absence de décollement sur un bord."] };
  }, fig(I, g) { const r = aa(I); return KIT.barsH([{ l: "tassement Σvz", v: g("vz"), c: K.blue, u: "mm", d: 3 }, { l: "besoin en rotation", v: g("rot"), c: K.gold, u: "mm", d: 3 }, { l: "σm / limite flamb.", v: r.sm / r.stab, lim: 1, d: 2 }], { title: "Rotation et stabilité", left: 104 }); },
  clair: (I, g) => `L'appareil s'écrase de ${f2(g("vz"), 2)} mm, ce qui suffit pour suivre la rotation sans décoller ; il travaille à ${f2(g("sm") / g("stab") * 100, 0)} % de sa limite de flambement.` },

{ id: "aa-glissement", t: "Élastomère fretté : non-glissement", ref: "NF EN 1337-3 — §5.3.3.6 (5.12), (5.13)",
  desc: "Condition de non-glissement de l'appareil sur son support sous l'effort horizontal concomitant, et contrainte minimale de compression.",
  inputs: [...AA, SEL("Kf", "Nature du support", [["0.6", "Béton (Kf = 0,6)"], ["0.2", "Autres surfaces (Kf = 0,2)"]], "0.6", L`K_f`)], calc(I) {
    const r = aa(I), mue = 0.1 + 1.5 * +I.Kf / r.smin, Fr = mue * I.Fzmin;
    return { steps: [S("smin", L`\sigma_{m,min}`, L`\dfrac{F_{z,d,min}}{A_r}`, r.smin, "MPa", 2), S("mue", L`\mu_e`, L`0{,}1 + \dfrac{1{,}5\,K_f}{\sigma_{m}}`, mue, "", 3), R("Fr", L`\mu_e\,F_{z,d}`, "", Fr, "kN", 1)],
      checks: [C("Non-glissement : $F_{xy,d} \\le \\mu_e\\,F_{z,d}$", I.Fxy <= Fr, `${f2(I.Fxy, 0)} ≤ ${f2(Fr, 0)} kN`, I.Fxy / Fr), C("$\\sigma_{m,min} \\ge 3$ MPa (charges permanentes)", r.smin >= 3, `${f2(r.smin, 2)} MPa`)],
      notes: ["Si l'une des conditions n'est pas satisfaite, l'appareil doit être fixé (taquets, plaques de glissement ancrées, goujons). L'effort horizontal $F_{xy,d}$ est celui dû à la distorsion (feuille « Effort horizontal ») et aux efforts extérieurs."] };
  }, fig(I, g) { return aaFig(I, aa(I), T(10, 14, `µe = ${f2(g("mue"), 3)} · σm,min = ${f2(g("smin"), 2)} MPa`, { s: 9.5, w: 500 })); },
  clair: (I, g) => `Le frottement retient l'appareil jusqu'à ${f2(g("Fr"), 0)} kN d'effort horizontal ; l'effort appliqué est de ${f2(I.Fxy, 0)} kN.` },

{ id: "aa-frettes", t: "Élastomère fretté : épaisseur des frettes", ref: "NF EN 1337-3 — §5.3.3.5 (5.9)",
  desc: "Épaisseur minimale des frettes d'acier pour reprendre la traction induite par le confinement de l'élastomère.",
  inputs: [...AA, N("fy", "Limite d'élasticité des frettes", "MPa", 235, L`f_y`), SEL("Kh", "Trous dans les frettes", [["1", "Sans trous (Kh = 1)"], ["2", "Avec trous (Kh = 2)"]], "1", L`K_h`)],
  calc(I) { const r = aa(I), ts = 1.3 * I.Fz * 1000 * (I.ti + I.ti) * +I.Kh / (r.Ar * I.fy), tsr = max(ts, 2);
    return { steps: [S("Ar", L`A_r`, "", r.Ar / 100, "cm²", 0), S("ts1", L`t_s`, L`\dfrac{K_p\,F_{z,d}\,(t_1 + t_2)\,K_h\,\gamma_m}{A_r\,f_y}\ \ (K_p = 1{,}3 ;\ \gamma_m = 1)`, ts, "mm", 2), R("tsr", L`t_{s,min}`, L`\max(t_s\ ;\ 2\ \text{mm})`, tsr, "mm", 2)],
      checks: [C("$t_s^{prévu} \\ge t_{s,min}$", I.ts >= tsr, `${f2(I.ts, 1)} ≥ ${f2(tsr, 2)} mm`, tsr / I.ts)],
      notes: ["$t_1$, $t_2$ : épaisseurs des feuillets de part et d'autre de la frette (ici $t_i$). Les frettes usuelles des appareils de catalogue (2 à 5 mm, S235) satisfont en général cette condition."] };
  }, fig(I, g) { return aaFig(I, aa(I)); },
  clair: (I, g) => `Il faut des frettes d'au moins ${f2(g("tsr"), 1)} mm pour empêcher l'élastomère de s'échapper latéralement ; celles prévues font ${f2(I.ts, 1)} mm.` },

{ id: "aa-effort-h", t: "Élastomère fretté : effort horizontal et raideurs", ref: "NF EN 1337-3 — §5.3.3.7 ; guide Sétra « Appareils d'appui en élastomère fretté » (2007)",
  desc: "Effort horizontal développé par la distorsion de l'appareil et raideurs horizontale et verticale d'une ligne d'appareils.",
  inputs: [N("a", "Dimension a", "mm", 400, "a"), N("b", "Dimension b", "mm", 500, "b"), N("c", "Enrobage latéral", "mm", 5, "c"), N("Te", "Épaisseur totale d'élastomère", "mm", 53, L`T_e`),
    N("nb", "Nombre d'appareils sur la ligne d'appui", "U", 4, L`n_{aa}`), SEL("G", "Module de cisaillement", [["0.9", "Déformation lente : G = 0,9 MPa"], ["1.2", "Valeur haute (froid, vieillissement) : 1,2"], ["1.8", "Effort dynamique (freinage, séisme) : 1,8"]], "0.9", "G"),
    N("v", "Déplacement imposé", "mm", 20, L`v_x`)],
  calc(I) {
    const Ap = (I.a - 2 * I.c) * (I.b - 2 * I.c), K1 = +I.G * Ap / I.Te / 1000, Kl = I.nb * K1, Hx = K1 * I.v;
    return { steps: [S("Ap", L`A'`, L`(a - 2c)(b - 2c)`, Ap / 100, "cm²", 0), R("K1", L`K_{aa}`, L`\dfrac{G\,A'}{T_e}`, K1, "kN/mm", 2), R("Kl", L`K_{ligne}`, L`n_{aa}\,K_{aa}`, Kl, "kN/mm", 2), R("Hx", L`H_x`, L`K_{aa}\,v_x` + "\\quad\\text{(par appareil)}", Hx, "kN", 1), S("Ht", L`\sum H_x`, "", Hx * I.nb, "kN", 1)],
      notes: ["L'effort horizontal dû aux déformations lentes (température, retrait, fluage) se calcule avec $G = 0{,}9$ MPa, celui des efforts rapides (freinage, séisme) avec un module plus élevé. Répartition entre les appuis : feuille « Répartition des efforts horizontaux »."] };
  }, fig(I, g) { return plot({ series: [{ pts: range(0, 2 * I.v + 10, 20).map(v => [v, g("K1") * v]), l: `H = Kaa·v (G = ${I.G.replace(".", ",")} MPa)` }], marks: [{ x: I.v, y: g("Hx"), l: `${f2(g("Hx"), 0)} kN` }], xl: "déplacement v (mm)", yl: "H (kN)", ymin: 0 }); },
  clair: (I, g) => `Chaque appareil oppose ${f2(g("K1"), 2)} kN par millimètre de déplacement : pour ${f2(I.v, 0)} mm, il pousse le tablier de ${f2(g("Hx"), 0)} kN.` },

{ id: "aa-ptfe", t: "Appareil glissant PTFE : frottement et pression", ref: "NF EN 1337-2 — §5.2 (pressions), §6.7 tableau 11 (µmax), (6.2)",
  desc: "Coefficient de frottement maximal d'un PTFE alvéolé lubrifié selon la pression, effort horizontal transmis et contrôle de la pression de contact.",
  inputs: [N("Fz", "Effort vertical", "kN", 3000, L`N_{Sd}`), N("Fzp", "Effort vertical permanent", "kN", 1800, L`N_{G}`), N("D", "Diamètre de la feuille de PTFE", "mm", 300, "D"), N("fk", "Résistance caractéristique du PTFE", "MPa", 90, L`f_k`),
    SEL("temp", "Température minimale de l'ouvrage", [["1", "Inférieure à −5 °C (valeurs du tableau)"], ["0.667", "≥ −5 °C (µ × 2/3)"]], "1", "")],
  calc(I) {
    const A = PI * I.D ** 2 / 4, sp = I.Fzp * 1000 / A, mu = min(0.08, max(0.03, 1.2 / (10 + sp))) * +I.temp, Hx = mu * I.Fz, sEd = I.Fz * 1000 / A, sR = I.fk / 1.4;
    return { steps: [S("A", "A", L`\dfrac{\pi D^2}{4}`, A / 100, "cm²", 0), S("sp", L`\sigma_p`, L`\dfrac{N_G}{A}`, sp, "MPa", 2), R("mu", L`\mu_{max}`, L`\dfrac{1{,}2}{10 + \sigma_p}\ \in [0{,}03 ; 0{,}08]`, mu, "", 4),
      R("Hx", L`F_{x}`, L`\mu_{max}\,N_{Sd}`, Hx, "kN", 1), S("sEd", L`\sigma_{Ed}`, L`\dfrac{N_{Sd}}{A}`, sEd, "MPa", 1), S("sR", L`\dfrac{f_k}{\gamma_m}`, L`\gamma_m = 1{,}4`, sR, "MPa", 1)],
      checks: [C("Pression de contact : $\\sigma_{Ed} \\le f_k/\\gamma_m$", sEd <= sR, `${f2(sEd, 1)} ≤ ${f2(sR, 1)} MPa`, sEd / sR)],
      notes: ["PTFE alvéolé lubrifié au contact d'acier inoxydable poli. $f_k = 90$ MPa pour les charges permanentes et variables (PTFE confiné, §5.2). L'effort de frottement agit sur l'appui fixe et sur la pile considérée, dans le sens défavorable."] };
  }, fig(I, g) { return plot({ series: [{ pts: range(0, 45, 45).map(s => [s, min(0.08, max(0.03, 1.2 / (10 + s))) * +I.temp]), l: "µmax selon la pression" }], marks: [{ x: g("sp"), y: g("mu"), l: `µ = ${f2(g("mu"), 3)}` }], xl: "pression σp (MPa)", yl: "µmax", ymin: 0, ymax: 0.09 }); },
  clair: (I, g) => `Plus le PTFE est comprimé, mieux il glisse : à ${f2(g("sp"), 0)} MPa, le frottement vaut ${f2(g("mu") * 100, 1)} % de la charge, soit ${f2(g("Hx"), 0)} kN transmis à l'appui.` },

{ id: "joint-chaussee", t: "Joint de chaussée : souffle et ouverture à la pose", ref: "NF EN 1991-1-5 §6.1.3 ; guide Sétra « Joints de chaussée des ponts routiers » ; ETAG 032",
  desc: "Ouvertures minimale et maximale du joint à partir de la température de pose, du retrait-fluage et d'un déplacement complémentaire.",
  inputs: [N("Ld", "Longueur dilatable (point fixe → joint)", "m", 120, L`L_d`), N("alpha", "Coefficient de dilatation", "×10⁻⁶ /K", 10, L`\alpha_T`), N("Tp", "Température du tablier à la pose", "°C", 15, L`T_{pose}`),
    N("Tmin", "Température effective minimale", "°C", -7, L`T_{e,min}`), N("Tmax", "Température effective maximale", "°C", 40, L`T_{e,max}`), N("esf", "Retrait + fluage restant après la pose", "‰", 0.35, L`\varepsilon_{r+fl}`),
    N("W0", "Ouverture de réglage à la pose", "mm", 50, L`W_0`), N("dv", "Déplacement complémentaire (freinage, séisme de service)", "mm", 10, L`\Delta v`)],
  calc(I) {
    const a = I.alpha * 1e-6, uc = a * (I.Tp - I.Tmin) * I.Ld * 1000, ue = a * (I.Tmax - I.Tp) * I.Ld * 1000, ur = I.esf / 1000 * I.Ld * 1000;
    const Wmax = I.W0 + uc + ur + I.dv, Wmin = I.W0 - ue - I.dv;
    return { steps: [S("uc", L`u_{con}`, L`\alpha_T\,(T_{pose} - T_{e,min})\,L_d`, uc, "mm", 1), S("ue", L`u_{exp}`, L`\alpha_T\,(T_{e,max} - T_{pose})\,L_d`, ue, "mm", 1), S("ur", L`u_{r+fl}`, L`\varepsilon_{r+fl}\,L_d`, ur, "mm", 1),
      R("Wmax", L`W_{max}`, L`W_0 + u_{con} + u_{r+fl} + \Delta v`, Wmax, "mm", 1), R("Wmin", L`W_{min}`, L`W_0 - u_{exp} - \Delta v`, Wmin, "mm", 1), R("souffle", "", L`W_{max} - W_{min}`, Wmax - Wmin, "mm", 1)],
      checks: [C("Le joint ne se ferme pas : $W_{min} > 0$", Wmin > 0, `${f2(Wmin, 1)} mm`)],
      notes: ["Le souffle détermine la famille de joint (joint à revêtement amélioré jusqu'à environ 20 à 50 mm, joints à peigne ou à lèvres au-delà) selon l'ETE du produit. La température de pose réelle est relevée sur chantier et l'ouverture de réglage ajustée en conséquence (tableau de réglage)."] };
  }, fig(I, g) {
    const a = I.alpha * 1e-6, Ts = range(I.Tmin, I.Tmax, 30), W = T_ => I.W0 + a * (I.Tp - T_) * I.Ld * 1000;
    return plot({ series: [{ pts: Ts.map(t => [t, W(t)]), l: "ouverture thermique" }, { pts: Ts.map(t => [t, W(t) + g("ur")]), l: "après retrait-fluage", c: K.blue, w: 1.4, dash: "5 3" }], marks: [{ x: I.Tp, y: I.W0, l: `pose : ${f2(I.W0, 0)} mm à ${f2(I.Tp, 0)} °C` }], xl: "température du tablier (°C)", yl: "ouverture (mm)", ymin: 0 });
  },
  clair: (I, g) => `Réglé à ${f2(I.W0, 0)} mm à la pose, le joint s'ouvrira jusqu'à ${f2(g("Wmax"), 0)} mm en hiver et se refermera à ${f2(g("Wmin"), 0)} mm en été : souffle de ${f2(g("souffle"), 0)} mm.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
