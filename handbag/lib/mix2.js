/* ════════════════════════════════════════════════════════════════════
   HandBag — Ouvrages mixtes : poteau mixte en profil creux rectangulaire rempli de béton
   NF EN 1994-1-1 §6.7.3 (méthode simplifiée) — Biblio 2004 « EC4 » (ENV 1994-1-1).
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, min, max, abs, L, S, R, C, N, SEL, H, LST, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, plot } = HB.FIG;
const f2 = (v, d = 2) => fmt(v, d), Ea = 210000;
const ecm = fck => 22000 * ((fck + 8) / 10) ** 0.3;
const fyT = t => t <= 16 ? 355 : t <= 40 ? 345 : t <= 63 ? 335 : t <= 80 ? 325 : t <= 100 ? 315 : 295;

HB.add("Ouvrages mixtes", [
{ id: "ec4-poteau-rempli", t: "Poteau mixte : profil creux rectangulaire rempli de béton", ref: "NF EN 1994-1-1 §6.7.3 (méthode simplifiée), tableaux 6.5 et 6.4, figure 6.19 — Biblio 2004 « EC4 » (ENV 1994-1-1)",
  desc: "Résistance plastique et courbe d'interaction M–N d'un tube rectangulaire rempli de béton armé, flambement, moment du second ordre et vérification en flexion composée.",
  inputs: [LST("sec", "Tube h × b × t (h dans le plan de flexion)", "mm", "300 300 40", L`h\ b\ t`), N("fy", "Limite d'élasticité (0 : selon l'épaisseur, S355)", "MPa", 0, L`f_y`), N("fck", "Béton", "MPa", 50, L`f_{ck}`),
    LST("ar", "Armatures : section totale (cm²), distance de l'axe des barres à la paroi extérieure (cm)", "", "19.36 7.5", ""), N("fsk", "Limite des armatures", "MPa", 500, L`f_{sk}`),
    N("L", "Longueur de flambement", "m", 7.9, L`L_{cr}`), N("NEd", "Compression", "kN", 5000, L`N_{Ed}`), N("NG", "Part quasi permanente de N", "kN", 500, L`N_{G,Ed}`), N("MEd", "Moment d'extrémité maximal (1er ordre)", "kN·m", 800, L`M_{Ed}`),
    N("r", "Rapport des moments d'extrémité", "", 0.1, "r"), N("phi", "Coefficient de fluage", "", 2, L`\varphi_t`), LST("gm", "γa, γc, γs", "", "1 1.5 1.15", L`\gamma`)],
  calc(I) {
    const [h, b, t] = (I.sec || []).map(x => x / 1000), [As0, d0] = I.ar || [0, 5], [ga, gc, gs] = I.gm || [1, 1.5, 1.15]; if (!t) throw new Error("section à saisir");
    const fy = I.fy || fyT(t * 1000), fyd = fy / ga, fcd = I.fck / gc, fsd = I.fsk / gs, As = As0 / 1e4, d = d0 / 100, e = h / 2 - d;
    const Aa = 2 * t * (h + b - 2 * t), Ac = (b - 2 * t) * (h - 2 * t) - As, Ia = b * h ** 3 / 12 - (b - 2 * t) * (h - 2 * t) ** 3 / 12, Is = As * e * e, Ic = (b - 2 * t) * (h - 2 * t) ** 3 / 12 - Is;
    const Npl = Aa * fyd + Ac * fcd + As * fsd, NplRk = Aa * fy + Ac * I.fck + As * I.fsk, rho = As / (Ac + As), delta = Aa * fyd / Npl;
    /* courbe d'interaction (MN, MN·m) : points A, C, D, B */
    const Wpa = b * h * h / 4 - (b - 2 * t) * (h - 2 * t) ** 2 / 4, Wps = As * e, Wpc = (b - 2 * t) * (h - 2 * t) ** 2 / 4 - Wps, Mmax = Wpa * fyd + 0.5 * Wpc * fcd + Wps * fsd, Npm = Ac * fcd;
    const hn = Npm / (2 * b * fcd + 4 * t * (2 * fyd - fcd)), Wpan = 2 * t * hn * hn, Wpcn = (b - 2 * t) * hn * hn, Mn = Wpan * fyd + 0.5 * Wpcn * fcd, Mpl = Mmax - Mn;
    const poly = [[Npl, 0], [Npm, Mpl], [Npm / 2, Mmax], [0, Mpl]], Ned = I.NEd / 1000, mu = (() => { for (let i = 0; i < 3; i++) { const [n1, m1] = poly[i], [n2, m2] = poly[i + 1]; if (Ned <= n1 && Ned >= n2) return (m1 + (m2 - m1) * (n1 - Ned) / (n1 - n2)) / Mpl; } return 0; })();
    /* rigidités, flambement, second ordre */
    const Ecm = ecm(I.fck), Ece = Ecm / (1 + (I.NEd ? I.NG / I.NEd : 0) * I.phi), EI = Ea * Ia + 200000 * Is + 0.6 * Ece * Ic, EI2 = 0.9 * (Ea * Ia + 200000 * Is + 0.5 * Ece * Ic);
    const Ncr = PI * PI * EI / I.L ** 2, lam = sqrt(NplRk / Ncr), al = rho <= 0.03 ? 0.21 : 0.34, ph = 0.5 * (1 + al * (lam - 0.2) + lam * lam), chi = min(1, 1 / (ph + sqrt(ph * ph - lam * lam)));
    const Ncr2 = PI * PI * EI2 / I.L ** 2, beta = max(0.44, 0.66 + 0.44 * I.r), k1 = max(1, beta / (1 - Ned / Ncr2)), k2 = max(1, 1 / (1 - Ned / Ncr2)), e0 = I.L / (rho <= 0.03 ? 300 : 200);
    const Mmx = k1 * I.MEd / 1000 + k2 * Ned * e0, aM = fy <= 355 ? 0.9 : 0.8, tx = Mmx / (aM * mu * Mpl);
    return { steps: [S("fy", L`f_y`, `~${I.fy ? "saisie" : "S355 pour t = " + fmt(t * 1000, 0) + " mm"}`, fy, "MPa", 0), S("As", L`\rho_s`, L`\dfrac{A_s}{A_c + A_s}` + `\\quad(A_s = ${fmt(As0, 2).replace(",", "{,}")}\\ \\text{cm}^2)`, rho * 100, "%", 2),
      R("Npl", L`N_{pl,Rd}`, L`A_a\,f_{yd} + A_c\,f_{cd} + A_s\,f_{sd}`, Npl * 1000, "kN", 0), S("delta", L`\delta`, L`\dfrac{A_a\,f_{yd}}{N_{pl,Rd}}`, delta, "", 4),
      S("hn", L`h_n`, L`\dfrac{A_c\,f_{cd}}{2b\,f_{cd} + 4t\,(2f_{yd} - f_{cd})}`, hn, "m", 6), S("Mmax", L`M_{max,Rd}`, L`W_{pa}f_{yd} + \tfrac{1}{2}W_{pc}f_{cd} + W_{ps}f_{sd}`, Mmax * 1000, "kN·m", 1), R("Mpl", L`M_{pl,Rd}`, L`M_{max,Rd} - M_{n,Rd}`, Mpl * 1000, "kN·m", 1),
      S("EI", L`(EI)_{eff}`, L`E_aI_a + E_sI_s + 0{,}6\,E_{c,eff}I_c` + `\\quad E_{c,eff} = ${Math.round(Ece)}\\ \\text{MPa}`, EI, "MN·m²", 2), S("lam", L`\bar\lambda`, L`\sqrt{N_{pl,Rk}/N_{cr}}`, lam, "", 4), S("chi", L`\chi`, `~courbe ${al === 0.21 ? "a" : "b"}`, chi, "", 4),
      S("k", L`k`, L`\dfrac{\beta}{1 - N_{Ed}/N_{cr,eff}} \ge 1` + `\\quad \\beta = ${fmt(beta, 3).replace(",", "{,}")}`, k1, "", 4), S("Mmx", L`M_{Ed,max}`, L`k\,M_{Ed} + \dfrac{N_{Ed}\,e_0}{1 - N_{Ed}/N_{cr,eff}}` + `\\quad e_0 = L/${rho <= 0.03 ? 300 : 200}`, Mmx * 1000, "kN·m", 1),
      S("mu", L`\mu_d`, "~courbe d'interaction à NEd", mu, "", 4), R("tx", L`\eta`, L`\dfrac{M_{Ed,max}}{\alpha_M\,\mu_d\,M_{pl,Rd}}`, tx, "", 3)],
      checks: [C("Flambement : $N_{Ed} \\le \\chi\\,N_{pl,Rd}$", Ned <= chi * Npl, `${f2(I.NEd, 0)} ≤ ${f2(chi * Npl * 1000, 0)} kN`, Ned / (chi * Npl)), C("Flexion composée : $M_{Ed,max} \\le \\alpha_M\\,\\mu_d\\,M_{pl,Rd}$", tx <= 1, f2(tx, 3), tx),
        C("Domaine : $0{,}2 \\le \\delta \\le 0{,}9$, $\\bar\\lambda \\le 2$", delta >= 0.2 && delta <= 0.9 && lam <= 2, `δ = ${f2(delta, 3)}`), C("Voilement local : $h/t \\le 52\\sqrt{235/f_y}$", h / t <= 52 * sqrt(235 / fy), `${f2(h / t, 1)} ≤ ${f2(52 * sqrt(235 / fy), 1)}`)],
      vals: { poly, Ned, Mmx, h, b, t, d, As, Mpl, Npl, Mmax },
      notes: ["Remplissage par béton : coefficient 1,0 sur fcd (au lieu de 0,85). Angles du tube supposés vifs, armatures en deux lits symétriques. Rigidités de l'EN : 0,6 Ec,eff Ic pour le flambement, 0,9 (EaIa + EsIs + 0,5 Ec,eff Ic) pour le second ordre. Le classeur d'origine (ENV) prenait 0,8 Ecm/1,35, γa = 1,1 et un coefficient μ réduit par l'imperfection : saisir γa = 1,1 retrouve ses Npl,Rd et Mpl,Rd."] };
  },
  fig(I, g, r) { const v = r.vals, pts = v.poly.map(([n, m]) => [m * 1000, n * 1000]).concat([[0, 0]]);
    return plot({ series: [{ pts: [[0, v.Npl * 1000]].concat(v.poly.slice(1).map(([n, m]) => [m * 1000, n * 1000]), [[0, 0]]), c: K.gold, w: 2, l: "courbe d'interaction (M, N) plastique" }], marks: [{ x: v.Mmx * 1000, y: v.Ned * 1000, l: `(${f2(v.Mmx * 1000, 0)} ; ${f2(v.Ned * 1000, 0)})`, c: K.red }], xl: "M (kN·m) — N (kN)", h: 190, ymin: 0, xmin: 0, xmax: max(v.Mmax, v.Mmx) * 1000 * 1.15 }); },
  clair: (I, g) => `Le poteau porte ${f2(g("Npl"), 0)} kN en compression simple (χ = ${f2(g("chi"), 3)}) et travaille à ${f2(g("tx") * 100, 0)} % en flexion composée.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
