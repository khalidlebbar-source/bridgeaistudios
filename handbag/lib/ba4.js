/* ════════════════════════════════════════════════════════════════════
   HandBag — Dalles, voiles et accessoires (classeurs Biblio 2004)
   Dalle articulée sur 4 côtés (BAEL E3), dalle infinie sous charge localisée (Pucher),
   encorbellement sous charge localisée, voile de bassin circulaire, boucle de levage.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, BM = HB.BEAM, { PI, sqrt, pow, min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, udl } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d);
const lerp = (xs, ys, x) => { if (x <= xs[0]) return ys[0]; for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]); return ys.at(-1); };

/* BAEL annexe E3 : dalles articulées sur leur contour, μx et μy pour ν = 0 et ν = 0,2 */
const E3 = { a: [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1],
  mx0: [0.11, 0.102, 0.095, 0.088, 0.081, 0.0745, 0.068, 0.062, 0.056, 0.051, 0.046, 0.041, 0.037],
  ay0: [0.4, 0.45, 0.5, 0.557, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1], my0: [0, 0, 0, 0, 0.305, 0.369, 0.436, 0.509, 0.595, 0.685, 0.778, 0.887, 1],
  mx2: [0.112, 0.105, 0.098, 0.092, 0.086, 0.08, 0.074, 0.0685, 0.063, 0.058, 0.053, 0.048, 0.044], my2: [0.293, 0.333, 0.373, 0.42, 0.476, 0.53, 0.585, 0.643, 0.71, 0.778, 0.846, 0.923, 1] };
/* interpolation de la feuille : segment repéré par MATCH (borné à 12) puis droite prolongée */
function e3(xs, ys, x) { let i = 0; for (let k = 0; k < xs.length; k++) if (xs[k] <= x) i = k; i = min(i, 11); return ys[i] + (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) * (x - xs[i]); }

/* dalle infinie simplement appuyée sur deux bords parallèles (largeur a), charges rectangulaires (Pucher) */
function pucher(a, nu, loads, x, yo, nm) {
  let mx = 0, my = 0;
  loads.forEach(([Q, u, v, xc, yc]) => { const q = Q / u / v, y = abs(yo - yc);
    for (let m = 1; m <= nm; m++) { const k = m * PI / a, c = q * a / PI ** 2 / m ** 2 * Math.sin(k * xc) * Math.sin(k * u / 2) * Math.sin(k * x), A = 2 * a / m / PI; let fx, fy;
      if (y < v / 2) { fx = 2 * A - (A + (1 - nu) * (v / 2 - y)) * Math.exp(-k * (v / 2 - y)) - (A + (1 - nu) * (y + v / 2)) * Math.exp(-k * (y + v / 2)); fy = 2 * A * nu - (A * nu - (1 - nu) * (v / 2 - y)) * Math.exp(-k * (v / 2 - y)) - (A * nu - (1 - nu) * (y + v / 2)) * Math.exp(-k * (y + v / 2)); }
      else { fx = (A + (1 - nu) * (y - v / 2)) * Math.exp(-k * (y - v / 2)) - (A + (1 - nu) * (y + v / 2)) * Math.exp(-k * (y + v / 2)); fy = (A * nu - (1 - nu) * (y - v / 2)) * Math.exp(-k * (y - v / 2)) - (A * nu - (1 - nu) * (y + v / 2)) * Math.exp(-k * (y + v / 2)); }
      mx += c * fx; my += c * fy; } });
  return [mx, my];
}

