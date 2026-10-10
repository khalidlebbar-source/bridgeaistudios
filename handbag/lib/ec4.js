/* ════════════════════════════════════════════════════════════════════
   HandBag — Ouvrages mixtes acier-béton (NF EN 1994-1-1 et 1994-2)
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, gauge } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), Ea = 210000;
const ecm = fck => 22000 * pow((fck + 8) / 10, 0.3), fctm = fck => 0.3 * pow(fck, 2 / 3);

/* coupe d'un tablier mixte : dalle + poutre en I */
function mixFig(o) {
  const W = 330, Hh = o.H || 175, top = 14, hs = o.hc, ht = hs + o.ha, k = (Hh - 34) / ht, cx = 120, bw = min(o.beff * k, 220);
  let s = Rc(cx - bw / 2, top, bw, hs * k) + Rc(cx - 30, top + hs * k, 60, 5, { f: K.steel, c: "#5a6f8e" }) + Rc(cx - 3, top + hs * k + 5, 6, o.ha * k - 12, { f: K.steel, c: "#5a6f8e" }) + Rc(cx - 38, top + ht * k - 7, 76, 7, { f: K.steel, c: "#5a6f8e" });
  for (let i = -1; i <= 1; i++) s += P(`M${cx + i * 14} ${top + hs * k}v-${hs * k * 0.6}`, { c: K.red, w: 2.5 });
  if (o.na !== undefined) s += P(`M${cx - bw / 2 - 6} ${top + o.na * k}H${cx + bw / 2 + 6}`, { c: K.blue, dash: "4 3" }) + T(cx + bw / 2 + 8, top + o.na * k + 3, o.naL || "axe neutre", { s: 8.5, c: K.blue });
  if (o.stress) { const g0 = 278, sc = 30 / max(...o.stress.map(v => abs(v[1])), 1e-9); s += P(`M${g0} ${top}V${top + ht * k}`, { c: K.ink, w: .8 });
    o.stress.forEach(([z, v], i, a) => { if (i) s += P(`M${g0 - a[i - 1][1] * sc} ${top + a[i - 1][0] * k}L${g0 - v * sc} ${top + z * k}`, { c: K.blue, w: 1.6 }); });
    o.stress.forEach(([z, v]) => { s += T(g0 - v * sc + (v >= 0 ? -4 : 4), top + z * k + 3, f2(v, 0), { s: 8.5, a: v >= 0 ? "end" : "start" }); }); s += T(g0, Hh - 4, o.sl || "σ (MPa)", { a: "middle", s: 8.5, c: K.mute }); }
  s += dim(cx - bw / 2, cx + bw / 2, Hh - 6, o.bl || `beff = ${f2(o.beff, 2)} m`);
  return svg(W, Hh, s);
}

