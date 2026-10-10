/* ════════════════════════════════════════════════════════════════════
   HandBag — Appuis et soutènements (poussée des terres, murs, écrans, culées, chevêtres)
   Unités : m, kN, kN/m (par mètre linéaire d'ouvrage), kPa.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, gauge, udl, ground } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), rad = d => d * PI / 180, tan = Math.tan, sin = Math.sin, cos = Math.cos;
const Ka = phi => tan(PI / 4 - rad(phi) / 2) ** 2, Kp = phi => tan(PI / 4 + rad(phi) / 2) ** 2;
/* intégration d'un diagramme de pression p(z) sur [a, b] : résultante et moment par rapport à z = 0 */
function integ(p, a, b, n = 200) { let F = 0, M = 0; const h = (b - a) / n; for (let i = 0; i < n; i++) { const z = a + (i + 0.5) * h, v = p(z) * h; F += v; M += v * z; } return { F, M, z: M / (F || 1) }; }

HB.add("Appuis et soutènements", [

{ id: "app-rankine", t: "Poussée et butée des terres (Rankine)", ref: "Théorie de Rankine — massif horizontal, écran vertical lisse ; NF P94-282 (écrans) / NF EN 1997-1 annexe C",
  desc: "Coefficients de poussée et de butée, diagramme de pression avec cohésion, surcharge et nappe, résultante et point d'application.",
  inputs: [N("H", "Hauteur de l'écran", "m", 6, "H"), N("g", "Poids volumique du sol", "kN/m³", 20, L`\gamma`), N("phi", "Angle de frottement interne", "°", 30, L`\varphi'`), N("c", "Cohésion effective", "kPa", 0, L`c'`),
    N("q", "Surcharge uniforme sur le terre-plein", "kPa", 10, "q"), N("hw", "Profondeur de la nappe (≥ H : pas de nappe)", "m", 4, L`h_w`), N("gw", "Poids volumique de l'eau", "kN/m³", 10, L`\gamma_w`)],
  calc(I) {
    const ka = Ka(I.phi), kp = Kp(I.phi), sv = z => I.q + (z <= I.hw ? I.g * z : I.g * I.hw + (I.g - I.gw) * (z - I.hw)), u = z => z > I.hw ? I.gw * (z - I.hw) : 0;
    const p = z => max(0, ka * sv(z) - 2 * I.c * sqrt(ka)) + u(z), r = integ(p, 0, I.H), z0 = I.c > 0 ? max(0, (2 * I.c / sqrt(ka) - I.q) / I.g) : 0;
    return { steps: [R("ka", L`K_a`, L`\tan^2\left(\dfrac{\pi}{4} - \dfrac{\varphi'}{2}\right)`, ka, "", 4), S("kp", L`K_p`, L`\tan^2\left(\dfrac{\pi}{4} + \dfrac{\varphi'}{2}\right)`, kp, "", 4),
      S("p0", L`p(0)`, L`K_a\,q - 2c'\sqrt{K_a}`, ka * I.q - 2 * I.c * sqrt(ka), "kPa", 2), S("pH", L`p(H)`, L`K_a\,\sigma'_v(H) - 2c'\sqrt{K_a} + u(H)`, p(I.H), "kPa", 2), S("z0", L`z_c`, L`\dfrac{2c'/\sqrt{K_a} - q}{\gamma}` + "\\quad\\text{(fissure de traction)}", z0, "m", 2),
      R("Pa", L`P_a`, L`\int_0^H p(z)\,dz`, r.F, "kN/m", 1), S("za", L`z_a`, "~profondeur du point d'application", r.z, "m", 2), S("Ma", L`M_{base}`, L`P_a\,(H - z_a)`, r.F * (I.H - r.z), "kN·m/m", 1)],
      notes: ["Écran vertical, terre-plein horizontal, sans frottement sol–écran ($\\delta = 0$) : hypothèses sécuritaires pour la poussée. Contribution de la cohésion négligée dans la zone fissurée. Butée mobilisable : $\\sigma_p = K_p\\,\\sigma'_v + 2c'\\sqrt{K_p}$ (à pondérer : grands déplacements nécessaires)."] };
  },
  fig(I, g) { const ka = g("ka"), sv = z => I.q + (z <= I.hw ? I.g * z : I.g * I.hw + (I.g - I.gw) * (z - I.hw)), p = z => max(0, ka * sv(z) - 2 * I.c * sqrt(ka)) + (z > I.hw ? I.gw * (z - I.hw) : 0);
    return KIT.wallFig({ h: I.H, p: range(0, I.H, 40).map(z => [z, p(z)]), q: `q = ${f2(I.q, 0)} kPa`, water: I.hw < I.H ? I.hw : undefined, labels: [{ z: I.H, p: p(I.H), t: `${f2(p(I.H), 1)} kPa` }], R: { z: g("za"), l: `Pa = ${f2(g("Pa"), 0)} kN/m` } }); },
  clair: (I, g) => `Le terrain pousse l'écran de ${f2(g("Pa"), 0)} kN par mètre, appliqués à ${f2(I.H - g("za"), 2)} m au-dessus de la base (Ka = ${f2(g("ka"), 3)}).` },

{ id: "app-coulomb", t: "Poussée de Coulomb (écran incliné, talus, frottement)", ref: "Théorie de Coulomb — coin de rupture plan ; NF EN 1997-1 annexe C (valeurs de comparaison)",
  desc: "Coefficient de poussée avec frottement sol–mur, inclinaison du parement et pente du terre-plein ; composantes de la poussée.",
  inputs: [N("H", "Hauteur", "m", 6, "H"), N("g", "Poids volumique", "kN/m³", 20, L`\gamma`), N("phi", "Angle de frottement", "°", 32, L`\varphi'`), N("d", "Frottement sol–mur", "°", 21.3, L`\delta`),
    N("beta", "Pente du terre-plein", "°", 10, L`\beta`), N("lam", "Inclinaison du parement (fruit, depuis la verticale)", "°", 0, L`\lambda`)],
  calc(I) {
    const f = rad(I.phi), d = rad(I.d), b = rad(I.beta), l = rad(I.lam), num = cos(f - l) ** 2, rt = sqrt(max(0, sin(f + d) * sin(f - b) / (cos(l + d) * cos(l - b))));
    const ka = num / (cos(l) ** 2 * cos(l + d) * (1 + rt) ** 2), Pa = 0.5 * ka * I.g * I.H ** 2, Ph = Pa * cos(d + l), Pv = Pa * sin(d + l);
    return { steps: [R("ka", L`K_a`, L`\dfrac{\cos^2(\varphi - \lambda)}{\cos^2\lambda\cos(\lambda + \delta)\left[1 + \sqrt{\dfrac{\sin(\varphi + \delta)\sin(\varphi - \beta)}{\cos(\lambda + \delta)\cos(\lambda - \beta)}}\right]^2}`, ka, "", 4),
      S("kaR", L`K_a^{Rankine}`, L`\tan^2(\pi/4 - \varphi/2)`, Ka(I.phi), "", 4), R("Pa", L`P_a`, L`\tfrac{1}{2}\,K_a\,\gamma\,H^2`, Pa, "kN/m", 1), S("Ph", L`P_{a,h}`, L`P_a\cos(\delta + \lambda)`, Ph, "kN/m", 1), S("Pv", L`P_{a,v}`, L`P_a\sin(\delta + \lambda)`, Pv, "kN/m", 1), S("za", L`z_a`, L`\tfrac{2}{3}\,H`, 2 * I.H / 3, "m", 2)],
      checks: [C("Validité : $\\beta \\le \\varphi'$", I.beta <= I.phi, `${f2(I.beta, 1)}° ≤ ${f2(I.phi, 1)}°`)],
      notes: ["Usuellement $\\delta = 2\\varphi'/3$ pour un parement brut en béton, $\\delta = 0$ en présence de vibrations ou de remblai lisse. La théorie de Coulomb surestime nettement la butée lorsque $\\delta > \\varphi'/3$ : pour la butée, préférer les tables de Caquot-Kérisel."] };
  },
  fig(I, g) { return KIT.wallFig({ h: I.H, p: [[0, 0], [I.H, g("ka") * I.g * I.H]], labels: [{ z: I.H, p: g("ka") * I.g * I.H, t: `${f2(g("ka") * I.g * I.H, 1)} kPa` }], R: { z: 2 * I.H / 3, l: `Pa = ${f2(g("Pa"), 0)} kN/m` } }); },
  clair: (I, g) => `Avec le frottement du sol sur le mur et la pente du talus, Ka vaut ${f2(g("ka"), 3)} (Rankine : ${f2(g("kaR"), 3)}) : poussée de ${f2(g("Pa"), 0)} kN/m.` },

{ id: "app-mur-stabilite", t: "Mur cantilever : stabilité externe", ref: "NF EN 1997-1 §9 et NF P94-281 (murs) — vérifications usuelles : renversement, glissement, excentricité, portance",
  desc: "Stabilité d'un mur en T renversé sous la poussée des terres et d'une surcharge : coefficients de sécurité, excentricité et contrainte de référence.",
  inputs: [N("H", "Hauteur totale (sous semelle → crête)", "m", 6, "H"), N("B", "Largeur de la semelle", "m", 3.6, "B"), N("bt", "Longueur du patin avant", "m", 0.8, L`b_{av}`), N("ts", "Épaisseur du voile", "m", 0.4, L`e_v`),
    N("hb", "Épaisseur de la semelle", "m", 0.6, L`h_s`), N("g", "Poids volumique du remblai", "kN/m³", 20, L`\gamma`), N("phi", "Angle de frottement du remblai", "°", 30, L`\varphi'`),
    N("q", "Surcharge sur le terre-plein", "kPa", 10, "q"), N("db", "Frottement semelle–sol", "°", 30, L`\delta_b`), N("qadm", "Contrainte admissible du sol", "kPa", 300, L`q_{adm}`)],
  calc(I) {
    const ka = Ka(I.phi), bh = I.B - I.bt - I.ts, hv = I.H - I.hb, W1 = 25 * I.ts * hv, W2 = 25 * I.B * I.hb, W3 = I.g * bh * hv, Wq = I.q * bh;
    const x1 = I.bt + I.ts / 2, x2 = I.B / 2, x3 = I.bt + I.ts + bh / 2, V = W1 + W2 + W3 + Wq, Ms = W1 * x1 + W2 * x2 + W3 * x3 + Wq * x3;
    const P1 = 0.5 * ka * I.g * I.H ** 2, P2 = ka * I.q * I.H, Hh = P1 + P2, Mr = P1 * I.H / 3 + P2 * I.H / 2, Fr = Ms / Mr, Fg = V * tan(rad(I.db)) / Hh, xr = (Ms - Mr) / V, e = I.B / 2 - xr, qr = V / (I.B - 2 * e);
    return { steps: [S("ka", L`K_a`, "~Rankine sur le plan vertical passant par l'arrière du talon", ka, "", 4), S("V", "V", L`W_{voile} + W_{semelle} + W_{terres} + q\,b_{ar}`, V, "kN/m", 1), S("Hh", "H", L`\tfrac{1}{2}K_a\gamma H^2 + K_a\,q\,H`, Hh, "kN/m", 1),
      R("Fr", L`F_{renv}`, L`\dfrac{M_{stab}}{M_{renv}}`, Fr, "", 2), R("Fg", L`F_{gliss}`, L`\dfrac{V\tan\delta_b}{H}`, Fg, "", 2), S("e", "e", L`\dfrac{B}{2} - \dfrac{M_{stab} - M_{renv}}{V}`, e, "m", 3),
      R("qr", L`q_{ref}`, L`\dfrac{V}{B - 2e}` + "\\quad\\text{(Meyerhof)}", qr, "kPa", 0)],
      checks: [C("Renversement : $F \\ge 1{,}5$", Fr >= 1.5, f2(Fr, 2), 1.5 / Fr), C("Glissement : $F \\ge 1{,}5$", Fg >= 1.5, f2(Fg, 2), 1.5 / Fg), C("Excentricité : $e \\le B/6$ (semelle entièrement comprimée)", e <= I.B / 6, `${f2(e, 3)} ≤ ${f2(I.B / 6, 3)} m`, e / (I.B / 6)),
        C("Portance : $q_{ref} \\le q_{adm}$", qr <= I.qadm, `${f2(qr, 0)} ≤ ${f2(I.qadm, 0)} kPa`, qr / I.qadm)],
      notes: ["Approche « coefficients de sécurité globaux » pour le pré-dimensionnement. La justification réglementaire (NF P94-281) applique les coefficients partiels de l'approche 2 (EC7) : glissement $R_{h;d} = V'_d\\tan\\delta_{a;k}/1{,}1$, portance avec $\\gamma_{R;v} = 1{,}4$, excentricité limitée à $e \\le B/3$ à l'ELU et $B/6$ à l'ELS quasi permanent (tiers central)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 175, k = 140 / I.H, y0 = 155, x0 = 50, X = x => x0 + x * k, Y = z => y0 - z * k; let s = Rc(10, y0, 310, 16, { f: K.soil, c: "none", op: .4 }) + Rc(X(0), Y(I.hb), I.B * k, I.hb * k) + Rc(X(I.bt), Y(I.H), I.ts * k, (I.H - I.hb) * k);
    s += Rc(X(I.bt + I.ts), Y(I.H), (I.B - I.bt - I.ts) * k + 60, (I.H - I.hb) * k, { f: K.soil, c: "none", op: .35 }) + udl(X(I.bt + I.ts) + 4, X(I.B) + 56, Y(I.H) - 1, 6, K.red, 10);
    s += arrow(X(I.B) + 70, Y(I.H / 3), X(I.B) + 30, Y(I.H / 3), K.red, 2) + T(X(I.B) + 72, Y(I.H / 3) + 3, `H = ${f2(g("Hh"), 0)}`, { s: 9, c: K.red }) + arrow(X(I.B / 2 - g("e")), Y(I.hb) - 50, X(I.B / 2 - g("e")), Y(I.hb) - 4, K.blue, 2) + T(X(I.B / 2 - g("e")) + 4, Y(I.hb) - 40, `V = ${f2(g("V"), 0)}`, { s: 9, c: K.blue });
    s += dim(X(0), X(I.B), y0 + 14, `B = ${f2(I.B, 2)} m`) + T(W - 8, 16, `Fr = ${f2(g("Fr"), 2)} · Fg = ${f2(g("Fg"), 2)}`, { a: "end", s: 9.5, w: 500 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le mur résiste ${f2(g("Fr"), 1)} fois au renversement et ${f2(g("Fg"), 1)} fois au glissement ; il appuie sur le sol avec ${f2(g("qr"), 0)} kPa.` },

{ id: "app-repartition-h", t: "Répartition des efforts horizontaux entre les appuis", ref: "Raideurs en série pile + appareils d'appui ; guide Sétra (appareils d'appui en élastomère fretté)",
  desc: "Raideur de chaque appui (fût en console et appareils d'appui en série) et part de l'effort horizontal reprise par chacun (freinage, séisme, vent).",
  inputs: [N("F", "Effort horizontal total", "kN", 500, "F"),
    H("Appui 1 (culée)"), N("H1", "Hauteur du fût (0 = culée rigide)", "m", 0, L`H_1`), N("E1", "Rigidité EI du fût", "MN·m²", 1e5, L`EI_1`), N("K1", "Raideur des appareils d'appui", "kN/mm", 13, L`K_{aa,1}`),
    H("Appui 2 (pile)"), N("H2", "Hauteur du fût", "m", 12, L`H_2`), N("E2", "Rigidité EI", "MN·m²", 3e4, L`EI_2`), N("K2", "Raideur des appareils d'appui", "kN/mm", 18, L`K_{aa,2}`),
    H("Appui 3 (pile)"), N("H3", "Hauteur du fût", "m", 15, L`H_3`), N("E3", "Rigidité EI", "MN·m²", 3e4, L`EI_3`), N("K3", "Raideur des appareils d'appui", "kN/mm", 18, L`K_{aa,3}`),
    H("Appui 4 (culée)"), N("H4", "Hauteur du fût", "m", 0, L`H_4`), N("E4", "Rigidité EI", "MN·m²", 1e5, L`EI_4`), N("K4", "Raideur des appareils d'appui", "kN/mm", 13, L`K_{aa,4}`)],
  calc(I) {
    const Ks = [1, 2, 3, 4].map(i => { const Hh = I["H" + i], kp = Hh > 0 ? 3 * I["E" + i] * 1e3 / Hh ** 3 / 1000 : Infinity, ka = I["K" + i]; return 1 / (1 / kp + 1 / ka); });
    const Kt = Ks.reduce((a, b) => a + b, 0), Fs = Ks.map(k => I.F * k / Kt), u = I.F / Kt;
    return { steps: [S("Kp", L`K_{p\hat{u}t,i}`, L`\dfrac{3\,EI_i}{H_i^3}`, [2, 3].map(i => f2(3 * I["E" + i] / I["H" + i] ** 3, 1)).join(" ; "), "kN/mm", 0), S("Ki", L`K_i`, L`\left(\dfrac{1}{K_{p\hat{u}t,i}} + \dfrac{1}{K_{aa,i}}\right)^{-1}`, Ks.map(k => f2(k, 2)).join(" ; "), "kN/mm", 0),
      S("Kt", L`\sum K_i`, "", Kt, "kN/mm", 2), R("u", "u", L`\dfrac{F}{\sum K_i}`, u, "mm", 2), R("F1", L`F_1`, L`F\,\dfrac{K_1}{\sum K_i}`, Fs[0], "kN", 1), R("F2", L`F_2`, "", Fs[1], "kN", 1), S("F3", L`F_3`, "", Fs[2], "kN", 1), S("F4", L`F_4`, "", Fs[3], "kN", 1)],
      vals: { Ks, Fs },
      notes: ["Tablier supposé infiniment rigide dans son plan (même déplacement pour tous les appuis). Fût encastré en pied ; la souplesse des fondations (rotation et translation des semelles ou pieux) s'ajoute en série et réduit la part des appuis hauts."] };
  },
  fig(I, g, r) { const Fs = r.vals.Fs; return KIT.barsH(Fs.map((f, i) => ({ l: `appui ${i + 1}`, v: f, u: "kN", d: 0, c: [K.gold, K.blue, K.teal, K.gold][i] })), { title: `Déplacement commun u = ${f2(g("u"), 1)} mm`, left: 60 }); },
  clair: (I, g, r) => `Les appuis reprennent l'effort à proportion de leur raideur : ${r.vals.Fs.map(f => f2(f, 0)).join(", ")} kN ; le tablier se déplace de ${f2(g("u"), 1)} mm.` },

{ id: "app-chevetre", t: "Chevêtre de pile : bielles et tirant", ref: "NF EN 1992-1-1 — §6.5 (bielles et tirants), §9.9 ; modèle de console courte sur fût",
  desc: "Chevêtre en console de part et d'autre d'un fût, portant les appareils d'appui : effort dans le tirant supérieur et armatures.",
  inputs: [N("R", "Réaction d'un appareil d'appui (ELU)", "kN", 3200, L`R_{Ed}`), N("e", "Distance de l'appareil à l'axe du fût", "m", 2.2, "e"), N("bc", "Largeur du fût dans le plan", "m", 2.0, L`b_f`),
    N("d", "Hauteur utile du chevêtre au nu du fût", "m", 1.6, "d"), N("b", "Largeur du chevêtre", "m", 2.0, "b"), N("ap", "Côté de l'appareil d'appui", "m", 0.6, L`a_p`), N("fck", "Béton", "MPa", 35, L`f_{ck}`), N("fyk", "Acier", "MPa", 500, L`f_{yk}`)],
  calc(I) {
    const a = I.e - I.bc / 4, z = 0.9 * I.d, Tt = I.R * a / z, As = Tt / 1000 / (I.fyk / 1.15) * 1e4, th = Math.atan(z / a) * 180 / PI, nu = 1 - I.fck / 250, s = I.R / 1000 / (I.ap * I.ap), sR = 0.85 * nu * I.fck / 1.5;
    return { steps: [S("a", "a", L`e - \dfrac{b_f}{4}` + "\\quad\\text{(nœud inférieur au quart du fût)}", a, "m", 3), S("z", "z", L`0{,}9\,d`, z, "m", 3), S("th", L`\theta`, L`\arctan\dfrac{z}{a}`, th, "°", 1),
      R("T", "T", L`R_{Ed}\,\dfrac{a}{z}`, Tt, "kN", 0), R("As", L`A_s`, L`\dfrac{T}{f_{yd}}`, As, "cm²", 1), S("s", L`\sigma_{\text{nœud}}`, L`\dfrac{R_{Ed}}{a_p^2}`, s, "MPa", 2)],
      checks: [C("Nœud sous l'appareil (CCT) : $\\sigma \\le 0{,}85\\,\\nu' f_{cd}$", s <= sR, `${f2(s, 2)} ≤ ${f2(sR, 2)} MPa`, s / sR), C("Inclinaison de la bielle $\\ge 21{,}8°$ ($\\cot\\theta \\le 2{,}5$)", th >= 21.8, `${f2(th, 1)}°`)],
      notes: ["Tirant à ancrer au-delà de l'appareil (boucles, coudes). Prévoir des armatures de répartition et des cadres verticaux de suspente si les appareils sont proches de l'extrémité ; frettage local sous les appareils (feuilles « Frettes » et « Pression localisée »)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 170, k = 130 / (2 * I.e + 1), cx = 165, yt = 40, h = I.d * k + 12; let s = Rc(cx - (I.e + 0.6) * k, yt, 2 * (I.e + 0.6) * k, h) + Rc(cx - I.bc * k / 2, yt + h, I.bc * k, 60);
    [-1, 1].forEach(sg => { const xa = cx + sg * I.e * k; s += Rc(xa - 10, yt - 8, 20, 8, { f: K.ink, c: K.ink }) + arrow(xa, yt - 32, xa, yt - 9, K.red, 2) + P(`M${xa} ${yt + 8}L${cx + sg * I.bc * k / 4} ${yt + h}`, { c: K.blue, w: 5, op: .35 }); });
    s += P(`M${cx - (I.e + 0.4) * k} ${yt + 8}H${cx + (I.e + 0.4) * k}`, { c: K.red, w: 3 }) + T(cx, yt + 22, `T = ${f2(g("T"), 0)} kN`, { a: "middle", s: 9.5, c: K.red, w: 500 }) + T(cx + I.e * k + 6, yt - 20, `R = ${f2(I.R, 0)} kN`, { s: 9, c: K.red });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Chaque appareil descend dans le fût par une bielle inclinée à ${f2(g("th"), 0)}° ; le haut du chevêtre est tendu à ${f2(g("T"), 0)} kN, soit ${f2(g("As"), 0)} cm² d'acier.` },

{ id: "app-palplanche-console", t: "Écran en console : fiche par la méthode de Blum", ref: "Méthode de Blum simplifiée (écran autostable) ; NF P94-282 (écrans de soutènement)",
  desc: "Fiche d'un rideau de palplanches autostable dans un sol pulvérulent, effort tranchant et moment maximal.",
  inputs: [N("H", "Hauteur libre (fouille)", "m", 4, "H"), N("g", "Poids volumique", "kN/m³", 19, L`\gamma`), N("phi", "Angle de frottement", "°", 32, L`\varphi'`), N("q", "Surcharge", "kPa", 10, "q"), N("Fp", "Coefficient de sécurité sur la butée", "", 1.5, L`F_p`)],
  calc(I) {
    const ka = Ka(I.phi), kp = Kp(I.phi) / I.Fp, pa = z => ka * (I.q + I.g * z), pp = z => z > I.H ? kp * I.g * (z - I.H) : 0;
    const mom = D0 => { const zt = I.H + D0, A = integ(z => pa(z) * (zt - z), 0, zt), B = integ(z => pp(z) * (zt - z), I.H, zt); return B.F - A.F; };
    let a = 0.1, b = 4 * I.H + 10; for (let i = 0; i < 80; i++) { const m = (a + b) / 2; mom(m) < 0 ? a = m : b = m; } const D0 = (a + b) / 2, D = 1.2 * D0;
    const sh = z => integ(pa, 0, z).F - (z > I.H ? integ(pp, I.H, z).F : 0); let zm = I.H; for (let i = 0; i < 80; i++) { const lo = I.H, hi = I.H + D0; zm = lo + (hi - lo) * i / 80; if (sh(zm) <= 0) break; }
    const Mmax = integ(z => pa(z) * (zm - z), 0, zm).F - integ(z => pp(z) * (zm - z), I.H, zm).F;
    return { steps: [S("ka", L`K_a`, "", ka, "", 4), S("kp", L`K_p/F_p`, "", kp, "", 4), R("D0", L`D_0`, "~équilibre des moments au point de rotation (pied fictif)", D0, "m", 2), R("D", "D", L`1{,}2\,D_0`, D, "m", 2),
      S("zm", L`z_{M}`, "~profondeur d'effort tranchant nul", zm, "m", 2), R("Mmax", L`M_{max}`, "", Mmax, "kN·m/m", 1), S("Lt", L`L_{tot}`, L`H + D`, I.H + D, "m", 2)],
      notes: ["Méthode de Blum : la contre-butée au pied est remplacée par une force concentrée, compensée par la majoration de 20 % de la fiche. Sol homogène pulvérulent, sans nappe. Pour un dimensionnement réglementaire, utiliser un calcul aux coefficients de réaction (NF P94-282, modèle MISS)."] };
  },
  fig(I, g) { const ka = g("ka"), kp = g("kp"), D = g("D0"), zt = I.H + D, p = z => ka * (I.q + I.g * z) - (z > I.H ? kp * I.g * (z - I.H) : 0);
    return plot({ series: [{ pts: range(0, zt, 60).map(z => [p(z), -z]), l: "pression nette (poussée − butée)" }], hlines: [{ y: -I.H, l: "fond de fouille", c: K.mute }], marks: [{ x: 0, y: -g("zm"), l: `Mmax = ${f2(g("Mmax"), 0)} kN·m/m` }], xl: "kPa", yl: "profondeur (m)" }); },
  clair: (I, g) => `Pour tenir ${f2(I.H, 1)} m de terrain sans ancrage, le rideau doit être fiché de ${f2(g("D"), 2)} m (longueur totale ${f2(g("Lt"), 1)} m) ; il subit au plus ${f2(g("Mmax"), 0)} kN·m par mètre.` },

{ id: "app-palplanche-ancree", t: "Écran ancré en tête : appui simple en pied", ref: "Méthode de l'appui simple (« free earth support ») ; NF P94-282",
  desc: "Fiche minimale et effort d'ancrage d'un rideau ancré par un tirant, pour un sol pulvérulent homogène.",
  inputs: [N("H", "Hauteur libre", "m", 8, "H"), N("a", "Profondeur du tirant", "m", 1.5, "a"), N("g", "Poids volumique", "kN/m³", 19, L`\gamma`), N("phi", "Angle de frottement", "°", 32, L`\varphi'`), N("q", "Surcharge", "kPa", 10, "q"), N("Fp", "Coefficient sur la butée", "", 1.5, L`F_p`),
    N("s", "Espacement des tirants", "m", 2.5, L`e_t`)],
  calc(I) {
    const ka = Ka(I.phi), kp = Kp(I.phi) / I.Fp, pa = z => ka * (I.q + I.g * z), pp = z => z > I.H ? kp * I.g * (z - I.H) : 0;
    const mom = D => integ(z => pp(z) * (z - I.a), I.H, I.H + D).F - integ(z => pa(z) * (z - I.a), 0, I.H + D).F;
    let lo = 0.05, hi = 3 * I.H; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; mom(m) < 0 ? lo = m : hi = m; } const D = (lo + hi) / 2;
    const Tt = integ(pa, 0, I.H + D).F - integ(pp, I.H, I.H + D).F, sh = z => -Tt * (z > I.a ? 1 : 0) + integ(pa, 0, z).F - (z > I.H ? integ(pp, I.H, z).F : 0);
    let zm = I.a; for (let i = 1; i <= 200; i++) { const z = I.a + (I.H + D - I.a) * i / 200; if (sh(z) >= 0) { zm = z; break; } }
    const Mm = Tt * (zm - I.a) - integ(z => pa(z) * (zm - z), 0, zm).F + integ(z => pp(z) * (zm - z), I.H, zm).F;
    return { steps: [S("ka", L`K_a\ ;\ K_p/F_p`, "", `${f2(ka, 3)} ; ${f2(kp, 3)}`, "", 0), R("D", "D", "~moments nuls par rapport au tirant", D, "m", 2), R("T", "T", L`P_a - P_p`, Tt, "kN/m", 1), R("Tt", L`T_{tirant}`, L`T\,e_t`, Tt * I.s, "kN", 0),
      S("zm", L`z_M`, "~effort tranchant nul", zm, "m", 2), R("Mm", L`M_{max}`, "", abs(Mm), "kN·m/m", 1)],
      notes: ["Fiche minimale (sans marge) : prendre en pratique 1,2 D environ, ou appliquer les coefficients partiels de la NF P94-282. L'effort d'ancrage est à majorer pour l'inclinaison du tirant ($T/\\cos i$) et vérifié en arrachement (feuille « Tirant d'ancrage »)."] };
  },
  fig(I, g) { const ka = Ka(I.phi), kp = Kp(I.phi) / I.Fp, D = g("D"), p = z => ka * (I.q + I.g * z) - (z > I.H ? kp * I.g * (z - I.H) : 0);
    return plot({ series: [{ pts: range(0, I.H + D, 60).map(z => [p(z), -z]), l: "pression nette" }], hlines: [{ y: -I.a, l: `tirant : ${f2(g("Tt"), 0)} kN`, c: K.red }, { y: -I.H, l: "fond de fouille", c: K.mute }], xl: "kPa", yl: "profondeur (m)" }); },
  clair: (I, g) => `Retenu par un tirant de ${f2(g("Tt"), 0)} kN tous les ${f2(I.s, 1)} m, le rideau n'a besoin que de ${f2(g("D"), 2)} m de fiche ; moment maximal ${f2(g("Mm"), 0)} kN·m/m.` },

{ id: "app-cadre", t: "Cadre enterré (PICF / PIPO) : actions des terres", ref: "Guide Sétra « PICF » ; poussée au repos (Jaky) ; NF EN 1991-2 §4.9 (charges sur remblai)",
  desc: "Pressions verticales et latérales sur un ouvrage cadre sous remblai, avec la surcharge de trafic diffusée.",
  inputs: [N("hr", "Hauteur de remblai sur la traverse", "m", 1.5, L`h_r`), N("B", "Largeur extérieure du cadre", "m", 6, "B"), N("Hc", "Hauteur extérieure du cadre", "m", 4.5, L`H_c`), N("g", "Poids volumique du remblai", "kN/m³", 20, L`\gamma`),
    N("phi", "Angle de frottement du remblai", "°", 30, L`\varphi'`), N("qt", "Surcharge de trafic au niveau de la traverse", "kPa", 20, L`q_{tr}`), N("e", "Épaisseur des voiles et traverses", "m", 0.4, "e")],
  calc(I) {
    const K0 = 1 - sin(rad(I.phi)), Kmin = Ka(I.phi), pv = I.g * I.hr + I.qt, ph1 = K0 * (I.g * I.hr + I.qt), ph2 = K0 * (I.g * (I.hr + I.Hc) + I.qt), wpp = 25 * I.e * (2 * I.B + 2 * (I.Hc - 2 * I.e)), pr = (pv * I.B + wpp) / I.B;
    return { steps: [S("K0", L`K_0`, L`1 - \sin\varphi'` + "\\quad\\text{(Jaky)}", K0, "", 3), R("pv", L`p_v`, L`\gamma\,h_r + q_{tr}`, pv, "kPa", 1), R("ph1", L`p_{h,haut}`, L`K_0\,(\gamma h_r + q_{tr})`, ph1, "kPa", 1), R("ph2", L`p_{h,bas}`, L`K_0\left[\gamma(h_r + H_c) + q_{tr}\right]`, ph2, "kPa", 1),
      S("ph2m", L`p_{h,bas}^{min}`, L`K_a\left[\gamma(h_r + H_c)\right]` + "\\quad\\text{(cas de poussée minimale)}", Kmin * I.g * (I.hr + I.Hc), "kPa", 1), S("wpp", L`G_{cadre}`, "~poids propre par mètre", wpp, "kN/m", 1), R("pr", L`p_{radier}`, L`\dfrac{p_v B + G_{cadre}}{B}`, pr, "kPa", 1)],
      notes: ["Deux cas extrêmes à combiner : poussée maximale ($K_0$, compactage soigné, symétrique) et poussée minimale ($K_a$, ou dissymétrie d'un seul côté). Surcharge de trafic : diffusion des charges de roue dans le remblai à 2 pour 1 (EN 1991-2 §4.9.1) ou forfait $q = 10$ kPa sur les voiles latéraux."] };
  },
  fig(I, g) {
    const W = 330, Hh = 175, k = 120 / (I.hr + I.Hc), cx = 165, yt = 20 + I.hr * k, w = I.B * k, h = I.Hc * k; let s = Rc(30, 10, 270, yt - 10 + h + 10, { f: K.soil, c: "none", op: .35 }) + Rc(cx - w / 2, yt, w, h) + Rc(cx - w / 2 + I.e * k, yt + I.e * k, w - 2 * I.e * k, h - 2 * I.e * k, { f: "#fff", c: K.concD });
    s += udl(cx - w / 2, cx + w / 2, yt - 1, 8, K.red, 12) + T(cx, yt - 16, `pv = ${f2(g("pv"), 0)} kPa`, { a: "middle", s: 9, c: K.red });
    const sc = 40 / g("ph2"); s += P(`M${cx - w / 2} ${yt}h${-g("ph1") * sc}L${cx - w / 2 - g("ph2") * sc} ${yt + h}H${cx - w / 2}Z`, { c: K.red, f: K.redL, op: .7 }) + P(`M${cx + w / 2} ${yt}h${g("ph1") * sc}L${cx + w / 2 + g("ph2") * sc} ${yt + h}H${cx + w / 2}Z`, { c: K.red, f: K.redL, op: .7 });
    s += T(cx - w / 2 - g("ph2") * sc - 2, yt + h - 2, f2(g("ph2"), 0), { a: "end", s: 9, c: K.red }) + T(cx, yt + h + 14, `radier : ${f2(g("pr"), 0)} kPa`, { a: "middle", s: 9, c: K.blue });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le cadre porte ${f2(g("pv"), 0)} kPa sur sa traverse et ${f2(g("ph1"), 0)} à ${f2(g("ph2"), 0)} kPa sur ses piédroits ; il appuie sur le sol avec ${f2(g("pr"), 0)} kPa.` },

{ id: "app-culee-poussee", t: "Culée : poussée du remblai et des surcharges sur le mur garde-grève et le mur de front", ref: "Guide Sétra « Culées » ; NF EN 1991-2 §4.9.1 ; Fascicule 61 (charge de remblai 1 t/m²)",
  desc: "Effort horizontal et moment à la base d'un mur de culée sous la poussée des terres et d'une surcharge de remblai.",
  inputs: [N("H", "Hauteur du mur (au-dessus de la semelle)", "m", 7, "H"), N("g", "Poids volumique du remblai", "kN/m³", 20, L`\gamma`), N("phi", "Angle de frottement", "°", 30, L`\varphi'`), N("q", "Surcharge de remblai", "kPa", 10, "q"),
    SEL("K", "Coefficient de poussée", [["a", "Poussée active Ka (mur libre de se déplacer)"], ["0", "Au repos K0 (culée massive, mur bloqué)"]], "a", "K"), N("b", "Largeur du mur", "m", 12, "b")],
  calc(I) {
    const k = I.K === "a" ? Ka(I.phi) : 1 - sin(rad(I.phi)), P1 = 0.5 * k * I.g * I.H ** 2, P2 = k * I.q * I.H, M = P1 * I.H / 3 + P2 * I.H / 2;
    return { steps: [S("k", "K", I.K === "a" ? L`\tan^2(\pi/4 - \varphi'/2)` : L`1 - \sin\varphi'`, k, "", 4), S("P1", L`P_{terres}`, L`\tfrac{1}{2}K\gamma H^2`, P1, "kN/m", 1), S("P2", L`P_{q}`, L`K\,q\,H`, P2, "kN/m", 1),
      R("P", "P", L`P_{terres} + P_q`, P1 + P2, "kN/m", 1), R("M", L`M_{base}`, L`P_{terres}\,\dfrac{H}{3} + P_q\,\dfrac{H}{2}`, M, "kN·m/m", 1), S("Pt", L`P\,b`, "~effort total sur le mur", (P1 + P2) * I.b, "kN", 0), S("Mt", L`M\,b`, "", M * I.b, "kN·m", 0)],
      notes: ["Le garde-grève reçoit en outre les efforts locaux d'une roue (freinage et poussée de la roue sur le remblai) selon le guide Sétra. Combinaisons : $1{,}35\\,G$ (terres, $\\gamma_G$ défavorable) + $1{,}35\\,Q$ (surcharge de trafic sur remblai)."] };
  },
  fig(I, g) { const k = g("k"); return KIT.wallFig({ h: I.H, semelle: true, p: [[0, k * I.q], [I.H, k * (I.q + I.g * I.H)]], q: `q = ${f2(I.q, 0)} kPa`, labels: [{ z: I.H, p: k * (I.q + I.g * I.H), t: `${f2(k * (I.q + I.g * I.H), 1)} kPa` }], R: { z: I.H - g("M") / g("P"), l: `P = ${f2(g("P"), 0)} kN/m` } }); },
  clair: (I, g) => `Le remblai pousse le mur de culée de ${f2(g("P"), 0)} kN par mètre (${f2(g("Pt"), 0)} kN sur ${f2(I.b, 1)} m) et crée ${f2(g("M"), 0)} kN·m/m à sa base.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
