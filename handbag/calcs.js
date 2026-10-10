/* ════════════════════════════════════════════════════════════════════
   HandBag — calculs usuels d'ouvrages d'art (KLE Ingénierie)
   Repris des classeurs « Hand-Bag » (2019-2024) et revalidés.
   Chaque calcul : { id, cat, t (titre), ref, desc, inputs[], calc(I) }
   calc(I) renvoie { steps[], tables[], checks[], notes[], fig? }
   step  = { k, s, f, v, u, d, r }
     s : symbole (LaTeX) ; f : expression (LaTeX, ou texte si elle commence par « ~ »)
   Les textes (libellés, notes, tableaux, références) acceptent des formules entre $…$.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";

const PI = Math.PI, sqrt = Math.sqrt, pow = Math.pow, exp = Math.exp, min = Math.min, max = Math.max, abs = Math.abs, atan = Math.atan;
const L = String.raw;
const S = (k, s, f, v, u = "", d = 3, r = false) => ({ k, s, f, v, u, d, r });
const R = (k, s, f, v, u = "", d = 3) => S(k, s, f, v, u, d, true);
const C = (l, ok, txt = "") => ({ l, ok, txt });
const N = (k, l, u, v, s, extra = {}) => Object.assign({ k, l, u, v, s: s || k, t: "num" }, extra);
const SEL = (k, l, o, v, s) => ({ k, l, o, v, s: s === undefined ? k : s, t: "sel" });
const H = (h) => ({ h });

/* — Section rectangulaire BA à l'ELS (flexion simple, n = 15) — */
function elsRect(M_kNm, b, h, c, As_cm2, n = 15) {
  const d = h - c, As = As_cm2 / 1e4, M = abs(M_kNm) / 1000;           // MN.m
  const A = b / 2, B = n * As, Cc = -n * As * d;                         // b·y²/2 = n·As·(d − y)
  const y = (-B + sqrt(B * B - 4 * A * Cc)) / (2 * A);
  const I = b * y ** 3 / 3 + n * As * (d - y) ** 2;
  return { d, y, I, sb: M * y / I, ss: n * M * (d - y) / I };
}

/* — Spectres EC8 — */
const SPECTRES = {
  "EC8-1": { n: "EN 1998-1 recommandé — Type 1", av: 0.90, v: [0.05, 0.15, 1.0],
    A: [1.00, 0.15, 0.40, 2.0], B: [1.20, 0.15, 0.50, 2.0], C: [1.15, 0.20, 0.60, 2.0], D: [1.35, 0.20, 0.80, 2.0], E: [1.40, 0.15, 0.50, 2.0] },
  "EC8-2": { n: "EN 1998-1 recommandé — Type 2", av: 0.45, v: [0.05, 0.15, 1.0],
    A: [1.00, 0.05, 0.25, 1.2], B: [1.35, 0.05, 0.25, 1.2], C: [1.50, 0.10, 0.25, 1.2], D: [1.80, 0.10, 0.30, 1.2], E: [1.60, 0.05, 0.25, 1.2] },
  "FR": { n: "NF EN 1998-1/NA — France, zones 1 à 4", av: 0.80, v: [0.03, 0.20, 2.5],
    A: [1.00, 0.03, 0.20, 2.5], B: [1.35, 0.05, 0.25, 2.5], C: [1.50, 0.06, 0.40, 2.0], D: [1.60, 0.10, 0.60, 1.5], E: [1.80, 0.08, 0.45, 1.25] },
};
function seH(T, S, TB, TC, TD, eta) {           // Se/ag
  if (T < TB) return S * (1 + T / TB * (eta * 2.5 - 1));
  if (T < TC) return S * eta * 2.5;
  if (T < TD) return S * eta * 2.5 * TC / T;
  return S * eta * 2.5 * TC * TD / (T * T);
}
function seV(T, TB, TC, TD, eta) {              // Sve/avg
  if (T < TB) return 1 + T / TB * (eta * 3 - 1);
  if (T < TC) return eta * 3;
  if (T < TD) return eta * 3 * TC / T;
  return eta * 3 * TC * TD / (T * T);
}

const BOULONS = { M12: 84.3, M14: 115, M16: 157, M18: 192, M20: 245, M22: 303, M24: 353, M27: 459, M30: 561, M33: 694, M36: 817 };
const ACIER_HA = Object.fromEntries([6, 8, 10, 12, 14, 16, 20, 25, 32, 40].map(d => [d, PI * (d / 10) ** 2 / 4]));   // cm²
const EC2_CUBE = { 12: 15, 16: 20, 20: 25, 25: 30, 30: 37, 35: 45, 40: 50, 45: 55, 50: 60, 55: 67, 60: 75, 70: 85, 80: 95, 90: 105 };
const Ei_ = L`11\,000\,f_{c28}^{1/3}`, Ev_ = L`3\,700\,f_{c28}^{1/3}`;

