/* ════════════════════════════════════════════════════════════════════
   HandBag — RDM : sections, flambement, plaques, divers (classeurs Biblio 2004)
   Section quelconque (polygone et arcs), inertie de torsion, longueur de flambement,
   répartition transversale de Guyon-Massonnet (dalle), chaînette, caisson flottant.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, BM = HB.BEAM, { PI, sqrt, pow, min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), deg = r => r * 180 / PI, rad = d => d * PI / 180;

/* ─── contour : points (x y) ou (x y R) = arc de rayon R arrivant au point (R > 0 : bombé à gauche du sens de parcours) ─── */
function contour(rows, nseg = 120) {
  const pts = [];
  rows.forEach((r, i) => {
    const [x, y, Rr] = r;
    if (i > 0 && Rr) {
      const [x0, y0] = pts[pts.length - 1], dx = x - x0, dy = y - y0, c = Math.hypot(dx, dy), Ra = max(abs(Rr), c / 2 + 1e-12);
      const mx = (x0 + x) / 2, my = (y0 + y) / 2, nx = -dy / c, ny = dx / c, dd = sqrt(Ra * Ra - c * c / 4), sg = Rr > 0 ? -1 : 1;
      const cx = mx + sg * nx * dd, cy = my + sg * ny * dd; let a0 = Math.atan2(y0 - cy, x0 - cx), a1 = Math.atan2(y - cy, x - cx), da = a1 - a0;
      while (da > PI) da -= 2 * PI; while (da < -PI) da += 2 * PI;
      for (let k = 1; k <= nseg; k++) pts.push([cx + Ra * Math.cos(a0 + da * k / nseg), cy + Ra * Math.sin(a0 + da * k / nseg)]);
    } else pts.push([x, y]);
  });
  /* fermeture par un arc si le premier point porte un rayon */
  if (rows.length > 2 && rows[0][2]) { const first = rows[0]; pts.pop(); const tmp = contour([[...pts[pts.length - 1]], first], nseg); pts.push(...tmp.slice(1)); }
  return pts;
}
function polyProps(pts) {
  let A = 0, Sx = 0, Sy = 0, Ixx = 0, Iyy = 0, Ixy = 0, per = 0; const n = pts.length;
  for (let i = 0; i < n; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n], c = x0 * y1 - x1 * y0;
    A += c / 2; Sx += (y0 + y1) * c / 6; Sy += (x0 + x1) * c / 6; Ixx += (y0 * y0 + y0 * y1 + y1 * y1) * c / 12; Iyy += (x0 * x0 + x0 * x1 + x1 * x1) * c / 12;
    Ixy += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * c / 24; per += Math.hypot(x1 - x0, y1 - y0); }
  const s = A < 0 ? -1 : 1; return { A: s * A, Sx: s * Sx, Sy: s * Sy, Ixx: s * Ixx, Iyy: s * Iyy, Ixy: s * Ixy, per };
}

/* ─── Guyon-Massonnet, dalle isotrope (α = 1, ν = 0) : premier harmonique, solution exacte de l'équation des plaques ─── */
function solveLin(A, b) { const n = b.length; A = A.map(r => r.slice()); b = b.slice();
  for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (abs(A[r][i]) > abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; } }
  const x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; } return x; }
function gmK(b, Lp, y, e) {             /* y, e mesurés depuis l'axe de la dalle (−b … b) */
  const k = PI / Lp, F = t => { const c = Math.cosh(k * t), s = Math.sinh(k * t);
    return [[c, t * c, s, t * s], [k * s, c + k * t * s, k * c, s + k * t * c], [k * k * c, 2 * k * s + k * k * t * c, k * k * s, 2 * k * c + k * k * t * s], [k ** 3 * s, 3 * k * k * c + k ** 3 * t * s, k ** 3 * c, 3 * k * k * s + k ** 3 * t * c]]; };
  const A = [], r = [], z = [0, 0, 0, 0], row = (a, c, v) => { A.push([...a, ...c]); r.push(v); }, Fm = F(-b), Fp = F(b), Fe = F(e);
  const mom = Fx => Fx[2], shr = Fx => Fx[3].map((v, i) => v - 2 * k * k * Fx[1][i]);
  row(mom(Fm), z, 0); row(shr(Fm), z, 0); row(z, mom(Fp), 0); row(z, shr(Fp), 0);
  for (let d = 0; d < 3; d++) row(Fe[d], Fe[d].map(v => -v), 0); row(Fe[3], Fe[3].map(v => -v), -1);
  const x = solveLin(A, r), Fy = F(y), reg = y < e ? x.slice(0, 4) : x.slice(4);
  return Fy[0].reduce((s, v, i) => s + v * reg[i], 0) * 2 * b * k ** 4;
}
const gmCache = new Map();
function gmGrid(b, Lp, nf = 32, ne = 320) { const key = [b, Lp, nf, ne].join("|"); if (gmCache.has(key)) return gmCache.get(key); const fib = range(-b, b, nf), es = range(-b, b, ne), g = { fib, es, G: fib.map(y => es.map(e => gmK(b, Lp, y, e))) }; if (gmCache.size > 20) gmCache.clear(); gmCache.set(key, g); return g; }
const gmAt = (g, i, e) => { const t = (e - g.es[0]) / (g.es[1] - g.es[0]), j = Math.min(g.es.length - 2, Math.max(0, Math.floor(t))), u = t - j; return g.G[i][j] * (1 - u) + g.G[i][j + 1] * u; };
const gmStrip = (g, i, e1, e2) => { if (e2 - e1 < 1e-9) return gmAt(g, i, e1); const n = max(4, Math.ceil((e2 - e1) / (g.es[1] - g.es[0]))); let s = 0; for (let k = 0; k <= n; k++) s += (k === 0 || k === n ? .5 : 1) * gmAt(g, i, e1 + (e2 - e1) * k / n); return s / n; };

