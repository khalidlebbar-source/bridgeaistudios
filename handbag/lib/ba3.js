/* ════════════════════════════════════════════════════════════════════
   HandBag — Béton armé BAEL : éléments (classeurs Biblio 2004)
   Torsion, méthode forfaitaire, poutre-voile, voûte de décharge.
   Unités : m, kN, kN/m, kN·m ; contraintes en MPa ; aciers en cm².
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, udl } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d);
const SUPP = [["1", "appui de rive"], ["2", "appui de rive solidaire d'un poteau"], ["3", "appui central d'une poutre à 2 travées"], ["4", "appui voisin des appuis de rive"], ["5", "appui intermédiaire"]];
const kSup = s => ({ 1: 0, 2: 0.15, 3: 0.6, 4: 0.5, 5: 0.4 })[s];

/* flexion simple ELU BAEL, section rectangulaire (méthode de la feuille « Voûte ») */
function baelRect(Mu, b, d, dd, fc, fe, gam) {
  const fbu = 0.85 * fc / 1.5, fed = fe / 1.15, mbu = Mu / 1000 / (b * d * d * fbu);
  const mlu = fe <= 400 ? (3440 * gam + 49 * fc - 3050) / 1e4 : (3220 * gam + 51 * fc - 3100) / 1e4;
  let Asc = 0, As;
  if (mbu <= mlu) As = Mu / 1000 / fed / (d * (1 - 0.4 * 1.25 * (1 - sqrt(1 - 2 * mbu)))) * 1e4;
  else { const Mlu = mlu * b * d * d * fbu, ssc = fe <= 400 ? 9 * gam * fc - 0.9 * dd / d * (13 * fc + 415) : 9 * gam * fc - dd / d * (13 * fc + 415);
    Asc = (Mu / 1000 - Mlu) / (d - dd) / ssc * 1e4; As = Mlu / fed / (d * (1 - 0.4 * 1.25 * (1 - sqrt(1 - 2 * mlu)))) * 1e4 + (Mu / 1000 - Mlu) / (d - dd) / fed * 1e4; }
  return { fbu, fed, mbu, mlu, Asc, As };
}

