/* ════════════════════════════════════════════════════════════════════
   HandBag — Charpente métallique : assemblages de profils creux (classeurs Biblio 2004)
   NF EN 1993-1-8 §7 : membrure circulaire (tableaux 7.2 et 7.3), membrure rectangulaire (tableaux 7.10 à 7.12).
   Unités : mm, MPa, kN.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
/* sections saisies « d t » ou « h b t » → champs nommés */
const dims = (I, map) => { const o = {}; for (const k in map) { const v = I[k] || []; if (v.length < map[k].length) throw new Error("section incomplète : " + map[k].join(" × ")); map[k].forEach((n, i) => o[n] = v[i]); } return o; };
const { K, svg, T, P, Rc, Ci, arrow, dim } = HB.FIG;
const f2 = (v, d = 2) => fmt(v, d), rad = d => d * PI / 180, sn = d => Math.sin(rad(d));

/* tubes ronds courants du classeur « TREILLIK » : diamètre (mm) : épaisseurs (mm) */
const TUBES = "168.27:3.0,3.5,4.0,4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27;177.8:3.0,3.5,4.0,4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27;193.7:3.0,3.5,4.0,4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27;219.1:3.0,3.5,4.0,4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27;244.5:3.0,3.5,4.0,4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27;273.0:3.0,3.5,4.0,4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27;323.8:3.0,3.5,4.0,4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27;339.7:3.5,4.0,4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88;355.6:3.5,4.0,4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88;406.4:4.0,4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22;457.2:4.0,4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22;508.0:4.5,5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;558.8:5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;609.6:5.16,5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;660.4:5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;711.2:5.5,6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;762.0:6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;812.8:6.35,7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;863.6:7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;914.4:7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;965.2:7.14,7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1016.0:7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1066.8:7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1117.6:7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1168.4:7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1219.2:7.92,8.74,9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1270.0:9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1320.8:9.52,10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1371.6:10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1422.4:10.31,11.13,11.91,12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1524.0:12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1727.2:12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;1828.8:12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4;2032.0:12.7,14.27,15.88,17.48,19.05,20.62,22.22,23.83,25.4".split(";").flatMap(g => { const [d, ts] = g.split(":"); return ts.split(",").map(t => [+d, +t]); });
const tubeProps = (d, t) => { const A = PI / 4 * (d * d - (d - 2 * t) ** 2), I = PI / 64 * (d ** 4 - (d - 2 * t) ** 4); return { d, t, A, I, W: 2 * I / d, i: sqrt(I / A), m: A * 7.85e-3 }; };
/* résistance d'une barre tubulaire : flambement courbe a (profil fini à chaud) en compression, A fy en traction */
const barRes = (p, Lf, fy, N, gM1) => { const lam = Lf / p.i / (93.9 * sqrt(235 / fy)), ph = 0.5 * (1 + 0.21 * (lam - 0.2) + lam * lam), chi = min(1, 1 / (ph + sqrt(ph * ph - lam * lam))); return N >= 0 ? { lam, chi, R: chi * p.A * fy / gM1 / 1000 } : { lam, chi: 1, R: p.A * fy / 1000 }; };

/* croquis d'un nœud : membrure horizontale, barres en parallélogrammes (vue en élévation) */
function nodeFig(o) {
  const W = 330, Hh = 200, yT = 120, h0 = o.h0, span = o.span, k = min(250 / span, 46 / h0), xc = W / 2 + (o.shift || 0) * k;
  let s = Rc(10, yT, W - 20, h0 * k, { f: K.steel, c: "#5a6f8e" }) + P(`M10 ${yT + h0 * k / 2}H${W - 10}`, { c: K.mute, w: .7, dash: "6 3" });
  const brace = (foot, d, th, dir, lab, col, down) => { const hw = d / (2 * sn(th)) * k, Lb = 95, dx = Math.cos(rad(th)) * dir * Lb, dy = (down ? 1 : -1) * Math.sin(rad(th)) * Lb, y0 = down ? yT + h0 * k : yT, xf = xc + foot * k;
    s += P(`M${xf - hw} ${y0}L${xf + hw} ${y0}L${xf + hw + dx} ${y0 + dy}L${xf - hw + dx} ${y0 + dy}Z`, { c: "#5a6f8e", f: col, w: 1 }) + P(`M${xf} ${y0}L${xf + dx * 1.04} ${y0 + dy * 1.04}`, { c: K.mute, w: .6, dash: "4 3" });
    s += T(xf + dx * 1.02 + (dir < 0 ? -4 : dir > 0 ? 4 : 6), y0 + dy * 1.02 + (down ? 10 : 0), lab, { a: dir < 0 ? "end" : "start", s: 9.5, c: K.red, w: 600 }); };
  o.braces.forEach(b => brace(b.foot, b.d, b.th, b.dir, b.l, b.c || K.steelL || "#cfd8e6", b.down));
  if (o.gap != null && o.gap > 0) s += dim(xc + o.g1 * k, xc + o.g2 * k, yT - 6, `g = ${f2(o.gap, 0)}`);
  s += T(16, yT + h0 * k + 13, o.chord, { s: 9, c: K.mute });
  return svg(W, Hh, s);
}

/* ── membrure circulaire ─────────────────────────────────────────── */
const CHS_T = [["T", "T ou Y (une barre)"], ["X", "X (barres opposées)"], ["K", "K ou N (deux barres, écartement ou recouvrement)"], ["KT", "KT (deux diagonales et un montant)"]];

