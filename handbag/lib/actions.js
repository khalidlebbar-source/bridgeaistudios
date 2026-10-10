/* ════════════════════════════════════════════════════════════════════
   HandBag — Actions sur les ponts (NF EN 1990/A1, 1991-1-1, -1-4, -1-5, -1-7, -2 ; Fascicule 61 titre II)
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, logRange, gauge, udl, tag } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), ln = Math.log;
const ALPHA = { 1: { Q1: 1, Qi: 1, q1: 1, qi: 1.2, qr: 1.2 }, 2: { Q1: 0.9, Qi: 0.8, q1: 0.7, qi: 1, qr: 1 }, 3: { Q1: 0.8, Qi: 0.5, q1: 0.5, qi: 1, qr: 1 }, EN: { Q1: 1, Qi: 1, q1: 1, qi: 1, qr: 1 } };
const CLASSE = [["1", "1ère classe (AN)"], ["2", "2e classe (AN)"], ["3", "3e classe (AN)"], ["EN", "Valeurs recommandées EN (α = 1)"]];
function lanes(w) { const n = w < 5.4 ? 1 : w < 6 ? 2 : Math.floor(w / 3), wl = w < 5.4 ? 3 : w < 6 ? w / 2 : 3; return { n, wl, wr: w - n * wl }; }

/* vue en plan d'une chaussée découpée en voies conventionnelles */
function lanesFig(w, ln_, extra) {
  const W = 330, Hh = 150, k = 290 / w, x0 = 20; let s = Rc(x0, 30, w * k, 90, { f: "#f1eee8", c: K.concD });
  for (let i = 0; i < ln_.n; i++) { const x = x0 + i * ln_.wl * k; s += Rc(x, 30, ln_.wl * k, 90, { f: i === 0 ? K.redL : i === 1 ? "#f8e1c8" : "#eef0f4", c: "#fff", w: 1.5 }) + T(x + ln_.wl * k / 2, 46, `voie ${i + 1}`, { a: "middle", s: 9, w: 500 });
    if (i < 3) [0.5, 2.5].forEach(dx => [60, 90].forEach(y => { s += Rc(x + (ln_.wl - 3) / 2 * k + dx * k - 6, y, 12, 9, { f: K.ink, c: K.ink, r: 1.5 }); })); }
  if (ln_.wr > 0.01) s += T(x0 + (ln_.n * ln_.wl + ln_.wr / 2) * k, 46, "aire", { a: "middle", s: 8.5, c: K.mute }) + T(x0 + (ln_.n * ln_.wl + ln_.wr / 2) * k, 58, "restante", { a: "middle", s: 8.5, c: K.mute });
  s += dim(x0, x0 + w * k, 136, `w = ${f2(w, 2)} m`);
  return svg(W, Hh, s + (extra || ""));
}

