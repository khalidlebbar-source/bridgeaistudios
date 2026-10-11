/* ════════════════════════════════════════════════════════════════════
   HandBag — Géotechnique : tassements (classeurs Biblio 2004)
   Semelle sur sol stratifié (méthode pressiométrique, Fascicule 62 V annexe F.3),
   radier (diffusion simple et coefficient rhéologique).
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, udl } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d);
const LAM = [[1, 1.1, 1.12], [2, 1.2, 1.53], [3, 1.3, 1.78], [5, 1.4, 2.14], [20, 1.5, 2.65]];
function lamb(LB, circ) { if (circ) return [1, 1]; if (LB <= 1) return [1.1, 1.12]; for (let i = 0; i < LAM.length - 1; i++) if (LB <= LAM[i + 1][0]) { const r = (LB - LAM[i][0]) / (LAM[i + 1][0] - LAM[i][0]); return [LAM[i][1] + r * (LAM[i + 1][1] - LAM[i][1]), LAM[i][2] + r * (LAM[i + 1][2] - LAM[i][2])]; } return [1.5, 2.65]; }
/* couches [ép, E, α] depuis la base de la fondation → moyenne harmonique de E et moyenne de α sur [z1, z2] */
function avg(layers, z1, z2) { let z = 0, sh = 0, sa = 0, len = 0;
  layers.forEach(([h, E, a], i) => { const top = z, bot = i === layers.length - 1 ? 1e9 : z + h, lo = max(z1, top), hi = min(z2, bot); if (hi > lo) { sh += (hi - lo) / max(E, 0.01); sa += (hi - lo) * a; len += hi - lo; } z = bot; });
  return { E: len / sh, a: sa / len }; }