HB.add("Ouvrages mixtes", [

{ id: "ec4-goujon", t: "Résistance d'un goujon à tête soudé", ref: "NF EN 1994-1-1 — §6.6.3.1 (6.18), (6.19) ; NF EN 1994-2 §6.6.3.1",
  desc: "Résistance de calcul au cisaillement d'un goujon dans une dalle pleine : rupture de l'acier ou écrasement du béton.",
  inputs: [N("d", "Diamètre du fût", "mm", 22, "d"), N("hsc", "Hauteur hors tout", "mm", 200, L`h_{sc}`), N("fu", "Résistance du goujon", "MPa", 450, L`f_u`), N("fck", "Béton de la dalle", "MPa", 35, L`f_{ck}`),
    N("gv", "Coefficient", "", 1.25, L`\gamma_V`)],
  calc(I) {
    const r = I.hsc / I.d, al = r > 4 ? 1 : 0.2 * (r + 1), E = ecm(I.fck), P1 = 0.8 * min(I.fu, 500) * PI * I.d * I.d / 4 / I.gv / 1000, P2 = 0.29 * al * I.d * I.d * sqrt(I.fck * E) / I.gv / 1000;
    return { steps: [S("r", L`h_{sc}/d`, "", r, "", 2), S("al", L`\alpha`, r > 4 ? L`1\ \ (h_{sc}/d > 4)` : L`0{,}2\left(\dfrac{h_{sc}}{d} + 1\right)`, al, "", 3), S("Ecm", L`E_{cm}`, "", E, "MPa", 0),
      S("P1", L`P_{Rd}^{(1)}`, L`\dfrac{0{,}8\,f_u\,\pi d^2/4}{\gamma_V}`, P1, "kN", 1), S("P2", L`P_{Rd}^{(2)}`, L`\dfrac{0{,}29\,\alpha\,d^2\sqrt{f_{ck}E_{cm}}}{\gamma_V}`, P2, "kN", 1), R("PRd", L`P_{Rd}`, L`\min\left(P_{Rd}^{(1)}\ ;\ P_{Rd}^{(2)}\right)`, min(P1, P2), "kN", 1),
      S("Pels", L`k_s\,P_{Rd}`, L`0{,}75\,P_{Rd}` + "\\quad\\text{(ELS caractéristique, EN 1994-2 §6.8.1)}", 0.75 * min(P1, P2), "kN", 1)],
      checks: [C("$h_{sc} \\ge 3\\,d$", r >= 3, f2(r, 2)), C("$16 \\le d \\le 25$ mm", I.d >= 16 && I.d <= 25, `${f2(I.d, 0)} mm`), C("$f_u \\le 500$ MPa", I.fu <= 500, `${f2(I.fu, 0)} MPa`)],
      notes: ["Goujons usuels : S235J2 + C450 ($f_u = 450$ MPa), Ø19, 22 ou 25 mm. Espacement longitudinal : $\\ge 5d$ ; transversal $\\ge 2{,}5d$ (dalle pleine) ; $\\le \\min(4\\,h_c ; 800)$ mm."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "rupture du goujon", v: g("P1"), u: "kN", c: g("P1") <= g("P2") ? K.red : K.mute }, { l: "écrasement du béton", v: g("P2"), u: "kN", c: g("P2") < g("P1") ? K.red : K.mute }, { l: "ELS : 0,75 PRd", v: g("Pels"), u: "kN", c: K.teal }], { title: `Goujon Ø${f2(I.d, 0)} × ${f2(I.hsc, 0)} mm`, left: 112 }); },
  clair: (I, g) => `Chaque goujon Ø${f2(I.d, 0)} transmet ${f2(g("PRd"), 0)} kN de glissement entre la dalle et la poutre (${g("P1") <= g("P2") ? "limite : acier du goujon" : "limite : béton autour du goujon"}).` },

{ id: "ec4-connexion", t: "Connexion : flux de cisaillement et espacement des goujons", ref: "NF EN 1994-2 — §6.6.2 (calcul élastique), §6.8.1 (3) ; NF EN 1994-1-1 §6.6.5.5",
  desc: "Effort de glissement par mètre à l'interface dalle–poutre (calcul élastique) et espacement des rangées de goujons à l'ELU et à l'ELS.",
  inputs: [N("Vu", "Effort tranchant ELU (part appliquée à la section mixte)", "kN", 2600, L`V_{Ed}`), N("Vs", "Effort tranchant ELS caractéristique", "kN", 1900, L`V_{car}`),
    N("Ac", "Aire de la dalle (largeur participante)", "m²", 0.78, L`A_c`), N("n", "Coefficient d'équivalence", "", 15.5, "n"), N("a", "Distance du centre de la dalle à l'axe neutre mixte", "m", 0.42, L`z_c`),
    N("I", "Inertie de la section mixte (en acier)", "m⁴", 0.19, L`I_{mixte}`), N("nr", "Goujons par rangée", "U", 4, L`n_r`), N("PRd", "Résistance d'un goujon", "kN", 122, L`P_{Rd}`)],
  calc(I) {
    const S_ = I.Ac / I.n * I.a, vu = I.Vu * S_ / I.I, vs = I.Vs * S_ / I.I, su = I.nr * I.PRd / vu, ss = I.nr * 0.75 * I.PRd / vs;
    return { steps: [S("S", L`S_c`, L`\dfrac{A_c}{n}\,z_c`, S_, "m³", 4), R("vu", L`v_{L,Ed}`, L`\dfrac{V_{Ed}\,S_c}{I}`, vu, "kN/m", 0), S("vs", L`v_{L,car}`, L`\dfrac{V_{car}\,S_c}{I}`, vs, "kN/m", 0),
      S("su", L`s_{ELU}`, L`\dfrac{n_r\,P_{Rd}}{v_{L,Ed}}`, su, "m", 3), S("ss", L`s_{ELS}`, L`\dfrac{n_r\,0{,}75\,P_{Rd}}{v_{L,car}}`, ss, "m", 3), R("s", "s", L`\min(s_{ELU}\ ;\ s_{ELS})`, min(su, ss), "m", 3)],
      notes: ["Calcul élastique non fissuré (NF EN 1994-2 §6.6.2.1), avec le coefficient d'équivalence de la charge considérée (court terme $n_0$ pour le trafic). Aux appuis intermédiaires, prendre en compte la dalle fissurée pour les contraintes mais non fissurée pour le flux de cisaillement. Ajouter les efforts concentrés aux extrémités de dalle (retrait, température, §6.6.2.4)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "flux ELU", v: g("vu"), u: "kN/m", d: 0, c: K.red }, { l: "flux ELS", v: g("vs"), u: "kN/m", d: 0, c: K.gold }, { l: "s ELU (mm)", v: g("su") * 1000, u: "mm", d: 0, c: K.blue }, { l: "s ELS (mm)", v: g("ss") * 1000, u: "mm", d: 0, c: K.teal }], { title: `Rangées de ${Math.round(I.nr)} goujons`, left: 80 }); },
  clair: (I, g) => `La dalle tend à glisser sur la poutre avec ${f2(g("vu"), 0)} kN par mètre : une rangée de ${Math.round(I.nr)} goujons tous les ${f2(g("s") * 100, 0)} cm suffit.` },

{ id: "ec4-largeur", t: "Largeur participante de la dalle", ref: "NF EN 1994-1-1 — §5.4.1.2 (5.3), (5.4), figure 5.1 ; NF EN 1994-2 §5.4.1.2",
  desc: "Largeur efficace de la dalle d'un tablier mixte en travée, sur appui intermédiaire et aux appuis d'extrémité.",
  inputs: [SEL("zone", "Zone étudiée", [["iso", "Travée isostatique (Le = L)"], ["rive", "Travée de rive continue (Le = 0,85 L₁)"], ["int", "Travée intermédiaire (Le = 0,70 L₂)"], ["app", "Appui intermédiaire (Le = 0,25 (L₁ + L₂))"]], "rive", ""),
    N("L1", "Portée considérée L₁", "m", 50, L`L_1`), N("L2", "Portée adjacente L₂", "m", 60, L`L_2`), N("b0", "Entraxe des goujons extrêmes", "m", 0.5, L`b_0`),
    N("b1", "Débord de dalle côté extérieur", "m", 2.5, L`b_1`), N("b2", "Demi-distance entre poutres (côté intérieur)", "m", 3.5, L`b_2`)],
  calc(I) {
    const Le = I.zone === "iso" ? I.L1 : I.zone === "rive" ? 0.85 * I.L1 : I.zone === "int" ? 0.7 * I.L2 : 0.25 * (I.L1 + I.L2), be1 = min(Le / 8, I.b1 - I.b0 / 2), be2 = min(Le / 8, I.b2 - I.b0 / 2);
    const beff = I.b0 + be1 + be2, Le0 = I.zone === "rive" || I.zone === "iso" ? (I.zone === "iso" ? I.L1 : 0.85 * I.L1) : NaN, b1 = 0.55 + 0.025 * Le0 / (I.b1 - I.b0 / 2), b2 = 0.55 + 0.025 * Le0 / (I.b2 - I.b0 / 2);
    const bend = isFinite(Le0) ? I.b0 + min(1, b1) * min(Le0 / 8, I.b1 - I.b0 / 2) + min(1, b2) * min(Le0 / 8, I.b2 - I.b0 / 2) : NaN;
    return { steps: [S("Le", L`L_e`, "~longueur équivalente (figure 5.1)", Le, "m", 2), S("be1", L`b_{e1}`, L`\min\left(\dfrac{L_e}{8}\ ;\ b_1 - \dfrac{b_0}{2}\right)`, be1, "m", 3), S("be2", L`b_{e2}`, L`\min\left(\dfrac{L_e}{8}\ ;\ b_2 - \dfrac{b_0}{2}\right)`, be2, "m", 3),
      R("beff", L`b_{eff}`, L`b_0 + b_{e1} + b_{e2}`, beff, "m", 3), S("bfull", "", "~largeur géométrique disponible", I.b1 + I.b2, "m", 3),
      ...(isFinite(bend) ? [S("bend", L`b_{eff,0}`, L`b_0 + \sum \beta_i\,b_{ei},\ \ \beta_i = 0{,}55 + 0{,}025\,\dfrac{L_e}{b_i} \le 1`, bend, "m", 3)] : [])],
      notes: ["$b_i$ : distance du goujon extrême au milieu entre âmes adjacentes ou au bord libre. La largeur sur appui intermédiaire sert aux contraintes et à la fissuration ; l'analyse globale peut utiliser une largeur constante égale à celle de la travée (§5.4.1.2 (4))."] };
  },
  fig(I, g) {
    const W = 330, Hh = 150, k = 280 / (I.b1 + I.b2), x0 = 25, y = 40, xs = x0 + I.b1 * k; let s = Rc(x0, y, (I.b1 + I.b2) * k, 16, { f: "#efe9dc" });
    s += Rc(xs - g("be1") * k - I.b0 / 2 * k, y, g("beff") * k, 16) + Rc(xs - 2, y + 16, 4, 60, { f: K.steel, c: "#5a6f8e" }) + Rc(xs - 20, y + 76, 40, 5, { f: K.steel, c: "#5a6f8e" });
    s += dim(xs - g("be1") * k - I.b0 / 2 * k, xs - g("be1") * k - I.b0 / 2 * k + g("beff") * k, y - 8, `beff = ${f2(g("beff"), 2)} m`) + dim(x0, x0 + I.b1 * k, y + 100, `b1 = ${f2(I.b1, 2)}`) + dim(xs, xs + I.b2 * k, y + 100, `b2 = ${f2(I.b2, 2)}`);
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Seuls ${f2(g("beff"), 2)} m de dalle (sur ${f2(I.b1 + I.b2, 2)} m) travaillent réellement avec la poutre : le cisaillement « traîne » le béton éloigné de l'âme.` },

{ id: "ec4-equivalence", t: "Coefficients d'équivalence acier / béton", ref: "NF EN 1994-1-1 — §5.4.2.2 (5.6) ; NF EN 1994-2 §5.4.2.2",
  desc: "Coefficients d'équivalence à court terme et à long terme selon la nature du chargement (permanent, retrait, déformations imposées).",
  inputs: [N("fck", "Béton de la dalle", "MPa", 35, L`f_{ck}`), N("phi", "Coefficient de fluage", "", 1.4, L`\varphi(t,t_0)`), N("phis", "Coefficient de fluage pour le retrait (t₀ = 1 j)", "", 2.2, L`\varphi(t,1)`)],
  calc(I) {
    const E = ecm(I.fck), n0 = Ea / E, nP = n0 * (1 + 1.1 * I.phi), nS = n0 * (1 + 0.55 * I.phis), nD = n0 * (1 + 1.5 * I.phi);
    return { steps: [S("Ecm", L`E_{cm}`, L`22\,000\left(\dfrac{f_{cm}}{10}\right)^{0{,}3}`, E, "MPa", 0), R("n0", L`n_0`, L`\dfrac{E_a}{E_{cm}}`, n0, "", 2),
      R("nP", L`n_{L,G}`, L`n_0\,(1 + 1{,}10\,\varphi_t)`, nP, "", 2), R("nS", L`n_{L,S}`, L`n_0\,(1 + 0{,}55\,\varphi_t)`, nS, "", 2), S("nD", L`n_{L,D}`, L`n_0\,(1 + 1{,}50\,\varphi_t)`, nD, "", 2)],
      tables: [{ title: "Coefficients à utiliser", head: ["Chargement", "$\\psi_L$", "$n$"], rows: [["Trafic, vent, température (court terme)", 0, n0], ["Charges permanentes", 1.1, nP], ["Retrait (effets primaires et secondaires)", 0.55, nS], ["Déformations imposées (dénivellations d'appui)", 1.5, nD]], d: [2, 2] }],
      notes: ["$\\varphi_t = \\varphi(t, t_0)$ selon l'âge $t_0$ du béton au chargement (NF EN 1992-1-1 annexe B) ; pour le retrait, $t_0 = 1$ jour. Simplification courante (NF EN 1994-2 §5.4.2.2 (11)) : une valeur unique $t_0$ moyenne pour toutes les charges permanentes."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "court terme n0", v: g("n0"), c: K.teal }, { l: "permanent", v: g("nP"), c: K.gold }, { l: "retrait", v: g("nS"), c: K.blue }, { l: "déform. imposées", v: g("nD"), c: K.red }], { title: "1 m² de béton compte comme 1/n m² d'acier", left: 104 }); },
  clair: (I, g) => `À court terme le béton vaut 1/${f2(g("n0"), 1)} d'acier ; sous charge permanente il flue et ne vaut plus que 1/${f2(g("nP"), 1)}.` },

{ id: "ec4-mpl", t: "Moment résistant plastique d'une section mixte (moment positif)", ref: "NF EN 1994-1-1 — §6.2.1.2 ; NF EN 1994-2 §6.2.1.2",
  desc: "Moment plastique d'une poutre en I soudée avec dalle comprimée : position de l'axe neutre plastique et moment résistant.",
  inputs: [N("beff", "Largeur participante", "m", 3.2, L`b_{eff}`), N("hc", "Épaisseur de la dalle", "m", 0.25, L`h_c`), N("fck", "Béton", "MPa", 35, L`f_{ck}`),
    H("Poutre (mm)"), N("bf1", "Semelle supérieure : largeur", "mm", 600, L`b_{f1}`), N("tf1", "Semelle supérieure : épaisseur", "mm", 30, L`t_{f1}`), N("hw", "Âme : hauteur", "mm", 2000, L`h_w`), N("tw", "Âme : épaisseur", "mm", 18, L`t_w`),
    N("bf2", "Semelle inférieure : largeur", "mm", 900, L`b_{f2}`), N("tf2", "Semelle inférieure : épaisseur", "mm", 60, L`t_{f2}`), N("fy", "Limite d'élasticité", "MPa", 345, L`f_y`), N("Med", "Moment ELU (section mixte)", "kN·m", 25000, L`M_{Ed}`)],
  calc(I) {
    const fcd = I.fck / 1.5, Nc = 0.85 * fcd * I.beff * I.hc * 1000, hc = I.hc * 1000;   // N/mm → kN
    const parts = [[I.bf1, I.tf1, hc], [I.tw, I.hw, hc + I.tf1], [I.bf2, I.tf2, hc + I.tf1 + I.hw]], Na = parts.reduce((s, p) => s + p[0] * p[1], 0) * I.fy / 1000, H_ = hc + I.tf1 + I.hw + I.tf2;
    let x, M;
    if (Nc >= Na) { x = Na / (0.85 * fcd * I.beff * 1000) * 1000; M = 0; parts.forEach(p => { M += p[0] * p[1] * I.fy * (p[2] + p[1] / 2 - x / 2); }); M /= 1e6; }
    else { const F = z => { let comp = Nc, ten = 0; parts.forEach(([b, t, z0]) => { const c = max(0, min(t, z - z0)); comp += b * c * I.fy / 1000; ten += b * (t - c) * I.fy / 1000; }); return comp - ten; };
      let a = hc, b = H_; for (let i = 0; i < 80; i++) { const m = (a + b) / 2; F(m) < 0 ? a = m : b = m; } x = (a + b) / 2;
      M = Nc * 1000 * (x - hc / 2); parts.forEach(([b2, t, z0]) => { const c = max(0, min(t, x - z0)); M += b2 * c * I.fy * (x - (z0 + c / 2)); M += b2 * (t - c) * I.fy * ((z0 + c + t) / 2 - x); }); M /= 1e6; }
    const xr = x / H_, beta = I.fy >= 420 && xr > 0.15 ? max(0.85, 1 - 0.15 * (xr - 0.15) / 0.25) : 1, Mr = beta * M;
    return { steps: [S("Nc", L`N_{c,f}`, L`0{,}85\,f_{cd}\,b_{eff}\,h_c`, Nc, "kN", 0), S("Na", L`N_{pl,a}`, L`A_a\,f_{yd}`, Na, "kN", 0),
      S("cas", "", "~" + (Nc >= Na ? "$N_{c,f} \\ge N_{pl,a}$ : axe neutre plastique dans la dalle" : "$N_{c,f} < N_{pl,a}$ : axe neutre plastique dans la poutre"), "", "", 0),
      R("x", L`x_{pl}`, "~profondeur de l'axe neutre plastique (depuis le haut de la dalle)", x, "mm", 0), S("xr", L`x_{pl}/h`, "", xr, "", 3), S("beta", L`\beta`, "~réduction S420/S460 si $x_{pl} > 0{,}15\\,h$", beta, "", 3),
      R("Mpl", L`M_{pl,Rd}`, L`\beta\sum F_i\,z_i`, Mr, "kN·m", 0)],
      checks: [C("$M_{Ed} \\le M_{pl,Rd}$", I.Med <= Mr, `${f2(I.Med, 0)} ≤ ${f2(Mr, 0)} kN·m`, I.Med / Mr)],
      notes: ["Section de classe 1 ou 2 en moment positif (semelle supérieure maintenue par la connexion). $\\gamma_a = 1{,}0$, $\\gamma_c = 1{,}5$ ; armatures de la dalle négligées. Pour une section de classe 3 ou un phasage de construction, faire une vérification élastique en contraintes (NF EN 1994-2 §6.2.1.4)."] };
  },
  fig(I, g) { return mixFig({ beff: I.beff, hc: I.hc, ha: (I.tf1 + I.hw + I.tf2) / 1000, na: g("x") / 1000, naL: "axe plastique" }); },
  clair: (I, g) => `La dalle comprimée et la poutre tendue forment un couple qui résiste à ${f2(g("Mpl"), 0)} kN·m ; l'axe neutre est à ${f2(g("x"), 0)} mm sous le haut de la dalle.` },

{ id: "ec4-retrait", t: "Effets isostatiques du retrait (ou d'un écart thermique)", ref: "NF EN 1994-2 — §5.4.2.2 (retrait), §7.2 ; NF EN 1991-1-5 §6.1.4.3 (±10 K)",
  desc: "Contraintes autoéquilibrées dans une section mixte dues à un raccourcissement libre de la dalle (retrait) ou à un écart de température dalle/acier.",
  inputs: [SEL("cas", "Cas", [["r", "Retrait"], ["t", "Écart de température dalle − acier"]], "r", ""), N("ecs", "Retrait libre", "", 3e-4, L`\varepsilon_{cs}`), N("dT", "Écart de température (dalle plus froide +)", "K", 10, L`\Delta T`),
    N("n", "Coefficient d'équivalence correspondant", "", 18, "n"), N("Ac", "Aire de la dalle", "m²", 0.8, L`A_c`), N("Icc", "Inertie propre de la dalle", "m⁴", 0.0042, L`I_c`),
    N("Aa", "Aire de la poutre acier", "m²", 0.12, L`A_a`), N("Ia", "Inertie de la poutre acier", "m⁴", 0.075, L`I_a`), N("za", "Distance du centre de la dalle au centre de la poutre", "m", 1.25, "a"),
    N("vi", "Distance du centre de la poutre à sa fibre inférieure", "m", 0.85, L`v_{a,inf}`), N("hc", "Épaisseur de la dalle", "m", 0.25, L`h_c`)],
  calc(I) {
    const eps = I.cas === "r" ? I.ecs : 1e-5 * I.dT, Ac = I.Ac / I.n, A = I.Aa + Ac, zc = I.Aa * I.za / A, Im = I.Ia + I.Icc / I.n + I.Aa * (I.za - zc) ** 2 + Ac * zc * zc;   // zc : centre dalle → G mixte
    const Nf = eps * Ea / I.n * I.Ac, M = Nf * zc;   // MN, MN·m
    const st = y => Nf / A - M * y / Im, sAi = st(I.za - zc + I.vi), sAs = st(-zc + I.hc / 2), sct = -eps * Ea / I.n + st(-zc - I.hc / 2) / I.n, scb = -eps * Ea / I.n + st(-zc + I.hc / 2) / I.n, sc = -eps * Ea / I.n + (Nf / A + M * zc / Im) / I.n;
    return { steps: [S("eps", L`\varepsilon`, I.cas === "r" ? L`\varepsilon_{cs}` : L`\alpha\,\Delta T`, eps, "", "e"), S("Nf", L`N_{cs}`, L`\varepsilon\,\dfrac{E_a}{n}\,A_c`, Nf * 1000, "kN", 0),
      S("zc", L`z_c`, "~distance du centre de la dalle au centre de gravité mixte", zc, "m", 3), S("Im", L`I_{mixte}`, "", Im, "m⁴", 4), S("M", L`M_{cs}`, L`N_{cs}\,z_c`, M * 1000, "kN·m", 0),
      R("sAi", L`\sigma_{a,inf}`, L`\dfrac{N_{cs}}{A} - \dfrac{M_{cs}\,(a - z_c + v_{a,inf})}{I}`, sAi, "MPa", 1), R("sc", L`\sigma_{c,G}`, L`-\varepsilon\,\dfrac{E_a}{n} + \dfrac{1}{n}\left(\dfrac{N_{cs}}{A} + \dfrac{M_{cs}\,z_c}{I}\right)`, sc, "MPa", 2)],
      vals: { sAs, sct, scb },
      notes: ["Compression positive. La dalle, empêchée de se raccourcir par la poutre, est tendue ; la poutre est comprimée en haut et tendue en bas. Effets isostatiques seuls : dans une poutre continue, ajouter les effets hyperstatiques (moments de continuité). Retrait : $n = n_{L,S}$ ; température : $n = n_0$."] };
  },
  fig(I, g) { const ha = I.za + I.vi - I.hc / 2; return mixFig({ beff: 3, hc: I.hc, ha, stress: [[0, g("sct")], [I.hc, g("scb")], [I.hc, g("sAs")], [I.hc + ha, g("sAi")]], sl: "σ (MPa) : béton puis acier", bl: I.cas === "r" ? "retrait de la dalle" : `dalle plus froide de ${f2(I.dT, 0)} K` }); },
  clair: (I, g) => `En se raccourcissant, la dalle est retenue par la poutre : elle reste tendue (${f2(g("sc"), 2)} MPa) et le bas de la poutre se ${g("sAi") < 0 ? "tend" : "comprime"} de ${f2(abs(g("sAi")), 0)} MPa.` },

{ id: "ec4-fissuration", t: "Hourdis sur appui : armatures minimales et fissuration", ref: "NF EN 1994-1-1 — §7.4.2 (7.1), tableau 7.1 ; NF EN 1994-2 §7.4",
  desc: "Section minimale d'armatures longitudinales de la dalle tendue d'un tablier mixte au voisinage des appuis intermédiaires.",
  inputs: [N("hc", "Épaisseur de la dalle", "m", 0.25, L`h_c`), N("b", "Largeur de dalle considérée", "m", 1, "b"), N("z0", "Distance du centre de la dalle à l'axe neutre de la section mixte non fissurée", "m", 0.6, L`z_0`),
    N("fct", "Résistance en traction effective", "MPa", 3.2, L`f_{ct,eff}`), N("phi", "Diamètre des barres", "mm", 16, L`\varnothing`), SEL("wk", "Ouverture visée", [["0.4", "0,4 mm"], ["0.3", "0,3 mm"], ["0.2", "0,2 mm"]], "0.3", L`w_k`)],
  calc(I) {
    const kc = min(1, 1 / (1 + I.hc / (2 * I.z0)) + 0.3), phis = I.phi * 2.9 / I.fct, tab = { "0.4": [40, 32, 20, 16, 12, 10, 8, 6], "0.3": [32, 25, 16, 12, 10, 8, 6, 5], "0.2": [25, 16, 12, 8, 6, 5, 4, 0] }[I.wk], sig = [160, 200, 240, 280, 320, 360, 400, 450];
    const nv = I.wk === "0.2" ? 7 : 8; let ss = sig[nv - 1]; if (phis >= tab[0]) ss = 160; else for (let i = 0; i < nv - 1; i++) if (phis <= tab[i] && phis >= tab[i + 1]) { ss = sig[i] + (sig[i + 1] - sig[i]) * (tab[i] - phis) / (tab[i] - tab[i + 1]); break; }
    const As = 0.9 * kc * 0.8 * I.fct * I.b * I.hc / ss * 1e4;
    return { steps: [S("kc", L`k_c`, L`\dfrac{1}{1 + h_c/(2\,z_0)} + 0{,}3 \le 1`, kc, "", 3), S("phis", L`\varnothing^*`, L`\varnothing\,\dfrac{f_{ct,0}}{f_{ct,eff}}\ \ (f_{ct,0} = 2{,}9)`, phis, "mm", 1),
      S("ss", L`\sigma_s`, "~tableau 7.1 (interpolé)", ss, "MPa", 0), R("As", L`A_{s,min}`, L`k_s\,k_c\,k\,\dfrac{f_{ct,eff}\,A_{ct}}{\sigma_s}\ \ (k_s = 0{,}9,\ k = 0{,}8)`, As, "cm²", 2), S("rho", L`\rho_s`, L`\dfrac{A_{s,min}}{b\,h_c}`, As / 1e4 / (I.b * I.hc) * 100, "%", 2)],
      notes: ["$A_{ct}$ : aire de la dalle dans la largeur participante. Armatures à répartir sur les deux nappes (environ 2/3 en nappe supérieure). La NF EN 1994-2 recommande en outre un pourcentage minimal de 1 % dans les zones tendues des ponts (AN : à confirmer selon le marché)."] };
  },
  fig(I, g) { return mixFig({ beff: I.b * 3, hc: I.hc, ha: 1.6, bl: `As,min = ${f2(g("As"), 1)} cm² pour ${f2(I.b, 2)} m de dalle` }); },
  clair: (I, g) => `Sur appui, la dalle est tendue : il faut au moins ${f2(g("As"), 1)} cm² d'acier par mètre (${f2(g("rho"), 2)} %) pour garder des fissures de ${I.wk.replace(".", ",")} mm.` },

{ id: "ec4-phasage", t: "Phasage : poutre métallique seule au bétonnage", ref: "NF EN 1994-2 — §6.3.4 (phase de construction) ; NF EN 1991-1-6 §4.11.2 (charges de construction)",
  desc: "Contraintes dans une poutre métallique isostatique portant seule le béton frais et les charges de chantier, avant prise de la dalle.",
  inputs: [N("L", "Portée", "m", 40, "L"), N("e", "Entraxe des poutres (largeur de dalle reprise)", "m", 6, "e"), N("hc", "Épaisseur moyenne de la dalle", "m", 0.27, L`h_c`), N("ga", "Poids propre de la poutre", "kN/m", 10, L`g_a`),
    N("qc", "Charges de construction (moyenne)", "kN/m²", 1.0, L`q_{ca}`), N("Ia", "Inertie de la poutre seule", "m⁴", 0.075, L`I_a`), N("vs", "Distance de G à la fibre supérieure", "m", 1.15, L`v_{sup}`), N("vi", "Distance de G à la fibre inférieure", "m", 0.85, L`v_{inf}`),
    N("chi", "Coefficient de déversement de la membrure comprimée", "", 0.8, L`\chi_{LT}`), N("fy", "Limite d'élasticité", "MPa", 345, L`f_y`)],
  calc(I) {
    const g = I.ga + 25 * I.hc * I.e, q = I.qc * I.e, Mu = (1.35 * g + 1.5 * q) * I.L ** 2 / 8, ss = Mu / 1000 * I.vs / I.Ia, si = Mu / 1000 * I.vi / I.Ia, lim = I.chi * I.fy / 1.1, fl = 5 * g / 1000 * I.L ** 4 / (384 * Ea * I.Ia) * 1000;
    return { steps: [S("g", "g", L`g_a + 25\,h_c\,e`, g, "kN/m", 1), S("q", "q", L`q_{ca}\,e`, q, "kN/m", 1), S("Mu", L`M_{Ed}`, L`\dfrac{(1{,}35\,g + 1{,}5\,q)\,L^2}{8}`, Mu, "kN·m", 0),
      R("ss", L`\sigma_{sup}`, L`\dfrac{M_{Ed}\,v_{sup}}{I_a}`, ss, "MPa", 1), S("si", L`\sigma_{inf}`, L`\dfrac{M_{Ed}\,v_{inf}}{I_a}`, si, "MPa", 1), S("lim", L`\dfrac{\chi_{LT}\,f_y}{\gamma_{M1}}`, "", lim, "MPa", 1),
      S("fl", "f", L`\dfrac{5\,g\,L^4}{384\,E\,I_a}`, fl, "mm", 0)],
      checks: [C("Membrure comprimée : $\\sigma_{sup} \\le \\chi_{LT}\\,f_y/\\gamma_{M1}$", ss <= lim, `${f2(ss, 0)} ≤ ${f2(lim, 0)} MPa`, ss / lim), C("Membrure tendue : $\\sigma_{inf} \\le f_y$", si <= I.fy, `${f2(si, 0)} ≤ ${f2(I.fy, 0)} MPa`, si / I.fy)],
      notes: ["La flèche sous poids du béton frais sert à fixer la contre-flèche de fabrication (ajouter les phases suivantes). Charges de construction NF EN 1991-1-6 : 10 % du poids du béton sur 3 m × 3 m (≥ 0,75 et ≤ 1,5 kN/m²) + 0,75 kN/m² ailleurs. Le coefficient $\\chi_{LT}$ dépend de l'entretoisement provisoire (voir « Déversement »)."] };
  },
  fig(I, g) { const gL = g("g"); return KIT.beamDiag({ L: I.L, q: `g + q = ${f2(gL + g("q"), 1)} kN/m (béton frais)`, f: x => (1.35 * gL + 1.5 * g("q")) * x * (I.L - x) / 2, marks: [{ x: I.L / 2, l: `MEd = ${f2(g("Mu"), 0)} kN·m` }], label: "poutre métallique seule" }); },
  clair: (I, g) => `Tant que le béton n'a pas durci, la poutre porte seule ${f2(g("g"), 0)} kN/m : sa semelle supérieure est comprimée à ${f2(g("ss"), 0)} MPa (limite ${f2(g("lim"), 0)} MPa avec le déversement).` },
]);
})(typeof window !== "undefined" ? window : globalThis);
