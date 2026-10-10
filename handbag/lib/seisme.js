/* ════════════════════════════════════════════════════════════════════
   HandBag — Séisme (NF EN 1998-1, -2, -5 et annexes nationales ; arrêté du 26 octobre 2011 « ponts »)
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt, SPECTRES } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, logRange, gauge, ground } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), rad = d => d * PI / 180, sin = Math.sin, cos = Math.cos, tan = Math.tan;
const ZONES = [["0.4", "Zone 1 — très faible (0,4 m/s²)"], ["0.7", "Zone 2 — faible (0,7)"], ["1.1", "Zone 3 — modérée (1,1)"], ["1.6", "Zone 4 — moyenne (1,6)"], ["3.0", "Zone 5 — forte (3,0)"]];
const IMP = [["1", "Catégorie II (γI = 1,0)"], ["1.2", "Catégorie III (γI = 1,2)"], ["1.4", "Catégorie IV (γI = 1,4)"]];
const SOLS = [["A", "A — rocher"], ["B", "B — sols très denses"], ["C", "C — sols denses ou moyennement denses"], ["D", "D — sols lâches"], ["E", "E — couche alluvionnaire sur rocher"]];
const S5 = { A: 1, B: 1.2, C: 1.15, D: 1.35, E: 1.4 };
function spec(zone, sol) { const P_ = SPECTRES.FR[sol]; return { S: zone === "3.0" ? S5[sol] : P_[0], TB: P_[1], TC: P_[2], TD: P_[3] }; }
const Se = (T, ag, sp, eta = 1) => ag * HB.DSL.seH(T, sp.S, sp.TB, sp.TC, sp.TD, eta);
function Sd(T, ag, sp, q) { const b = 0.2 * ag; if (T < sp.TB) return ag * sp.S * (2 / 3 + T / sp.TB * (2.5 / q - 2 / 3)); if (T < sp.TC) return ag * sp.S * 2.5 / q; if (T < sp.TD) return max(ag * sp.S * 2.5 / q * sp.TC / T, b); return max(ag * sp.S * 2.5 / q * sp.TC * sp.TD / (T * T), b); }
const SITE = [SEL("zone", "Zone de sismicité", ZONES, "1.6", L`a_{gR}`), SEL("imp", "Catégorie d'importance du pont", IMP, "1.2", L`\gamma_I`), SEL("sol", "Classe de sol", SOLS, "C", "")];

HB.add("Séisme", [

{ id: "sis-acceleration", t: "Action sismique d'un pont en France : accélération de calcul", ref: "Décret 2010-1255 (zonage) ; arrêté du 26 octobre 2011 (ponts « à risque normal ») ; NF EN 1998-1/NA",
  desc: "Accélération de référence de la zone, coefficient d'importance, paramètres de sol et plateau du spectre élastique horizontal.",
  inputs: [...SITE, N("xi", "Amortissement", "%", 5, L`\xi`)],
  calc(I) {
    const agR = +I.zone, gI = +I.imp, ag = gI * agR, sp = spec(I.zone, I.sol), eta = max(sqrt(10 / (5 + I.xi)), 0.55);
    return { steps: [S("agR", L`a_{gR}`, "~zone de sismicité", agR, "m/s²", 2), S("gI", L`\gamma_I`, "~catégorie d'importance", gI, "", 2), R("ag", L`a_g`, L`\gamma_I\,a_{gR}`, ag, "m/s²", 3),
      S("S", "S", "~paramètre de sol", sp.S, "", 2), S("T", L`T_B\ ;\ T_C\ ;\ T_D`, "", `${f2(sp.TB, 2)} ; ${f2(sp.TC, 2)} ; ${f2(sp.TD, 2)}`, "s", 0), S("eta", L`\eta`, L`\sqrt{\dfrac{10}{5 + \xi}} \ge 0{,}55`, eta, "", 3),
      R("pl", L`S_{e,max}`, L`2{,}5\,\eta\,a_g\,S`, 2.5 * eta * ag * sp.S, "m/s²", 3), S("pg", L`S_{e,max}/g`, "", 2.5 * eta * ag * sp.S / 9.81, "g", 3)],
      notes: ["Catégories d'importance des ponts (arrêté 2011) : II — ponts n'appartenant pas aux autres catégories ; III — ponts des itinéraires à grande circulation, autoroutes, voies rapides… ; IV — ponts stratégiques désignés pour la défense, la sécurité civile et les liaisons essentielles. Les ponts de catégorie II en zones 1 et 2 ne sont pas soumis aux règles parasismiques (vérifier l'arrêté en vigueur)."] };
  },
  fig(I, g) { const sp = spec(I.zone, I.sol), ag = g("ag"), eta = g("eta"), Ts = range(0, 4, 160); return plot({ series: [{ pts: Ts.map(t => [t, Se(t, ag, sp, eta)]), l: "spectre élastique horizontal Se(T)" }], vlines: [{ x: sp.TB, l: "TB" }, { x: sp.TC, l: "TC" }, { x: sp.TD, l: "TD" }], marks: [{ x: (sp.TB + sp.TC) / 2, y: g("pl"), l: `${f2(g("pl"), 2)} m/s²` }], xl: "période T (s)", yl: "m/s²", ymin: 0 }); },
  clair: (I, g) => `Pour ce pont, le sol est secoué à ${f2(g("ag"), 2)} m/s² (rocher) ; une structure de période courte subit jusqu'à ${f2(g("pg"), 2)} g.` },

{ id: "sis-monomodal", t: "Méthode du mode fondamental (pile + appareils d'appui)", ref: "NF EN 1998-2 — §4.2.2 (mode fondamental), §2.3.6.3 (déplacements) ; NF EN 1998-1 §3.2.2.5",
  desc: "Période fondamentale d'un tablier sur appuis souples, effort sismique de calcul et déplacement du tablier.",
  inputs: [...SITE, N("M", "Masse sismique (tablier + 1/2 piles + part du trafic)", "t", 2400, "M"), N("Kp", "Raideur totale des piles (sens étudié)", "MN/m", 300, L`K_{piles}`), N("Ka", "Raideur totale des appareils d'appui", "MN/m", 60, L`K_{aa}`),
    N("q", "Coefficient de comportement", "", 1.5, "q")],
  calc(I) {
    const ag = +I.imp * +I.zone, sp = spec(I.zone, I.sol), Kt = 1 / (1 / I.Kp + 1 / I.Ka), T_ = 2 * PI * sqrt(I.M / (Kt * 1000)), sd = Sd(T_, ag, sp, I.q), F = I.M * sd, se = Se(T_, ag, sp, 1);
    const dEe = I.M * se / (Kt * 1000) * 1000, T0 = 1.25 * sp.TC, mud = T_ >= T0 ? I.q : min((I.q - 1) * T0 / T_ + 1, 5 * I.q - 4), dE = mud * dEe / I.q;
    return { steps: [S("Kt", L`K`, L`\left(\dfrac{1}{K_{piles}} + \dfrac{1}{K_{aa}}\right)^{-1}`, Kt, "MN/m", 2), R("T", "T", L`2\pi\sqrt{\dfrac{M}{K}}`, T_, "s", 3), S("Sd", L`S_d(T)`, "~spectre de calcul (§3.2.2.5)", sd, "m/s²", 3),
      R("F", "F", L`M\,S_d(T)`, F, "kN", 0), S("dEe", L`d_{Ee}`, L`\dfrac{M\,S_e(T)}{K}`, dEe, "mm", 1), S("mud", L`\mu_d`, T_ >= T0 ? L`q\ \ (T \ge 1{,}25\,T_C)` : L`(q - 1)\dfrac{1{,}25\,T_C}{T} + 1`, mud, "", 3),
      R("dE", L`d_E`, L`\mu_d\,\dfrac{d_{Ee}}{q}` + "\\quad(\\eta = 1)", dE, "mm", 1), S("Fa", L`F_{aa}`, "~effort transmis (égal en série)", F, "kN", 0)],
      notes: ["Tablier rigide, masses concentrées ; la méthode est admise si la masse effective du mode dépasse 70 % (§4.2.2.1). Pour des appareils en élastomère, utiliser $G$ dynamique ; $q = 1$ si les appareils en élastomère reprennent seuls l'effort (isolation, §4.1.6 (11)). L'effort se répartit entre les appuis au prorata de leurs raideurs (« Répartition des efforts horizontaux »)."] };
  },
  fig(I, g) { const sp = spec(I.zone, I.sol), ag = +I.imp * +I.zone, Ts = range(0.02, 4, 160); return plot({ series: [{ pts: Ts.map(t => [t, Se(t, ag, sp, 1)]), l: "élastique Se", c: K.mute, w: 1.2, dash: "4 3" }, { pts: Ts.map(t => [t, Sd(t, ag, sp, I.q)]), l: `calcul Sd (q = ${f2(I.q, 1)})` }], marks: [{ x: g("T"), y: g("Sd"), l: `T = ${f2(g("T"), 2)} s` }], xl: "période T (s)", yl: "m/s²", ymin: 0 }); },
  clair: (I, g) => `L'ouvrage oscille avec une période de ${f2(g("T"), 2)} s ; le séisme le pousse latéralement de ${f2(g("F"), 0)} kN et le tablier se déplace de ${f2(g("dE"), 0)} mm.` },

{ id: "sis-q", t: "Coefficient de comportement d'une pile de pont", ref: "NF EN 1998-2 — §4.1.6, tableau 4.1, (4.4) ; AN française",
  desc: "Coefficient de comportement d'une pile en béton armé selon son élancement mécanique et l'effort normal réduit.",
  inputs: [SEL("duct", "Comportement", [["d", "Ductile"], ["l", "Ductilité limitée"]], "d", ""), N("Ls", "Distance de la rotule au point de moment nul", "m", 12, L`L_s`), N("h", "Hauteur de la section (sens étudié)", "m", 2.5, "h"),
    N("Ned", "Effort normal sismique", "MN", 12, L`N_{Ed}`), N("Ac", "Aire de la section", "m²", 4.5, L`A_c`), N("fck", "Béton", "MPa", 35, L`f_{ck}`)],
  calc(I) {
    const as = I.Ls / I.h, eta = I.Ned / (I.Ac * I.fck), lam = as >= 3 ? 1 : as >= 1 ? sqrt(as / 3) : 0;
    let q0 = I.duct === "d" ? (as >= 1 ? 3.5 * lam : 1) : 1.5;
    const q = eta <= 0.3 ? q0 : eta >= 0.6 ? 1 : q0 - (eta / 0.3 - 1) * (q0 - 1);
    return { steps: [S("as", L`\alpha_s`, L`\dfrac{L_s}{h}`, as, "", 2), S("lam", L`\lambda(\alpha_s)`, as >= 3 ? L`1\ \ (\alpha_s \ge 3)` : L`\sqrt{\alpha_s/3}`, lam, "", 3), S("q0", L`q_0`, I.duct === "d" ? L`3{,}5\,\lambda(\alpha_s)` : L`1{,}5`, q0, "", 2),
      S("eta", L`\eta_k`, L`\dfrac{N_{Ed}}{A_c\,f_{ck}}`, eta, "", 3), R("q", "q", eta <= 0.3 ? L`q_0\ \ (\eta_k \le 0{,}3)` : L`q_0 - \left(\dfrac{\eta_k}{0{,}3} - 1\right)(q_0 - 1)`, max(1, q), "", 2)],
      notes: ["Piles verticales en flexion (tableau 4.1). $q = 1$ si $\\alpha_s < 1$ (piles courtes : rupture par effort tranchant). En ductilité limitée, $q \\le 1{,}5$ ; le dimensionnement en capacité est alors facultatif. Les culées et les murs rigidement liés au sol se calculent avec $q = 1$."] };
  },
  fig(I, g) { const pts = range(0, 0.7, 70).map(e => { const q0 = g("q0"); return [e, max(1, e <= 0.3 ? q0 : e >= 0.6 ? 1 : q0 - (e / 0.3 - 1) * (q0 - 1))]; }); return plot({ series: [{ pts, l: "q selon l'effort normal réduit ηk" }], marks: [{ x: min(g("eta"), 0.7), y: g("q"), l: `q = ${f2(g("q"), 2)}` }], xl: "ηk = NEd / (Ac fck)", yl: "q", ymin: 0, ymax: 4 }); },
  clair: (I, g) => `Cette pile peut dissiper l'énergie du séisme : on divise les efforts élastiques par ${f2(g("q"), 2)}.` },

{ id: "sis-capacite", t: "Dimensionnement en capacité : surrésistance des rotules", ref: "NF EN 1998-2 — §5.3 (5.1), (5.2) ; §5.6.2 (effort tranchant de capacité)",
  desc: "Moment de surrésistance d'une rotule plastique de pile et effort tranchant de capacité à reprendre par la pile et transmis aux fondations.",
  inputs: [N("MRd", "Moment résistant de la section de rotule", "MN·m", 45, L`M_{Rd}`), N("Ls", "Distance de la rotule au point de moment nul", "m", 12, L`L_s`), N("eta", "Effort normal réduit", "", 0.12, L`\eta_k`),
    SEL("mat", "Matériau", [["1.35", "Béton armé (γ₀ = 1,35)"], ["1.25", "Acier (γ₀ = 1,25)"]], "1.35", L`\gamma_0`), N("VE", "Effort tranchant issu de l'analyse (q appliqué)", "MN", 2.8, L`V_{E}`)],
  calc(I) {
    const g0 = +I.mat, g0e = g0 === 1.35 && I.eta > 0.1 ? 1.35 * (1 + 2 * (I.eta - 0.1) ** 2) : g0, Mo = g0e * I.MRd, VC = Mo / I.Ls;
    return { steps: [R("g0", L`\gamma_0`, g0 === 1.35 && I.eta > 0.1 ? L`1{,}35\left[1 + 2\,(\eta_k - 0{,}1)^2\right]` : L`\gamma_0`, g0e, "", 3), R("Mo", L`M_0`, L`\gamma_0\,M_{Rd}`, Mo, "MN·m", 2), R("VC", L`V_C`, L`\dfrac{M_0}{L_s}`, VC, "MN", 3),
      S("ratio", "", L`\dfrac{V_C}{V_E}`, VC / I.VE, "", 2)],
      notes: ["Les éléments non ductiles (effort tranchant des piles, fondations, appareils d'appui fixes, chevêtres) se dimensionnent pour les effets de capacité, limités aux effets de l'analyse élastique avec $q = 1$ (§5.3 (4)). Pour l'effort tranchant de la pile, la résistance est en outre divisée par $\\gamma_{Bd1}$ (§5.6.3.2)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "MRd", v: I.MRd, u: "MN·m", c: K.mute }, { l: "M0 = γ0 MRd", v: g("Mo"), u: "MN·m", c: K.red }, { l: "VE (analyse)", v: I.VE, u: "MN", c: K.blue, d: 2 }, { l: "VC (capacité)", v: g("VC"), u: "MN", c: K.gold, d: 2 }], { title: `Surrésistance γ0 = ${f2(g("g0"), 3)}`, left: 96 }); },
  clair: (I, g) => `Si la rotule se forme, elle peut développer jusqu'à ${f2(g("Mo"), 1)} MN·m : la pile doit résister à ${f2(g("VC"), 2)} MN d'effort tranchant, ${f2(g("ratio"), 2)} fois l'effort calculé.` },

{ id: "sis-confinement", t: "Confinement des zones de rotule plastique", ref: "NF EN 1998-2 — §6.2.1.4 (6.7), (6.8), (6.10), (6.11)",
  desc: "Taux mécanique d'armatures de confinement requis dans la rotule d'une pile rectangulaire ou circulaire, et section de cadres correspondante.",
  inputs: [SEL("duct", "Comportement", [["d", "Ductile (λ = 0,37 ; ωw,min = 0,18)"], ["l", "Ductilité limitée (λ = 0,28 ; ωw,min = 0,12)"]], "d", ""), SEL("sec", "Section", [["r", "Rectangulaire"], ["c", "Circulaire"]], "r", ""),
    N("Ac", "Aire brute de la section", "m²", 4.5, L`A_c`), N("Acc", "Aire du noyau confiné (à l'axe des cadres)", "m²", 3.9, L`A_{cc}`), N("eta", "Effort normal réduit", "", 0.12, L`\eta_k`), N("rL", "Pourcentage d'armatures longitudinales", "%", 1.5, L`\rho_L`),
    N("fck", "Béton", "MPa", 35, L`f_{ck}`), N("fyk", "Acier", "MPa", 500, L`f_{yk}`), N("b", "Dimension du noyau perpendiculaire aux cadres (ou diamètre Dsp)", "m", 1.7, "b")],
  calc(I) {
    const lam = I.duct === "d" ? 0.37 : 0.28, wmin = I.duct === "d" ? 0.18 : 0.12, fyd = I.fyk / 1.15, fcd = I.fck / 1.5;
    const wreq = I.Ac / I.Acc * lam * I.eta + 0.13 * fyd / fcd * (I.rL / 100 - 0.01), wd = I.sec === "r" ? max(wreq, 2 / 3 * wmin) : max(1.4 * wreq, wmin);
    const rw = I.sec === "r" ? wd * fcd / fyd : wd * fcd / fyd, Asw = I.sec === "r" ? rw * I.b * 1e4 : rw * I.b / 4 * 1e4;
    return { steps: [S("wreq", L`\omega_{w,req}`, L`\dfrac{A_c}{A_{cc}}\,\lambda\,\eta_k + 0{,}13\,\dfrac{f_{yd}}{f_{cd}}\,(\rho_L - 0{,}01)`, wreq, "", 4), R("wd", L`\omega_{wd}`, I.sec === "r" ? L`\max\left(\omega_{w,req}\ ;\ \tfrac{2}{3}\,\omega_{w,min}\right)` : L`\max\left(1{,}4\,\omega_{w,req}\ ;\ \omega_{w,min}\right)`, wd, "", 4),
      S("rw", L`\rho_w`, L`\omega_{wd}\,\dfrac{f_{cd}}{f_{yd}}`, rw * 100, "%", 3), R("Asw", L`\dfrac{A_{sw}}{s_L}`, I.sec === "r" ? L`\rho_w\,b` + "\\quad\\text{(par direction)}" : L`\rho_w\,\dfrac{D_{sp}}{4}` + "\\quad\\text{(spire ou cerce)}", Asw, "cm²/m", 2),
      S("sL", L`s_L`, L`\le \min\left(6\,\varnothing_L\ ;\ \dfrac{b}{5}\right)`, min(0.15, I.b / 5), "m", 3)],
      checks: [C("Confinement requis (ductile) si $\\eta_k > 0{,}08$", true, I.eta > 0.08 ? "requis" : "non requis (minimum constructif)")],
      notes: ["Longueur de la zone confinée : §6.2.1.5 ($L_h \\ge \\max(h ; L_{M=0,8M_{max}})$). Espacement maximal : $\\min(6\\varnothing_L ; b_{min}/5)$ ; cadres et épingles ancrés à 135°. Contre le flambement des barres longitudinales : $A_t/s_T \\ge \\sum A_s f_{ys}/(1{,}6 f_{yt})$ (§6.2.2)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "ωw,req (calcul)", v: g("wreq"), d: 3, c: K.mute }, { l: "minimum", v: I.sec === "r" ? 2 / 3 * (I.duct === "d" ? 0.18 : 0.12) : (I.duct === "d" ? 0.18 : 0.12), d: 3, c: K.blue }, { l: "ωwd retenu", v: g("wd"), d: 3, c: K.red }], { title: `Taux mécanique de confinement → Asw/sL = ${f2(g("Asw"), 1)} cm²/m`, left: 104 }); },
  clair: (I, g) => `Pour que le béton de la rotule tienne sous les grands déplacements, il faut ${f2(g("Asw"), 1)} cm² de cadres par mètre de hauteur (par direction), espacés d'au plus ${f2(g("sL") * 100, 0)} cm.` },

{ id: "sis-longueur-appui", t: "Longueur d'appui minimale aux joints de dilatation", ref: "NF EN 1998-2 — §6.6.4 (6.10) à (6.13), §3.3 (déplacement du sol)",
  desc: "Recouvrement minimal du tablier sur son appui pour éviter l'échappement sous les déplacements relatifs sismiques.",
  inputs: [...SITE, N("lm", "Longueur minimale d'appui de l'appareil", "mm", 400, L`l_m`), N("Leff", "Longueur effective (distance au point fixe voisin)", "m", 100, L`L_{eff}`),
    N("des", "Déplacement sismique relatif tablier / appui", "mm", 120, L`d_{Ed}`)],
  calc(I) {
    const ag = +I.imp * +I.zone, sp = spec(I.zone, I.sol), Lg = { A: 600, B: 500, C: 400, D: 300, E: 500 }[I.sol], dg = 0.025 * ag * sp.S * sp.TC * sp.TD * 1000, es = 2 * dg / (Lg * 1000), deg = min(es * I.Leff * 1000, 2 * dg);
    const lov = I.lm + deg + I.des;
    return { steps: [S("dg", L`d_g`, L`0{,}025\,a_g\,S\,T_C\,T_D`, dg, "mm", 1), S("Lg", L`L_g`, "~tableau 3.1 (classe de sol)", Lg, "m", 0), S("es", L`\varepsilon_s`, L`\dfrac{2\,d_g}{L_g}`, es * 1000, "‰", 4),
      S("deg", L`d_{eg}`, L`\varepsilon_s\,L_{eff} \le 2\,d_g`, deg, "mm", 1), R("lov", L`l_{ov}`, L`l_m + d_{eg} + d_{es}`, lov, "mm", 0)],
      notes: ["$l_m \\ge 400$ mm. $d_{es}$ : déplacement de calcul du tablier par rapport à l'appui (y compris 40 % des effets thermiques, §2.3.6.3). Pour les ponts biais, majorer d'un terme de rotation (§6.6.4 (5)). À défaut de longueur suffisante : butées ou dispositifs anti-chute."] };
  },
  fig(I, g) {
    const W = 330, Hh = 150, k = 200 / g("lov"), x0 = 60, y = 60; let s = Rc(10, y + 14, x0 + g("lov") * k + 30, 70) + Rc(x0, y - 28, 240, 28, { f: "#efe9dc" });
    s += Rc(x0 + 20, y, 40, 14, { f: "#3c3f4d", c: "#3c3f4d", op: .35 }) + dim(x0, x0 + I.lm * k, y + 100, `lm = ${f2(I.lm, 0)}`) + dim(x0 + I.lm * k, x0 + (I.lm + g("deg")) * k, y + 100, "deg") + dim(x0 + (I.lm + g("deg")) * k, x0 + g("lov") * k, y + 100, "des");
    s += T(165, 20, `lov = ${f2(g("lov"), 0)} mm`, { a: "middle", s: 11, w: 500 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Pour que le tablier ne tombe pas de son appui en cas de séisme, il doit y reposer sur au moins ${f2(g("lov") / 10, 0)} cm.` },

{ id: "sis-mononobe", t: "Poussée dynamique des terres (Mononobe-Okabe)", ref: "NF EN 1998-5 — §7.3.2, annexe E (E.4), (E.5), tableau 7.1",
  desc: "Coefficient de poussée sismique et effort total sur un mur de culée ou de soutènement, terre-plein sec.",
  inputs: [...SITE, N("H", "Hauteur du mur", "m", 7, "H"), N("g", "Poids volumique du remblai", "kN/m³", 20, L`\gamma`), N("phi", "Angle de frottement (valeur de calcul)", "°", 30, L`\varphi'_d`), N("d", "Frottement sol–mur", "°", 20, L`\delta_d`),
    SEL("r", "Coefficient r (déplacement admissible)", [["1", "Mur rigide ou culée (r = 1)"], ["1.5", "Mur pouvant se déplacer de 200·α·S mm (1,5)"], ["2", "Mur poids libre, 300·α·S mm (2)"]], "1", "r")],
  calc(I) {
    const ag = +I.imp * +I.zone, sp = spec(I.zone, I.sol), al = ag / 9.81, kh = al * sp.S / +I.r, kv = 0.5 * kh, f = rad(I.phi), d = rad(I.d), psi = PI / 2;
    const KMO = th => { const num = sin(psi + f - th) ** 2, rt = sqrt(max(0, sin(f + d) * sin(f - th) / (sin(psi - th - d) * sin(psi)))); return num / (cos(th) * sin(psi) ** 2 * sin(psi - th - d) * (1 + rt) ** 2); };
    const Kf = s => { const th = Math.atan(kh / (1 + s * kv)); const num = sin(psi + f - th) ** 2, rt = sqrt(max(0, sin(f + d) * sin(f - th) / (sin(psi - th - d) * sin(psi)))); return num / (cos(th) * sin(psi) ** 2 * sin(psi - th - d) * (1 + rt) ** 2); };
    const Kp = Kf(1), Km = Kf(-1), E1 = 0.5 * I.g * (1 + kv) * Kp * I.H ** 2, E2 = 0.5 * I.g * (1 - kv) * Km * I.H ** 2, Ed = max(E1, E2);
    const Ka = KMO(0), Es = 0.5 * I.g * Ka * I.H ** 2;
    return { steps: [S("kh", L`k_h`, L`\dfrac{\alpha\,S}{r},\ \ \alpha = \dfrac{a_g}{g}`, kh, "", 4), S("kv", L`k_v`, L`\pm 0{,}5\,k_h`, kv, "", 4), S("th", L`\theta`, L`\arctan\dfrac{k_h}{1 \mp k_v}`, Math.atan(kh / (1 - kv)) * 180 / PI, "°", 2),
      S("K", L`K_{(+)}\ ;\ K_{(-)}`, "~annexe E (E.4), parement vertical, terre-plein horizontal", `${f2(Kp, 4)} ; ${f2(Km, 4)}`, "", 0), R("Ed", L`E_d`, L`\tfrac{1}{2}\,\gamma\,(1 \pm k_v)\,K\,H^2`, Ed, "kN/m", 1),
      S("Es", L`E_{stat}`, L`\tfrac{1}{2}\,\gamma\,K_a\,H^2\ \ (\text{Coulomb})`, Es, "kN/m", 1), R("dE", L`\Delta E_d`, L`E_d - E_{stat}`, Ed - Es, "kN/m", 1)],
      notes: ["Point d'application : la poussée statique à $H/3$ ; l'incrément dynamique est usuellement placé à $H/2$ (murs rigides). Sol sec ; avec une nappe, utiliser $\\gamma^*$ et l'incrément hydrodynamique (E.7). Pour les culées des ponts, la NF EN 1998-2 §6.7 impose un calcul avec $r = 1$ lorsque la culée est rigidement liée au tablier."] };
  },
  fig(I, g) { return KIT.wallFig({ h: I.H, p: [[0, 0], [I.H, 2 * g("Es") / I.H]], labels: [{ z: I.H, p: 2 * g("Es") / I.H, t: "statique" }], R: { z: I.H / 2, l: `Ed = ${f2(g("Ed"), 0)} kN/m` } }); },
  clair: (I, g) => `Sous séisme, la poussée du remblai passe de ${f2(g("Es"), 0)} à ${f2(g("Ed"), 0)} kN par mètre de mur (+${f2((g("Ed") / g("Es") - 1) * 100, 0)} %).` },

{ id: "sis-liquefaction", t: "Potentiel de liquéfaction d'un sable (méthode simplifiée)", ref: "NF EN 1998-5 — §4.1.4, annexe B ; méthode de Seed et Idriss (courbe NCEER, Youd et al. 2001)",
  desc: "Rapport de contrainte cyclique induit par le séisme, résistance cyclique déduite du SPT et coefficient de sécurité vis-à-vis de la liquéfaction.",
  inputs: [...SITE, N("z", "Profondeur de la couche", "m", 6, "z"), N("hw", "Profondeur de la nappe", "m", 2, L`h_w`), N("g", "Poids volumique", "kN/m³", 19, L`\gamma`), N("N1", "Résistance SPT corrigée (N1)60,cs", "", 20, L`(N_1)_{60,cs}`), N("Mw", "Magnitude de référence", "", 6, L`M_w`)],
  calc(I) {
    const ag = +I.imp * +I.zone, sp = spec(I.zone, I.sol), amax = ag * sp.S, sv = I.g * I.z, u = max(0, I.z - I.hw) * 9.81, svp = sv - u, rd = I.z <= 9.15 ? 1 - 0.00765 * I.z : 1.174 - 0.0267 * I.z;
    const CSR = 0.65 * amax / 9.81 * sv / svp * rd, n = min(I.N1, 29.9), CRR = 1 / (34 - n) + n / 135 + 50 / (10 * n + 45) ** 2 - 1 / 200, MSF = pow(10, 2.24) / pow(I.Mw, 2.56), F = CRR * MSF / CSR;
    return { steps: [S("amax", L`a_{max}`, L`a_g\,S`, amax, "m/s²", 3), S("svp", L`\sigma_v\ ;\ \sigma'_v`, "", `${f2(sv, 0)} ; ${f2(svp, 0)}`, "kPa", 0), S("rd", L`r_d`, I.z <= 9.15 ? L`1 - 0{,}00765\,z` : L`1{,}174 - 0{,}0267\,z`, rd, "", 3),
      R("CSR", "CSR", L`0{,}65\,\dfrac{a_{max}}{g}\,\dfrac{\sigma_v}{\sigma'_v}\,r_d`, CSR, "", 4), S("CRR", L`CRR_{7,5}`, L`\dfrac{1}{34 - N} + \dfrac{N}{135} + \dfrac{50}{(10N + 45)^2} - \dfrac{1}{200}`, CRR, "", 4), S("MSF", "MSF", L`\dfrac{10^{2{,}24}}{M_w^{2{,}56}}`, MSF, "", 3),
      R("F", "F", L`\dfrac{CRR \cdot MSF}{CSR}`, F, "", 2)],
      checks: [C("$F \\ge 1{,}25$ (NF EN 1998-5 §B (4), AN)", F >= 1.25, f2(F, 2), 1.25 / F)],
      notes: ["Le risque peut être négligé si $\\alpha S < 0{,}15$ et que le sable a soit plus de 20 % d'argile, soit plus de 35 % de fines et $N_{60} > 20$, soit $N_{60} > 30$ (§4.1.4 (4)). En France, la magnitude de référence est en général prise à 6,0 (zones 1 à 4) et 7,5 aux Antilles."] };
  },
  fig(I, g) { const Ns = range(3, 29, 50), MSF = g("MSF"); return plot({ series: [{ pts: Ns.map(n => [n, (1 / (34 - n) + n / 135 + 50 / (10 * n + 45) ** 2 - 1 / 200) * MSF]), l: `résistance CRR × MSF (M = ${f2(I.Mw, 1)})` }], hlines: [{ y: g("CSR"), l: `sollicitation CSR = ${f2(g("CSR"), 3)}`, c: K.red }], marks: [{ x: min(I.N1, 29), y: g("CRR") * MSF, l: `F = ${f2(g("F"), 2)}` }], xl: "(N1)60,cs", yl: "rapport de contrainte cyclique", ymin: 0, ymax: 0.6 }); },
  clair: (I, g) => g("F") >= 1.25 ? `Le sable résiste au séisme sans se liquéfier (sécurité ${f2(g("F"), 2)}).` : `Le sable risque de se liquéfier (sécurité ${f2(g("F"), 2)} < 1,25) : densifier le sol ou fonder plus profond.` },

{ id: "sis-westergaard", t: "Masse d'eau entraînée par une pile immergée", ref: "NF EN 1998-2 — annexe F (F.1), tableau F.1",
  desc: "Masse ajoutée d'eau à prendre en compte dans l'analyse sismique d'une pile en rivière ou en mer.",
  inputs: [SEL("sec", "Section", [["c", "Circulaire"], ["r", "Rectangulaire"]], "c", ""), N("ax", "Dimension parallèle au séisme (ou diamètre)", "m", 3, L`2a_x`), N("ay", "Dimension perpendiculaire au séisme", "m", 3, L`2a_y`),
    N("hw", "Hauteur d'eau", "m", 8, L`h_w`), N("mp", "Masse linéique de la pile", "t/m", 17.7, L`m_{pile}`)],
  calc(I) {
    const R_ = I.ax / 2, ay = I.ay / 2, ax = I.ax / 2, tab = [[0.1, 2.23], [0.2, 1.98], [0.5, 1.7], [1, 1.51], [2, 1.36], [5, 1.21], [1e9, 1]], r = ay / ax;
    let k = 1; for (let i = 0; i < tab.length - 1; i++) if (r <= tab[i + 1][0]) { k = tab[i][1] + (tab[i + 1][1] - tab[i][1]) * (r - tab[i][0]) / (tab[i + 1][0] - tab[i][0]); break; } if (r < 0.1) k = 2.23;
    const ma = I.sec === "c" ? PI * R_ * R_ : k * PI * ay * ay;
    return { steps: [...(I.sec === "r" ? [S("k", "k", "~tableau F.1 (selon $a_y/a_x$)", k, "", 3)] : []), R("ma", L`m_a`, I.sec === "c" ? L`\rho\,\pi R^2` : L`k\,\rho\,\pi\,a_y^2`, ma, "t/m", 3), S("Ma", L`M_a`, L`m_a\,h_w`, ma * I.hw, "t", 1),
      S("ratio", "", L`\dfrac{m_a}{m_{pile}}`, ma / I.mp, "", 3)],
      notes: ["$\\rho = 1$ t/m³. Masse ajoutée par unité de longueur sur la hauteur immergée (pile pleine) ; pour une pile creuse remplie d'eau, ajouter la masse d'eau intérieure. Valable pour $h_w/R \\ge 2$ ; en deçà, la masse ajoutée est réduite."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "pile (sur hw)", v: I.mp * I.hw, u: "t", d: 0, c: K.mute }, { l: "eau entraînée", v: g("Ma"), u: "t", d: 0, c: K.blue }], { title: `Masse ajoutée : +${f2(g("ratio") * 100, 0)} % de la masse de la partie immergée`, left: 96 }); },
  clair: (I, g) => `En oscillant, la pile entraîne ${f2(g("Ma"), 0)} t d'eau, soit ${f2(g("ratio") * 100, 0)} % de sa propre masse immergée : sa période s'allonge.` },

{ id: "sis-combinaison", t: "Combinaison des composantes du séisme", ref: "NF EN 1998-2 — §4.2.1.4 (4.20) à (4.22) ; NF EN 1998-1 §4.3.3.5",
  desc: "Effet maximal d'un séisme à trois composantes par la règle des 30 % et par la racine de la somme des carrés.",
  inputs: [N("Ex", "Effet du séisme longitudinal seul", "kN·m", 12000, L`E_x`), N("Ey", "Effet du séisme transversal seul", "kN·m", 8000, L`E_y`), N("Ez", "Effet du séisme vertical seul", "kN·m", 1500, L`E_z`)],
  calc(I) {
    const c1 = I.Ex + 0.3 * I.Ey + 0.3 * I.Ez, c2 = 0.3 * I.Ex + I.Ey + 0.3 * I.Ez, c3 = 0.3 * I.Ex + 0.3 * I.Ey + I.Ez, sr = sqrt(I.Ex ** 2 + I.Ey ** 2 + I.Ez ** 2);
    return { steps: [S("c1", "", L`E_x + 0{,}3\,E_y + 0{,}3\,E_z`, c1, "kN·m", 0), S("c2", "", L`0{,}3\,E_x + E_y + 0{,}3\,E_z`, c2, "kN·m", 0), S("c3", "", L`0{,}3\,E_x + 0{,}3\,E_y + E_z`, c3, "kN·m", 0),
      R("E30", L`E_{30\%}`, "~maximum des trois combinaisons", max(c1, c2, c3), "kN·m", 0), R("Esr", L`E_{SRSS}`, L`\sqrt{E_x^2 + E_y^2 + E_z^2}`, sr, "kN·m", 0)],
      notes: ["La composante verticale n'est à prendre en compte que pour les piles précontraintes, les tabliers en console, les appareils d'appui et les zones à forte sismicité (§4.1.7). Les deux règles sont admises ; la règle des 30 % est un peu plus défavorable dans la plupart des cas."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "Ex", v: I.Ex, u: "", d: 0, c: K.mute }, { l: "Ey", v: I.Ey, u: "", d: 0, c: K.mute }, { l: "Ez", v: I.Ez, u: "", d: 0, c: K.mute }, { l: "règle des 30 %", v: g("E30"), u: "", d: 0, c: K.red }, { l: "SRSS", v: g("Esr"), u: "", d: 0, c: K.blue }], { title: "Effets combinés (kN·m)", left: 92 }); },
  clair: (I, g) => `Le séisme arrive dans toutes les directions à la fois : l'effet de calcul vaut ${f2(g("E30"), 0)} kN·m (règle des 30 %), pour ${f2(I.Ex, 0)} kN·m avec la seule composante longitudinale.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
