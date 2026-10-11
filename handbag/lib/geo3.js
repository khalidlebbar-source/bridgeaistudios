/* ════════════════════════════════════════════════════════════════════
   HandBag — Géotechnique (suite, classeurs Biblio 2004)
   Groupe de micropieux inclinés, résistance de pointe équivalente (CPT),
   poussée d'une surcharge selon Krey, module de réaction d'un écran,
   barre équivalente d'un pieu pour un modèle à barres.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, udl } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), rad = d => d * PI / 180;
function solveN(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (abs(M[r][i]) > abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; for (let r = i + 1; r < n; r++) { const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; } }
  const x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c]; x[i] = s / M[i][i]; } return x; }
/* profil linéaire par morceaux [[z, v]…] : valeur et intégrale */
const prof = (pts, z) => { if (z <= pts[0][0]) return pts[0][1]; for (let i = 0; i < pts.length - 1; i++) if (z <= pts[i + 1][0]) return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * (z - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return pts.at(-1)[1]; };
const integ = (f, a, b, n = 400) => { if (b <= a) return 0; let s = 0; for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * f(a + (b - a) * i / n); return s * (b - a) / n / 3; };

HB.add("Géotechnique et fondations", [

{ id: "geo-micropieux", t: "Groupe de pieux ou micropieux inclinés sous semelle rigide", ref: "Biblio 2004 « Efforts dans des micropieux » — A. Millan, Annales de l'ITBTP (oct. 1982), pieux articulés travaillant en effort normal",
  desc: "Efforts normaux dans les pieux verticaux ou inclinés d'un groupe sous une semelle infiniment rigide soumise à un torseur quelconque (efforts horizontaux, vertical, moments).",
  inputs: [LST("pl", "Pieux : x y θ β D L (θ azimut du pied depuis x, β inclinaison sur la verticale, en °)", "m, °", "1.15 1.15 45 15 0.087 10.87 ; 1.15 0.8 0 0 0.087 10.5 ; 0.8 1.15 0 0 0.087 10.5 ; 1.15 -1.15 -45 15 0.087 10.87 ; 1.15 -0.8 0 0 0.087 10.5 ; 0.8 -1.15 0 0 0.087 10.5 ; -1.15 1.15 135 15 0.087 10.87 ; -1.15 0.8 0 0 0.087 10.5 ; -0.8 1.15 0 0 0.087 10.5 ; -1.15 -1.15 -135 15 0.087 10.87 ; -1.15 -0.8 0 0 0.087 10.5 ; -0.8 -1.15 0 0 0.087 10.5", "", { cols: 6 }),
    N("E", "Module d'Young des pieux", "MPa", 210000, "E"), H("Torseur au centre de la semelle (z vers le haut)"), N("V", "Effort vertical (descendant)", "kN", 4823, "V"),
    N("Hx", "Effort horizontal suivant x", "kN", 181, L`H_x`), N("Hy", "Effort horizontal suivant y", "kN", 85, L`H_y`), N("Mx", "Moment autour de x", "kN·m", -516, L`M_x`), N("My", "Moment autour de y", "kN·m", 927, L`M_y`), N("Mz", "Moment autour de z", "kN·m", 0, L`M_z`)],
  calc(I) {
    if (!I.pl.length) throw new Error("au moins un pieu");
    const Km = Array.from({ length: 6 }, () => new Array(6).fill(0));
    const rows = I.pl.map(([x, y, th, b, D, Lp]) => { const k = I.E * 1000 * PI * D * D / 4 / Lp, d = [Math.sin(rad(b)) * Math.cos(rad(th)), Math.sin(rad(b)) * Math.sin(rad(th)), -Math.cos(rad(b))];
      return { x, y, k, d, g: [d[0], d[1], d[2], y * d[2], -x * d[2], x * d[1] - y * d[0]], D }; });
    rows.forEach(r => { for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) Km[i][j] += r.k * r.g[i] * r.g[j]; });
    const tr = Km[0][0] + Km[1][1] + Km[2][2]; const mech = [0, 1, 5].filter(i => Km[i][i] < 1e-6 * tr);
    for (let i = 0; i < 6; i++) Km[i][i] += 1e-10 * tr;
    const F = [I.Hx, I.Hy, -I.V, I.Mx, I.My, I.Mz], U = solveN(Km, F), Nn = rows.map(r => r.k * r.g.reduce((s, v, i) => s + v * U[i], 0));
    const res = [0, 1, 2, 3, 4, 5].map(i => rows.reduce((s, r, j) => s + Nn[j] * r.g[i], 0) - F[i]), err = max(...res.map(abs)) / (max(...F.map(abs)) + 1);
    const imax = Nn.indexOf(max(...Nn)), imin = Nn.indexOf(min(...Nn));
    return { steps: [S("np", "n", "~nombre de pieux", I.pl.length, "", 0), R("Nmax", L`N_{max}`, `~pieu n° ${imax + 1}`, Nn[imax], "kN", 1), R("Nmin", L`N_{min}`, `~pieu n° ${imin + 1} (< 0 : traction)`, Nn[imin], "kN", 1),
      S("sN", L`\textstyle\sum N_i\cos\beta_i`, "~contrôle : effort vertical repris", rows.reduce((s, r, j) => s - Nn[j] * r.d[2], 0), "kN", 1),
      S("uz", L`w`, "~enfoncement de la semelle", -U[2] * 1000, "mm", 3), S("ux", L`u_x`, "", U[0] * 1000, "mm", 3), S("uy", L`u_y`, "", U[1] * 1000, "mm", 3), S("err", "", "~écart d'équilibre relatif", err, "", 6)],
      checks: [C("Équilibre de la semelle", err < 1e-4, err < 1e-4 ? "torseur entièrement repris par les pieux" : "une composante du torseur n'est pas reprise (pas de pieux inclinés dans cette direction ou en torsion)")],
      tables: [{ title: "Efforts normaux (compression > 0)", head: ["n°", "x (m)", "y (m)", "N (kN)"], rows: rows.map((r, i) => [i + 1, r.x, r.y, Nn[i]]), d: [2, 2, 1] }],
      vals: { Nn, rows }, notes: ["Pieux bi-articulés : seule leur raideur axiale EA/L est prise en compte (méthode usuelle pour les micropieux). Un groupe sans pieux inclinés ne reprend pas d'efforts horizontaux : il faut alors une butée ou la flexion des pieux."] };
  },
  fig(I, g, r) {
    const { Nn, rows } = r.vals, xs = rows.map(p => p.x), ys = rows.map(p => p.y), W = 330, Hh = 185, span = max(max(...xs) - min(...xs), max(...ys) - min(...ys), 1), k = 130 / span, cx = 120, cy = 92;
    const X = x => cx + (x - (max(...xs) + min(...xs)) / 2) * k, Y = y => cy - (y - (max(...ys) + min(...ys)) / 2) * k, nm = max(...Nn.map(abs), 1e-9);
    let s = Rc(X(min(...xs)) - 14, Y(max(...ys)) - 14, (max(...xs) - min(...xs)) * k + 28, (max(...ys) - min(...ys)) * k + 28, { f: "#f4f1ea", c: K.concD });
    rows.forEach((p, i) => { const rr = 4 + 8 * abs(Nn[i]) / nm; if (p.d[0] || p.d[1]) s += arrow(X(p.x), Y(p.y), X(p.x) + p.d[0] * 60, Y(p.y) - p.d[1] * 60, K.mute, 1);
      s += Ci(X(p.x), Y(p.y), rr, { f: Nn[i] < 0 ? K.red : K.gold, c: "#fff", op: .9 }); });
    s += T(250, 60, `N max = ${f2(g("Nmax"), 0)} kN`, { s: 10, w: 500, c: K.gold }) + T(250, 78, `N min = ${f2(g("Nmin"), 0)} kN`, { s: 10, c: g("Nmin") < 0 ? K.red : K.ink }) + T(250, 100, "flèche : inclinaison", { s: 8.5, c: K.mute });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le pieu le plus chargé reprend ${f2(g("Nmax"), 0)} kN et le moins chargé ${f2(g("Nmin"), 0)} kN${g("Nmin") < 0 ? " (traction)" : ""}.` },

{ id: "geo-qce", t: "Résistance de pointe équivalente au pénétromètre statique (pieux)", ref: "Fascicule 62 titre V, annexe E2 — Biblio 2004 « Résistance de pointe équivalente »",
  desc: "Résistance de pointe équivalente qce d'un pieu et hauteur d'encastrement équivalente De à partir d'un profil pénétrométrique qc(z).",
  inputs: [LST("qc", "Profil qc : z qc ; … (z en m, qc en MPa)", "", "1 0.3 ; 2 1 ; 3 0.5 ; 5 2 ; 6 2.5 ; 8 2.3 ; 10 3.2 ; 15 0.5 ; 20 3", "", { cols: 2 }),
    N("zh", "Niveau haut de la fondation (terrain)", "m", 0.5, L`z_h`), N("D", "Niveau de la base du pieu", "m", 9, "D"), N("B", "Diamètre ou largeur du pieu", "m", 1, "B"), N("h", "Hauteur d'ancrage dans la couche porteuse", "m", 1, "h"),
    SEL("ecr", "Écrêtement des valeurs à 1,3 qcm", [["o", "oui (Fascicule 62)"], ["n", "non"]], "o", "")],
  calc(I) {
    const pts = (I.qc || []).slice().sort((a, b) => a[0] - b[0]); if (pts.length < 2) throw new Error("profil qc à saisir");
    const a = max(I.B / 2, 0.5), b = min(a, I.h), z1 = I.D - b, z2 = I.D + 3 * a, q = z => prof(pts, z);
    const qcm = integ(q, z1, z2) / (b + 3 * a), qcc = z => I.ecr === "o" ? min(q(z), 1.3 * qcm) : q(z), qce = integ(qcc, z1, z2) / (b + 3 * a), De = integ(q, I.zh, I.D) / qce;
    return { steps: [S("a", "a", L`\max(B/2 ;\ 0{,}5\text{ m})`, a, "m", 3), S("b", "b", L`\min(a ;\ h)`, b, "m", 3), S("z1", L`D - b`, "", z1, "m", 2), S("z2", L`D + 3a`, "", z2, "m", 2),
      S("qcm", L`q_{cm}`, L`\dfrac{1}{b + 3a}\int_{D-b}^{D+3a} q_c(z)\,dz`, qcm, "MPa", 4), R("qce", L`q_{ce}`, L`\dfrac{1}{b + 3a}\int_{D-b}^{D+3a} q_{cc}(z)\,dz` + (I.ecr === "o" ? "\\ \\ (q_{cc} = \\min(q_c ;\\ 1{,}3\\,q_{cm}))" : ""), qce, "MPa", 4),
      R("De", L`D_e`, L`\dfrac{1}{q_{ce}}\int_{z_h}^{D} q_c(z)\,dz`, De, "m", 3), S("DeB", L`D_e / B`, "~(élément de fondation profonde si > 5)", De / I.B, "", 2)],
      vals: { pts, z1, z2, qce }, notes: ["Le profil qc(z) est interpolé linéairement entre les points saisis et intégré numériquement (méthode de Simpson). La portance de pointe vaut ensuite qu = kc·qce avec kc donné par le tableau du Fascicule 62 selon la nature du sol et le mode de mise en œuvre."] };
  },
  fig(I, g, r) { const { pts, z1, z2 } = r.vals;
    return plot({ series: [{ pts: pts.map(p => [p[1], -p[0]]), c: K.gold, w: 1.8, l: "qc (MPa)" }], hlines: [{ y: -I.D, l: "base du pieu", c: K.ink }, { y: -z1, c: K.blue }, { y: -z2, c: K.blue }], vlines: [{ x: g("qce"), l: `qce = ${f2(g("qce"), 2)}`, c: K.red }], xl: "qc (MPa) — profondeur vers le bas", h: 185 }); },
  clair: (I, g) => `La résistance de pointe équivalente vaut ${f2(g("qce"), 2)} MPa et la hauteur d'encastrement équivalente ${f2(g("De"), 2)} m.` },

{ id: "geo-krey", t: "Poussée d'une surcharge sur un écran : méthode de Krey", ref: "Biblio 2004 « Répartition des poussées sur un écran induite par une charge localisée suivant la méthode de Krey »",
  desc: "Effort horizontal et répartition sur l'écran de la poussée due à une surcharge filante ou rectangulaire placée à distance de l'écran.",
  inputs: [SEL("typ", "Type de charge", [["f", "charge filante (par mètre d'écran)"], ["p", "charge localisée rectangulaire"]], "f", ""), N("a", "Distance de la charge à l'écran", "m", 1.5, "a"), N("b", "Largeur de la charge (perpendiculaire à l'écran)", "m", 1.2, "b"),
    N("d", "Longueur de la charge (parallèle à l'écran)", "m", 1.2, "d"), N("phi", "Angle de frottement du sol", "°", 20, L`\varphi`), N("s", "Contrainte appliquée", "kPa", 70, L`\sigma`)],
  calc(I) {
    const Kk = Math.tan(PI / 4 - rad(I.phi) / 2), c = I.a + I.b, St = I.typ === "f" ? I.s * I.b : I.s * I.b * I.d, F = St * Kk;
    const z1 = I.a * Math.tan(rad(I.phi)), z2 = c * Math.tan(PI / 4 + rad(I.phi) / 2), f = I.typ === "f" ? F / (z2 - z1) : F / ((z2 - z1) * (I.d + I.a));
    return { steps: [S("K", "K", L`\tan\!\left(\dfrac{\pi}{4} - \dfrac{\varphi}{2}\right)`, Kk, "", 5), S("S", "S", I.typ === "f" ? L`\sigma\,b` : L`\sigma\,b\,d`, St, I.typ === "f" ? "kN/m" : "kN", 2),
      R("F", "F", L`S\,K`, F, I.typ === "f" ? "kN/m" : "kN", 3), S("z1", L`z_1`, L`a\,\tan\varphi`, z1, "m", 3), S("z2", L`z_2`, L`(a + b)\tan\!\left(\dfrac{\pi}{4} + \dfrac{\varphi}{2}\right)`, z2, "m", 3),
      R("f", "f", I.typ === "f" ? L`\dfrac{F}{z_2 - z_1}` : L`\dfrac{F}{(z_2 - z_1)(d + a)}`, f, "kPa", 3)],
      notes: [I.typ === "f" ? "La poussée F est répartie uniformément sur l'écran entre les profondeurs z₁ et z₂." : "La poussée F est répartie uniformément entre z₁ et z₂ sur une largeur d'écran d + a."] };
  },
  fig(I, g) {
    const W = 330, Hh = 185, xw = 108, top = 30, k = 130 / max(g("z2") * 1.15, 1), kx = 190 / (I.a + I.b + 0.5); let s = Rc(xw, top, W - xw - 10, Hh - top - 8, { f: K.soil, c: "none", op: .35 }) + Rc(xw - 10, top - 6, 10, Hh - top, { f: K.concD });
    s += Rc(xw + I.a * kx, top - 10, I.b * kx, 10, { f: K.redL, c: K.red }) + T(xw + (I.a + I.b / 2) * kx, top - 14, `σ = ${f2(I.s, 0)} kPa`, { a: "middle", s: 9, c: K.red });
    s += P(`M${xw + I.a * kx} ${top}L${xw} ${top + g("z1") * k}M${xw + (I.a + I.b) * kx} ${top}L${xw} ${top + g("z2") * k}`, { c: K.mute, dash: "4 3" });
    s += Rc(xw - 10 - g("f") / max(g("f"), 1e-9) * 40, top + g("z1") * k, g("f") / max(g("f"), 1e-9) * 40, (g("z2") - g("z1")) * k, { f: K.redL, c: K.red }) + T(xw - 54, top + (g("z1") + g("z2")) / 2 * k, `f = ${f2(g("f"), 2)}`, { a: "end", s: 9, c: K.red });
    s += T(xw + 4, top + g("z1") * k + 3, `z1 = ${f2(g("z1"), 2)}`, { s: 8.5 }) + T(xw + 4, top + g("z2") * k + 3, `z2 = ${f2(g("z2"), 2)}`, { s: 8.5 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La surcharge pousse l'écran de ${f2(g("F"), 1)} ${I.typ === "f" ? "kN/m" : "kN"}, répartis à ${f2(g("f"), 2)} kPa entre ${f2(g("z1"), 2)} et ${f2(g("z2"), 2)} m de profondeur.` },

{ id: "geo-kh-ecran", t: "Module de réaction horizontale d'un écran de soutènement", ref: "Recommandations pour le choix des paramètres de calcul des écrans de soutènement par la méthode aux modules de réaction (SETRA-LCPC, juillet 1984) — formule de Ménard-Bourdon-Houy ; Biblio 2004 « Calcul du module de réaction »",
  desc: "Coefficient de réaction horizontale d'un rideau à partir du module pressiométrique et de la hauteur d'influence a.",
  inputs: [N("Em", "Module pressiométrique", "MPa", 5, L`E_M`), N("a", "Dimension a (hauteur d'influence, voir schémas des recommandations)", "m", 3, "a"),
    SEL("al", "Nature du sol (coefficient rhéologique α)", [["0.3333333333", "sables et graviers (α = 1/3)"], ["0.5", "limons (α = 1/2)"], ["0.6666666667", "argiles (α = 2/3)"]], "0.3333333333", "")],
  calc(I) {
    const al = +I.al, kh = I.Em * 1000 / (al * I.a / 2 + 0.133 * pow(9 * I.a, al));
    return { steps: [S("al", L`\alpha`, "", al, "", 4), R("kh", L`k_h`, L`\dfrac{E_M}{\dfrac{\alpha\,a}{2} + 0{,}133\,(9\,a)^{\alpha}}`, kh, "kN/m³", 0), S("khMN", L`k_h`, "", kh / 1000, "MN/m³", 2)],
      notes: ["a : dimension caractéristique de la zone mobilisée (fiche en butée, hauteur entre appuis…), définie sur les schémas des recommandations de 1984. Formule également reprise dans l'annexe F de la NF P 94-282 sous une forme voisine."] };
  },
  fig(I, g) { const xs = range(0.5, 15, 60), al = +I.al; return plot({ series: [{ pts: xs.map(a => [a, I.Em * 1000 / (al * a / 2 + 0.133 * pow(9 * a, al)) / 1000]), c: K.gold, l: "kh (MN/m³) en fonction de a" }], marks: [{ x: I.a, y: g("khMN"), l: f2(g("khMN"), 1) }], xl: "a (m)", h: 170 }); },
  clair: (I, g) => `Le coefficient de réaction de l'écran vaut ${f2(g("khMN"), 2)} MN/m³ (${f2(g("kh"), 0)} kN/m³).` },

{ id: "geo-pieu-modele-barre", t: "Pieu sous effort horizontal : barre équivalente pour un modèle à barres", ref: "Biblio 2004 « Modélisation du comportement transversal d'un pieu » — barre encastrée élastiquement reproduisant la matrice de rigidité en tête",
  desc: "Longueur, module et ressorts d'une barre équivalente qui reproduit en tête la rigidité transversale d'un pieu (coefficients ρ1, ρ2, ρ3).",
  inputs: [N("r1", "Rigidité ρ1 (effort / déplacement)", "kN/m", 180694, L`\rho_1`), N("r2", "Rigidité croisée ρ2", "kN", 282669, L`\rho_2`), N("r3", "Rigidité ρ3 (moment / rotation)", "kN·m", 647656, L`\rho_3`), N("I0", "Inertie retenue pour la barre", "m⁴", 0.23, L`I_0`)],
  calc(I) {
    const det = I.r1 * I.r3 - I.r2 * I.r2; if (det <= 0) throw new Error("matrice de rigidité non définie positive (ρ1·ρ3 > ρ2²)");
    const s22 = I.r3 / det, s23 = I.r2 / det, s33 = I.r1 / det, L1 = s23 / s33, d = 16 * s23 * s23 - 12 * s22 * s33, L2 = 2 * L1 - sqrt(max(d, 0)) / 2 / s33, Lo = (L1 + L2) / 2, a = 2 / Lo * (s33 - s23 / Lo);
    const E0 = 1 / a / I.I0, k2 = 1 / (s33 - a * Lo), k3 = 3 / (3 * s22 - 4 * Lo * s23 + Lo * Lo * s33);
    return { steps: [S("s22", L`s_{22}`, L`\rho_3 / \Delta`, s22, "m/kN", 6), S("s23", L`s_{23}`, L`\rho_2 / \Delta`, s23, "1/kN", 6), S("s33", L`s_{33}`, L`\rho_1 / \Delta`, s33, "1/(kN·m)", 6),
      S("L1", L`L_{min}`, L`s_{23}/s_{33}`, L1, "m", 4), S("L2", L`L_{max}`, L`2\dfrac{s_{23}}{s_{33}} - \dfrac{\sqrt{16 s_{23}^2 - 12 s_{22} s_{33}}}{2\,s_{33}}`, L2, "m", 4), R("Lo", L`L_0`, L`\tfrac12(L_{min} + L_{max})`, Lo, "m", 4),
      S("a", "a", L`\dfrac{2}{L_0}\left(s_{33} - \dfrac{s_{23}}{L_0}\right)`, a, "1/(kN·m²)", 6), R("E0", L`E_0`, L`\dfrac{1}{a\,I_0}`, E0, "kPa", 0), R("k2", L`k_\theta`, L`\dfrac{1}{s_{33} - a\,L_0}`, k2, "kN·m/rad", 0), R("k3", L`k_h`, L`\dfrac{3}{3 s_{22} - 4 L_0 s_{23} + L_0^2 s_{33}}`, k3, "kN/m", 0)],
      notes: ["Le pieu est remplacé par une barre de longueur L₀, d'inertie I₀ et de module E₀, portant en pied un ressort de rotation kθ et un ressort horizontal kh : la barre reproduit exactement la souplesse en tête (s₂₂, s₂₃, s₃₃). Les coefficients ρ s'obtiennent avec la feuille « Pieu sous effort horizontal »."] };
  },
  fig(I, g) {
    const W = 330, Hh = 180, x0 = 110, y0 = 20, Lk = 120; let s = P(`M${x0} ${y0}V${y0 + Lk}`, { c: K.ink, w: 4 }) + T(x0 + 10, y0 + Lk / 2, `L0 = ${f2(g("Lo"), 3)} m`, { s: 10, w: 500 });
    s += P(`M${x0 - 14} ${y0 + Lk + 4}h28`, { c: K.ink, w: 1.4 }) + P(`M${x0} ${y0 + Lk}m-10 0a10 10 0 1 0 20 0`, { c: K.blue, w: 1.4 }) + T(x0 + 18, y0 + Lk + 6, `kθ = ${f2(g("k2"), 0)}`, { s: 9, c: K.blue });
    s += P(`M${x0} ${y0 + Lk}h-14l-4 -5l-6 10l-6 -10l-6 10l-4 -5`, { c: K.red, w: 1.2 }) + T(x0 - 50, y0 + Lk + 22, `kh = ${f2(g("k3"), 0)}`, { s: 9, c: K.red });
    s += arrow(x0 - 50, y0, x0 - 2, y0, K.red, 1.6) + T(x0 - 52, y0 - 4, "H", { a: "end", s: 9.5, c: K.red }) + T(220, 70, `E0 = ${f2(g("E0") / 1000, 0)} MPa`, { s: 10 }) + T(220, 88, `I0 = ${f2(I.I0, 3)} m⁴`, { s: 9.5, c: K.mute });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le pieu peut être modélisé par une barre de ${f2(g("Lo"), 2)} m (E₀ = ${f2(g("E0") / 1000, 0)} MPa) portée par un ressort de rotation de ${f2(g("k2"), 0)} kN·m/rad et un ressort horizontal de ${f2(g("k3"), 0)} kN/m.` },

]);
})(typeof window !== "undefined" ? window : globalThis);