const CALCS = [

/* ══════════════ MATÉRIAUX ══════════════ */
{ id: "beton-bael", cat: "Matériaux", t: "Béton : caractéristiques à j jours", ref: "BAEL 91 mod. 99 — A.2.1 / A.2.1.2",
  desc: "Résistances et modules du béton à 28 jours et à l'âge j.",
  inputs: [N("fc28", "Résistance à 28 jours", "MPa", 35, L`f_{c28}`), N("j", "Âge du béton", "jours", 3, "j")],
  calc(I) {
    const { fc28, j } = I;
    const fcj = j >= 28 ? fc28 : (fc28 <= 40 ? j / (4.76 + 0.83 * j) : j / (1.40 + 0.95 * j)) * fc28;
    const f28 = { ft: 0.6 + 0.06 * fc28, tu: 0.07 * fc28 / 1.5, Ei: 11000 * Math.cbrt(fc28), Ev: 3700 * Math.cbrt(fc28) };
    const fj = { ft: 0.6 + 0.06 * fcj, tu: 0.07 * fcj / 1.5, Ei: 11000 * Math.cbrt(fcj), Ev: 3700 * Math.cbrt(fcj) };
    return {
      steps: [
        R("fcj", L`f_{cj}`, j >= 28 ? L`f_{c28} \quad (j \geq 28)` : (fc28 <= 40 ? L`\dfrac{j}{4{,}76 + 0{,}83\,j}\,f_{c28}` : L`\dfrac{j}{1{,}40 + 0{,}95\,j}\,f_{c28}`), fcj, "MPa", 2),
        S("ftj", L`f_{tj}`, L`0{,}6 + 0{,}06\,f_{cj}`, fj.ft, "MPa", 3),
        S("tuj", L`\tau_{lim}`, L`\dfrac{0{,}07\,f_{cj}}{\gamma_b}`, fj.tu, "MPa", 3),
        S("Eij", L`E_{ij}`, L`11\,000\,f_{cj}^{1/3}`, fj.Ei, "MPa", 0),
        S("Evj", L`E_{vj}`, L`3\,700\,f_{cj}^{1/3}`, fj.Ev, "MPa", 0),
      ],
      tables: [{ title: "Comparaison 28 jours / j jours", head: ["", "28 jours", `j = ${j} j`, "Rapport"], rows: [
        ["$f_c$ (MPa)", fc28, fcj, fcj / fc28], ["$f_t$ (MPa)", f28.ft, fj.ft, fj.ft / f28.ft],
        ["$0{,}07 f_c/1{,}5$ (MPa)", f28.tu, fj.tu, fj.tu / f28.tu], ["$E_i$ (MPa)", f28.Ei, fj.Ei, fj.Ei / f28.Ei], ["$E_v$ (MPa)", f28.Ev, fj.Ev, fj.Ev / f28.Ev]],
        d: [2, 2, 3], pct: 3, key: { ft28: [1, 1], tu28: [2, 1], Ei28: [3, 1], Ev28: [4, 1] } }],
      vals: { ft28: f28.ft, tu28: f28.tu, Ei28: f28.Ei, Ev28: f28.Ev },
      notes: [j >= 28 ? "Pour j ≥ 28 jours, on retient conventionnellement $f_{cj} = f_{c28}$." : ""],
    };
  } },

{ id: "beton-ec2", cat: "Matériaux", t: "Béton : propriétés selon l'Eurocode 2", ref: "NF EN 1992-1-1 — §3.1, tableau 3.1",
  desc: "Résistances caractéristiques, modules et contraintes de calcul d'une classe de béton.",
  inputs: [SEL("fck", "Classe de résistance", Object.keys(EC2_CUBE).map(k => [k, `C${k}/${EC2_CUBE[k]}`]), "35", "")],
  calc(I) {
    const fck = +I.fck, fcm = fck + 8;
    const fctm = fck <= 50 ? 0.3 * pow(fck, 2 / 3) : 2.12 * Math.log(1 + fcm / 10);
    const f05 = 0.7 * fctm, f95 = 1.3 * fctm, Ecm = 22000 * pow(fcm / 10, 0.3);
    const ecu2 = fck <= 50 ? 3.5 : 2.6 + 35 * pow((90 - fck) / 100, 4);
    const ec2 = fck <= 50 ? 2.0 : 2.0 + 0.085 * pow(fck - 50, 0.53);
    return {
      steps: [
        S("fck", L`f_{ck}`, "~résistance caractéristique sur cylindre", fck, "MPa", 0),
        S("fckc", L`f_{ck,cube}`, "~résistance caractéristique sur cube", EC2_CUBE[fck], "MPa", 0),
        S("fcm", L`f_{cm}`, L`f_{ck} + 8`, fcm, "MPa", 0),
        S("fctm", L`f_{ctm}`, fck <= 50 ? L`0{,}30\,f_{ck}^{2/3}` : L`2{,}12\,\ln\!\left(1 + \dfrac{f_{cm}}{10}\right)`, fctm, "MPa", 2),
        S("fctk05", L`f_{ctk;0,05}`, L`0{,}70\,f_{ctm}`, f05, "MPa", 2),
        S("fctk95", L`f_{ctk;0,95}`, L`1{,}30\,f_{ctm}`, f95, "MPa", 2),
        R("Ecm", L`E_{cm}`, L`22\,000\left(\dfrac{f_{cm}}{10}\right)^{0{,}3}`, Ecm, "MPa", 0),
        S("Ecv", L`E_{c,\infty}`, L`\dfrac{E_{cm}}{3{,}3}`, Ecm / 3.3, "MPa", 0),
        S("ec2", L`\varepsilon_{c2}\;/\;\varepsilon_{cu2}`, "~déformations au pic et ultime", `${ec2.toFixed(2).replace(".", ",")} ‰ / ${ecu2.toFixed(2).replace(".", ",")} ‰`, "", 0),
      ],
      tables: [{ title: "Contraintes de calcul", head: ["Situation", "Compression (MPa)", "Traction $f_{ctd}$ (MPa)"], rows: [
        ["ELS quasi permanent : $0{,}45\,f_{ck}$", 0.45 * fck, f05], ["ELS caractéristique : $0{,}60\,f_{ck}$", 0.6 * fck, f05],
        ["ELU fondamental : $f_{ck}/1{,}5$", fck / 1.5, f05 / 1.5], ["ELU accidentel : $f_{ck}/1{,}2$", fck / 1.2, f05 / 1.2],
        ["ELU sismique : $f_{ck}/1{,}3$", fck / 1.3, f05 / 1.3]], d: [2, 2],
        key: { sQP: [0, 1], sCar: [1, 1], fcdF: [2, 1], fcdA: [3, 1], fcdS: [4, 1], ftdF: [2, 2], ftdA: [3, 2], ftdS: [4, 2] } }],
      notes: ["Coefficient de Poisson : 0,2 (béton non fissuré), 0 (fissuré). Dilatation thermique : $\\alpha = 10^{-5}\\ /°C$.",
              "Les contraintes de calcul sont données sans coefficient $\\alpha_{cc}$ (à appliquer selon l'annexe nationale)."],
    };
  } },

{ id: "retrait-ec2", cat: "Matériaux", t: "Retrait du béton selon l'Eurocode 2", ref: "NF EN 1992-1-1 — §3.1.4 et annexe B",
  desc: "Retrait de dessiccation et retrait endogène à l'âge t.",
  inputs: [N("fck", "Résistance caractéristique", "MPa", 30, L`f_{ck}`), N("RH", "Humidité relative", "%", 70, "RH"),
    SEL("cim", "Classe de ciment", [["S", "S — prise lente"], ["N", "N — normale"], ["R", "R — rapide"]], "R", ""),
    N("Ac", "Aire de la section", "m²", 13.07, L`A_c`), N("u", "Périmètre exposé", "m", 33.9292, "u"),
    N("ts", "Âge au début du séchage", "jours", 0, L`t_s`), N("t", "Âge considéré (∞ accepté)", "jours", "∞", "t")],
  calc(I) {
    const { fck, RH, Ac, u, ts, t } = I, fcm = fck + 8;
    const h0 = 2 * Ac / u * 1000;
    const tab = [[100, 1.0], [200, 0.85], [300, 0.75], [500, 0.70]];
    let kh = h0 <= 100 ? 1 : h0 >= 500 ? 0.7 : 0;
    for (let i = 0; i < 3; i++) if (h0 > tab[i][0] && h0 <= tab[i + 1][0]) kh = tab[i][1] + (tab[i + 1][1] - tab[i][1]) * (h0 - tab[i][0]) / (tab[i + 1][0] - tab[i][0]);
    const [a1, a2] = { S: [3, 0.13], N: [4, 0.12], R: [6, 0.11] }[I.cim];
    const bRH = 1.55 * (1 - pow(RH / 100, 3));
    const ecd0 = 0.85 * ((220 + 110 * a1) * exp(-a2 * fcm / 10)) * 1e-6 * bRH;
    const inf = !isFinite(t);
    const bds = inf ? 1 : (t - ts) / ((t - ts) + 0.04 * pow(h0, 1.5));
    const ecd = bds * kh * ecd0;
    const ecaInf = 2.5 * (fck - 10) * 1e-6, bas = inf ? 1 : 1 - exp(-0.2 * sqrt(t));
    const eca = bas * ecaInf;
    return {
      steps: [
        S("h0", L`h_0`, L`\dfrac{2\,A_c}{u}`, h0, "mm", 0), S("kh", L`k_h`, "~tableau 3.3 (interpolé)", kh, "", 3),
        S("bRH", L`\beta_{RH}`, L`1{,}55\left[1 - \left(\dfrac{RH}{100}\right)^{3}\right]`, bRH, "", 4),
        S("ecd0", L`\varepsilon_{cd,0}`, L`0{,}85\left[(220 + 110\,\alpha_{ds1})\,e^{-\alpha_{ds2}\,f_{cm}/10}\right]10^{-6}\,\beta_{RH}`, ecd0, "", "e"),
        S("bds", L`\beta_{ds}(t,t_s)`, L`\dfrac{t - t_s}{(t - t_s) + 0{,}04\,h_0^{3/2}}`, bds, "", 4),
        S("ecd", L`\varepsilon_{cd}(t)`, L`\beta_{ds}\,k_h\,\varepsilon_{cd,0}`, ecd, "", "e"),
        S("ecaInf", L`\varepsilon_{ca}(\infty)`, L`2{,}5\,(f_{ck} - 10)\,10^{-6}`, ecaInf, "", "e"),
        S("bas", L`\beta_{as}(t)`, L`1 - e^{-0{,}2\,t^{0{,}5}}`, bas, "", 4),
        S("eca", L`\varepsilon_{ca}(t)`, L`\beta_{as}\,\varepsilon_{ca}(\infty)`, eca, "", "e"),
        R("ecs", L`\varepsilon_{cs}`, L`\varepsilon_{cd} + \varepsilon_{ca}`, ecd + eca, "", "e"),
      ],
      notes: [`Ciment ${I.cim} : $\\alpha_{ds1} = ${a1}$, $\\alpha_{ds2} = ${String(a2).replace(".", "{,}")}$.`, `Soit un raccourcissement de ${((ecd + eca) * 1e3).toFixed(3).replace(".", ",")} mm/m.`],
    };
  } },

{ id: "retrait-fluage", cat: "Matériaux", t: "Retrait et fluage : évolution dans le temps", ref: "BPEL 91 — art. 2.1.5 et 2.1.6 (lois r(t), f(t))",
  desc: "Part de retrait et de fluage déjà consommée à une date donnée et part restante.",
  inputs: [H("Section"), N("B", "Aire de la section", "m²", 0.963, "B"), N("u", "Périmètre au contact de l'air", "m", 7, "u"),
    H("Retrait"), N("t", "Âge depuis la fabrication", "jours", 100, "t"), N("er", "Retrait à l'infini", "", 4e-4, L`\varepsilon_r`),
    H("Fluage"), N("t1", "Âge à la mise en tension", "jours", 28, L`t_1`), N("efl", "Fluage à l'infini", "", 3e-4, L`\varepsilon_{fl}`)],
  calc(I) {
    const { B, u, t, er, t1, efl } = I;
    const rm = B / u * 100, rt = t / (t + 9 * rm), ft = sqrt(t - t1) / (sqrt(t - t1) + 5 * sqrt(rm));
    const rr = (1 - rt) * er, fr = (1 - ft) * efl;
    return {
      steps: [
        S("rm", L`r_m`, L`\dfrac{B}{u}`, rm, "cm", 3),
        S("rt", L`r(t)`, L`\dfrac{t}{t + 9\,r_m}`, rt, "", 4), S("ert", L`\varepsilon_r(t)`, L`r(t)\,\varepsilon_r`, rt * er, "", "e"),
        S("rRest", L`\varepsilon_{r,\,rest}`, L`\left(1 - r(t)\right)\varepsilon_r`, rr, "", "e"),
        S("ft", L`f(t - t_1)`, L`\dfrac{\sqrt{t - t_1}}{\sqrt{t - t_1} + 5\sqrt{r_m}}`, ft, "", 4),
        S("eflt", L`\varepsilon_{fl}(t)`, L`f\,\varepsilon_{fl}`, ft * efl, "", "e"),
        S("fRest", L`\varepsilon_{fl,\,rest}`, L`(1 - f)\,\varepsilon_{fl}`, fr, "", "e"),
        S("tot", L`\varepsilon_{r} + \varepsilon_{fl}`, "~valeurs à l'infini", er + efl, "", "e"),
        R("rest", L`\varepsilon_{rest}`, L`\varepsilon_{r,\,rest} + \varepsilon_{fl,\,rest}`, rr + fr, "", "e"),
        R("ratio", L`\varepsilon_{rest}/\varepsilon_{\infty}`, "~part restante", (rr + fr) / (er + efl), "", 4),
      ],
      tables: [{ title: "Bilan", head: ["", "Consommé", "Restant"], rows: [["Retrait", rt, 1 - rt], ["Fluage", ft, 1 - ft]], pct: true }],
    };
  } },

{ id: "acier-precontrainte", cat: "Matériaux", t: "Acier de précontrainte : tension initiale", ref: "BPEL 91 — art. 3.3",
  desc: "Tension à l'origine et conversions d'unités usuelles.",
  inputs: [N("fprg", "Contrainte de rupture garantie", "MPa", 1860, L`f_{prg}`), N("fpeg", "Limite élastique garantie", "MPa", 1660, L`f_{peg}`),
    N("Ep", "Module d'élasticité", "MPa", 190000, L`E_p`), N("fe", "Acier passif", "MPa", 500, L`f_e`), N("fc28", "Béton", "MPa", 35, L`f_{c28}`)],
  calc(I) {
    const c = v => 100 * 10 / 9.81 * v;
    const s0 = min(0.8 * I.fprg, 0.9 * I.fpeg);
    return {
      steps: [R("sp0", L`\sigma_{p0}`, L`\min\left(0{,}80\,f_{prg}\ ;\ 0{,}90\,f_{peg}\right)`, s0, "MPa", 0)],
      tables: [{ title: "Conversions (1 MPa = 101,94 t/m²)", head: ["Grandeur", "MPa", "t/m²"], rows: [
        ["$f_{prg}$", I.fprg, c(I.fprg)], ["$f_{peg}$", I.fpeg, c(I.fpeg)], ["$\\sigma_{p0}$", s0, c(s0)], ["$E_p$", I.Ep, c(I.Ep)],
        ["$f_e$", I.fe, c(I.fe)], ["$f_{c28}$", I.fc28, c(I.fc28)]], d: [0, 0], key: { fprgT: [0, 2], sp0T: [2, 2], EpT: [3, 2] } }],
    };
  } },

/* ══════════════ SECTIONS ══════════════ */
{ id: "section-mixte", cat: "Sections", t: "Caractéristiques d'une section mixte acier-béton", ref: "Homogénéisation élastique — $n = E_a/E_b$",
  desc: "Profilé seul et section mixte homogénéisée (hourdis + renformis).",
  inputs: [H("Béton"), N("bh", "Hourdis : largeur", "mm", 4788, L`b_h`), N("hh", "Hourdis : épaisseur", "mm", 200, L`e_h`),
    N("br", "Renformis : largeur", "mm", 600, L`b_r`), N("hr", "Renformis : hauteur", "mm", 100, L`e_r`),
    H("Profilé acier"), N("H", "Hauteur totale du profilé", "mm", 1450, "H"), N("bs", "Semelle sup. : largeur", "mm", 700, L`b_s`), N("ts", "Semelle sup. : épaisseur", "mm", 65, L`t_s`),
    N("tw", "Âme : épaisseur", "mm", 20, L`t_w`), N("bi", "Semelle inf. : largeur", "mm", 800, L`b_i`), N("ti", "Semelle inf. : épaisseur", "mm", 75, L`t_i`),
    H("Équivalence"), N("Ea", "Module de l'acier", "GPa", 210, L`E_a`), N("fc", "Résistance du béton", "MPa", 30, L`f_{cj}`),
    SEL("mod", "Module béton", [["i", "Instantané : 11 000 f^1/3"], ["v", "Différé : 3 700 f^1/3"]], "i", L`E_b`)],
  calc(I) {
    const cm = v => v / 10;
    const hw = I.H - I.ts - I.ti;
    const Eb = (I.mod === "i" ? 11 : 3.7) * Math.cbrt(I.fc), n = I.Ea / Eb;
    const parts = [
      ["Hourdis", "b", cm(I.bh), cm(I.hh), cm(I.hh / 2 + I.hr + I.H)],
      ["Renformis", "b", cm(I.br), cm(I.hr), cm(I.hr / 2 + I.H)],
      ["Semelle supérieure", "a", cm(I.bs), cm(I.ts), cm(I.ts / 2 + hw + I.ti)],
      ["Âme", "a", cm(I.tw), cm(hw), cm(hw / 2 + I.ti)],
      ["Semelle inférieure", "a", cm(I.bi), cm(I.ti), cm(I.ti / 2)],
    ];
    const props = list => {
      const rows = list.map(([nm, m, b, h, z]) => { const k = m === "b" ? 1 / n : 1; return { nm, A: b * h * k, z, Ig: b * h ** 3 / 12 * k }; });
      const A = rows.reduce((s, r) => s + r.A, 0), v = rows.reduce((s, r) => s + r.A * r.z, 0) / A;
      rows.forEach(r => { r.dz = abs(r.z - v); r.I = r.Ig + r.A * r.dz ** 2; });
      return { rows, A, v, I: rows.reduce((s, r) => s + r.I, 0) };
    };
    const a = props(parts.slice(2)), m = props(parts);
    const htot = cm(I.H + I.hr + I.hh);
    return {
      steps: [
        S("hw", L`h_w`, L`H - t_s - t_i`, hw, "mm", 0),
        S("Eb", L`E_b`, I.mod === "i" ? L`11\,f_{cj}^{1/3}` : L`3{,}7\,f_{cj}^{1/3}`, Eb, "GPa", 2),
        S("n", "n", L`\dfrac{E_a}{E_b}`, n, "", 3),
        R("Aa", L`A_a`, L`\textstyle\sum A_{acier}`, a.A, "cm²", 1), R("va", L`v_{a,inf}`, L`\dfrac{\sum A_i\,z_i}{A_a}`, a.v, "cm", 2), R("Ia", L`I_a`, L`\textstyle\sum \left(I_{g,i} + A_i\,d_i^2\right)`, a.I, "cm⁴", 0),
        R("Am", L`A_m`, L`\textstyle\sum A_{acier} + \frac{1}{n}\sum A_{béton}`, m.A, "cm²", 1), R("vm", L`v_{m,inf}`, L`\dfrac{\sum A_i\,z_i}{A_m}`, m.v, "cm", 2), R("Im", L`I_m`, L`\textstyle\sum \left(I_{g,i} + A_i\,d_i^2\right)`, m.I, "cm⁴", 0),
        S("vms", L`v_{m,sup}`, L`h_{tot} - v_{m,inf}`, htot - m.v, "cm", 2),
      ],
      tables: [{ title: "Section mixte homogénéisée", head: ["Élément", "$A_{éq}$ (cm²)", "$z$ (cm)", "$d$ (cm)", "$I_{/G}$ (cm⁴)"],
        rows: m.rows.map(r => [r.nm, r.A, r.z, r.dz, r.I]), d: [1, 2, 2, 0] }],
      fig: figSectionMixte(I, m.v, a.v),
    };
  } },

{ id: "raideur-appui", cat: "Sections", t: "Inertie équivalente et raideur d'un appui", ref: "RDM — console encastrée $u = FH^3/3EI$ ; élastomère $K = nGA/T$",
  desc: "Inertie équivalente déduite d'un déplacement en tête, et raideur horizontale des appareils d'appui.",
  inputs: [H("Fût / appui"), N("H", "Hauteur", "m", 9.5, "H"), N("F", "Force horizontale en tête", "kN", 1000, "F"), N("u", "Déplacement en tête", "mm", 6.5, "u"),
    N("E", "Module du béton", "MPa", 19620, L`E_b`),
    H("Appareils d'appui"), N("n", "Nombre d'appareils", "U", 14, "n"), N("G", "Module de cisaillement", "MPa", 1.8, "G"), N("a", "Dimension a", "m", 0.3, "a"), N("b", "Dimension b", "m", 0.4, "b"), N("T", "Épaisseur d'élastomère", "m", 0.06, "T")],
  calc(I) {
    const Ieq = I.F * I.H ** 3 / (3 * I.E * 1000 * I.u / 1000), K = I.F / (I.u / 1000), A = I.a * I.b, Ka = 1000 * I.n * I.G * A / I.T;
    return {
      steps: [R("Ieq", L`I_{éq}`, L`\dfrac{F\,H^3}{3\,E_b\,u}`, Ieq, "m⁴", 4), R("K", L`K_{appui}`, L`\dfrac{F}{u}`, K, "kN/m", 0),
        S("A", "A", L`a\,b`, A, "m²", 4), R("Kaa", L`K_{AA}`, L`\dfrac{n\,G\,A}{T}`, Ka, "kN/m", 0), S("Ks", L`K_{série}`, L`\dfrac{1}{1/K_{appui} + 1/K_{AA}}`, 1 / (1 / K + 1 / Ka), "kN/m", 0)],
      fig: figConsole(),
    };
  } },

/* ══════════════ FLÈCHES & ROTATIONS ══════════════ */
{ id: "fleche-prefa", cat: "Flèches & rotations", t: "Poutres préfabriquées : flèches et contre-flèche", ref: "RDM — $f = 5pL^4/384EI$ ; phasage $F_1 + \\tfrac{2}{3}F_2 + F_3$ ; limites PRA",
  desc: "Flèche à la pose, après durcissement du tablier et sous superstructures ; contre-flèche à donner aux poutres.",
  inputs: [N("fc28", "Résistance du béton", "MPa", 35, L`f_{c28}`), N("L", "Portée de calcul", "m", 26.5, "L"), N("g", "Poids volumique", "kN/m³", 25, L`\gamma`),
    H("À la pose"), N("Ip", "Inertie de la poutre seule", "m⁴", 0.1807, L`I_p`), N("Ap", "Aire de la poutre", "m²", 0.8085, L`A_p`),
    N("bh", "Hourdis porté : largeur", "m", 2.17, L`b_h`), N("eh", "Hourdis porté : épaisseur", "m", 0.23, L`e_h`),
    H("Tablier durci"), N("It", "Inertie du tablier", "m⁴", 1.7305, L`I_t`), N("At", "Aire résistante du tablier", "m²", 5.8749, L`A_t`),
    N("qs", "Superstructures (max)", "kN/ml", 45.5, L`q_{sup}`), N("CF", "Contre-flèche retenue", "mm", 100, "CF")],
  calc(I) {
    const Ei = 11000 * Math.cbrt(I.fc28), Ev = 3700 * Math.cbrt(I.fc28), L4 = I.L ** 4;
    const p1 = I.g * I.Ap + I.g * I.bh * I.eh, p2 = I.g * I.At;
    const f = (p, E, In) => 1000 * 5 * (p / 1000) * L4 / (384 * E * In);
    const F1 = f(p1, Ei, I.Ip), F2 = f(p2, Ev, I.It), F3 = f(I.qs, Ev, I.It), Fg = F1 + 2 / 3 * F2 + F3;
    const sup = 0.564 * pow(I.L, 1.184), inf = 0.035 * pow(I.L, 1.5);
    return {
      steps: [S("Ei", L`E_i`, Ei_, Ei, "MPa", 0), S("Ev", L`E_v`, Ev_, Ev, "MPa", 0),
        S("p1", L`p_1`, L`\gamma\,(A_p + b_h\,e_h)`, p1, "kN/ml", 3),
        R("F1", L`F_1`, L`\dfrac{5\,p_1\,L^4}{384\,E_i\,I_p}`, F1, "mm", 2),
        S("p2", L`p_2`, L`\gamma\,A_t`, p2, "kN/ml", 3),
        R("F2", L`F_2`, L`\dfrac{5\,p_2\,L^4}{384\,E_v\,I_t}`, F2, "mm", 2),
        R("F3", L`F_3`, L`\dfrac{5\,q_{sup}\,L^4}{384\,E_v\,I_t}`, F3, "mm", 2),
        R("Fg", L`F_{globale}`, L`F_1 + \tfrac{2}{3}\,F_2 + F_3`, Fg, "mm", 2),
        S("sup", L`CF_{max}^{PRA}`, L`0{,}564\,L^{1{,}184}`, sup, "mm", 2), S("inf", L`CF_{min}^{PRA}`, L`0{,}035\,L^{1{,}5}`, inf, "mm", 2)],
      checks: [C("Contre-flèche retenue ≥ flèche globale", I.CF >= Fg, `${fmt(I.CF, 0)} mm ≥ ${fmt(Fg, 1)} mm`)],
      tables: [cfTable(I.L, I.CF)], fig: figParabole(I.L, I.CF),
      notes: ["$F_1$ : poutre seule sous poids propre et hourdis frais. $F_2$ : flèche qu'aurait le tablier sans phasage ; du fait du phasage, les poutres fléchissent à long terme de $F_1 + \\tfrac{2}{3}F_2$. $F_3$ : superstructures."],
    };
  } },

{ id: "fleche-tablier", cat: "Flèches & rotations", t: "Flèche différée d'un tablier isostatique", ref: "RDM — $f = 5pL^4/384E_vI$ ; limites PRA",
  desc: "Flèche différée sous charges permanentes et contre-flèche à prévoir.",
  inputs: [N("fc28", "Résistance du béton", "MPa", 35, L`f_{c28}`), N("L", "Portée", "m", 25, "L"), N("I", "Inertie du tablier", "m⁴", 4.616, "I"),
    N("pb", "Poids du tablier (béton)", "kN/ml", 0, L`p_b`), N("ps", "Poids des superstructures", "kN/ml", 456, L`p_s`), N("CF", "Contre-flèche retenue", "mm", 50, "CF")],
  calc(I) {
    const Ev = 3700 * Math.cbrt(I.fc28), p = I.pb + I.ps, Fv = 1000 * 5 * (p / 1000) * I.L ** 4 / (384 * Ev * I.I);
    return {
      steps: [S("Ev", L`E_v`, Ev_, Ev, "MPa", 0), S("p", "p", L`p_b + p_s`, p, "kN/ml", 2),
        R("Fv", L`F_v`, L`\dfrac{5\,p\,L^4}{384\,E_v\,I}`, Fv, "mm", 2), S("Fi", L`F_i`, L`\dfrac{F_v}{3} \quad (E_i = 3\,E_v)`, Fv / 3, "mm", 2),
        S("sup", L`CF_{max}^{PRA}`, L`0{,}564\,L^{1{,}184}`, 0.564 * pow(I.L, 1.184), "mm", 2), S("inf", L`CF_{min}^{PRA}`, L`0{,}035\,L^{1{,}5}`, 0.035 * pow(I.L, 1.5), "mm", 2)],
      checks: [C("Contre-flèche retenue ≥ flèche différée", I.CF >= Fv, `${fmt(I.CF, 0)} ≥ ${fmt(Fv, 1)} mm`)],
      tables: [cfTable(I.L, I.CF)], fig: figParabole(I.L, I.CF),
    };
  } },

{ id: "contre-fleche", cat: "Flèches & rotations", t: "Contre-flèche parabolique", ref: "Parabole $y = ax^2 + bx$",
  desc: "Ordonnées de la contre-flèche à chaque dixième de portée.",
  inputs: [N("L", "Portée", "m", 38, "L"), N("f", "Contre-flèche à mi-travée", "mm", 40, "f")],
  calc(I) {
    const a = -4 * I.f / I.L ** 2, b = -a * I.L;
    return { steps: [S("a", "a", L`-\dfrac{4\,f}{L^2}`, a, "mm/m²", 5), S("b", "b", L`\dfrac{4\,f}{L}`, b, "mm/m", 5), S("y", "y(x)", L`a\,x^2 + b\,x`, "", "", 0)],
      tables: [cfTable(I.L, I.f, true)], fig: figParabole(I.L, I.f) };
  } },

{ id: "fleche-mur", cat: "Flèches & rotations", t: "Flèche d'un mur en console sous poussée", ref: "RDM — charge triangulaire $pl^4/30EI$, uniforme $pl^4/8EI$",
  desc: "Déplacement en tête d'un voile ou mur de culée sous poussée des terres et de la surcharge.",
  inputs: [N("l", "Hauteur du mur", "m", 9.7, "l"), N("Ka", "Coefficient de poussée", "", 0.33, L`K_a`), N("g", "Poids volumique du remblai", "kN/m³", 20, L`\gamma`),
    N("q", "Surcharge sur remblai", "kN/m²", 20, "q"), N("fc28", "Résistance du béton", "MPa", 30, L`f_{c28}`),
    N("b", "Largeur de calcul", "m", 1, "b"), N("h", "Épaisseur du mur", "m", 1.03, "h")],
  calc(I) {
    const Ev = 3700 * Math.cbrt(I.fc28), Ei = 3 * Ev, In = I.b * I.h ** 3 / 12;
    const pt = I.Ka * I.g * I.l, pq = I.Ka * I.q;
    const ft = pt / 1000 * I.l ** 4 / (30 * Ev * In) * 1000, fq = pq / 1000 * I.l ** 4 / (8 * Ei * In) * 1000;
    return {
      steps: [S("Ev", L`E_v`, Ev_, Ev, "MPa", 0), S("Ei", L`E_i`, L`3\,E_v`, Ei, "MPa", 0),
        S("I", "I", L`\dfrac{b\,h^3}{12}`, In, "m⁴", 5), S("pt", L`p_{terres}`, L`K_a\,\gamma\,l`, pt, "kN/m", 2), S("pq", L`p_q`, L`K_a\,q`, pq, "kN/m", 2),
        R("ft", L`f_{terres}`, L`\dfrac{p_{terres}\,l^4}{30\,E_v\,I}`, ft, "mm", 2), R("fq", L`f_q`, L`\dfrac{p_q\,l^4}{8\,E_i\,I}`, fq, "mm", 2),
        R("f", L`f_{totale}`, L`f_{terres} + f_q`, ft + fq, "mm", 2)],
      notes: ["Poussée des terres (charge lente) avec $E_v$ ; surcharge (charge rapide) avec $E_i$."], fig: figMur(),
    };
  } },

{ id: "fleche-pile", cat: "Flèches & rotations", t: "Déplacement en tête d'appui (console)", ref: "RDM — $u = FH^3/3EI$",
  desc: "Déplacement en tête d'une pile, d'un groupe de pieux ou de barrettes sous effort horizontal.",
  inputs: [N("fc28", "Résistance du béton", "MPa", 35, L`f_{c28}`), N("F", "Effort horizontal en tête", "kN", 3600, "F"), N("H", "Hauteur libre", "m", 8, "H"),
    SEL("sec", "Section", [["I", "Inertie donnée"], ["P", "Pieux circulaires"], ["B", "Barrettes rectangulaires"]], "I", ""),
    N("I", "Inertie (si donnée)", "m⁴", 29.92, "I"), N("n", "Nombre d'éléments", "U", 3, "n"), N("D", "Diamètre des pieux", "m", 1.2, L`\varnothing`),
    N("bb", "Barrette : épaisseur", "m", 1.2, "b"), N("hb", "Barrette : longueur (sens de flexion)", "m", 2.7, "h")],
  calc(I) {
    const Ei = 11000 * Math.cbrt(I.fc28), Ev = 3700 * Math.cbrt(I.fc28);
    const In = I.sec === "I" ? I.I : I.sec === "P" ? I.n * PI * I.D ** 4 / 64 : I.n * I.bb * I.hb ** 3 / 12;
    const fI = I.sec === "I" ? "~valeur donnée" : I.sec === "P" ? L`n\,\dfrac{\pi\,\varnothing^4}{64}` : L`n\,\dfrac{b\,h^3}{12}`;
    const u = E => 1000 * (I.F / 1000) * I.H ** 3 / (3 * E * In);
    return { steps: [S("Ei", L`E_i`, Ei_, Ei, "MPa", 0), S("Ev", L`E_v`, Ev_, Ev, "MPa", 0),
      S("In", "I", fI, In, "m⁴", 4), R("ui", L`u_i`, L`\dfrac{F\,H^3}{3\,E_i\,I}`, u(Ei), "mm", 3), R("uv", L`u_v`, L`\dfrac{F\,H^3}{3\,E_v\,I}`, u(Ev), "mm", 3)], fig: figConsole() };
  } },

{ id: "rotation", cat: "Flèches & rotations", t: "Rotation sur appui d'une poutre isostatique", ref: "RDM — $\\alpha = pL^3/24EI$ ; $\\alpha = PL^2/16EI$",
  desc: "Rotation instantanée et différée sur appui (dimensionnement des appareils d'appui).",
  inputs: [SEL("cas", "Chargement", [["q", "Charge uniforme p"], ["P", "Charge concentrée P à mi-travée"]], "q", ""),
    N("p", "Charge (kN/ml ou kN)", "kN/ml", 330, "p, P"), N("L", "Portée", "m", 26.05, "L"), N("I", "Inertie", "m⁴", 6.7205, "I"), N("fc28", "Résistance du béton", "MPa", 30, L`f_{c28}`)],
  calc(I) {
    const Ei = 11000 * Math.cbrt(I.fc28), Ev = 3700 * Math.cbrt(I.fc28);
    const a = E => I.cas === "q" ? I.p / 1000 * I.L ** 3 / (24 * E * I.I) : I.p / 1000 * I.L ** 2 / (16 * E * I.I);
    const f = e => I.cas === "q" ? L`\dfrac{p\,L^3}{24\,E_${e}\,I}` : L`\dfrac{P\,L^2}{16\,E_${e}\,I}`;
    return { steps: [S("Ei", L`E_i`, Ei_, Ei, "MPa", 0), S("Ev", L`E_v`, Ev_, Ev, "MPa", 0),
      R("ai", L`\alpha_i`, f("i"), a(Ei), "rad", "e"), R("av", L`\alpha_v`, f("v"), a(Ev), "rad", "e"),
      S("av23", L`\tfrac{2}{3}\,\alpha_v`, "~rotation différée après phasage", 2 / 3 * a(Ev), "rad", "e")], notes: [`Soit $\\alpha_i = ${fmt(a(Ei) * 1000, 3).replace(",", "{,}")}$ ‰ et $\\alpha_v = ${fmt(a(Ev) * 1000, 3).replace(",", "{,}")}$ ‰.`] };
  } },

/* ══════════════ CHARGES ══════════════ */
{ id: "maj-dyn", cat: "Charges & répartition", t: "Coefficient de majoration dynamique", ref: "Fascicule 61 titre II — art. 5.5",
  desc: "Majoration dynamique des charges B pour une travée (poutres) ou un élément d'hourdis.",
  inputs: [SEL("el", "Élément", [["p", "Poutres / travée"], ["h", "Hourdis"]], "p", ""), N("L", "Longueur L", "m", 35.02, "L"),
    N("G", "Charge permanente sur L", "t", 924, "G"), N("S", "Surcharge B maximale sur L", "t", 110, "S")],
  calc(I) {
    const d = 1 + 0.4 / (1 + 0.2 * I.L) + 0.6 / (1 + 4 * I.G / I.S);
    return { steps: [S("t1", L`\dfrac{0{,}4}{1 + 0{,}2\,L}`, "", 0.4 / (1 + 0.2 * I.L), "", 4), S("t2", L`\dfrac{0{,}6}{1 + 4\,G/S}`, "", 0.6 / (1 + 4 * I.G / I.S), "", 4),
      R("delta", L`\delta`, L`1 + \dfrac{0{,}4}{1 + 0{,}2\,L} + \dfrac{0{,}6}{1 + 4\,\dfrac{G}{S}}`, d, "", 4)],
      notes: [I.el === "p" ? "L : portée de la travée ; G : poids de la travée ; S : surcharge B maximale que peut recevoir la travée." :
        "L : inf(entraxe des poutres de rive, portée) ; G : poids de l'hourdis et des éléments qu'il porte sur L ; S : surcharge B maximale sur L."] };
  } },

{ id: "charge-al", cat: "Charges & répartition", t: "Charge A(L) et freinage", ref: "Fascicule 61 titre II — art. 4.2 et 4.4",
  desc: "Densité de charge A(L), charge par mètre linéaire et effort de freinage associé.",
  inputs: [N("L", "Longueur chargée", "m", 9.45, "L"), N("a1", "Coefficient a1", "", 1, L`a_1`), N("V0", "Largeur de référence", "m", 3.5, L`V_0`),
    N("Lch", "Largeur chargeable", "m", 15, L`L_{ch}`), N("Nv", "Nombre de voies", "U", 5, L`N_v`)],
  calc(I) {
    const V = I.Lch / I.Nv, a2 = I.V0 / V, AL = 0.23 + 36 / (I.L + 12), Aeff = a2 * max(I.a1 * AL, 0.4 - 0.0002 * I.L);
    const Sf = I.L * I.Lch, F = Sf * Aeff / (20 + 0.0035 * Sf);
    return { steps: [S("V", "V", L`\dfrac{L_{ch}}{N_v}`, V, "m", 3), S("a2", L`a_2`, L`\dfrac{V_0}{V}`, a2, "", 4),
      S("AL", "A(L)", L`0{,}23 + \dfrac{36}{L + 12}`, AL, "t/m²", 4),
      R("A", "A", L`a_2\,\max\left(a_1\,A(L)\ ;\ 0{,}4 - 0{,}0002\,L\right)`, Aeff, "t/m²", 4), R("Aml", L`A\,L_{ch}`, "~charge par mètre linéaire", Aeff * I.Lch, "t/ml", 3),
      S("Sf", "S", L`L\,L_{ch}`, Sf, "m²", 2), S("fr", L`\phi`, L`\dfrac{1}{20 + 0{,}0035\,S}`, 1 / (20 + 0.0035 * Sf), "", 5),
      R("F", L`F_{freinage}`, L`\dfrac{S\,A}{20 + 0{,}0035\,S}`, F, "t", 3), S("FkN", "", "~soit", F * 9.81, "kN", 1)] };
  } },

{ id: "courbon", cat: "Charges & répartition", t: "Répartition transversale — méthode de Courbon", ref: "Méthode de Courbon (tablier infiniment rigide en torsion)",
  desc: "Coefficient de répartition transversale de chaque poutre pour une charge excentrée.",
  inputs: [N("n", "Nombre de poutres", "U", 4, "n"), N("bp", "Entraxe moyen des poutres", "m", 5.16667, L`b_p`), N("e", "Excentricité de la charge", "m", 2.25, "e")],
  calc(I) {
    const n = Math.round(I.n), et = [];
    for (let i = 1; i <= n; i++) et.push((1 + 6 * (n + 1 - 2 * i) / (n * n - 1) * I.e / I.bp) / n);
    const mx = max(...et);
    return { steps: [S("eta", L`\eta_i`, L`\dfrac{1}{n}\left[1 + \dfrac{6\,(n + 1 - 2i)}{n^2 - 1}\,\dfrac{e}{b_p}\right]`, "", "", 0),
      R("max", L`\eta_{max}`, "~poutre de rive la plus chargée", mx, "", 4), S("moy", L`1/n`, "~répartition uniforme", 1 / n, "", 4),
      S("cmax", L`n\,\eta_{max}`, "~majoration par rapport à la répartition uniforme", mx * n, "", 3)],
      tables: [{ title: "Coefficients par poutre", head: ["Poutre i", ...et.map((_, i) => i + 1)], rows: [["$\\eta_i$", ...et]], d: Array(n).fill(4), key: Object.fromEntries(et.map((_, i) => ["eta" + (i + 1), [0, i + 1]])) }],
      fig: figCourbon(n, I.e, I.bp, et) };
  } },

{ id: "freinage-lgv", cat: "Charges & répartition", t: "Démarrage et freinage ferroviaires", ref: "NF EN 1991-2 — §6.5.3",
  desc: "Forces longitudinales de démarrage et de freinage pour une voie.",
  inputs: [SEL("mod", "Modèle de charge", [["71", "LM71, SW/0, HSLM"], ["SW2", "SW/2"]], "71", ""), N("L", "Longueur d'influence", "m", 24, L`L_{a,b}`), N("a", "Coefficient α", "", 1, L`\alpha`)],
  calc(I) {
    const Qa = min(33 * I.L, 1000) * I.a, Qb = (I.mod === "SW2" ? 35 * I.L : min(20 * I.L, 6000)) * I.a;
    return { steps: [R("Qla", L`Q_{la,k}`, L`\alpha\,\min\left(33\,L_{a,b}\ ;\ 1\,000\right)`, Qa, "kN", 1),
      R("Qlb", L`Q_{lb,k}`, I.mod === "SW2" ? L`\alpha\cdot 35\,L_{a,b}` : L`\alpha\,\min\left(20\,L_{a,b}\ ;\ 6\,000\right)`, Qb, "kN", 1)],
      notes: ["Ces forces ne sont pas majorées dynamiquement et peuvent être minorées selon les tableaux 6.5 et 6.6.",
        "Au maximum : démarrage sur une voie et freinage sur une deuxième voie."] };
  } },

/* ══════════════ PRÉCONTRAINTE ══════════════ */
{ id: "allongement", cat: "Précontrainte", t: "Allongement des câbles et coefficient de transmission", ref: "BPEL 91 — pertes par frottement",
  desc: "Allongement théorique d'un câble tendu des deux côtés et rapport de transmission théorique.",
  inputs: [N("s0", "Tension à l'origine", "MPa", 1378.88, L`\sigma_0`), N("Ap", "Section d'un toron", "mm²", 150, L`A_p`), N("nc", "Nombre de torons", "U", 12, "n"),
    N("L", "Longueur ancrage → milieu", "m", 34, "L"), N("E", "Module des câbles", "MPa", 190000, L`E_p`),
    N("f", "Coefficient de frottement en courbe", "rad⁻¹", 0.2, "f"), N("phi", "Coefficient de perte en ligne", "m⁻¹", 0.002, L`\varphi`), N("al", "Déviation angulaire cumulée", "rad", 0.387891, L`\alpha`)],
  calc(I) {
    const sm = I.s0 * exp(-I.f * I.al - I.phi * I.L), dl = I.L / I.E * (I.s0 + sm) / 2 * 1000, ct = (sm / I.s0) ** 2, P = I.s0 * I.Ap * I.nc / 1e6;
    return { steps: [S("P", L`P_0`, L`\sigma_0\,A_p\,n`, P, "MN", 4), S("Pt", "", "~soit", P * 102, "t", 2),
      R("sm", L`\sigma_{mil}`, L`\sigma_0\,e^{-(f\,\alpha + \varphi\,L)}`, sm, "MPa", 2),
      R("dl", L`\Delta L`, L`\dfrac{L}{E_p}\cdot\dfrac{\sigma_0 + \sigma_{mil}}{2}`, dl, "mm", 2), S("dl2", L`2\,\Delta L`, "~allongement total (deux côtés actifs)", 2 * dl, "mm", 2),
      R("ct", L`\dfrac{T_p}{T_a}`, L`\left(\dfrac{\sigma_{mil}}{\sigma_0}\right)^2`, ct, "", 4), S("Tp", L`\sigma_{passif}`, L`\dfrac{T_p}{T_a}\,\sigma_0`, ct * I.s0, "MPa", 2)],
      notes: ["Hypothèses : deux côtés actifs ; pertes par rentrée d'ancrage et raccourcissement élastique non comptées.",
        "Le coefficient de transmission théorique (sans tarage) se compare au rapport $T_{passif}/T_{actif}$ mesuré lors de l'essai de transmission."] };
  } },

/* ══════════════ BÉTON ARMÉ ══════════════ */
{ id: "cis-ec2", cat: "Béton armé", t: "Armatures d'effort tranchant (bielles)", ref: "NF EN 1992-1-1 — §6.2.3, expression (6.8)",
  desc: "Section d'armatures transversales par mètre, à l'ELU et en situation accidentelle.",
  inputs: [H("ELU fondamental"), N("V1", "Effort tranchant", "MN", 6.067, L`V_{Ed}`), N("cot1", "Inclinaison des bielles", "", 1.5, L`\cot\theta`), N("g1", "Coefficient acier", "", 1.15, L`\gamma_s`),
    H("ELA / sismique"), N("V2", "Effort tranchant", "MN", 9.588, L`V_{Ed}`), N("cot2", "Inclinaison des bielles", "", 2.5, L`\cot\theta`), N("g2", "Coefficient acier", "", 1, L`\gamma_s`),
    H("Section"), N("d", "Hauteur utile", "m", 1.928, "d"), N("fyk", "Limite élastique des cadres", "MPa", 500, L`f_{ywk}`)],
  calc(I) {
    const z = 0.9 * I.d, r = (V, c, g) => V / (z * I.fyk / g * c) * 1e4;
    return { steps: [S("z", "z", L`0{,}9\,d`, z, "m", 3), S("fyd1", L`f_{ywd}^{ELU}`, L`\dfrac{f_{ywk}}{\gamma_s}`, I.fyk / I.g1, "MPa", 1),
      R("A1", L`\left(\dfrac{A_{sw}}{s}\right)_{ELU}`, L`\dfrac{V_{Ed}}{z\,f_{ywd}\,\cot\theta}`, r(I.V1, I.cot1, I.g1), "cm²/ml", 2),
      S("fyd2", L`f_{ywd}^{ELA}`, L`\dfrac{f_{ywk}}{\gamma_s}`, I.fyk / I.g2, "MPa", 1),
      R("A2", L`\left(\dfrac{A_{sw}}{s}\right)_{ELA}`, L`\dfrac{V_{Ed}}{z\,f_{ywd}\,\cot\theta}`, r(I.V2, I.cot2, I.g2), "cm²/ml", 2),
      R("Amax", L`\dfrac{A_{sw}}{s}`, "~valeur dimensionnante", max(r(I.V1, I.cot1, I.g1), r(I.V2, I.cot2, I.g2)), "cm²/ml", 2)],
      notes: ["Vérifier par ailleurs la compression des bielles $V_{Rd,max}$ (6.9) et $1 \\le \\cot\\theta \\le 2{,}5$."] };
  } },

{ id: "cis-circulaire", cat: "Béton armé", t: "Cisaillement d'un fût circulaire creux", ref: "Résistance des matériaux — section tubulaire",
  desc: "Contrainte de cisaillement maximale dans un fût de pile creux et densité d'armatures dans l'épaisseur.",
  inputs: [N("D", "Diamètre extérieur", "m", 2.4, "D"), N("e", "Épaisseur", "m", 0.4, "e"), N("V", "Effort tranchant", "kN", 1161, "V"), N("fe", "Acier", "MPa", 500, L`f_e`), N("gs", "Coefficient acier", "", 1, L`\gamma_s`)],
  calc(I) {
    const Di = I.D - 2 * I.e, In = PI * (I.D ** 4 - Di ** 4) / 64, t = (I.V / 1000) * (I.D / 2) ** 2 / In, A = I.gs * I.e * t / (0.9 * I.fe) * 1e4;
    return { steps: [S("Di", L`D_i`, L`D - 2\,e`, Di, "m", 3), S("I", "I", L`\dfrac{\pi\,(D^4 - D_i^4)}{64}`, In, "m⁴", 4),
      R("tau", L`\tau_{max}`, L`\dfrac{V\,S}{I\,b} = \dfrac{V\,R^2}{I}`, t, "MPa", 3), R("A", L`\dfrac{A_t}{s_t}`, L`\dfrac{\gamma_s\,e\,\tau_{max}}{0{,}9\,f_e}`, A, "cm²/ml", 2)],
      notes: ["k = 0 (reprise de bétonnage tolérée). La densité est à répartir sur les deux nappes de l'épaisseur."], fig: figTube(I.D, I.e) };
  } },

{ id: "frettage", cat: "Béton armé", t: "Frettes sous appareils d'appui", ref: "Règle des 4 % de la réaction",
  desc: "Frette de surface directement sous l'appareil d'appui, dans chaque direction.",
  inputs: [N("R", "Réaction maximale ELS", "kN", 1101, L`R_{max}`), N("fe", "Nuance des frettes", "MPa", 235, L`f_e`),
    SEL("phi", "Diamètre retenu", Object.keys(ACIER_HA).map(k => [k, "Ø" + k]), "10", L`\varnothing`)],
  calc(I) {
    const A = 0.04 * 1e4 * (I.R / 1000) / (2 / 3 * I.fe), a1 = ACIER_HA[I.phi], n = A / a1;
    return { steps: [R("A", "A", L`\dfrac{0{,}04\,R_{max}}{\tfrac{2}{3}\,f_e}`, A, "cm²", 3), S("a1", L`A_{\varnothing}`, L`\dfrac{\pi\,\varnothing^2}{4}`, a1, "cm²", 3),
      S("n", L`n_{min}`, L`\dfrac{A}{A_{\varnothing}}`, n, "U", 2), R("nr", "n", "~brins retenus par sens", Math.ceil(n), "U", 0)] };
  } },

{ id: "levage-trous", cat: "Béton armé", t: "Levage des poutres : réservations", ref: "Règle des 4 % de l'effort concentré",
  desc: "Ferraillage autour des trous de levage d'une poutre préfabriquée.",
  inputs: [N("fe", "Acier des réservations", "MPa", 235, L`f_e`),
    N("S1", "Aire sur appuis", "m²", 0.8085, L`S_{max}`), N("S3", "Aire à mi-travée", "m²", 0.8085, L`S_{min}`),
    N("L1", "Longueur à Smax", "m", 27.5, L`L_1`), N("L2", "Longueur à Smoy", "m", 0, L`L_2`), N("L3", "Longueur à Smin", "m", 0, L`L_3`), N("g", "Masse volumique", "t/m³", 2.5, L`\rho`)],
  calc(I) {
    const Sm = (I.S1 + I.S3) / 2, V = I.S1 * I.L1 + Sm * I.L2 + I.S3 * I.L3, P = I.g * V, F = P / 2, A = 0.04 * (F / 100) / (2 / 3 * I.fe) * 1e4;
    return { steps: [S("Sm", L`S_{moy}`, L`\dfrac{S_{max} + S_{min}}{2}`, Sm, "m²", 4), S("Lp", L`L_{poutre}`, L`L_1 + L_2 + L_3`, I.L1 + I.L2 + I.L3, "m", 2),
      S("V", "V", L`\textstyle\sum S_i\,L_i`, V, "m³", 3), R("P", "P", L`\rho\,V`, P, "t", 3), R("F", "F", L`\dfrac{P}{2}`, F, "t", 3),
      R("A", "A", L`\dfrac{0{,}04\,F}{\tfrac{2}{3}\,f_e}`, A, "cm²", 3)], fig: figLevage(false),
      notes: ["A est à disposer dans les deux sens autour de chaque réservation."] };
  } },

{ id: "levage-crochets", cat: "Béton armé", t: "Levage des poutres : consoles et crochets", ref: "ELS — section rectangulaire ($n = 15$) ; crochets en acier doux",
  desc: "Contraintes dans le béton et les aciers supérieurs au droit des crochets, et contrainte dans les crochets.",
  inputs: [N("fc", "Béton au levage", "MPa", 35, L`f_c`), N("fe", "Aciers supérieurs", "MPa", 500, L`f_e`), N("As", "Section des aciers sup.", "cm²", 4.68, L`A_{sup}`),
    SEL("fis", "Fissuration", [["PP", "Peu préjudiciable"], ["P", "Préjudiciable"], ["TP", "Très préjudiciable"]], "P", ""),
    N("A", "Aire de la poutre", "m²", 0.5, "A"), N("b", "Largeur d'âme", "m", 0.4, L`b_0`), N("h", "Hauteur totale", "m", 1, "h"), N("c", "Enrobage aux aciers", "m", 0.05, "c"),
    N("a", "Porte-à-faux crochet → about", "m", 0.9, "a"), N("Lc", "Entraxe des crochets", "m", 17.75, L`L_c`),
    N("nc", "Brins par crochet", "U", 2, L`n_b`), SEL("phi", "Diamètre des crochets", Object.keys(ACIER_HA).map(k => [k, "Ø" + k]), "25", L`\varnothing`), N("fec", "Acier des crochets", "MPa", 235, L`f_{e,c}`)],
  calc(I) {
    const M = 25 * I.A * I.a ** 2 / 2, s = elsRect(M, I.b, I.h, I.c, I.As);
    const ssl = I.fis === "PP" ? I.fe : I.fis === "P" ? I.fe / 2 : 200, sbl = 0.6 * I.fc;
    const Lp = 2 * I.a + I.Lc, P = 2.5 * I.A * Lp, Ac = I.nc * ACIER_HA[I.phi], sc = (P / 2) / 100 / (Ac / 1e4);
    return { steps: [R("M", "M", L`\dfrac{\gamma\,A\,a^2}{2}`, M, "kN·m", 3), S("y", L`y_1`, L`\tfrac{1}{2}\,b_0\,y_1^2 = 15\,A_{sup}\,(d - y_1)`, s.y, "m", 4),
      R("ss", L`\sigma_s`, L`\dfrac{15\,M\,(d - y_1)}{I}`, s.ss, "MPa", 1), R("sb", L`\sigma_b`, L`\dfrac{M\,y_1}{I}`, s.sb, "MPa", 2),
      S("Lp", L`L_{poutre}`, L`2\,a + L_c`, Lp, "m", 2), R("P", "P", L`\rho\,A\,L_{poutre}`, P, "t", 3), S("P2", L`P/2`, "~par crochet", P / 2, "t", 3),
      S("Ac", L`A_{crochet}`, `~${I.nc} Ø${I.phi}`, Ac, "cm²", 2), R("sc", L`\sigma_{crochet}`, L`\dfrac{P/2}{A_{crochet}}`, sc, "MPa", 1)],
      checks: [C("$\\sigma_s \\le \\bar\\sigma_s$", s.ss <= ssl, `${fmt(s.ss, 0)} ≤ ${fmt(ssl, 0)} MPa`), C("$\\sigma_b \\le 0{,}6\\,f_c$", s.sb <= sbl, `${fmt(s.sb, 1)} ≤ ${fmt(sbl, 1)} MPa`),
        C("$\\sigma_{crochet} \\le f_{e,c}$", sc <= I.fec, `${fmt(sc, 0)} ≤ ${fmt(I.fec, 0)} MPa`)],
      vals: { ssl, sbl }, fig: figLevage(true), notes: ["$d = h - c$ ; $I = \\tfrac{1}{3}\\,b_0\\,y_1^3 + 15\\,A_{sup}\\,(d - y_1)^2$. On ne compte que sur un seul crochet par extrémité."] };
  } },

{ id: "predalles", cat: "Béton armé", t: "Prédalles non participantes", ref: "Flexion simple de la prédalle seule",
  desc: "Vérification de la prédalle au coulage du béton de remplissage.",
  inputs: [N("L", "Portée de la prédalle", "m", 0.625, "L"), N("ep", "Épaisseur de la prédalle", "m", 0.012, L`e_p`), N("H", "Épaisseur de béton coulé", "m", 0.36, "H"),
    N("gp", "Poids volumique prédalle", "kN/m³", 14, L`\gamma_p`), N("gb", "Poids volumique du remplissage", "kN/m³", 26, L`\gamma_b`), N("sl", "Contrainte limite", "MPa", 18, L`\bar\sigma`)],
  calc(I) {
    const p = I.ep * I.gp + I.H * I.gb, M = p * I.L ** 2 / 8, In = I.ep ** 3 / 12, v = I.ep / 2, s = (M / 1000) * v / In, Fs = I.sl / s;
    return { steps: [S("p", "p", L`e_p\,\gamma_p + H\,\gamma_b`, p, "kN/ml", 3), S("M", "M", L`\dfrac{p\,L^2}{8}`, M, "kN·m/ml", 4),
      S("I", "I", L`\dfrac{e_p^3}{12}`, In, "m⁴/ml", "e"), S("v", "v", L`\dfrac{e_p}{2}`, v, "m", 4), R("s", L`\sigma_{max}`, L`\dfrac{M\,v}{I}`, s, "MPa", 2), R("Fs", L`F_s`, L`\dfrac{\bar\sigma}{\sigma_{max}}`, Fs, "", 3)],
      checks: [C("$\\sigma_{max} \\le \\bar\\sigma$ ($F_s \\ge 1$)", Fs >= 1, `$F_s$ = ${fmt(Fs, 2)}`)] };
  } },

/* ══════════════ ACIER ══════════════ */
{ id: "serrage", cat: "Charpente métallique", t: "Couple de serrage des boulons précontraints", ref: "NF EN 1090-2 — §8.5",
  desc: "Précontrainte nominale et couples des phases de serrage.",
  inputs: [SEL("cl", "Classe", [["800", "8.8 (fub 800 MPa)"], ["1000", "10.9 (fub 1 000 MPa)"]], "1000", ""),
    SEL("M", "Diamètre", Object.keys(BOULONS).map(k => [k, k]), "M27", ""), N("km", "Coefficient de frottement moyen", "", 0.11, L`k_m`)],
  calc(I) {
    const fub = +I.cl, As = BOULONS[I.M], d = parseInt(I.M.slice(1), 10), Fp = 0.7 * fub * As / 1000, Mr = I.km * d * Fp;
    return { steps: [S("fub", L`f_{ub}`, "~classe " + (fub === 800 ? "8.8" : "10.9"), fub, "MPa", 0), S("As", L`A_s`, "~aire résistante " + I.M, As, "mm²", 1),
      R("Fp", L`F_{p,C}`, L`0{,}7\,f_{ub}\,A_s`, Fp, "kN", 1), R("Mr", L`M_r`, L`k_m\,d\,F_{p,C}`, Mr, "N·m", 0),
      S("M75", L`0{,}75\,M_r`, "~phase 1 (méthodes combinée et du couple)", 0.75 * Mr, "N·m", 0), S("M110", L`1{,}10\,M_r`, "~phase 2 (méthode du couple)", 1.1 * Mr, "N·m", 0)],
      notes: ["Méthode combinée : phase 2 par rotation complémentaire selon l'épaisseur des pièces serrées (NF EN 1090-2, tableau 21)."] };
  } },

/* ══════════════ APPAREILS D'APPUI ══════════════ */
{ id: "tassement-aa", cat: "Appareils d'appui", t: "Tassement d'un appareil d'appui en élastomère fretté", ref: "NF EN 1337-3 — §5.3.3.7",
  desc: "Tassement sous charge verticale centrée, couche par couche.",
  inputs: [N("Fz", "Charge verticale", "kN", 591, L`F_z`), N("a", "Dimension a", "m", 0.3, "a"), N("b", "Dimension b", "m", 0.4, "b"), N("enr", "Enrobage latéral", "mm", 5, "c"),
    N("G", "Module de cisaillement", "MPa", 0.9, L`G_d`), N("Eb", "Module de compressibilité", "MPa", 2000, L`E_b`),
    N("text", "Couches extérieures : épaisseur", "mm", 6, L`t_{ext}`), N("tint", "Couches intérieures : épaisseur", "mm", 12, L`t_{int}`), N("nint", "Nombre de couches intérieures", "U", 3, L`n_{int}`)],
  calc(I) {
    const a1 = I.a - 2 * I.enr / 1000, b1 = I.b - 2 * I.enr / 1000, A1 = a1 * b1, lp = 2 * (a1 + b1), sig = I.Fz / 1000 / A1;
    const layers = [["Ext", I.text], ...Array(Math.round(I.nint)).fill(["Int", I.tint]), ["Ext", I.text]];
    let tot = 0; const rows = layers.map(([pos, t], i) => { const ti = t / 1000, te = pos === "Ext" ? 1.4 * ti : ti, Si = A1 / (lp * te),
      v = 1000 * (I.Fz / 1000) * ti / A1 * (1 / (5 * I.G * Si ** 2) + 1 / I.Eb); tot += v; return [i + 1, t, pos === "Ext" ? "Extérieure" : "Intérieure", te * 1000, Si, v]; });
    return { steps: [S("A1", L`A'`, L`(a - 2c)(b - 2c)`, A1, "m²", 4), S("lp", L`l_p`, L`2\,(a' + b')`, lp, "m", 3),
      S("sig", L`\sigma`, L`\dfrac{F_z}{A'}`, sig, "MPa", 2), S("Si", L`S_i`, L`\dfrac{A'}{l_p\,t_e}`, "", "", 0),
      R("vz", L`v_z`, L`\displaystyle\sum_i \frac{F_z\,t_i}{A'}\left(\frac{1}{5\,G_d\,S_i^2} + \frac{1}{E_b}\right)`, tot, "mm", 3),
      S("vz2", L`v_z/2`, "~tassement réel estimé (haut)", tot / 2, "mm", 3), S("vz3", L`v_z/3`, "~tassement réel estimé (bas)", tot / 3, "mm", 3)],
      vals: { a1, b1 },
      tables: [{ title: "Détail par couche", head: ["n°", "$t_i$ (mm)", "Position", "$t_e$ (mm)", "$S_i$", "$v_{z,i}$ (mm)"], rows, d: [0, 0, 1, 2, 4], key: { v1: [0, 5], v2: [1, 5] } }],
      notes: ["Couches extérieures : $t_e = 1{,}4\\,t_i$."], fig: figAA(layers) };
  } },

/* ══════════════ FONDATIONS ══════════════ */
{ id: "pieux-min-sis", cat: "Fondations", t: "Pieux : minimums sismiques", ref: "AFPS 92 — ferraillage minimal des pieux",
  desc: "Armatures longitudinales minimales et pourcentage volumique des cerces.",
  inputs: [N("D", "Diamètre du pieu", "m", 1, L`\varnothing`), SEL("sol", "Type de sol (AFPS 92)", [["a", "a"], ["b", "b"], ["c", "c"]], "c", ""),
    SEL("phi", "Barres longitudinales", Object.keys(ACIER_HA).map(k => [k, "HA" + k]), "32", L`\varnothing_L`),
    H("Cerces"), N("c", "Enrobage", "m", 0.07, "c"), N("sc", "Espacement zone critique", "cm", 8, L`s_{crit}`), N("sk", "Espacement zone courante", "cm", 11, L`s_{cour}`),
    N("p1", "Cerce : diamètre", "mm", 16, L`\varnothing_1`), N("p2", "Cerce secondaire (0 si aucune)", "mm", 0, L`\varnothing_2`)],
  calc(I) {
    const Sp = PI * I.D ** 2 / 4, base = I.sol === "c" ? 0.006 : 0.005, rho = I.D <= 1 ? base : base / sqrt(I.D), As = rho * Sp * 1e4;
    const a1 = PI * (I.phi / 10) ** 2 / 4, n = Math.ceil(As / a1 - 1e-9), Ar = n * a1;
    const vol = (s, p) => { const Vb = PI * I.D ** 2 / 4 * s / 100, Va = PI * (p / 10) ** 2 / 4 * PI * (100 * I.D - 200 * I.c - p / 10); return Va / 1e6 / Vb; };
    const rc = vol(I.sc, I.p1) + vol(I.sc, I.p2), rk = vol(I.sk, I.p1) + vol(I.sk, I.p2);
    const b = (base * 100).toFixed(1).replace(".", "{,}");
    return { steps: [S("Sp", "S", L`\dfrac{\pi\,\varnothing^2}{4}`, Sp, "m²", 4), S("rho", L`\rho_{min}`, I.D <= 1 ? `${b}\\ \\%` : `\\dfrac{${b}\\ \\%}{\\sqrt{\\varnothing}}`, rho * 100, "%", 3),
      R("As", L`A_{s,min}`, L`\rho_{min}\,S`, As, "cm²", 2), R("n", "n", L`\left\lceil \dfrac{A_{s,min}}{A_{\varnothing}} \right\rceil`, n, "U", 0), S("Ar", L`A_{s,réel}`, L`n\,A_{\varnothing}`, Ar, "cm²", 2), S("rr", L`\rho_{réel}`, L`\dfrac{A_{s,réel}}{S}`, Ar / 1e4 / Sp * 100, "%", 3),
      S("vw", L`\rho_w`, L`\dfrac{V_{cerces}}{V_{béton}} = \dfrac{\frac{\pi\varnothing_1^2}{4}\,\pi\,(\varnothing - 2c - \varnothing_1)}{\frac{\pi\varnothing^2}{4}\,s}`, "", "", 0),
      R("rc", L`\rho_{w,crit}`, `~zone critique, s = ${fmt(I.sc, 0)} cm`, rc * 100, "%", 3), R("rk", L`\rho_{w,cour}`, `~zone courante, s = ${fmt(I.sk, 0)} cm`, rk * 100, "%", 3)] };
  } },

{ id: "groupe-v", cat: "Fondations", t: "Effet de groupe vertical : coefficient d'efficacité", ref: "Fascicule 62 titre V — annexe G.1, §2.2 et §2.5.1",
  desc: "Coefficient d'efficacité d'un groupe de pieux flottants.",
  inputs: [N("B", "Diamètre des pieux", "m", 1, "B"), N("d", "Entraxe", "m", 2.6, "d"), N("m", "Nombre de rangées", "U", 1, "m"), N("n", "Pieux par rangée", "U", 5, "n")],
  calc(I) {
    const Ce = 1 - atan(I.B / I.d) / (PI / 2) * (2 - 1 / I.m - 1 / I.n), C2 = I.d >= 3 * I.B ? 1 : 0.25 * (1 + I.d / I.B);
    return { steps: [S("at", L`\arctan(B/d)`, "", atan(I.B / I.d), "rad", 4), R("Ce", L`C_e^{\,CL}`, L`1 - \dfrac{\arctan(B/d)}{\pi/2}\left(2 - \dfrac{1}{m} - \dfrac{1}{n}\right)`, Ce, "", 4),
      R("C2", L`C_e^{\,2.5.1}`, I.d >= 3 * I.B ? L`1 \quad (d \ge 3B)` : L`0{,}25\left(1 + \dfrac{d}{B}\right)`, C2, "", 4)],
      notes: ["CL : méthode de Converse-Labarre (§2.2)."] };
  } },

{ id: "groupe-h", cat: "Fondations", t: "Effet de groupe horizontal : minorations", ref: "Fascicule 62 titre V — annexe G.1",
  desc: "Coefficients de minoration de la loi de réaction latérale d'un pieu dans un groupe.",
  inputs: [N("B", "Diamètre (ou largeur)", "m", 1.2, "B"), N("Ex", "Entraxe selon X", "m", 2.68, L`E_x`), N("Ey", "Entraxe selon Y", "m", 3.6, L`E_y`),
    N("nx", "Nombre de files (sens X)", "U", 3, L`n_x`), N("ny", "Nombre de files (sens Y)", "U", 2, L`n_y`), N("a", "Coefficient rhéologique", "", 0.5, L`\alpha`)],
  calc(I) {
    const ax = I.Ex - I.B, ay = I.Ey - I.B, r0 = n => (I.a + 4 / 3 * pow(2.65, I.a)) / (n * I.a + 4 / 3 * pow(2.65 * n, I.a));
    const r0x = r0(I.nx), r0y = r0(I.ny);
    const Kx = ay >= 2 * I.B ? 1 : ay / (2 * I.B) + r0x * (1 - ay / (2 * I.B)), Rfx = ax >= 2 * I.B ? 1 : ax / (2 * I.B);
    const Ky = ax >= 2 * I.B ? 1 : ax / (2 * I.B) + r0y * (1 - ax / (2 * I.B)), Rfy = ay >= 2 * I.B ? 1 : ay / (2 * I.B);
    return { steps: [S("ax", L`a_x`, L`E_x - B`, ax, "m", 3), S("ay", L`a_y`, L`E_y - B`, ay, "m", 3),
      S("r0x", L`\rho_{0,x}`, L`\dfrac{\alpha + \frac{4}{3}\,2{,}65^{\alpha}}{n_x\,\alpha + \frac{4}{3}\,(2{,}65\,n_x)^{\alpha}}`, r0x, "", 4), S("r0y", L`\rho_{0,y}`, "~idem avec $n_y$", r0y, "", 4),
      R("Kx", L`K_x`, L`\dfrac{a_y}{2B} + \rho_{0,x}\left(1 - \dfrac{a_y}{2B}\right)\ \ \text{si } a_y < 2B`, Kx, "", 4), R("Rfx", L`R_{f,x}`, L`\dfrac{a_x}{2B}\ \ \text{si } a_x < 2B`, Rfx, "", 4),
      R("Ky", L`K_y`, L`\dfrac{a_x}{2B} + \rho_{0,y}\left(1 - \dfrac{a_x}{2B}\right)`, Ky, "", 4), R("Rfy", L`R_{f,y}`, L`\dfrac{a_y}{2B}`, Rfy, "", 4)],
      notes: ["K : minoration perpendiculaire au déplacement (SPD) ; $R_f$ : dans le sens du déplacement (SD). Valeur 1 si l'espacement libre dépasse 2B. La sensibilité à α est très faible (α = 1 est le plus défavorable)."], fig: figGroupe(I.nx, I.ny) };
  } },

{ id: "barrettes", cat: "Fondations", t: "Barrettes : loi de réaction latérale", ref: "Fascicule 62 titre V — annexes C.5, E.1 et G.1",
  desc: "Raideurs frontale et tangentielle, paliers, pour un élément isolé puis en groupe, dans les deux sens.",
  inputs: [H("Sol"), N("pf", "Pression de fluage", "MPa", 3.18, L`p_f`), N("EM", "Module pressiométrique", "MPa", 67.39, L`E_M`), N("pl", "Pression limite nette", "MPa", 4.35, L`p_l^*`),
    N("a", "Coefficient rhéologique", "", 0.67, L`\alpha`), N("qs", "Frottement latéral", "MPa", 0.04, L`q_s`),
    H("Barrettes"), N("B", "Épaisseur", "m", 1, "B"), N("L", "Longueur", "m", 2.7, "L"), N("Ex", "Entraxe selon X", "m", 4.7, L`E_x`), N("Ey", "Entraxe selon Y", "m", 3.6, L`E_y`),
    N("nX", "Files ⊥ au déplacement X", "U", 3, L`n_X`), N("nY", "Files ⊥ au déplacement Y", "U", 2, L`n_Y`), N("B0", "Largeur de référence", "m", 0.6, L`B_0`)],
  calc(I) {
    const r0 = n => (I.a + 4 / 3 * pow(2.65, I.a)) / (n * I.a + 4 / 3 * pow(2.65 * n, I.a));
    const sens = (B, Lx, a, b, n) => {
      const Ls = max(0, Lx - B), Kf = 12000 * I.EM / (4 / 3 * I.B0 / B * pow(2.65 * B / I.B0, I.a) + I.a), Rf = 1000 * B * I.pf, Rs = 1000 * 2 * Ls * I.qs, Ks = Rs === 0 ? 0 : Kf;
      const mx = max(B, Lx), SD = { Kf: 1, Rf: a >= 2 * mx ? 1 : a / (2 * mx), Ks: 1, Rs: 1 }, ro = r0(n);
      const SPD = { Kf: b >= 2 * B ? 1 : b / (2 * B) + ro * (1 - b / (2 * B)), Rf: 1, Ks: b < 2 * B ? 0 : 1, Rs: b >= 2 * Lx ? 1 : (b - 2 * B) / (2 * (Lx - B)) };
      const g = { Kf: SD.Kf * SPD.Kf * Kf, Rf: SD.Rf * SPD.Rf * Rf, Ks: SD.Ks * SPD.Ks * Ks, Rs: SD.Rs * SPD.Rs * Rs };
      const law = (Kf, Rf, Ks, Rs) => ({ K1: Kf + Ks, K2: Kf, R1: 2 * min(Rf, Rs), R2: Rf + Rs });
      return { Kf, Rf, Rs, Ks, SD, SPD, ro, iso: law(Kf, Rf, Ks, Rs), grp: law(g.Kf, g.Rf, g.Ks, g.Rs), g, B };
    };
    const X = sens(I.B, I.L, I.Ex - I.L, I.Ey - I.B, I.nX), Y = sens(I.L, I.B, I.Ey - I.B, I.Ex - I.L, I.nY);
    const row = (l, f) => [l, f(X), f(Y)];
    return { steps: [], vals: { KfX: X.Kf, RfX: X.Rf, RsX: X.Rs, R1X: X.iso.R1, R2X: X.iso.R2, SDRfX: X.SD.Rf, r0X: X.ro, SPDRsX: X.SPD.Rs, gRfX: X.g.Rf, gRsX: X.g.Rs, gR1X: X.grp.R1, gR2X: X.grp.R2,
        KfY: Y.Kf, RfY: Y.Rf, SDRfY: Y.SD.Rf, r0Y: Y.ro, SPDKfY: Y.SPD.Kf, gKfY: Y.g.Kf, gRfY: Y.g.Rf, gR2Y: Y.grp.R2, gK1Yb: Y.grp.K1 / Y.B },
      tables: [
        { title: "Élément isolé", head: ["", "Sens X", "Sens Y"], rows: [
          row("$K_f = \\dfrac{12\\,000\\,E_M}{\\frac{4}{3}\\frac{B_0}{B}\\left(2{,}65\\frac{B}{B_0}\\right)^{\\alpha} + \\alpha}$ (kN/m/m)", s => s.Kf), row("$R_f = B\\,p_f$ (kN/m)", s => s.Rf),
          row("$R_s = 2\\,(L - B)\\,q_s$ (kN/m)", s => s.Rs), row("$K_1 = K_f + K_s$ (kN/m/m)", s => s.iso.K1),
          row("$R_1 = 2\\min(R_f, R_s)$ (kN/m)", s => s.iso.R1), row("$R_2 = R_f + R_s$ (kN/m)", s => s.iso.R2)], d: [0, 0] },
        { title: "Minorations de groupe", head: ["", "Sens X", "Sens Y"], rows: [
          row("SD : $R_f = \\dfrac{a}{2\\max(B, L)}$", s => s.SD.Rf), row("$\\rho_0$ ($n$ files)", s => s.ro), row("SPD : $K_f$", s => s.SPD.Kf),
          row("SPD : $K_s$", s => s.SPD.Ks), row("SPD : $R_s = \\dfrac{b - 2B}{2\\,(L - B)}$", s => s.SPD.Rs)], d: [3, 3] },
        { title: "Loi finale en groupe (instantané ; différé = K/2)", head: ["", "Sens X", "Sens Y"], rows: [
          row("$K_1$ (kN/m/m)", s => s.grp.K1), row("$K_2$ (kN/m/m)", s => s.grp.K2), row("$R_1$ (kN/m)", s => s.grp.R1), row("$R_2$ (kN/m)", s => s.grp.R2),
          row("$K_1/B$ (kN/m³)", s => s.grp.K1 / s.B), row("$R_2/B$ (kN/m²)", s => s.grp.R2 / s.B)], d: [0, 0] }],
      notes: ["Sens X : B = épaisseur, L = longueur ; sens Y : rôles inversés. $a_x = E_x - L$, $a_y = E_y - B$."], fig: figBarrettes(I) };
  } },

{ id: "barrettes-sis", cat: "Fondations", t: "Barrettes : raideur sismique", ref: "AFPS 92 — module dynamique du sol",
  desc: "Raideur latérale du sol en situation sismique.",
  inputs: [N("Vs", "Vitesse des ondes de cisaillement", "m/s", 400, L`V_s`), N("rho", "Masse volumique du sol", "kg/m³", 2200, L`\rho`),
    N("kG", "Coefficient de réduction de G", "", 0.436, L`G/G_{max}`), N("nu", "Coefficient de Poisson", "", 0.3, L`\nu`),
    N("B", "Épaisseur de la barrette", "m", 1, "B"), N("L", "Longueur de la barrette", "m", 2.7, "L")],
  calc(I) {
    const Gm = I.rho * I.Vs ** 2 / 1e6, G = Gm * I.kG, Es = 2000 * (1 + I.nu) * G, K = 1.2 * Es;
    return { steps: [S("Gm", L`G_{max}`, L`\rho\,V_s^2`, Gm, "MPa", 1), S("G", "G", L`G_{max}\cdot\dfrac{G}{G_{max}}`, G, "MPa", 2),
      S("Es", L`E_s`, L`2\,(1 + \nu)\,G`, Es, "kN/m²", 0), R("K", "K", L`1{,}2\,E_s`, K, "kN/m²", 0),
      R("KX", L`k_X`, L`\dfrac{K}{B}`, K / I.B, "kN/m³", 0), R("KY", L`k_Y`, L`\dfrac{K}{L}`, K / I.L, "kN/m³", 0)],
      notes: ["Le palier à retenir est celui issu du calcul statique (page Barrettes : loi de réaction latérale)."] };
  } },

{ id: "barrettes-min-sis", cat: "Fondations", t: "Barrettes : minimums sismiques", ref: "Guide SNCF-SETRA (relatif à l'AFPS 92)",
  desc: "Sections minimales et maximales d'armatures longitudinales et transversales.",
  inputs: [N("e", "Épaisseur", "m", 1, "e"), N("B", "Longueur", "m", 2.7, "B"), H("Transversal Ft1 (sens e)"), N("A1", "Section posée (2 brins)", "cm²", 4.02, L`A_1`), N("s1", "Espacement", "m", 0.15, L`s_1`),
    H("Transversal Ft2 (sens B)"), N("A2", "Section posée", "cm²", 12.32, L`A_2`), N("s2", "Espacement", "m", 0.15, L`s_2`)],
  calc(I) {
    const Sb = I.e * I.B, Amin = Sb < 1 ? 0.5 / 100 * Sb * 1e4 : Sb > 2 ? 0.25 / 100 * Sb * 1e4 : 50, Amax = 3 / 100 * Sb * 1e4;
    const t1 = 0.1 / 100 * I.e * 1e4, t2 = 0.1 / 100 * I.B * 1e4, p1 = I.A1 / I.s1, p2 = I.A2 / I.s2;
    return { steps: [S("S", "S", L`e\,B`, Sb, "m²", 3), R("Amin", L`A_{L,min}`, Sb < 1 ? L`0{,}5\ \%\ S` : Sb > 2 ? L`0{,}25\ \%\ S` : L`50\ \text{cm}^2`, Amin, "cm²", 1), R("Amax", L`A_{L,max}`, L`3\ \%\ S`, Amax, "cm²", 1),
      S("t1", L`(A/s)_{t1,min}`, L`0{,}1\ \%\ e`, t1, "cm²/ml", 1), S("p1", L`A_1/s_1`, "~section posée", p1, "cm²/ml", 2),
      S("t2", L`(A/s)_{t2,min}`, L`0{,}1\ \%\ B`, t2, "cm²/ml", 1), S("p2", L`A_2/s_2`, "~section posée", p2, "cm²/ml", 2),
      S("zc", L`l_{crit}`, L`2{,}5\,e`, 2.5 * I.e, "m", 2)],
      checks: [C("Ft1 : $A_1/s_1 \\ge 0{,}1\\ \\%\\ e$", p1 >= t1, `${fmt(p1, 1)} ≥ ${fmt(t1, 1)}`), C("Ft2 : $A_2/s_2 \\ge 0{,}1\\ \\%\\ B$", p2 >= t2, `${fmt(p2, 1)} ≥ ${fmt(t2, 1)}`)],
      notes: ["$l_{crit}$ : zone critique haute. Espacement maximal des barres longitudinales et transversales : 30 cm."] };
  } },

{ id: "inclusions", cat: "Fondations", t: "Inclusions rigides sous remblai", ref: "Vérification simplifiée (béton et portance)",
  desc: "Effort en tête d'une inclusion, résistance du béton et capacité portante.",
  inputs: [H("Charges"), N("Hr", "Hauteur du remblai", "m", 7, "H"), N("g", "Poids volumique du remblai", "kN/m³", 20, L`\gamma`), N("q", "Surcharge d'exploitation", "kPa", 30, "q"),
    N("ma", "Maille a", "m", 2, "a"), N("mb", "Maille b", "m", 2, "b"), N("Fn", "Frottement négatif", "MN", 0.379, L`F_n`),
    H("Inclusion"), N("D", "Diamètre", "m", 0.6, L`\varnothing`), N("fc", "Résistance de calcul du béton", "MPa", 20.84, L`f_c`), N("As", "Ferraillage", "cm²", 16.08, L`A_s`),
    H("Sol"), N("ple", "Pression limite en pointe", "MPa", 2.5, L`p_{le}^*`), N("kp", "Facteur de portance", "", 1.2, L`k_p`),
    N("L1", "Longueur L1", "m", 5, L`L_1`), N("qs1", "Frottement qs1", "MPa", 0.04, L`q_{s1}`), N("L2", "Longueur L2", "m", 2, L`L_2`), N("qs2", "Frottement qs2", "MPa", 0.12, L`q_{s2}`), N("Fs", "Coefficient de sécurité", "", 1.5, L`F_s`)],
  calc(I) {
    const s = I.Hr * I.g / 1000 + I.q / 1000, Am = I.ma * I.mb, F1 = s * Am + I.Fn, Ai = PI * I.D ** 2 / 4, s1 = F1 / Ai, s2 = 0.3 * I.fc;
    const Qp = I.kp * I.ple * Ai, Qs = PI * I.D * (I.L1 * I.qs1 + I.L2 * I.qs2), Q = Qp + Qs, F2 = Q / I.Fs;
    return { steps: [S("s", L`\sigma`, L`\gamma\,H + q`, s, "MPa", 3), S("F0", L`\sigma\,a\,b`, "", s * Am, "MN", 3), R("F1", L`F_1`, L`\sigma\,a\,b + F_n`, F1, "MN", 3),
      S("Ai", "A", L`\dfrac{\pi\,\varnothing^2}{4}`, Ai, "m²", 4), R("s1", L`\sigma_1`, L`\dfrac{F_1}{A}`, s1, "MPa", 2), S("s2", L`\sigma_2`, L`0{,}3\,f_c`, s2, "MPa", 2),
      S("Qp", L`Q_{pu}`, L`k_p\,p_{le}^*\,A`, Qp, "MN", 3), S("Qs", L`Q_{su}`, L`\pi\,\varnothing\,\textstyle\sum L_i\,q_{si}`, Qs, "MN", 3), S("Q", L`Q_u`, L`Q_{pu} + Q_{su}`, Q, "MN", 3),
      R("F2", L`F_2`, L`\dfrac{Q_u}{F_s}`, F2, "MN", 3), S("rho", L`\rho_s`, L`\dfrac{A_s}{A}`, I.As / 1e4 / Ai * 100, "%", 3)],
      checks: [C("Béton : $\\sigma_1 \\le 0{,}3\\,f_c$", s1 < s2, `${fmt(s1, 2)} ≤ ${fmt(s2, 2)} MPa`), C("Portance : $F_1 \\le Q_u/F_s$", F1 < F2, `${fmt(F1, 3)} ≤ ${fmt(F2, 3)} MN`)] };
  } },

/* ══════════════ SÉISME ══════════════ */
{ id: "spectre-ec8", cat: "Séisme", t: "Spectres de réponse élastiques", ref: "NF EN 1998-1 — §3.2.2.2 et §3.2.2.3",
  desc: "Spectres horizontal et vertical, accélérations de calcul et valeurs de plateau.",
  inputs: [SEL("ref", "Référentiel", Object.entries(SPECTRES).map(([k, v]) => [k, v.n]).concat([["perso", "Personnalisé (paramètres ci-dessous)"]]), "FR", ""),
    SEL("sol", "Classe de sol", [["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"]], "E", ""),
    N("agr", "Accélération de référence", "m/s²", 0.981, L`a_{gR}`), N("gI", "Coefficient d'importance", "", 1, L`\gamma_I`), N("ST", "Amplification topographique", "", 1, L`S_T`),
    N("xi", "Amortissement", "%", 5, L`\xi`), N("avr", "Rapport vertical / horizontal", "", 0.9, L`a_{vg}/a_g`), N("yt", "Coefficient ELS (séisme de service)", "", 0.585, L`\gamma_{ELS}`),
    H("Personnalisé"), N("S", "Paramètre de sol", "", 1.8, "S"), N("TB", "Période TB", "s", 0.08, L`T_B`), N("TC", "Période TC", "s", 0.45, L`T_C`), N("TD", "Période TD", "s", 1.25, L`T_D`)],
  calc(I) {
    const P = I.ref === "perso" ? null : SPECTRES[I.ref];
    const [Sx, TB, TC, TD] = P ? P[I.sol] : [I.S, I.TB, I.TC, I.TD];
    const [vB, vC, vD] = P ? P.v : [0.03, 0.2, 2.5];
    const ag = I.agr * I.gI * I.ST, eta = max(sqrt(10 / (5 + I.xi)), 0.55), avg = I.avr * ag;
    const pts = []; for (let T = 0; T <= 4.0001; T += 0.02) pts.push([T, seH(T, Sx, TB, TC, TD, eta) * ag, seV(T, vB, vC, vD, eta) * avg]);
    const tab = [0, TB, TC, 0.55, TD, 2, 3, 4].map(T => [T, seH(T, Sx, TB, TC, TD, eta), seH(T, Sx, TB, TC, TD, eta) * ag, seV(T, vB, vC, vD, eta) * avg]);
    return { steps: [S("ag", L`a_g`, L`\gamma_I\,a_{gR}\,S_T`, ag, "m/s²", 3), S("agg", "", "~soit", ag / 9.81, "g", 4),
      S("par", L`S\,/\,T_B\,/\,T_C\,/\,T_D`, P ? `~${P.n}, sol ${I.sol}` : "~personnalisé", `${fmt(Sx, 2)} / ${fmt(TB, 2)} / ${fmt(TC, 2)} / ${fmt(TD, 2)} s`, "", 0),
      S("eta", L`\eta`, L`\sqrt{\dfrac{10}{5 + \xi}} \ge 0{,}55`, eta, "", 3),
      S("Se", L`S_e(T)`, L`a_g\,S\,\eta\,2{,}5\;\cdot\;\left\{1\,;\ \tfrac{T_C}{T}\,;\ \tfrac{T_C T_D}{T^2}\right\}`, "", "", 0),
      R("plH", L`S_{e,max}`, L`2{,}5\,a_g\,S\,\eta`, ag * Sx * eta * 2.5, "m/s²", 3), R("plV", L`S_{ve,max}`, L`3\,a_{vg}\,\eta`, avg * eta * 3, "m/s²", 3),
      S("plELS", L`S_{e,max}^{ELS}`, L`\gamma_{ELS}\,S_{e,max}`, ag * Sx * eta * 2.5 * I.yt, "m/s²", 3)],
      tables: [{ title: "Valeurs remarquables", head: ["T (s)", "$S_e/a_g$", "$S_e$ (m/s²)", "$S_{ve}$ (m/s²)"], rows: tab, d: [3, 3, 3] }],
      fig: figSpectre(pts), curve: pts, vals: { r055: seH(0.55, Sx, TB, TC, TD, eta), r2: seH(2, Sx, TB, TC, TD, eta) } };
  } },
];

