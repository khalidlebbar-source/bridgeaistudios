/* ════════════════════════════════════════════════════════════════════
   HandBag — Géotechnique et fondations (NF EN 1997-1, Fascicule 62 titre V, NF P94-261/262, Ménard)
   Unités : m, kN, kPa, MPa (modules pressiométriques).
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, logRange, gauge, udl, ground } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), rad = d => d * PI / 180, tan = Math.tan, sin = Math.sin, cos = Math.cos, log10 = Math.log10;
const LAM = [[1, 1, 1], [1.0001, 1.1, 1.12], [2, 1.2, 1.53], [3, 1.3, 1.78], [5, 1.4, 2.14], [20, 1.5, 2.65]];   // L/B, λc, λd (le premier : cercle)
function lamb(LB, circ) { if (circ) return [1, 1]; const t = LAM.slice(1); if (LB <= 1) return [1.1, 1.12]; for (let i = 0; i < t.length - 1; i++) if (LB <= t[i + 1][0]) { const r = (LB - t[i][0]) / (t[i + 1][0] - t[i][0]); return [t[i][1] + r * (t[i + 1][1] - t[i][1]), t[i][2] + r * (t[i + 1][2] - t[i][2])]; } return [1.5, 2.65]; }
const ALPHA = [["1", "Tourbe (α = 1)"], ["2/3", "Argile normalement consolidée (2/3)"], ["1/2", "Limon normalement consolidé, sable lâche (1/2)"], ["1/3", "Sable (1/3)"], ["1/4", "Sable et graviers (1/4)"], ["1b", "Argile surconsolidée (1)"]];
const frac = s => { const [a, b] = String(s).replace("b", "").split("/").map(Number); return b ? a / b : a; };
const KP = { "A1": [0.8, 0.25], "A2": [0.8, 0.35], "A3": [0.8, 0.5], "S1": [1, 0.35], "S2": [1, 0.5], "S3": [1, 0.8], "CR": [1.3, 0.27], "MR": [1, 0.27] };
const CAT = [["A1", "Argiles et limons A, craies A"], ["A2", "Argiles et limons B"], ["A3", "Argiles C"], ["S1", "Sables et graves A"], ["S2", "Sables et graves B"], ["S3", "Sables et graves C"], ["CR", "Craies B et C"], ["MR", "Marnes, marno-calcaires, roches altérées"]];

HB.add("Géotechnique et fondations", [

{ id: "geo-portance-ec7", t: "Portance d'une semelle (méthode analytique c–φ)", ref: "NF EN 1997-1 — annexe D (D.3 non drainé, D.4 drainé) ; §6.5.2 ; NF P94-261 (approche 2 : γR;v = 1,4)",
  desc: "Résistance ultime d'une fondation superficielle rectangulaire à partir des paramètres de cisaillement, avec excentricité et inclinaison de la charge.",
  inputs: [SEL("cond", "Conditions", [["d", "Drainées (c', φ')"], ["u", "Non drainées (cu)"]], "d", ""), N("B", "Largeur", "m", 3, "B"), N("Lf", "Longueur", "m", 6, "L"), N("D", "Encastrement", "m", 1.5, "D"),
    N("e", "Excentricité selon B", "m", 0.2, L`e_B`), N("V", "Charge verticale de calcul", "kN", 5000, L`V_d`), N("Hx", "Charge horizontale (selon B)", "kN", 400, L`H_d`),
    N("g", "Poids volumique (déjaugé si nappe)", "kN/m³", 19, L`\gamma'`), N("phi", "Angle de frottement effectif", "°", 32, L`\varphi'`), N("c", "Cohésion effective", "kPa", 0, L`c'`), N("cu", "Cohésion non drainée", "kPa", 80, L`c_u`)],
  calc(I) {
    const Bp = I.B - 2 * I.e, Ap = Bp * I.Lf, r = Bp / I.Lf, q = I.g * I.D; let qu, steps;
    if (I.cond === "d") {
      const f = rad(I.phi), Nq = exp(PI * tan(f)) * tan(PI / 4 + f / 2) ** 2, Nc = (Nq - 1) / tan(f), Ng = 2 * (Nq - 1) * tan(f), sq = 1 + r * sin(f), sg = 1 - 0.3 * r, sc = (sq * Nq - 1) / (Nq - 1);
      const m = (2 + r) / (1 + r), base = max(0, 1 - I.Hx / (I.V + Ap * I.c / tan(f))), iq = pow(base, m), ig = pow(base, m + 1), ic = iq - (1 - iq) / (Nc * tan(f));
      qu = I.c * Nc * sc * ic + q * Nq * sq * iq + 0.5 * I.g * Bp * Ng * sg * ig;
      steps = [S("N", L`N_q\ ;\ N_c\ ;\ N_\gamma`, L`e^{\pi\tan\varphi'}\tan^2\!\left(\tfrac{\pi}{4} + \tfrac{\varphi'}{2}\right) ;\ (N_q - 1)\cot\varphi' ;\ 2(N_q - 1)\tan\varphi'`, `${f2(Nq, 2)} ; ${f2(Nc, 2)} ; ${f2(Ng, 2)}`, "", 0),
        S("s", L`s_q\ ;\ s_\gamma\ ;\ s_c`, L`1 + \tfrac{B'}{L'}\sin\varphi' ;\ 1 - 0{,}3\tfrac{B'}{L'} ;\ \tfrac{s_q N_q - 1}{N_q - 1}`, `${f2(sq, 3)} ; ${f2(sg, 3)} ; ${f2(sc, 3)}`, "", 0),
        S("i", L`i_q\ ;\ i_\gamma`, L`\left[1 - \dfrac{H}{V + A'c'\cot\varphi'}\right]^{m}\ ;\ [\dots]^{m+1}`, `${f2(iq, 3)} ; ${f2(ig, 3)}`, "", 0)];
    } else {
      const sc = 1 + 0.2 * r, ic = 0.5 * (1 + sqrt(max(0, 1 - I.Hx / (Ap * I.cu))));
      qu = (PI + 2) * I.cu * sc * ic + q * 1;
      steps = [S("sc", L`s_c`, L`1 + 0{,}2\,\dfrac{B'}{L'}`, sc, "", 3), S("ic", L`i_c`, L`\tfrac{1}{2}\left(1 + \sqrt{1 - \dfrac{H}{A' c_u}}\right)`, ic, "", 3)];
    }
    const Ru = qu * Ap, Rd = Ru / 1.4;
    return { steps: [S("Bp", L`B'`, L`B - 2\,e_B`, Bp, "m", 2), S("Ap", L`A'`, L`B'\,L`, Ap, "m²", 2), ...steps,
      R("qu", L`q_u`, I.cond === "d" ? L`c'N_c s_c i_c + q'N_q s_q i_q + \tfrac{1}{2}\gamma' B' N_\gamma s_\gamma i_\gamma` : L`(\pi + 2)\,c_u\,s_c\,i_c + q`, qu, "kPa", 0),
      S("Ru", L`R_u`, L`q_u\,A'`, Ru, "kN", 0), R("Rd", L`R_{v;d}`, L`\dfrac{R_u}{\gamma_{R;v}}\ \ (\gamma_{R;v} = 1{,}4)`, Rd, "kN", 0)],
      checks: [C("$V_d \\le R_{v;d}$", I.V <= Rd, `${f2(I.V, 0)} ≤ ${f2(Rd, 0)} kN`, I.V / Rd), C("Excentricité : $e \\le B/3$ (ELU)", I.e <= I.B / 3, `${f2(I.e, 2)} m`)],
      notes: ["Base horizontale, terrain horizontal ($b = g = 1$). $q'$ : contrainte effective au niveau de la base, à côté de la fondation. En France, la norme d'application NF P94-261 privilégie les méthodes pressiométrique et pénétrométrique ; la méthode c–φ sert de contrôle ou pour les sols homogènes bien caractérisés."] };
  },
  fig(I, g) { return KIT.footingFig({ B: I.B, D: I.D, e: I.e, q: g("qu") / 3, Beff: g("Bp"), N: `Vd = ${f2(I.V, 0)} kN`, Hf: I.Hx > 0 ? `Hd = ${f2(I.Hx, 0)}` : null, l1: `qu = ${f2(g("qu"), 0)} kPa sur B'`, l2: "" }); },
  clair: (I, g) => `Le sol peut porter ${f2(g("Rd"), 0)} kN (valeur de calcul) sous cette semelle ; la charge en utilise ${f2(I.V / g("Rd") * 100, 0)} %.` },

{ id: "geo-portance-pressio", t: "Portance d'une semelle au pressiomètre (Fascicule 62)", ref: "Fascicule 62 titre V — annexe F.2 (fondations superficielles) ; NF P94-261 §D (méthode pressiométrique)",
  desc: "Contrainte de rupture et contraintes admissibles ELU et ELS d'une semelle à partir de la pression limite nette équivalente.",
  inputs: [SEL("cat", "Nature du sol", CAT, "S2", ""), N("ple", "Pression limite nette équivalente", "MPa", 1.2, L`p_{le}^*`), N("B", "Largeur", "m", 3, "B"), N("Lf", "Longueur", "m", 6, "L"),
    N("De", "Hauteur d'encastrement équivalente", "m", 1.2, L`D_e`), N("q0", "Contrainte verticale totale au niveau de la base (après travaux)", "kPa", 30, L`q'_0`), N("id", "Coefficient d'inclinaison / talus", "", 1, L`i_{\delta\beta}`), N("qref", "Contrainte de référence appliquée (ELS)", "kPa", 450, L`q_{ref}`)],
  calc(I) {
    const [a, b] = KP[I.cat], kp = a * (1 + b * (0.6 + 0.4 * I.B / I.Lf) * I.De / I.B), qu = kp * I.ple * 1000 * I.id + I.q0, qELU = I.q0 + (qu - I.q0) / 2, qELS = I.q0 + (qu - I.q0) / 3;
    return { steps: [S("De_B", L`D_e/B`, "", I.De / I.B, "", 3), R("kp", L`k_p`, L`a\left[1 + b\left(0{,}6 + 0{,}4\,\dfrac{B}{L}\right)\dfrac{D_e}{B}\right]`, kp, "", 3), R("qu", L`q'_u`, L`k_p\,p_{le}^*\,i_{\delta\beta} + q'_0`, qu, "kPa", 0),
      R("qELU", L`q_{ELU}`, L`q'_0 + \dfrac{q'_u - q'_0}{2}`, qELU, "kPa", 0), R("qELS", L`q_{ELS}`, L`q'_0 + \dfrac{q'_u - q'_0}{3}`, qELS, "kPa", 0)],
      checks: [C("ELS : $q_{ref} \\le q_{ELS}$", I.qref <= qELS, `${f2(I.qref, 0)} ≤ ${f2(qELS, 0)} kPa`, I.qref / qELS)],
      notes: [`Catégorie ${CAT.find(c => c[0] === I.cat)[1]} : $a = ${f2(a, 2)}$, $b = ${f2(b, 2)}$. $p_{le}^*$ : moyenne géométrique de $p_l^*$ entre $D$ et $D + 1{,}5B$ ; $D_e$ : feuille « Pression limite équivalente ». La NF P94-261 remplace ce tableau par $k_p = k_{p0} + (a + b\\,D_e/B)(1 - e^{-c\\,D_e/B})$ et les coefficients $\\gamma_{R;v} = 1{,}4$ (ELU) et 2,3 (ELS QP).`] };
  },
  fig(I, g) { return KIT.footingFig({ B: I.B, D: I.De, q: g("qELS"), N: `qref = ${f2(I.qref, 0)} kPa`, l1: `qELS = ${f2(g("qELS"), 0)} kPa · qELU = ${f2(g("qELU"), 0)} kPa` }); },
  clair: (I, g) => `Le sol ${CAT.find(c => c[0] === I.cat)[1].toLowerCase()} rompt sous ${f2(g("qu"), 0)} kPa ; on peut appliquer ${f2(g("qELS"), 0)} kPa en service et ${f2(g("qELU"), 0)} kPa à l'ELU.` },

{ id: "geo-tassement-pressio", t: "Tassement d'une semelle au pressiomètre (Ménard)", ref: "Fascicule 62 titre V — annexe F.3 ; NF P94-261 annexe H (méthode pressiométrique)",
  desc: "Tassement sphérique et déviatorique d'une fondation superficielle à partir du module pressiométrique et du coefficient rhéologique.",
  inputs: [N("q", "Contrainte appliquée (ELS quasi permanent)", "kPa", 300, "q"), N("sv0", "Contrainte verticale initiale au niveau de la base", "kPa", 30, L`\sigma'_{v0}`), N("B", "Largeur", "m", 3, "B"), N("Lf", "Longueur", "m", 6, "L"),
    SEL("circ", "Forme", [["r", "Rectangulaire"], ["c", "Circulaire"]], "r", ""), N("Ec", "Module pressiométrique zone sphérique (jusqu'à B/2)", "MPa", 15, L`E_c`), N("Ed", "Module pressiométrique zone déviatorique (jusqu'à 8B)", "MPa", 12, L`E_d`),
    SEL("alpha", "Coefficient rhéologique", ALPHA, "1/3", L`\alpha`)],
  calc(I) {
    const a = frac(I.alpha), [lc, ld] = lamb(I.Lf / I.B, I.circ === "c"), dq = (I.q - I.sv0) / 1000, B0 = 0.6;
    const sc = a / (9 * I.Ec) * dq * lc * I.B * 1000, sd = 2 / (9 * I.Ed) * dq * B0 * pow(ld * I.B / B0, a) * 1000;
    return { steps: [S("lam", L`\lambda_c\ ;\ \lambda_d`, "~fonction de L/B", `${f2(lc, 2)} ; ${f2(ld, 2)}`, "", 0), S("dq", L`q - \sigma'_{v0}`, "", dq * 1000, "kPa", 0),
      S("sc", L`s_c`, L`\dfrac{\alpha}{9\,E_c}\,(q - \sigma'_{v0})\,\lambda_c\,B`, sc, "mm", 1), S("sd", L`s_d`, L`\dfrac{2}{9\,E_d}\,(q - \sigma'_{v0})\,B_0\left(\lambda_d\,\dfrac{B}{B_0}\right)^{\alpha}`, sd, "mm", 1), R("s", "s", L`s_c + s_d`, sc + sd, "mm", 1)],
      notes: ["$B_0 = 0{,}60$ m. Pour un sol hétérogène, $E_d$ est une moyenne harmonique pondérée des modules entre 0 et 8 B (formule de Ménard). Les tassements obtenus sont des tassements à long terme (sols fins : comparer aussi avec l'œdomètre)."] };
  },
  fig(I, g) { const a = frac(I.alpha), dq = (I.q - I.sv0) / 1000, Bs = range(0.5, 10, 60); const f = B => { const [lc, ld] = lamb(I.Lf / I.B, I.circ === "c"); return (a / (9 * I.Ec) * dq * lc * B + 2 / (9 * I.Ed) * dq * 0.6 * pow(ld * B / 0.6, a)) * 1000; };
    return plot({ series: [{ pts: Bs.map(b => [b, f(b)]), l: "tassement selon la largeur (même q)" }], marks: [{ x: I.B, y: g("s"), l: `${f2(g("s"), 1)} mm` }], xl: "largeur B (m)", yl: "s (mm)", ymin: 0 }); },
  clair: (I, g) => `Sous ${f2(I.q, 0)} kPa, la semelle tassera d'environ ${f2(g("s"), 0)} mm (${f2(g("sc"), 0)} mm de consolidation et ${f2(g("sd"), 0)} mm de cisaillement).` },

{ id: "geo-oedometre", t: "Tassement de consolidation et temps (œdomètre)", ref: "Théorie de Terzaghi — consolidation unidimensionnelle ; NF EN 1997-1 §6.6.2 et annexe F",
  desc: "Tassement d'une couche d'argile à partir des indices de compression et de gonflement, et évolution dans le temps.",
  inputs: [N("Hc", "Épaisseur de la couche compressible", "m", 6, "H"), N("e0", "Indice des vides initial", "", 1.1, L`e_0`), N("Cc", "Indice de compression", "", 0.35, L`C_c`), N("Cs", "Indice de gonflement", "", 0.05, L`C_s`),
    N("s0", "Contrainte effective initiale (milieu de couche)", "kPa", 60, L`\sigma'_{v0}`), N("sp", "Pression de préconsolidation", "kPa", 80, L`\sigma'_p`), N("ds", "Supplément de contrainte (milieu de couche)", "kPa", 100, L`\Delta\sigma`),
    N("cv", "Coefficient de consolidation", "m²/an", 2, L`c_v`), SEL("dr", "Drainage", [["2", "Double (Hd = H/2)"], ["1", "Simple (Hd = H)"]], "2", ""), N("t", "Durée étudiée", "ans", 1, "t")],
  calc(I) {
    const sf = I.s0 + I.ds, sp = max(I.sp, I.s0), s = I.Hc / (1 + I.e0) * (sf <= sp ? I.Cs * log10(sf / I.s0) : I.Cs * log10(sp / I.s0) + I.Cc * log10(sf / sp)) * 1000;
    const Hd = I.Hc / +I.dr, Tv = I.cv * I.t / Hd ** 2, U = Tv < 0.2827 ? sqrt(4 * Tv / PI) : 1 - pow(10, -(Tv + 0.085) / 0.933), t90 = 0.848 * Hd ** 2 / I.cv;
    return { steps: [S("sf", L`\sigma'_{vf}`, L`\sigma'_{v0} + \Delta\sigma`, sf, "kPa", 0), R("s", L`s_{\infty}`, L`\dfrac{H}{1 + e_0}\left[C_s\log\dfrac{\sigma'_p}{\sigma'_{v0}} + C_c\log\dfrac{\sigma'_{vf}}{\sigma'_p}\right]`, s, "mm", 0),
      S("Hd", L`H_d`, "~longueur de drainage", Hd, "m", 2), S("Tv", L`T_v`, L`\dfrac{c_v\,t}{H_d^2}`, Tv, "", 4), R("U", L`U(t)`, Tv < 0.2827 ? L`\sqrt{\dfrac{4\,T_v}{\pi}}` : L`1 - 10^{-(T_v + 0{,}085)/0{,}933}`, U * 100, "%", 1),
      S("st", L`s(t)`, L`U(t)\,s_\infty`, U * s, "mm", 0), R("t90", L`t_{90}`, L`\dfrac{0{,}848\,H_d^2}{c_v}`, t90, "ans", 2)],
      notes: ["Calcul pour une couche (prendre plusieurs sous-couches si elle est épaisse : la contrainte varie avec la profondeur). Fluage secondaire non compté. Les drains verticaux réduisent fortement $t_{90}$ (consolidation radiale, méthode de Barron)."] };
  },
  fig(I, g) { const Hd = g("Hd"), U = Tv => Tv < 0.2827 ? sqrt(4 * Tv / PI) : 1 - pow(10, -(Tv + 0.085) / 0.933), ts = logRange(0.01, max(100, g("t90") * 3), 80);
    return plot({ logx: true, series: [{ pts: ts.map(t => [t, -U(I.cv * t / Hd ** 2) * g("s")]), l: "tassement s(t)" }], marks: [{ x: I.t, y: -g("st"), l: `${f2(g("st"), 0)} mm à ${f2(I.t, 1)} an` }], hlines: [{ y: -g("s"), l: `s∞ = ${f2(g("s"), 0)} mm`, c: K.mute }], xl: "temps (années, log)", yl: "mm", xmin: 0.01, ymax: 0 }); },
  clair: (I, g) => `La couche va tasser de ${f2(g("s"), 0)} mm au total ; au bout de ${f2(I.t, 1)} an, ${f2(g("U"), 0)} % est fait, et 90 % le sera en ${f2(g("t90"), 1)} ans.` },

{ id: "geo-pieu-pressio", t: "Pieu isolé : portance au pressiomètre (Fascicule 62)", ref: "Fascicule 62 titre V — annexe C.3 (pressiomètre), art. B.3 ; NF P94-262 (méthode pressiométrique)",
  desc: "Résistance de pointe, frottement latéral, charge de fluage et charges admissibles d'un pieu dans un sol multicouche.",
  inputs: [N("D", "Diamètre du pieu", "m", 1.0, "D"), SEL("type", "Mise en œuvre", [["f", "Foré (sans refoulement)"], ["b", "Battu / refoulant"]], "f", ""),
    H("Couches (de haut en bas)"), N("h1", "Couche 1 : épaisseur", "m", 4, L`h_1`), N("q1", "Couche 1 : frottement unitaire limite", "kPa", 40, L`q_{s1}`), N("h2", "Couche 2 : épaisseur", "m", 8, L`h_2`), N("q2", "Couche 2 : frottement unitaire limite", "kPa", 80, L`q_{s2}`),
    N("h3", "Couche 3 (ancrage) : épaisseur traversée", "m", 4, L`h_3`), N("q3", "Couche 3 : frottement unitaire limite", "kPa", 120, L`q_{s3}`),
    H("Pointe"), N("kp", "Facteur de portance", "", 1.4, L`k_p`), N("ple", "Pression limite nette équivalente sous la pointe", "MPa", 2.5, L`p_{le}^*`), N("Q", "Charge ELS quasi permanente appliquée", "kN", 2800, L`Q_{QP}`)],
  calc(I) {
    const A = PI * I.D ** 2 / 4, Qp = I.kp * I.ple * 1000 * A, Qs = PI * I.D * (I.q1 * I.h1 + I.q2 * I.h2 + I.q3 * I.h3), Qu = Qp + Qs, Qc = (I.type === "f" ? 0.5 : 0.7) * Qp + 0.7 * Qs;
    return { steps: [S("A", L`A_p`, L`\dfrac{\pi D^2}{4}`, A, "m²", 3), R("Qp", L`Q_{pu}`, L`k_p\,p_{le}^*\,A_p`, Qp, "kN", 0), R("Qs", L`Q_{su}`, L`\pi D\sum q_{si}\,h_i`, Qs, "kN", 0), S("Qu", L`Q_u`, L`Q_{pu} + Q_{su}`, Qu, "kN", 0),
      S("Qc", L`Q_c`, I.type === "f" ? L`0{,}5\,Q_{pu} + 0{,}7\,Q_{su}` : L`0{,}7\,Q_{pu} + 0{,}7\,Q_{su}`, Qc, "kN", 0), R("ELU", L`Q_{max}^{ELU}`, L`\dfrac{Q_u}{1{,}40}`, Qu / 1.4, "kN", 0), S("ELSr", L`Q_{max}^{ELS,car}`, L`\dfrac{Q_c}{1{,}10}`, Qc / 1.1, "kN", 0),
      R("ELSq", L`Q_{max}^{ELS,QP}`, L`\dfrac{Q_c}{1{,}40}`, Qc / 1.4, "kN", 0), S("Tr", L`Q_{t,max}^{ELU}`, L`\dfrac{Q_{su}}{1{,}40}` + "\\quad\\text{(traction)}", Qs / 1.4, "kN", 0)],
      checks: [C("ELS quasi permanent : $Q \\le Q_c/1{,}40$", I.Q <= Qc / 1.4, `${f2(I.Q, 0)} ≤ ${f2(Qc / 1.4, 0)} kN`, I.Q / (Qc / 1.4))],
      notes: ["$q_s$ et $k_p$ se lisent sur les abaques du Fascicule 62 (annexe C.3) selon la nature du sol, $p_l^*$ et le mode d'exécution. $p_{le}^*$ : moyenne sur $\\pm 1{,}5\\,D$ autour de la pointe (hauteur d'encastrement équivalente $D_e$ pour $k_p$). La NF P94-262 introduit en plus des coefficients de modèle et des corrélations ($\\gamma_{R;d1}$, $\\gamma_{R;d2}$)."] };
  },
  fig(I, g) { return KIT.pileFig({ L: I.h1 + I.h2 + I.h3, layers: [{ h: I.h1, t: `qs = ${f2(I.q1, 0)} kPa` }, { h: I.h2, t: `qs = ${f2(I.q2, 0)} kPa` }, { h: I.h3 + 2, t: `qs = ${f2(I.q3, 0)} · kp = ${f2(I.kp, 2)}` }], Q: `Q = ${f2(I.Q, 0)} kN`, qs: true, qp: true }); },
  clair: (I, g) => `Le pieu porte ${f2(g("Qs"), 0)} kN par frottement et ${f2(g("Qp"), 0)} kN en pointe ; en service permanent on peut lui confier ${f2(g("ELSq"), 0)} kN.` },

{ id: "geo-pieu-lateral", t: "Pieu sous effort horizontal (pieu long, sol de Winkler)", ref: "Fascicule 62 titre V — annexe C.5 ; théorie de la poutre sur appuis élastiques (Hetényi)",
  desc: "Déplacement, rotation et moment maximal en tête d'un pieu long à tête libre sous effort horizontal et moment, sol à module de réaction constant.",
  inputs: [N("H", "Effort horizontal en tête", "kN", 300, "H"), N("M", "Moment en tête", "kN·m", 200, L`M_0`), N("Es", "Module de réaction linéique du sol", "MPa", 20, L`E_s`), N("D", "Diamètre", "m", 1, "D"),
    N("EI", "Rigidité du pieu", "MN·m²", 1500, "EI"), N("Lp", "Longueur du pieu", "m", 18, "L")],
  calc(I) {
    const Es = I.Es * 1000, EI = I.EI * 1000, lam = pow(Es / (4 * EI), 0.25), l0 = 1 / lam, y0 = 2 * I.H * lam / Es + 2 * I.M * lam * lam / Es, th = 2 * I.H * lam * lam / Es + 4 * I.M * lam ** 3 / Es;
    const Mz = z => I.H / lam * exp(-lam * z) * sin(lam * z) + I.M * exp(-lam * z) * (cos(lam * z) + sin(lam * z)); let zm = 0, Mm = 0; for (let i = 0; i <= 300; i++) { const z = 3 * PI / lam * i / 300, v = abs(Mz(z)); if (v > Mm) { Mm = v; zm = z; } }
    return { steps: [R("lam", L`\lambda`, L`\sqrt[4]{\dfrac{E_s}{4\,EI}}`, lam, "m⁻¹", 4), S("l0", L`l_0`, L`\dfrac{1}{\lambda}`, l0, "m", 2), R("y0", L`y_0`, L`\dfrac{2H\lambda}{E_s} + \dfrac{2M_0\lambda^2}{E_s}`, y0 * 1000, "mm", 2), S("th", L`\theta_0`, L`\dfrac{2H\lambda^2}{E_s} + \dfrac{4M_0\lambda^3}{E_s}`, th * 1000, "mrad", 3),
      R("Mm", L`M_{max}`, L`\max_z\left[\dfrac{H}{\lambda}e^{-\lambda z}\sin\lambda z + M_0\,e^{-\lambda z}(\cos\lambda z + \sin\lambda z)\right]`, Mm, "kN·m", 0), S("zm", L`z_{M}`, "", zm, "m", 2), S("K", L`K_H`, L`\dfrac{H}{y_0}\ (M_0 = 0)`, Es / (2 * lam) / 1000, "MN/m", 1)],
      checks: [C("Pieu long : $L \\ge 3\\,l_0$", I.Lp >= 3 * l0, `${f2(I.Lp, 1)} ≥ ${f2(3 * l0, 1)} m`)],
      notes: ["$E_s$ (kPa = kN/m²) : module linéique (réaction par mètre de pieu et par mètre de déplacement), à déduire du module pressiométrique (feuille « Module de réaction (Ménard) »). Loi linéaire : vérifier que la pression mobilisée reste inférieure au palier ($p_f \\cdot D$) ; sinon, calcul non linéaire (Fascicule 62 annexe C.5)."] };
  },
  fig(I, g) { const lam = g("lam"), Mz = z => I.H / lam * exp(-lam * z) * sin(lam * z) + I.M * exp(-lam * z) * (cos(lam * z) + sin(lam * z)), zs = range(0, min(I.Lp, 4 * PI / lam), 80);
    return plot({ series: [{ pts: zs.map(z => [Mz(z), -z]), l: "moment M(z)" }], marks: [{ x: Mz(g("zm")), y: -g("zm"), l: `${f2(g("Mm"), 0)} kN·m à ${f2(g("zm"), 1)} m` }], xl: "kN·m", yl: "profondeur (m)" }); },
  clair: (I, g) => `En tête, le pieu se déplace de ${f2(g("y0"), 1)} mm ; le moment maximal (${f2(g("Mm"), 0)} kN·m) est atteint à ${f2(g("zm"), 1)} m de profondeur.` },

{ id: "geo-frottement-negatif", t: "Frottement négatif sur un pieu", ref: "Fascicule 62 titre V — annexe G.3 (méthode simplifiée) ; NF P94-262 annexe K",
  desc: "Surcharge de frottement négatif développée par une couche compressible qui tasse sous un remblai, autour d'un pieu.",
  inputs: [N("D", "Diamètre du pieu", "m", 1, "D"), N("hc", "Épaisseur de la couche qui tasse", "m", 8, L`h`), N("gp", "Poids volumique déjaugé", "kN/m³", 8, L`\gamma'`), N("dq", "Surcharge du remblai", "kPa", 60, L`\Delta q`),
    N("Kt", "Coefficient K·tan δ", "", 0.20, L`K\tan\delta`)],
  calc(I) { const Gsf = PI * I.D * I.Kt * (I.dq * I.hc + I.gp * I.hc ** 2 / 2), sm = I.dq + I.gp * I.hc / 2;
    return { steps: [S("sm", L`\bar\sigma'_v`, L`\Delta q + \gamma'\,\dfrac{h}{2}`, sm, "kPa", 1), S("fn", L`\bar q_{sn}`, L`K\tan\delta\;\bar\sigma'_v`, I.Kt * sm, "kPa", 1), R("Gsf", L`G_{sf}`, L`\pi D\,K\tan\delta\left(\Delta q\,h + \gamma'\,\dfrac{h^2}{2}\right)`, Gsf, "kN", 0)],
      notes: ["Valeurs usuelles de $K\\tan\\delta$ (Fascicule 62) : 0,10 à 0,15 (argiles molles, pieux forés tubés), 0,15 à 0,20 (argiles fermes), 0,25 à 0,35 (sables, pieux battus). $G_{sf}$ s'ajoute aux charges permanentes ; le frottement positif de la couche n'est plus mobilisable. Méthode simplifiée sans effet d'accrochage (Combarieu)."] };
  },
  fig(I, g) { return KIT.pileFig({ L: I.hc + 6, layers: [{ h: 1.5, t: `remblai Δq = ${f2(I.dq, 0)} kPa` }, { h: I.hc, t: "couche compressible" }, { h: 6, t: "substratum" }], Q: `+ Gsf = ${f2(g("Gsf"), 0)} kN`, qs: false, qp: true, defl: (k, top, cx) => range(1, 6, 5).map(i => `M${cx - 24} ${top + (1.5 + I.hc * i / 6) * k - 7}l0 12M${cx + 24} ${top + (1.5 + I.hc * i / 6) * k - 7}l0 12`).join("") }); },
  clair: (I, g) => `En tassant, l'argile s'accroche au pieu et le tire vers le bas avec ${f2(g("Gsf"), 0)} kN, qui s'ajoutent aux charges de l'ouvrage.` },

{ id: "geo-semelle-pieux", t: "Semelle sur pieux : méthode des bielles", ref: "Méthode des bielles (Blévot) ; Fascicule 62 titre I section I ; NF EN 1992-1-1 §9.8.1",
  desc: "Semelles sur 2, 3 ou 4 pieux sous un poteau centré : inclinaison des bielles, efforts dans les tirants et armatures.",
  inputs: [SEL("n", "Nombre de pieux", [["2", "2 pieux"], ["3", "3 pieux (triangle)"], ["4", "4 pieux (carré)"]], "4", "n"), N("P", "Charge ultime du poteau", "kN", 12000, L`N_{Ed}`), N("l", "Entraxe des pieux", "m", 3, "l"),
    N("b", "Côté du poteau", "m", 1.2, "b"), N("d", "Hauteur utile de la semelle", "m", 1.6, "d"), N("fyk", "Acier", "MPa", 500, L`f_{yk}`)],
  calc(I) {
    const fyd = I.fyk / 1.15, n = +I.n; let Ft, txt, th;
    if (n === 2) { const a = I.l / 2 - I.b / 4; Ft = I.P / 2 * a / I.d; th = Math.atan(I.d / a); txt = L`\dfrac{N_{Ed}\,(2l - b)}{8\,d}`; }
    else if (n === 3) { const a = I.l / sqrt(3) - 0.3 * I.b, Fr = I.P / 3 * a / I.d; Ft = Fr / sqrt(3); th = Math.atan(I.d / a); txt = L`\dfrac{N_{Ed}}{3\sqrt{3}}\,\dfrac{l\sqrt{3}/3 - 0{,}3\,b}{d}` + "\\quad\\text{(par côté)}"; }
    else { const a = sqrt(2) / 4 * (2 * I.l - I.b); Ft = I.P * (2 * I.l - I.b) / (16 * I.d); th = Math.atan(I.d / a); txt = L`\dfrac{N_{Ed}\,(2l - b)}{16\,d}` + "\\quad\\text{(par côté)}"; }
    const As = Ft / 1000 / fyd * 1e4, thd = th * 180 / PI;
    return { steps: [S("th", L`\theta`, "~inclinaison des bielles sur l'horizontale", thd, "°", 1), R("Ft", L`F_t`, txt, Ft, "kN", 0), R("As", L`A_s`, L`\dfrac{F_t}{f_{yd}}`, As, "cm²", 1), S("Rp", L`R_{pieu}`, L`\dfrac{N_{Ed}}{n}`, I.P / n, "kN", 0)],
      checks: [C("Bielles : $40° \\le \\theta \\le 55°$ (domaine de validité de Blévot)", thd >= 40 && thd <= 55, `${f2(thd, 1)}°`)],
      notes: ["Armatures concentrées sur les pieux (bandes de largeur ≈ diamètre du pieu), ancrées au-delà de l'axe des pieux. Vérifier en plus la compression des bielles au droit du poteau et des pieux, et prévoir un quadrillage général (≥ 10 % des tirants). Poids propre de la semelle à ajouter à $N_{Ed}$."] };
  },
  fig(I, g) {
    const W = 330, Hh = 170, n = +I.n, cx = 120, cy = 90, s = 70; let b = "";
    const pts = n === 2 ? [[-s, 0], [s, 0]] : n === 3 ? [[0, -s / 1.2], [-s, s * 0.6], [s, s * 0.6]] : [[-s, -s], [s, -s], [-s, s], [s, s]].map(([x, y]) => [x * 0.75, y * 0.75]);
    b += P(`M${pts.map(p => (cx + p[0]) + " " + (cy + p[1])).join("L")}${n === 4 ? "" : "Z"}`, { c: "none" });
    const hull = n === 4 ? [pts[0], pts[1], pts[3], pts[2]] : pts; b += P(`M${hull.map(p => (cx + p[0]) + " " + (cy + p[1])).join("L")}Z`, { c: K.red, w: 3 });
    pts.forEach(p => { b += Ci(cx + p[0], cy + p[1], 13, { f: K.conc, c: K.ink }) + P(`M${cx} ${cy}L${cx + p[0]} ${cy + p[1]}`, { c: K.blue, w: 4, op: .35 }); });
    b += Rc(cx - 14, cy - 14, 28, 28, { f: K.concD, c: K.ink }) + T(230, 60, `Ft = ${f2(g("Ft"), 0)} kN`, { s: 10, c: K.red, w: 500 }) + T(230, 78, `As = ${f2(g("As"), 1)} cm²`, { s: 10, c: K.red }) + T(230, 96, `θ = ${f2(g("th"), 1)}°`, { s: 10, c: K.blue });
    return svg(W, Hh, b);
  },
  clair: (I, g) => `La charge du poteau descend vers chaque pieu par une bielle inclinée à ${f2(g("th"), 0)}° ; les tirants entre têtes de pieux reprennent ${f2(g("Ft"), 0)} kN chacun (${f2(g("As"), 0)} cm²).` },

{ id: "geo-groupe-repartition", t: "Groupe de pieux : répartition des charges", ref: "Répartition rigide (semelle infiniment rigide, pieux identiques articulés)",
  desc: "Effort normal dans chaque pieu d'un groupe rectangulaire sous effort normal et moments dans les deux directions.",
  inputs: [N("nx", "Nombre de files selon x", "U", 3, L`n_x`), N("ny", "Nombre de files selon y", "U", 2, L`n_y`), N("sx", "Entraxe selon x", "m", 3, L`s_x`), N("sy", "Entraxe selon y", "m", 3, L`s_y`),
    N("N", "Effort normal (avec poids de la semelle)", "kN", 18000, "N"), N("Mx", "Moment autour de y (selon x)", "kN·m", 9000, L`M_x`), N("My", "Moment autour de x (selon y)", "kN·m", 3000, L`M_y`)],
  calc(I) {
    const nx = max(1, Math.round(I.nx)), ny = max(1, Math.round(I.ny)), n = nx * ny, xs = range(-(nx - 1) / 2, (nx - 1) / 2, max(nx - 1, 1)).map(v => v * I.sx).slice(0, nx), ys = range(-(ny - 1) / 2, (ny - 1) / 2, max(ny - 1, 1)).map(v => v * I.sy).slice(0, ny);
    const Sx = ny * xs.reduce((a, x) => a + x * x, 0), Sy = nx * ys.reduce((a, y) => a + y * y, 0), Ni = (x, y) => I.N / n + (Sx ? I.Mx * x / Sx : 0) + (Sy ? I.My * y / Sy : 0);
    const all = xs.flatMap(x => ys.map(y => Ni(x, y))), Nmax = max(...all), Nmin = min(...all);
    return { steps: [S("n", "n", L`n_x\,n_y`, n, "pieux", 0), S("Sx", L`\sum x_i^2`, "", Sx, "m²", 2), S("Sy", L`\sum y_i^2`, "", Sy, "m²", 2), S("N0", L`N/n`, "", I.N / n, "kN", 0),
      R("Nmax", L`N_{max}`, L`\dfrac{N}{n} + \dfrac{M_x\,x_{max}}{\sum x_i^2} + \dfrac{M_y\,y_{max}}{\sum y_i^2}`, Nmax, "kN", 0), R("Nmin", L`N_{min}`, "", Nmin, "kN", 0)],
      checks: [C("Pas de pieu en traction : $N_{min} \\ge 0$", Nmin >= 0, `${f2(Nmin, 0)} kN`)],
      vals: { all, xs, ys },
      notes: ["Semelle rigide, pieux de même raideur, sans effet de groupe sur la raideur. Les efforts horizontaux se répartissent par moitié égale (pieux identiques) ; l'encastrement des têtes modifie les moments (voir « Pieu sous effort horizontal »)."] };
  },
  fig(I, g, r) {
    const W = 330, Hh = 180, { xs, ys, all } = r.vals, k = min(220 / ((xs.at(-1) - xs[0]) || 1), 100 / ((ys.at(-1) - ys[0]) || 1), 40), cx = 165, cy = 85; let s = Rc(cx + xs[0] * k - 24, cy + ys[0] * k - 24, (xs.at(-1) - xs[0]) * k + 48, (ys.at(-1) - ys[0]) * k + 48, { f: "#f1eee8" });
    const nmax = max(...all.map(abs)); let i = 0; xs.forEach(x => ys.forEach(y => { const v = all[i++]; s += Ci(cx + x * k, cy + y * k, 11, { f: v < 0 ? K.redL : v >= nmax * 0.999 ? K.goldL : K.conc, c: K.ink }) + T(cx + x * k, cy + y * k + 22, f2(v, 0), { a: "middle", s: 8.5, w: 500 }); }));
    s += arrow(12, 12, 40, 12, K.ink, 1.2) + T(44, 15, "x", { s: 9 }) + T(W - 8, Hh - 4, "efforts dans les pieux (kN)", { a: "end", s: 9, c: K.mute });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le pieu le plus chargé reçoit ${f2(g("Nmax"), 0)} kN et le moins chargé ${f2(g("Nmin"), 0)} kN${g("Nmin") < 0 ? " : il est arraché, à justifier en traction" : ""}.` },

{ id: "geo-talus", t: "Stabilité d'une pente infinie", ref: "Méthode de la pente infinie (glissement plan parallèle à la surface) ; NF EN 1997-1 §11",
  desc: "Coefficient de sécurité d'un talus vis-à-vis d'un glissement plan peu profond, sec ou avec écoulement parallèle à la pente.",
  inputs: [N("beta", "Pente du talus", "°", 21.8, L`\beta`), N("z", "Profondeur du plan de glissement", "m", 2, "z"), N("g", "Poids volumique", "kN/m³", 20, L`\gamma`), N("phi", "Angle de frottement effectif", "°", 32, L`\varphi'`),
    N("c", "Cohésion effective", "kPa", 5, L`c'`), N("m", "Hauteur relative de la nappe (0 sec, 1 en surface)", "", 0.2, "m"), N("gw", "Poids volumique de l'eau", "kN/m³", 10, L`\gamma_w`)],
  calc(I) {
    const b = rad(I.beta), u = I.m * I.gw * I.z * cos(b) ** 2, sn = I.g * I.z * cos(b) ** 2, tau = I.g * I.z * sin(b) * cos(b), F = (I.c + (sn - u) * tan(rad(I.phi))) / tau;
    return { steps: [S("tau", L`\tau`, L`\gamma z\sin\beta\cos\beta`, tau, "kPa", 1), S("sn", L`\sigma_n`, L`\gamma z\cos^2\beta`, sn, "kPa", 1), S("u", "u", L`m\,\gamma_w z\cos^2\beta`, u, "kPa", 1),
      R("F", "F", L`\dfrac{c' + (\sigma_n - u)\tan\varphi'}{\tau}`, F, "", 3), S("F0", L`F_{sec,c=0}`, L`\dfrac{\tan\varphi'}{\tan\beta}`, tan(rad(I.phi)) / tan(b), "", 3)],
      checks: [C("$F \\ge 1{,}5$ (talus permanent, valeur usuelle)", F >= 1.5, f2(F, 2), 1.5 / F)],
      notes: ["Pente 3/2 ≈ 33,7°, 2/1 ≈ 26,6°. L'EC7 (approche 3 en France pour la stabilité générale) applique des coefficients partiels sur $\\tan\\varphi'$ et $c'$ (1,25) : équivalent à $F \\ge 1{,}25$ sur les paramètres. Les glissements profonds (circulaires) se traitent par Bishop ou Fellenius."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, b = rad(I.beta), x0 = 30, y0 = 140, L_ = 270, y1 = y0 - L_ * tan(b) * 0.6; let s = P(`M${x0} ${y0}L${x0 + L_} ${y1}V${y0}Z`, { c: K.soilD, f: K.soil, op: .5 });
    const d = 26; s += P(`M${x0 + 30} ${y0 - 30 * tan(b) * 0.6 + d}L${x0 + L_ - 20} ${y1 + 20 * tan(b) * 0.6 + d}`, { c: K.red, w: 1.6, dash: "6 3" });
    if (I.m > 0) s += P(`M${x0 + 30} ${y0 - 30 * tan(b) * 0.6 + d * (1 - I.m)}L${x0 + L_ - 20} ${y1 + 20 * tan(b) * 0.6 + d * (1 - I.m)}`, { c: K.blue, w: 1.2, dash: "4 3" });
    s += T(x0 + 160, y0 - 6, `β = ${f2(I.beta, 1)}°`, { s: 9.5 }) + T(W - 8, 20, `F = ${f2(g("F"), 2)}`, { a: "end", s: 12, w: 500, c: g("F") >= 1.5 ? K.teal : K.red });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le talus résiste ${f2(g("F"), 2)} fois à un glissement à ${f2(I.z, 1)} m de profondeur ; l'eau ${I.m > 0 ? "réduit nettement cette marge" : "absente, laisse la pleine résistance"}.` },

{ id: "geo-kmenard", t: "Modules de réaction (Ménard)", ref: "Formules de Ménard ; Fascicule 62 titre V annexe C.5 (pieux), annexe F (fondations superficielles)",
  desc: "Coefficient de réaction vertical d'une semelle et module de réaction latérale d'un pieu à partir du module pressiométrique.",
  inputs: [N("EM", "Module pressiométrique", "MPa", 12, L`E_M`), SEL("alpha", "Coefficient rhéologique", ALPHA, "1/2", L`\alpha`), N("B", "Largeur de la semelle", "m", 3, "B"), N("Lf", "Longueur de la semelle", "m", 6, "L"), N("D", "Diamètre du pieu", "m", 1.0, "D")],
  calc(I) {
    const a = frac(I.alpha), [lc, ld] = lamb(I.Lf / I.B, false), B0 = 0.6, inv = a * lc * I.B / (9 * I.EM) + 2 * B0 * pow(ld * I.B / B0, a) / (9 * I.EM), kv = 1 / inv;
    const Es = I.D >= B0 ? 12 * I.EM / (4 / 3 * (B0 / I.D) * pow(2.65 * I.D / B0, a) + 3 * a) : 12 * I.EM / (4 / 3 * pow(2.65, a) + 3 * a);
    return { steps: [S("lam", L`\lambda_c\ ;\ \lambda_d`, "", `${f2(lc, 2)} ; ${f2(ld, 2)}`, "", 0), R("kv", L`k_v`, L`\left[\dfrac{\alpha\lambda_c B}{9 E_M} + \dfrac{2 B_0}{9 E_M}\left(\lambda_d\dfrac{B}{B_0}\right)^{\alpha}\right]^{-1}`, kv, "MN/m³", 2),
      R("Es", L`E_s`, I.D >= B0 ? L`\dfrac{12\,E_M}{\tfrac{4}{3}\,\tfrac{B_0}{D}\left(2{,}65\,\tfrac{D}{B_0}\right)^{\alpha} + 3\alpha}` : L`\dfrac{12\,E_M}{\tfrac{4}{3}(2{,}65)^{\alpha} + 3\alpha}`, Es, "MPa", 2), S("kh", L`k_h`, L`\dfrac{E_s}{D}`, Es / I.D, "MN/m³", 2)],
      notes: ["$B_0 = 0{,}60$ m. $E_s$ est le module linéique à court terme ; sous charges de longue durée, le Fascicule 62 le divise par 2 ; sous sollicitations sismiques ou très rapides, il peut être multiplié par 2 à 3 (AFPS, feuille « Barrettes : raideur sismique »)."] };
  },
  fig(I, g) { const a = frac(I.alpha), Ds = range(0.3, 3, 40); return plot({ series: [{ pts: Ds.map(D => [D, D >= 0.6 ? 12 * I.EM / (4 / 3 * (0.6 / D) * pow(2.65 * D / 0.6, a) + 3 * a) : 12 * I.EM / (4 / 3 * pow(2.65, a) + 3 * a)]), l: "Es selon le diamètre" }], marks: [{ x: I.D, y: g("Es"), l: `Es = ${f2(g("Es"), 1)} MPa` }], xl: "diamètre D (m)", yl: "Es (MPa)", ymin: 0 }); },
  clair: (I, g) => `Le sol réagit comme un ressort de ${f2(g("kv"), 1)} MN/m³ sous la semelle, et de ${f2(g("Es"), 1)} MPa (module linéique) le long d'un pieu de ${f2(I.D, 2)} m.` },

{ id: "geo-boussinesq", t: "Diffusion des contraintes sous une surface rectangulaire", ref: "Solution de Boussinesq intégrée (Steinbrenner, Newmark) ; méthode approchée 2 pour 1",
  desc: "Supplément de contrainte verticale sous le centre et sous l'angle d'une surface rectangulaire uniformément chargée, comparé à la diffusion 2/1.",
  inputs: [N("q", "Pression appliquée", "kPa", 200, "q"), N("B", "Largeur", "m", 4, "B"), N("Lf", "Longueur", "m", 8, "L"), N("z", "Profondeur", "m", 4, "z")],
  calc(I) {
    const corner = (b, l, z) => { const m = b / z, n = l / z, m2 = m * m, n2 = n * n, r = sqrt(m2 + n2 + 1); let at = Math.atan2(2 * m * n * r, m2 + n2 + 1 - m2 * n2); if (at < 0) at += PI; return 1 / (4 * PI) * (2 * m * n * r / (m2 + n2 + m2 * n2 + 1) * (m2 + n2 + 2) / (m2 + n2 + 1) + at); };
    const Ic = 4 * corner(I.B / 2, I.Lf / 2, I.z), Ia = corner(I.B, I.Lf, I.z), d21 = I.q * I.B * I.Lf / ((I.B + I.z) * (I.Lf + I.z));
    return { steps: [S("Ic", L`I_{centre}`, L`4\,I_{angle}\!\left(\tfrac{B}{2}, \tfrac{L}{2}, z\right)`, Ic, "", 4), R("sc", L`\Delta\sigma_{z,centre}`, L`I_{centre}\,q`, Ic * I.q, "kPa", 1), S("Ia", L`I_{angle}`, L`\dfrac{1}{4\pi}\left[\dfrac{2mn\sqrt{m^2 + n^2 + 1}}{m^2 + n^2 + m^2n^2 + 1}\cdot\dfrac{m^2 + n^2 + 2}{m^2 + n^2 + 1} + \arctan\dfrac{2mn\sqrt{m^2+n^2+1}}{m^2+n^2+1-m^2n^2}\right]`, Ia, "", 4),
      S("sa", L`\Delta\sigma_{z,angle}`, L`I_{angle}\,q`, Ia * I.q, "kPa", 1), R("s21", L`\Delta\sigma_{2/1}`, L`\dfrac{q\,B\,L}{(B + z)(L + z)}`, d21, "kPa", 1)],
      notes: ["$m = B/z$, $n = L/z$ (angle) ; sol élastique homogène semi-infini. La méthode 2/1 donne une valeur moyenne sur la surface diffusée, voisine de la contrainte sous le centre à grande profondeur. Point quelconque : superposition de rectangles (méthode des angles)."] };
  },
  fig(I, g) {
    const corner = (b, l, z) => { const m = b / z, n = l / z, m2 = m * m, n2 = n * n, r = sqrt(m2 + n2 + 1); let at = Math.atan2(2 * m * n * r, m2 + n2 + 1 - m2 * n2); if (at < 0) at += PI; return 1 / (4 * PI) * (2 * m * n * r / (m2 + n2 + m2 * n2 + 1) * (m2 + n2 + 2) / (m2 + n2 + 1) + at); };
    const zs = range(0.1, max(3 * I.B, I.z * 1.5), 60);
    return plot({ series: [{ pts: zs.map(z => [4 * corner(I.B / 2, I.Lf / 2, z) * I.q, -z]), l: "Boussinesq (centre)" }, { pts: zs.map(z => [I.q * I.B * I.Lf / ((I.B + z) * (I.Lf + z)), -z]), l: "diffusion 2/1", c: K.blue, w: 1.4, dash: "5 3" }, { pts: zs.map(z => [corner(I.B, I.Lf, z) * I.q, -z]), l: "angle", c: K.teal, w: 1.2 }], marks: [{ x: g("sc"), y: -I.z, l: `${f2(g("sc"), 0)} kPa` }], xl: "Δσz (kPa)", yl: "profondeur (m)", xmin: 0 });
  },
  clair: (I, g) => `À ${f2(I.z, 1)} m sous le centre, il ne reste que ${f2(g("sc"), 0)} kPa des ${f2(I.q, 0)} kPa appliqués (${f2(g("Ic") * 100, 0)} %) : la charge s'est étalée.` },

{ id: "geo-ple-equivalent", t: "Pression limite équivalente et encastrement équivalent", ref: "Fascicule 62 titre V — annexes C.3 et F.2 ; NF P94-261 §D.2",
  desc: "Pression limite nette équivalente (moyenne géométrique) sous une semelle et hauteur d'encastrement équivalente à partir d'un sondage pressiométrique.",
  inputs: [N("D", "Profondeur de la base", "m", 2, "D"), N("B", "Largeur", "m", 3, "B"), H("Sondage (profondeur, pl*)"),
    N("z1", "Essai 1 : profondeur", "m", 1, L`z_1`), N("p1", "Essai 1 : pl*", "MPa", 0.6, L`p^*_{l1}`), N("z2", "Essai 2", "m", 2, L`z_2`), N("p2", "Essai 2 : pl*", "MPa", 0.9, L`p^*_{l2}`),
    N("z3", "Essai 3", "m", 3, L`z_3`), N("p3", "Essai 3 : pl*", "MPa", 1.2, L`p^*_{l3}`), N("z4", "Essai 4", "m", 4.5, L`z_4`), N("p4", "Essai 4 : pl*", "MPa", 1.5, L`p^*_{l4}`), N("z5", "Essai 5", "m", 6.5, L`z_5`), N("p5", "Essai 5 : pl*", "MPa", 1.8, L`p^*_{l5}`)],
  calc(I) {
    const pts = [1, 2, 3, 4, 5].map(i => [I["z" + i], I["p" + i]]).sort((a, b) => a[0] - b[0]), pl = z => { if (z <= pts[0][0]) return pts[0][1]; for (let i = 0; i < pts.length - 1; i++) if (z <= pts[i + 1][0]) return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * (z - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return pts.at(-1)[1]; };
    const z1 = I.D, z2 = I.D + 1.5 * I.B, n = 60; let lg = 0; for (let i = 0; i < n; i++) lg += Math.log(pl(z1 + (i + 0.5) * (z2 - z1) / n)); const ple = exp(lg / n);
    let ia = 0; for (let i = 0; i < n; i++) ia += pl((i + 0.5) * I.D / n) * I.D / n; const De = ia / ple;
    return { steps: [S("zone", "", L`[D\ ;\ D + 1{,}5\,B]`, `${f2(z1, 2)} à ${f2(z2, 2)} m`, "", 0), R("ple", L`p_{le}^*`, L`\exp\left(\dfrac{1}{1{,}5B}\int_D^{D+1{,}5B}\ln p_l^*(z)\,dz\right)`, ple, "MPa", 3), R("De", L`D_e`, L`\dfrac{1}{p_{le}^*}\int_0^{D} p_l^*(z)\,dz`, De, "m", 2), S("ratio", L`D_e/B`, "", De / I.B, "", 3)],
      notes: ["Interpolation linéaire entre les essais (un essai par mètre est recommandé). Pour un pieu, $p_{le}^*$ est la moyenne sur $[D - b ; D + 3a]$ avec $a = \\max(B/2 ; 0{,}5\\ \\text{m})$ et $b = \\min(a ; h)$, $h$ étant l'ancrage dans la couche porteuse (Fascicule 62 annexe C.3)."] };
  },
  fig(I, g) { const pts = [1, 2, 3, 4, 5].map(i => [I["p" + i], -I["z" + i]]).sort((a, b) => b[1] - a[1]); return plot({ series: [{ pts, l: "pl* (sondage)" }], hlines: [{ y: -I.D, l: "base", c: K.ink }, { y: -(I.D + 1.5 * I.B), l: "D + 1,5 B", c: K.mute }], marks: [{ x: g("ple"), y: -(I.D + 0.75 * I.B), l: `ple* = ${f2(g("ple"), 2)} MPa` }], xl: "pl* (MPa)", yl: "profondeur (m)", xmin: 0 }); },
  clair: (I, g) => `Sous la semelle, le sol équivaut à une pression limite de ${f2(g("ple"), 2)} MPa ; l'encastrement « utile » vaut ${f2(g("De"), 2)} m.` },

{ id: "geo-tirant", t: "Tirant d'ancrage scellé : résistance à l'arrachement", ref: "Méthode de Bustamante (recommandations TA 95) ; NF EN 1537 ; NF P94-282 §(ancrages)",
  desc: "Résistance limite à l'arrachement du scellement d'un tirant précontraint (IGU ou IRS) à partir du frottement latéral unitaire.",
  inputs: [N("Dd", "Diamètre du forage", "m", 0.15, L`D_d`), SEL("alpha", "Coefficient d'expansion (injection)", [["1.1", "Injection gravitaire IGU, argile (1,1)"], ["1.2", "IGU, sable (1,2)"], ["1.4", "Injection répétitive IRS, sable (1,4)"], ["1.6", "IRS, grave (1,6)"], ["1.8", "IRS, argile (1,8)"]], "1.4", L`\alpha`),
    N("Ls", "Longueur scellée", "m", 8, L`L_s`), N("qs", "Frottement latéral unitaire limite", "kPa", 250, L`q_s`), N("gR", "Coefficient de sécurité sur l'arrachement", "", 1.4, L`\gamma_R`), N("T", "Effort de calcul dans le tirant", "kN", 600, L`T_d`)],
  calc(I) { const Ds = +I.alpha * I.Dd, Tu = PI * Ds * I.Ls * I.qs, Td = Tu / I.gR;
    return { steps: [S("Ds", L`D_s`, L`\alpha\,D_d`, Ds, "m", 3), R("Tu", L`T_u`, L`\pi\,D_s\,L_s\,q_s`, Tu, "kN", 0), R("Td", L`T_{R,d}`, L`\dfrac{T_u}{\gamma_R}`, Td, "kN", 0), S("Lmin", L`L_{s,req}`, L`\dfrac{\gamma_R\,T_d}{\pi D_s q_s}`, I.gR * I.T / (PI * Ds * I.qs), "m", 2)],
      checks: [C("$T_d \\le T_u/\\gamma_R$", I.T <= Td, `${f2(I.T, 0)} ≤ ${f2(Td, 0)} kN`, I.T / Td)],
      notes: ["$q_s$ : abaques de Bustamante selon $p_l$ (ou $N_{SPT}$) et le type d'injection. Le coefficient $\\gamma_R$ et l'effort d'épreuve dépendent de la norme d'exécution (NF EN 1537) et des essais de conformité prévus ; la longueur libre doit dépasser le coin de poussée."] };
  },
  fig(I, g) {
    const W = 330, Hh = 150, ang = 0.35, x0 = 40, y0 = 30, Lf = 120, Lsx = 140; let s = Rc(10, 10, 30, 130, { f: K.concD, c: K.ink }) + Rc(40, 10, 280, 130, { f: K.soil, c: "none", op: .35 });
    const x1 = x0 + Lf * cos(ang), y1 = y0 + Lf * sin(ang), x2 = x1 + Lsx * cos(ang), y2 = y1 + Lsx * sin(ang);
    s += P(`M${x0} ${y0}L${x1} ${y1}`, { c: K.ink, w: 1.6 }) + P(`M${x1} ${y1}L${x2} ${y2}`, { c: K.red, w: 9, op: .7 }) + T((x1 + x2) / 2, (y1 + y2) / 2 + 20, `scellement Ls = ${f2(I.Ls, 1)} m`, { a: "middle", s: 9.5, c: K.red });
    s += T((x0 + x1) / 2, (y0 + y1) / 2 - 8, "longueur libre", { a: "middle", s: 9 }) + T(W - 8, 20, `Tu = ${f2(g("Tu"), 0)} kN`, { a: "end", s: 10, w: 500 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le bulbe scellé de ${f2(I.Ls, 1)} m résiste à ${f2(g("Tu"), 0)} kN d'arrachement ; avec la sécurité retenue, il reprend ${f2(g("Td"), 0)} kN.` },

{ id: "geo-semelle-excentree", t: "Semelle sous charge excentrée : contrainte de référence", ref: "Fascicule 62 titre V — art. B.3 (q'ref = (3 qmax + qmin)/4) ; Meyerhof (B' = B − 2e) ; NF P94-261",
  desc: "Diagramme des contraintes sous une semelle excentrée (trapèze ou triangle) et contraintes de référence selon le Fascicule 62 et Meyerhof.",
  inputs: [N("V", "Charge verticale", "kN/m", 900, "V"), N("M", "Moment (par mètre de semelle filante)", "kN·m/m", 300, "M"), N("B", "Largeur de la semelle", "m", 3.2, "B")],
  calc(I) {
    const e = I.M / I.V, tri = e > I.B / 6, qM = tri ? 2 * I.V / (3 * (I.B / 2 - e)) : I.V / I.B * (1 + 6 * e / I.B), qm = tri ? 0 : I.V / I.B * (1 - 6 * e / I.B), q62 = tri ? qM * 3 / 4 * 1 : (3 * qM + qm) / 4, qMey = I.V / (I.B - 2 * e), bc = tri ? 3 * (I.B / 2 - e) : I.B;
    return { steps: [S("e", "e", L`\dfrac{M}{V}`, e, "m", 3), S("cas", "", "~diagramme", tri ? "triangulaire (e > B/6)" : "trapézoïdal (e ≤ B/6)", "", 0), R("qM", L`q_{max}`, tri ? L`\dfrac{2V}{3\,(B/2 - e)}` : L`\dfrac{V}{B}\left(1 + \dfrac{6e}{B}\right)`, qM, "kPa", 0),
      S("qm", L`q_{min}`, tri ? "~0 (soulèvement partiel)" : L`\dfrac{V}{B}\left(1 - \dfrac{6e}{B}\right)`, qm, "kPa", 0), R("q62", L`q'_{ref}`, L`\dfrac{3\,q_{max} + q_{min}}{4}`, q62, "kPa", 0), R("qMey", L`q_{Meyerhof}`, L`\dfrac{V}{B - 2e}`, qMey, "kPa", 0), S("bc", L`B_c`, "~largeur comprimée", bc, "m", 2)],
      checks: [C("ELS : semelle entièrement comprimée ($e \\le B/6$)", !tri, `e = ${f2(e, 3)} m ; B/6 = ${f2(I.B / 6, 3)} m`), C("ELU : surface comprimée $\\ge$ 10 % de B (soulèvement limité, $e \\le 0{,}45\\,B$)", e <= 0.45 * I.B, `${f2(e, 3)} m`)],
      notes: ["Le Fascicule 62 prend la contrainte au trois quarts de la largeur comprimée ; Meyerhof la répartit uniformément sur la largeur réduite $B' = B - 2e$ (EC7 et NF P94-261). Les deux valeurs se comparent à la contrainte admissible ou à la portance de calcul."] };
  },
  fig(I, g) { return KIT.footingFig({ B: I.B, e: -g("e"), q1: g("qM"), q2: g("qm"), Beff: g("bc"), N: `V = ${f2(I.V, 0)}`, l1: `qmax = ${f2(g("qM"), 0)}`, l2: g("qm") > 0 ? `qmin = ${f2(g("qm"), 0)}` : "" }); },
  clair: (I, g) => `L'excentricité de ${f2(g("e") * 100, 0)} cm fait passer la contrainte de ${f2(I.V / I.B, 0)} kPa (centrée) à ${f2(g("qM"), 0)} kPa sous le bord le plus chargé ; contrainte de référence ${f2(g("q62"), 0)} kPa.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