HB.add("RDM et formulaire", [

{ id: "rdm-section-polygone", t: "Caractéristiques d'une section quelconque (contour polygonal et arcs)", ref: "Biblio 2004 « Section quelconque » et « Section avec arcs de cercle » — formules de Green",
  desc: "Aire, périmètre, centre de gravité, inerties, produit d'inertie, inerties principales et modules de résistance d'une section définie par les sommets de son contour, avec évidement et portions circulaires.",
  inputs: [LST("pts", "Contour : x y ; x y ; … (« x y R » : arc de rayon R jusqu'au point)", "m", "1.6 0 ; 2.4 0 ; 3.55 0.7 ; 3.55 1 ; 0 1 ; 0 0.85", "", { cols: 0 }),
    LST("hole", "Évidement éventuel (même syntaxe)", "m", "", "", { cols: 0 }), N("gam", "Poids volumique", "kN/m³", 25, L`\gamma`)],
  calc(I) {
    if (!I.pts || I.pts.length < 3 || I.pts.some(r => r.length < 2)) throw new Error("au moins trois sommets « x y »");
    const c = contour(I.pts), p = polyProps(c), h = I.hole && I.hole.length >= 3 ? polyProps(contour(I.hole)) : null;
    const A = p.A - (h ? h.A : 0), Sx = p.Sx - (h ? h.Sx : 0), Sy = p.Sy - (h ? h.Sy : 0), Xg = Sy / A, Yg = Sx / A;
    const Ix = p.Ixx - (h ? h.Ixx : 0) - A * Yg * Yg, Iy = p.Iyy - (h ? h.Iyy : 0) - A * Xg * Xg, Ixy = p.Ixy - (h ? h.Ixy : 0) - A * Xg * Yg;
    const Im = (Ix + Iy) / 2, Rr = sqrt(((Ix - Iy) / 2) ** 2 + Ixy ** 2), I1 = Im - Rr, I2 = Im + Rr;
    let th = abs(Iy - Ix) < 1e-14 ? (Ixy ? PI / 4 : 0) : 0.5 * Math.atan(2 * Ixy / (Iy - Ix)); const Ith = t => Ix * Math.cos(t) ** 2 + Iy * Math.sin(t) ** 2 - Ixy * Math.sin(2 * t);
    if (Ith(th) > Im + 1e-15) th += th > 0 ? -PI / 2 : PI / 2;
    const ys = c.map(q => q[1]), xs = c.map(q => q[0]), v = max(...ys) - Yg, vp = Yg - min(...ys), vy = max(...xs) - Xg, vyp = Xg - min(...xs);
    const per = p.per + (h ? h.per : 0);
    return { steps: [R("A", "S", L`\tfrac12\textstyle\oint (x\,dy - y\,dx)`, A, "m²", 4), S("per", "u", "~pourtour (contour + évidement)", per, "m", 4),
      R("Xg", L`X_G`, L`\dfrac{1}{S}\textstyle\iint x\,dS`, Xg, "m", 4), R("Yg", L`Y_G`, L`\dfrac{1}{S}\textstyle\iint y\,dS`, Yg, "m", 4),
      S("v", "v", L`y_{max} - Y_G`, v, "m", 4), S("vp", L`v'`, L`Y_G - y_{min}`, vp, "m", 4),
      R("Ix", L`I_{Gx}`, L`\textstyle\iint (y - Y_G)^2\,dS`, Ix, "m⁴", 5), R("Iy", L`I_{Gy}`, L`\textstyle\iint (x - X_G)^2\,dS`, Iy, "m⁴", 5), S("Ixy", L`I_{Gxy}`, L`\textstyle\iint (x - X_G)(y - Y_G)\,dS`, Ixy, "m⁴", 5),
      S("I1", L`I_{X}`, L`\tfrac{I_x + I_y}{2} - \sqrt{\left(\tfrac{I_x - I_y}{2}\right)^2 + I_{xy}^2}`, I1, "m⁴", 5), S("I2", L`I_{Y}`, L`\tfrac{I_x + I_y}{2} + \sqrt{\cdots}`, I2, "m⁴", 5),
      S("th", L`\varphi`, L`\tfrac12\arctan\dfrac{2\,I_{xy}}{I_y - I_x}`, deg(th), "°", 4),
      S("rho", L`\rho`, L`\dfrac{I_{Gx}}{S\,v\,v'}`, Ix / (A * v * vp), "", 4), S("g", "g", L`\gamma\,S`, I.gam * A, "kN/m", 2)],
      tables: [{ title: "Modules de résistance (m³)", head: ["axe", "fibre haute / droite", "fibre basse / gauche"], rows: [["Gx", Ix / v, Ix / vp], ["Gy", Iy / vy, Iy / vyp]], d: [4, 4], key: { Wsx: [0, 1], Wix: [0, 2], Wy: [1, 1], Wyp: [1, 2] } }],
      notes: ["Le sens de parcours des sommets est indifférent. Un arc « x y R » relie le point précédent au point courant par le plus petit arc de rayon R, bombé à gauche du sens de parcours si R > 0, à droite si R < 0. φ : angle de l'axe principal d'inertie minimale par rapport à Gx (sens trigonométrique)."] };
  },
  fig(I, g) {
    const c = contour(I.pts), hh = I.hole && I.hole.length >= 3 ? contour(I.hole) : null, xs = c.map(q => q[0]), ys = c.map(q => q[1]);
    const W = 330, Hh = 185, x0 = min(...xs), x1 = max(...xs), y0 = min(...ys), y1 = max(...ys), k = min(250 / (x1 - x0 || 1), 130 / (y1 - y0 || 1)), ox = (W - (x1 - x0) * k) / 2, oy = 22;
    const X = x => ox + (x - x0) * k, Y = y => oy + (y1 - y) * k, path = pp => pp.map((q, i) => `${i ? "L" : "M"}${X(q[0]).toFixed(1)} ${Y(q[1]).toFixed(1)}`).join("") + "Z";
    let s = P(path(c), { c: K.concD, f: K.conc, w: 1.2 }); if (hh) s += P(path(hh), { c: K.concD, f: "#fff", w: 1 });
    I.pts.forEach(r => { s += Ci(X(r[0]), Y(r[1]), 2, { f: K.red, c: "none" }); });
    const gx = X(g("Xg")), gy = Y(g("Yg")), t = rad(g("th")), Lx = 46;
    s += P(`M${gx - Lx * Math.cos(t)} ${gy + Lx * Math.sin(t)}L${gx + Lx * Math.cos(t)} ${gy - Lx * Math.sin(t)}`, { c: K.blue, dash: "5 3" }) + P(`M${gx + 30 * Math.sin(t)} ${gy + 30 * Math.cos(t)}L${gx - 30 * Math.sin(t)} ${gy - 30 * Math.cos(t)}`, { c: K.blue, dash: "5 3", op: .6 });
    s += Ci(gx, gy, 3.2, { f: K.blue, c: "#fff" }) + T(gx + 6, gy - 6, "G", { s: 10, c: K.blue, w: 600 });
    s += T(8, Hh - 20, `S = ${f2(g("A"), 4)} m²   G (${f2(g("Xg"), 3)} ; ${f2(g("Yg"), 3)})`, { s: 9.5 }) + T(8, Hh - 6, `I_Gx = ${f2(g("Ix"), 4)}   I_Gy = ${f2(g("Iy"), 4)} m⁴   φ = ${f2(g("th"), 2)}°`, { s: 9.5, c: K.mute });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La section a une aire de ${f2(g("A"), 3)} m² ; son centre de gravité est en (${f2(g("Xg"), 3)} ; ${f2(g("Yg"), 3)}) m et son inertie autour de Gx vaut ${f2(g("Ix"), 4)} m⁴.` },

{ id: "rdm-torsion-sections", t: "Inertie de torsion des sections usuelles", ref: "Biblio 2004 « Inertie de torsion » — Saint-Venant ; BPEL 91 art. 7.6,3 (section tubulaire efficace)",
  desc: "Inertie de torsion de Saint-Venant d'une section pleine rectangulaire, circulaire, elliptique, triangulaire ou polygonale régulière, et inertie de la section tubulaire efficace pour le béton.",
  inputs: [SEL("forme", "Forme de la section", [["r", "rectangle b × h"], ["c", "cercle de diamètre a"], ["e", "ellipse d'axes a et b"], ["t", "triangle équilatéral de côté a"], ["h", "hexagone régulier de côté a"], ["o", "octogone régulier de côté a"]], "r", ""),
    N("a", "Dimension a (petit côté b pour le rectangle)", "m", 1, "a"), N("b", "Dimension b (hauteur h du rectangle, grand axe de l'ellipse)", "m", 2, "b"), N("G", "Module de cisaillement", "MPa", 15000, "G")],
  calc(I) {
    const a = I.a, b = I.b, f = I.forme; let J, A, Ip, form, tub = null;
    if (f === "r") { const r = max(a / b, b / a); J = (1 / 3 - (0.051 + 0.168 / r) * Math.exp(-0.13 * r)) * min(a * b ** 3, b * a ** 3); A = a * b; Ip = a * b * (a * a + b * b) / 12; form = L`\left[\tfrac13 - \left(0{,}051 + \tfrac{0{,}168}{r}\right)e^{-0{,}13\,r}\right] h\,b^3`;
      const e = min(a, b) / 6, So = (a - e) * (b - e), u = 2 * (a + b - 2 * e); tub = { e, So, u, J: 4 * e * So * So / u }; }
    else if (f === "c") { J = PI * a ** 4 / 32; A = PI * a * a / 4; Ip = J; form = L`\dfrac{\pi\,a^4}{32}`; }
    else if (f === "e") { J = PI * (a * b) ** 3 / (a * a + b * b) / 16; A = PI * a * b / 4; Ip = PI * a * b * (a * a + b * b) / 64; form = L`\dfrac{\pi\,(a\,b)^3}{16\,(a^2 + b^2)}`; }
    else { const n = f === "t" ? 3 : f === "h" ? 6 : 8, ct = 1 / Math.tan(PI / n); A = n * a * a * ct / 4; Ip = n * a ** 4 / 96 * ct * (3 * ct * ct + 1);
      J = f === "t" ? a ** 4 / 46.2 : f === "h" ? 1.037 * a ** 4 : 3.66 * a ** 4; form = f === "t" ? L`\dfrac{a^4}{46{,}2}` : f === "h" ? L`1{,}037\,a^4` : L`3{,}66\,a^4`; }
    const Jsv = A ** 4 / (4 * PI * PI * Ip);
    const steps = [S("A", "A", "~aire", A, "m²", 4), S("Ip", L`I_p`, "~inertie polaire", Ip, "m⁴", 5), R("J", "J", form, J, "m⁴", 5), S("Jsv", L`J^{*}`, L`\dfrac{A^4}{4\pi^2\,I_p}\ \ \text{(Saint-Venant approché)}`, Jsv, "m⁴", 5),
      S("ecart", "", "~écart de l'approximation", (Jsv - J) / J * 100, "%", 1), S("GJ", L`G\,J`, "", I.G * J, "MN·m²", 0)];
    if (tub) steps.push(H("Béton : section tubulaire efficace (BPEL 91, art. 7.6,3)"), S("e", "e", L`\tfrac16\,\min(b, h)`, tub.e, "m", 4), S("So", L`\Omega`, L`(b - e)(h - e)`, tub.So, "m²", 4), S("u", "u", L`2\,(b + h - 2e)`, tub.u, "m", 4), R("Jt", L`J_{tub}`, L`\dfrac{4\,e\,\Omega^2}{u}`, tub.J, "m⁴", 5));
    return { steps, notes: ["Formule du rectangle : ajustement exponentiel de la série de Saint-Venant (écart < 1 %). Pour une section quelconque compacte, $J \\approx A^4/(4\\pi^2 I_p)$ ; pour une section mince ouverte, $J = \\sum b\\,t^3/3$ ; pour un caisson, voir la feuille de Bredt."] };
  },
  fig(I, g) {
    const W = 330, Hh = 170, cx = 110, cy = 82, a = I.a, b = I.b, f = I.forme; let s = "", k;
    if (f === "r") { k = min(130 / max(a, b), 120 / b); s += Rc(cx - a * k / 2, cy - b * k / 2, a * k, b * k) + dim(cx - a * k / 2, cx + a * k / 2, cy + b * k / 2 + 13, `b = ${f2(a, 2)}`, K.mute) + dimV(cx + a * k / 2 + 12, cy - b * k / 2, cy + b * k / 2, `h = ${f2(b, 2)}`, K.mute, 1); }
    else if (f === "c") { k = 120 / a; s += Ci(cx, cy, a * k / 2, { f: K.conc, c: K.concD }); }
    else if (f === "e") { k = 120 / max(a, b); s += `<ellipse cx="${cx}" cy="${cy}" rx="${b * k / 2}" ry="${a * k / 2}" fill="${K.conc}" stroke="${K.concD}"/>`; }
    else { const n = f === "t" ? 3 : f === "h" ? 6 : 8, Rr = a / (2 * Math.sin(PI / n)); k = 60 / Rr; s += P(Array.from({ length: n }, (_, i) => { const t = -PI / 2 + 2 * PI * i / n; return `${i ? "L" : "M"}${(cx + Rr * k * Math.cos(t)).toFixed(1)} ${(cy + Rr * k * Math.sin(t)).toFixed(1)}`; }).join("") + "Z", { c: K.concD, f: K.conc }); }
    const arc = `M${cx - 18} ${cy}A18 18 0 1 1 ${cx} ${cy + 18}`; s += P(arc, { c: K.red, w: 1.6 }) + arrow(cx + 2, cy + 18, cx - 3, cy + 18, K.red, 1.6) + T(cx - 4, cy - 22, "T", { s: 10, c: K.red, w: 600 });
    s += T(222, 64, `J = ${f2(g("J"), 4)} m⁴`, { s: 11, w: 500 }) + T(222, 84, `GJ = ${f2(g("GJ"), 0)} MN·m²`, { s: 9.5 }) + (isFinite(g("Jt")) ? T(222, 104, `J tub. = ${f2(g("Jt"), 4)} m⁴`, { s: 9.5, c: K.mute }) : "");
    return svg(W, Hh, s);
  },
  clair: (I, g) => `L'inertie de torsion vaut ${f2(g("J"), 4)} m⁴, soit une rigidité GJ de ${f2(g("GJ"), 0)} MN·m².` },

{ id: "rdm-flambement", t: "Longueur de flambement : appuis élastiques et sol élastique", ref: "Biblio 2004 « Longueur de flambement dans différentes conditions » — charge critique d'Euler par éléments finis",
  desc: "Charge critique et longueur de flambement d'une barre comprimée à inertie constante, avec appuis bloqués, libres ou élastiques (translation et rotation) aux deux extrémités et appui continu sur sol élastique.",
  inputs: [N("Lb", "Longueur de la barre", "m", 10, "L"), N("EI", "Rigidité de flexion", "MN·m²", 10000, "EI"),
    H("Pied"), SEL("pt", "Translation en pied", [["b", "bloquée"], ["l", "libre"], ["k", "ressort"]], "b", ""), SEL("pr", "Rotation en pied", [["b", "bloquée (encastrement)"], ["l", "libre (articulation)"], ["k", "ressort"]], "b", ""),
    N("kpt", "Raideur en translation (si ressort)", "kN/m", 20000, L`k_t`), N("kpr", "Raideur en rotation (si ressort)", "kN·m/rad", 150000, L`k_\theta`),
    H("Tête"), SEL("tt", "Translation en tête", [["b", "bloquée"], ["l", "libre"], ["k", "ressort"]], "k", ""), SEL("tr", "Rotation en tête", [["b", "bloquée"], ["l", "libre"], ["k", "ressort"]], "l", ""),
    N("ktt", "Raideur en translation (si ressort)", "kN/m", 20000, L`k_t`), N("ktr", "Raideur en rotation (si ressort)", "kN·m/rad", 150000, L`k_\theta`),
    N("ks", "Sol élastique continu (0 si aucun)", "kN/m²", 0, L`k`)],
  calc(I) {
    const bc = (t, kt) => t === "k" ? kt : t, EI = I.EI * 1000;
    const r = BM.buckling({ L: I.Lb, EI, kw: I.ks, nel: 80, foot: { t: bc(I.pt, I.kpt), r: bc(I.pr, I.kpr) }, head: { t: bc(I.tt, I.ktt), r: bc(I.tr, I.ktr) } });
    if (!r.Ncr) throw new Error("système instable (mécanisme) : bloquer au moins un déplacement de corps rigide");
    const lf = PI * sqrt(EI / r.Ncr), steps = [S("x1", L`\dfrac{k_t L^3}{EI}`, "~raideur relative en translation (tête)", I.tt === "k" ? I.ktt * I.Lb ** 3 / EI : NaN, "", 3),
      S("x2", L`\dfrac{k_\theta L}{EI}`, "~raideur relative en rotation (pied)", I.pr === "k" ? I.kpr * I.Lb / EI : NaN, "", 3), S("mk", L`\dfrac{L}{\pi}\sqrt[4]{\dfrac{k}{EI}}`, "~paramètre du sol", I.ks ? I.Lb / PI * pow(I.ks / EI, 0.25) : 0, "", 3),
      R("Ncr", L`N_{cr}`, L`\min\{N : \det(\mathbf K - N\,\mathbf K_G) = 0\}`, r.Ncr / 1000, "MN", 3), R("beta", L`\beta = \ell_f / L`, L`\dfrac{\pi}{L}\sqrt{\dfrac{EI}{N_{cr}}}`, lf / I.Lb, "", 4), R("lf", L`\ell_f`, L`\beta\,L`, lf, "m", 3)];
    return { steps: steps.filter(s => !(typeof s.v === "number" && isNaN(s.v))), vals: { mode: r.mode },
      notes: ["Valeurs de référence : console 2,0 ; bi-articulée 1,0 ; encastrée-guidée 1,0 ; encastrée-articulée 0,699 ; bi-encastrée 0,5. Barre homogène, effort normal constant, petits déplacements (flambement d'Euler élastique)."] };
  },
  fig(I, g, r) {
    const mode = r.vals.mode, W = 330, Hh = 185, x0 = 110, yb = 168, yt = 22, k = (yb - yt) / I.Lb, am = max(1e-12, ...mode.map(m => abs(m[1]))); let s = "";
    s += P(`M${x0} ${yb}V${yt}`, { c: K.mute, w: 1, dash: "3 3" }) + P("M" + mode.map(m => `${(x0 + m[1] / am * 46).toFixed(1)} ${(yb - m[0] * k).toFixed(1)}`).join("L"), { c: K.ink, w: 3 });
    s += arrow(x0, yt - 18, x0, yt - 2, K.red, 2) + T(x0 + 6, yt - 8, `Ncr = ${f2(g("Ncr"), 2)} MN`, { s: 9.5, c: K.red, w: 500 });
    const lab = (t, rr) => ({ b: "bloquée", l: "libre", k: "ressort" }[t]) + " / " + ({ b: "bloquée", l: "libre", k: "ressort" }[rr]);
    s += T(200, 40, "tête : " + lab(I.tt, I.tr), { s: 9 }) + T(200, yb, "pied : " + lab(I.pt, I.pr), { s: 9 }) + T(200, 100, `ℓf = ${f2(g("lf"), 2)} m`, { s: 12, w: 600 }) + T(200, 116, `β = ${f2(g("beta"), 3)}`, { s: 10, c: K.mute });
    if (I.ks) for (let i = 0; i < 8; i++) { const y = yb - (i + .5) * (yb - yt) / 8; s += P(`M${x0 - 60} ${y}h14`, { c: K.soilD, w: 1 }) + P(`M${x0 - 46} ${y - 3}l4 6`, { c: K.soilD, w: 1 }); }
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La barre flambe sous ${f2(g("Ncr"), 2)} MN ; tout se passe comme si sa longueur était de ${f2(g("lf"), 2)} m (β = ${f2(g("beta"), 2)}).` },

{ id: "rdm-guyon-massonnet", t: "Répartition transversale dans une dalle : coefficients de Guyon-Massonnet", ref: "Biblio 2004 « Majoration de la flexion longitudinale » — Guyon-Massonnet-Barès, dalle isotrope (α = 1), guide SETRA PSI-DA annexe 6",
  desc: "Coefficients de majoration de la flexion longitudinale d'une dalle de pont sous charges permanentes excentrées et sous les charges du Fascicule 61 titre II (A(l), Bc, Mc120), placées dans la position la plus défavorable.",
  inputs: [N("Bd", "Largeur de la dalle", "m", 8, "2b"), N("Lp", "Portée biaise équivalente", "m", 15, "L"), N("y0", "Bord gauche de la largeur chargeable (depuis le bord de la dalle)", "m", 1, L`y_0`),
    N("lch", "Largeur chargeable", "m", 6, L`L_{ch}`), LST("G", "Charges permanentes : « y P » linéique, « y₁ y₂ q » répartie", "kN/m", "0 3 ; 8 3 ; 0 8 5", "G", { cols: 0 }),
    SEL("fib", "Fibre étudiée", [["max", "la plus défavorable"], ["c", "axe de la dalle"], ["g", "bord gauche"], ["d", "bord droit"]], "max", "")],
  calc(I) {
    const b = I.Bd / 2, gr = gmGrid(b, I.Lp), fib = gr.fib, c1 = -b + I.y0, c2 = c1 + I.lch, theta = b / I.Lp;
    if (c2 > b + 1e-9 || c1 < -b - 1e-9) throw new Error("la largeur chargeable dépasse la dalle");
    const fibs = I.fib === "max" ? fib.map((_, i) => i) : [I.fib === "c" ? fib.length >> 1 : I.fib === "g" ? 0 : fib.length - 1];
    const G = (I.G || []), Ksum = i => { let s = 0, w = 0; G.forEach(r => { if (r.length >= 3) { const e1 = -b + min(r[0], r[1]), e2 = -b + max(r[0], r[1]), F = r[2] * (e2 - e1); s += F * gmStrip(gr, i, e1, e2); w += F; } else if (r.length === 2) { s += r[1] * gmAt(gr, i, -b + r[0]); w += r[1]; } }); return w ? s / w : NaN; };
    const best = f => { let m = -1e99, at = 0; fibs.forEach(i => { const v = f(i); if (v > m) { m = v; at = i; } }); return { v: m, y: fib[at] + b }; };
    const nv = I.lch >= 5 && I.lch < 6 ? 2 : Math.floor(I.lch / 3), v = I.lch / max(nv, 1);
    const scan = (w, fn) => i => { let m = -1e99; for (let s = c1; s <= c2 - w + 1e-9; s += 0.05) m = max(m, fn(i, s)); return m; };
    const rows = [], vals = {};
    const cp = best(Ksum); vals.Kcp = cp.v; rows.push(["Charges permanentes", "—", cp.v, cp.y]);
    for (let n = 1; n <= nv; n++) { const fl = i => gmStrip(gr, i, c1, c1 + n * v), fr = i => gmStrip(gr, i, c2 - n * v, c2), a = best(i => max(fl(i), fr(i))); vals["KA" + n] = a.v; rows.push([`A(l) — ${n} voie${n > 1 ? "s" : ""}`, f2(n * v, 2) + " m", a.v, a.y]); }
    const wheel = (i, x) => gmStrip(gr, i, x, x + 0.25), bc = n => scan(2.25 + 2.5 * (n - 1), (i, s) => { let t = 0; for (let j = 0; j < n; j++) t += wheel(i, s + 2.5 * j) + wheel(i, s + 2.5 * j + 2); return t / (2 * n); });
    for (let n = 1; n <= min(nv, 2); n++) { const r = best(bc(n)); vals["KBc" + n] = r.v; rows.push([`Bc — ${n} file${n > 1 ? "s" : ""}`, "roues 0,25 m", r.v, r.y]); }
    if (I.lch >= 4.3) { const r = best(scan(4.3, (i, s) => (gmStrip(gr, i, s, s + 1) + gmStrip(gr, i, s + 3.3, s + 4.3)) / 2)); vals.KMc = r.v; rows.push(["Mc120", "chenilles 1 m", r.v, r.y]); }
    const kmax = rows.reduce((m, r) => max(m, r[2]), 0);
    return { steps: [S("b", "b", L`\tfrac12\,\text{largeur}`, b, "m", 2), S("theta", L`\theta`, L`\dfrac{b}{L}`, theta, "", 4), S("nv", L`n_v`, L`E\!\left(\dfrac{L_{ch}}{3}\right)`, nv, "", 0),
      R("Kcp", L`K_{G}`, L`\dfrac{\sum K(y, e_i)\,G_i}{\sum G_i}`, cp.v, "", 4),
      R("Kmax", L`K_{max}`, "", kmax, "", 4)],
      tables: [{ title: "Coefficients de majoration (fibre la plus défavorable)", head: ["Charge", "Disposition", "K", "fibre y (m)"], rows, d: [0, 4, 2] }],
      vals, notes: ["Le moment longitudinal d'une fibre vaut $K$ fois le moment obtenu en répartissant la charge uniformément sur toute la largeur de la dalle. Dalle isotrope ($\\alpha = 1$, $\\nu = 0$), premier harmonique ; $K$ est obtenu par résolution exacte de l'équation des plaques à bords libres. Les charges routières sont déplacées dans la largeur chargeable pour maximiser $K$."] };
  },
  fig(I, g, r) {
    const b = I.Bd / 2, gr = gmGrid(b, I.Lp, 32, 160), W = 330, Hh = 180, x1 = 28, x2 = W - 16, X = y => x1 + (x2 - x1) * (y + b) / (2 * b), yb = 34, yk = 150;
    let s = Rc(x1, yb - 8, x2 - x1, 10, { f: K.conc, c: K.concD }) + P(`M${X(-b + I.y0)} ${yb - 14}H${X(-b + I.y0 + I.lch)}`, { c: K.red, w: 1.2, dash: "4 2" }) + T(X(-b + I.y0 + I.lch / 2), yb - 18, "largeur chargeable", { a: "middle", s: 8.5, c: K.red });
    const fi = [0, gr.fib.length >> 1, gr.fib.length - 1], cols = [K.gold, K.teal, K.blue], kmx = max(...fi.flatMap(i => gr.G[i])), sc = 90 / max(1.5, kmx);
    fi.forEach((i, j) => { s += P(gr.es.map((e, k) => `${k ? "L" : "M"}${X(e).toFixed(1)} ${(yk - gr.G[i][k] * sc).toFixed(1)}`).join(""), { c: cols[j], w: 1.5 }); });
    s += P(`M${x1} ${yk}H${x2}`, { c: K.mute, w: .8 }) + P(`M${x1} ${yk - sc}H${x2}`, { c: K.mute, w: .6, dash: "2 3" }) + T(x1 - 4, yk - sc + 3, "1", { a: "end", s: 8.5, c: K.mute });
    s += T(x1, Hh - 6, "K(e) : bord gauche, axe, bord droit", { s: 8.5, c: K.mute }) + T(x2, Hh - 6, `θ = ${f2(g("theta"), 3)}   K max = ${f2(g("Kmax"), 3)}`, { a: "end", s: 9.5, w: 500 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Au droit de la fibre la plus chargée, la flexion longitudinale doit être majorée de ${f2((g("Kmax") - 1) * 100, 1)} % au plus (K = ${f2(g("Kmax"), 3)}).` },

{ id: "rdm-chainette", t: "Câble pesant en chaînette entre deux appuis", ref: "Biblio 2004 « Détermination d'une chaînette » — câble inextensible, poids propre",
  desc: "Paramètre de la chaînette, flèche, position du point bas, efforts et angles aux appuis d'un câble ou d'un hauban inextensible de longueur donnée suspendu entre deux points.",
  inputs: [N("a", "Portée horizontale entre appuis", "m", 16, "a"), N("h", "Dénivelée (appui droit au-dessus du gauche)", "m", 4.8, "h"), N("s", "Longueur du câble", "m", 17.2, "s"),
    N("D", "Diamètre du câble (0 : saisir le poids)", "mm", 70, "D"), N("rho", "Masse volumique", "kg/m³", 7850, L`\rho`), N("w0", "Poids linéique (si D = 0)", "kN/m", 0.3, L`w`)],
  calc(I) {
    const w = I.D > 0 ? PI * (I.D / 1000) ** 2 / 4 * I.rho * 9.81 / 1000 : I.w0, chord = Math.hypot(I.a, I.h);
    if (I.s <= chord) throw new Error(`le câble doit être plus long que la corde (${fmt(chord, 3)} m)`);
    const rhs = sqrt(I.s * I.s - I.h * I.h); let lo = 1e-6 * I.a, hi = 1e6 * I.a; for (let i = 0; i < 200; i++) { const c = sqrt(lo * hi); if (2 * c * Math.sinh(I.a / (2 * c)) > rhs) lo = c; else hi = c; }
    const c = sqrt(lo * hi), x1 = c * Math.atanh(I.h / I.s) - I.a / 2, x2 = x1 + I.a, yA = c * Math.cosh(x1 / c), yB = c * Math.cosh(x2 / c), Hf = w * c;
    const VA = -w * c * Math.sinh(x1 / c), VB = w * c * Math.sinh(x2 / c), TA = w * yA, TB = w * yB;
    const sag = (() => { let m = 0; for (let i = 0; i <= 400; i++) { const x = x1 + I.a * i / 400, yc = yA + (yB - yA) * (x - x1) / I.a; m = max(m, yc - c * Math.cosh(x / c)); } return m; })();
    return { steps: [S("w", "w", I.D > 0 ? L`\rho\,g\,\dfrac{\pi D^2}{4}` : "~saisi", w, "kN/m", 4), S("chord", L`\ell_0`, L`\sqrt{a^2 + h^2}`, chord, "m", 3),
      R("c", "c", L`2c\,\sinh\dfrac{a}{2c} = \sqrt{s^2 - h^2}`, c, "m", 3), S("xA", L`x_A`, L`c\,\text{argth}\dfrac{h}{s} - \dfrac{a}{2}` + "\\ \\ \\text{(origine au point bas)}", x1, "m", 3),
      R("H", "H", L`w\,c`, Hf, "kN", 3), S("VA", L`V_A`, L`-w\,c\,\sinh\dfrac{x_A}{c}`, VA, "kN", 3), S("VB", L`V_B`, L`w\,c\,\sinh\dfrac{x_B}{c}`, VB, "kN", 3),
      S("TA", L`T_A`, L`w\,c\,\cosh\dfrac{x_A}{c}`, TA, "kN", 3), R("TB", L`T_B`, L`w\,c\,\cosh\dfrac{x_B}{c}`, TB, "kN", 3), S("aA", L`\alpha_A`, L`\arctan(V_A/H)`, deg(Math.atan2(VA, Hf)), "°", 2), S("aB", L`\alpha_B`, "", deg(Math.atan2(VB, Hf)), "°", 2),
      R("f", "f", "~flèche maximale mesurée verticalement depuis la corde", sag, "m", 3), S("bas", "", x1 < 0 && x2 > 0 ? "~le point bas est dans la portée" : "~pas de point bas dans la portée (câble montant)", x1 < 0 && x2 > 0 ? -x1 : NaN, "m", 3)].filter(s => !(typeof s.v === "number" && isNaN(s.v))),
      vals: { c, x1, x2 }, notes: ["Câble parfaitement souple et inextensible : pour un câble élastique, ajouter l'allongement $T\\,s/(EA)$ et itérer. Le point bas est repéré depuis l'appui gauche."] };
  },
  fig(I, g, r) {
    const { c, x1, x2 } = r.vals, W = 330, Hh = 175, yAc = c * Math.cosh(x1 / c), pts = range(x1, x2, 80).map(x => [x - x1, c * Math.cosh(x / c) - yAc]);
    const ys = pts.map(p => p[1]).concat([0, I.h]), ymn = min(...ys), ymx = max(...ys), k = min(260 / I.a, 120 / (ymx - ymn || 1)), X = x => 34 + x * k, Y = y => 26 + (ymx - y) * k;
    let s = P(`M${X(0)} ${Y(0)}L${X(I.a)} ${Y(I.h)}`, { c: K.mute, dash: "4 3" }) + P("M" + pts.map(p => `${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join("L"), { c: K.ink, w: 2 });
    s += Rc(X(0) - 8, Y(0) - 4, 8, 8, { f: K.ink, c: K.ink }) + Rc(X(I.a), Y(I.h) - 4, 8, 8, { f: K.ink, c: K.ink });
    s += T(X(0) - 6, Y(0) + 18, `TA = ${f2(g("TA"), 2)} kN`, { s: 9, c: K.red }) + T(X(I.a) - 4, Y(I.h) - 8, `TB = ${f2(g("TB"), 2)} kN`, { a: "end", s: 9, c: K.red });
    s += T(W - 8, Hh - 6, `c = ${f2(g("c"), 2)} m   H = ${f2(g("H"), 2)} kN   f = ${f2(g("f"), 2)} m`, { a: "end", s: 9, c: K.mute });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le câble prend une flèche de ${f2(g("f"), 2)} m ; sa tension horizontale vaut ${f2(g("H"), 2)} kN et il tire au plus ${f2(g("TB"), 2)} kN sur l'appui haut.` },

{ id: "rdm-flottaison", t: "Caisson flottant : enfoncement et inclinaison sous charges excentrées", ref: "Biblio 2004 « Rotation d'un caisson en flottaison » — hydrostatique, formule des parois verticales",
  desc: "Tirant d'eau, hauteur métacentrique et angle d'inclinaison d'un caisson parallélépipédique flottant chargé de charges excentrées (équilibre en grands angles jusqu'à l'immersion du bord).",
  inputs: [N("Lc", "Longueur du caisson", "m", 30, "L"), N("lc", "Largeur (dans le plan de rotation)", "m", 9, "l"), N("hc", "Hauteur", "m", 2.5, "h"),
    N("Pc", "Poids propre du caisson", "kN", 1177.2, "P"), N("zG", "Hauteur du centre de gravité du caisson", "m", 1.25, L`z_G`),
    LST("F", "Charges : F a z (F vers le bas, a excentrement, z hauteur)", "kN, m", "300 2.5 2.5", "F", { cols: 3 }), N("Mh", "Moment de renversement complémentaire (vent, houle)", "kN·m", 0, L`M_h`), N("gw", "Poids volumique de l'eau", "kN/m³", 10, L`\gamma_w`)],
  calc(I) {
    const Fs = I.F || [], W = I.Pc + Fs.reduce((s, f) => s + f[0], 0), d = W / (I.gw * I.Lc * I.lc), KG = (I.Pc * I.zG + Fs.reduce((s, f) => s + f[0] * f[2], 0)) / W;
    const Mh = I.Mh + Fs.reduce((s, f) => s + f[0] * f[1], 0), KB = d / 2, BM_ = I.lc * I.lc / (12 * d), GM = KB + BM_ - KG;
    const a3 = W * BM_ / 2, c1 = W * GM; let t = 0;                           // W·(GM + BM·t²/2)·t = Mh
    if (abs(Mh) > 0) { let lo = -10, hi = 10; const f = x => a3 * x ** 3 + c1 * x - Mh; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; } t = (lo + hi) / 2; }
    const th = Math.atan(t), tlim = min((I.hc - d), d) / (I.lc / 2);
    return { steps: [S("W", "W", L`P + \textstyle\sum F_i`, W, "kN", 1), R("d", "d", L`\dfrac{W}{\gamma_w\,L\,l}`, d, "m", 3), S("fb", L`h - d`, "~franc-bord", I.hc - d, "m", 3),
      S("KG", L`\overline{KG}`, L`\dfrac{P\,z_G + \sum F_i z_i}{W}`, KG, "m", 3), S("KB", L`\overline{KB}`, L`d/2`, KB, "m", 3), S("BM", L`\overline{BM}`, L`\dfrac{l^2}{12\,d}`, BM_, "m", 3),
      R("GM", L`\overline{GM}`, L`\overline{KB} + \overline{BM} - \overline{KG}`, GM, "m", 3), S("Mh_", L`M_h`, L`\textstyle\sum F_i\,a_i + M_h`, Mh, "kN·m", 1),
      S("eq", "", L`\dfrac{W\,\overline{BM}}{2}\tan^3\theta + W\,\overline{GM}\tan\theta = M_h`, "", "", 0), R("tht", L`\theta`, "", deg(th), "°", 3), S("thr", L`\tan\theta`, "", t, "", 5),
      S("dz", L`\Delta z`, L`\tfrac{l}{2}\tan\theta`, I.lc / 2 * t, "m", 3)],
      checks: [C("Stabilité initiale (GM > 0)", GM > 0, GM > 0 ? "hauteur métacentrique positive" : "caisson instable : il chavire"), C("Flottaison (franc-bord positif)", d < I.hc, `tirant d'eau ${fmt(d, 2)} m pour ${fmt(I.hc, 2)} m de hauteur`),
        C("Bord non immergé et fond non émergé", abs(t) <= tlim, `tan θ = ${fmt(abs(t), 3)} ≤ ${fmt(tlim, 3)} (formule des parois verticales valable)`, abs(t) / tlim)],
      notes: ["Équilibre en grands angles par la formule des parois verticales (« wall-sided »), valable tant que le bord du pont n'est pas immergé et que le fond ne sort pas de l'eau. Effets de carène liquide (eau de ballast) non pris en compte."] };
  },
  fig(I, g) {
    const W = 330, Hh = 175, k = min(220 / I.lc, 70 / I.hc), cx = 160, yw = 92, t = rad(g("tht")), d = g("d"), ca = Math.cos(t), sa = Math.sin(t);
    const rot = (x, z) => [cx + (x * ca + (z - d) * sa) * k, yw - (-x * sa + (z - d) * ca) * k], box = [[-I.lc / 2, 0], [I.lc / 2, 0], [I.lc / 2, I.hc], [-I.lc / 2, I.hc]].map(p => rot(...p));
    let s = Rc(10, yw, W - 20, Hh - yw - 10, { f: K.blueL, c: "none", op: .5 }) + P(`M10 ${yw}H${W - 10}`, { c: K.blue, w: 1.2 });
    s += P("M" + box.map(p => p.map(v => v.toFixed(1)).join(" ")).join("L") + "Z", { c: K.ink, f: K.conc, w: 1.4 });
    (I.F || []).forEach(f => { const [x, y] = rot(f[1], f[2]); s += arrow(x, y - 26, x, y - 2, K.red, 1.6) + T(x + 3, y - 18, f2(f[0], 0), { s: 8.5, c: K.red }); });
    s += T(14, 20, `θ = ${f2(g("tht"), 2)}°`, { s: 11, w: 600 }) + T(14, Hh - 16, `d = ${f2(d, 2)} m   GM = ${f2(g("GM"), 2)} m`, { s: 9.5, c: K.ink });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le caisson s'enfonce de ${f2(g("d"), 2)} m et s'incline de ${f2(g("tht"), 2)}° ; sa hauteur métacentrique vaut ${f2(g("GM"), 2)} m.` },

]);

HB.GM = { gmK, gmGrid };
})(typeof window !== "undefined" ? window : globalThis);
