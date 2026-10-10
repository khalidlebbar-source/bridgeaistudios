/* ════════════════════════════════════════════════════════════════════
   HandBag — Hydraulique des ouvrages (écoulements, crues, affouillements, nappes)
   Unités : m, s, m³/s, kN.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, logRange, gauge, udl } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), g0 = 9.81, ln = Math.log;
const bis = (f, a, b, n = 80) => { for (let i = 0; i < n; i++) { const m = (a + b) / 2; f(a) * f(m) <= 0 ? b = m : a = m; } return (a + b) / 2; };

HB.add("Hydraulique", [

{ id: "hyd-manning", t: "Écoulement uniforme : hauteur normale (Manning-Strickler)", ref: "Formule de Manning-Strickler ; régime critique (Froude)",
  desc: "Hauteur normale, vitesse, nombre de Froude et hauteur critique dans un canal ou un lit trapézoïdal (ou rectangulaire, m = 0).",
  inputs: [N("Q", "Débit", "m³/s", 120, "Q"), N("b", "Largeur au fond", "m", 15, "b"), N("m", "Fruit des berges (horizontal / vertical)", "", 2, "m"), N("I", "Pente longitudinale", "m/m", 0.001, "I"),
    N("Ks", "Coefficient de Strickler", "m^(1/3)/s", 30, L`K_s`)],
  calc(I) {
    const A = y => (I.b + I.m * y) * y, Pm = y => I.b + 2 * y * sqrt(1 + I.m * I.m), Bw = y => I.b + 2 * I.m * y, Qy = y => I.Ks * A(y) * pow(A(y) / Pm(y), 2 / 3) * sqrt(I.I);
    const yn = bis(y => Qy(y) - I.Q, 1e-3, 50), yc = bis(y => I.Q * I.Q * Bw(y) / (g0 * A(y) ** 3) - 1, 1e-3, 50), V = I.Q / A(yn), Fr = V / sqrt(g0 * A(yn) / Bw(yn));
    return { steps: [R("yn", L`y_n`, L`Q = K_s\,A\,R_h^{2/3}\,I^{1/2}`, yn, "m", 3), S("A", "A", L`(b + m\,y_n)\,y_n`, A(yn), "m²", 2), S("Rh", L`R_h`, L`\dfrac{A}{b + 2y_n\sqrt{1 + m^2}}`, A(yn) / Pm(yn), "m", 3),
      R("V", "V", L`\dfrac{Q}{A}`, V, "m/s", 2), R("Fr", "Fr", L`\dfrac{V}{\sqrt{g\,A/B}}`, Fr, "", 3), S("yc", L`y_c`, L`\dfrac{Q^2 B}{g\,A^3} = 1`, yc, "m", 3), S("reg", "", "~régime", Fr < 1 ? "fluvial (y > yc)" : "torrentiel (y < yc)", "", 0)],
      notes: ["$K_s$ usuels : 60–70 (béton lisse), 40–50 (maçonnerie, enrochement régulier), 30–35 (rivière à lit propre), 20–25 (rivière végétalisée), 10–15 (lit majeur boisé). Pour un lit composé, traiter séparément lit mineur et lits majeurs (méthode Debord)."] };
  },
  fig(I, g) { return KIT.channelFig({ b: I.b, m: I.m, y: g("yn"), hmax: g("yn") * 1.5 }); },
  clair: (I, g) => `Pour ${f2(I.Q, 0)} m³/s, l'eau s'écoule sur ${f2(g("yn"), 2)} m de hauteur à ${f2(g("V"), 2)} m/s, en régime ${g("Fr") < 1 ? "fluvial (calme)" : "torrentiel (rapide)"}.` },

{ id: "hyd-rationnelle", t: "Débit de pointe : méthode rationnelle", ref: "Méthode rationnelle ; formule de Montana ; temps de concentration (Kirpich) ; guides Sétra / Cerema (assainissement routier)",
  desc: "Débit de pointe d'un petit bassin versant (< 1 à 10 km²) pour dimensionner un ouvrage de décharge ou un dalot.",
  inputs: [N("A", "Surface du bassin versant", "km²", 2.5, "A"), N("Cr", "Coefficient de ruissellement", "", 0.35, "C"), N("Lb", "Longueur du plus long cheminement", "m", 2500, "L"), N("Ib", "Pente moyenne", "m/m", 0.02, "I"),
    N("a", "Coefficient de Montana a (i en mm/min, t en min)", "", 5.9, "a"), N("b", "Coefficient de Montana b", "", 0.6, "b")],
  calc(I) {
    const tc = 0.0195 * pow(I.Lb, 0.77) * pow(I.Ib, -0.385), i = I.a * pow(tc, -I.b) * 60, Q = I.Cr * i * I.A / 3.6;
    return { steps: [S("tc", L`t_c`, L`0{,}0195\,L^{0{,}77}\,I^{-0{,}385}` + "\\quad\\text{(Kirpich)}", tc, "min", 1), S("i", "i", L`a\,t_c^{-b}`, i, "mm/h", 1), R("Q", L`Q_p`, L`\dfrac{C\,i\,A}{3{,}6}`, Q, "m³/s", 2), S("q", "", "~débit spécifique", Q / I.A, "m³/s/km²", 2)],
      notes: ["Coefficients de Montana : stations Météo-France pour la période de retour visée (10 ans pour l'assainissement, 100 ans pour les ouvrages hydrauliques de franchissement). $C$ : 0,9 (chaussée), 0,3–0,5 (prairies, cultures), 0,1–0,3 (bois). Au-delà de quelques km², préférer la méthode Crupedix ou SOCOSE, ou une étude hydrologique."] };
  },
  fig(I, g) { const ts = range(5, 180, 60); return plot({ series: [{ pts: ts.map(t => [t, I.a * pow(t, -I.b) * 60]), l: "courbe intensité–durée (Montana)" }], marks: [{ x: g("tc"), y: g("i"), l: `i(tc) = ${f2(g("i"), 0)} mm/h` }], xl: "durée (min)", yl: "i (mm/h)", ymin: 0 }); },
  clair: (I, g) => `L'eau met environ ${f2(g("tc"), 0)} minutes à traverser le bassin ; l'averse correspondante produit une pointe de ${f2(g("Q"), 1)} m³/s.` },

{ id: "hyd-affouillement", t: "Affouillement local au droit d'une pile", ref: "Formule CSU (FHWA HEC-18, 2012) ; guide Cerema « Affouillements » (2019)",
  desc: "Profondeur d'affouillement local au pied d'une pile en rivière, selon la forme, le biais et le régime de l'écoulement.",
  inputs: [N("a", "Largeur de la pile", "m", 2, "a"), N("Lp", "Longueur de la pile", "m", 8, "L"), N("y1", "Tirant d'eau à l'amont", "m", 4, L`y_1`), N("V", "Vitesse à l'amont de la pile", "m/s", 2.5, L`V_1`),
    N("th", "Angle d'attaque de l'écoulement", "°", 10, L`\theta`), SEL("K1", "Forme du nez", [["1.1", "Carré (K₁ = 1,1)"], ["1", "Arrondi ou circulaire (1,0)"], ["0.9", "Pointu (0,9)"]], "1", L`K_1`),
    N("K3", "Coefficient d'état du lit", "", 1.1, L`K_3`)],
  calc(I) {
    const Fr = I.V / sqrt(g0 * I.y1), t = I.th * PI / 180, K2 = pow(Math.cos(t) + I.Lp / I.a * Math.sin(t), 0.65), K1 = I.th > 5 ? 1 : +I.K1;
    const ys = 2 * K1 * K2 * I.K3 * pow(I.y1 / I.a, 0.35) * pow(Fr, 0.43) * I.a, lim = (Fr <= 0.8 ? 2.4 : 3.0) * I.a;
    return { steps: [S("Fr", L`Fr_1`, L`\dfrac{V_1}{\sqrt{g\,y_1}}`, Fr, "", 3), S("K1", L`K_1`, I.th > 5 ? "~= 1 dès que l'angle d'attaque dépasse 5°" : "~forme du nez", K1, "", 2), S("K2", L`K_2`, L`\left(\cos\theta + \dfrac{L}{a}\sin\theta\right)^{0{,}65}`, K2, "", 3),
      R("ys", L`y_s`, L`2{,}0\,K_1 K_2 K_3\left(\dfrac{y_1}{a}\right)^{0{,}35} Fr_1^{0{,}43}\,a`, ys, "m", 2), S("lim", L`y_{s,max}`, Fr <= 0.8 ? L`2{,}4\,a\ \ (Fr \le 0{,}8)` : L`3{,}0\,a`, lim, "m", 2), R("ysr", L`y_s^{ret}`, L`\min(y_s ; y_{s,max})`, min(ys, lim), "m", 2)],
      notes: ["Affouillement local seul : ajouter l'affouillement général (contraction du lit) et la dégradation à long terme pour situer le fond affouillé. La fondation (semelle) doit être placée sous ce niveau ou protégée (enrochements : feuille « Enrochements »)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 175, k = 110 / (I.y1 + g("ysr")), cx = 165, ys = 20, yb = ys + I.y1 * k, w = I.a * k * 1.5; let s = Rc(10, ys, 310, I.y1 * k, { f: K.blueL, c: "none", op: .6 }) + P(`M10 ${ys}H320`, { c: K.blue, w: 1.2 });
    s += P(`M10 ${yb}H${cx - w / 2 - g("ysr") * k * 1.4}L${cx - w / 2} ${yb + g("ysr") * k}H${cx + w / 2}L${cx + w / 2 + g("ysr") * k * 1.4} ${yb}H320`, { c: K.soilD, w: 2, f: "none" }) + Rc(10, yb, 310, Hh - yb, { f: K.soil, c: "none", op: .3 });
    s += Rc(cx - w / 2, 8, w, yb + g("ysr") * k - 8 + 14) + dimV(cx + w / 2 + 50, yb, yb + g("ysr") * k, `ys = ${f2(g("ysr"), 2)} m`, K.red, 1) + arrow(30, ys + 20, 80, ys + 20, K.blue, 2) + T(30, ys + 14, `V = ${f2(I.V, 1)} m/s`, { s: 9.5, c: K.blue });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le tourbillon qui se forme devant la pile creuse le lit jusqu'à ${f2(g("ysr"), 1)} m sous le fond naturel : la fondation doit descendre plus bas ou être protégée.` },

{ id: "hyd-courant-pile", t: "Pression hydrodynamique et embâcles sur une pile", ref: "NF EN 1991-1-6 — §4.9 (4.1), (4.2) ; NF EN 1991-1-6/AN",
  desc: "Force du courant sur une pile immergée et force d'impact due à une accumulation de débris (embâcle) contre la pile.",
  inputs: [N("b", "Largeur de la pile perpendiculaire au courant", "m", 2, "b"), N("h", "Profondeur d'eau", "m", 4, "h"), N("v", "Vitesse moyenne de l'eau", "m/s", 2.5, L`v_{wa}`),
    SEL("kwa", "Forme de la pile", [["1.44", "Section carrée ou rectangulaire (k = 1,44)"], ["0.7", "Section circulaire (k = 0,70)"]], "1.44", L`k_{wa}`), N("Adeb", "Aire de l'embâcle (projection)", "m²", 12, L`A_{deb}`),
    SEL("kdeb", "Forme de l'embâcle", [["666", "Rectangulaire (666 kg/m³)"], ["394", "Triangulaire (394 kg/m³)"]], "666", L`k_{deb}`)],
  calc(I) { const Fw = 0.5 * +I.kwa * 1000 * I.h * I.b * I.v * I.v / 1000, Fd = +I.kdeb * I.Adeb * I.v * I.v / 1000;
    return { steps: [R("Fw", L`F_{wa}`, L`\tfrac{1}{2}\,k_{wa}\,\rho_{wa}\,h\,b\,v_{wa}^2`, Fw, "kN", 1), S("pw", L`p_{moy}`, L`\dfrac{F_{wa}}{b\,h}`, Fw / (I.b * I.h), "kPa", 2), R("Fd", L`F_{deb}`, L`k_{deb}\,A_{deb}\,v_{wa}^2`, Fd, "kN", 1), S("Ft", "", "~total (cumul enveloppe)", Fw + Fd, "kN", 1)],
      notes: ["$\\rho_{wa} = 1\\,000$ kg/m³. La vitesse réelle varie sur la hauteur : avec un profil de vitesse, la force se concentre vers la surface. L'embâcle s'applique au niveau de la surface libre. Combinaisons : action variable (crue de projet)."] };
  },
  fig(I, g) { const W = 330, Hh = 160, k = 110 / I.h, top = 30; let s = Rc(20, top, 290, I.h * k, { f: K.blueL, c: "none", op: .6 }) + P(`M20 ${top}H310`, { c: K.blue }) + Rc(200, 10, 40, I.h * k + 30);
    for (let i = 0; i < 5; i++) { const y = top + 8 + i * (I.h * k - 16) / 4, l = 60 * pow(1 - i / 6, 0.3); s += arrow(196 - l, y, 197, y, K.blue, 1.4); }
    s += Rc(140, top - 10, 58, 20, { f: K.soilD, c: K.ink, op: .7 }) + T(169, top - 14, "embâcle", { a: "middle", s: 9 }) + T(30, top + I.h * k + 16, `Fwa = ${f2(g("Fw"), 0)} kN · Fdeb = ${f2(g("Fd"), 0)} kN`, { s: 9.5, w: 500 });
    return svg(W, Hh, s); },
  clair: (I, g) => `Le courant pousse la pile de ${f2(g("Fw"), 0)} kN ; un embâcle d'arbres flottés y ajouterait ${f2(g("Fd"), 0)} kN.` },

{ id: "hyd-remous", t: "Remous dû aux piles d'un pont (Yarnell)", ref: "Formule de Yarnell (1934) ; guide Sétra « Hydraulique des ouvrages de franchissement »",
  desc: "Surélévation de la ligne d'eau à l'amont d'un pont due au rétrécissement par les piles, en écoulement fluvial.",
  inputs: [N("Q", "Débit de crue", "m³/s", 400, "Q"), N("Bl", "Largeur du lit au droit du pont", "m", 60, "B"), N("y3", "Tirant d'eau à l'aval du pont", "m", 3.5, L`y_3`), N("np", "Nombre de piles", "U", 3, "n"), N("a", "Largeur d'une pile", "m", 1.8, "a"),
    SEL("K", "Forme des piles", [["0.9", "Nez et arrière arrondis (K = 0,90)"], ["0.95", "Deux fûts avec voile (0,95)"], ["1.05", "Deux fûts sans voile ou nez triangulaire (1,05)"], ["1.25", "Nez et arrière carrés (1,25)"]], "0.9", "K")],
  calc(I) { const al = I.np * I.a / I.Bl, V3 = I.Q / (I.Bl * I.y3), Fr = V3 / sqrt(g0 * I.y3), K_ = +I.K, dh = K_ * Fr * Fr * (K_ + 5 * Fr * Fr - 0.6) * (al + 15 * al ** 4) * I.y3;
    return { steps: [S("al", L`\alpha`, L`\dfrac{n\,a}{B}` + "\\quad\\text{(taux d'obstruction)}", al, "", 3), S("V3", L`V_3`, L`\dfrac{Q}{B\,y_3}`, V3, "m/s", 2), S("Fr", L`Fr_3`, L`\dfrac{V_3}{\sqrt{g\,y_3}}`, Fr, "", 3),
      R("dh", L`\Delta h`, L`K\,Fr_3^2\left(K + 5\,Fr_3^2 - 0{,}6\right)\left(\alpha + 15\,\alpha^4\right) y_3`, dh, "m", 3)],
      notes: ["Formule empirique valable en régime fluvial sans obstruction par les culées ; ajouter la perte due au rétrécissement des culées et des remblais d'accès (méthode Bradley ou modèle 1D). Le remous conditionne le tirant d'air et la cote des remblais."] };
  },
  fig(I, g) { const W = 330, Hh = 140, yb = 110, k = 18; let s = P(`M10 ${yb}H320`, { c: K.soilD, w: 2 }) + P(`M10 ${yb - I.y3 * k - g("dh") * k * 6}C120 ${yb - I.y3 * k - g("dh") * k * 6} 150 ${yb - I.y3 * k} 200 ${yb - I.y3 * k}H320`, { c: K.blue, w: 2 }) + Rc(155, 20, 18, yb - 20);
    s += dimV(60, yb - I.y3 * k - g("dh") * k * 6, yb - I.y3 * k, `Δh = ${f2(g("dh") * 100, 0)} cm (×6)`, K.red, 1) + T(240, yb - I.y3 * k - 6, `y3 = ${f2(I.y3, 2)} m`, { s: 9.5, c: K.blue });
    return svg(W, Hh, s); },
  clair: (I, g) => `Les ${Math.round(I.np)} piles gênent l'écoulement : l'eau monte d'environ ${f2(g("dh") * 100, 0)} cm à l'amont du pont.` },

{ id: "hyd-dalot", t: "Dalot ou buse fonctionnant en charge", ref: "Écoulement en charge : Bernoulli avec pertes d'entrée, de frottement (Manning) et de sortie ; guides Sétra / FHWA HDS-5",
  desc: "Débit d'un ouvrage hydraulique sous remblai en charge pour une différence de niveau amont–aval donnée (contrôle aval).",
  inputs: [SEL("sec", "Section", [["r", "Rectangulaire (dalot)"], ["c", "Circulaire (buse)"]], "r", ""), N("B", "Largeur (ou diamètre)", "m", 3, "B"), N("Hd", "Hauteur", "m", 2, "H"), N("Lo", "Longueur de l'ouvrage", "m", 30, "L"),
    N("dh", "Différence de niveau amont – aval", "m", 1.2, L`\Delta H`), N("Ks", "Coefficient de Strickler", "m^(1/3)/s", 70, L`K_s`), N("ke", "Coefficient de perte à l'entrée", "", 0.5, L`k_e`)],
  calc(I) { const A = I.sec === "c" ? PI * I.B ** 2 / 4 : I.B * I.Hd, Pm = I.sec === "c" ? PI * I.B : 2 * (I.B + I.Hd), Rh = A / Pm, kf = 2 * g0 * I.Lo / (I.Ks * I.Ks * pow(Rh, 4 / 3)), V = sqrt(2 * g0 * I.dh / (1 + I.ke + kf)), Q = V * A;
    return { steps: [S("A", "A", "", A, "m²", 3), S("Rh", L`R_h`, L`\dfrac{A}{P}`, Rh, "m", 3), S("kf", L`k_f`, L`\dfrac{2\,g\,L}{K_s^2\,R_h^{4/3}}`, kf, "", 3), R("V", "V", L`\sqrt{\dfrac{2\,g\,\Delta H}{1 + k_e + k_f}}`, V, "m/s", 2), R("Q", "Q", L`V\,A`, Q, "m³/s", 2)],
      notes: ["$k_e$ : 0,5 (entrée à angle vif), 0,2 (murs en aile à 30–75°), 0,7 (buse saillante). Le « 1 » correspond à la perte à la sortie (énergie cinétique perdue). Vérifier aussi le fonctionnement à surface libre (contrôle amont) pour les petits débits, et la vitesse de sortie (risque d'érosion)."] };
  },
  fig(I, g) { const W = 330, Hh = 150; let s = P("M10 40H90L120 55H230L260 75H320", { c: K.blue, w: 2 }) + Rc(100, 60, 140, 40, { f: K.conc, c: K.ink }) + Rc(106, 66, 128, 28, { f: K.blueL, c: K.blue }) + Rc(10, 100, 310, 30, { f: K.soil, c: "none", op: .35 });
    s += dimV(300, 40, 75, `ΔH = ${f2(I.dh, 2)} m`, K.blue, -1) + arrow(140, 80, 200, 80, K.blue, 2) + T(170, 120, `Q = ${f2(g("Q"), 2)} m³/s · V = ${f2(g("V"), 2)} m/s`, { a: "middle", s: 9.5, w: 500 });
    return svg(W, Hh, s); },
  clair: (I, g) => `Avec ${f2(I.dh, 2)} m de dénivelée entre l'amont et l'aval, l'ouvrage débite ${f2(g("Q"), 1)} m³/s à ${f2(g("V"), 1)} m/s.` },

{ id: "hyd-dupuit", t: "Rabattement de nappe : débit d'une fouille (Dupuit)", ref: "Formule de Dupuit (nappe libre), rayon d'action de Sichardt ; fouille assimilée à un puits équivalent",
  desc: "Débit de pompage nécessaire pour rabattre une nappe libre dans une fouille de pile ou de culée.",
  inputs: [N("k", "Perméabilité", "m/s", 1e-4, "k"), N("Hn", "Épaisseur saturée initiale (au-dessus du substratum)", "m", 12, "H"), N("s", "Rabattement souhaité", "m", 5, "s"), N("A", "Surface de la fouille", "m²", 400, "A")],
  calc(I) { const h = I.Hn - I.s, r = sqrt(I.A / PI), R_ = max(3000 * I.s * sqrt(I.k), r * 1.5), Q = PI * I.k * (I.Hn ** 2 - h * h) / ln(R_ / r);
    return { steps: [S("r", L`r_e`, L`\sqrt{A/\pi}` + "\\quad\\text{(puits équivalent)}", r, "m", 2), S("R", "R", L`3000\,s\sqrt{k}` + "\\quad\\text{(Sichardt)}", R_, "m", 1), S("h", "h", L`H - s`, h, "m", 2),
      R("Q", "Q", L`\dfrac{\pi\,k\,(H^2 - h^2)}{\ln(R/r_e)}`, Q, "m³/s", 4), R("Qh", "Q", "", Q * 3600, "m³/h", 0)],
      notes: ["Nappe libre, régime permanent, substratum horizontal imperméable. Ordre de grandeur pour choisir le mode de rabattement (pompage en fond de fouille, puits filtrants, pointes filtrantes) ; un essai de pompage est indispensable pour les fouilles importantes."] };
  },
  fig(I, g) { const W = 330, Hh = 160, k = 110 / I.Hn, yb = 140, cx = 165, rr = g("r"), R_ = g("R"), sc = 140 / R_; let s = Rc(10, yb, 310, 10, { f: K.soilD, c: "none" });
    const yH = yb - I.Hn * k, yh = yb - (I.Hn - I.s) * k, pts = range(rr, R_, 40).map(x => [x, sqrt((I.Hn - I.s) ** 2 + (I.Hn ** 2 - (I.Hn - I.s) ** 2) * ln(x / rr) / ln(R_ / rr))]);
    s += P(`M${cx - rr * sc} ${yh}` + pts.map(p => `L${cx - p[0] * sc} ${yb - p[1] * k}`).join(""), { c: K.blue, w: 2 }) + P(`M${cx + rr * sc} ${yh}` + pts.map(p => `L${cx + p[0] * sc} ${yb - p[1] * k}`).join(""), { c: K.blue, w: 2 });
    s += P(`M10 ${yH}H320`, { c: K.blue, w: 1, dash: "4 3" }) + Rc(cx - rr * sc, yH - 12, 2 * rr * sc, yh - yH + 12, { f: "#fff", c: K.ink }) + T(cx, yH - 16, `Q = ${f2(g("Qh"), 0)} m³/h`, { a: "middle", s: 10, w: 500 }) + dimV(cx + rr * sc + 10, yH, yh, `s = ${f2(I.s, 1)}`, K.blue, 1);
    return svg(W, Hh, s); },
  clair: (I, g) => `Pour abaisser la nappe de ${f2(I.s, 1)} m dans la fouille, il faut pomper environ ${f2(g("Qh"), 0)} m³/h ; le rabattement se fait sentir jusqu'à ${f2(g("R"), 0)} m.` },

{ id: "hyd-sous-pression", t: "Soulèvement hydraulique d'un radier ou d'un cadre (UPL)", ref: "NF EN 1997-1 — §2.4.7.4 (2.8), tableau A.15 ; NF EN 1990 (EQU)",
  desc: "Vérification de la stabilité au soulèvement d'un radier ou d'un ouvrage enterré soumis à la poussée d'Archimède.",
  inputs: [N("G", "Poids propre de l'ouvrage (par m² de radier)", "kPa", 22, L`G_{stb}`), N("Gr", "Poids des remblais sur l'ouvrage", "kPa", 15, L`G_{rem}`), N("hw", "Hauteur d'eau au-dessus de la sous-face du radier", "m", 3, L`h_w`),
    N("Rf", "Frottement latéral mobilisable (par m² de radier)", "kPa", 0, L`R_d`), N("gw", "Poids volumique de l'eau", "kN/m³", 10, L`\gamma_w`)],
  calc(I) { const U = I.gw * I.hw, Vd = 1.0 * U, Sd = 0.9 * (I.G + I.Gr) + I.Rf, Fs = (I.G + I.Gr + I.Rf) / U;
    return { steps: [S("U", "U", L`\gamma_w\,h_w`, U, "kPa", 1), R("Vd", L`V_{dst;d}`, L`\gamma_{G;dst}\,U\ \ (\gamma_{G;dst} = 1{,}0)`, Vd, "kPa", 1), R("Sd", L`G_{stb;d} + R_d`, L`\gamma_{G;stb}\,(G + G_{rem}) + R_d\ \ (\gamma_{G;stb} = 0{,}9)`, Sd, "kPa", 1), S("Fs", "F", L`\dfrac{G + G_{rem} + R_d}{U}`, Fs, "", 2)],
      checks: [C("UPL : $V_{dst;d} \\le G_{stb;d} + R_d$", Vd <= Sd, `${f2(Vd, 1)} ≤ ${f2(Sd, 1)} kPa`, Vd / Sd)],
      notes: ["Niveau d'eau à prendre au plus haut (crue de projet, nappe exceptionnelle). Les charges variables favorables ne sont pas comptées. Si la condition n'est pas satisfaite : lest, épaississement du radier, tirants ou pieux travaillant en traction, ou drainage permanent."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "sous-pression U", v: g("Vd"), u: "kPa", c: K.blue }, { l: "poids stabilisant (×0,9)", v: g("Sd"), u: "kPa", c: K.gold }], { title: `Coefficient global F = ${f2(g("Fs"), 2)}`, left: 128 }); },
  clair: (I, g) => `L'eau pousse le radier vers le haut avec ${f2(g("U"), 0)} kPa ; le poids de l'ouvrage et des remblais en équilibre ${f2(g("Sd"), 0)} kPa (valeur de calcul).` },

{ id: "hyd-enrochements", t: "Protection en enrochements : formule d'Isbash", ref: "Formule d'Isbash (1936) ; guide Cerema « Affouillements » ; CIRIA C683 (Rock Manual)",
  desc: "Diamètre et masse des blocs d'enrochement stables sous une vitesse d'écoulement donnée (protection de pile, de culée ou de berge).",
  inputs: [N("V", "Vitesse locale de l'écoulement", "m/s", 3, "V"), N("rs", "Masse volumique des blocs", "t/m³", 2.65, L`\rho_s`), SEL("C", "Configuration", [["0.86", "Blocs exposés, en saillie (C = 0,86)"], ["1.20", "Blocs imbriqués dans la couche (C = 1,20)"]], "0.86", "C"),
    N("ks", "Majoration au droit des piles (vitesse locale)", "", 1.5, L`k_V`)],
  calc(I) { const Vl = I.ks * I.V, Dl = I.rs - 1, d = Vl * Vl / (2 * g0 * (+I.C) ** 2 * Dl), M = I.rs * PI * d ** 3 / 6;
    return { steps: [S("Vl", L`V_{loc}`, L`k_V\,V`, Vl, "m/s", 2), S("D", L`\Delta`, L`\dfrac{\rho_s - \rho_w}{\rho_w}`, Dl, "", 2), R("d", L`d_{50}`, L`\dfrac{V_{loc}^2}{2\,g\,C^2\,\Delta}`, d, "m", 3), R("M", L`M_{50}`, L`\rho_s\,\dfrac{\pi d^3}{6}`, M * 1000, "kg", 0), S("e", "e", L`\approx 2\,d_{50}`, 2 * d, "m", 2)],
      notes: ["Épaisseur de la couche $\\approx 2\\,d_{50}$, sur un filtre (géotextile ou granulaire) ; extension autour de la pile ≥ 2 à 3 fois sa largeur. La majoration $k_V$ tient compte de l'accélération de l'écoulement contre la pile (1,5 à 2,0 au nez)."] };
  },
  fig(I, g) { const ds = range(0.5, 6, 40); return plot({ series: [{ pts: ds.map(v => [v, (I.ks * v) ** 2 / (2 * g0 * (+I.C) ** 2 * (I.rs - 1))]), l: "d50 selon la vitesse" }], marks: [{ x: I.V, y: g("d"), l: `d50 = ${f2(g("d"), 2)} m · ${f2(g("M"), 0)} kg` }], xl: "vitesse de l'écoulement V (m/s)", yl: "d50 (m)", ymin: 0 }); },
  clair: (I, g) => `Pour résister à ${f2(g("Vl"), 1)} m/s au pied de la pile, il faut des blocs de ${f2(g("d") * 100, 0)} cm (environ ${f2(g("M"), 0)} kg) sur ${f2(g("e"), 1)} m d'épaisseur.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
