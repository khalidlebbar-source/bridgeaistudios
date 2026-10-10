/* ════════════════════════════════════════════════════════════════════
   HandBag — Outils (conversions, armatures, géométrie du tracé, biais)
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt, ACIER_HA } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, gauge } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), sin = Math.sin, cos = Math.cos, tan = Math.tan;

HB.add("Outils", [

{ id: "out-conversions", t: "Conversions d'unités usuelles", ref: "Système international ; unités anglo-saxonnes et anciennes unités techniques (t, kgf/cm², grades)",
  desc: "Conversion des forces, pressions, moments, longueurs et angles entre unités SI, techniques et anglo-saxonnes.",
  inputs: [N("F", "Force", "kN", 1000, "F"), N("p", "Contrainte ou pression", "MPa", 25, "p"), N("M", "Moment", "kN·m", 500, "M"), N("Lg", "Longueur", "m", 10, "L"), N("a", "Angle", "°", 45, L`\theta`), N("q", "Charge surfacique", "kN/m²", 5, "q")],
  calc(I) {
    const rows = [["Force", `${f2(I.F, 2)} kN`, `${f2(I.F / 9.80665, 3)} t`, `${f2(I.F / 4.448222, 2)} kip`, `${f2(I.F * 1000, 0)} N`],
      ["Pression", `${f2(I.p, 2)} MPa`, `${f2(I.p * 10, 2)} bar`, `${f2(I.p * 10.19716, 2)} kgf/cm²`, `${f2(I.p * 145.0377, 1)} psi`],
      ["Moment", `${f2(I.M, 2)} kN·m`, `${f2(I.M / 9.80665, 3)} t·m`, `${f2(I.M / 1.355818, 2)} kip·ft`, `${f2(I.M * 1000, 0)} N·m`],
      ["Longueur", `${f2(I.Lg, 3)} m`, `${f2(I.Lg / 0.3048, 3)} ft`, `${f2(I.Lg / 0.0254, 2)} in`, `${f2(I.Lg * 1000, 0)} mm`],
      ["Angle", `${f2(I.a, 4)} °`, `${f2(I.a / 0.9, 4)} gr`, `${f2(I.a * PI / 180, 5)} rad`, `${f2(tan(I.a * PI / 180) * 100, 2)} % (pente)`],
      ["Charge surfacique", `${f2(I.q, 2)} kN/m²`, `${f2(I.q / 9.80665 * 1000, 1)} kg/m²`, `${f2(I.q * 20.885, 1)} psf`, `${f2(I.q, 3)} kPa`]];
    return { steps: [R("t", L`F_{[t]}`, L`\dfrac{F_{[kN]}}{9{,}80665}`, I.F / 9.80665, "t", 3), R("bar", L`p_{[bar]}`, L`10\,p_{[MPa]}`, I.p * 10, "bar", 2), S("gr", L`\theta_{[gr]}`, L`\dfrac{\theta_{[°]}}{0{,}9}`, I.a / 0.9, "gr", 4)],
      tables: [{ title: "Équivalences", head: ["Grandeur", "Saisie", "Unité technique", "Anglo-saxon", "Autre"], rows, d: [0, 0, 0, 0] }],
      notes: ["1 t (force) = 9,80665 kN ; 1 kip = 4,448 kN ; 1 MPa = 10 bar = 1 N/mm² ≈ 10,2 kgf/cm² ; 100 grades = 90°. La pente en % est la tangente de l'angle × 100."] };
  },
  fig(I, g) { const W = 330, Hh = 150, a = I.a * PI / 180, cx = 60, cy = 120, r = 90; let s = P(`M${cx} ${cy}H${cx + r + 30}`, { c: K.ink }) + P(`M${cx} ${cy}L${cx + (r + 30) * cos(a)} ${cy - (r + 30) * sin(a)}`, { c: K.red, w: 2 });
    s += P(`M${cx + 40} ${cy}A40 40 0 0 0 ${cx + 40 * cos(a)} ${cy - 40 * sin(a)}`, { c: K.gold, w: 1.6 }) + T(cx + 48, cy - 12, `${f2(I.a, 1)}° = ${f2(I.a / 0.9, 2)} gr`, { s: 9.5, w: 500 }) + T(200, 40, `${f2(I.F, 0)} kN = ${f2(I.F / 9.80665, 1)} t`, { s: 10 }) + T(200, 60, `${f2(I.p, 1)} MPa = ${f2(I.p * 10, 0)} bar`, { s: 10 });
    return svg(W, Hh, s); },
  clair: (I, g) => `${f2(I.F, 0)} kN valent ${f2(g("t"), 1)} t, ${f2(I.p, 1)} MPa valent ${f2(g("bar"), 0)} bar et ${f2(I.a, 1)}° valent ${f2(g("gr"), 2)} grades.` },

{ id: "out-armatures", t: "Sections et masses des armatures", ref: "NF A 35-080-1 (aciers B500B) ; tableaux de ferraillage",
  desc: "Section d'un groupe de barres, section par mètre pour un espacement donné, masse linéique et choix de nappes pour une section requise.",
  inputs: [SEL("phi", "Diamètre", Object.keys(ACIER_HA).map(k => [k, "HA " + k]), "20", L`\varnothing`), N("n", "Nombre de barres", "U", 8, "n"), N("e", "Espacement (nappe répartie)", "cm", 15, "e"), N("Areq", "Section requise", "cm²/m", 18, L`A_{req}`)],
  calc(I) {
    const a1 = ACIER_HA[I.phi], A = I.n * a1, Am = a1 * 100 / I.e, m = a1 * 0.785, rows = [];
    [10, 12, 14, 16, 20, 25, 32].forEach(d => { const a = ACIER_HA[d], e = Math.floor(a * 100 / I.Areq / 2.5) * 2.5; if (e >= 7.5 && e <= 35) rows.push([`HA ${d}`, e, a * 100 / e, a * 0.785 * 100 / e]); });
    return { steps: [S("a1", L`A_{\varnothing}`, L`\dfrac{\pi\varnothing^2}{4}`, a1, "cm²", 3), R("A", "A", L`n\,A_\varnothing`, A, "cm²", 2), R("Am", L`A/m`, L`\dfrac{100\,A_\varnothing}{e}`, Am, "cm²/m", 2), S("m", "m", L`7\,850\ \text{kg/m}^3 \times A_\varnothing`, m, "kg/m", 3), S("mm", "", "~masse par m² de nappe", m * 100 / I.e, "kg/m²", 2)],
      tables: [{ title: `Nappes couvrant ${f2(I.Areq, 1)} cm²/m (espacement arrondi à 2,5 cm)`, head: ["Barres", "Espacement (cm)", "Section (cm²/m)", "Masse (kg/m²)"], rows, d: [1, 2, 2] }],
      notes: ["Masse linéique : 0,222 (Ø6), 0,395 (Ø8), 0,617 (Ø10), 0,888 (Ø12), 1,21 (Ø14), 1,58 (Ø16), 2,47 (Ø20), 3,85 (Ø25), 6,31 (Ø32), 9,86 kg/m (Ø40)."] };
  },
  fig(I, g) { return KIT.barsH(Object.keys(ACIER_HA).map(d => ({ l: `HA ${d}`, v: ACIER_HA[d], u: "cm²", d: 2, c: d == I.phi ? K.red : K.mute })), { title: "Section d'une barre", left: 50, rowH: 13 }); },
  clair: (I, g) => `${Math.round(I.n)} HA${I.phi} font ${f2(g("A"), 2)} cm² ; une nappe HA${I.phi} tous les ${f2(I.e, 1)} cm apporte ${f2(g("Am"), 2)} cm²/m et pèse ${f2(g("mm"), 1)} kg/m².` },

{ id: "out-courbe", t: "Tracé en plan : éléments d'un arc de cercle", ref: "Géométrie routière — raccordement circulaire (ICTAAL, ARP)",
  desc: "Tangente, développement, corde, flèche et bissectrice d'un arc de cercle de rayon et d'angle au centre donnés ; flèche d'une corde de tablier.",
  inputs: [N("Rr", "Rayon", "m", 600, "R"), N("D", "Angle au centre", "gr", 25, L`\Delta`), N("c", "Corde d'un tablier rectiligne inscrit", "m", 40, "c")],
  calc(I) {
    const a = I.D * PI / 200, T_ = I.Rr * tan(a / 2), Dv = I.Rr * a, Ch = 2 * I.Rr * sin(a / 2), f = I.Rr * (1 - cos(a / 2)), B = I.Rr * (1 / cos(a / 2) - 1), fc = I.Rr - sqrt(I.Rr ** 2 - (I.c / 2) ** 2);
    return { steps: [S("a", L`\Delta`, L`\Delta_{gr}\,\dfrac{\pi}{200}`, a, "rad", 5), R("T", "T", L`R\tan\dfrac{\Delta}{2}`, T_, "m", 3), R("Dv", "D", L`R\,\Delta`, Dv, "m", 3), S("Ch", "C", L`2R\sin\dfrac{\Delta}{2}`, Ch, "m", 3),
      S("f", "f", L`R\left(1 - \cos\dfrac{\Delta}{2}\right)`, f, "m", 3), S("B", "B", L`R\left(\dfrac{1}{\cos\Delta/2} - 1\right)`, B, "m", 3), R("fc", L`f_c`, L`R - \sqrt{R^2 - (c/2)^2}\ \approx \dfrac{c^2}{8R}`, fc, "m", 4)],
      notes: ["$f_c$ : écart maximal entre un tablier droit de longueur $c$ et l'axe en courbe — à absorber par l'élargissement de la dalle ou des corniches en courbe. Angles en grades (usage français de la topographie)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, a = g("a"), k = 250 / g("Ch"), cx = 165, yc = 120, hS = (g("B") + g("f")) * k, fpx = g("f") * k, Rk = I.Rr * k;
    const x0 = cx - g("Ch") * k / 2, x1 = cx + g("Ch") * k / 2, ys = yc - min(hS, 100);
    let s = P(`M${x0} ${yc}A${Rk} ${Rk} 0 0 1 ${x1} ${yc}`, { c: K.red, w: 2.5 }) + P(`M${x0} ${yc}H${x1}`, { c: K.blue, w: 1 }) + P(`M${x0} ${yc}L${cx} ${ys}L${x1} ${yc}`, { c: K.mute, w: 1, dash: "4 3" });
    s += Ci(cx, ys, 3, { f: K.ink, c: K.ink }) + T(cx, ys - 6, "S", { a: "middle", s: 9.5 }) + dimV(cx + 8, yc - fpx, yc, `f = ${f2(g("f"), 2)} m`, K.mute, 1) + T(cx, yc + 16, `C = ${f2(g("Ch"), 1)} m · D = ${f2(g("Dv"), 1)} m`, { a: "middle", s: 9.5 }) + T((x0 + cx) / 2 - 8, (yc + ys) / 2, `T = ${f2(g("T"), 1)}`, { a: "end", s: 9, c: K.mute });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Sur ${f2(I.Rr, 0)} m de rayon et ${f2(I.D, 1)} grades, l'arc mesure ${f2(g("Dv"), 1)} m ; un tablier droit de ${f2(I.c, 0)} m s'écarte de l'axe de ${f2(g("fc") * 100, 1)} cm.` },

{ id: "out-raccordement", t: "Profil en long : raccordement parabolique", ref: "Géométrie routière — raccordements verticaux (ICTAAL, ARP)",
  desc: "Cote d'un point d'un raccordement parabolique entre deux déclivités, rayon équivalent et position du point haut ou bas.",
  inputs: [N("z0", "Cote du début du raccordement", "m", 100, L`z_0`), N("p1", "Déclivité d'entrée", "%", 3, L`p_1`), N("p2", "Déclivité de sortie", "%", -2, L`p_2`), N("Lr", "Longueur du raccordement (en projection)", "m", 300, "L"), N("x", "Abscisse étudiée (depuis le début)", "m", 120, "x")],
  calc(I) {
    const a = (I.p2 - I.p1) / 100, Rr = I.Lr / abs(a), z = x => I.z0 + I.p1 / 100 * x + a * x * x / (2 * I.Lr), xs = -I.p1 / 100 * I.Lr / a, ok = xs >= 0 && xs <= I.Lr;
    return { steps: [S("R", "R", L`\dfrac{L}{|p_2 - p_1|}`, Rr, "m", 0), R("z", L`z(x)`, L`z_0 + p_1\,x + \dfrac{(p_2 - p_1)\,x^2}{2L}`, z(I.x), "m", 3), S("p", L`p(x)`, L`p_1 + (p_2 - p_1)\,\dfrac{x}{L}`, I.p1 + (I.p2 - I.p1) * I.x / I.Lr, "%", 3),
      R("xs", L`x_S`, L`-\dfrac{p_1\,L}{p_2 - p_1}` + (ok ? "" : "\\quad\\text{(hors raccordement)}"), ok ? xs : NaN, "m", 2), S("zs", L`z_S`, "~cote du point haut / bas", ok ? z(xs) : NaN, "m", 3), S("zf", L`z(L)`, "", z(I.Lr), "m", 3)],
      notes: ["Rayons minimaux usuels (ARP, ICTAAL) : saillant 1 500 à 10 000 m, rentrant 1 500 à 4 200 m selon la catégorie de route. Le point bas d'un rentrant situé sur un ouvrage impose un dispositif d'évacuation des eaux."] };
  },
  fig(I, g) { const a = (I.p2 - I.p1) / 100, xs = range(-0.2 * I.Lr, 1.2 * I.Lr, 80), z = x => x < 0 ? I.z0 + I.p1 / 100 * x : x > I.Lr ? I.z0 + I.p1 / 100 * I.Lr + a * I.Lr / 2 + I.p2 / 100 * (x - I.Lr) : I.z0 + I.p1 / 100 * x + a * x * x / (2 * I.Lr);
    return plot({ series: [{ pts: xs.map(x => [x, z(x)]), l: "profil en long" }], vlines: [{ x: 0 }, { x: I.Lr }], marks: [{ x: I.x, y: g("z"), l: `z = ${f2(g("z"), 2)} m` }], xl: "abscisse (m)", yl: "cote (m)", ymin: min(...xs.map(z)) - 0.5, ymax: max(...xs.map(z)) + 1 }); },
  clair: (I, g) => `À ${f2(I.x, 0)} m du début du raccordement, la chaussée est à la cote ${f2(g("z"), 3)} m${isFinite(g("xs")) ? ` ; le point ${I.p1 > I.p2 ? "haut" : "bas"} est à ${f2(g("xs"), 1)} m` : ""}.` },

{ id: "out-biais", t: "Ouvrage biais : angles et portées", ref: "Convention française (biais en grades, 100 gr = ouvrage droit) ; guides Sétra (ponts dalles et PSI-DA)",
  desc: "Conversion du biais géométrique, portées biaise et droite, et biais mécanique d'un tablier dalle en fonction de sa largeur.",
  inputs: [N("phi", "Biais géométrique (angle entre l'axe de la voie portée et la ligne d'appui)", "gr", 70, L`\varphi`), N("Lb", "Portée biaise (le long de l'axe)", "m", 18, L`L_b`), N("b", "Largeur droite du tablier", "m", 12, "b")],
  calc(I) {
    const a = I.phi * PI / 200, Ld = I.Lb * sin(a), lb = I.b / sin(a), dd = I.b / tan(a), ratio = I.b / (I.Lb * sin(a));
    return { steps: [S("deg", L`\varphi_{[°]}`, L`0{,}9\,\varphi_{[gr]}`, I.phi * 0.9, "°", 2), R("Ld", L`L_d`, L`L_b\,\sin\varphi`, Ld, "m", 3), S("lb", L`l_b`, L`\dfrac{b}{\sin\varphi}` + "\\quad\\text{(longueur des lignes d'appui)}", lb, "m", 3),
      S("dd", L`\delta`, L`\dfrac{b}{\tan\varphi}` + "\\quad\\text{(décalage des angles)}", dd, "m", 3), R("ratio", L`\dfrac{b}{L_d}`, "", ratio, "", 3), S("cl", "", "~classement du biais", I.phi >= 85 ? "faible (quasi droit)" : I.phi >= 65 ? "moyen" : I.phi >= 50 ? "important" : "très prononcé", "", 0)],
      notes: ["Le biais mécanique d'un tablier dépend aussi du rapport largeur / portée : un tablier large et court se comporte comme une dalle portant perpendiculairement aux appuis. Au-delà d'un biais de 70 gr environ, les réactions se concentrent aux angles obtus (prévoir appareils et ferraillage renforcés)."] };
  },
  fig(I, g) { const W = 330, Hh = 160, a = I.phi * PI / 200, k = min(200 / (I.Lb + g("dd")), 110 / I.b), x0 = 50, y0 = 25, dx = I.b / tan(a) * k, L_ = I.Lb * k; let s = P(`M${x0} ${y0 + I.b * k}L${x0 + dx} ${y0}H${x0 + dx + L_}L${x0 + L_} ${y0 + I.b * k}Z`, { c: K.concD, f: K.conc, w: 1 });
    s += P(`M${x0} ${y0 + I.b * k}L${x0 + dx} ${y0}M${x0 + L_} ${y0 + I.b * k}L${x0 + dx + L_} ${y0}`, { c: K.red, w: 3 }) + P(`M${x0 - 10} ${y0 + I.b * k / 2}H${x0 + dx + L_ + 10}`, { c: K.mute, dash: "5 3" }) + T(x0 + dx / 2 + 10, y0 + I.b * k / 2 - 6, `φ = ${f2(I.phi, 0)} gr`, { s: 9.5, w: 500 });
    s += dim(x0 + dx, x0 + dx + L_, y0 - 8, `Lb = ${f2(I.Lb, 1)} m`) + T(165, Hh - 6, `portée droite ${f2(g("Ld"), 2)} m · lignes d'appui ${f2(g("lb"), 2)} m`, { a: "middle", s: 9 }); return svg(W, Hh, s); },
  clair: (I, g) => `Avec un biais de ${f2(I.phi, 0)} gr (${f2(I.phi * 0.9, 0)}°), la portée droite n'est que de ${f2(g("Ld"), 2)} m mais les lignes d'appui mesurent ${f2(g("lb"), 2)} m.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