HB.add("Géotechnique et fondations", [

{ id: "geo-tassement-couches", t: "Tassement d'une semelle sur sol stratifié (méthode pressiométrique)", ref: "Fascicule 62 titre V, annexe F.3 (méthode de Ménard) — Biblio 2004 « Tassement semelle avec couches de sol »",
  desc: "Modules pressiométriques des seize tranches d'épaisseur B/2 sous la semelle, modules sphérique Ec et déviatorique Ed, tassements de consolidation et de cisaillement et raideur du sol.",
  inputs: [LST("lay", "Couches sous la base : épaisseur E α ; … (E en MPa, la dernière est supposée infinie)", "", "0.5 10 0.5 ; 2 74 0.5 ; 3.5 88 0.5 ; 10 131 0.5", "", { cols: 3 }),
    N("B", "Largeur", "m", 2.77, "B"), N("Lf", "Longueur", "m", 9.15, "L"), SEL("circ", "Forme", [["r", "rectangulaire"], ["c", "circulaire"]], "r", ""), N("q", "Contrainte nette appliquée", "kPa", 430, L`q - \sigma'_{v0}`)],
  calc(I) {
    const lay = I.lay || []; if (!lay.length) throw new Error("couches à saisir");
    const B = min(I.B, I.Lf), Lg = max(I.B, I.Lf), h = B / 2, E = [], A = [];
    for (let i = 0; i < 16; i++) { const m = avg(lay, i * h, (i + 1) * h); E.push(m.E); A.push(m.a); }
    const hm = (a, b) => (b - a + 1) / E.slice(a - 1, b).reduce((s, e) => s + 1 / e, 0);
    const E35 = hm(3, 5), E68 = hm(6, 8), E916 = hm(9, 16), Ec = E[0], Ed = 4 / (1 / E[0] + 1 / (0.85 * E[1]) + 1 / E35 + 1 / (2.5 * E68) + 1 / (2.5 * E916));
    const [lc, ld] = lamb(Lg / B, I.circ === "c"), ac = A[0], ad = A.reduce((s, a) => s + a, 0) / 16, q = I.q / 1000, B0 = 0.6;
    const sc = ac / (9 * Ec) * q * lc * B * 1000, sd = 2 / (9 * Ed) * q * B0 * pow(ld * B / B0, ad) * 1000, s = sc + sd;
    return { steps: [S("h", L`B/2`, "~épaisseur des tranches", h, "m", 3), R("Ec", L`E_c = E_1`, "~moyenne harmonique sur la 1re tranche", Ec, "MPa", 3), S("E2", L`E_2`, "", E[1], "MPa", 3), S("E35", L`E_{3,5}`, L`\dfrac{3}{\sum_{3}^{5} 1/E_i}`, E35, "MPa", 3),
      S("E68", L`E_{6,8}`, "", E68, "MPa", 3), S("E916", L`E_{9,16}`, "", E916, "MPa", 3), R("Ed", L`E_d`, L`\dfrac{4}{\dfrac{1}{E_1} + \dfrac{1}{0{,}85\,E_2} + \dfrac{1}{E_{3,5}} + \dfrac{1}{2{,}5\,E_{6,8}} + \dfrac{1}{2{,}5\,E_{9,16}}}`, Ed, "MPa", 3),
      S("lc", L`\lambda_c`, "~fonction de L/B", lc, "", 4), S("ld", L`\lambda_d`, "", ld, "", 4),
      S("sc", L`s_c`, L`\dfrac{\alpha}{9\,E_c}\,q\,\lambda_c\,B`, sc, "mm", 2), S("sd", L`s_d`, L`\dfrac{2}{9\,E_d}\,q\,B_0\left(\lambda_d\dfrac{B}{B_0}\right)^{\alpha}`, sd, "mm", 2), R("s", "s", L`s_c + s_d`, s, "mm", 2), S("k", "k", L`q / s`, q / (s / 1000), "MPa/m", 1)],
      tables: [{ title: "Modules des tranches (MPa) — z au milieu de la tranche", head: ["tranche", "z (m)", "E", "tranche", "z (m)", "E"], rows: E.slice(0, 8).map((e, i) => [i + 1, (i + 0.5) * h, e, i + 9, (i + 8.5) * h, E[i + 8]]), d: [2, 2, 0, 2, 2] }],
      vals: { E, h }, notes: ["Fascicule 62 titre V, annexe F.3 : E₃,₅, E₆,₈ et E₉,₁₆ sont les moyennes harmoniques des tranches correspondantes. Le classeur d'origine divisait la somme pondérée par 0,994 (somme des poids) ; la formule réglementaire est appliquée ici (écart de 0,6 % sur Ed). α : valeur de la première tranche pour le terme sphérique, moyenne des tranches pour le terme déviatorique."] };
  },
  fig(I, g, r) { const { E, h } = r.vals; const pts = []; E.forEach((e, i) => { pts.push([e, -i * h], [e, -(i + 1) * h]); });
    return plot({ series: [{ pts, c: K.gold, w: 1.8, l: "module des tranches (MPa)" }], vlines: [{ x: g("Ec"), l: `Ec = ${f2(g("Ec"), 1)}`, c: K.blue }, { x: g("Ed"), l: `Ed = ${f2(g("Ed"), 1)}`, c: K.red }], xl: "E (MPa) — profondeur sous la base", h: 185 }); },
  clair: (I, g) => `La semelle tassera d'environ ${f2(g("s"), 1)} mm (${f2(g("sc"), 1)} mm de consolidation, ${f2(g("sd"), 1)} mm de cisaillement), soit une raideur de ${f2(g("k"), 0)} MPa/m.` },

{ id: "geo-tassement-radier", t: "Tassement d'un radier : diffusion simple et modules pressiométriques", ref: "Biblio 2004 « Tassement d'un radier » — diffusion de la contrainte à pente donnée, s = Σ α σ h / E",
  desc: "Tassement d'un radier rectangulaire par sommation sur des tranches de sol, la contrainte diffusant selon une pente donnée et chaque tranche ayant son module pressiométrique et son coefficient rhéologique.",
  inputs: [N("Lr", "Longueur du radier", "m", 9, "L"), N("Br", "Largeur du radier", "m", 9, "B"), N("s0", "Contrainte au niveau du radier", "kPa", 34.5, L`\sigma_0`), N("dif", "Diffusion (horizontale pour 1 verticale)", "", 0.5, "d"),
    LST("lay", "Tranches : épaisseur E α ; … (E en MPa)", "", "1.5 1 0.5 ; 1.5 1 0.5 ; 1.5 1 0.5 ; 1.5 1.5 0.5 ; 1.5 1.7 0.5 ; 1.5 2 0.5 ; 1.5 2 0.5 ; 1.5 1.5 0.5 ; 1.5 5 0.5 ; 1.5 8 0.5 ; 1.5 10 0.33 ; 1.5 10 0.33 ; 1.5 10 0.33 ; 1.5 10 0.33 ; 1.5 10 0.33 ; 1.5 50 0.33 ; 1.5 50 0.33 ; 1.5 50 0.33 ; 1.5 50 0.33 ; 1.5 50 0.33", "", { cols: 3 })],
  calc(I) {
    const lay = I.lay || []; if (!lay.length) throw new Error("tranches à saisir"); let z = 0, tot = 0; const rows = [];
    lay.forEach(([h, E, a]) => { const Lz = I.Lr + 2 * I.dif * z, Bz = I.Br + 2 * I.dif * z, sg = I.s0 * I.Lr * I.Br / (Lz * Bz), ds = sg * a / (E * 1000) * h * 1000; tot += ds; rows.push([z + h, E, a, sg, ds]); z += h; });
    return { steps: [S("A0", L`L\,B`, "", I.Lr * I.Br, "m²", 2), S("z", L`z_{max}`, "~profondeur étudiée", z, "m", 2), R("s", "s", L`\textstyle\sum_i \alpha_i\,\dfrac{\sigma_0\,L\,B}{(L + 2dz_i)(B + 2dz_i)}\,\dfrac{h_i}{E_i}`, tot, "mm", 2), S("k", "k", L`\sigma_0 / s`, I.s0 / (tot / 1000), "kPa/m", 0)],
      tables: [{ title: "Tranches", head: ["z bas (m)", "E (MPa)", "α", "σ (kPa)", "s (mm)"], rows: rows.filter((_, i) => i < 8 || i === rows.length - 1), d: [1, 2, 2, 2] }],
      vals: { rows }, notes: ["La contrainte de chaque tranche est celle du haut de la tranche, diffusée sur un rectangle élargi de 2·d·z (z : profondeur du haut de tranche), comme dans le classeur d'origine. Méthode simplifiée adaptée aux radiers souples ; pour un radier rigide de grande dimension, préférer une méthode élastique stratifiée."] };
  },
  fig(I, g, r) { const rows = r.vals.rows; let cum = 0; const pts = [[0, 0]]; rows.forEach(rr => { cum += rr[4]; pts.push([cum, -rr[0]]); });
    return plot({ series: [{ pts, c: K.gold, w: 1.8, l: "tassement cumulé depuis la surface (mm)" }, { pts: rows.map(rr => [rr[3] / I.s0 * g("s"), -rr[0]]), c: K.blue, dash: "4 3", l: "σ/σ0 × s" }], xl: "mm — profondeur (m)", h: 180 }); },
  clair: (I, g) => `Le radier tassera d'environ ${f2(g("s"), 0)} mm, soit un module de réaction moyen de ${f2(g("k"), 0)} kPa/m.` },

]);
})(typeof window !== "undefined" ? window : globalThis);