HB.add("Actions sur les ponts", [

{ id: "act-lm1", t: "Trafic routier : modèle de charge LM1", ref: "NF EN 1991-2 — §4.2.3, §4.3.2, tableau 4.2 ; AN française (coefficients α par classe)",
  desc: "Découpage de la chaussée en voies conventionnelles, tandems TS et charges réparties UDL ajustées par les coefficients α.",
  inputs: [N("w", "Largeur chargeable", "m", 10.5, "w"), N("L", "Longueur chargée (ligne d'influence)", "m", 40, "L"), SEL("cl", "Classe de trafic", CLASSE, "2", "")],
  calc(I) {
    const l = lanes(I.w), a = ALPHA[I.cl], Q = [300, 200, 100], q = i => i === 0 ? 9 : 2.5, rows = [];
    let tot = 0;
    for (let i = 0; i < l.n; i++) { const aQ = i === 0 ? a.Q1 : a.Qi, aq = i === 0 ? a.q1 : a.qi, TS = i < 3 ? 2 * aQ * Q[i] : 0, U = aq * q(i) * l.wl * I.L; tot += TS + U; rows.push([`Voie ${i + 1}`, i < 3 ? aQ * Q[i] : 0, aq * q(i), TS + U]); }
    const Ur = a.qr * 2.5 * l.wr * I.L; tot += Ur; if (l.wr > 0) rows.push(["Aire restante", 0, a.qr * 2.5, Ur]);
    return { steps: [R("n", L`n_l`, I.w < 5.4 ? L`1\ \ (w < 5{,}4\ \text{m})` : I.w < 6 ? L`2\ \ (5{,}4 \le w < 6\ \text{m})` : L`\text{Ent}\left(\dfrac{w}{3}\right)`, l.n, "voies", 0), S("wl", L`w_l`, "~largeur d'une voie", l.wl, "m", 2), S("wr", L`w_r`, L`w - n_l\,w_l`, l.wr, "m", 2),
      S("aQ", L`\alpha_{Q1}\ ;\ \alpha_{Qi}`, "", `${f2(a.Q1, 2)} ; ${f2(a.Qi, 2)}`, "", 0), S("aq", L`\alpha_{q1}\ ;\ \alpha_{qi}\ ;\ \alpha_{qr}`, "", `${f2(a.q1, 2)} ; ${f2(a.qi, 2)} ; ${f2(a.qr, 2)}`, "", 0),
      R("tot", L`\textstyle\sum Q`, L`\sum_i 2\,\alpha_{Qi}Q_{ik} + \sum_i \alpha_{qi}q_{ik}\,w_l\,L + \alpha_{qr}q_{rk}\,w_r\,L`, tot, "kN", 0), S("moy", "", "~charge moyenne équivalente", tot / (I.w * I.L), "kN/m²", 2)],
      tables: [{ title: "Charges par voie", head: ["", "$\\alpha_Q Q_{k}$ par essieu (kN)", "$\\alpha_q q_k$ (kN/m²)", "Total (kN)"], rows, d: [0, 2, 0] }],
      notes: ["$Q_{1k} = 300$, $Q_{2k} = 200$, $Q_{3k} = 100$ kN par essieu (2 essieux par tandem, entraxe 1,20 m, roues à 2,00 m) ; $q_{1k} = 9$, $q_{ik} = q_{rk} = 2{,}5$ kN/m². Les valeurs incluent l'amplification dynamique. Coefficients α : valeurs de l'AN française selon la classe de trafic (à confirmer par le marché)."] };
  },
  fig(I, g) { return lanesFig(I.w, lanes(I.w)); },
  clair: (I, g) => `La chaussée de ${f2(I.w, 1)} m compte ${g("n")} voie(s) conventionnelle(s) ; sur ${f2(I.L, 0)} m, le trafic LM1 représente ${f2(g("tot"), 0)} kN, soit ${f2(g("moy"), 2)} kN/m² en moyenne.` },

{ id: "act-freinage-lm1", t: "Freinage et accélération routiers (LM1)", ref: "NF EN 1991-2 — §4.4.1 (4.6) ; AN française",
  desc: "Force longitudinale de freinage appliquée au niveau de la chaussée, fonction de la longueur chargée et de la voie n° 1.",
  inputs: [N("L", "Longueur du tablier (ou de la partie concernée)", "m", 80, "L"), N("w1", "Largeur de la voie n° 1", "m", 3, L`w_1`), SEL("cl", "Classe de trafic", CLASSE, "2", "")],
  calc(I) {
    const a = ALPHA[I.cl], Qr = 0.6 * a.Q1 * 2 * 300 + 0.1 * a.q1 * 9 * I.w1 * I.L, Ql = min(900, max(180 * a.Q1, Qr));
    return { steps: [S("t1", "", "~part des tandems : $0{,}6\\,\\alpha_{Q1}(2Q_{1k})$", 0.6 * a.Q1 * 600, "kN", 0), S("t2", "", "~part de l'UDL : $0{,}10\\,\\alpha_{q1}q_{1k}w_1L$", 0.1 * a.q1 * 9 * I.w1 * I.L, "kN", 0),
      S("Qr", L`Q_{lk}^{brut}`, L`0{,}6\,\alpha_{Q1}(2Q_{1k}) + 0{,}10\,\alpha_{q1}\,q_{1k}\,w_1\,L`, Qr, "kN", 0), R("Ql", L`Q_{lk}`, L`180\,\alpha_{Q1} \le Q_{lk} \le 900\ \text{kN}`, Ql, "kN", 0), S("acc", L`Q_{acc}`, "~accélération : même valeur, sens opposé", Ql, "kN", 0)],
      notes: ["Force uniformément répartie sur la longueur chargée, appliquée dans l'axe de la voie n° 1 au niveau de la chaussée. Sa distribution entre les appuis se fait au prorata des raideurs (feuille « Répartition des efforts horizontaux »)."] };
  },
  fig(I, g) { const a = ALPHA[I.cl]; return plot({ series: [{ pts: range(0, 300, 60).map(x => [x, min(900, max(180 * a.Q1, 0.6 * a.Q1 * 600 + 0.1 * a.q1 * 9 * I.w1 * x))]), l: "Qlk selon la longueur" }], hlines: [{ y: 900, l: "plafond 900 kN", c: K.mute }], marks: [{ x: min(I.L, 300), y: g("Ql"), l: `${f2(g("Ql"), 0)} kN` }], xl: "longueur chargée L (m)", yl: "kN", ymin: 0, ymax: 1000 }); },
  clair: (I, g) => `Un convoi qui freine sur l'ouvrage le pousse de ${f2(g("Ql"), 0)} kN dans le sens de la circulation.` },

{ id: "act-systeme-b", t: "Fascicule 61 : systèmes de charges Bc, Bt et Br", ref: "Fascicule 61 titre II — art. 5.2 à 5.4, coefficients bc et bt",
  desc: "Charges des camions Bc, tandems Bt et roue Br pour un nombre de files donné, avec le coefficient de majoration dynamique.",
  inputs: [SEL("cl", "Classe du pont", [["1", "1ère classe"], ["2", "2e classe"], ["3", "3e classe"]], "1", ""), N("nf", "Nombre de files de camions Bc", "U", 2, L`n_f`), N("delta", "Coefficient de majoration dynamique", "", 1.12, L`\delta_B`)],
  calc(I) {
    const nf = max(1, Math.round(I.nf)), BC = { 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1, 1], 3: [1, 0.8] }[I.cl], bc = BC[min(nf, BC.length) - 1], bt = I.cl === "1" ? 1 : I.cl === "2" ? 0.9 : 0;
    const Bc = nf * 2 * 300 * bc * I.delta, Bt = min(nf, 2) * 2 * 160 * bt * I.delta, Br = 100 * I.delta;
    return { steps: [S("bc", L`b_c`, "~selon la classe et le nombre de files", bc, "", 2), R("Bc", L`B_c`, L`n_f \times 2 \times 300\ \text{kN} \times b_c\,\delta_B`, Bc, "kN", 0), S("bt", L`b_t`, "~tandems Bt (1ère et 2e classe)", bt, "", 2),
      R("Bt", L`B_t`, L`\min(n_f ; 2) \times 2 \times 160\ \text{kN} \times b_t\,\delta_B`, Bt, "kN", 0), S("Br", L`B_r`, L`100\ \text{kN} \times \delta_B`, Br, "kN", 0)],
      notes: ["Camion Bc : 30 t (essieux 6 t + 12 t + 12 t, 4,50 m puis 1,50 m), 2 camions par file. Tandem Bt : 2 essieux de 16 t à 1,35 m. Roue Br : 10 t sur 0,60 × 0,30 m. $\\delta_B$ : feuille « Coefficient de majoration dynamique ». Le BAEL/BPEL combine ces charges avec $\\gamma_Q = 1{,}6$ (ELU) / 1,2 (ELS)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 140; let s = P("M10 100H320", { c: K.ink, w: 2 });
    [[0, 60], [45, 120], [60, 120], [105, 60], [150, 120], [165, 120]].forEach(([x, p], i) => { s += arrow(x + 60, 100 - p * 0.45 - 10, x + 60, 98, K.red, 2) + (i % 3 === 0 ? T(x + 60, 100 - p * 0.45 - 14, "6 t", { a: "middle", s: 8.5, c: K.red }) : i % 3 === 2 ? T(x + 52, 100 - p * 0.45 - 14, "2 × 12 t", { a: "middle", s: 8.5, c: K.red }) : ""); });
    s += dim(60, 105, 112, "4,50") + dim(105, 120, 112, "1,50");
    s += T(165, 124, `Bc : ${Math.round(I.nf)} file(s) × 2 camions de 30 t · bc = ${f2(g("bc"), 2)}`, { a: "middle", s: 9.5 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Avec ${Math.round(I.nf)} file(s) de camions Bc, la charge totale atteint ${f2(g("Bc"), 0)} kN, majoration dynamique comprise.` },

{ id: "act-militaires", t: "Fascicule 61 : charges militaires Mc80 et Mc120", ref: "Fascicule 61 titre II — art. 9 (charges militaires)",
  desc: "Char sur chenilles réparti sur la longueur de contact et moment maximal produit sur une travée isostatique.",
  inputs: [SEL("type", "Convoi", [["120", "Mc120 (110 t sur 6,10 m)"], ["80", "Mc80 (72 t sur 4,90 m)"]], "120", ""), N("L", "Portée isostatique", "m", 25, "L"), N("delta", "Coefficient de majoration dynamique", "", 1.1, L`\delta_M`)],
  calc(I) {
    const P_ = I.type === "120" ? 1100 : 720, a = I.type === "120" ? 6.1 : 4.9, q = P_ / a, M = P_ * I.delta * (2 * I.L - a) / 8, V = P_ * I.delta * (1 - a / (2 * I.L));
    return { steps: [S("P", "P", "~masse totale du convoi", P_, "kN", 0), S("a", "a", "~longueur des chenilles", a, "m", 2), S("q", "q", L`\dfrac{P}{a}` + "\\quad\\text{(2 chenilles)}", q, "kN/m", 1),
      R("M", L`M_{max}`, L`\delta_M\,\dfrac{P\,(2L - a)}{8}`, M, "kN·m", 0), R("V", L`V_{max}`, L`\delta_M\,P\left(1 - \dfrac{a}{2L}\right)`, V, "kN", 0)],
      notes: ["Mc120 : chenilles de 6,10 × 1,00 m à 3,30 m d'entraxe ; Mc80 : chenilles de 4,90 × 0,85 m. Distance libre minimale de 30,50 m entre deux chars successifs. Coefficient de majoration dynamique propre aux charges militaires. Les charges militaires ne se cumulent pas avec les systèmes A et B."] };
  },
  fig(I, g) { const a = g("a"); return KIT.beamDiag({ L: I.L, loads: [], q: null, f: x => { const x1 = (I.L - a) / 2, x2 = x1 + a, R1 = g("P") / 2; return x < x1 ? R1 * x : x <= x2 ? R1 * x - g("q") * (x - x1) ** 2 / 2 : R1 * (I.L - x); }, marks: [{ x: I.L / 2, l: `M = ${f2(g("M"), 0)} kN·m (avec δ)` }], label: `char ${I.type === "120" ? "Mc120" : "Mc80"} centré` }).replace("</svg>", `<rect x="${26 + 286 * (I.L - a) / 2 / I.L}" y="18" width="${286 * a / I.L}" height="14" fill="${K.ink}" opacity=".7" rx="4"/></svg>`); },
  clair: (I, g) => `Un char ${I.type === "120" ? "Mc120" : "Mc80"} centré sur ${f2(I.L, 0)} m produit ${f2(g("M"), 0)} kN·m au milieu de la travée.` },

{ id: "act-trottoirs", t: "Charges sur trottoirs et passerelles", ref: "NF EN 1991-2 — §5.3.2.1 (5.1) ; §4.5.1 (valeur de combinaison 3 kN/m²) ; Fascicule 61 art. 12",
  desc: "Charge de foule sur les trottoirs des ponts routiers et charge uniforme des passerelles selon la longueur chargée.",
  inputs: [N("L", "Longueur chargée", "m", 40, "L"), N("b", "Largeur du trottoir ou de la passerelle", "m", 2.5, "b")],
  calc(I) {
    const qp = min(5, max(2.5, 2 + 120 / (I.L + 30)));
    return { steps: [S("qt", L`q_{fk}`, "~trottoir de pont routier (valeur caractéristique)", 5, "kN/m²", 1), S("qc", L`q_{fk}^{comb}`, "~en groupe avec LM1 (gr1a)", 3, "kN/m²", 1),
      R("qp", L`q_{fk}^{pass}`, L`2{,}0 + \dfrac{120}{L + 30}\ \in [2{,}5 ; 5{,}0]`, qp, "kN/m²", 2), R("Qp", "", "~charge linéique de la passerelle", qp * I.b, "kN/m", 2),
      S("F61", "", "~Fascicule 61 : 150 kg/m² (général) ou 450 kg/m² (local)", "1,5 / 4,5", "kN/m²", 0), S("Qfwk", L`Q_{fwk}`, "~charge concentrée (vérifications locales)", 10, "kN", 0)],
      notes: ["Pour les passerelles, prévoir aussi un véhicule de service $Q_{serv}$ si l'accès d'engins est possible (§5.3.2.3) et les vérifications de confort vibratoire (feuille « Passerelle : fréquences propres »)."] };
  },
  fig(I, g) { return plot({ series: [{ pts: range(1, 200, 80).map(l => [l, min(5, max(2.5, 2 + 120 / (l + 30)))]), l: "passerelle : qfk(L)" }], hlines: [{ y: 5, l: "trottoir routier 5 kN/m²", c: K.mute }, { y: 3, l: "combinaison avec LM1", c: K.blue }], marks: [{ x: min(I.L, 200), y: g("qp"), l: `${f2(g("qp"), 2)} kN/m²` }], xl: "longueur chargée (m)", yl: "kN/m²", ymin: 0, ymax: 6 }); },
  clair: (I, g) => `Une passerelle de ${f2(I.L, 0)} m se calcule avec une foule de ${f2(g("qp"), 2)} kN/m², soit ${f2(g("Qp"), 1)} kN par mètre sur ${f2(I.b, 1)} m de large.` },

{ id: "act-vent", t: "Vent sur un tablier de pont (méthode simplifiée)", ref: "NF EN 1991-1-4 — §4.2 à 4.5, §8.3.2 (8.2), figure 8.3 ; AN française (zones, catégories de terrain)",
  desc: "Pression dynamique de pointe à la hauteur du tablier et force transversale par mètre de tablier (sans et avec trafic).",
  inputs: [SEL("zone", "Zone de vent (vb,0)", [["22", "Zone 1 (22 m/s)"], ["24", "Zone 2 (24 m/s)"], ["26", "Zone 3 (26 m/s)"], ["28", "Zone 4 (28 m/s)"]], "24", L`v_{b,0}`),
    SEL("cat", "Catégorie de terrain", [["0.005/1", "0 — mer, lacs"], ["0.05/2", "II — rase campagne"], ["0.2/5", "IIIa — campagne avec haies"], ["0.5/9", "IIIb — zones industrielles, bocage"], ["1/15", "IV — zones urbaines"]], "0.05/2", ""),
    N("z", "Hauteur du tablier au-dessus du sol", "m", 15, "z"), N("b", "Largeur du tablier", "m", 12, "b"), N("d", "Hauteur exposée (tablier + équipements)", "m", 3.2, L`d_{tot}`),
    N("cdir", "Coefficients de direction × saison", "", 1, L`c_{dir}c_{season}`), N("kl", "Coefficient de turbulence", "", 1, L`k_l`)],
  calc(I) {
    const [z0, zmin] = I.cat.split("/").map(Number), vb = I.cdir * +I.zone, ze = max(I.z, zmin), kr = 0.19 * pow(z0 / 0.05, 0.07), cr = kr * ln(ze / z0), vm = cr * vb, Iv = I.kl / ln(ze / z0);
    const qp = (1 + 7 * Iv) * 0.5 * 1.225 * vm * vm / 1000, r = I.b / I.d, cf = r <= 0.5 ? 2.4 : r >= 4 ? 1.3 : 2.4 - (r - 0.5) * 1.1 / 3.5, F = qp * cf * I.d;
    return { steps: [S("vb", L`v_b`, L`c_{dir}\,c_{season}\,v_{b,0}`, vb, "m/s", 1), S("kr", L`k_r`, L`0{,}19\left(\dfrac{z_0}{z_{0,II}}\right)^{0{,}07}`, kr, "", 4), S("cr", L`c_r(z)`, L`k_r\ln\dfrac{z}{z_0}`, cr, "", 4),
      S("Iv", L`I_v(z)`, L`\dfrac{k_l}{c_0\ln(z/z_0)}`, Iv, "", 4), R("qp", L`q_p(z)`, L`\left[1 + 7\,I_v(z)\right]\tfrac{1}{2}\,\rho\,v_m^2`, qp, "kN/m²", 3),
      S("cf", L`c_{f,x}`, L`f\!\left(\dfrac{b}{d_{tot}}\right)\ \text{(fig. 8.3 linéarisée)}`, cf, "", 3), R("F", L`F_w`, L`q_p(z)\,c_{f,x}\,d_{tot}`, F, "kN/m", 2)],
      notes: ["$c_0 = 1$ (orographie plane), $\\rho = 1{,}225$ kg/m³. $d_{tot}$ : hauteur du tablier + corniches + dispositifs de retenue pleins, ou + 2 m de véhicules (trafic, hauteur 2 m sur la voie la plus défavorable) — dans ce cas la vitesse de base est plafonnée à 23 m/s (AN). L'AN donne aussi une formule pour $k_l$ selon $z_0$."] };
  },
  fig(I, g) {
    const [z0, zmin] = I.cat.split("/").map(Number), vb = I.cdir * +I.zone, kr = 0.19 * pow(z0 / 0.05, 0.07), q = z => { const ze = max(z, zmin); const vm = kr * ln(ze / z0) * vb; return (1 + 7 * I.kl / ln(ze / z0)) * 0.5 * 1.225 * vm * vm / 1000; };
    const zs = range(1, max(60, I.z * 1.5), 60);
    return plot({ series: [{ pts: zs.map(z => [q(z), z]), l: "qp(z)" }], marks: [{ x: g("qp"), y: I.z, l: `${f2(g("qp"), 2)} kN/m² à ${f2(I.z, 0)} m` }], xl: "qp (kN/m²)", yl: "hauteur z (m)", ymin: 0, xmin: 0 });
  },
  clair: (I, g) => `À ${f2(I.z, 0)} m de hauteur, le vent exerce une pression de pointe de ${f2(g("qp"), 2)} kN/m², soit ${f2(g("F"), 1)} kN par mètre de tablier.` },

{ id: "act-temp-uniforme", t: "Température uniforme et dilatation du tablier", ref: "NF EN 1991-1-5 — §6.1.3, figure 6.1 ; AN française (T₀, majoration pour appareils d'appui)",
  desc: "Températures effectives extrêmes du tablier, variations de contraction et de dilatation, déplacements au droit des appareils d'appui et joints.",
  inputs: [SEL("type", "Type de tablier", [["1", "Type 1 : acier"], ["2", "Type 2 : mixte"], ["3", "Type 3 : béton"]], "3", ""), N("Tmin", "Température minimale de l'air (sous abri, 50 ans)", "°C", -15, L`T_{min}`),
    N("Tmax", "Température maximale de l'air", "°C", 38, L`T_{max}`), N("T0", "Température initiale (blocage)", "°C", 10, L`T_0`), N("Lp", "Distance au point fixe", "m", 60, L`L_{fixe}`),
    N("alpha", "Coefficient de dilatation", "×10⁻⁶ /K", 10, L`\alpha_T`), N("maj", "Majoration pour appareils d'appui et joints", "K", 20, L`\Delta T_{appui}`)],
  calc(I) {
    const t = I.type, Te_max = I.Tmax + (t === "1" ? 16 : t === "2" ? 4.5 : 1.5), Te_min = I.Tmin + (t === "1" ? -3 : t === "2" ? 4.5 : 8);
    const dcon = I.T0 - Te_min, dexp = Te_max - I.T0, a = I.alpha * 1e-6, ucon = a * (dcon + I.maj) * I.Lp * 1000, uexp = a * (dexp + I.maj) * I.Lp * 1000;
    return { steps: [S("Temax", L`T_{e,max}`, t === "1" ? L`T_{max} + 16` : t === "2" ? L`T_{max} + 4{,}5` : L`T_{max} + 1{,}5`, Te_max, "°C", 1), S("Temin", L`T_{e,min}`, t === "1" ? L`T_{min} - 3` : t === "2" ? L`T_{min} + 4{,}5` : L`T_{min} + 8`, Te_min, "°C", 1),
      R("dcon", L`\Delta T_{N,con}`, L`T_0 - T_{e,min}`, dcon, "K", 1), R("dexp", L`\Delta T_{N,exp}`, L`T_{e,max} - T_0`, dexp, "K", 1), S("dN", L`\Delta T_N`, L`T_{e,max} - T_{e,min}`, Te_max - Te_min, "K", 1),
      R("ucon", L`u_{con}`, L`\alpha_T\,(\Delta T_{N,con} + \Delta T_{appui})\,L`, ucon, "mm", 1), R("uexp", L`u_{exp}`, L`\alpha_T\,(\Delta T_{N,exp} + \Delta T_{appui})\,L`, uexp, "mm", 1)],
      notes: ["Relations de la figure 6.1 (températures sous abri, période de retour 50 ans, cartes de l'AN). La majoration de 20 K s'applique au dimensionnement des appareils d'appui et des joints lorsque la température de pose n'est pas connue (§6.1.3.3 (3)) ; elle peut être réduite si la température de réglage est maîtrisée. $\\alpha_T = 10^{-5}$ /K (béton), $1{,}2\\cdot10^{-5}$ (acier ; mixte : $10^{-5}$ pour l'ensemble)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "contraction", v: g("ucon"), u: "mm", d: 1, c: K.blue }, { l: "dilatation", v: g("uexp"), u: "mm", d: 1, c: K.red }], { title: `Te de ${f2(g("Temin"), 1)} à ${f2(g("Temax"), 1)} °C · ${f2(I.Lp, 0)} m du point fixe`, left: 80 }); },
  clair: (I, g) => `Entre l'hiver et l'été, le tablier varie de ${f2(g("dN"), 0)} °C : à ${f2(I.Lp, 0)} m du point fixe il se raccourcit de ${f2(g("ucon"), 0)} mm et s'allonge de ${f2(g("uexp"), 0)} mm (majoration comprise).` },

{ id: "act-gradient", t: "Gradient thermique vertical du tablier", ref: "NF EN 1991-1-5 — §6.1.4.1, tableaux 6.1 et 6.2 ; §6.1.5 (simultanéité)",
  desc: "Différences de température linéaires (fibre supérieure plus chaude ou plus froide) et moment hyperstatique dans une poutre continue.",
  inputs: [SEL("type", "Type de tablier", [["1", "Type 1 : acier"], ["2", "Type 2 : mixte"], ["3c", "Type 3 : caisson béton"], ["3p", "Type 3 : poutres béton"], ["3d", "Type 3 : dalle béton"]], "3c", ""),
    SEL("sur", "Revêtement", [["0", "Sans revêtement"], ["e", "Étanché (foncé)"], ["50", "50 mm"], ["100", "100 mm"], ["150", "150 mm"]], "100", ""),
    N("EI", "Rigidité de flexion du tablier", "MN·m²", 3.5e5, "EI"), N("h", "Hauteur du tablier", "m", 2.5, "h"), N("alpha", "Coefficient de dilatation", "×10⁻⁶ /K", 10, L`\alpha_T`)],
  calc(I) {
    const TM = { 1: [18, 13], 2: [15, 18], "3c": [10, 5], "3p": [15, 8], "3d": [15, 8] }[I.type], fam = I.type[0];
    const KS = { 1: { 0: [0.7, 0.9], e: [1.6, 0.6], 50: [1, 1], 100: [0.7, 1.2], 150: [0.7, 1.2] }, 2: { 0: [0.9, 1], e: [1.1, 0.9], 50: [1, 1], 100: [1, 1], 150: [1, 1] }, 3: { 0: [0.8, 1.1], e: [1.5, 1], 50: [1, 1], 100: [0.7, 1], 150: [0.5, 1] } }[fam][I.sur];
    const dh = TM[0] * KS[0], dc = TM[1] * KS[1], a = I.alpha * 1e-6, Mf = I.EI * a * dh / I.h * 1000, M2 = 1.5 * Mf;
    return { steps: [S("TMh", L`\Delta T_{M,heat}`, "~tableau 6.1", TM[0], "K", 0), S("TMc", L`\Delta T_{M,cool}`, "~tableau 6.1", TM[1], "K", 0), S("ks", L`k_{sur}`, "~tableau 6.2 (chaud / froid)", `${f2(KS[0], 1)} / ${f2(KS[1], 1)}`, "", 0),
      R("dh", L`\Delta T_{M,heat}^{\,*}`, L`k_{sur}\,\Delta T_{M,heat}`, dh, "K", 1), R("dc", L`\Delta T_{M,cool}^{\,*}`, L`k_{sur}\,\Delta T_{M,cool}`, dc, "K", 1), S("k", L`\kappa`, L`\dfrac{\alpha_T\,\Delta T_M}{h}`, a * dh / I.h * 1000, "‰/m", 4),
      S("Mf", L`M_{encastré}`, L`EI\,\dfrac{\alpha_T\,\Delta T_M}{h}`, Mf, "kN·m", 0), R("M2", L`M_{B}`, L`\tfrac{3}{2}\,EI\,\dfrac{\alpha_T\,\Delta T_M}{h}` + "\\quad\\text{(2 travées égales)}", M2, "kN·m", 0)],
      notes: ["Composante linéaire seule (approche 1, §6.1.4.1) ; la composante non linéaire (approche 2) produit en outre des contraintes autoéquilibrées. Combinaison avec la température uniforme : $\\Delta T_M + \\omega_N\\Delta T_N$ ou $\\omega_M\\Delta T_M + \\Delta T_N$ avec $\\omega_N = 0{,}35$, $\\omega_M = 0{,}75$ (§6.1.5). Le moment sur appui d'une poutre continue à 2 travées égales vaut 1,5 fois le moment d'encastrement."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, top = 25, h = 100, x0 = 60; let s = Rc(x0, top, 60, h);
    const sc = 4; s += P(`M180 ${top}h${g("dh") * sc}L180 ${top + h}Z`, { c: K.red, f: K.redL, op: .7 }) + T(182 + g("dh") * sc, top + 8, `+${f2(g("dh"), 1)} K (dessus plus chaud)`, { s: 9, c: K.red });
    s += P(`M180 ${top + h}h${g("dc") * sc}L180 ${top}Z`, { c: K.blue, f: K.blueL, op: .5 }) + T(182 + g("dc") * sc, top + h, `+${f2(g("dc"), 1)} K (dessous plus chaud)`, { s: 9, c: K.blue }) + P(`M180 ${top}V${top + h}`, { c: K.ink });
    s += dimV(x0 - 8, top, top + h, `h = ${f2(I.h, 2)}`) + T(165, Hh - 8, `moment sur appui (2 travées) : ${f2(g("M2"), 0)} kN·m`, { a: "middle", s: 9.5 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Au soleil, le dessus du tablier est ${f2(g("dh"), 1)} °C plus chaud que le dessous : le tablier veut se cintrer, et la continuité crée ${f2(g("M2"), 0)} kN·m sur l'appui central.` },

{ id: "act-combinaisons", t: "Combinaisons d'actions d'un pont routier", ref: "NF EN 1990 — §6.4.3.2 (6.10), §6.5.3 ; annexe A2 tableaux A2.1, A2.4(B) et AN française",
  desc: "Valeurs de calcul d'un effet (moment, effort) aux ELU fondamentaux et aux ELS caractéristique, fréquent et quasi permanent.",
  inputs: [N("G", "Charges permanentes (structure)", "kN·m", 12000, "G"), N("Gs", "Superstructures (valeur max)", "kN·m", 2500, L`G_{sup}`), N("TS", "Trafic : tandems TS", "kN·m", 5200, "TS"), N("UDL", "Trafic : charges réparties UDL", "kN·m", 3800, "UDL"),
    N("Tk", "Gradient thermique", "kN·m", 1500, L`T_k`), N("P", "Précontrainte (effet hyperstatique, signe compris)", "kN·m", 0, "P")],
  calc(I) {
    const G = I.G + I.Gs, Q = I.TS + I.UDL, rows = [
      ["ELU — trafic dominant : $1{,}35\\,G + 1{,}35\\,(TS + UDL)$", 1.35 * G + I.P + 1.35 * Q],
      ["ELU — thermique dominant : $1{,}35\\,G + 1{,}35\\,(0{,}75\\,TS + 0{,}4\\,UDL) + 1{,}5\\,T_k$", 1.35 * G + I.P + 1.35 * (0.75 * I.TS + 0.4 * I.UDL) + 1.5 * I.Tk],
      ["ELS caractéristique : $G + TS + UDL + 0{,}6\\,T_k$", G + I.P + Q + 0.6 * I.Tk], ["ELS fréquent : $G + 0{,}75\\,TS + 0{,}4\\,UDL + 0{,}5\\,T_k$", G + I.P + 0.75 * I.TS + 0.4 * I.UDL + 0.5 * I.Tk],
      ["ELS quasi permanent : $G + 0{,}5\\,T_k$", G + I.P + 0.5 * I.Tk]];
    return { steps: [S("Gt", L`G_{tot}`, L`G + G_{sup}`, G, "kN·m", 0), R("Eu", L`E_{d,ELU}`, "~maximum des deux combinaisons fondamentales", max(rows[0][1], rows[1][1]), "kN·m", 0), R("Ec", L`E_{car}`, "", rows[2][1], "kN·m", 0), S("Ef", L`E_{fr\acute{e}q}`, "", rows[3][1], "kN·m", 0), S("Eq", L`E_{qp}`, "", rows[4][1], "kN·m", 0)],
      tables: [{ title: "Combinaisons (effets défavorables)", head: ["Combinaison", "Valeur (kN·m)"], rows, d: [0] }],
      notes: ["$\\psi_0 = 0{,}75$ (TS), 0,40 (UDL), 0,60 (température) ; $\\psi_1$ = idem pour le trafic et 0,6 pour la température ; $\\psi_2 = 0$ (trafic), 0,5 (température) selon l'AN française. Précontrainte : $\\gamma_P = 1{,}0$. Superstructures : coefficients min/max appliqués à $G_{sup}$ (voir feuille dédiée). Selon l'AN française, la température accompagnant le trafic n'est pas cumulée à l'ELU fondamental ($\\psi_0 = 0$ à l'ELU) ; vérifier ce point pour l'ouvrage."] };
  },
  fig(I, g, r) { const rr = r.tables[0].rows; return KIT.barsH([{ l: "ELU trafic", v: rr[0][1], u: "", d: 0, c: K.red }, { l: "ELU thermique", v: rr[1][1], u: "", d: 0, c: K.red }, { l: "ELS caract.", v: rr[2][1], u: "", d: 0, c: K.gold }, { l: "ELS fréquent", v: rr[3][1], u: "", d: 0, c: K.blue }, { l: "ELS quasi perm.", v: rr[4][1], u: "", d: 0, c: K.teal }], { title: "Effets combinés (kN·m)", left: 92 }); },
  clair: (I, g) => `Pour le dimensionnement à la rupture, on retient ${f2(g("Eu"), 0)} kN·m ; en service, de ${f2(g("Eq"), 0)} (quasi permanent) à ${f2(g("Ec"), 0)} kN·m (caractéristique).` },

{ id: "act-superstructures", t: "Charges permanentes de superstructures", ref: "NF EN 1991-1-1 — §5.2.3, tableau A.6 ; NF EN 1991-1-1/AN (coefficients min/max)",
  desc: "Poids des équipements du tablier par mètre linéaire, avec les valeurs minimale et maximale à considérer pour le revêtement et l'étanchéité.",
  inputs: [N("br", "Largeur revêtue", "m", 10.5, L`b_{rev}`), N("er", "Épaisseur nominale du revêtement", "cm", 8, L`e_{rev}`), N("gr", "Poids volumique de l'enrobé", "kN/m³", 24, L`\gamma_{rev}`),
    N("ge", "Étanchéité", "kN/m²", 0.3, L`g_{\acute{e}t}`), N("tr", "Trottoirs, longrines (béton)", "kN/m", 12, L`g_{tr}`), N("co", "Corniches (2 côtés)", "kN/m", 6, L`g_{co}`), N("dr", "Dispositifs de retenue et garde-corps", "kN/m", 1.5, L`g_{dr}`),
    SEL("maj", "Majoration du revêtement", [["1.4/0.8", "+40 % / −20 % (rechargement possible)"], ["1.2/0.8", "±20 % (épaisseur maîtrisée)"]], "1.4/0.8", "")],
  calc(I) {
    const [kM, km] = I.maj.split("/").map(Number), rev = I.br * I.er / 100 * I.gr, et = I.br * I.ge, fixe = I.tr + I.co + I.dr, gmax = kM * rev + 1.2 * et + fixe, gmin = km * rev + 0.8 * et + fixe;
    return { steps: [S("rev", L`g_{rev}`, L`b_{rev}\,e_{rev}\,\gamma_{rev}`, rev, "kN/m", 2), S("et", L`g_{\acute{e}t}\,b`, "", et, "kN/m", 2), S("fixe", L`g_{\acute{e}q}`, L`g_{tr} + g_{co} + g_{dr}`, fixe, "kN/m", 2),
      R("gmax", L`g_{sup,max}`, L`k_{max}\,g_{rev} + 1{,}2\,g_{\acute{e}t} + g_{\acute{e}q}`, gmax, "kN/m", 2), R("gmin", L`g_{sup,min}`, L`k_{min}\,g_{rev} + 0{,}8\,g_{\acute{e}t} + g_{\acute{e}q}`, gmin, "kN/m", 2), S("gnom", L`g_{sup,nom}`, "", rev + et + fixe, "kN/m", 2)],
      notes: ["Poids volumiques usuels : enrobé 23 à 24 kN/m³, béton armé 25 kN/m³, asphalte coulé 24 kN/m³. Pour les éléments préfabriqués et les dispositifs de retenue, utiliser les poids du fabricant ; la variabilité est surtout celle du revêtement (§5.2.3 (3))."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "revêtement", v: g("rev"), u: "kN/m", c: K.ink }, { l: "étanchéité", v: g("et"), u: "kN/m", c: K.mute }, { l: "équipements", v: g("fixe"), u: "kN/m", c: K.gold }, { l: "total max", v: g("gmax"), u: "kN/m", c: K.red }, { l: "total min", v: g("gmin"), u: "kN/m", c: K.blue }], { title: "Superstructures par mètre de tablier", left: 84 }); },
  clair: (I, g) => `Les équipements pèsent entre ${f2(g("gmin"), 1)} et ${f2(g("gmax"), 1)} kN par mètre de tablier selon l'épaisseur réelle du revêtement.` },

{ id: "act-choc", t: "Chocs de véhicules sur les piles", ref: "NF EN 1991-1-7 — §4.3.1, tableau 4.1 (valeurs recommandées), figure 4.2",
  desc: "Forces statiques équivalentes de choc d'un véhicule routier sur un appui situé en bordure de chaussée.",
  inputs: [SEL("route", "Type de voie", [["1000/500", "Autoroute, route nationale (camions)"], ["750/375", "Route de campagne"], ["500/250", "Zone urbaine"], ["150/75", "Cours et parkings : camions"], ["50/25", "Cours et parkings : voitures"]], "1000/500", ""),
    SEL("veh", "Véhicule", [["c", "Camion (h = 1,25 m, zone de 0,5 m)"], ["v", "Voiture (h = 0,50 m, zone de 0,25 m)"]], "c", ""), N("d", "Distance de l'appui au bord de la chaussée", "m", 1.5, "d")],
  calc(I) {
    const [Fx, Fy] = I.route.split("/").map(Number), h = I.veh === "c" ? 1.25 : 0.5, a = I.veh === "c" ? 0.5 : 0.25;
    return { steps: [R("Fx", L`F_{dx}`, "~dans le sens de la circulation", Fx, "kN", 0), R("Fy", L`F_{dy}`, "~perpendiculaire au sens de la circulation", Fy, "kN", 0), S("h", "h", "~hauteur d'application au-dessus de la chaussée", h, "m", 2), S("a", "a", "~hauteur de la surface d'impact", a, "m", 2)],
      notes: ["$F_{dx}$ et $F_{dy}$ ne se cumulent pas. Situation accidentelle : $\\gamma = 1$, combinaison $G + \\psi_{1,1}Q_1 + A_d$. Les valeurs de l'AN et les dispositions du guide du Sétra (protection par glissières, distance > 4,5 m) peuvent réduire ou dispenser de cette vérification."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, gy = 130; let s = P(`M10 ${gy}H320`, { c: K.ink, w: 2 }) + Rc(200, 20, 40, gy - 20);
    s += Rc(40, gy - 70, 110, 55, { f: "#eef0f4", c: K.mute }) + Ci(65, gy - 9, 9, { f: K.ink, c: K.ink }) + Ci(130, gy - 9, 9, { f: K.ink, c: K.ink });
    const yh = gy - g("h") * 60; s += arrow(160, yh, 199, yh, K.red, 2.4) + T(160, yh - 6, `Fdx = ${g("Fx")} kN / Fdy = ${g("Fy")} kN`, { s: 9.5, c: K.red, w: 500 }) + dimV(260, yh, gy, `h = ${f2(g("h"), 2)} m`, K.mute, 1);
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Un ${I.veh === "c" ? "camion" : "véhicule léger"} qui heurte la pile la pousse de ${g("Fx")} kN à ${f2(g("h"), 2)} m du sol (situation accidentelle).` },

{ id: "act-lm71", t: "Ferroviaire : LM71 et coefficient dynamique Φ", ref: "NF EN 1991-2 — §6.3.2 (LM71), §6.4.5.2 (6.4), (6.5), tableau 6.2 (longueurs déterminantes)",
  desc: "Charges du modèle LM71 classifiées par α et coefficients dynamiques Φ₂ (voie soigneusement entretenue) et Φ₃ (entretien normal).",
  inputs: [N("LPhi", "Longueur déterminante", "m", 20, L`L_\Phi`), N("alpha", "Coefficient de classification", "", 1.33, L`\alpha`)],
  calc(I) {
    const s = sqrt(I.LPhi) - 0.2, p2 = min(1.67, max(1, 1.44 / s + 0.82)), p3 = min(2, max(1, 2.16 / s + 0.73));
    return { steps: [S("Q", L`\alpha\,Q_{vk}`, L`\alpha \times 250\ \text{kN}` + "\\quad\\text{(4 essieux à 1,60 m)}", I.alpha * 250, "kN", 1), S("q", L`\alpha\,q_{vk}`, L`\alpha \times 80\ \text{kN/m}`, I.alpha * 80, "kN/m", 1),
      R("p2", L`\Phi_2`, L`\dfrac{1{,}44}{\sqrt{L_\Phi} - 0{,}2} + 0{,}82\ \in [1{,}00 ; 1{,}67]`, p2, "", 3), R("p3", L`\Phi_3`, L`\dfrac{2{,}16}{\sqrt{L_\Phi} - 0{,}2} + 0{,}73\ \in [1{,}00 ; 2{,}00]`, p3, "", 3)],
      notes: ["$L_\\Phi$ selon le tableau 6.2 (ex. : poutre isostatique : portée ; poutre continue à n travées : $k\\,L_m$). Les coefficients Φ s'appliquent au LM71 et aux SW ; une étude dynamique est requise pour les vitesses > 200 km/h ou hors fuseau de fréquences (feuille « Fréquence propre d'un tablier ferroviaire »)."] };
  },
  fig(I, g) { const f = (a, b, lo, hi) => range(1, 100, 80).map(l => [l, min(hi, max(1, a / (sqrt(l) - 0.2) + b))]); return plot({ series: [{ pts: f(1.44, 0.82, 1, 1.67), l: "Φ2 (entretien soigné)" }, { pts: f(2.16, 0.73, 1, 2), l: "Φ3 (entretien normal)", c: K.blue, w: 1.4, dash: "5 3" }], marks: [{ x: min(I.LPhi, 100), y: g("p2"), l: `Φ2 = ${f2(g("p2"), 2)}` }], xl: "LΦ (m)", yl: "Φ", ymin: 0.9, ymax: 2.1 }); },
  clair: (I, g) => `Pour ${f2(I.LPhi, 0)} m, les charges ferroviaires statiques sont majorées de ${f2((g("p2") - 1) * 100, 0)} % (voie soignée) à ${f2((g("p3") - 1) * 100, 0)} % (entretien normal).` },

{ id: "act-freq-ferro", t: "Fréquence propre d'un tablier ferroviaire : fuseau de validité", ref: "NF EN 1991-2 — §6.4.4, figure 6.10 et organigramme 6.9",
  desc: "Première fréquence propre de flexion d'une travée isostatique et vérification qu'elle se situe dans le fuseau permettant une analyse statique (v ≤ 200 km/h).",
  inputs: [N("L", "Portée", "m", 25, "L"), N("EI", "Rigidité de flexion", "MN·m²", 1.2e5, "EI"), N("m", "Masse linéique", "t/m", 18, "m")],
  calc(I) {
    const n0 = PI / (2 * I.L * I.L) * sqrt(I.EI * 1e6 / (I.m * 1000)), up = 94.76 * pow(I.L, -0.748), lo = I.L <= 20 ? 80 / I.L : 23.58 * pow(I.L, -0.592), dl = (17.75 / n0) ** 2;
    return { steps: [R("n0", L`n_0`, L`\dfrac{\pi}{2L^2}\sqrt{\dfrac{EI}{m}}`, n0, "Hz", 2), S("d0", L`\delta_0`, L`\left(\dfrac{17{,}75}{n_0}\right)^2` + "\\quad\\text{(flèche statique sous poids propre)}", dl, "mm", 1),
      S("up", L`n_{0,sup}`, L`94{,}76\,L^{-0{,}748}`, up, "Hz", 2), S("lo", L`n_{0,inf}`, I.L <= 20 ? L`\dfrac{80}{L}` : L`23{,}58\,L^{-0{,}592}`, lo, "Hz", 2)],
      checks: [C("$n_{0,inf} \\le n_0 \\le n_{0,sup}$ : analyse statique avec Φ admise (v ≤ 200 km/h)", n0 >= lo && n0 <= up, `${f2(lo, 2)} ≤ ${f2(n0, 2)} ≤ ${f2(up, 2)} Hz`)],
      notes: ["Fuseau valable pour $4 \\le L \\le 100$ m. Au-delà de 200 km/h, ou hors fuseau, une étude dynamique (accélération du tablier ≤ 3,5 m/s² sous voie ballastée) est nécessaire. Masse : structure + superstructures (ballast compté avec sa valeur minimale pour la fréquence maximale, et inversement)."] };
  },
  fig(I, g) { const Ls = range(4, 100, 80); return plot({ logx: true, series: [{ pts: Ls.map(l => [l, 94.76 * pow(l, -0.748)]), l: "limite supérieure", c: K.red, w: 1.4 }, { pts: Ls.map(l => [l, l <= 20 ? 80 / l : 23.58 * pow(l, -0.592)]), l: "limite inférieure", c: K.blue, w: 1.4 }], marks: [{ x: I.L, y: g("n0"), l: `n0 = ${f2(g("n0"), 2)} Hz` }], xl: "portée L (m, log)", yl: "n0 (Hz)", xmin: 4, xmax: 100, ymin: 0 }); },
  clair: (I, g) => `Le tablier vibre naturellement à ${f2(g("n0"), 2)} Hz ; ${g("n0") >= g("lo") && g("n0") <= g("up") ? "c'est dans le fuseau : un calcul statique majoré suffit" : "c'est hors fuseau : une étude dynamique est nécessaire"}.` },

{ id: "act-passerelle", t: "Passerelle : fréquences propres et risque de résonance", ref: "Guide Sétra « Passerelles piétonnes » (2006) — classes de passerelles, plages de fréquences ; NF EN 1990/A1 §A2.4.3.2",
  desc: "Fréquence propre verticale d'une passerelle isostatique et plage de risque de mise en résonance par les piétons.",
  inputs: [N("L", "Portée", "m", 40, "L"), N("EI", "Rigidité de flexion verticale", "MN·m²", 4000, "EI"), N("m", "Masse linéique (structure + équipements)", "kg/m", 2500, "m"),
    N("b", "Largeur utile", "m", 3, "b"), SEL("pieton", "Masse des piétons", [["0", "Négligée (fréquence maximale)"], ["70", "Foule dense : 70 kg/m² (fréquence minimale)"]], "0", "")],
  calc(I) {
    const m = I.m + +I.pieton * I.b, f = PI / (2 * I.L * I.L) * sqrt(I.EI * 1e6 / m), f2v = 4 * f;
    const plage = f >= 1.7 && f <= 2.1 ? 1 : (f >= 1 && f < 1.7) || (f > 2.1 && f <= 2.6) ? 2 : f > 2.6 && f <= 5 ? 3 : 4;
    return { steps: [S("mt", L`m_{tot}`, L`m + m_{pi\acute{e}tons}\,b`, m, "kg/m", 0), R("f1", L`f_1`, L`\dfrac{\pi}{2L^2}\sqrt{\dfrac{EI}{m}}`, f, "Hz", 2), S("f2", L`f_2`, L`4\,f_1`, f2v, "Hz", 2),
      R("plage", "", "~plage de risque (vertical) : 1 maximal, 2 moyen, 3 faible, 4 négligeable", plage, "", 0), S("conf", "", "~vérification de confort (EN 1990/A1 : requise si $f_1 < 5$ Hz)", f >= 5 ? "non requise" : "requise", "", 0)],
      checks: [C("Hors plage de risque maximal (1,7 à 2,1 Hz) pour la première fréquence verticale", plage !== 1, `${f2(f, 2)} Hz`)],
      notes: ["Plages verticales du guide Sétra : 1 (1,7–2,1 Hz), 2 (1–1,7 et 2,1–2,6 Hz), 3 (2,6–5 Hz), 4 (< 1 ou > 5 Hz). Horizontalement : risque maximal entre 0,5 et 1,1 Hz. Si la fréquence est en plage 1 ou 2, calculer les accélérations sous les cas de foule et comparer aux seuils de confort de la classe de la passerelle."] };
  },
  fig(I, g) {
    const W = 330, Hh = 120, X = f => 20 + f / 6 * 290; let s = "";
    [[0, 1, K.tealL, "4"], [1, 1.7, "#f8e1c8", "2"], [1.7, 2.1, K.redL, "1"], [2.1, 2.6, "#f8e1c8", "2"], [2.6, 5, "#f3efd9", "3"], [5, 6, K.tealL, "4"]].forEach(([a, b, c, l]) => { s += Rc(X(a), 30, X(b) - X(a), 40, { f: c, c: "#fff" }) + T((X(a) + X(b)) / 2, 54, l, { a: "middle", s: 9.5, w: 500 }); });
    for (let f = 0; f <= 6; f++) s += T(X(f), 84, f + " Hz", { a: "middle", s: 8.5, c: K.mute });
    s += P(`M${X(min(g("f1"), 6))} 22V78`, { c: K.ink, w: 2 }) + T(X(min(g("f1"), 6)), 18, `f1 = ${f2(g("f1"), 2)} Hz`, { a: "middle", s: 9.5, w: 500 }) + T(165, 108, "plages de risque vertical (1 = maximal)", { a: "middle", s: 9, c: K.mute });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La passerelle oscille à ${f2(g("f1"), 2)} Hz : ${g("plage") === 1 ? "c'est la fréquence de marche des piétons, risque de résonance élevé" : g("plage") === 2 ? "proche du pas des piétons : étudier les accélérations" : "assez éloignée du pas des piétons"}.` },

{ id: "act-diffusion-roue", t: "Diffusion d'une charge de roue jusqu'au feuillet moyen", ref: "NF EN 1991-2 — §4.3.6, figure 4.4 ; Fascicule 61 (diffusion à 3/4 dans le revêtement)",
  desc: "Surface d'impact d'une roue du tandem TS (0,40 × 0,40 m) diffusée à travers le revêtement et la dalle, et pression au feuillet moyen.",
  inputs: [N("Q", "Charge d'une roue (αQ·Qk/2)", "kN", 150, L`Q_{roue}`), N("u", "Côté de l'aire de contact", "m", 0.4, "u"), N("e", "Épaisseur du revêtement", "m", 0.08, "e"), N("h", "Épaisseur de la dalle", "m", 0.25, "h"),
    SEL("pente", "Diffusion dans le revêtement", [["1", "1/1 (EN 1991-2)"], ["0.75", "3/4 (usage français)"]], "1", "")],
  calc(I) {
    const k = +I.pente, u0 = I.u + 2 * k * I.e + I.h, p = I.Q / (u0 * u0), p0 = I.Q / (I.u * I.u);
    return { steps: [S("p0", L`p_0`, L`\dfrac{Q}{u^2}`, p0, "kN/m²", 0), R("u0", L`u_0`, L`u + 2\,k\,e + h` + "\\quad\\text{(45° dans le béton jusqu'au feuillet moyen)}", u0, "m", 3), R("p", "p", L`\dfrac{Q}{u_0^2}`, p, "kN/m²", 0)],
      notes: ["Pour un calcul de flexion locale de la dalle (abaques de Pucher, Pigeaud ou éléments finis), on charge la surface $u_0 \\times u_0$ au feuillet moyen. Les deux roues d'un essieu sont à 2,00 m ; deux essieux à 1,20 m."] };
  },
  fig(I, g) {
    const W = 330, Hh = 150, k = 170 / g("u0"), cx = 165, yt = 40, e = I.e * k, h = I.h * k, u = I.u * k, sl = +I.pente;
    let s = Rc(20, yt + e, 290, h) + Rc(20, yt, 290, e, { f: "#3c3f4d", c: "#3c3f4d", op: .25 }) + Rc(cx - u / 2, yt - 8, u, 8, { f: K.ink, c: K.ink });
    s += P(`M${cx - u / 2} ${yt}L${cx - u / 2 - sl * e} ${yt + e}L${cx - g("u0") * k / 2} ${yt + e + h / 2}H${cx + g("u0") * k / 2}L${cx + u / 2 + sl * e} ${yt + e}L${cx + u / 2} ${yt}`, { c: K.red, w: 1.4, dash: "4 3" });
    s += P(`M20 ${yt + e + h / 2}H310`, { c: K.mute, w: .8, dash: "2 3" }) + dim(cx - g("u0") * k / 2, cx + g("u0") * k / 2, yt + e + h + 16, `u0 = ${f2(g("u0"), 2)} m`) + arrow(cx, yt - 30, cx, yt - 9, K.red, 2) + T(cx + 6, yt - 16, `Q = ${f2(I.Q, 0)} kN`, { s: 9.5, c: K.red });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La roue de ${f2(I.Q, 0)} kN, posée sur ${f2(I.u * 100, 0)} cm, s'étale sur un carré de ${f2(g("u0"), 2)} m au milieu de la dalle : la pression tombe de ${f2(g("p0"), 0)} à ${f2(g("p"), 0)} kN/m².` },
]);
})(typeof window !== "undefined" ? window : globalThis);