/* ─── Tableaux et figures partagés ─── */
function fmt(v, d = 2) { if (typeof v !== "number") return v; return v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function cfTable(L, f, full) {
  const a = -4 * f / L ** 2, b = 4 * f / L, xs = full ? [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1] : [0, .1, .2, .3, .4, .5];
  return { title: "Contre-flèche au dixième de portée", head: ["x/L", ...xs.map(x => fmt(x, 1))], rows: [["x (m)", ...xs.map(x => x * L)], ["CF (mm)", ...xs.map(x => a * (x * L) ** 2 + b * x * L)]],
    d: xs.map(() => 1), key: Object.fromEntries(xs.map((x, i) => ["cf" + Math.round(x * 10), [1, i + 1]])) };
}
const INK = "currentColor";
function svg(w, h, body) { return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-height:100%" fill="none" stroke="${INK}" stroke-width="1.2" font-family="Outfit,sans-serif" font-size="11">${body}</svg>`; }
function figParabole(L, f) {
  return svg(320, 110, `<path d="M20 80 H300" stroke-dasharray="4 3" opacity=".5"/><path d="M20 80 Q160 ${80 - 120} 300 80" stroke="var(--gold,#a07828)" stroke-width="2"/>
  <path d="M20 80 l-7 12 h14z M300 80 l-7 12 h14z" fill="${INK}" opacity=".5"/><path d="M160 80 V22" stroke-dasharray="2 2"/><text x="166" y="50" fill="${INK}" stroke="none">f = ${fmt(f, 0)} mm</text>
  <text x="150" y="104" fill="${INK}" stroke="none">L = ${fmt(L, 2)} m</text>`);
}
function figSectionMixte(I, vm, va) {
  const Ht = I.H + I.hr + I.hh, W = max(I.bh, I.bs, I.bi), sc = min(260 / W, 150 / Ht), cx = 150, y0 = 165;
  const r = (b, h, z, fill) => `<rect x="${cx - b * sc / 2}" y="${y0 - (z + h) * sc}" width="${b * sc}" height="${h * sc}" fill="${fill}" stroke-width=".8"/>`;
  const hw = I.H - I.ts - I.ti;
  return svg(300, 180, r(I.bi, I.ti, 0, "#8aa4c8") + r(I.tw, hw, I.ti, "#8aa4c8") + r(I.bs, I.ts, I.ti + hw, "#8aa4c8") + r(I.br, I.hr, I.H, "#d9d4c7") + r(I.bh, I.hh, I.H + I.hr, "#d9d4c7") +
    `<path d="M10 ${y0 - vm * 10 * sc} H290" stroke="var(--gold,#a07828)" stroke-dasharray="5 3"/><text x="12" y="${y0 - vm * 10 * sc - 4}" fill="var(--gold,#a07828)" stroke="none">G mixte</text>
     <path d="M60 ${y0 - va * 10 * sc} H240" stroke="#1a4fd6" stroke-dasharray="2 3"/><text x="244" y="${y0 - va * 10 * sc + 4}" fill="#1a4fd6" stroke="none">G acier</text>`);
}
function figConsole() { return svg(200, 130, `<path d="M40 120 H160" stroke-width="2"/><path d="M50 120 l-8 8 M70 120 l-8 8 M90 120 l-8 8 M110 120 l-8 8 M130 120 l-8 8 M150 120 l-8 8" opacity=".5"/><rect x="90" y="20" width="20" height="100" fill="#d9d4c7"/><path d="M150 22 H112" stroke="#c0392b" stroke-width="1.6"/><path d="M118 17 l-6 5 6 5" stroke="#c0392b"/><text x="152" y="26" fill="#c0392b" stroke="none">F</text><path d="M80 20 V120" stroke-dasharray="2 2" opacity=".6"/><text x="56" y="74" fill="${INK}" stroke="none">H</text><path d="M100 120 Q103 60 124 20" stroke="var(--gold,#a07828)" stroke-dasharray="4 2"/><text x="126" y="44" fill="var(--gold,#a07828)" stroke="none">u</text>`); }
function figMur() { return svg(200, 140, `<path d="M30 130 H170" stroke-width="2"/><rect x="60" y="15" width="16" height="115" fill="#d9d4c7"/><path d="M76 15 L76 130 L150 130 Z" fill="#c95c7a22" stroke="#c95c7a"/><text x="112" y="100" fill="#c95c7a" stroke="none">K<tspan font-size="8" dy="2">a</tspan><tspan dy="-2">γz</tspan></text><path d="M76 15 h26 v115" stroke="#1a4fd6" stroke-dasharray="3 2"/><text x="100" y="12" fill="#1a4fd6" stroke="none">K<tspan font-size="8" dy="2">a</tspan><tspan dy="-2">q</tspan></text><path d="M68 130 Q66 70 52 15" stroke="var(--gold,#a07828)" stroke-dasharray="4 2"/>`); }
function figTube(D, e) { const R = 60, r = R * (D - 2 * e) / D; return svg(200, 140, `<circle cx="100" cy="70" r="${R}" fill="#d9d4c7"/><circle cx="100" cy="70" r="${r}" fill="var(--bg,#f9f8f5)"/><path d="M100 70 H160" stroke-dasharray="2 2"/><text x="122" y="66" fill="${INK}" stroke="none">R</text><path d="M40 70 H60" stroke="#c0392b" stroke-width="2"/><text x="20" y="135" fill="${INK}" stroke="none">τ max sur l'axe neutre</text>`); }
function figLevage(cro) { return svg(320, 100, `<rect x="20" y="40" width="280" height="22" fill="#d9d4c7"/><path d="M${cro ? 60 : 40} 40 V12 M${cro ? 260 : 280} 40 V12" stroke="#c0392b" stroke-width="1.6"/><path d="M${cro ? 60 : 40} 12 L160 4 L${cro ? 260 : 280} 12" stroke-dasharray="3 2"/><text x="${cro ? 26 : 30}" y="78" fill="${INK}" stroke="none">${cro ? "a" : "about"}</text><text x="150" y="78" fill="${INK}" stroke="none">${cro ? "L<tspan font-size='8'>c</tspan>" : "L poutre"}</text>${cro ? '<path d="M20 70 H60 M60 66 v8 M20 66 v8" stroke-width=".8"/>' : ""}`); }
function figAA(layers) { let y = 10, b = ""; const tot = layers.reduce((s, l) => s + l[1], 0) + (layers.length - 1) * 3, k = 110 / tot;
  layers.forEach(([p, t], i) => { b += `<rect x="40" y="${y}" width="140" height="${t * k}" fill="${p === "Ext" ? "#3c3f4d33" : "#3c3f4d55"}" stroke="none"/>`; y += t * k; if (i < layers.length - 1) { b += `<rect x="36" y="${y}" width="148" height="${3 * k}" fill="#8aa4c8" stroke="none"/>`; y += 3 * k; } });
  return svg(260, 130, b + `<text x="188" y="20" fill="${INK}" stroke="none" font-size="9">élastomère</text><text x="188" y="34" fill="#8aa4c8" stroke="none" font-size="9">frettes</text>`); }
function figCourbon(n, e, bp, et) { const w = 280, x0 = 20, dx = w / max(1, n - 1); let b = `<path d="M10 30 H310" stroke-width="3"/>`;
  for (let i = 0; i < n; i++) { const x = x0 + i * dx; b += `<rect x="${x - 5}" y="30" width="10" height="26" fill="#d9d4c7"/><text x="${x - 10}" y="110" fill="${INK}" stroke="none" font-size="9">${fmt(et[i], 3)}</text><path d="M${x} 70 v${-et[i] * 0 + 0}"/><rect x="${x - 6}" y="${98 - et[i] * 80}" width="12" height="${et[i] * 80}" fill="var(--gold,#a07828)" opacity=".5" stroke="none"/>`; }
  const xc = 160 - e / (bp * (n - 1)) * w; return svg(320, 118, b + `<path d="M${xc} 2 V28" stroke="#c0392b" stroke-width="1.6"/><path d="M${xc - 4} 22 l4 6 4-6" stroke="#c0392b"/><text x="${xc + 4}" y="12" fill="#c0392b" stroke="none">e</text>`); }
function figGroupe(nx, ny) { let b = ""; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) b += `<circle cx="${50 + i * 50}" cy="${30 + j * 45}" r="11" fill="#d9d4c7"/>`;
  return svg(260, 40 + ny * 45, b + `<path d="M${60 + nx * 50} 30 h30" stroke="#c0392b"/><path d="M${84 + nx * 50} 26 l6 4-6 4" stroke="#c0392b"/><text x="${66 + nx * 50}" y="22" fill="#c0392b" stroke="none">X</text>`); }
function figBarrettes(I) { const k = 22; let b = ""; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b += `<rect x="${20 + i * I.Ex * k}" y="${15 + j * I.Ey * k}" width="${I.L * k}" height="${I.B * k}" fill="#d9d4c7"/>`;
  return svg(40 + 2 * I.Ex * k + I.L * k, 30 + I.Ey * k + I.B * k, b + `<text x="${20 + I.L * k / 2 - 4}" y="${12}" fill="${INK}" stroke="none" font-size="9">L</text><text x="${24 + I.L * k}" y="${15 + I.B * k / 2 + 3}" fill="${INK}" stroke="none" font-size="9">B</text>`); }
function figSpectre(pts) {
  const W = 330, Hh = 150, mx = max(...pts.map(p => max(p[1], p[2]))) * 1.1, X = t => 34 + t / 4 * (W - 44), Y = v => Hh - 20 - v / mx * (Hh - 34);
  const line = i => pts.map((p, k) => (k ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[i]).toFixed(1)).join("");
  let grid = ""; for (let t = 0; t <= 4; t++) grid += `<path d="M${X(t)} ${Y(0)} V${Y(mx)}" opacity=".12"/><text x="${X(t) - 3}" y="${Hh - 6}" fill="${INK}" stroke="none" font-size="9">${t}</text>`;
  const st = mx > 6 ? 2 : 1; for (let v = 0; v <= mx; v += st) grid += `<path d="M${X(0)} ${Y(v)} H${X(4)}" opacity=".12"/><text x="6" y="${Y(v) + 3}" fill="${INK}" stroke="none" font-size="9">${v}</text>`;
  return svg(W, Hh, grid + `<path d="${line(1)}" stroke="var(--gold,#a07828)" stroke-width="2"/><path d="${line(2)}" stroke="#1a4fd6" stroke-width="1.4" stroke-dasharray="5 3"/>
   <text x="${W - 120}" y="16" fill="var(--gold,#a07828)" stroke="none">— horizontal S<tspan font-size="8" dy="2">e</tspan></text><text x="${W - 120}" y="30" fill="#1a4fd6" stroke="none" dy="0">-- vertical S<tspan font-size="8" dy="2">ve</tspan></text>
   <text x="${W - 34}" y="${Hh - 6}" fill="${INK}" stroke="none" font-size="9">T (s)</text>`);
}

const api = { CALCS, fmt, elsRect, seH, seV, SPECTRES, BOULONS };
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HANDBAG = api;
})(typeof window !== "undefined" ? window : globalThis);
