/* ════════════════════════════════════════════════════════════════════
   HandBag — Outils (classeurs Biblio 2004)
   Équations du 3e et du 4e degré, matrice de rotation, cercles tangents à deux droites,
   clothoïde de raccordement, interpolation (Lagrange, moindres carrés),
   enveloppe convexe, étude d'une fonction y = f(x).
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, udl } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), rad = d => d * PI / 180, deg = r => r * 180 / PI;

/* racines d'un polynôme (coefficients du plus haut degré au terme constant) — méthode de Durand-Kerner */
function roots(c) {
  while (c.length > 1 && abs(c[0]) < 1e-300) c = c.slice(1);
  const n = c.length - 1; if (n < 1) return [];
  const a = c.map(v => v / c[0]); let z = Array.from({ length: n }, (_, k) => { const t = 2 * PI * k / n + 0.4; const r = 1 + max(...a.slice(1).map(abs)); return [r * Math.cos(t), r * Math.sin(t)]; });
  const mul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]], div = (p, q) => { const d = q[0] * q[0] + q[1] * q[1]; return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d]; };
  const ev = x => a.reduce((s, ci) => { const m = mul(s, x); return [m[0] + ci, m[1]]; }, [0, 0]);
  for (let it = 0; it < 2000; it++) { let delta = 0; z = z.map((zi, i) => { let den = [1, 0]; z.forEach((zj, j) => { if (j !== i) den = mul(den, [zi[0] - zj[0], zi[1] - zj[1]]); }); const step = div(ev(zi), den); delta = max(delta, Math.hypot(...step)); return [zi[0] - step[0], zi[1] - step[1]]; }); if (delta < 1e-15) break; }
  /* polissage de Newton */
  const der = a.slice(0, -1).map((ci, i) => ci * (n - i));
  z = z.map(zi => { for (let k = 0; k < 5; k++) { const f = ev(zi), d = der.reduce((s, ci) => { const m = mul(s, zi); return [m[0] + ci, m[1]]; }, [0, 0]); if (Math.hypot(...d) < 1e-300) break; const st = div(f, d); zi = [zi[0] - st[0], zi[1] - st[1]]; } return zi; });
  return z.map(([re, im]) => [re, abs(im) < 1e-9 * max(1, abs(re)) ? 0 : im]).sort((p, q) => (abs(p[1]) > 0) - (abs(q[1]) > 0) || q[0] - p[0]);
}
const cstr = ([re, im]) => im ? `${fmt(re, 5)} ${im > 0 ? "+" : "−"} ${fmt(abs(im), 5)} i` : fmt(re, 6);

/* expression y = f(x) : analyseur sûr (nombres, x, + − * / ^, parenthèses, fonctions usuelles) */
function compile(src) {
  const s = String(src).replace(/\s+/g, "").replace(/,/g, ".").replace(/\*\*/g, "^"); let i = 0;
  const F = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, ln: Math.log, log: Math.log10, sqrt: Math.sqrt, abs: Math.abs, rac: Math.sqrt };
  const peek = () => s[i], eat = ch => { if (s[i] === ch) { i++; return true; } return false; };
  function expr() { let n = term(); for (;;) { if (eat("+")) { const a = n, b = term(); n = x => a(x) + b(x); } else if (eat("-")) { const a = n, b = term(); n = x => a(x) - b(x); } else return n; } }
  function term() { let n = unary(); for (;;) { if (eat("*")) { const a = n, b = unary(); n = x => a(x) * b(x); } else if (eat("/")) { const a = n, b = unary(); n = x => a(x) / b(x); } else return n; } }
  function unary() { if (eat("-")) { const a = unary(); return x => -a(x); } if (eat("+")) return unary(); return power(); }
  function power() { const b = atom(); if (eat("^")) { const e = unary(); return x => pow(b(x), e(x)); } return b; }
  function atom() {
    if (eat("(")) { const n = expr(); if (!eat(")")) throw new Error("parenthèse manquante"); return n; }
    const m = /^(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)/i.exec(s.slice(i)); if (m) { i += m[0].length; const v = +m[0]; return () => v; }
    const w = /^[a-z]+/i.exec(s.slice(i)); if (w) { const id = w[0].toLowerCase(); i += w[0].length;
      if (id === "x") return x => x; if (id === "pi") return () => PI; if (id === "e") return () => Math.E;
      if (F[id]) { if (!eat("(")) throw new Error(`« ${id} » doit être suivi d'une parenthèse`); const a = expr(); if (!eat(")")) throw new Error("parenthèse manquante"); return x => F[id](a(x)); }
      throw new Error(`nom inconnu : « ${id} »`); }
    throw new Error(`caractère inattendu : « ${peek() ?? "fin"} »`);
  }
  const f = expr(); if (i < s.length) throw new Error(`caractère inattendu : « ${s[i]} »`); return f;
}
/* moindres carrés (polynôme de degré d) */
function lsq(xs, ys, d) { const n = d + 1, A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
  xs.forEach((x, k) => { for (let i = 0; i < n; i++) { b[i] += ys[k] * pow(x, i); for (let j = 0; j < n; j++) A[i][j] += pow(x, i + j); } });
  const M = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (abs(M[r][i]) > abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; for (let r = i + 1; r < n; r++) { const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; } }
  const c = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let k = i + 1; k < n; k++) s -= M[i][k] * c[k]; c[i] = s / M[i][i]; } return c; }
