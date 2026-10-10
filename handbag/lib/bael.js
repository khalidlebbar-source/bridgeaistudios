/* ════════════════════════════════════════════════════════════════════
   HandBag — Béton armé selon le BAEL 91 modifié 99
   Unités : m, kN, kN·m, MPa, cm².
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, min, max, abs, L, S, R, C, N, SEL, H, fmt, ACIER_HA } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, gauge } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d);
const FIS = [["pp", "Peu préjudiciable"], ["p", "Préjudiciable"], ["tp", "Très préjudiciable"]];
const MAT = [N("fc28", "Résistance du béton à 28 jours", "MPa", 30, L`f_{c28}`), N("fe", "Limite élastique de l'acier", "MPa", 500, L`f_e`)];
const ftj = fc => 0.6 + 0.06 * fc;
function sbarS(fis, fe, fc, eta = 1.6) { const fp = min(2 / 3 * fe, max(0.5 * fe, 110 * sqrt(eta * ftj(fc)))); return fis === "pp" ? fe : fis === "p" ? fp : 0.8 * fp; }
const sbarTex = fis => fis === "pp" ? L`f_e\ \ \text{(pas de limite)}` : fis === "p" ? L`\min\left(\tfrac{2}{3}f_e\ ;\ \max\left(0{,}5\,f_e\ ;\ 110\sqrt{\eta f_{tj}}\right)\right)` : L`0{,}8\,\min\left(\tfrac{2}{3}f_e\ ;\ \max\left(0{,}5\,f_e\ ;\ 110\sqrt{\eta f_{tj}}\right)\right)`;
/* flexion simple ELU (diagramme rectangulaire 0,8 x) */
function eluRect(Mu, b, d, d2, fbu, fsu) {
  const eps = fsu / 200000, al = 3.5 / (3.5 + 1000 * eps), mul = 0.8 * al * (1 - 0.4 * al), mu = Mu / (b * d * d * fbu);
  if (mu <= mul) { const a = 1.25 * (1 - sqrt(1 - 2 * mu)), z = d * (1 - 0.4 * a); return { mu, mul, a, z, A: Mu / (z * fsu), A2: 0 }; }
  const z = d * (1 - 0.4 * al), Ml = mul * b * d * d * fbu, s2 = min(fsu, 200000 * 3.5e-3 * (al * d - d2) / (al * d)), A2 = (Mu - Ml) / ((d - d2) * s2);
  return { mu, mul, a: al, z, A: Ml / (z * fsu) + A2 * s2 / fsu, A2 };
}

