/* ════════════════════════════════════════════════════════════════════
   HandBag — Chantier et méthodes (lançage, encorbellement, coffrages, levage, vérinage)
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, gauge, udl, pin, roller, ground } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d);

HB.add("Chantier et méthodes", [

{ id: "ch-lancement", t: "Lançage : moment en console avec avant-bec", ref: "Méthode du lançage (guide Sétra « Ponts poussés ») ; NF EN 1991-1-6 §4.11",
  desc: "Moment d'encorbellement sur la pile d'arrivée juste avant l'accostage, avec et sans avant-bec, et rapport au moment de service.",
  inputs: [N("Lp", "Portée à franchir", "m", 50, "L"), N("q", "Poids propre du tablier", "kN/m", 180, "q"), N("a", "Longueur de l'avant-bec", "m", 30, "a"), N("qa", "Poids linéique de l'avant-bec", "kN/m", 20, L`q_a`)],
  calc(I) {
    const Lt = I.Lp - I.a, M0 = I.q * I.Lp ** 2 / 2, Mb = I.q * Lt * Lt / 2 + I.qa * I.a * (Lt + I.a / 2), Ms = I.q * I.Lp ** 2 / 12;
    return { steps: [S("Lt", L`L - a`, "~longueur de tablier en console", Lt, "m", 2), S("M0", L`M_{sans}`, L`\dfrac{q\,L^2}{2}`, M0, "kN·m", 0), R("Mb", L`M_{avec}`, L`\dfrac{q\,(L - a)^2}{2} + q_a\,a\left(L - \dfrac{a}{2}\right)`, Mb, "kN·m", 0),
      S("gain", "", "~réduction apportée par l'avant-bec", (1 - Mb / M0) * 100, "%", 0), S("Ms", L`M_{appui}^{service}`, L`\dfrac{q L^2}{12}\ \ \text{(travée continue de référence)}`, Ms, "kN·m", 0), R("ratio", "", L`\dfrac{M_{avec}}{q L^2/12}`, Mb / Ms, "", 2)],
      notes: ["Rapport optimal usuel : $a \\approx 0{,}6$ à $0{,}65\\,L$ et $q_a/q \\approx 0{,}1$. Chaque section du tablier passe alternativement en moment positif et négatif pendant le poussage : d'où une précontrainte centrée de lançage. Prendre en compte les dénivellations d'appui (±5 à 10 mm) et le gradient thermique pendant le lançage."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, x1 = 30, x2 = 300, y = 60, k = (x2 - x1) / (I.Lp + 10), xp = x1 + 10 * k; let s = P(`M${x1} ${y}H${xp + (I.Lp - I.a) * k}`, { c: K.ink, w: 5 }) + P(`M${xp + (I.Lp - I.a) * k} ${y}L${xp + I.Lp * k} ${y + 6}`, { c: K.steel, w: 3 });
    s += Rc(xp - 6, y + 4, 12, 70, { f: K.conc, c: K.concD }) + Rc(xp + I.Lp * k - 6, y + 20, 12, 54, { f: K.conc, c: K.concD }) + ground(10, 320, y + 74);
    s += T(xp + (I.Lp - I.a) * k / 2, y - 10, "tablier", { a: "middle", s: 9 }) + T(xp + (I.Lp - I.a / 2) * k, y - 10, "avant-bec", { a: "middle", s: 9, c: K.steel }) + dim(xp, xp + I.Lp * k, y + 92, `L = ${f2(I.Lp, 0)} m`);
    s += T(W - 8, 18, `M = ${f2(g("Mb") / 1000, 1)} MN·m (sans : ${f2(g("M0") / 1000, 1)})`, { a: "end", s: 9.5, w: 500 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Juste avant d'atteindre la pile, le tablier est en console sur ${f2(I.Lp, 0)} m : l'avant-bec léger réduit le moment de ${f2(g("gain"), 0)} % (${f2(g("Mb") / 1000, 1)} MN·m au lieu de ${f2(g("M0") / 1000, 1)}).` },

{ id: "ch-poussee", t: "Lançage : effort de poussée et de retenue", ref: "Guide Sétra « Ponts poussés » ; NF EN 1337-2 (frottement des plaques de glissement)",
  desc: "Effort à développer par les vérins de poussée selon le frottement des appuis glissants et la pente du profil en long.",
  inputs: [N("W", "Poids de la partie lancée", "kN", 60000, "W"), N("mu", "Coefficient de frottement (glissement)", "%", 4, L`\mu`), N("mu0", "Coefficient de frottement au démarrage", "%", 6, L`\mu_0`), N("i", "Pente du profil (montée +)", "%", 2, "i")],
  calc(I) { const Fp = I.W * max(0, I.mu0 / 100 + I.i / 100), Fg = I.W * max(0, I.mu / 100 + I.i / 100), Fret = I.W * max(0, -I.i / 100 - I.mu / 100);
    return { steps: [R("Fp", L`F_{d\acute{e}marrage}`, L`W\,(\mu_0 + i)`, Fp, "kN", 0), R("Fg", L`F_{poussage}`, L`W\,(\mu + i)`, Fg, "kN", 0), S("Fret", L`F_{retenue}`, L`W\,(|i| - \mu)\ \ \text{(descente)}`, Fret, "kN", 0)],
      checks: [C("Pas de glissement spontané en descente : $\\mu \\ge |i|$", I.i >= 0 || I.mu >= -I.i, `µ = ${f2(I.mu, 1)} % ; i = ${f2(I.i, 1)} %`)],
      notes: ["Frottement des plaques PTFE lubrifiées : 2 à 5 % en mouvement, davantage au décollement et par temps froid. En descente, prévoir un dispositif de retenue dimensionné pour $W(|i| - \\mu_{min})$ avec un coefficient de sécurité ; en montée, la culée de réaction des vérins reprend $F_{démarrage}$."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "démarrage", v: g("Fp"), u: "kN", d: 0, c: K.red }, { l: "poussage", v: g("Fg"), u: "kN", d: 0, c: K.gold }, { l: "retenue", v: g("Fret"), u: "kN", d: 0, c: K.blue }], { title: `Pente ${f2(I.i, 1)} % · µ = ${f2(I.mu, 1)} %`, left: 80 }); },
  clair: (I, g) => `Pour faire avancer ${f2(I.W / 1000, 0)} MN de tablier, les vérins doivent pousser avec ${f2(g("Fp"), 0)} kN au démarrage puis ${f2(g("Fg"), 0)} kN en continu.` },

{ id: "ch-encorbellement", t: "Encorbellement : moment de déséquilibre du fléau", ref: "NF EN 1991-1-6 — §4.11.2, annexe A2 (ponts) ; guide Sétra « Ponts construits par encorbellement »",
  desc: "Moment de déséquilibre sur pile d'un fléau en cours de construction et effort dans les barres de clouage provisoire.",
  inputs: [N("Lf", "Longueur d'un demi-fléau", "m", 45, L`L_f`), N("q", "Poids propre linéique moyen", "kN/m", 220, "q"), N("Pv", "Poids d'un voussoir", "kN", 1200, L`P_v`), N("lv", "Longueur d'un voussoir", "m", 3.5, L`l_v`),
    N("Pe", "Poids de l'équipage mobile", "kN", 600, L`P_e`), N("b", "Largeur du tablier", "m", 12, "b"), N("qw", "Soulèvement dû au vent (sur un demi-fléau)", "kPa", 0.2, L`q_w`), N("d", "Distance entre lignes de cales", "m", 4, "d")],
  calc(I) {
    const M1 = 0.02 * I.q * I.Lf ** 2 / 2, M2 = I.Pv * (I.Lf + I.lv / 2), M3 = I.Pe * (I.Lf + 1), M4 = I.qw * I.b * I.Lf ** 2 / 2, M = M1 + M2 + M3 + M4, N_ = 2 * I.q * I.Lf, Tb = max(0, M / I.d - N_ / 2);
    return { steps: [S("M1", L`M_{2\%}`, L`0{,}02\,\dfrac{q\,L_f^2}{2}`, M1, "kN·m", 0), S("M2", L`M_{voussoir}`, L`P_v\left(L_f + \dfrac{l_v}{2}\right)`, M2, "kN·m", 0), S("M3", L`M_{\acute{e}quipage}`, L`P_e\,(L_f + 1)`, M3, "kN·m", 0),
      S("M4", L`M_{vent}`, L`q_w\,b\,\dfrac{L_f^2}{2}`, M4, "kN·m", 0), R("M", L`M_{d\acute{e}s}`, L`\sum M_i`, M, "kN·m", 0), S("N", "N", L`2\,q\,L_f`, N_, "kN", 0), R("Tb", L`T_{barres}`, L`\dfrac{M_{d\acute{e}s}}{d} - \dfrac{N}{2}`, Tb, "kN", 0)],
      notes: ["Cas de déséquilibre courant : voussoir bétonné d'un seul côté avec l'équipage, 2 % de poids propre supplémentaire d'un côté, soulèvement du vent sur un demi-fléau (EN 1991-1-6 annexe A2 : 200 N/m²). Situation transitoire : $\\gamma_G$ et $\\gamma_Q$ selon l'annexe A2 ; vérifier aussi la chute accidentelle d'un équipage (situation accidentelle)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 165, cx = 165, y = 50, k = 130 / (I.Lf + I.lv); let s = Rc(cx - 12, y + 6, 24, 100) + P(`M${cx - I.Lf * k} ${y}H${cx + I.Lf * k}`, { c: K.ink, w: 6 }) + Rc(cx + I.Lf * k, y - 3, I.lv * k, 9, { f: K.redL, c: K.red });
    s += arrow(cx + (I.Lf + I.lv / 2) * k, y - 34, cx + (I.Lf + I.lv / 2) * k, y - 5, K.red, 2) + T(cx + (I.Lf + I.lv / 2) * k - 4, y - 38, "voussoir", { a: "end", s: 9, c: K.red });
    s += P(`M${cx - 30} ${y - 30}a30 30 0 0 1 60 0`, { c: K.red, w: 1.6 }) + T(cx, y - 36, `Mdés = ${f2(g("M") / 1000, 1)} MN·m`, { a: "middle", s: 9.5, w: 500 }) + T(cx, y + 125, `barres de clouage : ${f2(g("Tb"), 0)} kN`, { a: "middle", s: 9.5, c: K.blue }) + ground(cx - 40, cx + 40, y + 106);
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Quand on bétonne un voussoir d'un seul côté, le fléau tend à basculer avec ${f2(g("M") / 1000, 1)} MN·m : les barres provisoires sur pile doivent reprendre ${f2(g("Tb"), 0)} kN.` },

{ id: "ch-coffrage", t: "Pression du béton frais sur les coffrages (CIRIA)", ref: "CIRIA Report 108 (1985) ; NF P93-350 (banches) ; DIN 18218 (comparaison)",
  desc: "Pression maximale du béton frais sur un coffrage vertical selon la vitesse de bétonnage, la température et le type de ciment.",
  inputs: [N("Hb", "Hauteur de bétonnage (verticale)", "m", 6, "H"), N("Rv", "Vitesse de montée du béton", "m/h", 2, "R"), N("Tc", "Température du béton", "°C", 15, "T"),
    SEL("C1", "Élément", [["1", "Voile (C₁ = 1,0)"], ["1.5", "Poteau, plan < 2 m (C₁ = 1,5)"]], "1", L`C_1`), SEL("C2", "Ciment", [["0.3", "CEM I sans retardateur (C₂ = 0,30)"], ["0.45", "Ciment composé ou retardateur léger (0,45)"], ["0.6", "Avec retardateur (0,60)"]], "0.45", L`C_2`),
    N("D", "Poids volumique du béton frais", "kN/m³", 25, "D")],
  calc(I) {
    const C1 = +I.C1, C2 = +I.C2, Kt = (36 / (I.Tc + 16)) ** 2, a = C1 * sqrt(I.Rv), Ph = I.D * I.Hb, Pc = I.D * (a + C2 * Kt * sqrt(max(0, I.Hb - a))), Pm = min(Pc, Ph);
    return { steps: [S("Kt", "K", L`\left(\dfrac{36}{T + 16}\right)^2`, Kt, "", 3), S("Ph", L`P_{hydro}`, L`D\,H`, Ph, "kPa", 1), S("Pc", L`P_{CIRIA}`, L`D\left[C_1\sqrt{R} + C_2\,K\sqrt{H - C_1\sqrt{R}}\right]`, Pc, "kPa", 1),
      R("Pm", L`P_{max}`, L`\min(P_{CIRIA}\ ;\ D\,H)`, Pm, "kPa", 1), S("hP", L`h_{max}`, L`P_{max}/D`, Pm / I.D, "m", 2)],
      notes: ["Béton ordinaire vibré. Pour les bétons autoplaçants, prendre la pression hydrostatique totale. La pression de calcul des banches est aussi limitée par la capacité indiquée par le fabricant (en général 60 à 80 kPa) : adapter la vitesse de bétonnage en conséquence."] };
  },
  fig(I, g) { const zs = range(0, I.Hb, 40), Pm = g("Pm"); return plot({ series: [{ pts: zs.map(z => [min(I.D * z, Pm), -z]), l: "pression de calcul" }, { pts: zs.map(z => [I.D * z, -z]), l: "hydrostatique", c: K.mute, w: 1, dash: "4 3" }], marks: [{ x: Pm, y: -g("hP"), l: `Pmax = ${f2(Pm, 0)} kPa` }], xl: "pression (kPa)", yl: "profondeur (m)", xmin: 0 }); },
  clair: (I, g) => `En montant de ${f2(I.Rv, 1)} m/h, le béton frais pousse au plus ${f2(g("Pm"), 0)} kPa sur le coffrage (contre ${f2(g("Ph"), 0)} kPa s'il restait liquide sur toute la hauteur).` },

{ id: "ch-etaiement", t: "Étaiement d'une dalle coulée en place", ref: "NF EN 12812 (étaiements) ; NF EN 1991-1-6 §4.11 (charges de construction)",
  desc: "Charge reprise par chaque étai ou pied de tour sous une dalle en cours de bétonnage, et nombre d'étais nécessaires.",
  inputs: [N("e", "Épaisseur de béton", "m", 0.45, "e"), N("g", "Poids volumique du béton armé frais", "kN/m³", 26, L`\gamma`), N("gc", "Poids du coffrage", "kN/m²", 0.5, L`g_c`), N("qc", "Charges de construction", "kN/m²", 1.5, L`q_c`),
    N("sx", "Maille des étais selon x", "m", 1.5, L`s_x`), N("sy", "Maille des étais selon y", "m", 1.5, L`s_y`), N("FR", "Charge admissible (ou résistance de calcul) d'un étai", "kN", 45, L`F_R`)],
  calc(I) { const q = 1.35 * (I.g * I.e + I.gc) + 1.5 * I.qc, F = q * I.sx * I.sy, qs = I.g * I.e + I.gc + I.qc;
    return { steps: [S("qs", L`q_{ser}`, L`\gamma\,e + g_c + q_c`, qs, "kN/m²", 2), S("qd", L`q_d`, L`1{,}35\,(\gamma e + g_c) + 1{,}5\,q_c`, q, "kN/m²", 2), R("F", L`F_{Ed}`, L`q_d\,s_x\,s_y`, F, "kN", 1), S("n", "", "~étais par m²", 1 / (I.sx * I.sy), "/m²", 2)],
      checks: [C("$F_{Ed} \\le F_R$", F <= I.FR, `${f2(F, 1)} ≤ ${f2(I.FR, 0)} kN`, F / I.FR)],
      notes: ["$F_R$ dépend de la longueur de déploiement de l'étai (abaques du fabricant, NF EN 1065). Charges de construction : 0,75 à 1,5 kN/m² selon la zone de travail (NF EN 1991-1-6) ; ajouter les effets dynamiques du bétonnage à la pompe et le vent sur les tours."] };
  },
  fig(I, g) { const W = 330, Hh = 150; let s = Rc(20, 30, 290, 16) + ground(20, 310, 135); for (let i = 0; i < 6; i++) { const x = 40 + i * 50; s += P(`M${x} 46V135`, { c: K.steel, w: 3 }); }
    s += udl(20, 310, 29, 14, K.red, 12) + dim(40, 90, 150 - 8, `sx = ${f2(I.sx, 2)} m`) + T(165, 80, `F = ${f2(g("F"), 1)} kN par étai`, { a: "middle", s: 10, w: 500 }); return svg(W, Hh, s); },
  clair: (I, g) => `Avec une maille de ${f2(I.sx, 2)} × ${f2(I.sy, 2)} m, chaque étai reçoit ${f2(g("F"), 1)} kN pendant le bétonnage (capacité ${f2(I.FR, 0)} kN).` },

{ id: "ch-verinage", t: "Vérinage du tablier (changement d'appareils d'appui)", ref: "Guide Sétra « Appareils d'appui » (remplacement) ; NF EN 1337-10 (inspection et maintenance)",
  desc: "Effort à reprendre par ligne d'appui, nombre et capacité des vérins, pression d'huile et course de levage.",
  inputs: [N("R", "Réaction permanente sur la ligne d'appui", "kN", 6500, L`R_G`), N("Rq", "Charges d'exploitation maintenues pendant le vérinage", "kN", 0, L`R_Q`), N("k", "Coefficient de majoration (incertitude, dissymétrie)", "", 1.3, "k"),
    N("n", "Nombre de vérins", "U", 5, "n"), N("Cv", "Capacité nominale d'un vérin", "kN", 2500, L`C_v`), N("Sp", "Section du piston", "cm²", 380, L`S_p`), N("u", "Course de levage visée", "mm", 5, "u")],
  calc(I) { const F = I.k * (I.R + I.Rq), Fv = F / I.n, p = Fv * 1000 / (I.Sp * 100) * 10;
    return { steps: [R("F", L`F_{v\acute{e}rinage}`, L`k\,(R_G + R_Q)`, F, "kN", 0), R("Fv", L`F_{1\ v\acute{e}rin}`, L`\dfrac{F}{n}`, Fv, "kN", 0), S("tx", "", "~taux d'utilisation d'un vérin", Fv / I.Cv * 100, "%", 0), R("p", "p", L`\dfrac{F_{1\ v\acute{e}rin}}{S_p}`, p, "bar", 0)],
      checks: [C("Vérin utilisé à moins de 80 % de sa capacité", Fv <= 0.8 * I.Cv, `${f2(Fv, 0)} ≤ ${f2(0.8 * I.Cv, 0)} kN`, Fv / (0.8 * I.Cv)), C("Course limitée (dénivellation tolérée par le tablier)", I.u <= 10, `${f2(I.u, 0)} mm`)],
      notes: ["Vérins à écrou de sécurité, alimentés par un groupe à répartition contrôlée ; zones de vérinage à justifier en pression localisée et en frettage (feuilles « Pression localisée » et « Frettes »). Les effets de la dénivellation d'appui imposée (course $u$) sur le tablier continu sont à vérifier."] };
  },
  fig(I, g) { const W = 330, Hh = 150; let s = Rc(20, 30, 290, 24) + Rc(20, 100, 290, 40); const nn = max(1, min(8, Math.round(I.n)));
    for (let i = 0; i < nn; i++) { const x = 40 + i * 250 / max(nn - 1, 1); s += Rc(x - 9, 60, 18, 40, { f: K.red, c: K.ink }) + Rc(x - 5, 54, 10, 6, { f: K.ink, c: K.ink }); }
    s += T(165, 22, `F = ${f2(g("F"), 0)} kN · ${Math.round(I.n)} vérins de ${f2(I.Cv, 0)} kN · p = ${f2(g("p"), 0)} bar`, { a: "middle", s: 9.5, w: 500 }); return svg(W, Hh, s); },
  clair: (I, g) => `Pour soulever cette ligne d'appui, chacun des ${Math.round(I.n)} vérins pousse ${f2(g("Fv"), 0)} kN (${f2(g("tx"), 0)} % de sa capacité) sous ${f2(g("p"), 0)} bar.` },

{ id: "ch-elingage", t: "Élingage d'une charge : tension dans les brins", ref: "NF EN 13414 (élingues en câble), NF EN 1492 (élingues textiles) ; règles de levage",
  desc: "Tension dans chaque brin d'une élingue selon l'angle d'élingage, et charge maximale d'utilisation requise.",
  inputs: [N("P", "Masse levée", "t", 42, "M"), N("n", "Nombre de brins porteurs", "U", 4, "n"), N("a", "Angle des brins par rapport à la verticale", "°", 30, L`\beta`), N("kd", "Coefficient dynamique", "", 1.15, L`k_d`),
    SEL("ne", "Brins réellement porteurs (charge rigide)", [["all", "Tous les brins (palonnier, charge souple)"], ["2", "2 brins seulement (charge rigide à 4 brins)"]], "2", "")],
  calc(I) { const n = I.ne === "2" ? min(2, I.n) : I.n, Tt = I.P * 9.81 * I.kd / (n * Math.cos(I.a * PI / 180)), CMU = Tt / 9.81;
    return { steps: [S("W", "W", L`M\,g`, I.P * 9.81, "kN", 0), S("ne", L`n_{eff}`, "~brins comptés", n, "", 0), R("T", "T", L`\dfrac{k_d\,M\,g}{n_{eff}\cos\beta}`, Tt, "kN", 1), R("CMU", "CMU", L`\dfrac{T}{g}`, CMU, "t", 2)],
      checks: [C("Angle d'élingage $\\beta \\le 60°$", I.a <= 60, `${f2(I.a, 0)}°`)],
      notes: ["Pour une charge rigide élinguée en 4 brins sans palonnier, on ne compte que 2 brins porteurs (hyperstaticité). La CMU de chaque brin et des points d'ancrage (crochets, inserts de levage) doit dépasser T ; inserts : feuilles « Levage des poutres »."] };
  },
  fig(I, g) { const W = 330, Hh = 160, cx = 165, a = I.a * PI / 180, h = 80; let s = Ci(cx, 18, 6, { f: "none", c: K.ink, w: 2 }) + Rc(cx - 110, 18 + h + 4, 220, 30, { f: K.conc, c: K.concD });
    [-1, 1].forEach(sg => { s += P(`M${cx} 24L${cx + sg * h * Math.tan(a)} ${18 + h + 4}`, { c: K.red, w: 2 }); }); s += P(`M${cx} 24V${18 + h}`, { c: K.mute, dash: "3 3" }) + P(`M${cx} 60a36 36 0 0 1 ${36 * Math.sin(a)} ${36 * Math.cos(a) - 36}`, { c: K.mute });
    s += T(cx + 10, 56, `β = ${f2(I.a, 0)}°`, { s: 9.5 }) + T(cx, Hh - 6, `T = ${f2(g("T"), 0)} kN par brin (CMU ≥ ${f2(g("CMU"), 1)} t)`, { a: "middle", s: 9.5, w: 500, c: K.red }); return svg(W, Hh, s); },
  clair: (I, g) => `Avec des brins inclinés à ${f2(I.a, 0)}°, chaque brin porteur est tendu à ${f2(g("T"), 0)} kN : il faut des élingues d'au moins ${f2(g("CMU"), 1)} t de CMU.` },

{ id: "ch-maturite", t: "Résistance du béton au jeune âge : décoffrage et mise en tension", ref: "NF EN 1992-1-1 — §3.1.2 (3.1), (3.2), annexe B.10 (âge corrigé de la température)",
  desc: "Évolution de la résistance moyenne avec l'âge corrigé de la température, et délai pour atteindre une résistance cible (décoffrage, mise en tension).",
  inputs: [N("fck", "Classe de résistance", "MPa", 35, L`f_{ck}`), SEL("s", "Type de ciment", [["0.2", "Classe R : CEM 42,5 R, 52,5 (s = 0,20)"], ["0.25", "Classe N : CEM 32,5 R, 42,5 N (s = 0,25)"], ["0.38", "Classe S : CEM 32,5 N (s = 0,38)"]], "0.25", "s"),
    N("Tm", "Température moyenne du béton", "°C", 12, "T"), N("fc", "Résistance cible (moyenne)", "MPa", 25, L`f_{cm,cible}`)],
  calc(I) {
    const fcm = I.fck + 8, s = +I.s, fT = exp(-(4000 / (273 + I.Tm) - 13.65)), b = t => exp(s * (1 - sqrt(28 / t))), r = I.fc / fcm;
    const te = r < 1 ? 28 / (1 - Math.log(r) / s) ** 2 : NaN, tr = te / fT;
    return { steps: [S("fcm", L`f_{cm}`, L`f_{ck} + 8`, fcm, "MPa", 0), S("fT", "", L`e^{-\left(\frac{4000}{273 + T} - 13{,}65\right)}` + "\\quad\\text{(facteur de maturité)}", fT, "", 3),
      S("te", L`t_T`, L`28\left[1 - \dfrac{\ln(f_{cible}/f_{cm})}{s}\right]^{-2}`, te, "j", 2), R("tr", "t", L`\dfrac{t_T}{e^{-(4000/(273+T) - 13{,}65)}}`, tr, "jours", 1), S("f3", L`f_{cm}(3\ \text{j})`, L`\beta_{cc}(t_3)\,f_{cm}`, b(3 * fT) * fcm, "MPa", 1), S("f7", L`f_{cm}(7\ \text{j})`, "", b(7 * fT) * fcm, "MPa", 1)],
      checks: [C("Cible inférieure à la résistance à 28 jours", r < 1, `${f2(I.fc, 1)} < ${f2(fcm, 0)} MPa`)],
      notes: ["$\\beta_{cc}(t) = \\exp\\{s[1 - (28/t)^{1/2}]\\}$ avec l'âge équivalent $t_T$ (annexe B, (B.10)). Valeur moyenne : pour une décision de décoffrage ou de mise en tension, se fonder sur des éprouvettes conservées dans les conditions du chantier ou des mesures de maturité."] };
  },
  fig(I, g) { const fcm = I.fck + 8, s = +I.s, fT = exp(-(4000 / (273 + I.Tm) - 13.65)), ts = range(0.5, 28, 80); return plot({ series: [{ pts: ts.map(t => [t, exp(s * (1 - sqrt(28 / (t * fT)))) * fcm]), l: `fcm(t) à ${f2(I.Tm, 0)} °C` }, { pts: ts.map(t => [t, exp(s * (1 - sqrt(28 / t))) * fcm]), l: "à 20 °C", c: K.mute, w: 1, dash: "4 3" }], hlines: [{ y: I.fc, l: `cible ${f2(I.fc, 0)} MPa`, c: K.red }], marks: isFinite(g("tr")) && g("tr") <= 28 ? [{ x: g("tr"), y: I.fc, l: `${f2(g("tr"), 1)} j` }] : [], xl: "âge réel (jours)", yl: "MPa", ymin: 0 }); },
  clair: (I, g) => `À ${f2(I.Tm, 0)} °C, le béton atteint ${f2(I.fc, 0)} MPa au bout d'environ ${f2(g("tr"), 1)} jours (${f2(g("te"), 1)} jours à 20 °C).` },
]);
})(typeof window !== "undefined" ? window : globalThis);