const polyv = (c, x) => c.reduce((s, ci, i) => s + ci * pow(x, i), 0);
/* clothoïde (paramètre A) : coordonnées par série de Fresnel */
function clo(Lc, A) { let x = 0, y = 0; const n = 400; for (let i = 0; i < n; i++) { const s = (i + 0.5) * Lc / n, t = s * s / (2 * A * A); x += Math.cos(t) * Lc / n; y += Math.sin(t) * Lc / n; } return [x, y]; }

HB.add("Outils", [

{ id: "out-equation", t: "Résolution des équations du 3e et du 4e degré", ref: "Biblio 2004 « Résolution de l'équation » — racines réelles et complexes",
  desc: "Racines réelles et complexes d'une équation polynomiale du troisième ou du quatrième degré.",
  inputs: [SEL("deg", "Équation", [["3", "a·y³ + b·y² + c·y + d = 0"], ["4", "y⁴ + a·y³ + b·y² + c·y + d = 0"]], "3", ""), N("a", "a", "", 4, "a"), N("b", "b", "", 28, "b"), N("c", "c", "", -50, "c"), N("d", "d", "", -175, "d")],
  calc(I) {
    const co = I.deg === "3" ? [I.a, I.b, I.c, I.d] : [1, I.a, I.b, I.c, I.d], rs = roots(co), real = rs.filter(r => !r[1]).map(r => r[0]).sort((p, q) => q - p);
    const vals = {}; rs.forEach((r, i) => { vals["re" + (i + 1)] = r[0]; vals["im" + (i + 1)] = r[1]; }); real.forEach((v, i) => { vals["x" + (i + 1)] = v; });
    const res = max(...rs.map(([re, im]) => { let s = [0, 0]; co.forEach(ci => { s = [s[0] * re - s[1] * im + ci, s[0] * im + s[1] * re]; }); return Math.hypot(...s); }));
    return { steps: [S("nr", "", "~nombre de racines réelles", real.length, "", 0), ...rs.map((r, i) => S("y" + (i + 1), L`y_{${i + 1}}`, `~${cstr(r)}`, r[1] ? NaN : r[0], "", 6)).map(st => isNaN(st.v) ? { ...st, v: "complexe" } : st), S("res", "", "~résidu maximal |P(yᵢ)|", res, "", 3)],
      vals, notes: ["Racines obtenues numériquement (méthode de Durand-Kerner, puis polissage de Newton), réelles et complexes conjuguées, triées par valeur décroissante."] };
  },
  fig(I, g, r) { const co = I.deg === "3" ? [I.a, I.b, I.c, I.d] : [1, I.a, I.b, I.c, I.d], re = Object.keys(r.vals).filter(k => k.startsWith("x")).map(k => r.vals[k]);
    const lo = re.length ? min(...re) : -5, hi = re.length ? max(...re) : 5, pad = max(1, (hi - lo) * 0.3), xs = range(lo - pad, hi + pad, 160), f = x => co.reduce((s, ci) => s * x + ci, 0), ys = xs.map(f), m = max(...ys.map(abs).slice(20, 140), 1);
    return plot({ series: [{ pts: xs.map((x, i) => [x, max(-m, min(m, ys[i]))]), c: K.gold, l: "P(y)" }], hlines: [{ y: 0 }], marks: re.map(x => ({ x, y: 0, l: f2(x, 3) })), xl: "y", h: 175 }); },
  clair: (I, g, r) => { const re = Object.keys(r.vals).filter(k => k.startsWith("x")).map(k => r.vals[k]); return `L'équation a ${re.length} racine${re.length > 1 ? "s" : ""} réelle${re.length > 1 ? "s" : ""}${re.length ? " : " + re.map(v => f2(v, 4)).join(" ; ") : ""}.`; } },

{ id: "out-rotation", t: "Matrice de rotation autour d'un axe quelconque", ref: "Biblio 2004 « Matrices de rotation dans l'espace » — formule de Rodrigues",
  desc: "Matrice de rotation d'un angle donné autour d'une droite de vecteur directeur quelconque, et image d'un vecteur.",
  inputs: [N("ux", "Vecteur directeur : x", "", 1, L`u_x`), N("uy", "y", "", 2, L`u_y`), N("uz", "z", "", 4, L`u_z`), N("ang", "Angle de rotation", "°", 10, L`\varphi`),
    LST("v", "Vecteur à transformer : x y z", "", "1 0 0", "v", { cols: 3 })],
  calc(I) {
    const nn = Math.hypot(I.ux, I.uy, I.uz); if (!nn) throw new Error("vecteur directeur nul");
    const [a, b, c] = [I.ux / nn, I.uy / nn, I.uz / nn], t = rad(I.ang), co = Math.cos(t), si = Math.sin(t), k = 1 - co;
    const Rm = [[co + a * a * k, a * b * k - c * si, a * c * k + b * si], [b * a * k + c * si, co + b * b * k, b * c * k - a * si], [c * a * k - b * si, c * b * k + a * si, co + c * c * k]];
    const v = (I.v && I.v[0]) || [1, 0, 0], w = Rm.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
    const vals = {}; Rm.forEach((r, i) => r.forEach((x, j) => { vals[`r${i + 1}${j + 1}`] = x; }));
    return { steps: [S("n1", L`n`, L`\dfrac{u}{\lVert u\rVert}`, `(${[a, b, c].map(x => fmt(x, 4)).join(" ; ")})`, "", 0), S("al", L`\alpha`, "~azimut de l'axe", deg(Math.atan2(I.uy, I.ux)), "°", 3), S("te", L`\theta`, "~élévation de l'axe", deg(Math.asin(c)), "°", 3),
      S("rod", "R", L`\cos\varphi\,\mathbf I + (1 - \cos\varphi)\,\mathbf n\,\mathbf n^{\mathsf T} + \sin\varphi\,[\mathbf n]_\times`, "", "", 0), S("w", L`R\,v`, "", `(${w.map(x => fmt(x, 5)).join(" ; ")})`, "", 0), S("det", L`\det R`, "", Rm[0][0] * (Rm[1][1] * Rm[2][2] - Rm[1][2] * Rm[2][1]) - Rm[0][1] * (Rm[1][0] * Rm[2][2] - Rm[1][2] * Rm[2][0]) + Rm[0][2] * (Rm[1][0] * Rm[2][1] - Rm[1][1] * Rm[2][0]), "", 6)],
      tables: [{ title: "Matrice de rotation R", head: ["", "x", "y", "z"], rows: Rm.map((r, i) => [["x", "y", "z"][i], ...r]), d: [6, 6, 6] }], vals,
      notes: ["Rotation dans le sens direct autour de n. La matrice inverse (rotation de −φ) est la transposée de R. Le classeur passait par les angles d'Euler (azimut, élévation) : le résultat est identique."] };
  },
  fig(I, g, r) {
    const W = 330, Hh = 170, cx = 120, cy = 100, pr = ([x, y, z]) => [cx + (x - y) * 0.7 * 50, cy + ((x + y) * 0.4 - z) * 50];
    let s = ["x", "y", "z"].map((l, i) => { const e = [0, 0, 0]; e[i] = 1.2; const [X, Y] = pr(e); return arrow(cx, cy, X, Y, K.mute, 1) + T(X + 3, Y, l, { s: 9, c: K.mute }); }).join("");
    const nn = Math.hypot(I.ux, I.uy, I.uz), n = [I.ux / nn, I.uy / nn, I.uz / nn].map(v => v * 1.5), [X, Y] = pr(n); s += arrow(cx, cy, X, Y, K.blue, 2) + T(X + 4, Y - 2, "n", { s: 10, c: K.blue, w: 600 });
    const v = (I.v && I.v[0]) || [1, 0, 0], w = [0, 1, 2].map(i => r.vals[`r${i + 1}1`] * v[0] + r.vals[`r${i + 1}2`] * v[1] + r.vals[`r${i + 1}3`] * v[2]), [Vx, Vy] = pr(v), [Wx, Wy] = pr(w);
    s += arrow(cx, cy, Vx, Vy, K.gold, 1.6) + arrow(cx, cy, Wx, Wy, K.red, 1.6) + T(Wx + 3, Wy + 10, "Rv", { s: 9.5, c: K.red }) + T(Vx + 3, Vy + 10, "v", { s: 9.5, c: K.gold });
    s += T(250, 60, `φ = ${f2(I.ang, 1)}°`, { s: 12, w: 600 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La rotation de ${f2(I.ang, 1)}° autour de l'axe (${f2(I.ux, 1)} ; ${f2(I.uy, 1)} ; ${f2(I.uz, 1)}) transforme le vecteur en ${g("w")}.` },

{ id: "out-cercles", t: "Cercles de rayon donné tangents à deux droites", ref: "Biblio 2004 « Différents calculs géométriques avec des cercles » — cercles raccordant deux droites",
  desc: "Centres et points de contact des quatre cercles de rayon R tangents à deux droites sécantes définies chacune par deux points.",
  inputs: [H("Droite 1"), N("ax", "A : x", "m", 3.2522, L`x_A`), N("ay", "A : y", "m", 8.486, L`y_A`), N("bx", "B : x", "m", 1.2969, L`x_B`), N("by", "B : y", "m", 2.7685, L`y_B`),
    H("Droite 2"), N("cx", "A' : x", "m", 6.2998, L`x_{A'}`), N("cy", "A' : y", "m", 4.4104, L`y_{A'}`), N("dx", "B' : x", "m", 9.3089, L`x_{B'}`), N("dy", "B' : y", "m", 1.0495, L`y_{B'}`), N("Rr", "Rayon des cercles", "m", 4.215, "R")],
  calc(I) {
    const line = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy); if (!l) throw new Error("deux points confondus"); return { a: -dy / l, b: dx / l, c: (dy * x1 - dx * y1) / l }; };   /* a x + b y + c = 0, (a,b) unitaire */
    const d1 = line(I.ax, I.ay, I.bx, I.by), d2 = line(I.cx, I.cy, I.dx, I.dy), det = d1.a * d2.b - d1.b * d2.a; if (abs(det) < 1e-12) throw new Error("droites parallèles");
    const X0 = (d1.b * d2.c - d2.b * d1.c) / det, Y0 = (d2.a * d1.c - d1.a * d2.c) / det, ang = deg(Math.acos(abs(d1.a * d2.a + d1.b * d2.b)));
    const cs = []; for (const s1 of [1, -1]) for (const s2 of [1, -1]) { /* d1(P) = s1 R, d2(P) = s2 R */ const r1 = s1 * I.Rr - d1.c, r2 = s2 * I.Rr - d2.c, x = (r1 * d2.b - r2 * d1.b) / det, y = (d1.a * r2 - d2.a * r1) / det;
      const p1 = [x - s1 * I.Rr * d1.a, y - s1 * I.Rr * d1.b], p2 = [x - s2 * I.Rr * d2.a, y - s2 * I.Rr * d2.b]; cs.push({ c: [x, y], p1, p2 }); }
    const vals = { cs, X0, Y0 }; cs.forEach((o, i) => { vals[`C${i + 1}x`] = o.c[0]; vals[`C${i + 1}y`] = o.c[1]; vals[`D${i + 1}x`] = o.p1[0]; vals[`D${i + 1}y`] = o.p1[1]; vals[`E${i + 1}x`] = o.p2[0]; vals[`E${i + 1}y`] = o.p2[1]; });
    return { steps: [S("X0", L`x_I`, "~intersection des droites", X0, "m", 4), S("Y0", L`y_I`, "", Y0, "m", 4), S("ang", L`\gamma`, "~angle aigu entre les droites", ang, "°", 3), S("tang", L`t`, L`R / \tan(\gamma/2)`, I.Rr / Math.tan(rad(ang) / 2), "m", 3)],
      tables: [{ title: "Cercles tangents", head: ["", "centre x ; y", "contact droite 1", "contact droite 2"], rows: cs.map((o, i) => [`C${i + 1}`, `${fmt(o.c[0], 4)} ; ${fmt(o.c[1], 4)}`, `${fmt(o.p1[0], 4)} ; ${fmt(o.p1[1], 4)}`, `${fmt(o.p2[0], 4)} ; ${fmt(o.p2[1], 4)}`]) }],
      vals, notes: ["Les quatre centres sont sur les bissectrices des deux droites. t est la longueur de tangente entre le sommet I et les points de contact du cercle situé dans l'angle aigu."] };
  },
  fig(I, g, r) {
    const { cs } = r.vals, pts = [[I.ax, I.ay], [I.bx, I.by], [I.cx, I.cy], [I.dx, I.dy], ...cs.flatMap(o => [[o.c[0] - I.Rr, o.c[1] - I.Rr], [o.c[0] + I.Rr, o.c[1] + I.Rr]])];
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = min(...xs), x1 = max(...xs), y0 = min(...ys), y1 = max(...ys), W = 330, Hh = 185, k = min(300 / (x1 - x0), 170 / (y1 - y0)), X = x => 15 + (x - x0) * k, Y = y => 8 + (y1 - y) * k;
    const ext = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1]; return `M${X(p[0] - 3 * dx)} ${Y(p[1] - 3 * dy)}L${X(q[0] + 3 * dx)} ${Y(q[1] + 3 * dy)}`; };
    let s = `<clipPath id="cc"><rect x="0" y="0" width="${W}" height="${Hh}"/></clipPath><g clip-path="url(#cc)">` + P(ext([I.ax, I.ay], [I.bx, I.by]), { c: K.ink, w: 1.4 }) + P(ext([I.cx, I.cy], [I.dx, I.dy]), { c: K.ink, w: 1.4 });
    cs.forEach((o, i) => { s += Ci(X(o.c[0]), Y(o.c[1]), I.Rr * k, { f: "none", c: [K.gold, K.blue, K.teal, K.red][i], w: 1.2 }) + Ci(X(o.c[0]), Y(o.c[1]), 2, { f: [K.gold, K.blue, K.teal, K.red][i], c: "none" }) + T(X(o.c[0]) + 4, Y(o.c[1]) - 3, `C${i + 1}`, { s: 8.5 }); });
    return svg(W, Hh, s + "</g>");
  },
  clair: (I, g) => `Les deux droites se coupent sous ${f2(g("ang"), 1)}° ; le cercle de ${f2(I.Rr, 2)} m inscrit dans l'angle aigu les touche à ${f2(g("tang"), 2)} m du sommet.` },

{ id: "out-clothoide", t: "Clothoïde de raccordement entre une droite et un cercle", ref: "Biblio 2004 « Recherche d'une clothoïde » — clothoïde unitaire, intégrales de Fresnel",
  desc: "Longueur et paramètre de la clothoïde qui raccorde tangentiellement une droite à un cercle donné, et coordonnées des points de raccordement.",
  inputs: [H("Droite support"), N("xa", "A : x", "m", 6.458, L`x_A`), N("ya", "A : y", "m", 2.99, L`y_A`), N("xb", "B : x", "m", 8.958, L`x_B`), N("yb", "B : y", "m", 1.215, L`y_B`),
    H("Cercle terminal"), N("xc", "Centre : x", "m", 30.642, L`x_C`), N("yc", "Centre : y", "m", 2.9681, L`y_C`), N("Rc", "Rayon", "m", 4.21, "R")],
  calc(I) {
    const dx = I.xb - I.xa, dy = I.yb - I.ya, l = Math.hypot(dx, dy); if (!l) throw new Error("A et B confondus"); const ux = dx / l, uy = dy / l;
    const dn = (I.xc - I.xa) * -uy + (I.yc - I.ya) * ux, side = Math.sign(dn) || 1, D = abs(dn), Rr = I.Rc;
    if (D <= Rr) throw new Error("le cercle coupe la droite : pas de clothoïde de raccordement");
    /* condition : y(L) + R cos τ = D, avec A² = R L et τ = L/(2R) */
    const fy = Lc => { const [x, y] = clo(Lc, sqrt(Rr * Lc)); return y + Rr * Math.cos(Lc / (2 * Rr)) - D; };
    let a = 1e-6, b = a, fa = fy(a), Lc = NaN; for (let k = 1; k <= 4000; k++) { b = k * Rr * 0.05; const fb = fy(b); if (fa * fb <= 0) { for (let it = 0; it < 80; it++) { const m = (a + b) / 2, fm = fy(m); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } } Lc = (a + b) / 2; break; } a = b; fa = fb; }
    if (!isFinite(Lc)) throw new Error("pas de solution trouvée");
    const A = sqrt(Rr * Lc), tau = Lc / (2 * Rr), [xL, yL] = clo(Lc, A), xm = xL - Rr * Math.sin(tau);       /* abscisse du centre dans le repère local */
    /* position du point de départ D sur la droite : le centre doit se trouver à l'abscisse locale xm */
    const sC = (I.xc - I.xa) * ux + (I.yc - I.ya) * uy, s0 = sC - xm, Dx = I.xa + s0 * ux, Dy = I.ya + s0 * uy, Ex = Dx + xL * ux - side * yL * uy, Ey = Dy + xL * uy + side * yL * ux;
    return { steps: [S("D", "d", "~distance du centre à la droite", D, "m", 4), R("Lc", "L", L`y(L) + R\cos\tau = d,\ \ A^2 = R\,L`, Lc, "m", 3), R("A", "A", L`\sqrt{R\,L}`, A, "m", 3), S("tau", L`\tau`, L`\dfrac{L}{2R}`, deg(tau), "°", 2),
      S("xL", L`X(L)`, L`\int_0^L \cos\dfrac{s^2}{2A^2}\,ds`, xL, "m", 4), S("yL", L`Y(L)`, L`\int_0^L \sin\dfrac{s^2}{2A^2}\,ds`, yL, "m", 4), S("dR", L`\Delta R`, L`d - R`, D - Rr, "m", 4),
      S("Dx", L`x_D`, "~origine de la clothoïde sur la droite", Dx, "m", 3), S("Dy", L`y_D`, "", Dy, "m", 3), S("Ex", L`x_E`, "~point de raccordement au cercle", Ex, "m", 3), S("Ey", L`y_E`, "", Ey, "m", 3)],
      vals: { ux, uy, side, Dx, Dy, Lc, A }, notes: ["La clothoïde part tangente à la droite (courbure nulle) et atteint le cercle avec la courbure 1/R. Solution la plus courte retenue ; en tracé routier on vérifie L ≥ R/9 et τ ≤ ~60° (sinon prévoir un autre raccordement)."] };
  },
  fig(I, g, r) {
    const { ux, uy, side, Dx, Dy, Lc, A } = r.vals, pts = range(0, Lc, 120).map(s => { const [x, y] = clo(s, A); return [Dx + x * ux - side * y * uy, Dy + x * uy + side * y * ux]; });
    const all = [...pts, [I.xa, I.ya], [I.xb, I.yb], [I.xc - I.Rc, I.yc - I.Rc], [I.xc + I.Rc, I.yc + I.Rc]], xs = all.map(p => p[0]), ys = all.map(p => p[1]), x0 = min(...xs), x1 = max(...xs), y0 = min(...ys), y1 = max(...ys);
    const W = 330, Hh = 180, k = min(300 / (x1 - x0 || 1), 160 / (y1 - y0 || 1)), X = x => 15 + (x - x0) * k, Y = y => 10 + (y1 - y) * k;
    let s = P(`M${X(Dx - 20 * ux)} ${Y(Dy - 20 * uy)}L${X(Dx)} ${Y(Dy)}`, { c: K.ink, w: 1.6 }) + P("M" + pts.map(p => `${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join("L"), { c: K.red, w: 2 }) + Ci(X(I.xc), Y(I.yc), I.Rc * k, { f: "none", c: K.blue, w: 1.2 });
    s += T(W - 8, Hh - 6, `L = ${f2(g("Lc"), 2)} m   A = ${f2(g("A"), 2)} m`, { a: "end", s: 9.5, w: 500 });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `La clothoïde de raccordement a une longueur de ${f2(g("Lc"), 2)} m et un paramètre A = ${f2(g("A"), 2)} m.` },

{ id: "out-interpolation", t: "Interpolation d'une série de points (Lagrange, moindres carrés)", ref: "Biblio 2004 « Interpolation linéaire et polynomiale entre points »",
  desc: "Polynôme passant par tous les points (Lagrange) ou polynôme des moindres carrés de degré choisi, et valeur interpolée en une abscisse.",
  inputs: [LST("pts", "Points : x y ; …", "", "1.5 20.8 ; 2 21.3 ; 3 22 ; 4 21.9 ; 5 20.3 ; 6 18.3 ; 7 15.5 ; 8 12.8 ; 9 10.5 ; 10 8.2", "", { cols: 2 }),
    SEL("meth", "Méthode", [["m", "moindres carrés"], ["l", "polynôme de Lagrange (passe par tous les points)"], ["s", "linéaire par morceaux"]], "m", ""), N("deg", "Degré du polynôme (moindres carrés)", "", 5, "n"), N("x0", "Abscisse d'interpolation", "", 4.5, L`x_0`)],
  calc(I) {
    const p = (I.pts || []).slice().sort((a, b) => a[0] - b[0]); if (p.length < 2) throw new Error("au moins deux points"); const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    let f, coef = null, d = 0;
    if (I.meth === "s") f = x => { if (x <= xs[0]) return ys[0] + (ys[1] - ys[0]) * (x - xs[0]) / (xs[1] - xs[0]); for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]); const n = xs.length; return ys[n - 2] + (ys[n - 1] - ys[n - 2]) * (x - xs[n - 2]) / (xs[n - 1] - xs[n - 2]); };
    else { d = I.meth === "l" ? xs.length - 1 : min(max(1, Math.round(I.deg)), xs.length - 1); coef = lsq(xs, ys, d); f = x => polyv(coef, x); }
    const rms = sqrt(ys.reduce((s, y, i) => s + (y - f(xs[i])) ** 2, 0) / ys.length), vals = { coef, xs, ys }; if (coef) coef.forEach((c, i) => { vals["a" + i] = c; });
    return { steps: [S("n", "n", "~nombre de points", xs.length, "", 0), ...(coef ? [S("d", "", "~degré du polynôme", d, "", 0), S("eq", "y(x)", L`\textstyle\sum a_i\,x^i`, "", "", 0)] : []), R("y0", L`y(x_0)`, "", f(I.x0), "", 6), S("rms", L`e_{rms}`, "~écart quadratique moyen aux points", rms, "", 5)],
      tables: coef ? [{ title: "Coefficients du polynôme", head: ["terme", "aᵢ"], rows: coef.map((c, i) => [i === 0 ? "1" : i === 1 ? "x" : "x" + ["²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"][i - 2] || "x^" + i, c]), d: [6] }] : [],
      vals, notes: ["Le polynôme de Lagrange de degré n − 1 passe par tous les points mais oscille fortement pour n grand (phénomène de Runge) : préférer les moindres carrés de faible degré ou l'interpolation linéaire pour des mesures bruitées."] };
  },
  fig(I, g, r) { const { xs, ys, coef } = r.vals, f = x => coef ? polyv(coef, x) : null, lo = xs[0], hi = xs.at(-1), xx = range(lo, hi, 120);
    return plot({ series: [{ pts: xs.map((x, i) => [x, ys[i]]), c: K.mute, w: 0.8, dash: "2 3", l: "points" }, coef ? { pts: xx.map(x => [x, f(x)]), c: K.gold, l: "polynôme" } : { pts: xs.map((x, i) => [x, ys[i]]), c: K.gold, l: "linéaire" }], marks: [{ x: I.x0, y: g("y0"), l: f2(g("y0"), 3) }], h: 175 }); },
  clair: (I, g) => `En x = ${f2(I.x0, 3)}, la valeur interpolée vaut ${f2(g("y0"), 4)} (écart quadratique aux points : ${f2(g("rms"), 4)}).` },

{ id: "out-enveloppe-convexe", t: "Enveloppe convexe d'une série de points", ref: "Biblio 2004 « Enveloppe convexe d'une série de points » — algorithme d'Andrew (chaîne monotone)",
  desc: "Sommets de l'enveloppe convexe d'un nuage de points, aire et périmètre du polygone convexe.",
  inputs: [LST("pts", "Points : x y ; …", "", "0.72609 11.117 ; 0.54618 85.169 ; 70.393 54.783 ; 48.845 27.032 ; 4.0417 14.331 ; 70.615 32.408 ; -1 56.388 ; 4.5971 69.737 ; 11.1 38.897 ; 29.449 39.696", "", { cols: 2 })],
  calc(I) {
    const p = (I.pts || []).map(q => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) throw new Error("au moins trois points");
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    p.forEach(q => { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); });
    p.slice().reverse().forEach(q => { while (up.length >= 2 && cr(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); });
    const hull = lo.slice(0, -1).concat(up.slice(0, -1)), A = abs(hull.reduce((s, q, i) => { const n = hull[(i + 1) % hull.length]; return s + q[0] * n[1] - n[0] * q[1]; }, 0)) / 2, per = hull.reduce((s, q, i) => s + Math.hypot(...[0, 1].map(k => hull[(i + 1) % hull.length][k] - q[k])), 0);
    return { steps: [S("n", "n", "~nombre de points", p.length, "", 0), R("nh", L`n_h`, "~sommets de l'enveloppe", hull.length, "", 0), R("A", "A", "~aire de l'enveloppe", A, "", 4), S("per", "u", "~périmètre", per, "", 4)],
      tables: [{ title: "Sommets de l'enveloppe (sens trigonométrique)", head: ["n°", "x", "y"], rows: hull.map((q, i) => [i + 1, q[0], q[1]]), d: [4, 4] }], vals: Object.assign({ hull, p }, ...hull.map((q, i) => ({ [`x${i + 1}`]: q[0], [`y${i + 1}`]: q[1] }))) };
  },
  fig(I, g, r) { const { hull, p } = r.vals, W = 330, Hh = 190, xs = p.map(q => q[0]), ys = p.map(q => q[1]), x0 = min(...xs), x1 = max(...xs), y0 = min(...ys), y1 = max(...ys);
    const k = min((W - 40) / max(x1 - x0, 1e-9), (Hh - 30) / max(y1 - y0, 1e-9)), ox = (W - k * (x1 - x0)) / 2, oy = (Hh + k * (y1 - y0)) / 2, X = x => ox + (x - x0) * k, Y = y => oy - (y - y0) * k;
    let s = P(hull.map((q, i) => (i ? "L" : "M") + X(q[0]).toFixed(1) + " " + Y(q[1]).toFixed(1)).join("") + "Z", { c: K.gold, w: 1.8, f: K.gold, op: .12 });
    p.forEach(q => s += Ci(X(q[0]), Y(q[1]), 2.6, { f: K.blue, c: "#fff", w: .8 }));
    hull.forEach((q, i) => s += T(X(q[0]) + (X(q[0]) < W / 2 ? -6 : 6), Y(q[1]) + (Y(q[1]) < Hh / 2 ? -5 : 11), String(i + 1), { a: X(q[0]) < W / 2 ? "end" : "start", s: 9, c: K.red, w: 600 }));
    return svg(W, Hh, s); },
  clair: (I, g) => `L'enveloppe convexe des ${f2(g("n"), 0)} points compte ${f2(g("nh"), 0)} sommets et couvre une aire de ${f2(g("A"), 2)}.` },

{ id: "out-fonction", t: "Étude d'une fonction y = f(x) : tracé, intégrale, extremums et racines", ref: "Biblio 2004 « Tracés de fonctions et calcul d'intégrale »",
  desc: "Tracé d'une fonction saisie en clair, intégrale par la méthode de Simpson, valeurs extrêmes et racines sur un intervalle.",
  inputs: [{ k: "fx", l: "Fonction y = (x, + − * / ^, sin, cos, tan, exp, ln, log, sqrt, abs, pi)", u: "", v: "x^1.5*sin(x+1/(x+1))", s: "f(x)", t: "text" }, N("a", "Borne inférieure", "", 0, "a"), N("b", "Borne supérieure", "", 5, "b"), N("n", "Découpage (nombre pair d'intervalles)", "", 100, "n")],
  calc(I) {
    const f = compile(I.fx), n = max(2, 2 * Math.round(I.n / 2)), h = (I.b - I.a) / n, xs = range(I.a, I.b, n), ys = xs.map(x => { const y = f(x); if (!isFinite(y)) throw new Error(`fonction non définie en x = ${fmt(x, 4)}`); return y; });
    const Si = ys.reduce((s, y, i) => s + (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * y, 0) * h / 3, Tr = ys.reduce((s, y, i) => s + (i === 0 || i === n ? 0.5 : 1) * y, 0) * h;
    const iMax = ys.indexOf(max(...ys)), iMin = ys.indexOf(min(...ys)), zeros = []; for (let i = 0; i < n; i++) if (ys[i] === 0 || ys[i] * ys[i + 1] < 0) { let a = xs[i], b = xs[i + 1]; for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (f(a) * f(m) <= 0) b = m; else a = m; } zeros.push((a + b) / 2); }
    return { steps: [R("I", L`\int_a^b f(x)\,dx`, "~méthode de Simpson", Si, "", 6), S("It", "", "~méthode des trapèzes (contrôle)", Tr, "", 6), S("ym", L`\bar y`, L`\dfrac{1}{b - a}\int_a^b f`, Si / (I.b - I.a), "", 5),
      S("ymax", L`y_{max}`, `~en x = ${fmt(xs[iMax], 4)}`, ys[iMax], "", 5), S("ymin", L`y_{min}`, `~en x = ${fmt(xs[iMin], 4)}`, ys[iMin], "", 5), S("nz", "", `~racines dans l'intervalle${zeros.length ? " : " + zeros.slice(0, 6).map(z => fmt(z, 5)).join(" ; ") : ""}`, zeros.length, "", 0)],
      vals: { xs, ys, zeros }, notes: ["Saisie : x, nombres, + − * / ^, parenthèses, fonctions sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, exp, ln (népérien), log (décimal), sqrt, abs, constantes pi et e. Le découpage est arrondi au nombre pair d'intervalles le plus proche."] };
  },
  fig(I, g, r) { const { xs, ys, zeros } = r.vals; return plot({ series: [{ pts: xs.map((x, i) => [x, ys[i]]), c: K.gold, l: "y = f(x)" }], areas: [{ pts: xs.map((x, i) => [x, ys[i]]), c: K.gold, op: .15 }], hlines: [{ y: 0 }], marks: zeros.slice(0, 4).map(z => ({ x: z, y: 0, l: f2(z, 3) })), xl: "x", h: 180 }); },
  clair: (I, g) => `Sur [${f2(I.a, 2)} ; ${f2(I.b, 2)}], l'intégrale vaut ${f2(g("I"), 5)} ; la fonction varie de ${f2(g("ymin"), 3)} à ${f2(g("ymax"), 3)}.` },

]);
})(typeof window !== "undefined" ? window : globalThis);
