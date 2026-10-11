/* ════════════════════════════════════════════════════════════════════
   HandBag — Géotechnique (classeurs Biblio 2004)
   Diagramme de pression sous semelle (sol sans traction), flambement d'un pieu,
   formules de battage, massif de candélabre, colonnes ballastées.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, BM = HB.BEAM, GEO = HB.GEO, BA = HB.BA, { PI, sqrt, pow, min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, udl } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d);

HB.add("Géotechnique et fondations", [

{ id: "geo-semelle-diagramme", t: "Semelle sous flexion déviée : diagramme des pressions (sol sans traction)", ref: "Biblio 2004 « Diagramme de pression sous une semelle rectangulaire, circulaire ou de forme quelconque » — équilibre d'un plan de pression sans traction",
  desc: "Plan des pressions, pressions maximale, minimale et au trois quarts, surface comprimée d'une semelle rectangulaire, circulaire ou de contour quelconque soumise à un effort normal et à deux moments.",
  inputs: [SEL("forme", "Forme", [["r", "rectangulaire (origine au coin bas-gauche)"], ["c", "circulaire (origine au centre)"], ["q", "contour quelconque"]], "r", ""),
    N("bx", "Largeur suivant x (ou diamètre)", "m", 3.5, L`B_x`), N("by", "Longueur suivant y", "m", 2, L`B_y`), LST("pts", "Contour quelconque : x y ; …", "m", "0 0 ; 3.5 0 ; 3.5 2 ; 0 2", "", { cols: 2 }),
    H("Efforts (N > 0 de compression)"), N("Ne", "Effort normal", "kN", 400, "N"), N("Mx", "Moment autour de x (> 0 comprime les y croissants)", "kN·m", -700, L`M_x`), N("My", "Moment autour de y (> 0 comprime les x croissants)", "kN·m", 1200, L`M_y`),
    N("xa", "Point d'application x", "m", 1, L`x_N`), N("ya", "Point d'application y", "m", 1, L`y_N`), N("q", "Charge répartie sur la semelle (poids, terres)", "kPa", 80, "q"), N("qad", "Contrainte admissible (σ3/4)", "kPa", 1500, L`\bar q`)],
  calc(I) {
    const poly = I.forme === "r" ? [[0, 0], [I.bx, 0], [I.bx, I.by], [0, I.by]] : I.forme === "c" ? Array.from({ length: 180 }, (_, i) => [I.bx / 2 * Math.cos(2 * PI * i / 180), I.bx / 2 * Math.sin(2 * PI * i / 180)]) : GEO.contour(I.pts || []);
    if (poly.length < 3) throw new Error("contour à saisir");
    const p = GEO.polyProps(poly), A = p.A, xg = p.Sy / A, yg = p.Sx / A;
    const Nt = I.Ne + I.q * A, Mx0 = I.Mx + I.Ne * I.ya + I.q * p.Sx, My0 = I.My + I.Ne * I.xa + I.q * p.Sy;       /* moments par rapport à l'origine */
    if (Nt <= 0) throw new Error("effort normal total de traction : pas d'équilibre possible");
    const r = BA.elsSolve({ poly, hole: null, bars: [], n: 0, fiss: true, negl: false, x0: 0, y0: 0, N: Nt, Mx: Mx0, My: My0 });
    if (!r.ok) throw new Error("pas d'équilibre : la résultante sort de la semelle (renversement)");
    const s = q => r.a + r.bx * q[0] + r.by * q[1], sv = poly.map(s), smax = max(...sv), smin = max(0, min(...sv)), s34 = (3 * smax + smin) / 4, Ac = GEO.polyProps(BA.clip(poly, r.a, r.bx, r.by)).A;
    const ex = My0 / Nt - xg, ey = Mx0 / Nt - yg;
    return { steps: [S("A", "S", "~aire de la semelle", A, "m²", 3), S("Nt", L`N_{tot}`, L`N + q\,S`, Nt, "kN", 1), S("ex", L`e_x`, L`\dfrac{M_{y,O}}{N_{tot}} - x_G`, ex, "m", 3), S("ey", L`e_y`, L`\dfrac{M_{x,O}}{N_{tot}} - y_G`, ey, "m", 3),
      H("Plan des pressions : σ = a·x + b·y + c"), S("pa", "a", "", r.bx, "kPa/m", 3), S("pb", "b", "", r.by, "kPa/m", 3), S("pc", "c", "", r.a, "kPa", 3),
      R("smax", L`q_{max}`, "", smax, "kPa", 1), S("smin", L`q_{min}`, "", smin, "kPa", 1), R("s34", L`q_{3/4}`, L`\dfrac{3\,q_{max} + q_{min}}{4}`, s34, "kPa", 1), R("pS", L`S_c / S`, "~surface comprimée", Ac / A * 100, "%", 1)],
      checks: [C("Contrainte de référence", s34 <= I.qad, `q3/4 = ${fmt(s34, 0)} ≤ ${fmt(I.qad, 0)} kPa`, s34 / I.qad), C("Surface comprimée", Ac / A >= 0.75 - 1e-9, `${fmt(Ac / A * 100, 0)} % (≥ 75 % souhaité sous combinaison fréquente, ≥ 10 % au minimum à l'ELU)`, 0.75 / max(Ac / A, 1e-9))],
      vals: { poly, plane: [r.a, r.bx, r.by] }, notes: ["Sol sans résistance à la traction : la zone décomprimée est exclue et l'équilibre (N, Mx, My) est résolu exactement sur la partie comprimée. Moments donnés au point d'application de N ; la charge répartie q (poids propre de la semelle, terres) est ajoutée sur toute la surface."] };
  },
  fig(I, g, r) {
    const poly = r.vals.poly, [a, bx, by] = r.vals.plane, xs = poly.map(q => q[0]), ys = poly.map(q => q[1]), x0 = min(...xs), x1 = max(...xs), y0 = min(...ys), y1 = max(...ys);
    const W = 330, Hh = 180, k = min(210 / (x1 - x0 || 1), 140 / (y1 - y0 || 1)), ox = 24, oy = 20, X = x => ox + (x - x0) * k, Y = y => oy + (y1 - y) * k, path = pp => pp.map((q, i) => `${i ? "L" : "M"}${X(q[0]).toFixed(1)} ${Y(q[1]).toFixed(1)}`).join("") + "Z";
    let s = P(path(poly), { c: K.concD, f: "#f6f3ec", w: 1.2 }); const cp = BA.clip(poly, a, bx, by); if (cp.length >= 3) s += P(path(cp), { c: "none", f: K.soil, op: .6 });
    const sm = g("smax"); poly.forEach(q => { const v = a + bx * q[0] + by * q[1]; if (v > sm * 0.999) s += Ci(X(q[0]), Y(q[1]), 3.5, { f: K.red, c: "#fff" }); });
    s += Ci(X(I.forme === "r" || I.forme === "q" ? I.xa : I.xa), Y(I.ya), 3, { f: K.blue, c: "#fff" }) + T(X(I.xa) + 5, Y(I.ya) - 5, "N", { s: 9.5, c: K.blue, w: 600 });
    s += T(W - 6, 30, `q max = ${f2(sm, 0)} kPa`, { a: "end", s: 9.5, w: 500, c: K.red }) + T(W - 6, 46, `q 3/4 = ${f2(g("s34"), 0)} kPa`, { a: "end", s: 9.5 }) + T(W - 6, 62, `comprimé : ${f2(g("pS"), 0)} %`, { a: "end", s: 9.5, c: K.soilD });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La semelle n'est comprimée que sur ${f2(g("pS"), 0)} % de sa surface ; la pression atteint ${f2(g("smax"), 0)} kPa au coin le plus chargé (q3/4 = ${f2(g("s34"), 0)} kPa).` },

{ id: "geo-pieu-flambement", t: "Flambement d'un pieu partiellement enterré (sol élastique)", ref: "Biblio 2004 « Flambement d'un pieu dans un milieu élastique » — P. Souche, Annales de l'ITBTP ; charge critique par éléments finis",
  desc: "Charge critique de flambement et longueur de flambement d'un pieu dont la partie haute est libre (eau, vase) et la partie basse encastrée dans un sol à réaction élastique.",
  inputs: [N("E", "Module d'Young du pieu", "MPa", 200000, "E"), N("D", "Diamètre (largeur)", "m", 0.2, "D"), N("Ip", "Inertie (0 : pieu circulaire plein)", "m⁴", 0, "I"),
    N("Lp", "Longueur totale", "m", 23.6, "L"), N("l0", "Longueur libre (hors sol)", "m", 5.5, L`\ell_0`), N("k", "Module de réaction du sol (≥ 100 kN/m³)", "kN/m³", 28800, "k"),
    SEL("tete", "Conditions en tête", [["e", "encastrement (déplacement et rotation bloqués)"], ["a", "articulation (déplacement bloqué)"], ["l", "tête libre"], ["g", "rotation bloquée, déplacement libre"]], "e", ""),
    SEL("pied", "Conditions en pied", [["e", "encastrement"], ["a", "articulation"], ["l", "pied libre"]], "a", "")],
  calc(I) {
    const In = I.Ip > 0 ? I.Ip : PI * I.D ** 4 / 64, EI = I.E * 1000 * In, Kh = max(100, I.k) * I.D, zf = I.Lp - I.l0;
    const bc = { e: { t: "b", r: "b" }, a: { t: "b", r: "l" }, l: { t: "l", r: "l" }, g: { t: "l", r: "b" } };
    const rr = BM.buckling({ L: I.Lp, EI, kw: x => x <= zf ? Kh : 0, breaks: [zf], nel: 120, foot: bc[I.pied], head: bc[I.tete] });
    if (!rr.Ncr) throw new Error("système instable : bloquer au moins un appui");
    const lf = PI * sqrt(EI / rr.Ncr), lam = pow(Kh / EI, 0.25);
    return { steps: [S("I", "I", "~inertie", In, "m⁴", 7), S("EI", "EI", "", EI, "kN·m²", 0), S("Kh", "K", L`k\,D`, Kh, "kN/m²", 0), S("lam", L`\lambda`, L`\sqrt[4]{K/EI}`, lam, "m⁻¹", 4),
      R("Ncr", L`N_{c}`, "~charge critique (éléments finis, sol élastique sous la longueur libre)", rr.Ncr, "kN", 0), S("NE", L`\sqrt{EI\,K}`, "~(référence d'un pieu infiniment long)", sqrt(EI * Kh), "kN", 0),
      R("lf", L`\ell_f`, L`\pi\sqrt{EI / N_c}`, lf, "m", 3), S("m", "m", L`\dfrac{N_c\,L^2}{\pi^2\,EI}`, rr.Ncr * I.Lp ** 2 / PI ** 2 / EI, "", 3)],
      vals: { mode: rr.mode, zf }, notes: ["Le sol agit comme un appui élastique continu de raideur K = k·D sous la longueur libre. Comparer N_c à l'effort normal pondéré en tenant compte des imperfections et du second ordre ; ici flambement élastique d'Euler."] };
  },
  fig(I, g, r) {
    const { mode, zf } = r.vals, W = 330, Hh = 190, yb = 176, yt = 18, k = (yb - yt) / I.Lp, x0 = 120, am = max(1e-12, ...mode.map(m => abs(m[1]))), ys = z => yb - z * k;
    let s = Rc(30, ys(zf), 200, (zf) * k, { f: K.soil, c: "none", op: .45 }) + P(`M30 ${ys(zf)}H230`, { c: K.soilD, w: 1.2 });
    s += P(`M${x0} ${yb}V${yt}`, { c: K.mute, dash: "3 3" }) + P("M" + mode.map(m => `${(x0 + m[1] / am * 40).toFixed(1)} ${ys(m[0]).toFixed(1)}`).join("L"), { c: K.ink, w: 3 });
    s += arrow(x0, yt - 14, x0, yt - 1, K.red, 2) + T(x0 + 6, yt - 3, `Nc = ${f2(g("Ncr"), 0)} kN`, { s: 9.5, c: K.red, w: 500 });
    s += T(240, 70, `ℓf = ${f2(g("lf"), 2)} m`, { s: 12, w: 600 }) + T(240, 88, `ℓ0 = ${f2(I.l0, 1)} m libres`, { s: 9.5, c: K.mute }) + T(36, yb - 6, "sol élastique", { s: 9, c: K.soilD });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le pieu flambe sous ${f2(g("Ncr"), 0)} kN, ce qui correspond à une longueur de flambement de ${f2(g("lf"), 2)} m.` },

{ id: "geo-battage", t: "Formules dynamiques de battage des pieux", ref: "Biblio 2004 « Formules dynamiques de battage » — annexe 11 de l'EF 9 C1 n° 2 de la SNCF (Hollandais, Redtenbacher, Crandall, Hiley, Delmag)",
  desc: "Force portante estimée d'un pieu battu à partir du refus mesuré, par cinq formules dynamiques usuelles.",
  inputs: [N("M", "Masse du mouton", "kg", 500, "M"), N("h", "Hauteur de chute", "m", 1, "h"), N("Pm", "Masses entraînées (pieu + casque)", "kg", 100, "P"), N("e", "Refus (enfoncement par coup)", "m", 0.2, "e"),
    N("Sp", "Section du pieu", "m²", 0.05, "S"), N("Lf", "Longueur de la fiche", "m", 1, "L"), SEL("typ", "Pieu", [["1", "bois"], ["2", "béton armé"], ["3", "acier"]], "2", ""),
    N("e1", "Raccourcissement élastique 2e₁ (Crandall)", "m", 0.1, L`2e_1`), N("n2", "Coefficient de réduction n' (Crandall)", "", 4, L`n'`), N("e2", "Refus sous le dernier coup e' (Hiley)", "m", 0.2, L`e'`),
    N("h0", "Hauteur de chute à enfoncement nul h₀ (Hiley)", "m", 0.5, L`h_0`), N("sg", "Coefficient de sécurité Delmag (0,4 à 0,6)", "", 0.4, L`\sigma`), N("Ed", "Énergie du mouton Diesel", "J", 200, "E")],
  calc(I) {
    const g = 1;                                      /* le classeur exprime la masse en kg et la force en N sans g (force en « kgf·m/m ») */
    const El = (I.typ === "1" ? 1 : I.typ === "2" ? 2 : 21) * 1e10, M = I.M, Pm = I.Pm, e = I.e;
    const R1 = M * M * I.h / 6 / e / (M + Pm), R2 = I.Sp * El / 3 / I.Lf * (-e + sqrt(e * e + 2 * I.Lf * M * M * I.h / I.Sp / El / (M + Pm)));
    const R3 = M * M * I.h / I.n2 / (e + I.e1 / 2) / (M + Pm), R4 = M * M * (I.h - I.h0) / 4 / I.e2 / (M + Pm) * min(M / Pm, 1), cc = (I.typ === "1" ? 0.6 : 0.3) / 1000, R5 = I.Ed * M * I.sg / (e + cc * I.Lf) / (M + Pm);
    return { steps: [R("R1", L`R_{Hollandais}`, L`\dfrac{M^2\,h}{6\,e\,(M + P)}`, R1, "N", 1), R("R2", L`R_{Redtenbacher}`, L`\dfrac{S\,E}{3\,L}\left[-e + \sqrt{e^2 + \dfrac{2\,L\,M^2 h}{S\,E\,(M + P)}}\right]`, R2, "N", 1),
      S("R3", L`R_{Crandall}`, L`\dfrac{M^2\,h}{n'\,(e + e_1)\,(M + P)}`, R3, "N", 1), S("R4", L`R_{Hiley}`, L`\dfrac{M^2\,(h - h_0)}{4\,e'\,(M + P)}\min\!\left(\dfrac{M}{P}, 1\right)`, R4, "N", 1),
      S("c", "c", "~raccourcissement unitaire (Delmag)", cc, "m/m", 4), S("R5", L`R_{Delmag}`, L`\dfrac{E\,M\,\sigma}{(e + c\,L)(M + P)}`, R5, "N", 1), S("El", L`E_\ell`, "~module longitudinal retenu", El, "Pa", 0)],
      notes: ["Unités du classeur d'origine : masses en kg, hauteurs en m, forces portantes dans la même unité que le produit M·h/e (kgf si M est en kg-force). Les formules de battage donnent un ordre de grandeur : les valider par des essais de chargement et un contrôle dynamique."] };
  },
  fig(I, g) { const items = [["Hollandais", g("R1")], ["Redtenbacher", g("R2")], ["Crandall", g("R3")], ["Hiley", g("R4")], ["Delmag", g("R5")]]; return KIT.barsH(items.map(([l, v]) => ({ l, v, d: 0 })), { title: "force portante (même unité que M·h/e)" }); },
  clair: (I, g) => `Selon la formule, la force portante varie de ${f2(min(g("R1"), g("R2"), g("R3"), g("R4"), g("R5")), 0)} à ${f2(max(g("R1"), g("R2"), g("R3"), g("R4"), g("R5")), 0)} : une dispersion habituelle des formules de battage.` },

{ id: "geo-candelabre", t: "Massif de candélabre : stabilité au renversement", ref: "Biblio 2004 « Massif de candélabre » — formule d'Andrée et Norsa",
  desc: "Moment de stabilité d'un massif cubique enterré servant de fondation à un mât d'éclairage ou de signalisation, comparé au moment de renversement.",
  inputs: [N("hc", "Hauteur du mât", "m", 10, "h"), N("Pc", "Poids du mât", "kN", 11, "P"), N("Hc", "Effort horizontal en pied", "kN", 2.2, "H"), N("Mc", "Moment en pied", "kN·m", 14, "M"),
    N("a", "Côté du massif", "m", 0.9, "a"), N("hm", "Hauteur du massif", "m", 1, L`h_m`), N("qs", "Résistance du sol", "kPa", 150, L`q_s`), N("gb", "Poids volumique du béton", "kN/m³", 24, L`\gamma_b`)],
  calc(I) {
    /* formule d'origine en kg et t/m² : on travaille en daN pour la reproduire */
    const V = I.Pc * 100 + I.a * I.a * I.hm * I.gb * 100, q = I.qs * 100;
    const Ms = V * I.a / 2 - 2 * V * V / (3 * I.a * q) + 80 * I.a * I.a * q * q * I.hm ** 3 / (V * 6561), Mr = I.Mc * 100 + I.Hc * 100 * I.hm;
    return { steps: [S("V", "V", L`P + \gamma_b\,a^2\,h_m`, V / 100, "kN", 2), R("Ms", L`M_s`, L`V\dfrac a2 - \dfrac{2\,V^2}{3\,a\,q_s} + \dfrac{80\,a^2 q_s^2 h_m^3}{6561\,V}`, Ms / 100, "kN·m", 2), S("Mr", L`M_r`, L`M + H\,h_m`, Mr / 100, "kN·m", 2), R("F", "F", L`M_s / M_r`, Ms / Mr, "", 3)],
      checks: [C("Stabilité au renversement", Ms >= Mr, `F = ${fmt(Ms / Mr, 2)} ≥ 1`, Mr / Ms)],
      notes: ["Formule empirique d'Andrée et Norsa (unités d'origine : kg, m, kg/m²), qui tient compte de la butée latérale du terrain. Pour un candélabre routier, vérifier aussi la rotation du massif (déversement admissible du mât)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 185, yg = 90, k = 70 / max(I.a, I.hm), x0 = 120; let s = Rc(10, yg, W - 20, Hh - yg - 6, { f: K.soil, c: "none", op: .4 }) + P(`M10 ${yg}H${W - 10}`, { c: K.soilD });
    s += Rc(x0, yg, I.a * k, I.hm * k, { f: K.conc }) + P(`M${x0 + I.a * k / 2} ${yg}V12`, { c: K.ink, w: 4 }) + P(`M${x0 + I.a * k / 2} 12h30`, { c: K.ink, w: 2 });
    s += arrow(x0 + I.a * k / 2 - 50, 40, x0 + I.a * k / 2 - 4, 40, K.red, 1.8) + T(x0 + I.a * k / 2 - 52, 34, "vent", { a: "end", s: 9, c: K.red });
    s += T(W - 8, 30, `F = ${f2(g("F"), 2)}`, { a: "end", s: 12, w: 600 }) + T(W - 8, 48, `Ms = ${f2(g("Ms"), 1)} kN·m`, { a: "end", s: 9.5 }) + T(W - 8, 64, `Mr = ${f2(g("Mr"), 1)} kN·m`, { a: "end", s: 9.5, c: K.red });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le massif offre ${f2(g("Ms"), 1)} kN·m de moment stabilisant pour ${f2(g("Mr"), 1)} kN·m de renversement (F = ${f2(g("F"), 2)}).` },

{ id: "geo-colonnes-ballastees", t: "Colonnes ballastées sous radier rigide : réduction des tassements", ref: "Biblio 2004 « Colonnes ballastées » — méthode de Schulze, Baumann et Bauer (bulletin n° 35 du LCPC)",
  desc: "Rapport de concentration des contraintes et coefficient de réduction des tassements apportés par un maillage de colonnes ballastées sous un radier rigide.",
  inputs: [N("Es", "Module d'Young du sol", "kPa", 20000, L`E'_{sol}`), N("De", "Diamètre de la cellule (maille équivalente)", "m", 5, L`D_{ext}`), N("Dc", "Diamètre des colonnes", "m", 1, L`D_{col}`), N("phi", "Angle de frottement du ballast", "°", 35, L`\varphi_{col}`), N("s0", "Tassement sans colonnes (pour illustration)", "mm", 100, L`s_0`)],
  calc(I) {
    const Ac = PI / 4 * I.Dc ** 2, A = PI / 4 * I.De ** 2, a = Ac / A, Rc_ = I.Dc / 2, Ka = Math.tan(PI / 4 - I.phi * PI / 360) ** 2, lnr = Math.log(I.De / Rc_), Er = (1 + 2 * lnr) / Ka / lnr, b = 1 + a * (Er - 1), n = (b - 1) / a + 1;
    return { steps: [S("Ac", L`A_{col}`, L`\dfrac{\pi D_{col}^2}{4}`, Ac, "m²", 4), S("A", "A", L`\dfrac{\pi D_{ext}^2}{4}`, A, "m²", 3), S("a", L`a`, L`A_{col}/A`, a, "", 4), S("Ka", L`K_{a,col}`, L`\tan^2\!\left(\dfrac{\pi}{4} - \dfrac{\varphi_{col}}{2}\right)`, Ka, "", 5),
      S("Er", L`E'_{col}/E'_{sol}`, L`\dfrac{1 + 2\ln(D_{ext}/R_{col})}{K_{a,col}\,\ln(D_{ext}/R_{col})}`, Er, "", 4), R("b", L`\beta`, L`1 + a\left(\dfrac{E'_{col}}{E'_{sol}} - 1\right)`, b, "", 4), R("n", "n", L`\dfrac{\beta - 1}{a} + 1`, n, "", 4),
      S("s", "s", L`s_0 / \beta`, I.s0 / b, "mm", 1)],
      notes: ["n : rapport de concentration p_col / p_sol ; β : coefficient de réduction des tassements (tassement sans colonnes / tassement avec colonnes). Méthode établie pour un radier rigide ; vérifier par ailleurs la portance de la colonne (expansion latérale) et la stabilité générale."] };
  },
  fig(I, g) {
    const W = 330, Hh = 170, cx = 110, cy = 85, Rr = 70, rc = Rr * I.Dc / I.De; let s = Ci(cx, cy, Rr, { f: K.soil, c: K.soilD, op: .6 }) + Ci(cx, cy, rc, { f: "#cfc8bb", c: K.ink });
    s += dim(cx - Rr, cx + Rr, cy + Rr + 10, `D ext = ${f2(I.De, 2)} m`) + T(cx, cy + 3, `${f2(I.Dc, 2)}`, { a: "middle", s: 9 });
    s += T(220, 60, `β = ${f2(g("b"), 3)}`, { s: 12, w: 600 }) + T(220, 80, `n = ${f2(g("n"), 2)}`, { s: 10 }) + T(220, 98, `a = ${f2(g("a") * 100, 1)} %`, { s: 9.5, c: K.mute }) + T(220, 116, `s : ${f2(I.s0, 0)} → ${f2(g("s"), 0)} mm`, { s: 9.5, c: K.blue });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Avec ${f2(g("a") * 100, 1)} % de surface traitée, les tassements sont divisés par ${f2(g("b"), 2)} et les colonnes portent ${f2(g("n"), 1)} fois plus que le sol.` },

]);
})(typeof window !== "undefined" ? window : globalThis);