HB.add("Béton armé — BAEL", [

{ id: "bael-dalle-4-cotes", t: "Dalle articulée sur ses quatre côtés (BAEL, annexe E3)", ref: "BAEL 91 révisé 99, annexe E3 — Biblio 2004 « Hourdis articulés sur leur contour »",
  desc: "Moments au centre d'une dalle rectangulaire articulée sur son contour sous charge uniforme, et charges équivalentes sur les poutres de rive (méthode des lignes de rupture).",
  inputs: [N("p", "Charge uniforme", "kN/m²", 30, "p"), N("l1", "Largeur", "m", 3.4, L`\ell_x`), N("l2", "Longueur", "m", 6, L`\ell_y`), SEL("nu", "Coefficient de Poisson", [["0", "ν = 0 (ELU)"], ["0.2", "ν = 0,2 (ELS)"]], "0", "")],
  calc(I) {
    const lx = min(I.l1, I.l2), ly = max(I.l1, I.l2), al = lx / ly, nu = +I.nu;
    const mx0 = e3(E3.a, E3.mx0, al), my0 = e3(E3.ay0, E3.my0, al), mx2 = e3(E3.a, E3.mx2, al), my2 = e3(E3.a, E3.my2, al);
    const mux = (mx2 - mx0) / 0.2 * nu + mx0, muy = (my2 - my0) / 0.2 * nu + my0, Mx = mux * I.p * lx * lx, My = muy * Mx;
    const pv1 = I.p * lx / 4, pv2 = (1 - al / 2) * I.p * lx / 2, pm1 = I.p * lx / 3, pm2 = (1 - al * al / 3) * I.p * lx / 2;
    return { steps: [S("al", L`\alpha`, L`\ell_x / \ell_y`, al, "", 4), S("mux", L`\mu_x`, "~annexe E3 (interpolation)", mux, "", 5), S("muy", L`\mu_y`, "", muy, "", 5),
      R("Mx", L`M_x`, L`\mu_x\,p\,\ell_x^2` + "\\ \\ \\text{(sens de } \\ell_x)", Mx, "kN·m/m", 3), R("My", L`M_y`, L`\mu_y\,M_x`, My, "kN·m/m", 3),
      H("Charges équivalentes sur les poutres de rive"), S("pv1", L`p_{V,x}`, L`\dfrac{p\,\ell_x}{4}` + "\\ \\ \\text{(petit côté, tranchant)}", pv1, "kN/m", 2), S("V1", L`V_x`, L`p_{V,x}\,\ell_x/2`, pv1 * lx / 2, "kN", 2),
      S("pv2", L`p_{V,y}`, L`\left(1 - \dfrac{\alpha}{2}\right)\dfrac{p\,\ell_x}{2}`, pv2, "kN/m", 2), S("V2", L`V_y`, L`p_{V,y}\,\ell_y/2`, pv2 * ly / 2, "kN", 2),
      S("pm1", L`p_{M,x}`, L`\dfrac{p\,\ell_x}{3}` + "\\ \\ \\text{(petit côté, flexion)}", pm1, "kN/m", 2), S("M1", L`M_{0,x}`, L`p_{M,x}\,\ell_x^2/8`, pm1 * lx * lx / 8, "kN·m", 2),
      S("pm2", L`p_{M,y}`, L`\left(1 - \dfrac{\alpha^2}{3}\right)\dfrac{p\,\ell_x}{2}`, pm2, "kN/m", 2), S("M2", L`M_{0,y}`, L`p_{M,y}\,\ell_y^2/8`, pm2 * ly * ly / 8, "kN·m", 2)],
      checks: [C("Dalle portant dans les deux sens", al >= 0.4, al >= 0.4 ? `α = ${fmt(al, 2)} ≥ 0,4` : "α < 0,4 : calculer comme une dalle portant dans un seul sens")],
      notes: ["Moments au centre de la dalle supposée articulée ; en continuité, répartir par exemple 0,85 Mx en travée et 0,5 Mx sur appuis (BAEL A.8.2,32). Les valeurs pour ν compris entre 0 et 0,2 sont interpolées linéairement."] };
  },
  fig(I, g) {
    const W = 330, Hh = 175, lx = min(I.l1, I.l2), ly = max(I.l1, I.l2), k = min(230 / ly, 130 / lx), w = ly * k, h = lx * k, x0 = 74, y0 = (Hh - h) / 2;
    let s = Rc(x0, y0, w, h, { f: K.conc }) + P(`M${x0} ${y0}L${x0 + h / 2} ${y0 + h / 2}L${x0 + w - h / 2} ${y0 + h / 2}L${x0 + w} ${y0}M${x0} ${y0 + h}L${x0 + h / 2} ${y0 + h / 2}M${x0 + w - h / 2} ${y0 + h / 2}L${x0 + w} ${y0 + h}`, { c: K.red, w: 1, dash: "4 3" });
    s += arrow(x0 + w / 2, y0 + h - 8, x0 + w / 2, y0 + 8, K.gold, 1.6) + T(x0 + w / 2 + 4, y0 + h / 2 + 14, `Mx = ${f2(g("Mx"), 1)}`, { s: 9.5, w: 500, c: K.gold });
    s += arrow(x0 + 12, y0 + h / 2 - 12, x0 + w - 12, y0 + h / 2 - 12, K.blue, 1.4) + T(x0 + w / 2 - 70, y0 + h / 2 - 16, `My = ${f2(g("My"), 1)}`, { s: 9.5, c: K.blue });
    s += dim(x0, x0 + w, y0 + h + 12, `ℓy = ${f2(ly, 2)} m`) + dimV(x0 - 10, y0, y0 + h, `ℓx = ${f2(lx, 2)}`, K.mute, -1);
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Au centre de la dalle, le moment vaut ${f2(g("Mx"), 1)} kN·m/m dans le sens de la petite portée et ${f2(g("My"), 1)} kN·m/m dans l'autre sens.` },

]);

HB.add("RDM et formulaire", [

{ id: "rdm-dalle-pucher", t: "Dalle infinie simplement appuyée sous charges localisées", ref: "Biblio 2004 « Flexion d'une dalle infinie simplement appuyée » — solution en série de Fourier (Pucher)",
  desc: "Moments de flexion Mx et My dans une bande de dalle infinie appuyée sur deux bords parallèles, sous une ou plusieurs charges réparties sur des rectangles.",
  inputs: [N("a", "Portée de la dalle (entre appuis)", "m", 6, "a"), N("nu", "Coefficient de Poisson", "", 0.15, L`\nu`),
    LST("Ld", "Charges : Q u v xc yc (Q kN ; u le long de a ; v ; centre xc, yc)", "", "100 0.5 0.5 3 0", "Q", { cols: 5 }),
    N("yo", "Ordonnée de la ligne d'étude", "m", 0, L`y_0`), N("xo", "Abscisse du point d'étude", "m", 2.85, L`x_0`), N("nm", "Nombre de termes de la série", "", 400, "m")],
  calc(I) {
    if (!I.Ld.length) throw new Error("au moins une charge");
    const nm = max(5, Math.round(I.nm)), xs = range(I.a / 80, I.a - I.a / 80, 79), vals = xs.map(x => pucher(I.a, I.nu, I.Ld, x, I.yo, nm));
    const iMx = vals.reduce((b, v, i) => v[0] > vals[b][0] ? i : b, 0), iMy = vals.reduce((b, v, i) => v[1] > vals[b][1] ? i : b, 0), [Mxo, Myo] = pucher(I.a, I.nu, I.Ld, I.xo, I.yo, nm);
    const Qt = I.Ld.reduce((s, l) => s + l[0], 0);
    return { steps: [S("Qt", L`\textstyle\sum Q`, "", Qt, "kN", 1), R("Mxo", L`M_x(x_0, y_0)`, L`\textstyle\sum_m \dfrac{q\,a}{\pi^2 m^2}\,\Phi_m(y)\,\sin\dfrac{m\pi\xi}{a}\sin\dfrac{m\pi u}{2a}\sin\dfrac{m\pi x}{a}`, Mxo, "kN·m/m", 3),
      R("Myo", L`M_y(x_0, y_0)`, "", Myo, "kN·m/m", 3), S("Mxm", L`M_{x,max}`, `~sur la ligne y₀, en x = ${f2(xs[iMx], 2)} m`, vals[iMx][0], "kN·m/m", 3), S("Mym", L`M_{y,max}`, `~en x = ${f2(xs[iMy], 2)} m`, vals[iMy][1], "kN·m/m", 3)],
      vals: { xs, M: vals }, notes: ["x : direction de la portée (appuis en x = 0 et x = a) ; y : direction de la longueur infinie. Charge Q répartie sur u × v. La série converge lentement sous la charge : 400 termes suffisent (le classeur en prenait 58, soit environ 0,05 % d'écart)."] };
  },
  fig(I, g, r) { const { xs, M } = r.vals;
    return plot({ series: [{ pts: xs.map((x, i) => [x, M[i][0]]), c: K.gold, l: "Mx" }, { pts: xs.map((x, i) => [x, M[i][1]]), c: K.blue, dash: "5 3", l: "My" }], xl: "x (m)", marks: [{ x: I.xo, y: g("Mxo"), l: f2(g("Mxo"), 1), c: K.gold }], h: 180 }); },
  clair: (I, g) => `Au point d'étude, la dalle subit ${f2(g("Mxo"), 1)} kN·m/m dans le sens de la portée et ${f2(g("Myo"), 1)} kN·m/m dans le sens perpendiculaire.` },

{ id: "rdm-encorbellement", t: "Hourdis en encorbellement sous charge localisée", ref: "Biblio 2004 « Moments à l'encorbellement » — BPEL 91, annexe 12 B, art. 3",
  desc: "Moment d'encastrement d'une dalle en console d'épaisseur variable sous une charge concentrée, avec effet de bord libre, et répartition longitudinale du moment.",
  inputs: [N("a", "Porte-à-faux", "m", 4, "a"), N("he", "Épaisseur à l'encastrement", "m", 0.45, L`h_e`), N("ha", "Épaisseur en bout", "m", 0.2, L`h_a`),
    N("dc", "Distance de la charge à l'encastrement", "m", 1.78, L`d_c`), N("Pc", "Charge concentrée", "kN", 10, "P"), N("dl", "Distance de la charge au bord libre transversal", "m", 6.125, L`d_\ell`)],
  calc(I) {
    if (I.dc > I.a) throw new Error("la charge doit être sur le porte-à-faux (dc ≤ a)");
    const lam = PI * (1 + I.dc / I.a) * (4 + I.he / I.ha) / 20, mu = (1 + I.dc / I.a) * (1 - I.dl / (8 * I.a)), q1 = I.dc / (10 * I.a) * max(1 - I.dl / I.a, 3 / 100);
    const Mx = x => I.dl < 3 * I.a ? -I.Pc * lam * (1 / Math.cosh(lam * x / I.dc) + mu * pow(q1, (I.dl + x) / I.a)) / PI : -I.Pc * lam / Math.cosh(lam * x / I.dc) / PI;
    const xs = range(max(-3 * I.a, -I.dl), 3 * I.a, 120), ms = xs.map(Mx), Mmin = min(...ms), x0 = xs[ms.indexOf(Mmin)];
    return { steps: [S("lam", L`\lambda`, L`\dfrac{\pi}{20}\left(1 + \dfrac{d_c}{a}\right)\left(4 + \dfrac{h_e}{h_a}\right)`, lam, "", 5), S("mu", L`\mu`, L`\left(1 + \dfrac{d_c}{a}\right)\left(1 - \dfrac{d_\ell}{8\,a}\right)`, mu, "", 5),
      S("q1", L`q_1`, L`\dfrac{d_c}{10\,a}\max\!\left(1 - \dfrac{d_\ell}{a} ;\ 0{,}03\right)`, q1, "", 6), S("M0", L`M(0)`, L`-\dfrac{P\lambda}{\pi}\left[1 + \mu\,q_1^{d_\ell/a}\right]`, Mx(0), "kN·m/m", 4),
      R("Mmax", L`M_{max}`, `~moment d'encastrement maximal, en x = ${f2(x0, 2)} m`, Mmin, "kN·m/m", 4), S("Mb", L`\dfrac{P\lambda}{\pi}`, "~sans effet de bord", I.Pc * lam / PI, "kN·m/m", 4)],
      vals: { xs, ms }, notes: ["$M(x) = -\\dfrac{P\\lambda}{\\pi}\\left[\\dfrac{1}{\\cosh(\\lambda x/d_c)} + \\mu\\,q_1^{(d_\\ell + x)/a}\\right]$ pour $d_\\ell < 3a$ ; x compté le long de l'encastrement depuis la charge (x < 0 vers le bord libre). Précision de la méthode : environ 10 %."] };
  },
  fig(I, g, r) { const { xs, ms } = r.vals; return plot({ series: [{ pts: xs.map((x, i) => [x, -ms[i]]), c: K.gold, l: "moment d'encastrement −M (kN·m/m)" }], xl: "x le long de l'encastrement (m)", vlines: [{ x: 0, l: "charge" }], h: 175 }); },
  clair: (I, g) => `La charge de ${f2(I.Pc, 0)} kN crée au plus ${f2(abs(g("Mmax")), 2)} kN·m/m d'encastrement (${f2(I.Pc * g("lam") / PI, 2)} sans effet de bord).` },

]);

HB.add("Chantier et méthodes", [

{ id: "ch-boucle-levage", t: "Boucle de levage en acier doux", ref: "Biblio 2004 « Calcul d'une boucle de levage » — acier E24 (S235), coefficient dynamique 1,25",
  desc: "Diamètre minimal d'une boucle de levage à deux brins, diamètre du mandrin de cintrage et rayons de courbure du crochet.",
  inputs: [N("sig", "Contrainte admissible de l'acier", "MPa", 150, L`\bar\sigma`), N("m", "Charge à lever", "kg", 2000, "m"), N("th", "Inclinaison de l'élingue sur la verticale", "°", 60, L`\theta`), N("eta", "Coefficient de répartition entre brins", "", 0.8, L`\eta`)],
  calc(I) {
    const F = 1.25 * I.m * 9.81 / 1000 / Math.cos(I.th * PI / 180), d = sqrt(1.25 * I.m / 1000 / Math.cos(I.th * PI / 180) / I.eta / PI * 2 / I.sig / 100) * 1000;
    return { steps: [S("F", L`F`, L`\dfrac{1{,}25\,m\,g}{\cos\theta}`, F, "kN", 2), R("d", L`\varnothing_{min}`, L`\sqrt{\dfrac{2 \times 1{,}25\,m}{\eta\,\pi\,\bar\sigma\,\cos\theta}}`, d, "mm", 2),
      S("dm", L`\varnothing_{mandrin}`, L`4\,\varnothing`, 4 * d, "mm", 1), S("r1", L`r_{min}`, L`1{,}2\,\varnothing`, 1.2 * d, "mm", 1), S("r2", L`r_{max}`, L`2\,\varnothing`, 2 * d, "mm", 1)],
      notes: ["Boucle à deux brins, effort réparti avec le coefficient η entre les brins ; masse convertie avec g ≈ 10 m/s² comme dans le classeur (1 t → 10 kN). Ancrer la boucle sur une longueur suffisante et la ceinturer d'armatures ; vérifier l'arrachement du cône de béton."] };
  },
  fig(I, g) {
    const W = 330, Hh = 170, cx = 120, yb = 120, r = 34; let s = Rc(30, yb, 180, 40, { f: K.conc });
    s += P(`M${cx - r} ${yb + 30}V${yb - 20}A${r} ${r} 0 0 1 ${cx + r} ${yb - 20}V${yb + 30}`, { c: K.ink, w: 3.5 });
    const th = I.th * PI / 180; s += arrow(cx, yb - 20 - r, cx + 70 * Math.sin(th), yb - 20 - r - 70 * Math.cos(th), K.red, 2) + T(cx + 70 * Math.sin(th) + 4, yb - 20 - r - 70 * Math.cos(th), `θ = ${f2(I.th, 0)}°`, { s: 9.5, c: K.red });
    s += T(230, 60, `Ø ≥ ${f2(g("d"), 1)} mm`, { s: 12, w: 600 }) + T(230, 80, `mandrin ${f2(g("dm"), 0)} mm`, { s: 9.5 }) + T(230, 96, `F = ${f2(g("F"), 1)} kN`, { s: 9.5, c: K.red });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Pour lever ${f2(I.m / 1000, 2)} t avec une élingue inclinée à ${f2(I.th, 0)}°, la boucle doit avoir au moins ${f2(g("d"), 1)} mm de diamètre, cintrée sur un mandrin de ${f2(g("dm"), 0)} mm.` },

]);

HB.add("Règlements anciens", [

{ id: "anc-bassin-circulaire", t: "Voile d'un bassin circulaire (Recommandations professionnelles 1990)", ref: "Recommandations professionnelles pour les réservoirs (mai 1990), contraintes limites des aciers et du béton ; théorie des coques cylindriques — Biblio 2004 « Bassin »",
  desc: "Moments, efforts tranchants, efforts de cerce, armatures verticales et horizontales et contraintes de traction du béton dans la paroi d'un réservoir cylindrique encastré ou articulé en pied.",
  inputs: [N("D", "Diamètre du bassin", "m", 15, "D"), N("hb", "Hauteur du voile", "m", 10, "h"), N("e", "Épaisseur du voile", "m", 0.8, "e"), SEL("pied", "Liaison en pied", [["e", "encastrement"], ["a", "articulation"]], "e", ""),
    N("Eb", "Module du béton", "MPa", 30000, L`E_b`),
    LST("pr", "Pression (m, kPa) : z p ; … depuis le pied, > 0 vers l'extérieur", "", "0 100 ; 4 50 ; 9 20", "p", { cols: 2 }),
    N("fc", "Résistance du béton", "MPa", 30, L`f_{c28}`), N("fe", "Limite d'élasticité", "MPa", 500, L`f_e`), N("eta", "Coefficient de fissuration", "", 1.6, L`\eta`), N("alf", "Coefficient α", "", 240, L`\alpha`),
    N("phv", "Ø des aciers verticaux", "mm", 12, L`\varnothing_v`), N("phh", "Ø des aciers horizontaux", "mm", 10, L`\varnothing_h`), N("cb", "Enrobage", "cm", 5, "c"), SEL("lit", "Aciers verticaux", [["1", "en premier lit"], ["2", "en deuxième lit"]], "1", "")],
  calc(I) {
    const r = I.D / 2, Eb = I.Eb * 1000, EI = Eb * I.e ** 3 / 12, kw = Eb * I.e / r / r, beta = pow(3 / I.e ** 2 / r ** 2, 0.25);
    const pts = (I.pr || []).slice().sort((a, b) => a[0] - b[0]); if (pts.length < 1) throw new Error("diagramme de pression à saisir");
    const q = []; for (let i = 0; i < pts.length - 1; i++) q.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
    const m = BM.model({ spans: [I.hb], EI, kw, left: I.pied === "e" ? "e" : "a", right: "c", points: pts.map(p => p[0]), nel: 400 });
    const kv = m.supp; const res = BM.solve(m, { q }); const zs = range(0, I.hb, 40);
    const ft = I.fc <= 60 ? 0.6 + 0.06 * I.fc : 0.275 * pow(I.fc, 2 / 3), slim = min(0.5 * I.fe, 90 * sqrt(I.eta * ft)), sv = 30 * I.eta + I.alf * sqrt(I.eta * ft / I.phv), sh = 30 * I.eta + I.alf * sqrt(I.eta * ft / I.phh);
    const ssv = min(sv, slim), ssh = min(sh, slim), Amin = I.e * 12.5, PHI = [6, 10, 12, 14, 16, 20, 25, 32, 40], DEXT = [9.45, 11.8, 14.2, 16.6, 18.85, 23.6, 29.6, 38, 47.5];
    const dext = ph => DEXT[PHI.findIndex(v => ph <= v)] || 47.5, dd = I.cb + dext(I.phv) / 20 + (I.lit === "2" ? dext(I.phh) / 10 : 0), d = I.e * 100 - dd;
    const sbc = 0.6 * I.fc, n = 15, a1 = n * sbc / (n * sbc + ssv), Mrb = 0.5 * a1 * (1 - a1 / 3) * 100 * d * d * sbc * 1e-6;
    const rows = zs.map(z => { const Mv = -BM.at(res.pts, z, 1), Tv = BM.at(res.pts, z, 2), w = BM.at(res.pts, z, 3) / 1000, Nh = -Eb * I.e / r * w;
      const Ms = abs(Mv) / 1000, xx = 1 + 2 * n * Ms / (1e-6 * 100 * d * d * ssv), al = 1 - 2 * sqrt(xx) * Math.cos(PI / 3 + Math.acos(pow(xx, -1.5)) / 3);
      const Av = max(Amin, Ms <= Mrb ? 1e6 * Ms / d / (1 - al / 3) / ssv : 1e6 * Ms / d / (1 - al / 3) / ssv + 1e6 * (Ms - Mrb) / (d - dd) / ssv);
      const Ah = max(Nh < 0 ? -Nh / 2 / ssh / 1000 * 1e4 : 0, Amin), sbh = Nh / 1000 / (I.e + n * 2 * Ah / 1e4);
      return [z, Mv, Tv, Nh, Av, Ah, sbh]; });
    const iN = rows.reduce((b, r2, i) => r2[3] < rows[b][3] ? i : b, 0), iM = rows.reduce((b, r2, i) => abs(r2[1]) > abs(rows[b][1]) ? i : b, 0);
    const Avmax = max(...rows.map(r2 => r2[4])), Ahmax = max(...rows.map(r2 => r2[5])), sbmin = min(...rows.map(r2 => r2[6]));
    return { steps: [S("beta", L`\beta`, L`\sqrt[4]{\dfrac{3}{e^2\,r^2}}\ \ (\nu = 0)`, beta, "m⁻¹", 4),       R("M0", L`M_{v}(0)`, "~moment vertical en pied (> 0 tend la face intérieure)", rows[0][1], "kN·m/m", 2), R("T0", L`T_{v}(0)`, "~effort tranchant en pied", abs(rows[0][2]), "kN/m", 2),
      R("Nh", L`N_{h,max}`, `~effort de cerce maximal (traction < 0), en z = ${f2(rows[iN][0], 2)} m`, rows[iN][3], "kN/m", 1),
      S("slim", L`\sigma_{s}`, L`\min\!\left[0{,}5 f_e ;\ 90\sqrt{\eta f_{t28}} ;\ 30\eta + \alpha\sqrt{\eta f_{t28}/\varnothing}\right]`, min(slim, sv), "MPa", 2), R("Av", L`A_{v,max}`, "~aciers verticaux (face tendue)", Avmax, "cm²/m", 2), R("Ah", L`A_{h,max}`, L`\dfrac{|N_h|}{2\,\sigma_{s,h}}` + "\\ \\text{par face}", Ahmax, "cm²/m", 2), S("Amin", L`A_{min}`, L`12{,}5\,e` + "\\ \\text{(cm}^2\\text{/m, e en m)}", Amin, "cm²/m", 2),
      S("sbh", L`\sigma_{b,h}`, L`\dfrac{N_h}{e + 2\,n\,A_h}` + "\\ \\text{(section homogène)}", sbmin, "MPa", 3)],
      checks: [C("Traction du béton en section homogène (cerce)", sbmin >= -1.1 * ft, `${fmt(sbmin, 2)} ≥ −1,1 ft28 = ${fmt(-1.1 * ft, 2)} MPa`, -sbmin / (1.1 * ft))],
      tables: [{ title: "Efforts et aciers le long du voile", head: ["z (m)", "Mv (kN·m/m)", "Tv (kN/m)", "Nh (kN/m)", "Av (cm²/m)", "Ah/face"], rows: rows.filter((_, i) => [0, 4, 8, 16, 24, 40].includes(i)).map(r2 => r2.slice(0, 6).map(v => abs(v) < 1e-7 ? 0 : v)), d: [2, 2, 1, 2, 2] }],
      vals: { rows, teq: 1e-5 * 15 * Eb * I.e / r }, notes: [`Paroi traitée comme une bande verticale sur appui élastique $E_b e/r^2$ (coque cylindrique, βh = ${fmt(beta * I.hb, 2)}). σs,h = ${fmt(ssh, 1)} MPa pour les cerces. 15 °C de variation uniforme ≈ ${fmt(1e-5 * 15 * Eb * I.e / r, 0)} kPa de pression radiale. Règles remplacées par le Fascicule 74 (2016) et l'EN 1992-3.`] };
  },
  fig(I, g, r) { const rows = r.vals.rows;
    return plot({ series: [{ pts: rows.map(x => [x[1], x[0]]), c: K.gold, l: "Mv (kN·m/m)" }, { pts: rows.map(x => [x[3] / 10, x[0]]), c: K.blue, dash: "5 3", l: "Nh / 10 (kN/m)" }], xl: "efforts (axe vertical : hauteur z en m)", h: 185, ymin: 0, ymax: I.hb * 1.2 }); },
  clair: (I, g) => `En pied, le voile est soumis à ${f2(g("M0"), 1)} kN·m/m ; l'effort de cerce atteint ${f2(abs(g("Nh")), 0)} kN/m et demande ${f2(g("Ah"), 1)} cm²/m d'aciers horizontaux par face.` },

]);
})(typeof window !== "undefined" ? window : globalThis);