HB.add("Béton armé — BAEL", [

{ id: "bael-torsion", t: "Torsion : armatures d'une section rectangulaire (BAEL)", ref: "BAEL 91 révisé 99, art. A.5.4 — section creuse équivalente ; Biblio 2004 « Armatures de torsion »",
  desc: "Contrainte tangente de torsion, armatures transversales et longitudinales de torsion d'une poutre rectangulaire par la méthode de la section creuse équivalente.",
  inputs: [N("a", "Petit côté", "m", 0.8, "a"), N("b", "Grand côté", "m", 1.1, "b"), N("Tu", "Moment de torsion ultime", "kN·m", 98.8, L`T_u`),
    N("fc", "Résistance du béton", "MPa", 40, L`f_{c28}`), N("fe", "Limite d'élasticité des aciers", "MPa", 500, L`f_e`), N("gs", "Coefficient de sécurité de l'acier", "", 1.15, L`\gamma_s`),
    N("tv", "Contrainte tangente due à l'effort tranchant (0 si aucune)", "MPa", 0, L`\tau_V`), SEL("fiss", "Fissuration", [["pp", "peu préjudiciable"], ["p", "préjudiciable ou très préjudiciable"]], "pp", "")],
  calc(I) {
    const b0 = min(I.a, I.b) / 6, Om = (I.a - b0) * (I.b - b0), u = 2 * (I.a - b0 + I.b - b0), tT = I.Tu / 1000 / (2 * Om * b0);
    const tlim = I.fiss === "pp" ? min(0.2 * I.fc / 1.5, 5) : min(0.15 * I.fc / 1.5, 4), tc = sqrt(tT * tT + I.tv * I.tv);
    const At = I.Tu / 1000 * I.gs / (2 * I.fe * Om) * 1e4, Atmin = (I.fc <= 40 ? 0.4 : 0.13 * (0.6 + 0.06 * I.fc)) * b0 * I.gs / I.fe * 1e4;
    return { steps: [S("b0", L`b_0`, L`\dfrac{\min(a, b)}{6}`, b0, "m", 4), S("Om", L`\Omega`, L`(a - b_0)(b - b_0)`, Om, "m²", 4), S("u", "u", L`2\,(a + b - 2\,b_0)`, u, "m", 4),
      R("tT", L`\tau_T`, L`\dfrac{T_u}{2\,\Omega\,b_0}`, tT, "MPa", 3), S("tc", L`\sqrt{\tau_T^2 + \tau_V^2}`, "~(section creuse)", tc, "MPa", 3), S("tlim", L`\tau_{lim}`, I.fiss === "pp" ? L`\min(0{,}2\,f_{c28}/\gamma_b ;\ 5)` : L`\min(0{,}15\,f_{c28}/\gamma_b ;\ 4)`, tlim, "MPa", 3),
      R("At", L`A_t / s_t`, L`\dfrac{T_u\,\gamma_s}{2\,f_e\,\Omega}`, At, "cm²/m", 3), S("Atmin", L`(A_t/s_t)_{min}`, L`0{,}4\,b_0\,\gamma_s / f_e`, Atmin, "cm²/m", 3),
      R("Al", L`A_l`, L`\dfrac{A_t}{s_t}\,u`, At * u, "cm²", 3), S("Almin", L`A_{l,min}`, L`(A_t/s_t)_{min}\,u`, Atmin * u, "cm²", 3)],
      checks: [C("Contrainte tangente limite", tc <= tlim, `${fmt(tc, 2)} ≤ ${fmt(tlim, 2)} MPa`, tc / tlim)],
      notes: ["Armatures de torsion à ajouter à celles de l'effort tranchant (transversales) et de la flexion (longitudinales, réparties sur le contour u). Pour une section pleine, la contrainte de torsion se combine quadratiquement avec celle de l'effort tranchant."] };
  },
  fig(I, g) {
    const W = 330, Hh = 170, k = min(130 / I.b, 140 / I.a), w = I.a * k, h = I.b * k, x0 = 60, y0 = (Hh - h) / 2, e = g("b0") * k;
    let s = Rc(x0, y0, w, h) + P(`M${x0 + e / 2} ${y0 + e / 2}h${w - e}v${h - e}h${-(w - e)}Z`, { c: K.red, w: 1.4, dash: "5 3" });
    s += Rc(x0 + e, y0 + e, w - 2 * e, h - 2 * e, { f: "#f8f6f1", c: K.concD, op: .9 }) + dim(x0, x0 + w, y0 + h + 13, `a = ${f2(I.a, 2)}`) + dimV(x0 - 12, y0, y0 + h, `b = ${f2(I.b, 2)}`, K.mute, -1);
    s += T(x0 + w + 16, y0 + 18, `b0 = ${f2(g("b0"), 3)} m`, { s: 9.5 }) + T(x0 + w + 16, y0 + 36, `τT = ${f2(g("tT"), 2)} MPa`, { s: 9.5, c: K.red }) + T(x0 + w + 16, y0 + 54, `At/st = ${f2(g("At"), 2)} cm²/m`, { s: 9.5, w: 500 }) + T(x0 + w + 16, y0 + 72, `Al = ${f2(g("Al"), 2)} cm²`, { s: 9.5, w: 500 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La torsion crée ${f2(g("tT"), 2)} MPa dans la paroi équivalente ; il faut ${f2(g("At"), 2)} cm²/m de cadres et ${f2(g("Al"), 1)} cm² de barres longitudinales en plus.` },

{ id: "bael-forfaitaire", t: "Planchers : méthode forfaitaire (BAEL, annexe E.1)", ref: "BAEL 91 révisé 99, annexe E.1 — Biblio 2004 « Méthode forfaitaire »",
  desc: "Vérification des moments en travée et sur appuis d'une travée de plancher continu par la méthode forfaitaire, et courbe des moments correspondante.",
  inputs: [N("G", "Charges permanentes", "kN/m²", 10, "G"), N("Q", "Charges d'exploitation", "kN/m²", 5, "Q"), N("M0", "Moment isostatique de référence", "kN·m", 1000, L`M_0`),
    SEL("trav", "Travée étudiée", [["i", "travée intermédiaire"], ["r", "travée de rive"]], "i", ""), SEL("sg", "Appui de gauche", SUPP, "5", ""), SEL("sd", "Appui de droite", SUPP, "4", ""),
    H("Moments retenus (valeurs absolues)"), N("Mt", "Moment en travée", "kN·m", 600, L`M_t`), N("Mw", "Moment sur l'appui de gauche", "kN·m", 400, L`M_w`), N("Me", "Moment sur l'appui de droite", "kN·m", 600, L`M_e`)],
  calc(I) {
    const al = I.Q / (I.Q + I.G), Mt1 = I.M0 * ((I.trav === "i" ? 1 : 1.2) + 0.3 * al) / 2, Mw1 = kSup(I.sg) * I.M0, Me1 = kSup(I.sd) * I.M0, reg = max(1.05, 1 + 0.3 * al) * I.M0, sum = I.Mt + (I.Mw + I.Me) / 2;
    const Mg = -I.Mw, Md = -I.Me, Mtra = I.Mt, pl2 = 4 * (-((Mg + Md) / 2 - Mtra) + sqrt(max(0, (Mg - Mtra) * (Md - Mtra)))), xm = 0.5 + (Md - Mg) / pl2;
    const applic = I.Q <= 2 * I.G && I.Q <= 5;
    return { steps: [S("al", L`\alpha`, L`\dfrac{Q}{G + Q}`, al, "", 4), R("Mtmin", L`M_{t,min}`, I.trav === "i" ? L`\dfrac{1 + 0{,}3\,\alpha}{2}\,M_0` : L`\dfrac{1{,}2 + 0{,}3\,\alpha}{2}\,M_0`, Mt1, "kN·m", 1),
      S("Mwmin", L`M_{w,min}`, L`k_w\,M_0`, Mw1, "kN·m", 1), S("Memin", L`M_{e,min}`, L`k_e\,M_0`, Me1, "kN·m", 1), S("sum", L`M_t + \dfrac{M_w + M_e}{2}`, "", sum, "kN·m", 1),
      R("reg", L`\max(1{,}05 ;\ 1 + 0{,}3\,\alpha)\,M_0`, "~règle des moments", reg, "kN·m", 1), S("pl2", L`p\,\ell^2`, L`4\left[\tfrac{M_w + M_e}{2} + M_t + \sqrt{(M_w + M_t)(M_e + M_t)}\right]`, pl2, "kN·m", 2), S("xm", L`x_m / \ell`, L`\tfrac12 + \dfrac{M_w - M_e}{p\,\ell^2}`, xm, "", 4)],
      checks: [C("Domaine d'application", applic, applic ? "Q ≤ 2G et Q ≤ 5 kN/m²" : "Q > 2G ou Q > 5 kN/m² : méthode non applicable"), C("Moment en travée", I.Mt >= Mt1 - 1e-9, `${fmt(I.Mt, 0)} ≥ ${fmt(Mt1, 0)} kN·m`, Mt1 / I.Mt),
        C("Moment sur l'appui de gauche", I.Mw >= Mw1 - 1e-9, `${fmt(I.Mw, 0)} ≥ ${fmt(Mw1, 0)} kN·m`, Mw1 ? Mw1 / I.Mw : 0), C("Moment sur l'appui de droite", I.Me >= Me1 - 1e-9, `${fmt(I.Me, 0)} ≥ ${fmt(Me1, 0)} kN·m`, Me1 ? Me1 / I.Me : 0),
        C("Règle des moments", sum >= reg - 1e-9, `${fmt(sum, 0)} ≥ ${fmt(reg, 0)} kN·m`, reg / sum)],
      vals: { Mg, Md, pl2 }, notes: ["Autres conditions de l'annexe E.1 : inertie constante dans les travées, rapport des portées successives compris entre 0,8 et 1,25, fissuration peu préjudiciable. La courbe des moments est la parabole passant par $-M_w$, $-M_e$ et tangente à $M_t$ ; elle sert à l'épure d'arrêt des barres."] };
  },
  fig(I, g, r) { const { Mg, Md, pl2 } = r.vals, f = x => pl2 / 2 * x * (1 - x) + Mg * (1 - x) + Md * x;
    return KIT.beamDiag({ L: 1, sup: [0, 1], fix: [0, 1], f, marks: [{ x: 0.0001, l: f2(Mg, 0) }, { x: g("xm"), l: f2(I.Mt, 0) }, { x: 0.9999, l: f2(Md, 0) }], label: "moments forfaitaires (kN·m)", span: "travée de portée ℓ" }); },
  clair: (I, g) => `Les moments retenus ${g("sum") >= g("reg") ? "respectent" : "ne respectent pas"} la règle des moments (${f2(g("sum"), 0)} kN·m pour ${f2(g("reg"), 0)} kN·m exigés) ; la travée doit reprendre au moins ${f2(g("Mtmin"), 0)} kN·m.` },

{ id: "bael-poutre-voile", t: "Poutre-voile : ferraillage (BAEL, annexe E.5)", ref: "BAEL 91 révisé 99, annexe E.5 — Biblio 2004 « Ferraillage d'une poutre-voile »",
  desc: "Épaisseur minimale, bras de levier, armatures principales inférieures et supérieures, armatures verticales et réseaux horizontaux d'une poutre-voile isostatique ou continue.",
  inputs: [N("lt", "Portée entre axes", "m", 6, L`\ell_t`), N("l0", "Portée entre nus", "m", 5.7, L`\ell_0`), N("h", "Hauteur de la paroi", "m", 4, "h"), N("b0", "Épaisseur du voile", "m", 0.2, L`b_0`),
    N("p", "Charge appliquée à l'ELU", "kN/m", 600, "p"), N("ps", "Charge à suspendre (en partie basse)", "kN/m", 0, L`p_s`), N("fc", "Résistance du béton", "MPa", 25, L`f_{c28}`), N("fe", "Limite d'élasticité", "MPa", 500, L`f_e`),
    SEL("typ", "Schéma", [["i", "isostatique"], ["c", "continue (méthode forfaitaire)"]], "c", ""),
    H("Paroi continue : moments retenus"), N("Mt", "Moment en travée", "kN·m", 1300, L`M_t`), N("Mw", "Moment sur l'appui de gauche", "kN·m", 720, L`M_w`), N("Me", "Moment sur l'appui de droite", "kN·m", 900, L`M_e`)],
  calc(I) {
    const l = min(I.lt, 1.15 * I.l0), M0 = I.p * l * l / 8, V0 = I.p * l / 2, pM = I.p / 1000, cont = I.typ === "c", lh = min(I.h, l);
    const bmin = max(3.75 * pM / I.fc * max(l / I.h, 1), 0.14 * l * pow(pM / I.fc / I.h, 1 / 3));
    const Mtra = cont ? I.Mt : M0, Mapp = cont ? max(I.Mw, I.Me) : 0, z = cont ? (I.h <= l ? 0.2 * (l + 1.5 * I.h) : 0.5 * l) : (I.h < l ? 0.2 * (l + 2 * I.h) : 0.6 * l);
    const Ainf = Mtra / z * 1.15 / I.fe * 10, Asup = Mapp / z * 1.15 / I.fe * 10, tu = V0 / I.b0 / lh / 1000, tup = (I.p + I.ps) * l / 2 / I.b0 / lh / 1000;
    const rh = max(0.8 / I.fe, 0.5 * tup * 1.15 / I.fe * max(1, 0.6 + 15 * tup / I.fc)), r1 = 0.75 * tup * 1.15 / I.fe, rinf = min(r1, rh), rc = rh > r1 ? rh - r1 : 0, rhp = max(3 / 5 * rh, 0.8 / I.fe);
    const Av = max(0.8 / I.fe, 3 * tu / 4 / I.fe * 1.15) * 1e4 * I.b0 + I.ps * 1.15 / I.fe * 10, Ahaut = I.h > l ? max(Asup / 4, 0.5 * rhp * (I.h - l) * I.b0 * 1e4) : 0;
    return { steps: [S("l", L`\ell`, L`\min(\ell_t ;\ 1{,}15\,\ell_0)`, l, "m", 2), S("M0", L`M_0`, L`\dfrac{p\,\ell^2}{8}`, M0, "kN·m", 1), S("V0", L`V_0`, L`\dfrac{p\,\ell}{2}`, V0, "kN", 1),
      R("bmin", L`b_{min}`, L`\max\!\left[\dfrac{3{,}75\,p}{f_{c28}}\max\!\left(\dfrac{\ell}{h}, 1\right) ;\ 0{,}14\,\ell\sqrt[3]{\dfrac{p}{f_{c28}\,h}}\right]`, bmin, "m", 3),
      S("z", "z", cont ? (I.h <= l ? L`0{,}2\,(\ell + 1{,}5\,h)` : L`0{,}5\,\ell`) : (I.h < l ? L`0{,}2\,(\ell + 2\,h)` : L`0{,}6\,\ell`), z, "m", 3),
      R("Ainf", L`A_{inf}`, L`\dfrac{M_t}{z\,f_{ed}}` + `\\ \\text{sur } ${fmt(0.15 * lh, 2).replace(",", "{,}")}\\text{ m}`, Ainf, "cm²", 2), R("Asup", L`A_{sup}`, L`\dfrac{M_{app}}{z\,f_{ed}}` + `\\ \\text{sur } ${fmt(0.1 * lh, 2).replace(",", "{,}")}\\text{ m}`, Asup, "cm²", 2),
      S("tu", L`\tau_u`, L`\dfrac{V_0}{b_0\,\min(h, \ell)}`, tu, "MPa", 3), S("tup", L`\tau'_u`, L`\dfrac{(p + p_s)\,\ell}{2\,b_0\,\min(h, \ell)}`, tup, "MPa", 3),
      R("Av", L`A_v`, L`\max\!\left(\dfrac{0{,}8}{f_e} ;\ \dfrac{3\,\tau_u}{4\,f_{ed}}\right) b_0 + \dfrac{p_s}{f_{ed}}`, Av, "cm²/m", 3), S("rh", L`\rho_h`, L`\max\!\left[\dfrac{0{,}8}{f_e} ;\ \dfrac{\tau'_u}{2 f_{ed}}\max\!\left(1 ;\ 0{,}6 + \dfrac{15\,\tau'_u}{f_{c28}}\right)\right]`, rh, "", 5),
      S("Ahi", L`A_{h,inf}`, L`\min(0{,}75\,\tau'_u/f_{ed} ;\ \rho_h)\,b_0` + `\\ \\text{sur } ${fmt(0.4 * lh, 2).replace(",", "{,}")}\\text{ m}`, rinf * I.b0 * 1e4, "cm²/m", 3),
      S("Ahc", L`A_{h,compl}`, L`(\rho_h - 0{,}75\,\tau'_u/f_{ed})\,b_0`, rc * I.b0 * 1e4, "cm²/m", 3), S("Ahs", L`A_{h,sup}`, L`\max(0{,}6\,\rho_h ;\ 0{,}8/f_e)\,b_0` + `\\ \\text{sur } ${fmt((cont ? 0.35 : 0.45) * lh, 2).replace(",", "{,}")}\\text{ m}`, rhp * I.b0 * 1e4, "cm²/m", 3),
      ...(Ahaut ? [S("Ah", L`A_{haut}`, "~partie de paroi au-dessus de h = ℓ", Ahaut, "cm²", 2)] : [])],
      checks: [C("Épaisseur minimale", I.b0 >= bmin - 1e-9, `${fmt(I.b0, 2)} ≥ ${fmt(bmin, 2)} m`, bmin / I.b0)],
      notes: [cont ? "Paroi continue : moments $M_t$, $M_w$, $M_e$ issus de la méthode forfaitaire (vérifier la règle des moments avec la feuille dédiée), armatures supérieures sur appui intermédiaire." : "Paroi isostatique : moment de référence $M_0$, pas d'armatures supérieures principales.",
        "Les armatures inférieures principales doivent être ancrées au-delà du nu des appuis (crosses ou ancrages droits prolongés)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 185, l = g("l"), k = min(270 / I.lt, 140 / I.h), x0 = (W - I.lt * k) / 2, y0 = 22, w = I.lt * k, h = I.h * k, lh = min(I.h, l);
    let s = Rc(x0, y0, w, h) + Rc(x0 - 4, y0 + h, 16, 10, { f: K.ink }) + Rc(x0 + w - 12, y0 + h, 16, 10, { f: K.ink }) + udl(x0, x0 + w, y0 - 2, 12, K.red, 14);
    s += Rc(x0 + 4, y0 + h - 0.15 * lh * k, w - 8, 0.15 * lh * k, { f: K.red, c: "none", op: .3 }) + T(x0 + w / 2, y0 + h - 3, `A inf = ${f2(g("Ainf"), 1)} cm²`, { a: "middle", s: 9, w: 500, c: K.red });
    if (g("Asup") > 0) s += Rc(x0 + 4, y0 + 2, w - 8, 0.1 * lh * k, { f: K.blue, c: "none", op: .25 }) + T(x0 + w / 2, y0 + 12, `A sup = ${f2(g("Asup"), 1)} cm²`, { a: "middle", s: 9, c: K.blue });
    for (let i = 1; i < 10; i++) s += P(`M${x0 + w * i / 10} ${y0 + 4}V${y0 + h - 4}`, { c: K.mute, w: .7, dash: "2 3" });
    s += T(x0 + w / 2, y0 + h / 2, `z = ${f2(g("z"), 2)} m   Av = ${f2(g("Av"), 2)} cm²/m`, { a: "middle", s: 9.5 }) + dimV(x0 - 10, y0, y0 + h, `h = ${f2(I.h, 2)}`, K.mute, -1) + dim(x0, x0 + w, y0 + h + 20, `ℓt = ${f2(I.lt, 2)} m`);
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Avec un bras de levier de ${f2(g("z"), 2)} m, il faut ${f2(g("Ainf"), 1)} cm² d'armatures inférieures principales${g("Asup") > 0 ? ` et ${f2(g("Asup"), 1)} cm² sur appui` : ""} ; le voile doit faire au moins ${f2(g("bmin") * 100, 0)} cm.` },

{ id: "ba-voute-decharge", t: "Voûte de décharge au-dessus d'une poutre", ref: "Biblio 2004 « Voûte de décharge » — effet d'arc dans un mur porté (maçonnerie ou béton), BAEL 91",
  desc: "Longueur d'appui de l'arc, tirant, bielle d'about, effort tranchant, armatures transversales et de flexion d'une poutre portant un mur qui se décharge par effet de voûte.",
  inputs: [N("b", "Épaisseur du mur (et de la poutre)", "m", 0.2, "b"), N("p", "Charge ELU arrivant sur la poutre", "kN/m", 130, "p"), SEL("typ", "Nature du mur supporté", [["m", "maçonnerie"], ["b", "béton"]], "m", ""),
    N("a", "Épaisseur des appuis", "m", 0.3, "a"), N("lp", "Portée entre nus", "m", 5.4, L`\ell`), N("h", "Hauteur de la poutre", "m", 0.55, "h"),
    N("fc", "Résistance du béton", "MPa", 25, L`f_{c28}`), N("fe", "Limite d'élasticité", "MPa", 400, L`f_e`), N("c", "Enrobage des aciers", "m", 0.05, "c")],
  calc(I) {
    const mas = I.typ === "m", lon = 2 * I.a + I.lp, sigu = mas ? 2 : I.fc / 3, pt = I.p / 10;                 /* pt : t/m (classeur) */
    const l2 = I.p * lon / (I.b * sigu * (mas ? 1.6 : 1)) / 1000, q = I.p * lon / 2 / l2, l3 = lon - 2 * l2, fp = l3 / (mas ? 2 : 4), pp = mas ? 18 : 25, qp = fp * I.b * pp, qpp = I.b * I.h * 25;
    const Vu1 = q * (l2 - I.h / 2 - I.a), Vpu = 1.35 * 2 / 3 * qp * l3 / 2, Vppu = 1.35 * qpp * I.lp / 2 * (1 - I.h / lon), Vu = Vu1 + Vpu + Vppu, Vnu = Vu + q * I.h / 2;
    const d = I.h - I.c, tu = Vu / I.b / d / 1000, tlim = min(5, 0.2 * I.fc / 1.5), ft = 0.6 + 0.06 * I.fc, sigb = I.p * lon / 2 * (mas ? 0.5 : 1) / I.b / I.h / 1000, kk = max(0, 1 - 10 * sigb / I.fc);
    const Atmin = 0.4 / I.fe * I.b * 1e4, At1 = max((tu - 0.3 * kk * ft) / 0.9 * 1.15 / I.fe * I.b * 1e4, Atmin);
    const Vmid = Vpu + Vppu * (1 - 2 * (l2 - I.a) / I.lp), tmid = Vmid / I.b / d / 1000, At2 = max((tmid - 0.3 * kk * ft) / 0.9 * 1.15 / I.fe * I.b * 1e4, Atmin);
    const Mu = q * (l2 - I.a) ** 2 / 2 + Vpu * ((I.lp + I.a) / 2 - 3 / 16 * l3) + 1.35 * 25 * I.b * I.h * I.lp ** 2 / 8, fl = baelRect(Mu, I.b, d, I.c, I.fc, I.fe, 1.35);
    const sb = 2 * Vnu / (I.a - 0.02) / I.b / 1000, Atie = I.p * lon * 1.15 / I.fe / (mas ? 4 : 2) * 10, Ainf = 1.15 * Vnu / I.fe * 10;
    return { steps: [S("sigu", L`\sigma_u`, mas ? "~contrainte admissible de la maçonnerie" : L`f_{c28}/3`, sigu, "MPa", 2),
      R("l2", L`\ell_2`, L`\dfrac{p\,L}{b\,\sigma_u}` + (mas ? "\\ /\\ 1{,}6" : ""), l2, "m", 3), S("q", "q", L`\dfrac{p\,L}{2\,\ell_2}`, q, "kN/m", 1), S("fp", "f", L`(L - 2\ell_2)/` + (mas ? "2" : "4") + "\\ \\ \\text{(flèche de l'arc)}", fp, "m", 3),
      R("Atie", L`A_{tirant}`, L`\dfrac{p\,L}{` + (mas ? "4" : "2") + L`\,f_{ed}}`, Atie, "cm²", 2),
      H("Appui"), S("Vnu", L`V_{u,nu}`, L`V_u + q\,h/2`, Vnu, "kN", 1), S("Ainf", L`A_{inf}`, L`\dfrac{V_{u,nu}}{f_{ed}}`, Ainf, "cm²", 2), S("sb", L`\sigma_{bielle}`, L`\dfrac{2\,V_{u,nu}}{(a - 0{,}02)\,b}`, sb, "MPa", 2),
      H("Effort tranchant (à h/2 du nu)"), S("Vu", L`V_u`, L`q\left(\ell_2 - \tfrac h2 - a\right) + V'_u + V''_u`, Vu, "kN", 1), S("tu", L`\tau_u`, L`\dfrac{V_u}{b\,d}`, tu, "MPa", 3), S("tlim", L`\tau_{lim}`, L`\min(5 ;\ 0{,}2\,f_{c28}/\gamma_b)`, tlim, "MPa", 3),
      S("k", "k", L`1 - 10\,\sigma_b / f_{c28}`, kk, "", 3), R("At1", L`(A_t/s_t)_1`, L`\dfrac{(\tau_u - 0{,}3\,k\,f_{t28})\,b}{0{,}9\,f_{ed}}` + `\\ \\text{sur } ${fmt(l2 - I.a, 2).replace(",", "{,}")}\\text{ m}`, At1, "cm²/m", 2), S("At2", L`(A_t/s_t)_2`, "~au-delà (partie centrale)", At2, "cm²/m", 2),
      H("Flexion au centre"), S("Mu", L`M_u`, L`\dfrac{q(\ell_2 - a)^2}{2} + M'_u + M''_u`, Mu, "kN·m", 2), S("mbu", L`\mu_{bu}`, "", fl.mbu, "", 4), R("As", L`A_s`, "~flexion simple ELU (BAEL)", fl.As, "cm²", 2)],
      checks: [C("Bielle d'about", sb <= 0.8 * I.fc / 1.5, `${fmt(sb, 2)} ≤ ${fmt(0.8 * I.fc / 1.5, 2)} MPa`, sb / (0.8 * I.fc / 1.5)), C("Contrainte tangente", tu <= tlim, `${fmt(tu, 2)} ≤ ${fmt(tlim, 2)} MPa`, tu / tlim),
        C("Effet de voûte possible", l3 > 0, l3 > 0 ? `arc de ${fmt(l3, 2)} m` : "appuis de l'arc trop longs")],
      vals: { lon, l2, fp }, notes: ["Le mur se décharge sur les appuis par un arc parabolique de flèche f ; la poutre sert de tirant et ne reprend en flexion que le poids du mur sous l'arc et son poids propre. Fissuration peu préjudiciable."] };
  },
  fig(I, g, r) {
    const { lon, l2, fp } = r.vals, W = 330, Hh = 180, k = 290 / lon, x0 = 20, yb = 130, X = x => x0 + x * k, hh = I.h * k;
    let s = Rc(X(0), yb, lon * k, hh, { f: K.conc }) + Rc(X(0), yb + hh, I.a * k, 30, { f: K.concD }) + Rc(X(lon - I.a), yb + hh, I.a * k, 30, { f: K.concD });
    s += Rc(X(0), 34, lon * k, yb - 34, { f: I.typ === "m" ? "#efe4d2" : "#ebe8e1", c: K.concD, op: .8 });
    const n = 40, l3 = lon - 2 * l2, top = yb - fp * k * (I.typ === "m" ? 1 : 1); s += P(range(0, 1, n).map((t, i) => `${i ? "L" : "M"}${X(l2 + l3 * t).toFixed(1)} ${(yb - 4 * fp * k * t * (1 - t)).toFixed(1)}`).join(""), { c: K.red, w: 2 });
    s += P(`M${X(0)} ${yb}H${X(l2)}`, { c: K.red, w: 3 }) + P(`M${X(lon - l2)} ${yb}H${X(lon)}`, { c: K.red, w: 3 }) + T(X(lon / 2), yb - fp * k - 6, `f = ${f2(fp, 2)} m`, { a: "middle", s: 9.5, c: K.red });
    s += T(X(l2 / 2), yb - 6, `ℓ2 = ${f2(l2, 2)}`, { a: "middle", s: 8.5, c: K.red }) + udl(X(0), X(lon), 32, 12, K.red, 12) + T(X(0), 12, `p = ${f2(I.p, 0)} kN/m (ELU)`, { s: 9, c: K.red });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le mur se reporte sur ${f2(g("l2"), 2)} m de chaque côté ; la poutre-tirant demande ${f2(g("As"), 1)} cm² en flexion et ${f2(g("At1"), 1)} cm²/m de cadres près des appuis.` },

]);
HB.BAEL = Object.assign(HB.BAEL || {}, { baelRect });
})(typeof window !== "undefined" ? window : globalThis);