HB.add("Béton armé — BAEL", [

{ id: "bael-flexion-elu", t: "Flexion simple ELU : section rectangulaire (BAEL)", ref: "BAEL 91 mod. 99 — A.4.3.4, A.4.3.41 (diagramme rectangulaire), A.4.2 (non-fragilité)",
  desc: "Armatures tendues et éventuellement comprimées d'une section rectangulaire à l'état limite ultime.",
  inputs: [N("Mu", "Moment ultime", "kN·m", 650, L`M_u`), N("b", "Largeur", "m", 0.4, L`b`), N("h", "Hauteur", "m", 0.9, "h"), N("d", "Hauteur utile", "m", 0.82, "d"),
    N("d2", "Position des aciers comprimés", "m", 0.05, L`d'`), ...MAT, SEL("sit", "Situation", [["d", "Durable (γb = 1,5 ; γs = 1,15)"], ["a", "Accidentelle (γb = 1,15 ; γs = 1)"]], "d", "")],
  calc(I) {
    const gb = I.sit === "a" ? 1.15 : 1.5, gs = I.sit === "a" ? 1 : 1.15, fbu = 0.85 * I.fc28 / gb, fsu = I.fe / gs, r = eluRect(I.Mu / 1000, I.b, I.d, I.d2, fbu, fsu);
    const Amin = 0.23 * ftj(I.fc28) / I.fe * I.b * I.d * 1e4;
    return { steps: [S("fbu", L`f_{bu}`, L`\dfrac{0{,}85\,f_{c28}}{\theta\,\gamma_b}`, fbu, "MPa", 2), S("fsu", L`f_{su}`, L`\dfrac{f_e}{\gamma_s}`, fsu, "MPa", 1),
      R("mu", L`\mu_{bu}`, L`\dfrac{M_u}{b\,d^2\,f_{bu}}`, r.mu, "", 4), S("mul", L`\mu_l`, L`0{,}8\,\alpha_l\,(1 - 0{,}4\,\alpha_l),\ \ \alpha_l = \dfrac{3{,}5}{3{,}5 + 1000\,\varepsilon_l}`, r.mul, "", 4),
      S("a", L`\alpha_u`, L`1{,}25\left(1 - \sqrt{1 - 2\mu_{bu}}\right)`, r.a, "", 4), S("z", L`z_b`, L`d\,(1 - 0{,}4\,\alpha_u)`, r.z, "m", 3),
      R("A", L`A_u`, r.A2 ? L`\dfrac{M_l}{z_b\,f_{su}} + A'\,\dfrac{\sigma_{sc}}{f_{su}}` : L`\dfrac{M_u}{z_b\,f_{su}}`, r.A * 1e4, "cm²", 2), R("A2", L`A'`, r.A2 ? L`\dfrac{M_u - M_l}{(d - d')\,\sigma_{sc}}` : "~pas d'armatures comprimées", r.A2 * 1e4, "cm²", 2),
      S("Amin", L`A_{min}`, L`0{,}23\,\dfrac{f_{t28}}{f_e}\,b\,d`, Amin, "cm²", 2)],
      checks: [C("$\\mu_{bu} \\le \\mu_l$ (pivot B sans aciers comprimés)", r.mu <= r.mul, `${f2(r.mu, 3)} ≤ ${f2(r.mul, 3)}`, r.mu / r.mul), C("Condition de non-fragilité : $A_u \\ge A_{min}$", r.A * 1e4 >= Amin, `${f2(r.A * 1e4)} ≥ ${f2(Amin)} cm²`)],
      notes: ["$\\theta = 1$ (charges de durée > 24 h). En fissuration préjudiciable, la section doit aussi être vérifiée à l'ELS (feuille « Flexion simple ELS »)."] };
  },
  fig(I, g) { return KIT.section({ b: I.b, h: I.h, d: I.d, As: g("A"), nb: 4, As2: g("A2") > 0 ? 1 : 0, d2: I.d2, x: g("a") * I.d, lam: 0.8, z: true, fcl: "fbu", Fs: `Au = ${f2(g("A"))} cm²` }); },
  clair: (I, g) => `Il faut ${f2(g("A"))} cm² d'acier en partie basse pour équilibrer ${f2(I.Mu, 0)} kN·m${g("A2") > 0 ? `, et ${f2(g("A2"))} cm² comprimés` : ""}.` },

{ id: "bael-flexion-els", t: "Flexion simple ELS : dimensionnement en fissuration préjudiciable", ref: "BAEL 91 mod. 99 — A.4.5.2, A.4.5.32, A.4.5.33",
  desc: "Section d'armatures pour que l'acier atteigne juste sa contrainte limite de service, contrôle de la compression du béton.",
  inputs: [N("Ms", "Moment de service", "kN·m", 450, L`M_{ser}`), N("b", "Largeur", "m", 0.4, "b"), N("d", "Hauteur utile", "m", 0.82, "d"), ...MAT,
    SEL("fis", "Fissuration", FIS, "p", ""), N("eta", "Coefficient de fissuration", "", 1.6, L`\eta`)],
  calc(I) {
    const ss = sbarS(I.fis, I.fe, I.fc28, I.eta), sbc = 0.6 * I.fc28, M = I.Ms / 1000;
    const Mx = x => I.b * x * x * ss * (I.d - x / 3) / (30 * (I.d - x)); let a = 1e-5, b = I.d * 0.999; for (let i = 0; i < 80; i++) { const m = (a + b) / 2; Mx(m) > M ? b = m : a = m; }
    const x = (a + b) / 2, sb = ss * x / (15 * (I.d - x)), A = M / ((I.d - x / 3) * ss);
    const a1 = 15 * sbc / (15 * sbc + ss), Mrb = 0.5 * a1 * (1 - a1 / 3) * I.b * I.d * I.d * sbc;
    return { steps: [S("ft", L`f_{t28}`, L`0{,}6 + 0{,}06\,f_{c28}`, ftj(I.fc28), "MPa", 2), R("ss", L`\bar\sigma_s`, sbarTex(I.fis), ss, "MPa", 1), S("sbc", L`\bar\sigma_{bc}`, L`0{,}6\,f_{c28}`, sbc, "MPa", 1),
      S("Mrb", L`M_{rb}`, L`\tfrac{1}{2}\,\bar\alpha_1\left(1 - \tfrac{\bar\alpha_1}{3}\right) b\,d^2\,\bar\sigma_{bc},\ \ \bar\alpha_1 = \dfrac{15\,\bar\sigma_{bc}}{15\,\bar\sigma_{bc} + \bar\sigma_s}`, Mrb * 1000, "kN·m", 0),
      S("x", L`y_1`, L`M_{ser} = \dfrac{b\,y_1^2\,\bar\sigma_s\,(d - y_1/3)}{30\,(d - y_1)}`, x, "m", 4), R("sb", L`\sigma_{bc}`, L`\dfrac{\bar\sigma_s}{15}\,\dfrac{y_1}{d - y_1}`, sb, "MPa", 2),
      S("z", L`z_1`, L`d - \dfrac{y_1}{3}`, I.d - x / 3, "m", 3), R("A", L`A_{ser}`, L`\dfrac{M_{ser}}{z_1\,\bar\sigma_s}`, A * 1e4, "cm²", 2)],
      checks: [C("$\\sigma_{bc} \\le 0{,}6\\,f_{c28}$ (sinon aciers comprimés : $M_{ser} > M_{rb}$)", sb <= sbc, `${f2(sb)} ≤ ${f2(sbc)} MPa`, sb / sbc)],
      notes: ["$\\eta = 1{,}6$ pour les HA ($\\ge 6$ mm), 1,3 pour les HA < 6 mm, 1 pour les ronds lisses. En fissuration très préjudiciable : $\\bar\\sigma_s = 0{,}8 \\times$ valeur « préjudiciable » (modificatif 99), diamètre $\\ge 8$ mm. Retenir le maximum des sections ELU et ELS."] };
  },
  fig(I, g) { return KIT.section({ b: I.b, h: I.d + 0.07, d: I.d, As: g("A"), nb: 4, x: g("x"), block: false, tri: { sc: `σbc = ${f2(g("sb"), 1)}`, ss: `σ̄s = ${f2(g("ss"), 0)}` } }); },
  clair: (I, g) => `Pour limiter l'ouverture des fissures, l'acier ne doit pas dépasser ${f2(g("ss"), 0)} MPa : il faut ${f2(g("A"))} cm².` },

{ id: "bael-flexion-composee", t: "Flexion composée ELU : section partiellement comprimée", ref: "BAEL 91 mod. 99 — A.4.3, A.4.4 ; moment rapporté aux aciers tendus",
  desc: "Section rectangulaire sous effort normal de compression et moment : armatures par la méthode du moment au droit des aciers tendus.",
  inputs: [N("Nu", "Effort normal de compression", "kN", 1500, L`N_u`), N("Mu", "Moment au centre de gravité du béton", "kN·m", 900, L`M_{uG}`), N("b", "Largeur", "m", 0.5, "b"),
    N("h", "Hauteur", "m", 1.0, "h"), N("d", "Hauteur utile", "m", 0.92, "d"), N("d2", "Position des aciers comprimés", "m", 0.05, L`d'`), ...MAT],
  calc(I) {
    const fbu = 0.85 * I.fc28 / 1.5, fsu = I.fe / 1.15, Nu = I.Nu / 1000, MuA = I.Mu / 1000 + Nu * (I.d - I.h / 2), r = eluRect(MuA, I.b, I.d, I.d2, fbu, fsu);
    const pc = (0.337 * I.h - 0.81 * I.d2) * fbu * I.b * I.h >= Nu * (I.d - I.d2) - MuA, A = r.A - Nu / fsu, e = I.Mu / I.Nu;
    return { steps: [S("e", L`e_G`, L`\dfrac{M_{uG}}{N_u}`, e, "m", 3), R("MuA", L`M_{uA}`, L`M_{uG} + N_u\left(d - \dfrac{h}{2}\right)`, MuA * 1000, "kN·m", 1),
      S("cond", "", L`(0{,}337\,h - 0{,}81\,d')\,f_{bu}\,b\,h \ \ge\ N_u\,(d - d') - M_{uA}`, pc ? "partiellement comprimée" : "entièrement comprimée", "", 0),
      S("mu", L`\mu_{bu}`, L`\dfrac{M_{uA}}{b\,d^2\,f_{bu}}`, r.mu, "", 4), S("z", L`z_b`, L`d\,(1 - 0{,}4\,\alpha_u)`, r.z, "m", 3),
      S("A1", L`A_1`, L`\dfrac{M_{uA}}{z_b\,f_{su}}` + "\\quad\\text{(flexion simple fictive)}", r.A * 1e4, "cm²", 2), R("A", "A", L`A_1 - \dfrac{N_u}{f_{su}}`, max(A, 0) * 1e4, "cm²", 2),
      R("A2", L`A'`, r.A2 ? L`\dfrac{M_{uA} - M_l}{(d - d')\,\sigma_{sc}}` : "~nulle", r.A2 * 1e4, "cm²", 2)],
      checks: [C("Section partiellement comprimée (méthode applicable)", pc), C("$A \\ge A_{min} = 0{,}23\\,\\dfrac{f_{t28}}{f_e}\\,b\\,d\\,\\dfrac{e_G - 0{,}455\\,d}{e_G - 0{,}185\\,d}$", A * 1e4 >= 0.23 * ftj(I.fc28) / I.fe * I.b * I.d * max(0, (e - 0.455 * I.d) / (e - 0.185 * I.d)) * 1e4, `${f2(max(A, 0) * 1e4)} cm²`)],
      notes: ["Si $A$ devient négatif, l'effort normal suffit à équilibrer la traction : disposer le minimum. Pour une section entièrement comprimée, utiliser le diagramme d'interaction (EC2) ou les abaques BAEL. Le moment $M_{uG}$ doit inclure les effets du second ordre (A.4.3.5)."] };
  },
  fig(I, g) {
    const s = KIT.section({ b: I.b, h: I.h, d: I.d, As: g("A"), nb: 4, x: g("A") > 0 ? 0.3 * I.h : 0.5 * I.h, block: false });
    return s.replace("</svg>", `${arrow(250, 20, 250, 60, K.red, 2)}<text x="256" y="40" fill="${K.red}" font-size="9.5">Nu = ${f2(I.Nu, 0)} kN</text><path d="M240 90 a22 22 0 1 1 22 22" stroke="${K.red}" stroke-width="1.6" fill="none"/><text x="256" y="128" fill="${K.red}" font-size="9.5">MuG</text></svg>`);
  },
  clair: (I, g) => `L'effort de compression soulage les aciers : au lieu de ${f2(g("A1"))} cm² en flexion simple, il en faut ${f2(g("A"))} cm².` },

{ id: "bael-tranchant", t: "Effort tranchant : armatures d'âme (BAEL)", ref: "BAEL 91 mod. 99 — A.5.1.1, A.5.1.21, A.5.1.22, A.5.1.23",
  desc: "Contrainte tangente conventionnelle, limite de la contrainte, armatures transversales et espacement maximal.",
  inputs: [N("Vu", "Effort tranchant ultime", "kN", 700, L`V_u`), N("b0", "Largeur de l'âme", "m", 0.4, L`b_0`), N("d", "Hauteur utile", "m", 0.82, "d"), ...MAT,
    SEL("fis", "Fissuration", FIS, "p", ""), SEL("k", "Reprise de bétonnage", [["1", "Flexion simple sans reprise (k = 1)"], ["0", "Reprise non traitée ou FTP (k = 0)"]], "1", "k"), N("alpha", "Inclinaison des armatures", "°", 90, L`\alpha`)],
  calc(I) {
    const tu = I.Vu / 1000 / (I.b0 * I.d), lim = I.fis === "pp" ? min(0.2 * I.fc28 / 1.5, 5) : min(0.15 * I.fc28 / 1.5, 4), ft = ftj(I.fc28), a = I.alpha * PI / 180;
    const At = 1.15 * I.b0 * (tu - 0.3 * ft * +I.k) / (0.9 * I.fe * (Math.sin(a) + Math.cos(a))) * 1e4, Amin = 0.4 * I.b0 / I.fe * 1e4;
    return { steps: [R("tu", L`\tau_u`, L`\dfrac{V_u}{b_0\,d}`, tu, "MPa", 3), S("lim", L`\bar\tau_u`, I.fis === "pp" ? L`\min\left(0{,}20\,\dfrac{f_{c28}}{\gamma_b}\ ;\ 5\ \text{MPa}\right)` : L`\min\left(0{,}15\,\dfrac{f_{c28}}{\gamma_b}\ ;\ 4\ \text{MPa}\right)`, lim, "MPa", 2),
      S("At", L`\dfrac{A_t}{s_t}`, L`\dfrac{\gamma_s\,b_0\,(\tau_u - 0{,}3\,f_{t28}\,k)}{0{,}9\,f_e\,(\sin\alpha + \cos\alpha)}`, max(At, 0), "cm²/m", 2), S("Amin", L`\left(\dfrac{A_t}{s_t}\right)_{min}`, L`\dfrac{0{,}4\ \text{MPa}\cdot b_0}{f_e}`, Amin, "cm²/m", 2),
      R("Ar", L`\dfrac{A_t}{s_t}`, "~valeur à retenir", max(At, Amin), "cm²/m", 2), S("stmax", L`\bar s_t`, L`\min\left(0{,}9\,d\ ;\ 40\ \text{cm}\right)`, min(0.9 * I.d, 0.4), "m", 2)],
      checks: [C("$\\tau_u \\le \\bar\\tau_u$", tu <= lim, `${f2(tu, 2)} ≤ ${f2(lim, 2)} MPa`, tu / lim)],
      notes: ["Armatures droites ($\\alpha = 90°$) : $\\sin\\alpha + \\cos\\alpha = 1$. Pour des armatures inclinées à 45°, la limite $\\bar\\tau_u$ peut être portée à $\\min(0{,}27\\,f_{cj}/\\gamma_b ; 7\\ \\text{MPa})$ (A.5.1.212). Diamètre des cadres $\\le \\min(h/35 ; \\varnothing_l ; b_0/10)$."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "τu", v: g("tu"), lim: g("lim"), u: "MPa" }, { l: "τ̄u (limite)", v: g("lim"), c: K.mute, u: "MPa" }, { l: "At/st calculé", v: max(g("At"), 0), c: K.gold, u: "cm²/m" }, { l: "At/st minimal", v: g("Amin"), c: K.blue, u: "cm²/m" }], { title: "Cisaillement et armatures d'âme", left: 96 }); },
  clair: (I, g) => `Le cisaillement vaut ${f2(g("tu"), 2)} MPa (limite ${f2(g("lim"), 2)} MPa) : ${f2(g("Ar"), 1)} cm² de cadres par mètre, espacés de ${f2(g("stmax") * 100, 0)} cm au plus.` },

{ id: "bael-poteau", t: "Poteau en compression centrée (BAEL)", ref: "BAEL 91 mod. 99 — A.8.4.1, A.8.4.2, A.8.1.21",
  desc: "Effort normal résistant d'un poteau rectangulaire ou circulaire, coefficient de flambement α et armatures minimales.",
  inputs: [SEL("sec", "Section", [["r", "Rectangulaire"], ["c", "Circulaire"]], "r", ""), N("a", "Petit côté (ou diamètre)", "m", 0.5, "a"), N("b", "Grand côté", "m", 0.6, "b"),
    N("lf", "Longueur de flambement", "m", 5, L`l_f`), N("Nu", "Effort normal ultime", "kN", 4500, L`N_u`), N("A", "Armatures longitudinales", "cm²", 18.85, "A"), ...MAT,
    SEL("t90", "Plus de la moitié des charges avant 90 jours", [["n", "Non"], ["o", "Oui (α / 1,10)"]], "n", "")],
  calc(I) {
    const c = I.sec === "c", B = c ? PI * I.a * I.a / 4 : I.a * I.b, i = c ? I.a / 4 : I.a / sqrt(12), lam = I.lf / i;
    let al = lam <= 50 ? 0.85 / (1 + 0.2 * (lam / 35) ** 2) : 0.6 * (50 / lam) ** 2; if (I.t90 === "o") al /= 1.1;
    const Br = c ? PI * (I.a - 0.02) ** 2 / 4 : (I.a - 0.02) * (I.b - 0.02), Nr = al * (Br * I.fc28 / (0.9 * 1.5) + I.A / 1e4 * I.fe / 1.15);
    const Areq = max(0, (I.Nu / 1000 / al - Br * I.fc28 / 1.35) * 1.15 / I.fe) * 1e4, Amin = max(4 * (c ? PI * I.a : 2 * (I.a + I.b)), 0.002 * B * 1e4), Amax = 0.05 * B * 1e4;
    return { steps: [S("i", "i", c ? L`\dfrac{D}{4}` : L`\dfrac{a}{\sqrt{12}}`, i, "m", 3), R("lam", L`\lambda`, L`\dfrac{l_f}{i}`, lam, "", 1),
      S("al", L`\alpha`, lam <= 50 ? L`\dfrac{0{,}85}{1 + 0{,}2\,(\lambda/35)^2}` : L`0{,}60\left(\dfrac{50}{\lambda}\right)^2`, al, "", 4), S("Br", L`B_r`, c ? L`\dfrac{\pi\,(D - 0{,}02)^2}{4}` : L`(a - 0{,}02)(b - 0{,}02)`, Br, "m²", 4),
      R("Nr", L`N_{u,lim}`, L`\alpha\left[\dfrac{B_r\,f_{c28}}{0{,}9\,\gamma_b} + \dfrac{A\,f_e}{\gamma_s}\right]`, Nr * 1000, "kN", 0),
      R("Areq", L`A_{req}`, L`\left(\dfrac{N_u}{\alpha} - \dfrac{B_r\,f_{c28}}{0{,}9\,\gamma_b}\right)\dfrac{\gamma_s}{f_e}`, Areq, "cm²", 2),
      S("Amin", L`A_{min}`, L`\max\left(4\ \text{cm}^2/\text{m de périmètre}\ ;\ 0{,}2\,\%\,B\right)`, Amin, "cm²", 2), S("Amax", L`A_{max}`, L`5\,\%\,B`, Amax, "cm²", 1)],
      checks: [C("$N_u \\le N_{u,lim}$", I.Nu <= Nr * 1000, `${f2(I.Nu, 0)} ≤ ${f2(Nr * 1000, 0)} kN`, I.Nu / (Nr * 1000)), C("$\\lambda \\le 70$ (méthode forfaitaire)", lam <= 70, f2(lam, 1)),
        C("$A_{min} \\le A \\le A_{max}$", I.A >= Amin && I.A <= Amax, `${f2(I.A)} cm²`)],
      notes: ["Méthode forfaitaire valable pour un poteau soumis à une compression « centrée » (excentricité faible). Si plus de la moitié des charges est appliquée avant 28 jours, remplacer $f_{c28}$ par $f_{cj}$ et diviser $\\alpha$ par 1,20 (A.8.4.1)."] };
  },
  fig(I, g) {
    const pts = range(0, 70, 70).map(l => [l, l <= 50 ? 0.85 / (1 + 0.2 * (l / 35) ** 2) : 0.6 * (50 / l) ** 2]);
    return plot({ series: [{ pts, l: "coefficient α(λ)" }], vlines: [{ x: 50, l: "λ = 50" }], marks: [{ x: min(g("lam"), 70), y: g("al"), l: `α = ${f2(g("al"), 3)}` }], xl: "élancement λ", yl: "α", ymin: 0, ymax: 0.95, xmax: 70 });
  },
  clair: (I, g) => `Avec un élancement de ${f2(g("lam"), 0)}, le poteau garde ${f2(g("al") / 0.85 * 100, 0)} % de sa capacité de compression courte : il porte ${f2(g("Nr"), 0)} kN pour ${f2(I.Nu, 0)} kN appliqués.` },

{ id: "bael-ancrage", t: "Ancrage et recouvrement des barres (BAEL)", ref: "BAEL 91 mod. 99 — A.6.1.21, A.6.1.221, A.6.1.253",
  desc: "Contrainte d'adhérence, longueur de scellement droit, ancrage par crochet et longueur de recouvrement.",
  inputs: [SEL("phi", "Diamètre de la barre", Object.keys(ACIER_HA).map(k => [k, "HA " + k]), "20", L`\varnothing`), N("fc28", "Résistance du béton", "MPa", 30, L`f_{c28}`), N("fe", "Limite élastique", "MPa", 500, L`f_e`),
    SEL("psi", "Type d'acier", [["1.5", "Haute adhérence (ψs = 1,5)"], ["1", "Rond lisse (ψs = 1)"]], "1.5", L`\psi_s`)],
  calc(I) {
    const phi = +I.phi, ps = +I.psi, ts = 0.6 * ps * ps * ftj(I.fc28), ls = phi * I.fe / (4 * ts), lc = ps === 1.5 ? 0.4 * ls : 0.6 * ls;
    return { steps: [S("ft", L`f_{t28}`, L`0{,}6 + 0{,}06\,f_{c28}`, ftj(I.fc28), "MPa", 2), S("ts", L`\tau_{su}`, L`0{,}6\,\psi_s^2\,f_{t28}`, ts, "MPa", 3),
      R("ls", L`l_s`, L`\dfrac{\varnothing\,f_e}{4\,\tau_{su}}`, ls, "mm", 0), S("lsp", L`l_s/\varnothing`, "", ls / phi, "", 1),
      R("lc", L`l_a`, ps === 1.5 ? L`0{,}4\,l_s\ \ \text{(crochet normal, HA)}` : L`0{,}6\,l_s\ \ \text{(crochet normal, RL)}`, lc, "mm", 0),
      R("lr", L`l_r`, L`l_s\ \ \text{(barres en contact)} \ ;\ l_s + c\ \text{(si écartées de } c\text{)}`, ls, "mm", 0)],
      notes: ["À défaut de calcul précis, le BAEL admet $l_s = 40\\varnothing$ (FeE400) et $50\\varnothing$ (FeE500) pour les HA (A.6.1.221). Crochet normal : retour à 180° de rayon $\\ge 5{,}5\\varnothing$ (RL : $3\\varnothing$)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "scellement droit ls", v: g("ls"), u: "mm", c: K.red, d: 0 }, { l: "avec crochet la", v: g("lc"), u: "mm", c: K.gold, d: 0 }, { l: "forfait 50 ∅", v: 50 * +I.phi, u: "mm", c: K.mute, d: 0 }], { title: `HA ${I.phi} · τsu = ${f2(g("ts"), 2)} MPa`, left: 118 }); },
  clair: (I, g) => `Une barre HA${I.phi} doit être scellée sur ${f2(g("ls") / 10, 0)} cm en ligne droite, ou ${f2(g("lc") / 10, 0)} cm avant un crochet normal.` },

{ id: "bael-semelle", t: "Semelle isolée sous poteau : méthode des bielles", ref: "BAEL 91 mod. 99 — méthode des bielles (DTU 13.12) ; A.5.2.4 (poinçonnement)",
  desc: "Semelle rectangulaire rigide sous charge centrée : hauteur utile minimale et armatures inférieures dans les deux directions.",
  inputs: [N("Nu", "Charge ultime transmise", "kN", 3200, L`N_u`), N("A", "Côté de la semelle (direction x)", "m", 2.6, "A"), N("B", "Côté de la semelle (direction y)", "m", 2.6, "B"),
    N("a", "Côté du poteau (x)", "m", 0.5, "a"), N("b", "Côté du poteau (y)", "m", 0.5, "b"), N("h", "Hauteur de la semelle", "m", 0.65, "h"), N("c", "Enrobage (axe des aciers)", "m", 0.06, "c"), ...MAT,
    SEL("fis", "Fissuration", [["pp", "Peu préjudiciable (σs = fe/γs)"], ["p", "Préjudiciable (Ax et Ay × 1,1)"], ["tp", "Très préjudiciable (× 1,5)"]], "p", "")],
  calc(I) {
    const d = I.h - I.c, dmin = max((I.A - I.a) / 4, (I.B - I.b) / 4), fsu = I.fe / 1.15, kf = I.fis === "pp" ? 1 : I.fis === "p" ? 1.1 : 1.5, Nu = I.Nu / 1000;
    const Ax = kf * Nu * (I.A - I.a) / (8 * d * fsu) * 1e4, Ay = kf * Nu * (I.B - I.b) / (8 * d * fsu) * 1e4, q = I.Nu / (I.A * I.B);
    return { steps: [S("d", "d", L`h - c`, d, "m", 3), S("dmin", L`d_{min}`, L`\max\left(\dfrac{A - a}{4}\ ;\ \dfrac{B - b}{4}\right)`, dmin, "m", 3), S("q", L`q_u`, L`\dfrac{N_u}{A\,B}`, q, "kPa", 0),
      R("Ax", L`A_x`, L`k_f\,\dfrac{N_u\,(A - a)}{8\,d\,f_{su}}`, Ax, "cm²", 2), R("Ay", L`A_y`, L`k_f\,\dfrac{N_u\,(B - b)}{8\,d\,f_{su}}`, Ay, "cm²", 2),
      S("dmax", L`d_{max}`, L`A - a`, I.A - I.a, "m", 3)],
      checks: [C("Semelle rigide : $\\dfrac{A - a}{4} \\le d \\le A - a$", d >= dmin && d <= max(I.A - I.a, I.B - I.b), `d = ${f2(d, 2)} m ≥ ${f2(dmin, 2)} m`, dmin / d)],
      notes: ["La contrainte $q_u$ doit être comparée à la portance du sol (rubrique Géotechnique), poids propre de la semelle et des terres inclus. Ancrage des barres : si $l_s > A/4$, crochets à toutes les barres ; si $A/8 < l_s \\le A/4$, barres droites sur toute la longueur ; si $l_s \\le A/8$, barres droites, une sur deux pouvant être arrêtée à $0{,}71\\,A$."] };
  },
  fig(I, g) {
    const W = 330, Hh = 175, k = 220 / I.A, x0 = 165 - I.A * k / 2, y0 = 70, h = I.h * k; let s = "";
    s += Rc(10, y0 + h, 310, 50, { f: K.soil, c: "none", op: .4 }) + Rc(x0, y0, I.A * k, h) + Rc(165 - I.a * k / 2, y0 - 50, I.a * k, 50);
    s += P(`M${165 - I.a * k / 4} ${y0}L${x0 + 10} ${y0 + h - 6}M${165 + I.a * k / 4} ${y0}L${x0 + I.A * k - 10} ${y0 + h - 6}`, { c: K.blue, w: 3, op: .4 }) + P(`M${x0 + 6} ${y0 + h - 6}H${x0 + I.A * k - 6}`, { c: K.red, w: 3 });
    s += arrow(165, y0 - 80, 165, y0 - 52, K.red, 2) + T(171, y0 - 64, `Nu = ${f2(I.Nu, 0)} kN`, { s: 9.5, c: K.red }) + T(165, y0 + h + 14, `Ax = ${f2(g("Ax"))} cm²`, { a: "middle", s: 9.5, c: K.red, w: 500 }) + dim(x0, x0 + I.A * k, y0 + h + 40, `A = ${f2(I.A, 2)} m`);
    s += T(x0 + 18, y0 + h / 2, "bielles", { s: 9, c: K.blue });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La charge du poteau descend par des bielles inclinées jusqu'au fond de la semelle, où ${f2(g("Ax"))} cm² d'acier dans chaque sens retiennent leur écartement.` },

{ id: "bael-poinconnement", t: "Poinçonnement d'une dalle (BAEL)", ref: "BAEL 91 mod. 99 — A.5.2.4",
  desc: "Charge localisée sur une dalle sans armatures d'effort tranchant : vérification au feuillet moyen.",
  inputs: [N("Qu", "Charge localisée ultime", "kN", 300, L`Q_u`), N("u", "Dimension de l'impact (x)", "m", 0.4, "u"), N("v", "Dimension de l'impact (y)", "m", 0.4, "v"),
    N("e", "Épaisseur du revêtement", "m", 0.08, "e"), N("h", "Épaisseur de la dalle", "m", 0.25, "h"), N("fc28", "Résistance du béton", "MPa", 30, L`f_{c28}`)],
  calc(I) {
    const u0 = I.u + 2 * I.e * 0.75 + I.h, v0 = I.v + 2 * I.e * 0.75 + I.h, uc = 2 * (u0 + v0), Ql = 0.045 * uc * I.h * I.fc28 / 1.5 * 1000;
    return { steps: [S("u0", L`u_0`, L`u + 2\cdot\tfrac{3}{4}\,e + h`, u0, "m", 3), S("v0", L`v_0`, L`v + 2\cdot\tfrac{3}{4}\,e + h`, v0, "m", 3),
      S("uc", L`u_c`, L`2\,(u_0 + v_0)` + "\\quad\\text{(périmètre au feuillet moyen)}", uc, "m", 3), R("Ql", L`Q_{u,lim}`, L`0{,}045\,u_c\,h\,\dfrac{f_{c28}}{\gamma_b}`, Ql, "kN", 1)],
      checks: [C("$Q_u \\le 0{,}045\\,u_c\\,h\\,f_{c28}/\\gamma_b$", I.Qu <= Ql, `${f2(I.Qu, 0)} ≤ ${f2(Ql, 0)} kN`, I.Qu / Ql)],
      notes: ["Diffusion de l'impact selon la pente 3/4 dans le revêtement et à 45° dans le béton, jusqu'au feuillet moyen de la dalle. Pour une roue, $Q_u$ inclut $\\gamma_Q$ et le coefficient de majoration dynamique $\\delta$."] };
  },
  fig(I, g) {
    const W = 330, Hh = 150, k = 180 / g("u0"), cx = 165, yt = 40, e = I.e * k, h = I.h * k, u = I.u * k;
    let s = Rc(20, yt + e, 290, h) + Rc(20, yt, 290, e, { f: "#3c3f4d", c: "#3c3f4d", op: .25 }) + Rc(cx - u / 2, yt - 8, u, 8, { f: K.ink, c: K.ink });
    s += P(`M${cx - u / 2} ${yt}L${cx - u / 2 - 0.75 * e} ${yt + e}L${cx - g("u0") * k / 2} ${yt + e + h / 2}M${cx + u / 2} ${yt}L${cx + u / 2 + 0.75 * e} ${yt + e}L${cx + g("u0") * k / 2} ${yt + e + h / 2}`, { c: K.red, w: 1.4, dash: "4 3" });
    s += P(`M20 ${yt + e + h / 2}H310`, { c: K.mute, w: .8, dash: "2 3" }) + dim(cx - g("u0") * k / 2, cx + g("u0") * k / 2, yt + e + h + 16, `u0 = ${f2(g("u0"), 2)} m`) + arrow(cx, yt - 32, cx, yt - 9, K.red, 2) + T(cx + 6, yt - 18, "Qu", { s: 9.5, c: K.red });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La dalle supporte sans poinçonner jusqu'à ${f2(g("Ql"), 0)} kN sur cet impact ; la charge appliquée en représente ${f2(I.Qu / g("Ql") * 100, 0)} %.` },

{ id: "bael-nonfragilite", t: "Condition de non-fragilité et pourcentages minimaux", ref: "BAEL 91 mod. 99 — A.4.2.1, A.8.1.21, B.6.4 ; Fascicule 62 titre I section I",
  desc: "Section minimale d'une section rectangulaire fléchie ou tendue, armatures de peau et pourcentage minimal des poteaux.",
  inputs: [N("b", "Largeur", "m", 0.4, "b"), N("h", "Hauteur", "m", 0.9, "h"), N("d", "Hauteur utile", "m", 0.82, "d"), ...MAT],
  calc(I) {
    const ft = ftj(I.fc28), Af = 0.23 * ft / I.fe * I.b * I.d * 1e4, At = I.b * I.h * ft / I.fe * 1e4, Ap = 3 * 2 * I.h, B = I.b * I.h;
    return { steps: [S("ft", L`f_{t28}`, L`0{,}6 + 0{,}06\,f_{c28}`, ft, "MPa", 2), R("Af", L`A_{min}^{flexion}`, L`0{,}23\,\dfrac{f_{t28}}{f_e}\,b\,d`, Af, "cm²", 2),
      R("At", L`A_{min}^{traction}`, L`B\,\dfrac{f_{t28}}{f_e}`, At, "cm²", 2), S("Ap", L`A_{peau}`, L`3\ \text{cm}^2/\text{m de parement}`, Ap, "cm²", 2),
      S("Ac", L`A_{min}^{poteau}`, L`\max(4\ \text{cm}^2/\text{m} ;\ 0{,}2\,\%\,B)`, max(4 * 2 * (I.b + I.h), 0.002 * B * 1e4), "cm²", 2), S("Amax", L`A_{max}^{poteau}`, L`5\,\%\,B`, 0.05 * B * 1e4, "cm²", 1)],
      notes: ["Armatures de peau : obligatoires pour les poutres de grande hauteur en fissuration préjudiciable ou très préjudiciable (A.8.3) — au moins 3 cm² par mètre de parement (5 cm²/m en FTP)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "flexion (0,23 ft/fe)", v: g("Af"), u: "cm²" }, { l: "traction (B ft/fe)", v: g("At"), u: "cm²", c: K.blue }, { l: "armatures de peau", v: g("Ap"), u: "cm²", c: K.teal }, { l: "poteau minimal", v: g("Ac"), u: "cm²", c: K.mute }], { title: `Section ${f2(I.b, 2)} × ${f2(I.h, 2)} m`, left: 116 }); },
  clair: (I, g) => `Pour qu'elle ne casse pas brutalement à la première fissure, cette poutre doit contenir au moins ${f2(g("Af"), 1)} cm² d'acier tendu.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