HB.add("Charpente métallique", [

{ id: "ec3-noeud-chs", t: "Nœud de poutre triangulée en tubes ronds (membrure circulaire)", ref: "NF EN 1993-1-8 §7.4, tableaux 7.1, 7.2 et 7.3 — Biblio 2004 « Assnoeu1 » (annexe K de l'ENV 1993-1-1)",
  desc: "Résistance des nœuds soudés en T, Y, X, K, N et KT entre profils creux circulaires : plastification de la membrure et cisaillement par poinçonnement.",
  inputs: [SEL("ty", "Type de nœud", CHS_T, "K", ""), H("Membrure (tube 0)"), LST("s0", "Diamètre × épaisseur", "mm", "244.5 7.1", L`d_0 \times t_0`), N("fy0", "Limite d'élasticité", "MPa", 355, L`f_{y0}`),
    LST("N0", "Compression de part et d'autre", "kN", "338 877", L`N_{0,1}\ N_{0,2}`),
    H("Barres (tubes 1, 2, 3)"), LST("s1", "Barre 1 : diamètre × épaisseur", "mm", "139.7 4.5", L`d_1 \times t_1`), N("th1", "Barre 1 : angle", "°", 38.7, L`\theta_1`), N("N1", "Barre 1 : effort", "kN", 432, L`N_{1,Ed}`),
    LST("s2", "Barre 2 : diamètre × épaisseur", "mm", "88.9 3.6", L`d_2 \times t_2`), N("th2", "Barre 2 : angle", "°", 38.7, L`\theta_2`), N("N2", "Barre 2 : effort", "kN", 259, L`N_{2,Ed}`),
    N("d3", "Montant 3 (KT) : diamètre", "mm", 88.9, L`d_3`), N("N3", "Montant 3 : effort", "kN", 100, L`N_{3,Ed}`),
    N("e", "Excentricité e (K), écart g (KT)", "mm", 0, ""), N("gM", "Coefficient partiel", "", 1, L`\gamma_{M5}`)],
  calc(I) {
    I = Object.assign({}, I, dims(I, { s0: ["d0", "t0"], s1: ["d1", "t1"], s2: ["d2", "t2"], N0: ["N01", "N02"] }));
    const { d0, t0, fy0, gM } = I, ty = I.ty, A0 = PI * (d0 * d0 - (d0 - 2 * t0) ** 2) / 4, N0p = abs(I.N01) > abs(I.N02) ? I.N02 : I.N01;
    const np = N0p * 1000 / A0 / fy0 / gM, kp = np > 0 ? min(1, 1 - 0.3 * np * (1 + np)) : 1, gam = d0 / (2 * t0), b1 = I.d1 / d0, base = fy0 * t0 * t0 / 1000 / gM;
    const steps = [S("A0", L`A_0`, L`\dfrac{\pi}{4}\left[d_0^2 - (d_0 - 2t_0)^2\right]`, A0, "mm²", 0), S("np", L`n_p`, L`\dfrac{N_{0p}/A_0}{f_{y0}/\gamma_{M5}}` + `\\quad N_{0p} = ${fmt(N0p, 0)}\\ \\text{kN}`, np, "", 4),
      S("kp", L`k_p`, L`1 - 0{,}3\,n_p\,(1 + n_p) \le 1`, kp, "", 4), S("gam", L`\gamma`, L`\dfrac{d_0}{2\,t_0}`, gam, "", 3), S("beta", L`\beta`, ty === "KT" ? L`\dfrac{d_1 + d_2 + d_3}{3\,d_0}` : L`\dfrac{d_1}{d_0}`, ty === "KT" ? (I.d1 + I.d2 + I.d3) / (3 * d0) : b1, "", 4)];
    const checks = [], punch = (d, th) => d <= d0 - 2 * t0 ? fy0 * t0 * PI * d / sqrt(3) * (1 + sn(th)) / (2 * sn(th) ** 2) / 1000 / gM : Infinity;
    let N1Rd, N2Rd = null, g = null, lov = null, kg = null, braces, gap1, gap2, span;
    if (ty === "T" || ty === "X") {
      const Npl = ty === "T" ? pow(gam, 0.2) * kp * base / sn(I.th1) * (2.8 + 14.2 * b1 * b1) : kp * base / sn(I.th1) * 5.2 / (1 - 0.81 * b1), Np = punch(I.d1, I.th1);
      steps.push(R("N1pl", L`N_{1,Rd}^{\,pl}`, ty === "T" ? L`\gamma^{0{,}2}\,k_p\,\dfrac{f_{y0}\,t_0^2}{\sin\theta_1}\,(2{,}8 + 14{,}2\,\beta^2)/\gamma_{M5}` : L`k_p\,\dfrac{f_{y0}\,t_0^2}{\sin\theta_1}\,\dfrac{5{,}2}{1 - 0{,}81\,\beta}/\gamma_{M5}`, Npl, "kN", 1));
      steps.push(S("N1p", L`N_{1,Rd}^{\,p}`, isFinite(Np) ? L`\dfrac{f_{y0}}{\sqrt 3}\,t_0\,\pi\,d_1\,\dfrac{1 + \sin\theta_1}{2\sin^2\theta_1}/\gamma_{M5}` : "~sans objet (d₁ > d₀ − 2t₀)", isFinite(Np) ? Np : 0, "kN", 1));
      N1Rd = min(Npl, Np); steps.push(R("N1Rd", L`N_{1,Rd}`, "~valeur la plus faible", N1Rd, "kN", 1));
      checks.push(C("$N_{1,Ed} \\le N_{1,Rd}$", abs(I.N1) <= N1Rd, `${f2(abs(I.N1), 0)} ≤ ${f2(N1Rd, 0)} kN`, abs(I.N1) / N1Rd));
      braces = [{ foot: 0, d: I.d1, th: I.th1, dir: -1, l: "1" }].concat(ty === "X" ? [{ foot: 0, d: I.d1, th: I.th1, dir: 1, l: "1′", down: true }] : []); span = I.d1 / sn(I.th1) * 3;
    } else {
      const th3 = 90, tg = rad;
      if (ty === "K") { g = (d0 / 2 + I.e) * (1 / Math.tan(tg(I.th1)) + 1 / Math.tan(tg(I.th2))) - I.d1 / (2 * sn(I.th1)) - I.d2 / (2 * sn(I.th2)); if (g < 0) lov = -g * sn(I.th1) / I.d1 * 100; }
      else g = I.e > 0 ? I.e : I.d3;
      kg = pow(gam, 0.2) * (1 + 0.024 * pow(gam, 1.2) / (1 + exp(0.5 * g / t0 - 1.33)));
      const bb = ty === "KT" ? (I.d1 + I.d2 + I.d3) / (3 * d0) : b1, Npl = kg * kp * base / sn(I.th1) * (1.8 + 10.2 * bb);
      steps.push(S("g", "g", ty === "K" ? L`\left(\dfrac{d_0}{2} + e\right)\left(\cot\theta_1 + \cot\theta_2\right) - \dfrac{d_1}{2\sin\theta_1} - \dfrac{d_2}{2\sin\theta_2}` : "~écartement retenu", g, "mm", 2));
      if (lov != null) steps.push(S("lov", L`\lambda_{ov}`, L`\dfrac{-g\,\sin\theta_1}{d_1}`, lov, "%", 1));
      steps.push(S("kg", L`k_g`, L`\gamma^{0{,}2}\left(1 + \dfrac{0{,}024\,\gamma^{1{,}2}}{1 + e^{\,0{,}5\,g/t_0 - 1{,}33}}\right)`, kg, "", 4),
        R("N1pl", L`N_{1,Rd}^{\,pl}`, ty === "KT" ? L`k_g\,k_p\,\dfrac{f_{y0}\,t_0^2}{\sin\theta_1}\,(1{,}8 + 10{,}2\,\beta)/\gamma_{M5}` : L`k_g\,k_p\,\dfrac{f_{y0}\,t_0^2}{\sin\theta_1}\left(1{,}8 + 10{,}2\,\dfrac{d_1}{d_0}\right)/\gamma_{M5}`, Npl, "kN", 1));
      const Np1 = g >= 0 ? punch(I.d1, I.th1) : Infinity, Np2 = g >= 0 ? punch(I.d2, I.th2) : Infinity;
      N1Rd = min(Npl, Np1); N2Rd = min(Npl * sn(I.th1) / sn(I.th2), Np2);
      steps.push(S("N1p", L`N_{1,Rd}^{\,p}`, isFinite(Np1) ? L`\dfrac{f_{y0}}{\sqrt 3}\,t_0\,\pi\,d_1\,\dfrac{1 + \sin\theta_1}{2\sin^2\theta_1}/\gamma_{M5}` : "~sans objet", isFinite(Np1) ? Np1 : 0, "kN", 1),
        R("N1Rd", L`N_{1,Rd}`, "~valeur la plus faible", N1Rd, "kN", 1), R("N2Rd", L`N_{2,Rd}`, L`\min\left(N_{1,Rd}^{\,pl}\,\dfrac{\sin\theta_1}{\sin\theta_2}\ ;\ N_{2,Rd}^{\,p}\right)`, N2Rd, "kN", 1));
      if (ty === "KT") {
        const Np3 = punch(I.d3, th3), a = abs(I.N1) * sn(I.th1) + abs(I.N3) * sn(th3), lim = Npl * sn(I.th1);
        steps.push(S("N3p", L`N_{3,Rd}^{\,p}`, "~poinçonnement du montant", isFinite(Np3) ? Np3 : 0, "kN", 1));
        checks.push(C("$N_{1,Ed}\\sin\\theta_1 + N_{3,Ed}\\sin\\theta_3 \\le N_{1,Rd}\\sin\\theta_1$", a <= lim, `${f2(a, 0)} ≤ ${f2(lim, 0)} kN`, a / lim),
          C("$N_{2,Ed}\\sin\\theta_2 \\le N_{1,Rd}\\sin\\theta_1$", abs(I.N2) * sn(I.th2) <= lim, `${f2(abs(I.N2) * sn(I.th2), 0)} ≤ ${f2(lim, 0)} kN`, abs(I.N2) * sn(I.th2) / lim),
          C("$N_{3,Ed} \\le N_{3,Rd}^{\\,p}$", abs(I.N3) <= Np3, isFinite(Np3) ? `${f2(abs(I.N3), 0)} ≤ ${f2(Np3, 0)} kN` : "sans objet", abs(I.N3) / Np3));
      } else checks.push(C("$N_{1,Ed} \\le N_{1,Rd}$", abs(I.N1) <= N1Rd, `${f2(abs(I.N1), 0)} ≤ ${f2(N1Rd, 0)} kN`, abs(I.N1) / N1Rd), C("$N_{2,Ed} \\le N_{2,Rd}$", abs(I.N2) <= N2Rd, `${f2(abs(I.N2), 0)} ≤ ${f2(N2Rd, 0)} kN`, abs(I.N2) / N2Rd));
      checks.push(g >= 0 ? C("Écartement : $g \\ge t_1 + t_2$", g >= I.t1 + I.t2, `${f2(g, 1)} ≥ ${f2(I.t1 + I.t2, 1)} mm`) : C("Recouvrement : $25\\,\\% \\le \\lambda_{ov}$", lov >= 25, `${f2(lov, 1)} %`));
      const h1 = I.d1 / (2 * sn(I.th1)), h2 = I.d2 / (2 * sn(I.th2)), h3 = I.d3 / 2;
      if (ty === "K") { braces = [{ foot: -g / 2 - h1, d: I.d1, th: I.th1, dir: -1, l: "1" }, { foot: g / 2 + h2, d: I.d2, th: I.th2, dir: 1, l: "2" }]; gap1 = -g / 2; gap2 = g / 2; }
      else { braces = [{ foot: -h3 - g / 2 - h1 - g / 2, d: I.d1, th: I.th1, dir: -1, l: "1" }, { foot: 0, d: I.d3, th: 90, dir: 0, l: "3" }, { foot: h3 + g / 2 + h2 + g / 2, d: I.d2, th: I.th2, dir: 1, l: "2" }]; gap1 = h3; gap2 = h3 + g; }
      span = abs(braces.at(-1).foot - braces[0].foot) + 3 * max(h1, h2);
    }
    const dn = [I.d1].concat(ty === "K" || ty === "KT" ? [I.d2] : [], ty === "KT" ? [I.d3] : []);
    const tt = [I.d1 / I.t1].concat(ty === "K" || ty === "KT" ? [I.d2 / I.t2] : []), dom = [[dn.every(d => d / d0 >= 0.2 && d / d0 <= 1), "dᵢ/d₀ = " + dn.map(d => f2(d / d0, 2)).join(" ; ")], [tt.every(v => v >= 10 && v <= 50), "dᵢ/tᵢ = " + tt.map(v => f2(v, 1)).join(" ; ")],
      [d0 / t0 >= 10 && d0 / t0 <= (ty === "X" ? 40 : 50), `d₀/t₀ = ${f2(d0 / t0, 1)}`], [[I.th1].concat(ty === "K" || ty === "KT" ? [I.th2] : []).every(t => t >= 30), "θ ≥ 30°"]];
    checks.push(C("Domaine de validité (tableau 7.1)", dom.every(d => d[0]), dom.filter(d => !d[0]).map(d => d[1]).join(" ; ") || "respecté"));
    return { steps, checks, vals: { braces, gap: g != null && g > 0 ? g : null, gap1, gap2, span, N1Rd, N2Rd, d0, t0 },
      notes: ["Compression de membrure positive ; $N_{0p}$ = effort de membrure le plus faible des deux côtés. Efforts des barres en valeur absolue.",
        "Par rapport au classeur (ENV, annexe K) : KT avec $\\beta = (d_1 + d_2 + d_3)/3d_0$ (tableau 7.3) et poinçonnement ajouté ; T, X et K identiques."] };
  },
  fig(I, g, r) { const v = r.vals; return nodeFig({ h0: v.d0, span: max(v.span, v.d0 * 2.4), braces: v.braces, gap: v.gap, g1: v.gap1, g2: v.gap2, chord: `membrure Ø${f2(v.d0, 1)} × ${f2(v.t0, 1)}` }); },
  clair: (I, g, r) => `La barre 1 du nœud ${I.ty} résiste à ${f2(r.vals.N1Rd, 0)} kN${r.vals.N2Rd != null ? `, la barre 2 à ${f2(r.vals.N2Rd, 0)} kN` : ""} ; la membrure travaille avec kp = ${f2(g("kp"), 3)}.` },


{ id: "ec3-noeud-rhs", t: "Nœud de poutre triangulée sur membrure rectangulaire", ref: "NF EN 1993-1-8 §7.5, tableaux 7.8, 7.10, 7.11 et 7.12 — Biblio 2004 « Assnoeu2 » (annexe K de l'ENV 1993-1-1)",
  desc: "Résistance des nœuds soudés en T, Y, X et K/N (écartement ou recouvrement) entre une membrure en profil creux rectangulaire et des barres rectangulaires ou rondes.",
  inputs: [SEL("ty", "Type de nœud", [["T", "T ou Y (une barre)"], ["X", "X (barres opposées)"], ["K", "K ou N (deux barres)"]], "K", ""),
    H("Membrure (tube 0)"), LST("s0", "Hauteur (dans le plan) × largeur × épaisseur", "mm", "200 180 7.1", L`h_0 \times b_0 \times t_0`), N("fy0", "Limite d'élasticité", "MPa", 355, L`f_{y0}`),
    LST("N0", "Compression de part et d'autre", "kN", "338 877", L`N_{0,1}\ N_{0,2}`), N("V0", "Tranchant dans l'écartement", "kN", 0, L`V_{0,Ed}`),
    H("Barres — rectangulaire : h b t ; ronde : d t"), LST("s1", "Barre 1 : section", "mm", "200 160 8", L`h_1\,b_1\,t_1`), N("th1", "Barre 1 : angle", "°", 38.7, L`\theta_1`), N("N1", "Barre 1 : effort", "kN", 259, L`N_{1,Ed}`),
    LST("s2", "Barre 2 (K) : section", "mm", "120 8", L`h_2\,b_2\,t_2`), N("th2", "Barre 2 : angle", "°", 38.7, L`\theta_2`), N("N2", "Barre 2 : effort", "kN", 259, L`N_{2,Ed}`),
    N("fyb", "Limite élastique des barres", "MPa", 275, L`f_{yi}`), N("e", "Excentricité", "mm", -60, "e"), N("gM", "Coefficient partiel", "", 1, L`\gamma_{M5}`)],
  calc(I) {
    const sec = v => (v || []).length >= 3 ? { f: "r", h: v[0], b: v[1], t: v[2] } : { f: "c", h: (v || [])[0], b: (v || [])[0], t: (v || [])[1] }, q1 = sec(I.s1), q2 = sec(I.s2); if (!(I.s0 || []).length || !q1.t) throw new Error("sections à saisir");
    I = Object.assign({}, I, dims(I, { N0: ["N01", "N02"] }), { h0: I.s0[0], b0: I.s0[1], t0: I.s0[2], f1: q1.f, h1: q1.h, b1: q1.b, t1: q1.t, f2: q2.f, h2: q2.h, b2: q2.b, t2: q2.t });
    const { h0, b0, t0, fy0, gM, ty } = I, fyi = I.fyb, Es = 210000, A0 = 2 * t0 * (b0 + h0 - 2 * t0) - (4 - PI) * ((1.5 * t0) ** 2 - t0 * t0);
    const br = [1, 2].map(i => { const c = I["f" + i] === "c", h = I["h" + i], b = c ? h : I["b" + i], t = I["t" + i]; return { c, h, b, t, th: I["th" + i], N: abs(I["N" + i]), A: c ? PI * (h * h - (h - 2 * t) ** 2) / 4 : 2 * t * (b + h - 2 * t), k: c ? PI / 4 : 1 }; });
    const nb = ty === "K" ? 2 : 1, B = br.slice(0, nb), gam = b0 / (2 * t0), N0 = max(abs(I.N01), abs(I.N02)), n = max(I.N01, I.N02) * 1000 / A0 / fy0 * gM;
    const beta = ty === "K" ? (B[0].b + B[1].b + B[0].h + B[1].h) / (4 * b0) : B[0].b / b0, kn = n > 0 ? min(1, 1.3 - 0.4 * n / beta) : 1;
    const steps = [S("A0", L`A_0`, "~coins r_o = 1,5 t₀, r_i = t₀", A0, "mm²", 0), S("n", "n", L`\dfrac{\sigma_{0,Ed}}{f_{y0}/\gamma_{M5}}` + `\\quad N_0 = ${fmt(N0, 0)}\\ \\text{kN}`, n, "", 4),
      S("beta", L`\beta`, ty === "K" ? L`\dfrac{b_1 + b_2 + h_1 + h_2}{4\,b_0}` : L`\dfrac{b_1}{b_0}`, beta, "", 4), S("gam", L`\gamma`, L`\dfrac{b_0}{2\,t_0}`, gam, "", 3), S("kn", L`k_n`, L`1{,}3 - \dfrac{0{,}4\,n}{\beta} \le 1`, kn, "", 4)];
    const checks = [], beff = b => min(b.b, 10 / (b0 / t0) * fy0 * t0 / (fyi * b.t) * b.b), bep = b => min(b.b, 10 / (b0 / t0) * b.b);
    let N1Rd, N2Rd = null, g = null, lov = null, modes = [];
    if (ty !== "K") {
      const b = B[0], s1 = sn(b.th), eta = b.h / b0, face = bt => kn * fy0 * t0 * t0 / ((1 - bt) * s1) * (2 * eta / s1 + 4 * sqrt(1 - bt)) / gM / 1000 * b.k;
      const lam = 3.46 * (h0 / t0 - 2) * sqrt(1 / s1) / (PI * sqrt(Es / fy0)), ph = 0.5 * (1 + 0.21 * (lam - 0.2) + lam * lam), chi = min(1, 1 / (ph + sqrt(ph * ph - lam * lam)));
      const fb = I.N1 < 0 ? fy0 : ty === "X" ? 0.8 * chi * fy0 * s1 : chi * fy0, side = kn * fb * t0 / s1 * (2 * b.h / s1 + 10 * t0) / gM / 1000 * b.k;
      if (beta <= 0.85) { const v = face(beta); modes.push(["plastification de la face de membrure", v]); steps.push(R("Nf", L`N_{1,Rd}^{\,face}`, L`\dfrac{k_n\,f_{y0}\,t_0^2}{(1 - \beta)\sin\theta_1}\left(\dfrac{2\eta}{\sin\theta_1} + 4\sqrt{1 - \beta}\right)` + (b.c ? L`\,\dfrac{\pi}{4}` : ""), v, "kN", 1)); }
      else { const v = beta >= 1 ? side : face(0.85) + (side - face(0.85)) * (beta - 0.85) / 0.15; modes.push(["voilement des parois latérales", v]);
        steps.push(S("lam", L`\bar\lambda`, L`\dfrac{3{,}46\,(h_0/t_0 - 2)\sqrt{1/\sin\theta_1}}{\pi\sqrt{E/f_{y0}}}`, lam, "", 3), S("chi", L`\chi`, "~courbe a", chi, "", 3), R("Ns", L`N_{1,Rd}^{\,paroi}`, beta >= 1 ? L`\dfrac{k_n\,f_b\,t_0}{\sin\theta_1}\left(\dfrac{2h_1}{\sin\theta_1} + 10\,t_0\right)` : "~interpolation linéaire entre β = 0,85 et 1", v, "kN", 1));
        const vb = fyi * b.t * (2 * b.h - 4 * b.t + 2 * beff(b)) / gM / 1000 * b.k; modes.push(["ruine de la barre", vb]); steps.push(S("Nb", L`N_{1,Rd}^{\,barre}`, L`f_{yi}\,t_1\,(2h_1 - 4t_1 + 2\,b_{eff})`, vb, "kN", 1));
        if (beta <= 1 - 1 / gam) { const vp = fy0 * t0 / (sqrt(3) * s1) * (2 * b.h / s1 + 2 * bep(b)) / gM / 1000 * b.k; modes.push(["poinçonnement", vp]); steps.push(S("Np", L`N_{1,Rd}^{\,p}`, L`\dfrac{f_{y0}\,t_0}{\sqrt 3\,\sin\theta_1}\left(\dfrac{2h_1}{\sin\theta_1} + 2\,b_{e,p}\right)`, vp, "kN", 1)); } }
      N1Rd = min(...modes.map(m => m[1])); steps.push(R("N1Rd", L`N_{1,Rd}`, `~${modes.find(m => m[1] === N1Rd)[0]}`, N1Rd, "kN", 1));
      checks.push(C("$N_{1,Ed} \\le N_{1,Rd}$", b.N <= N1Rd, `${f2(b.N, 0)} ≤ ${f2(N1Rd, 0)} kN`, b.N / N1Rd), C("Domaine : $b_1/b_0 \\ge 0{,}25$", beta >= 0.25, f2(beta, 3)));
    } else {
      const [p, q] = B, s1 = sn(p.th), s2 = sn(q.th);
      g = (h0 / 2 + I.e) * (1 / Math.tan(rad(p.th)) + 1 / Math.tan(rad(q.th))) - p.h / (2 * s1) - q.h / (2 * s2);
      steps.push(S("g", "g", L`\left(\dfrac{h_0}{2} + e\right)(\cot\theta_1 + \cot\theta_2) - \dfrac{h_1}{2\sin\theta_1} - \dfrac{h_2}{2\sin\theta_2}`, g, "mm", 2));
      if (g >= 0) {
        const face = 8.9 * kn * fy0 * t0 * t0 * sqrt(gam) * (p.b + q.b + p.h + q.h) / (4 * b0) / gM / 1000, al = p.c && q.c ? 0 : sqrt(1 / (1 + 4 * g * g / (3 * t0 * t0))), Av = (2 * h0 + al * b0) * t0, Vpl = fy0 * Av / sqrt(3) / gM / 1000;
        const shear = sn => fy0 * Av / (sqrt(3) * sn) / gM / 1000, brf = b => fyi * b.t * (2 * b.h - 4 * b.t + b.b + beff(b)) / gM / 1000 * b.k, pun = (b, sn) => fy0 * t0 / (sqrt(3) * sn) * (2 * b.h / sn + b.b + bep(b)) / gM / 1000 * b.k;
        const ok = beta <= 1 - 1 / gam, R1 = [face / s1 * (p.c && q.c ? PI / 4 : 1), shear(s1), brf(p)].concat(ok ? [pun(p, s1)] : []), R2 = [face / s2 * (p.c && q.c ? PI / 4 : 1), shear(s2), brf(q)].concat(ok ? [pun(q, s2)] : []);
        const N0Rd = ((A0 - Av) * fy0 + Av * fy0 * sqrt(max(0, 1 - (I.V0 / Vpl) ** 2))) / gM / 1000; N1Rd = min(...R1); N2Rd = min(...R2);
        steps.push(S("Nf", L`N_{1,Rd}^{\,face}`, L`\dfrac{8{,}9\,k_n\,f_{y0}\,t_0^2\sqrt\gamma}{\sin\theta_1}\,\dfrac{b_1 + b_2 + h_1 + h_2}{4\,b_0}`, R1[0], "kN", 1), S("Av", L`A_v`, L`(2h_0 + \alpha\,b_0)\,t_0`, Av, "mm²", 0),
          S("Nv", L`N_{1,Rd}^{\,cis}`, L`\dfrac{f_{y0}\,A_v}{\sqrt 3\,\sin\theta_1}`, R1[1], "kN", 1), S("Nb", L`N_{1,Rd}^{\,barre}`, L`f_{yi}\,t_1\,(2h_1 - 4t_1 + b_1 + b_{eff})`, R1[2], "kN", 1));
        if (ok) steps.push(S("Np", L`N_{1,Rd}^{\,p}`, L`\dfrac{f_{y0}\,t_0}{\sqrt 3\,\sin\theta_1}\left(\dfrac{2h_1}{\sin\theta_1} + b_1 + b_{e,p}\right)`, R1[3], "kN", 1));
        steps.push(R("N1Rd", L`N_{1,Rd}`, "~valeur la plus faible", N1Rd, "kN", 1), R("N2Rd", L`N_{2,Rd}`, "~mêmes modes pour la barre 2", N2Rd, "kN", 1), S("N0Rd", L`N_{0,gap,Rd}`, L`(A_0 - A_v)f_{y0} + A_v f_{y0}\sqrt{1 - (V_{0,Ed}/V_{pl,Rd})^2}`, N0Rd, "kN", 0));
        checks.push(C("Membrure dans l'écartement : $N_{0,Ed} \\le N_{0,gap,Rd}$", N0 <= N0Rd, `${f2(N0, 0)} ≤ ${f2(N0Rd, 0)} kN`, N0 / N0Rd), C("Écartement : $g \\ge t_1 + t_2$", g >= p.t + q.t, `${f2(g, 1)} mm`),
          C("Écartement : $0{,}5(1 - \\beta) \\le g/b_0 \\le 1{,}5(1 - \\beta)$", g / b0 >= 0.5 * (1 - beta) && g / b0 <= 1.5 * (1 - beta), f2(g / b0, 3)), C("Barres : $b_i/b_0 \\ge \\max(0{,}35 ; 0{,}1 + 0{,}01\\,b_0/t_0)$", B.every(b => b.b / b0 >= max(0.35, 0.1 + 0.01 * b0 / t0)), B.map(b => f2(b.b / b0, 3)).join(" ; ")));
      } else {
        lov = -g * s1 / p.h * 100; const bov = min(p.b, 10 / (q.b / q.t) * q.t / p.t * p.b), be1 = beff(p);
        N1Rd = fyi * p.t * (lov < 50 ? be1 + bov + 2 * p.h * lov / 50 - 4 * p.t : lov < 80 ? be1 + bov + 2 * p.h - 4 * p.t : p.b + bov + 2 * p.h - 4 * p.t) / gM / 1000 * p.k; N2Rd = N1Rd * q.A / p.A;
        steps.push(S("lov", L`\lambda_{ov}`, L`\dfrac{-g\,\sin\theta_1}{h_1}`, lov, "%", 1), S("beff", L`b_{eff}`, L`\dfrac{10}{b_0/t_0}\,\dfrac{f_{y0}\,t_0}{f_{yi}\,t_1}\,b_1 \le b_1`, be1, "mm", 1), S("bov", L`b_{e,ov}`, L`\dfrac{10}{b_2/t_2}\,\dfrac{t_2}{t_1}\,b_1 \le b_1`, bov, "mm", 1),
          R("N1Rd", L`N_{1,Rd}`, lov < 50 ? L`f_{yi}\,t_1\left(b_{eff} + b_{e,ov} + 2h_1\,\dfrac{\lambda_{ov}}{50} - 4t_1\right)` : lov < 80 ? L`f_{yi}\,t_1\,(b_{eff} + b_{e,ov} + 2h_1 - 4t_1)` : L`f_{yi}\,t_1\,(b_1 + b_{e,ov} + 2h_1 - 4t_1)`, N1Rd, "kN", 1), R("N2Rd", L`N_{2,Rd}`, L`N_{1,Rd}\,\dfrac{A_2\,f_{y2}}{A_1\,f_{y1}}`, N2Rd, "kN", 1));
        checks.push(C("Recouvrement : $25\\,\\% \\le \\lambda_{ov} \\le 100\\,\\%$ et $b_1/b_2 \\ge 0{,}75$", lov >= 25 && lov <= 100 && p.b / q.b >= 0.75, `${f2(lov, 1)} % ; ${f2(p.b / q.b, 2)}`));
      }
      checks.unshift(C("$N_{1,Ed} \\le N_{1,Rd}$", p.N <= N1Rd, `${f2(p.N, 0)} ≤ ${f2(N1Rd, 0)} kN`, p.N / N1Rd), C("$N_{2,Ed} \\le N_{2,Rd}$", q.N <= N2Rd, `${f2(q.N, 0)} ≤ ${f2(N2Rd, 0)} kN`, q.N / N2Rd));
    }
    const dom = [[max(b0, h0) / t0 <= (lov != null ? 40 : 35), `h₀/t₀, b₀/t₀ = ${f2(max(b0, h0) / t0, 1)}`], [h0 / b0 >= 0.5 && h0 / b0 <= 2, `h₀/b₀ = ${f2(h0 / b0, 2)}`], [B.every(b => b.th >= 30), "θ ≥ 30°"]];
    checks.push(C("Domaine de validité (tableau 7.8)", dom.every(d => d[0]), dom.filter(d => !d[0]).map(d => d[1]).join(" ; ") || "respecté"));
    const hh = B.map(b => b.h / (2 * sn(b.th)));
    const braces = ty === "K" ? [{ foot: -g / 2 - hh[0], d: B[0].h, th: B[0].th, dir: -1, l: "1" }, { foot: g / 2 + hh[1], d: B[1].h, th: B[1].th, dir: 1, l: "2" }] : [{ foot: 0, d: B[0].h, th: B[0].th, dir: -1, l: "1" }].concat(ty === "X" ? [{ foot: 0, d: B[0].h, th: B[0].th, dir: 1, l: "1′", down: true }] : []);
    return { steps, checks, vals: { braces, g, N1Rd, N2Rd, h0, b0, t0, span: ty === "K" ? abs(braces[1].foot - braces[0].foot) + 3 * max(...hh) : hh[0] * 6 },
      notes: ["e > 0 : intersection des axes au-delà de l'axe de la membrure (côté opposé aux barres). Barre ronde : $b_i = h_i = d_i$ et résistances × π/4 (sauf cisaillement) ; voilement des parois en courbe a. Le classeur d'origine prenait $\\eta = h_1/h_0$ et omettait π/4 : la norme est appliquée ici."] };
  },
  fig(I, g, r) { const v = r.vals; return nodeFig({ h0: v.h0, span: max(v.span, v.h0 * 2.4), braces: v.braces, gap: v.g > 0 ? v.g : null, g1: -v.g / 2, g2: v.g / 2, chord: `membrure ${f2(v.h0, 0)} × ${f2(v.b0, 0)} × ${f2(v.t0, 1)}` }); },
  clair: (I, g, r) => `La barre 1 résiste à ${f2(r.vals.N1Rd, 0)} kN${r.vals.N2Rd != null ? `, la barre 2 à ${f2(r.vals.N2Rd, 0)} kN` : ""}${r.vals.g != null ? (r.vals.g < 0 ? ` (recouvrement de ${f2(g("lov"), 0)} %)` : ` (écartement de ${f2(r.vals.g, 0)} mm)`) : ""}.` },


{ id: "ec3-treillis-tubes", t: "Treillis tubulaire : choix des tubes et vérification du nœud en K", ref: "NF EN 1993-1-1 §6.3.1 et annexe BB.1.3 ; NF EN 1993-1-8 tableau 7.2 — Biblio 2004 « TREILLIK » (guide CIDECT)",
  desc: "Tubes ronds les plus légers d'un catalogue courant pour la membrure et les diagonales (flambement ou traction), puis résistance du nœud en K formé par les tubes retenus.",
  inputs: [H("Membrure"), N("L0", "Longueur entre nœuds", "mm", 6000, L`L_0`), N("fy0", "Limite d'élasticité", "MPa", 355, L`f_{y0}`), N("N0", "Compression maximale", "kN", 1148, L`N_{0,Ed}`),
    LST("N0j", "Efforts au nœud", "kN", "338 877", L`N_{0,1}\ N_{0,2}`), N("M0", "Moment transversal", "kN·m", 0, L`M_0`),
    H("Diagonales (effort + en compression)"), LST("D1", "Diagonale 1 (mm, °, kN)", "", "3841.9 38.7 432", L`L_1\ \theta_1\ N_1`), LST("D2", "Diagonale 2 (mm, °, kN)", "", "3841.9 38.7 -500", L`L_2\ \theta_2\ N_2`), N("fyb", "Limite élastique", "MPa", 275, L`f_{yi}`),
    H("Tubes retenus (d × t, mm)"), LST("T0", "Membrure", "mm", "193.7 9.52", L`d_0\ t_0`), LST("T1", "Diagonale 1", "mm", "168.27 3.5", L`d_1\ t_1`), LST("T2", "Diagonale 2", "mm", "168.27 4", L`d_2\ t_2`),
    N("e", "Excentricité du nœud", "mm", -28.2, "e"), N("gM1", "Coefficient (barres)", "", 1, L`\gamma_{M1}`), N("gM5", "Coefficient (nœud)", "", 1, L`\gamma_{M5}`)],
  calc(I) {
    const J = dims(I, { N0j: ["N01", "N02"], D1: ["L1", "th1", "N1"], D2: ["L2", "th2", "N2"], T0: ["d0", "t0"], T1: ["d1", "t1"], T2: ["d2", "t2"] });
    const els = [["membrure", 0.9 * I.L0, I.fy0, I.N0], ["diagonale 1", 0.75 * J.L1, I.fyb, J.N1], ["diagonale 2", 0.75 * J.L2, I.fyb, J.N2]];
    /* propositions : pour chaque diamètre, la plus faible épaisseur qui convient ; classement par masse */
    const prop = els.map(([, Lf, fy, Nd]) => { const best = {}; TUBES.forEach(([d, t]) => { if (best[d] || d / t > 50 || d / t < 10) return; const p = tubeProps(d, t); if (barRes(p, Lf, fy, Nd, I.gM1).R >= abs(Nd)) best[d] = p; }); return Object.values(best).sort((a, b) => a.m - b.m).slice(0, 3); });
    const P = [[J.d0, J.t0], [J.d1, J.t1], [J.d2, J.t2]].map(([d, t]) => tubeProps(d, t)), res = els.map((e, k) => barRes(P[k], e[1], e[2], e[3], I.gM1));
    const [p0, p1, p2] = P, d0 = p0.d, t0 = p0.t, s1 = sn(J.th1), s2 = sn(J.th2);
    const g = (d0 / 2 + I.e) * (1 / Math.tan(rad(J.th1)) + 1 / Math.tan(rad(J.th2))) - p1.d / (2 * s1) - p2.d / (2 * s2), lov = g < 0 ? -g * s1 / p1.d * 100 : null;
    const both = J.N01 < 0 && J.N02 < 0, N0p = (both ? -1 : 1) * min(abs(J.N01), abs(J.N02)), M = both ? I.M0 : I.M0 + abs(abs(J.N02) - abs(J.N01)) / 2 * abs(I.e) / 1000;
    const sp = N0p * 1000 / p0.A + M * 1e6 / p0.W, np = sp / I.fy0 / I.gM5, kp = np > 0 ? 1 - 0.3 * np * (1 + np) : 1, gam = d0 / (2 * t0);
    const kg = pow(gam, 0.2) * (1 + 0.024 * pow(gam, 1.2) / (1 + exp(0.5 * g / t0 - 1.33))), N1Rd = kg * kp * I.fy0 * t0 * t0 / s1 * (1.8 + 10.2 * p1.d / d0) / I.gM5 / 1000, N2Rd = N1Rd * s1 / s2;
    const tn = p => `${fmt(p.d, 2)} × ${fmt(p.t, 2)}`;
    const steps = [S("R0", L`N_{b,Rd,0}`, L`\chi\,A_0\,f_{y0}/\gamma_{M1}` + `\\quad L_{cr} = 0{,}9\\,L_0,\\ \\bar\\lambda = ${fmt(res[0].lam, 3).replace(",", "{,}")}`, res[0].R, "kN", 1),
      S("R1", L`N_{Rd,1}`, (J.N1 >= 0 ? L`\chi\,A_1\,f_{yi}/\gamma_{M1}` + `\\quad L_{cr} = 0{,}75\\,L_1,\\ \\bar\\lambda = ${fmt(res[1].lam, 3).replace(",", "{,}")}` : L`A_1\,f_{yi}` + "\\quad\\text{(traction)}"), res[1].R, "kN", 1),
      S("R2", L`N_{Rd,2}`, (J.N2 >= 0 ? L`\chi\,A_2\,f_{yi}/\gamma_{M1}` + `\\quad L_{cr} = 0{,}75\\,L_2,\\ \\bar\\lambda = ${fmt(res[2].lam, 3).replace(",", "{,}")}` : L`A_2\,f_{yi}` + "\\quad\\text{(traction)}"), res[2].R, "kN", 1),
      H("Nœud en K"), S("g", "g", L`\left(\dfrac{d_0}{2} + e\right)(\cot\theta_1 + \cot\theta_2) - \dfrac{d_1}{2\sin\theta_1} - \dfrac{d_2}{2\sin\theta_2}`, g, "mm", 2)];
    if (lov != null) steps.push(S("lov", L`\lambda_{ov}`, L`\dfrac{-g\,\sin\theta_1}{d_1}`, lov, "%", 2));
    steps.push(S("np", L`n_p`, L`\left(\dfrac{N_{0p}}{A_0} + \dfrac{M_{0,Ed}}{W_0}\right)\dfrac{\gamma_{M5}}{f_{y0}}` + `\\quad M_{0,Ed} = ${fmt(M, 2).replace(",", "{,}")}\\ \\text{kN}\\cdot\\text{m}`, np, "", 5), S("kp", L`k_p`, L`1 - 0{,}3\,n_p(1 + n_p)`, kp, "", 5),
      S("kg", L`k_g`, L`\gamma^{0{,}2}\left(1 + \dfrac{0{,}024\,\gamma^{1{,}2}}{1 + e^{\,0{,}5\,g/t_0 - 1{,}33}}\right)`, kg, "", 4), R("N1Rd", L`N_{1,Rd}`, L`k_g\,k_p\,\dfrac{f_{y0}\,t_0^2}{\sin\theta_1}\left(1{,}8 + 10{,}2\,\dfrac{d_1}{d_0}\right)/\gamma_{M5}`, N1Rd, "kN", 2), R("N2Rd", L`N_{2,Rd}`, L`N_{1,Rd}\,\sin\theta_1/\sin\theta_2`, N2Rd, "kN", 2));
    const dd = [p1.d / d0, p2.d / d0], checks = els.map((e, k) => C(`${e[0][0].toUpperCase() + e[0].slice(1)} ${tn(P[k])}`, abs(e[3]) <= res[k].R, `${f2(abs(e[3]), 0)} ≤ ${f2(res[k].R, 0)} kN`, abs(e[3]) / res[k].R));
    checks.push(C("Nœud en K", abs(J.N1) <= N1Rd && abs(J.N2) <= N2Rd, `${f2(abs(J.N1), 0)} ≤ ${f2(N1Rd, 0)} ; ${f2(abs(J.N2), 0)} ≤ ${f2(N2Rd, 0)} kN`, max(abs(J.N1) / N1Rd, abs(J.N2) / N2Rd)),
      C(`${lov != null ? "Recouvrement $\\lambda_{ov} \\ge 25\\,\\%$" : "Écartement $g \\ge t_1 + t_2$"}, domaine du tableau 7.1`, (lov != null ? lov >= 25 : g >= p1.t + p2.t) && dd.every(v => v >= 0.2 && v <= 1) && P.every(p => p.d / p.t >= 10 && p.d / p.t <= 50) && J.th1 >= 30 && J.th2 >= 30, lov != null ? `λov = ${f2(lov, 1)} %` : `g = ${f2(g, 1)} mm`));
    const rows = [0, 1, 2].map(i => [i + 1].concat(prop.map(pp => pp[i] ? `${tn(pp[i])} (${fmt(pp[i].m, 1)} kg/m)` : "—")));
    return { steps, checks, tables: [{ title: "Tubes les plus légers convenant à chaque barre", head: ["", "membrure", "diagonale 1", "diagonale 2"], rows }],
      vals: { P, g, lov, N1Rd, N2Rd, th1: J.th1, th2: J.th2, prop, best0: prop[0][0] && prop[0][0].m, R0: res[0].R, R1: res[1].R, R2: res[2].R },
      notes: ["Tubes finis à chaud du classeur (courbe a), 10 ≤ d/t ≤ 50 ; $L_{cr}$ = 0,9 L ou 0,75 L (annexe BB.1.3). $M_{0,Ed}$ inclut $|N_{0,2} - N_{0,1}|\\,|e|/2$ (CIDECT)."] };
  },
  fig(I, g, r) { const v = r.vals, [p0, p1, p2] = v.P, h1 = p1.d / (2 * sn(v.th1)), h2 = p2.d / (2 * sn(v.th2)), gg = v.g;
    return nodeFig({ h0: p0.d, span: max(abs(gg) + 4 * max(h1, h2), p0.d * 2.4), braces: [{ foot: -gg / 2 - h1, d: p1.d, th: v.th1, dir: -1, l: "1" }, { foot: gg / 2 + h2, d: p2.d, th: v.th2, dir: 1, l: "2" }], gap: gg > 0 ? gg : null, g1: -gg / 2, g2: gg / 2, chord: `membrure Ø${f2(p0.d, 1)} × ${f2(p0.t, 2)}${v.lov != null ? ` — recouvrement ${f2(v.lov, 0)} %` : ""}` }); },
  clair: (I, g, r) => `Le nœud reprend ${f2(r.vals.N1Rd, 0)} kN par diagonale ; la membrure la plus légère qui convient pèse ${f2(r.vals.best0, 1)} kg/m.` },

]);
})(typeof window !== "undefined" ? window : globalThis);
