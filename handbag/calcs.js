/* ════════════════════════════════════════════════════════════════════
   HandBag — calculs usuels d'ouvrages d'art (KLE Ingénierie)
   Repris des classeurs « Hand-Bag » (2019-2024) et revalidés.
   Chaque calcul : { id, cat, t (titre), ref, desc, inputs[], calc(I) }
   calc(I) renvoie { steps[], tables[], checks[], notes[], fig? }
   step  = { k, s, f, v, u, d, r }  (clé, symbole, expression, valeur, unité, décimales, résultat principal)
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";

const PI = Math.PI, sqrt = Math.sqrt, pow = Math.pow, exp = Math.exp, min = Math.min, max = Math.max, abs = Math.abs, atan = Math.atan;
const S = (k, s, f, v, u = "", d = 3, r = false) => ({ k, s, f, v, u, d, r });
const R = (k, s, f, v, u = "", d = 3) => S(k, s, f, v, u, d, true);
const C = (l, ok, txt = "") => ({ l, ok, txt });
const N = (k, l, u, v, s, extra = {}) => Object.assign({ k, l, u, v, s: s || k, t: "num" }, extra);
const SEL = (k, l, o, v, s) => ({ k, l, o, v, s: s || k, t: "sel" });
const H = (h) => ({ h });
const sub = (a, b) => `${a}<sub>${b}</sub>`;

/* — Section rectangulaire BA à l'ELS (flexion simple, n = 15) — */
function elsRect(M_kNm, b, h, c, As_cm2, n = 15) {
  const d = h - c, As = As_cm2 / 1e4, M = abs(M_kNm) / 1000;           // MN.m
  // b·y²/2 = n·As·(d − y)
  const A = b / 2, B = n * As, Cc = -n * As * d;
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

/* — Boulons : aire résistante As (mm²) — */
const BOULONS = { M12: 84.3, M14: 115, M16: 157, M18: 192, M20: 245, M22: 303, M24: 353, M27: 459, M30: 561, M33: 694, M36: 817 };
const ACIER_HA = Object.fromEntries([6, 8, 10, 12, 14, 16, 20, 25, 32, 40].map(d => [d, PI * (d / 10) ** 2 / 4]));   // cm²
const EC2_CUBE = { 12: 15, 16: 20, 20: 25, 25: 30, 30: 37, 35: 45, 40: 50, 45: 55, 50: 60, 55: 67, 60: 75, 70: 85, 80: 95, 90: 105 };

const CALCS = [

/* ══════════════ MATÉRIAUX ══════════════ */
{ id: "beton-bael", cat: "Matériaux", t: "Béton : caractéristiques à j jours", ref: "BAEL 91 mod. 99 — A.2.1 / A.2.1.2",
  desc: "Résistances et modules du béton à 28 jours et à l'âge j.",
  inputs: [N("fc28", "Résistance à 28 jours", "MPa", 35, sub("f", "c28")), N("j", "Âge du béton", "jours", 3)],
  calc(I) {
    const { fc28, j } = I;
    const fcj = j >= 28 ? fc28 : (fc28 <= 40 ? j / (4.76 + 0.83 * j) : j / (1.40 + 0.95 * j)) * fc28;
    const f28 = { ft: 0.6 + 0.06 * fc28, tu: 0.07 * fc28 / 1.5, Ei: 11000 * Math.cbrt(fc28), Ev: 3700 * Math.cbrt(fc28) };
    const fj = { ft: 0.6 + 0.06 * fcj, tu: 0.07 * fcj / 1.5, Ei: 11000 * Math.cbrt(fcj), Ev: 3700 * Math.cbrt(fcj) };
    return {
      steps: [
        R("fcj", sub("f", "cj"), j >= 28 ? `f<sub>c28</sub> (j ≥ 28 j)` : (fc28 <= 40 ? "j / (4,76 + 0,83 j) · f<sub>c28</sub>" : "j / (1,40 + 0,95 j) · f<sub>c28</sub>"), fcj, "MPa", 2),
        S("ftj", sub("f", "tj"), "0,6 + 0,06 f<sub>cj</sub>", fj.ft, "MPa", 3),
        S("tuj", "0,07 f<sub>cj</sub>/γ<sub>b</sub>", "0,07 f<sub>cj</sub> / 1,5", fj.tu, "MPa", 3),
        S("Eij", sub("E", "ij"), "11 000 · f<sub>cj</sub><sup>1/3</sup>", fj.Ei, "MPa", 0),
        S("Evj", sub("E", "vj"), "3 700 · f<sub>cj</sub><sup>1/3</sup>", fj.Ev, "MPa", 0),
      ],
      tables: [{ title: "Comparaison 28 jours / j jours", head: ["", "28 jours", `j = ${j} j`, "Rapport"], rows: [
        ["f<sub>c</sub> (MPa)", fc28, fcj, fcj / fc28], ["f<sub>t</sub> (MPa)", f28.ft, fj.ft, fj.ft / f28.ft],
        ["0,07 f<sub>c</sub>/1,5 (MPa)", f28.tu, fj.tu, fj.tu / f28.tu], ["E<sub>i</sub> (MPa)", f28.Ei, fj.Ei, fj.Ei / f28.Ei], ["E<sub>v</sub> (MPa)", f28.Ev, fj.Ev, fj.Ev / f28.Ev]],
        d: [2, 2, 3], pct: 3, key: { ft28: [1, 1], tu28: [2, 1], Ei28: [3, 1], Ev28: [4, 1] } }],
      vals: { ft28: f28.ft, tu28: f28.tu, Ei28: f28.Ei, Ev28: f28.Ev },
      notes: [j >= 28 ? "Pour j ≥ 28 jours, on retient conventionnellement f<sub>cj</sub> = f<sub>c28</sub>." : ""],
    };
  } },

{ id: "beton-ec2", cat: "Matériaux", t: "Béton : propriétés selon l'Eurocode 2", ref: "NF EN 1992-1-1 — §3.1, tableau 3.1",
  desc: "Résistances caractéristiques, modules et contraintes de calcul d'une classe de béton.",
  inputs: [SEL("fck", "Classe de résistance", Object.keys(EC2_CUBE).map(k => [k, `C${k}/${EC2_CUBE[k]}`]), "35", "Classe")],
  calc(I) {
    const fck = +I.fck, fcm = fck + 8;
    const fctm = fck <= 50 ? 0.3 * pow(fck, 2 / 3) : 2.12 * Math.log(1 + fcm / 10);
    const f05 = 0.7 * fctm, f95 = 1.3 * fctm, Ecm = 22000 * pow(fcm / 10, 0.3);
    const ecu2 = fck <= 50 ? 3.5 : 2.6 + 35 * pow((90 - fck) / 100, 4);
    const ec2 = fck <= 50 ? 2.0 : 2.0 + 0.085 * pow(fck - 50, 0.53);
    return {
      steps: [
        S("fck", sub("f", "ck"), "résistance caractéristique sur cylindre", fck, "MPa", 0),
        S("fckc", sub("f", "ck,cube"), "résistance sur cube", EC2_CUBE[fck], "MPa", 0),
        S("fcm", sub("f", "cm"), "f<sub>ck</sub> + 8", fcm, "MPa", 0),
        S("fctm", sub("f", "ctm"), fck <= 50 ? "0,30 · f<sub>ck</sub><sup>2/3</sup>" : "2,12 · ln(1 + f<sub>cm</sub>/10)", fctm, "MPa", 2),
        S("fctk05", sub("f", "ctk,0,05"), "0,70 · f<sub>ctm</sub>", f05, "MPa", 2),
        S("fctk95", sub("f", "ctk,0,95"), "1,30 · f<sub>ctm</sub>", f95, "MPa", 2),
        R("Ecm", sub("E", "cm"), "22 000 · (f<sub>cm</sub>/10)<sup>0,3</sup>", Ecm, "MPa", 0),
        S("Ecv", sub("E", "c,long terme"), "E<sub>cm</sub> / 3,3", Ecm / 3.3, "MPa", 0),
        S("ec2", "ε<sub>c2</sub> / ε<sub>cu2</sub>", "déformations au pic / ultime", `${ec2.toFixed(2).replace(".", ",")} ‰ / ${ecu2.toFixed(2).replace(".", ",")} ‰`, "", 0),
      ],
      tables: [{ title: "Contraintes de calcul", head: ["Situation", "Compression (MPa)", "Traction f<sub>ctd</sub> (MPa)"], rows: [
        ["ELS quasi permanent : 0,45 f<sub>ck</sub>", 0.45 * fck, f05], ["ELS caractéristique : 0,60 f<sub>ck</sub>", 0.6 * fck, f05],
        ["ELU fondamental : f<sub>ck</sub>/1,5", fck / 1.5, f05 / 1.5], ["ELU accidentel : f<sub>ck</sub>/1,2", fck / 1.2, f05 / 1.2],
        ["ELU sismique : f<sub>ck</sub>/1,3", fck / 1.3, f05 / 1.3]], d: [2, 2],
        key: { sQP: [0, 1], sCar: [1, 1], fcdF: [2, 1], fcdA: [3, 1], fcdS: [4, 1], ftdF: [2, 2], ftdA: [3, 2], ftdS: [4, 2] } }],
      notes: ["Coefficient de Poisson : 0,2 (béton non fissuré), 0 (fissuré). Dilatation thermique : α = 10<sup>−5</sup> /°C.",
              "Les contraintes de calcul sont données sans coefficient α<sub>cc</sub> (à appliquer selon l'annexe nationale)."],
    };
  } },

{ id: "retrait-ec2", cat: "Matériaux", t: "Retrait du béton selon l'Eurocode 2", ref: "NF EN 1992-1-1 — §3.1.4 et annexe B",
  desc: "Retrait de dessiccation et retrait endogène à l'âge t.",
  inputs: [N("fck", "Résistance caractéristique", "MPa", 30, sub("f", "ck")), N("RH", "Humidité relative", "%", 70),
    SEL("cim", "Classe de ciment", [["S", "S — prise lente"], ["N", "N — normale"], ["R", "R — rapide"]], "R", "Ciment"),
    N("Ac", "Aire de la section", "m²", 13.07, sub("A", "c")), N("u", "Périmètre exposé", "m", 33.9292),
    N("ts", "Âge au début du séchage", "jours", 0, sub("t", "s")), N("t", "Âge considéré (∞ accepté)", "jours", "∞")],
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
        S("h0", sub("h", "0"), "2 A<sub>c</sub> / u", h0, "mm", 0), S("kh", sub("k", "h"), "tableau 3.3 (interpolé)", kh, "", 3),
        S("bRH", sub("β", "RH"), "1,55 [1 − (RH/100)<sup>3</sup>]", bRH, "", 4),
        S("ecd0", sub("ε", "cd,0"), `0,85 [(220 + 110 α<sub>ds1</sub>) e<sup>−α<sub>ds2</sub> f<sub>cm</sub>/10</sup>] 10<sup>−6</sup> β<sub>RH</sub> — α<sub>ds1</sub> = ${a1}, α<sub>ds2</sub> = ${a2}`, ecd0, "", "e"),
        S("bds", sub("β", "ds") + "(t,t<sub>s</sub>)", "(t − t<sub>s</sub>) / [(t − t<sub>s</sub>) + 0,04 h<sub>0</sub><sup>3/2</sup>]", bds, "", 4),
        S("ecd", sub("ε", "cd") + "(t)", "β<sub>ds</sub> · k<sub>h</sub> · ε<sub>cd,0</sub>", ecd, "", "e"),
        S("ecaInf", sub("ε", "ca") + "(∞)", "2,5 (f<sub>ck</sub> − 10) 10<sup>−6</sup>", ecaInf, "", "e"),
        S("bas", sub("β", "as") + "(t)", "1 − exp(−0,2 t<sup>0,5</sup>)", bas, "", 4),
        S("eca", sub("ε", "ca") + "(t)", "β<sub>as</sub> · ε<sub>ca</sub>(∞)", eca, "", "e"),
        R("ecs", sub("ε", "cs"), "ε<sub>cd</sub> + ε<sub>ca</sub>", ecd + eca, "", "e"),
      ],
      notes: [`Soit un raccourcissement de ${((ecd + eca) * 1e3).toFixed(3).replace(".", ",")} mm/m.`],
    };
  } },

{ id: "retrait-fluage", cat: "Matériaux", t: "Retrait et fluage : évolution dans le temps", ref: "BPEL 91 — art. 2.1.5 et 2.1.6 (loi r(t), f(t))",
  desc: "Part de retrait et de fluage déjà consommée à une date donnée et part restante.",
  inputs: [H("Section"), N("B", "Aire de la section", "m²", 0.963), N("u", "Périmètre au contact de l'air", "m", 7),
    H("Retrait"), N("t", "Âge depuis la fabrication", "jours", 100), N("er", "Retrait à l'infini", "", 4e-4, "ε<sub>r</sub>"),
    H("Fluage"), N("t1", "Âge à la mise en tension", "jours", 28, sub("t", "1")), N("efl", "Fluage à l'infini", "", 3e-4, "ε<sub>fl</sub>")],
  calc(I) {
    const { B, u, t, er, t1, efl } = I;
    const rm = B / u * 100, rt = t / (t + 9 * rm), ft = sqrt(t - t1) / (sqrt(t - t1) + 5 * sqrt(rm));
    const rr = (1 - rt) * er, fr = (1 - ft) * efl;
    return {
      steps: [
        S("rm", sub("r", "m"), "B / u", rm, "cm", 3),
        S("rt", "r(t)", "t / (t + 9 r<sub>m</sub>)", rt, "", 4), S("ert", "ε<sub>r</sub>(t)", "r(t) · ε<sub>r</sub>", rt * er, "", "e"),
        S("rRest", "ε<sub>r</sub> restant", "(1 − r(t)) · ε<sub>r</sub>", rr, "", "e"),
        S("ft", "f(t − t<sub>1</sub>)", "√(t − t<sub>1</sub>) / [√(t − t<sub>1</sub>) + 5 √r<sub>m</sub>]", ft, "", 4),
        S("eflt", "ε<sub>fl</sub>(t)", "f · ε<sub>fl</sub>", ft * efl, "", "e"),
        S("fRest", "ε<sub>fl</sub> restant", "(1 − f) · ε<sub>fl</sub>", fr, "", "e"),
        S("tot", "ε<sub>r</sub> + ε<sub>fl</sub> (∞)", "", er + efl, "", "e"),
        R("rest", "Retrait + fluage restants", "ε<sub>r</sub> restant + ε<sub>fl</sub> restant", rr + fr, "", "e"),
        R("ratio", "Part restante", "restant / total", (rr + fr) / (er + efl), "%", 1),
      ],
      tables: [{ title: "Bilan", head: ["", "Consommé", "Restant"], rows: [["Retrait", rt, 1 - rt], ["Fluage", ft, 1 - ft]], pct: true }],
    };
  } },

{ id: "acier-precontrainte", cat: "Matériaux", t: "Acier de précontrainte : tension initiale", ref: "BPEL 91 — art. 3.3",
  desc: "Tension à l'origine et conversions d'unités usuelles.",
  inputs: [N("fprg", "Contrainte de rupture garantie", "MPa", 1860, sub("f", "prg")), N("fpeg", "Limite élastique garantie", "MPa", 1660, sub("f", "peg")),
    N("Ep", "Module d'élasticité", "MPa", 190000, sub("E", "p")), N("fe", "Acier passif", "MPa", 500, sub("f", "e")), N("fc28", "Béton", "MPa", 35, sub("f", "c28"))],
  calc(I) {
    const c = v => 100 * 10 / 9.81 * v;
    const s0 = min(0.8 * I.fprg, 0.9 * I.fpeg);
    return {
      steps: [R("sp0", "σ<sub>p0</sub>", "min(0,80 f<sub>prg</sub> ; 0,90 f<sub>peg</sub>)", s0, "MPa", 0)],
      tables: [{ title: "Conversions (1 MPa = 101,94 t/m²)", head: ["Grandeur", "MPa", "t/m²"], rows: [
        ["f<sub>prg</sub>", I.fprg, c(I.fprg)], ["f<sub>peg</sub>", I.fpeg, c(I.fpeg)], ["σ<sub>p0</sub>", s0, c(s0)], ["E<sub>p</sub>", I.Ep, c(I.Ep)],
        ["f<sub>e</sub>", I.fe, c(I.fe)], ["f<sub>c28</sub>", I.fc28, c(I.fc28)]], d: [0, 0], key: { fprgT: [0, 2], sp0T: [2, 2], EpT: [3, 2] } }],
    };
  } },

/* ══════════════ SECTIONS ══════════════ */
{ id: "section-mixte", cat: "Sections", t: "Caractéristiques d'une section mixte acier-béton", ref: "Homogénéisation élastique — coefficient n = Ea/Eb",
  desc: "Profilé seul et section mixte homogénéisée (hourdis + renformis).",
  inputs: [H("Béton"), N("bh", "Hourdis : largeur", "mm", 4788, sub("b", "h")), N("hh", "Hourdis : épaisseur", "mm", 200, sub("e", "h")),
    N("br", "Renformis : largeur", "mm", 600, sub("b", "r")), N("hr", "Renformis : hauteur", "mm", 100, sub("e", "r")),
    H("Profilé acier"), N("H", "Hauteur totale du profilé", "mm", 1450), N("bs", "Semelle sup. : largeur", "mm", 700, sub("b", "s")), N("ts", "Semelle sup. : épaisseur", "mm", 65, sub("t", "s")),
    N("tw", "Âme : épaisseur", "mm", 20, sub("t", "w")), N("bi", "Semelle inf. : largeur", "mm", 800, sub("b", "i")), N("ti", "Semelle inf. : épaisseur", "mm", 75, sub("t", "i")),
    H("Équivalence"), N("Ea", "Module de l'acier", "GPa", 210, sub("E", "a")), N("fc", "Résistance du béton", "MPa", 30, sub("f", "cj")),
    SEL("mod", "Module béton", [["i", "Instantané : 11 000 f<sup>1/3</sup>"], ["v", "Différé : 3 700 f<sup>1/3</sup>"]], "i", sub("E", "b"))],
  calc(I) {
    const cm = v => v / 10;
    const hw = I.H - I.ts - I.ti;
    const Eb = (I.mod === "i" ? 11 : 3.7) * Math.cbrt(I.fc), n = I.Ea / Eb;
    const parts = [ // [nom, mat, b(cm), h(cm), z centre /fibre inf. (cm)]
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
        S("hw", sub("h", "w"), "H − t<sub>s</sub> − t<sub>i</sub>", hw, "mm", 0),
        S("Eb", sub("E", "b"), (I.mod === "i" ? "11" : "3,7") + " · f<sub>cj</sub><sup>1/3</sup>", Eb, "GPa", 2),
        S("n", "n", "E<sub>a</sub> / E<sub>b</sub>", n, "", 3),
        R("Aa", sub("A", "a"), "profilé seul", a.A, "cm²", 1), R("va", sub("v", "a,inf"), "CDG / fibre inférieure", a.v, "cm", 2), R("Ia", sub("I", "a"), "Σ (I<sub>g</sub> + A·d²)", a.I, "cm⁴", 0),
        R("Am", sub("A", "m"), "Σ A<sub>acier</sub> + Σ A<sub>béton</sub>/n", m.A, "cm²", 1), R("vm", sub("v", "m,inf"), "CDG / fibre inférieure", m.v, "cm", 2), R("Im", sub("I", "m"), "Σ (I<sub>g</sub> + A·d²)", m.I, "cm⁴", 0),
        S("vms", sub("v", "m,sup"), "h<sub>tot</sub> − v<sub>m,inf</sub>", htot - m.v, "cm", 2),
      ],
      tables: [{ title: "Section mixte homogénéisée", head: ["Élément", "A<sub>éq</sub> (cm²)", "z (cm)", "d (cm)", "I/CDG (cm⁴)"],
        rows: m.rows.map(r => [r.nm, r.A, r.z, r.dz, r.I]), d: [1, 2, 2, 0] }],
      fig: figSectionMixte(I, m.v, a.v),
    };
  } },

{ id: "raideur-appui", cat: "Sections", t: "Inertie équivalente et raideur d'un appui", ref: "RDM — console encastrée u = F H³/(3EI) ; élastomère K = n G A/T",
  desc: "Inertie équivalente déduite d'un déplacement en tête, et raideur horizontale des appareils d'appui.",
  inputs: [H("Fût / appui"), N("H", "Hauteur", "m", 9.5), N("F", "Force horizontale en tête", "kN", 1000), N("u", "Déplacement en tête", "mm", 6.5),
    N("E", "Module du béton", "MPa", 19620, sub("E", "b")),
    H("Appareils d'appui"), N("n", "Nombre d'appareils", "U", 14), N("G", "Module de cisaillement", "MPa", 1.8), N("a", "Dimension a", "m", 0.3), N("b", "Dimension b", "m", 0.4), N("T", "Épaisseur d'élastomère", "m", 0.06)],
  calc(I) {
    const Ieq = I.F * I.H ** 3 / (3 * I.E * 1000 * I.u / 1000), K = I.F / (I.u / 1000), A = I.a * I.b, Ka = 1000 * I.n * I.G * A / I.T;
    return {
      steps: [R("Ieq", sub("I", "éq"), "F H³ / (3 E u)", Ieq, "m⁴", 4), R("K", sub("K", "appui"), "F / u", K, "kN/m", 0),
        S("A", "A", "a · b", A, "m²", 4), R("Kaa", sub("K", "AA"), "n G A / T", Ka, "kN/m", 0), S("Ks", "K<sub>série</sub>", "1 / (1/K<sub>appui</sub> + 1/K<sub>AA</sub>)", 1 / (1 / K + 1 / Ka), "kN/m", 0)],
      fig: figConsole(),
    };
  } },

/* ══════════════ FLÈCHES & ROTATIONS ══════════════ */
{ id: "fleche-prefa", cat: "Flèches & rotations", t: "Poutres préfabriquées : flèches et contre-flèche", ref: "RDM — f = 5pL⁴/(384EI) ; phasage F1 + 2/3 F2 + F3 ; limites PRA",
  desc: "Flèche à la pose, après durcissement du tablier et sous superstructures ; contre-flèche à donner aux poutres.",
  inputs: [N("fc28", "Résistance du béton", "MPa", 35, sub("f", "c28")), N("L", "Portée de calcul", "m", 26.5), N("g", "Poids volumique", "kN/m³", 25, "γ"),
    H("À la pose"), N("Ip", "Inertie de la poutre seule", "m⁴", 0.1807, sub("I", "p")), N("Ap", "Aire de la poutre", "m²", 0.8085, sub("A", "p")),
    N("bh", "Hourdis porté : largeur", "m", 2.17, sub("b", "h")), N("eh", "Hourdis porté : épaisseur", "m", 0.23, sub("e", "h")),
    H("Tablier durci"), N("It", "Inertie du tablier", "m⁴", 1.7305, sub("I", "t")), N("At", "Aire résistante du tablier", "m²", 5.8749, sub("A", "t")),
    N("qs", "Superstructures (max)", "kN/ml", 45.5, sub("q", "sup")), N("CF", "Contre-flèche retenue", "mm", 100, "CF")],
  calc(I) {
    const Ei = 11000 * Math.cbrt(I.fc28), Ev = 3700 * Math.cbrt(I.fc28), L4 = I.L ** 4;
    const p1 = I.g * I.Ap + I.g * I.bh * I.eh, p2 = I.g * I.At;
    const f = (p, E, In) => 1000 * 5 * (p / 1000) * L4 / (384 * E * In);
    const F1 = f(p1, Ei, I.Ip), F2 = f(p2, Ev, I.It), F3 = f(I.qs, Ev, I.It), Fg = F1 + 2 / 3 * F2 + F3;
    const sup = 0.564 * pow(I.L, 1.184), inf = 0.035 * pow(I.L, 1.5);
    return {
      steps: [S("Ei", sub("E", "i"), "11 000 f<sub>c28</sub><sup>1/3</sup>", Ei, "MPa", 0), S("Ev", sub("E", "v"), "3 700 f<sub>c28</sub><sup>1/3</sup>", Ev, "MPa", 0),
        S("p1", sub("p", "1"), "γ (A<sub>p</sub> + b<sub>h</sub> e<sub>h</sub>)", p1, "kN/ml", 3),
        R("F1", sub("F", "1"), "5 p<sub>1</sub> L⁴ / (384 E<sub>i</sub> I<sub>p</sub>) — instantanée à la pose", F1, "mm", 2),
        S("p2", sub("p", "2"), "γ A<sub>t</sub>", p2, "kN/ml", 3),
        R("F2", sub("F", "2"), "5 p<sub>2</sub> L⁴ / (384 E<sub>v</sub> I<sub>t</sub>) — différée", F2, "mm", 2),
        R("F3", sub("F", "3"), "5 q<sub>sup</sub> L⁴ / (384 E<sub>v</sub> I<sub>t</sub>) — superstructures", F3, "mm", 2),
        R("Fg", sub("F", "globale"), "F<sub>1</sub> + 2/3 F<sub>2</sub> + F<sub>3</sub>", Fg, "mm", 2),
        S("sup", "CF<sub>max</sub> PRA", "0,564 L<sup>1,184</sup>", sup, "mm", 2), S("inf", "CF<sub>min</sub> PRA", "0,035 L<sup>1,5</sup>", inf, "mm", 2)],
      checks: [C("Contre-flèche retenue ≥ flèche globale", I.CF >= Fg, `${fmt(I.CF, 0)} mm ≥ ${fmt(Fg, 1)} mm`)],
      tables: [cfTable(I.L, I.CF)], fig: figParabole(I.L, I.CF),
      notes: ["F2 est la flèche qu'aurait le tablier sans phasage ; du fait du phasage les poutres fléchissent à long terme de F1 + 2/3 F2."],
    };
  } },

{ id: "fleche-tablier", cat: "Flèches & rotations", t: "Flèche différée d'un tablier isostatique", ref: "RDM — f = 5pL⁴/(384 E<sub>v</sub> I) ; limites PRA",
  desc: "Flèche différée sous charges permanentes et contre-flèche à prévoir.",
  inputs: [N("fc28", "Résistance du béton", "MPa", 35, sub("f", "c28")), N("L", "Portée", "m", 25), N("I", "Inertie du tablier", "m⁴", 4.616),
    N("pb", "Poids du tablier (béton)", "kN/ml", 0, sub("p", "b")), N("ps", "Poids des superstructures", "kN/ml", 456, sub("p", "s")), N("CF", "Contre-flèche retenue", "mm", 50, "CF")],
  calc(I) {
    const Ev = 3700 * Math.cbrt(I.fc28), p = I.pb + I.ps, Fv = 1000 * 5 * (p / 1000) * I.L ** 4 / (384 * Ev * I.I);
    return {
      steps: [S("Ev", sub("E", "v"), "3 700 f<sub>c28</sub><sup>1/3</sup>", Ev, "MPa", 0), S("p", "p", "p<sub>b</sub> + p<sub>s</sub>", p, "kN/ml", 2),
        R("Fv", sub("F", "v"), "5 p L⁴ / (384 E<sub>v</sub> I)", Fv, "mm", 2), S("Fi", sub("F", "i") + " ≈ F<sub>v</sub>/3", "E<sub>i</sub> = 3 E<sub>v</sub>", Fv / 3, "mm", 2),
        S("sup", "CF<sub>max</sub> PRA", "0,564 L<sup>1,184</sup>", 0.564 * pow(I.L, 1.184), "mm", 2), S("inf", "CF<sub>min</sub> PRA", "0,035 L<sup>1,5</sup>", 0.035 * pow(I.L, 1.5), "mm", 2)],
      checks: [C("Contre-flèche retenue ≥ flèche différée", I.CF >= Fv, `${fmt(I.CF, 0)} ≥ ${fmt(Fv, 1)} mm`)],
      tables: [cfTable(I.L, I.CF)], fig: figParabole(I.L, I.CF),
    };
  } },

{ id: "contre-fleche", cat: "Flèches & rotations", t: "Contre-flèche parabolique", ref: "Parabole y = a x² + b x, a = −4f/L², b = 4f/L",
  desc: "Ordonnées de la contre-flèche à chaque dixième de portée.",
  inputs: [N("L", "Portée", "m", 38), N("f", "Contre-flèche à mi-travée", "mm", 40)],
  calc(I) {
    const a = -4 * I.f / I.L ** 2, b = -a * I.L;
    return { steps: [S("a", "a", "−4 f / L²", a, "mm/m²", 5), S("b", "b", "4 f / L", b, "mm/m", 5)], tables: [cfTable(I.L, I.f, true)], fig: figParabole(I.L, I.f) };
  } },

{ id: "fleche-mur", cat: "Flèches & rotations", t: "Flèche d'un mur en console sous poussée", ref: "RDM — triangulaire pL⁴/(30EI), uniforme pL⁴/(8EI)",
  desc: "Déplacement en tête d'un voile ou mur de culée sous poussée des terres et de la surcharge.",
  inputs: [N("l", "Hauteur du mur", "m", 9.7), N("Ka", "Coefficient de poussée", "", 0.33, sub("K", "a")), N("g", "Poids volumique du remblai", "kN/m³", 20, "γ"),
    N("q", "Surcharge sur remblai", "kN/m²", 20), N("fc28", "Résistance du béton", "MPa", 30, sub("f", "c28")),
    N("b", "Largeur de calcul", "m", 1), N("h", "Épaisseur du mur", "m", 1.03)],
  calc(I) {
    const Ev = 3700 * Math.cbrt(I.fc28), Ei = 3 * Ev, In = I.b * I.h ** 3 / 12;
    const pt = I.Ka * I.g * I.l, pq = I.Ka * I.q;
    const ft = pt / 1000 * I.l ** 4 / (30 * Ev * In) * 1000, fq = pq / 1000 * I.l ** 4 / (8 * Ei * In) * 1000;
    return {
      steps: [S("Ev", sub("E", "v"), "3 700 f<sub>c28</sub><sup>1/3</sup> (terres : différé)", Ev, "MPa", 0), S("Ei", sub("E", "i"), "3 E<sub>v</sub> (surcharge : instantané)", Ei, "MPa", 0),
        S("I", "I", "b h³ / 12", In, "m⁴", 5), S("pt", sub("p", "terres"), "K<sub>a</sub> γ l (en pied)", pt, "kN/m", 2), S("pq", sub("p", "q"), "K<sub>a</sub> q", pq, "kN/m", 2),
        R("ft", sub("f", "terres"), "p<sub>terres</sub> l⁴ / (30 E<sub>v</sub> I)", ft, "mm", 2), R("fq", sub("f", "q"), "p<sub>q</sub> l⁴ / (8 E<sub>i</sub> I)", fq, "mm", 2),
        R("f", "f<sub>totale</sub>", "f<sub>terres</sub> + f<sub>q</sub>", ft + fq, "mm", 2)],
      fig: figMur(),
    };
  } },

{ id: "fleche-pile", cat: "Flèches & rotations", t: "Déplacement en tête d'appui (console)", ref: "RDM — u = F H³/(3EI)",
  desc: "Déplacement en tête d'une pile, d'un groupe de pieux ou de barrettes sous effort horizontal.",
  inputs: [N("fc28", "Résistance du béton", "MPa", 35, sub("f", "c28")), N("F", "Effort horizontal en tête", "kN", 3600), N("H", "Hauteur libre", "m", 8),
    SEL("sec", "Section", [["I", "Inertie donnée"], ["P", "Pieux circulaires"], ["B", "Barrettes rectangulaires"]], "I", "Section"),
    N("I", "Inertie (si donnée)", "m⁴", 29.92), N("n", "Nombre d'éléments", "U", 3), N("D", "Diamètre des pieux", "m", 1.2, "Ø"),
    N("bb", "Barrette : épaisseur", "m", 1.2, "b"), N("hb", "Barrette : longueur (sens de flexion)", "m", 2.7, "h")],
  calc(I) {
    const Ei = 11000 * Math.cbrt(I.fc28), Ev = 3700 * Math.cbrt(I.fc28);
    const In = I.sec === "I" ? I.I : I.sec === "P" ? I.n * PI * I.D ** 4 / 64 : I.n * I.bb * I.hb ** 3 / 12;
    const fI = I.sec === "I" ? "donnée" : I.sec === "P" ? "n π Ø⁴ / 64" : "n b h³ / 12";
    const u = E => 1000 * (I.F / 1000) * I.H ** 3 / (3 * E * In);
    return { steps: [S("Ei", sub("E", "i"), "11 000 f<sub>c28</sub><sup>1/3</sup>", Ei, "MPa", 0), S("Ev", sub("E", "v"), "3 700 f<sub>c28</sub><sup>1/3</sup>", Ev, "MPa", 0),
      S("In", "I", fI, In, "m⁴", 4), R("ui", sub("u", "i"), "F H³ / (3 E<sub>i</sub> I)", u(Ei), "mm", 3), R("uv", sub("u", "v"), "F H³ / (3 E<sub>v</sub> I)", u(Ev), "mm", 3)], fig: figConsole() };
  } },

{ id: "rotation", cat: "Flèches & rotations", t: "Rotation sur appui d'une poutre isostatique", ref: "RDM — α = pL³/(24EI) ; α = PL²/(16EI)",
  desc: "Rotation instantanée et différée sur appui (dimensionnement des appareils d'appui).",
  inputs: [SEL("cas", "Chargement", [["q", "Charge uniforme p"], ["P", "Charge concentrée P à mi-travée"]], "q", "Cas"),
    N("p", "Charge (kN/ml ou kN)", "kN/ml", 330, "p ou P"), N("L", "Portée", "m", 26.05), N("I", "Inertie", "m⁴", 6.7205), N("fc28", "Résistance du béton", "MPa", 30, sub("f", "c28"))],
  calc(I) {
    const Ei = 11000 * Math.cbrt(I.fc28), Ev = 3700 * Math.cbrt(I.fc28);
    const a = E => I.cas === "q" ? I.p / 1000 * I.L ** 3 / (24 * E * I.I) : I.p / 1000 * I.L ** 2 / (16 * E * I.I);
    const f = I.cas === "q" ? "p L³ / (24 E I)" : "P L² / (16 E I)";
    return { steps: [S("Ei", sub("E", "i"), "11 000 f<sub>c28</sub><sup>1/3</sup>", Ei, "MPa", 0), S("Ev", sub("E", "v"), "3 700 f<sub>c28</sub><sup>1/3</sup>", Ev, "MPa", 0),
      R("ai", "α<sub>i</sub>", f.replace("E I", "E<sub>i</sub> I"), a(Ei), "rad", "e"), R("av", "α<sub>v</sub>", f.replace("E I", "E<sub>v</sub> I"), a(Ev), "rad", "e"),
      S("av23", "2/3 α<sub>v</sub>", "", 2 / 3 * a(Ev), "rad", "e")], notes: [`Soit α<sub>i</sub> = ${fmt(a(Ei) * 1000, 3)} ‰ et α<sub>v</sub> = ${fmt(a(Ev) * 1000, 3)} ‰.`] };
  } },

/* ══════════════ CHARGES ══════════════ */
{ id: "maj-dyn", cat: "Charges & répartition", t: "Coefficient de majoration dynamique", ref: "Fascicule 61 titre II — art. 5.5 : δ = 1 + 0,4/(1+0,2L) + 0,6/(1+4G/S)",
  desc: "Majoration dynamique des charges B pour une travée (poutres) ou un élément d'hourdis.",
  inputs: [SEL("el", "Élément", [["p", "Poutres / travée"], ["h", "Hourdis"]], "p", "Élément"), N("L", "Longueur L", "m", 35.02),
    N("G", "Charge permanente sur L", "t", 924), N("S", "Surcharge B maximale sur L", "t", 110)],
  calc(I) {
    const d = 1 + 0.4 / (1 + 0.2 * I.L) + 0.6 / (1 + 4 * I.G / I.S);
    return { steps: [S("t1", "0,4 / (1 + 0,2 L)", "", 0.4 / (1 + 0.2 * I.L), "", 4), S("t2", "0,6 / (1 + 4 G/S)", "", 0.6 / (1 + 4 * I.G / I.S), "", 4),
      R("delta", "δ", "1 + 0,4/(1 + 0,2 L) + 0,6/(1 + 4 G/S)", d, "", 4)],
      notes: [I.el === "p" ? "L : portée de la travée ; G : poids de la travée ; S : surcharge B maximale que peut recevoir la travée." :
        "L : inf(entraxe des poutres de rive, portée) ; G : poids de l'hourdis et des éléments qu'il porte sur L ; S : surcharge B maximale sur L."] };
  } },

{ id: "charge-al", cat: "Charges & répartition", t: "Charge A(L) et freinage", ref: "Fascicule 61 titre II — art. 4.2 et 4.4",
  desc: "Densité de charge A(L), charge par mètre linéaire et effort de freinage associé.",
  inputs: [N("L", "Longueur chargée", "m", 9.45), N("a1", "Coefficient a1", "", 1, sub("a", "1")), N("V0", "Largeur de référence V0", "m", 3.5, sub("V", "0")),
    N("Lch", "Largeur chargeable", "m", 15, sub("L", "ch")), N("Nv", "Nombre de voies", "U", 5, sub("N", "v"))],
  calc(I) {
    const V = I.Lch / I.Nv, a2 = I.V0 / V, AL = 0.23 + 36 / (I.L + 12), Aeff = a2 * max(I.a1 * AL, 0.4 - 0.0002 * I.L);
    const Sf = I.L * I.Lch, F = Sf * Aeff / (20 + 0.0035 * Sf);
    return { steps: [S("V", "V", "L<sub>ch</sub> / N<sub>v</sub>", V, "m", 3), S("a2", sub("a", "2"), "V<sub>0</sub> / V", a2, "", 4),
      S("AL", "A(L)", "0,23 + 36 / (L + 12)", AL, "t/m²", 4),
      R("A", "A", "a<sub>2</sub> · max(a<sub>1</sub> A(L) ; 0,4 − 0,0002 L)", Aeff, "t/m²", 4), R("Aml", "A · L<sub>ch</sub>", "", Aeff * I.Lch, "t/ml", 3),
      S("Sf", "S", "L · L<sub>ch</sub>", Sf, "m²", 2), S("fr", "Fraction", "1 / (20 + 0,0035 S)", 1 / (20 + 0.0035 * Sf), "", 5),
      R("F", sub("F", "freinage"), "S · A / (20 + 0,0035 S)", F, "t", 3), S("FkN", "", "soit", F * 9.81, "kN", 1)] };
  } },

{ id: "courbon", cat: "Charges & répartition", t: "Répartition transversale — méthode de Courbon", ref: "Courbon — η<sub>i</sub> = 1/n [1 + 6 (n+1−2i)/(n²−1) · e/b<sub>p</sub>]",
  desc: "Coefficient de répartition transversale de chaque poutre pour une charge excentrée.",
  inputs: [N("n", "Nombre de poutres", "U", 4), N("bp", "Entraxe moyen des poutres", "m", 5.16667, sub("b", "p")), N("e", "Excentricité de la charge", "m", 2.25)],
  calc(I) {
    const n = Math.round(I.n), et = [];
    for (let i = 1; i <= n; i++) et.push((1 + 6 * (n + 1 - 2 * i) / (n * n - 1) * I.e / I.bp) / n);
    const mx = max(...et);
    return { steps: [R("max", "η<sub>max</sub>", "poutre de rive la plus chargée", mx, "", 4), S("moy", "1/n", "répartition uniforme", 1 / n, "", 4),
      S("cmax", "η<sub>max</sub> · n", "majoration / répartition uniforme", mx * n, "", 3)],
      tables: [{ title: "Coefficients par poutre", head: ["Poutre i", ...et.map((_, i) => i + 1)], rows: [["η<sub>i</sub>", ...et]], d: Array(n).fill(4), key: Object.fromEntries(et.map((_, i) => ["eta" + (i + 1), [0, i + 1]])) }],
      fig: figCourbon(n, I.e, I.bp, et) };
  } },

{ id: "freinage-lgv", cat: "Charges & répartition", t: "Démarrage et freinage ferroviaires", ref: "NF EN 1991-2 — §6.5.3",
  desc: "Forces longitudinales de démarrage et de freinage pour une voie.",
  inputs: [SEL("mod", "Modèle de charge", [["71", "LM71, SW/0, SW/2 démarrage, HSLM"], ["SW2", "SW/2 (freinage)"]], "71", "Modèle"), N("L", "Longueur d'influence", "m", 24, sub("L", "a,b")), N("a", "Coefficient α", "", 1, "α")],
  calc(I) {
    const Qa = min(33 * I.L, 1000) * I.a, Qb = (I.mod === "SW2" ? 35 * I.L : min(20 * I.L, 6000)) * I.a;
    return { steps: [R("Qla", sub("Q", "la,k"), "min(33 L ; 1 000) · α — démarrage", Qa, "kN", 1),
      R("Qlb", sub("Q", "lb,k"), I.mod === "SW2" ? "35 L · α — freinage SW/2" : "min(20 L ; 6 000) · α — freinage", Qb, "kN", 1)],
      notes: ["Ces forces ne sont pas majorées dynamiquement et peuvent être minorées selon les tableaux 6.5 et 6.6.",
        "Au maximum : démarrage sur une voie et freinage sur une deuxième voie."] };
  } },

/* ══════════════ PRÉCONTRAINTE ══════════════ */
{ id: "allongement", cat: "Précontrainte", t: "Allongement des câbles et coefficient de transmission", ref: "BPEL 91 — pertes par frottement σ(x) = σ<sub>0</sub> e<sup>−(fα + φx)</sup>",
  desc: "Allongement théorique d'un câble tendu des deux côtés et rapport de transmission théorique.",
  inputs: [N("s0", "Tension à l'origine", "MPa", 1378.88, "σ<sub>0</sub>"), N("Ap", "Section d'un câble", "mm²", 150, sub("A", "p")), N("nc", "Nombre de torons / câbles", "U", 12, "n"),
    N("L", "Longueur ancrage → milieu", "m", 34), N("E", "Module des câbles", "MPa", 190000, sub("E", "p")),
    N("f", "Coefficient de frottement en courbe", "rad⁻¹", 0.2), N("phi", "Coefficient de perte en ligne", "m⁻¹", 0.002, "φ"), N("al", "Déviation angulaire cumulée", "rad", 0.387891, "α")],
  calc(I) {
    const sm = I.s0 * exp(-I.f * I.al - I.phi * I.L), dl = I.L / I.E * (I.s0 + sm) / 2 * 1000, ct = (sm / I.s0) ** 2, P = I.s0 * I.Ap * I.nc / 1e6;
    return { steps: [S("P", sub("P", "0"), "σ<sub>0</sub> A<sub>p</sub> n", P, "MN", 4), S("Pt", "", "soit", P * 102, "t", 2),
      R("sm", "σ<sub>mil</sub>", "σ<sub>0</sub> · exp(−f α − φ L)", sm, "MPa", 2),
      R("dl", "ΔL", "L / E<sub>p</sub> · (σ<sub>0</sub> + σ<sub>mil</sub>) / 2", dl, "mm", 2), S("dl2", "ΔL<sub>2 côtés</sub>", "2 ΔL (allongement total du câble)", 2 * dl, "mm", 2),
      R("ct", "T<sub>p</sub>/T<sub>a</sub>", "(σ<sub>mil</sub> / σ<sub>0</sub>)²", ct, "", 4), S("Tp", sub("σ", "passif"), "T<sub>p</sub>/T<sub>a</sub> · σ<sub>0</sub>", ct * I.s0, "MPa", 2)],
      notes: ["Hypothèses : deux côtés actifs ; pertes par rentrée d'ancrage et raccourcissement élastique non comptées.",
        "Le coefficient de transmission théorique (sans tarage) se compare au rapport T<sub>passif</sub>/T<sub>actif</sub> mesuré lors de l'essai de transmission."] };
  } },

/* ══════════════ BÉTON ARMÉ ══════════════ */
{ id: "cis-ec2", cat: "Béton armé", t: "Armatures d'effort tranchant (bielles)", ref: "NF EN 1992-1-1 — §6.2.3 (6.8) : A<sub>sw</sub>/s = V<sub>Ed</sub> / (z f<sub>ywd</sub> cot θ)",
  desc: "Section d'armatures transversales par mètre, à l'ELU et en situation accidentelle.",
  inputs: [H("ELU fondamental"), N("V1", "Effort tranchant", "MN", 6.067, sub("V", "Ed")), N("cot1", "cot θ", "", 1.5), N("g1", "γ<sub>s</sub>", "", 1.15),
    H("ELA / sismique"), N("V2", "Effort tranchant", "MN", 9.588, sub("V", "Ed")), N("cot2", "cot θ", "", 2.5), N("g2", "γ<sub>s</sub>", "", 1),
    H("Section"), N("d", "Hauteur utile", "m", 1.928), N("fyk", "Limite élastique des cadres", "MPa", 500, sub("f", "ywk"))],
  calc(I) {
    const z = 0.9 * I.d, r = (V, c, g) => V / (z * I.fyk / g * c) * 1e4;
    return { steps: [S("z", "z", "0,9 d", z, "m", 3), S("fyd1", sub("f", "ywd") + " ELU", "f<sub>ywk</sub> / γ<sub>s</sub>", I.fyk / I.g1, "MPa", 1),
      R("A1", "A<sub>sw</sub>/s ELU", "V<sub>Ed</sub> / (0,9 d f<sub>ywd</sub> cot θ)", r(I.V1, I.cot1, I.g1), "cm²/ml", 2),
      S("fyd2", sub("f", "ywd") + " ELA", "f<sub>ywk</sub> / γ<sub>s</sub>", I.fyk / I.g2, "MPa", 1),
      R("A2", "A<sub>sw</sub>/s ELA", "V<sub>Ed</sub> / (0,9 d f<sub>ywd</sub> cot θ)", r(I.V2, I.cot2, I.g2), "cm²/ml", 2),
      R("Amax", "A<sub>sw</sub>/s dimensionnant", "max", max(r(I.V1, I.cot1, I.g1), r(I.V2, I.cot2, I.g2)), "cm²/ml", 2)],
      notes: ["Vérifier par ailleurs la compression des bielles V<sub>Rd,max</sub> (6.9) et 1 ≤ cot θ ≤ 2,5."] };
  } },

{ id: "cis-circulaire", cat: "Béton armé", t: "Cisaillement d'un fût circulaire creux", ref: "τ<sub>max</sub> = V·S/(I·b) = V R²/I pour un tube",
  desc: "Contrainte de cisaillement maximale dans un fût de pile creux et densité d'armatures dans l'épaisseur.",
  inputs: [N("D", "Diamètre extérieur", "m", 2.4), N("e", "Épaisseur", "m", 0.4), N("V", "Effort tranchant", "kN", 1161), N("fe", "Acier", "MPa", 500, sub("f", "e")), N("gs", "γ<sub>s</sub>", "", 1)],
  calc(I) {
    const Di = I.D - 2 * I.e, In = PI * (I.D ** 4 - Di ** 4) / 64, t = (I.V / 1000) * (I.D / 2) ** 2 / In, A = I.gs * I.e * t / (0.9 * I.fe) * 1e4;
    return { steps: [S("Di", sub("D", "i"), "D − 2 e", Di, "m", 3), S("I", "I", "π (D⁴ − D<sub>i</sub>⁴) / 64", In, "m⁴", 4),
      R("tau", "τ<sub>max</sub>", "V R² / I", t, "MPa", 3), R("A", "A<sub>t</sub>/s<sub>t</sub>", "γ<sub>s</sub> e τ<sub>max</sub> / (0,9 f<sub>e</sub>)", A, "cm²/ml", 2)],
      notes: ["k = 0 (reprise de bétonnage tolérée). La densité est à répartir sur les deux nappes de l'épaisseur."], fig: figTube(I.D, I.e) };
  } },

{ id: "frettage", cat: "Béton armé", t: "Frettes sous appareils d'appui", ref: "Règle 4 % : A = 0,04 R<sub>max</sub> / (2/3 f<sub>e</sub>) dans chaque direction",
  desc: "Frette de surface directement sous l'appareil d'appui.",
  inputs: [N("R", "Réaction maximale ELS", "kN", 1101, sub("R", "max")), N("fe", "Nuance des frettes", "MPa", 235, sub("f", "e")),
    SEL("phi", "Diamètre retenu", Object.keys(ACIER_HA).map(k => [k, "Ø" + k]), "10", "Ø")],
  calc(I) {
    const A = 0.04 * 1e4 * (I.R / 1000) / (2 / 3 * I.fe), a1 = ACIER_HA[I.phi], n = A / a1;
    return { steps: [R("A", "A", "0,04 R<sub>max</sub> / (2/3 f<sub>e</sub>)", A, "cm²", 3), S("a1", "A<sub>Ø</sub>", "π Ø² / 4", a1, "cm²", 3),
      S("n", "n<sub>min</sub>", "A / A<sub>Ø</sub>", n, "U", 2), R("nr", "n retenu", "par sens", Math.ceil(n), "U", 0)] };
  } },

{ id: "levage-trous", cat: "Béton armé", t: "Levage des poutres : réservations", ref: "Règle 4 % : A = 0,04 F / (2/3 f<sub>e</sub>) dans les deux sens",
  desc: "Ferraillage autour des trous de levage d'une poutre préfabriquée.",
  inputs: [N("fe", "Acier des réservations", "MPa", 235, sub("f", "e")),
    N("S1", "Aire sur appuis", "m²", 0.8085, sub("S", "max")), N("S3", "Aire à mi-travée", "m²", 0.8085, sub("S", "min")),
    N("L1", "Longueur à S<sub>max</sub>", "m", 27.5, sub("L", "1")), N("L2", "Longueur à S<sub>moy</sub>", "m", 0, sub("L", "2")), N("L3", "Longueur à S<sub>min</sub>", "m", 0, sub("L", "3")), N("g", "Masse volumique", "t/m³", 2.5, "ρ")],
  calc(I) {
    const Sm = (I.S1 + I.S3) / 2, V = I.S1 * I.L1 + Sm * I.L2 + I.S3 * I.L3, P = I.g * V, F = P / 2, A = 0.04 * (F / 100) / (2 / 3 * I.fe) * 1e4;
    return { steps: [S("Sm", sub("S", "moy"), "(S<sub>max</sub> + S<sub>min</sub>)/2", Sm, "m²", 4), S("Lp", sub("L", "poutre"), "L<sub>1</sub> + L<sub>2</sub> + L<sub>3</sub>", I.L1 + I.L2 + I.L3, "m", 2),
      S("V", "V", "Σ S<sub>i</sub> L<sub>i</sub>", V, "m³", 3), R("P", "P", "ρ V", P, "t", 3), R("F", "F", "P / 2 (par trou)", F, "t", 3),
      R("A", "A", "0,04 F / (2/3 f<sub>e</sub>)", A, "cm²", 3)], fig: figLevage(false) };
  } },

{ id: "levage-crochets", cat: "Béton armé", t: "Levage des poutres : consoles et crochets", ref: "ELS — section rectangulaire (n = 15) ; crochets en acier doux",
  desc: "Contraintes dans le béton et les aciers supérieurs au droit des crochets, et contrainte dans les crochets.",
  inputs: [N("fc", "Béton au levage", "MPa", 35, sub("f", "c")), N("fe", "Aciers supérieurs", "MPa", 500, sub("f", "e")), N("As", "Section des aciers sup.", "cm²", 4.68, sub("A", "sup")),
    SEL("fis", "Fissuration", [["PP", "Peu préjudiciable"], ["P", "Préjudiciable"], ["TP", "Très préjudiciable"]], "P", "Fissuration"),
    N("A", "Aire de la poutre", "m²", 0.5), N("b", "Largeur d'âme", "m", 0.4, sub("b", "0")), N("h", "Hauteur totale", "m", 1), N("c", "Enrobage aux aciers", "m", 0.05, "c"),
    N("a", "Porte-à-faux (crochet → about)", "m", 0.9, "a"), N("Lc", "Entraxe des crochets", "m", 17.75, sub("L", "c")),
    N("nc", "Nombre de brins par crochet", "U", 2), SEL("phi", "Diamètre des crochets", Object.keys(ACIER_HA).map(k => [k, "Ø" + k]), "25", "Ø"), N("fec", "Acier des crochets", "MPa", 235, sub("f", "e,c"))],
  calc(I) {
    const M = 25 * I.A * I.a ** 2 / 2, s = elsRect(M, I.b, I.h, I.c, I.As);
    const ssl = I.fis === "PP" ? I.fe : I.fis === "P" ? I.fe / 2 : 200, sbl = 0.6 * I.fc;
    const Lp = 2 * I.a + I.Lc, P = 2.5 * I.A * Lp, Ac = I.nc * ACIER_HA[I.phi], sc = (P / 2) / 100 / (Ac / 1e4);
    return { steps: [R("M", "M", "γ A a² / 2 (console)", M, "kN·m", 3), S("y", "y<sub>1</sub>", "b y²/2 = n A (d − y)", s.y, "m", 4),
      R("ss", "σ<sub>s</sub>", "n M (d − y<sub>1</sub>) / I", s.ss, "MPa", 1), R("sb", "σ<sub>b</sub>", "M y<sub>1</sub> / I", s.sb, "MPa", 2),
      S("Lp", sub("L", "poutre"), "2a + L<sub>c</sub>", Lp, "m", 2), R("P", "P", "2,5 A L<sub>poutre</sub>", P, "t", 3), S("P2", "P/2", "par crochet", P / 2, "t", 3),
      S("Ac", sub("A", "crochet"), `${I.nc} Ø${I.phi}`, Ac, "cm²", 2), R("sc", "σ<sub>crochet</sub>", "(P/2) / A<sub>crochet</sub>", sc, "MPa", 1)],
      checks: [C("σ<sub>s</sub> ≤ σ̄<sub>s</sub>", s.ss <= ssl, `${fmt(s.ss, 0)} ≤ ${fmt(ssl, 0)} MPa`), C("σ<sub>b</sub> ≤ 0,6 f<sub>c</sub>", s.sb <= sbl, `${fmt(s.sb, 1)} ≤ ${fmt(sbl, 1)} MPa`),
        C("σ<sub>crochet</sub> ≤ f<sub>e</sub>", sc <= I.fec, `${fmt(sc, 0)} ≤ ${fmt(I.fec, 0)} MPa`)],
      vals: { ssl, sbl }, fig: figLevage(true), notes: ["On ne compte que sur un seul crochet par extrémité."] };
  } },

{ id: "predalles", cat: "Béton armé", t: "Prédalles non participantes", ref: "Flexion simple de la prédalle seule : σ = M v / I",
  desc: "Vérification de la prédalle au coulage du béton de remplissage.",
  inputs: [N("L", "Portée de la prédalle", "m", 0.625), N("ep", "Épaisseur de la prédalle", "m", 0.012, sub("e", "p")), N("H", "Épaisseur de béton coulé", "m", 0.36),
    N("gp", "Poids volumique prédalle", "kN/m³", 14, sub("γ", "p")), N("gb", "Poids volumique du remplissage", "kN/m³", 26, sub("γ", "b")), N("sl", "Contrainte limite", "MPa", 18, "σ̄")],
  calc(I) {
    const p = I.ep * I.gp + I.H * I.gb, M = p * I.L ** 2 / 8, In = I.ep ** 3 / 12, v = I.ep / 2, s = (M / 1000) * v / In, Fs = I.sl / s;
    return { steps: [S("p", "p", "e<sub>p</sub> γ<sub>p</sub> + H γ<sub>b</sub>", p, "kN/ml", 3), S("M", "M", "p L² / 8", M, "kN·m/ml", 4),
      S("I", "I", "e<sub>p</sub>³ / 12", In, "m⁴/ml", "e"), S("v", "v", "e<sub>p</sub> / 2", v, "m", 4), R("s", "σ<sub>max</sub>", "M v / I", s, "MPa", 2), R("Fs", sub("F", "s"), "σ̄ / σ<sub>max</sub>", Fs, "", 3)],
      checks: [C("σ<sub>max</sub> ≤ σ̄ (F<sub>s</sub> ≥ 1)", Fs >= 1, `F<sub>s</sub> = ${fmt(Fs, 2)}`)] };
  } },

/* ══════════════ ACIER ══════════════ */
{ id: "serrage", cat: "Charpente métallique", t: "Couple de serrage des boulons précontraints", ref: "NF EN 1090-2 — §8.5 : F<sub>p,C</sub> = 0,7 f<sub>ub</sub> A<sub>s</sub> ; M<sub>r</sub> = k<sub>m</sub> d F<sub>p,C</sub>",
  desc: "Précontrainte nominale et couples des phases de serrage.",
  inputs: [SEL("cl", "Classe", [["800", "8.8 — f<sub>ub</sub> 800 MPa"], ["1000", "10.9 — f<sub>ub</sub> 1 000 MPa"]], "1000", "Classe"),
    SEL("M", "Diamètre", Object.keys(BOULONS).map(k => [k, k]), "M27", "Boulon"), N("km", "Coefficient de frottement moyen", "", 0.11, sub("k", "m"))],
  calc(I) {
    const fub = +I.cl, As = BOULONS[I.M], d = parseInt(I.M.slice(1), 10), Fp = 0.7 * fub * As / 1000, Mr = I.km * d * Fp;
    return { steps: [S("fub", sub("f", "ub"), "classe " + (fub === 800 ? "8.8" : "10.9"), fub, "MPa", 0), S("As", sub("A", "s"), "aire résistante " + I.M, As, "mm²", 1),
      R("Fp", sub("F", "p,C"), "0,7 f<sub>ub</sub> A<sub>s</sub>", Fp, "kN", 1), R("Mr", sub("M", "r"), "k<sub>m</sub> d F<sub>p,C</sub>", Mr, "N·m", 0)],
      tables: [{ title: "Phases de serrage", head: ["Méthode", "Phase 1", "Phase 2"], rows: [
        ["Combinée", `75 % : ${fmt(0.75 * Mr, 0)} N·m`, "rotation selon épaisseur serrée (tab. 21)"], ["Du couple", `75 % : ${fmt(0.75 * Mr, 0)} N·m`, `110 % : ${fmt(1.1 * Mr, 0)} N·m`]] }],
      vals: { M75: 0.75 * Mr, M110: 1.1 * Mr } };
  } },

/* ══════════════ APPAREILS D'APPUI ══════════════ */
{ id: "tassement-aa", cat: "Appareils d'appui", t: "Tassement d'un appareil d'appui en élastomère fretté", ref: "NF EN 1337-3 — §5.3.3.7 : v<sub>z</sub> = Σ F<sub>z</sub> t<sub>i</sub>/A' · [1/(5 G S<sub>i</sub>²) + 1/E<sub>b</sub>]",
  desc: "Tassement sous charge verticale centrée, couche par couche.",
  inputs: [N("Fz", "Charge verticale", "kN", 591, sub("F", "z")), N("a", "Dimension a", "m", 0.3), N("b", "Dimension b", "m", 0.4), N("enr", "Enrobage latéral", "mm", 5),
    N("G", "Module de cisaillement", "MPa", 0.9, sub("G", "d")), N("Eb", "Module de compressibilité", "MPa", 2000, sub("E", "b")),
    N("text", "Couches extérieures : épaisseur", "mm", 6, "t<sub>ext</sub>"), N("tint", "Couches intérieures : épaisseur", "mm", 12, "t<sub>int</sub>"), N("nint", "Nombre de couches intérieures", "U", 3)],
  calc(I) {
    const a1 = I.a - 2 * I.enr / 1000, b1 = I.b - 2 * I.enr / 1000, A1 = a1 * b1, lp = 2 * (a1 + b1), sig = I.Fz / 1000 / A1;
    const layers = [["Ext", I.text], ...Array(Math.round(I.nint)).fill(["Int", I.tint]), ["Ext", I.text]];
    let tot = 0; const rows = layers.map(([pos, t], i) => { const ti = t / 1000, te = pos === "Ext" ? 1.4 * ti : ti, Si = A1 / (lp * te),
      v = 1000 * (I.Fz / 1000) * ti / A1 * (1 / (5 * I.G * Si ** 2) + 1 / I.Eb); tot += v; return [i + 1, t, pos === "Ext" ? "Extérieure" : "Intérieure", te * 1000, Si, v]; });
    return { steps: [S("a1", "a'", "a − 2 enrobage", a1, "m", 3), S("b1", "b'", "b − 2 enrobage", b1, "m", 3), S("A1", "A'", "a' b'", A1, "m²", 4), S("lp", sub("l", "p"), "2 (a' + b')", lp, "m", 3),
      S("sig", "σ", "F<sub>z</sub> / A'", sig, "MPa", 2), R("vz", sub("v", "z"), "Σ v<sub>z,i</sub> (théorique)", tot, "mm", 3), S("vz2", sub("v", "z") + " réel ≈ /2", "", tot / 2, "mm", 3), S("vz3", sub("v", "z") + " réel ≈ /3", "", tot / 3, "mm", 3)],
      tables: [{ title: "Détail par couche", head: ["n°", "t<sub>i</sub> (mm)", "Position", "t<sub>e</sub> (mm)", "S<sub>i</sub>", "v<sub>z,i</sub> (mm)"], rows, d: [0, 0, 1, 2, 4], key: { v1: [0, 5], v2: [1, 5] } }],
      notes: ["Couches extérieures : t<sub>e</sub> = 1,4 t<sub>i</sub>. S<sub>i</sub> = A' / (l<sub>p</sub> t<sub>e</sub>)."], fig: figAA(layers) };
  } },

/* ══════════════ FONDATIONS ══════════════ */
{ id: "pieux-min-sis", cat: "Fondations", t: "Pieux : minimums sismiques", ref: "AFPS 92 — ferraillage minimal des pieux",
  desc: "Armatures longitudinales minimales et pourcentage volumique des cerces.",
  inputs: [N("D", "Diamètre du pieu", "m", 1, "Ø"), SEL("sol", "Type de sol (AFPS 92)", [["a", "a"], ["b", "b"], ["c", "c"]], "c", "Sol"),
    SEL("phi", "Barres longitudinales", Object.keys(ACIER_HA).map(k => [k, "HA" + k]), "32", "Ø<sub>L</sub>"),
    H("Cerces"), N("c", "Enrobage", "m", 0.07), N("sc", "Espacement zone critique", "cm", 8, sub("s", "crit")), N("sk", "Espacement zone courante", "cm", 11, sub("s", "cour")),
    N("p1", "Cerce : diamètre", "mm", 16, "Ø<sub>1</sub>"), N("p2", "Cerce secondaire (0 si aucune)", "mm", 0, "Ø<sub>2</sub>")],
  calc(I) {
    const Sp = PI * I.D ** 2 / 4, base = I.sol === "c" ? 0.006 : 0.005, rho = I.D <= 1 ? base : base / sqrt(I.D), As = rho * Sp * 1e4;
    const a1 = PI * (I.phi / 10) ** 2 / 4, n = Math.ceil(As / a1 - 1e-9), Ar = n * a1;
    const vol = (s, p) => { const Vb = PI * I.D ** 2 / 4 * s / 100, Va = PI * (p / 10) ** 2 / 4 * PI * (100 * I.D - 200 * I.c - p / 10); return Va / 1e6 / Vb; };
    const rc = vol(I.sc, I.p1) + vol(I.sc, I.p2), rk = vol(I.sk, I.p1) + vol(I.sk, I.p2);
    return { steps: [S("Sp", "S", "π Ø² / 4", Sp, "m²", 4), S("rho", "ρ<sub>min</sub>", I.D <= 1 ? `${base * 100} %` : `${base * 100} % / √Ø`, rho * 100, "%", 3),
      R("As", sub("A", "s,min"), "ρ<sub>min</sub> S", As, "cm²", 2), R("n", "n", `A<sub>s,min</sub> / A<sub>HA${I.phi}</sub> arrondi`, n, "U", 0), S("Ar", sub("A", "s,réel"), "", Ar, "cm²", 2), S("rr", "ρ<sub>réel</sub>", "", Ar / 1e4 / Sp * 100, "%", 3),
      R("rc", "ρ<sub>w</sub> zone critique", "V<sub>cerces</sub> / V<sub>béton</sub>", rc * 100, "%", 3), R("rk", "ρ<sub>w</sub> zone courante", "V<sub>cerces</sub> / V<sub>béton</sub>", rk * 100, "%", 3)] };
  } },

{ id: "groupe-v", cat: "Fondations", t: "Effet de groupe vertical : coefficient d'efficacité", ref: "Fascicule 62 titre V — annexe G.1, §2.2 (Converse-Labarre) et §2.5.1",
  desc: "Coefficient d'efficacité d'un groupe de pieux flottants.",
  inputs: [N("B", "Diamètre des pieux", "m", 1), N("d", "Entraxe", "m", 2.6), N("m", "Nombre de rangées", "U", 1), N("n", "Pieux par rangée", "U", 5)],
  calc(I) {
    const Ce = 1 - atan(I.B / I.d) / (PI / 2) * (2 - 1 / I.m - 1 / I.n), C2 = I.d >= 3 * I.B ? 1 : 0.25 * (1 + I.d / I.B);
    return { steps: [S("at", "arctan(B/d)", "", atan(I.B / I.d), "rad", 4), R("Ce", sub("C", "e") + " Converse-Labarre", "1 − arctan(B/d)/(π/2) · (2 − 1/m − 1/n)", Ce, "", 4),
      R("C2", sub("C", "e") + " §2.5.1", I.d >= 3 * I.B ? "d ≥ 3B → 1" : "0,25 (1 + d/B)", C2, "", 4)] };
  } },

{ id: "groupe-h", cat: "Fondations", t: "Effet de groupe horizontal : minorations", ref: "Fascicule 62 titre V — annexe G.1",
  desc: "Coefficients de minoration de la loi de réaction latérale d'un pieu dans un groupe.",
  inputs: [N("B", "Diamètre (ou largeur)", "m", 1.2), N("Ex", "Entraxe selon X", "m", 2.68, sub("E", "x")), N("Ey", "Entraxe selon Y", "m", 3.6, sub("E", "y")),
    N("nx", "Nombre de files (sens X)", "U", 3, sub("n", "x")), N("ny", "Nombre de files (sens Y)", "U", 2, sub("n", "y")), N("a", "Coefficient rhéologique", "", 0.5, "α")],
  calc(I) {
    const ax = I.Ex - I.B, ay = I.Ey - I.B, r0 = n => (I.a + 4 / 3 * pow(2.65, I.a)) / (n * I.a + 4 / 3 * pow(2.65 * n, I.a));
    const r0x = r0(I.nx), r0y = r0(I.ny);
    const Kx = ay >= 2 * I.B ? 1 : ay / (2 * I.B) + r0x * (1 - ay / (2 * I.B)), Rfx = ax >= 2 * I.B ? 1 : ax / (2 * I.B);
    const Ky = ax >= 2 * I.B ? 1 : ax / (2 * I.B) + r0y * (1 - ax / (2 * I.B)), Rfy = ay >= 2 * I.B ? 1 : ay / (2 * I.B);
    return { steps: [S("ax", sub("a", "x"), "E<sub>x</sub> − B", ax, "m", 3), S("ay", sub("a", "y"), "E<sub>y</sub> − B", ay, "m", 3),
      S("r0x", sub("ρ", "0,x"), "(α + 4/3·2,65<sup>α</sup>) / (n α + 4/3 (2,65 n)<sup>α</sup>)", r0x, "", 4), S("r0y", sub("ρ", "0,y"), "idem avec n<sub>y</sub>", r0y, "", 4),
      R("Kx", sub("K", "x"), "SPD : a<sub>y</sub> ≥ 2B ? 1 : a<sub>y</sub>/2B + ρ<sub>0</sub>(1 − a<sub>y</sub>/2B)", Kx, "", 4), R("Rfx", sub("R", "f,x"), "SD : a<sub>x</sub> ≥ 2B ? 1 : a<sub>x</sub>/2B", Rfx, "", 4),
      R("Ky", sub("K", "y"), "SPD avec a<sub>x</sub>", Ky, "", 4), R("Rfy", sub("R", "f,y"), "SD avec a<sub>y</sub>", Rfy, "", 4)],
      notes: ["SD : éléments dans le sens du déplacement ; SPD : perpendiculairement. La sensibilité à α est très faible (α = 1 est le plus défavorable)."], fig: figGroupe(I.nx, I.ny) };
  } },

{ id: "barrettes", cat: "Fondations", t: "Barrettes : loi de réaction latérale", ref: "Fascicule 62 titre V — annexes C.5, E.1 et G.1",
  desc: "Raideurs frontale et tangentielle, paliers, pour un élément isolé puis en groupe, dans les deux sens.",
  inputs: [H("Sol"), N("pf", "Pression de fluage", "MPa", 3.18, sub("p", "f")), N("EM", "Module pressiométrique", "MPa", 67.39, sub("E", "M")), N("pl", "Pression limite nette", "MPa", 4.35, "p<sub>l</sub>*"),
    N("a", "Coefficient rhéologique", "", 0.67, "α"), N("qs", "Frottement latéral", "MPa", 0.04, sub("q", "s")),
    H("Barrettes"), N("B", "Épaisseur", "m", 1), N("L", "Longueur", "m", 2.7), N("Ex", "Entraxe selon X", "m", 4.7, sub("E", "x")), N("Ey", "Entraxe selon Y", "m", 3.6, sub("E", "y")),
    N("nX", "Files ⊥ au déplacement X", "U", 3, sub("n", "X")), N("nY", "Files ⊥ au déplacement Y", "U", 2, sub("n", "Y")), N("B0", "Largeur de référence", "m", 0.6, sub("B", "0"))],
  calc(I) {
    const r0 = n => (I.a + 4 / 3 * pow(2.65, I.a)) / (n * I.a + 4 / 3 * pow(2.65 * n, I.a));
    const sens = (B, L, a, b, n) => {   // B : largeur face au déplacement, L : dimension parallèle
      const Ls = max(0, L - B), Kf = 12000 * I.EM / (4 / 3 * I.B0 / B * pow(2.65 * B / I.B0, I.a) + I.a), Rf = 1000 * B * I.pf, Rs = 1000 * 2 * Ls * I.qs, Ks = Rs === 0 ? 0 : Kf;
      const mx = max(B, L), SD = { Kf: 1, Rf: a >= 2 * mx ? 1 : a / (2 * mx), Ks: 1, Rs: 1 }, ro = r0(n);
      const SPD = { Kf: b >= 2 * B ? 1 : b / (2 * B) + ro * (1 - b / (2 * B)), Rf: 1, Ks: b < 2 * B ? 0 : 1, Rs: b >= 2 * L ? 1 : (b - 2 * B) / (2 * (L - B)) };
      const g = { Kf: SD.Kf * SPD.Kf * Kf, Rf: SD.Rf * SPD.Rf * Rf, Ks: SD.Ks * SPD.Ks * Ks, Rs: SD.Rs * SPD.Rs * Rs };
      const law = (Kf, Rf, Ks, Rs) => ({ K1: Kf + Ks, K2: Kf, R1: 2 * min(Rf, Rs), R2: Rf + Rs });
      return { Kf, Rf, Rs, Ks, SD, SPD, ro, iso: law(Kf, Rf, Ks, Rs), grp: law(g.Kf, g.Rf, g.Ks, g.Rs), g, B };
    };
    const X = sens(I.B, I.L, I.Ex - I.L, I.Ey - I.B, I.nX), Y = sens(I.L, I.B, I.Ey - I.B, I.Ex - I.L, I.nY);
    const row = (l, f, d = 0) => [l, f(X), f(Y)];
    return { steps: [], vals: { KfX: X.Kf, RfX: X.Rf, RsX: X.Rs, R1X: X.iso.R1, R2X: X.iso.R2, SDRfX: X.SD.Rf, r0X: X.ro, SPDRsX: X.SPD.Rs, gRfX: X.g.Rf, gRsX: X.g.Rs, gR1X: X.grp.R1, gR2X: X.grp.R2,
        KfY: Y.Kf, RfY: Y.Rf, SDRfY: Y.SD.Rf, r0Y: Y.ro, SPDKfY: Y.SPD.Kf, gKfY: Y.g.Kf, gRfY: Y.g.Rf, gR2Y: Y.grp.R2, gK1Yb: Y.grp.K1 / Y.B },
      tables: [
        { title: "Élément isolé", head: ["", "Sens X", "Sens Y"], rows: [
          row("K<sub>f</sub> = 12 000 E<sub>M</sub> / [4/3 B<sub>0</sub>/B (2,65 B/B<sub>0</sub>)<sup>α</sup> + α] (kN/m/m)", s => s.Kf), row("R<sub>f</sub> = B p<sub>f</sub> (kN/m)", s => s.Rf),
          row("R<sub>s</sub> = 2 (L − B) q<sub>s</sub> (kN/m)", s => s.Rs), row("K<sub>1</sub> = K<sub>f</sub> + K<sub>s</sub> (kN/m/m)", s => s.iso.K1),
          row("R<sub>1</sub> = 2 min(R<sub>f</sub>, R<sub>s</sub>) (kN/m)", s => s.iso.R1), row("R<sub>2</sub> = R<sub>f</sub> + R<sub>s</sub> (kN/m)", s => s.iso.R2)], d: [0, 0] },
        { title: "Minorations de groupe", head: ["", "Sens X", "Sens Y"], rows: [
          row("SD : R<sub>f</sub> = a/(2 max(B,L))", s => s.SD.Rf), row("ρ<sub>0</sub> (n files)", s => s.ro), row("SPD : K<sub>f</sub>", s => s.SPD.Kf),
          row("SPD : K<sub>s</sub>", s => s.SPD.Ks), row("SPD : R<sub>s</sub>", s => s.SPD.Rs)], d: [3, 3] },
        { title: "Loi finale en groupe (instantané ; différé = K/2)", head: ["", "Sens X", "Sens Y"], rows: [
          row("K<sub>1</sub> (kN/m/m)", s => s.grp.K1), row("K<sub>2</sub> (kN/m/m)", s => s.grp.K2), row("R<sub>1</sub> (kN/m)", s => s.grp.R1), row("R<sub>2</sub> (kN/m)", s => s.grp.R2),
          row("K<sub>1</sub>/B par unité de largeur (kN/m³)", s => s.grp.K1 / s.B), row("R<sub>2</sub>/B (kN/m²)", s => s.grp.R2 / s.B)], d: [0, 0] }],
      notes: ["Sens X : B = épaisseur, L = longueur ; sens Y : rôles inversés. a<sub>x</sub> = E<sub>x</sub> − L, a<sub>y</sub> = E<sub>y</sub> − B."], fig: figBarrettes(I) };
  } },

{ id: "barrettes-sis", cat: "Fondations", t: "Barrettes : raideur sismique", ref: "AFPS 92 — module dynamique G = ρ V<sub>s</sub>²",
  desc: "Raideur latérale du sol en situation sismique.",
  inputs: [N("Vs", "Vitesse des ondes de cisaillement", "m/s", 400, sub("V", "s")), N("rho", "Masse volumique du sol", "kg/m³", 2200, "ρ"),
    N("kG", "Coefficient de réduction de G", "", 0.436, "G/G<sub>max</sub>"), N("nu", "Coefficient de Poisson", "", 0.3, "ν"),
    N("B", "Épaisseur de la barrette", "m", 1), N("L", "Longueur de la barrette", "m", 2.7)],
  calc(I) {
    const Gm = I.rho * I.Vs ** 2 / 1e6, G = Gm * I.kG, Es = 2000 * (1 + I.nu) * G, K = 1.2 * Es;
    return { steps: [S("Gm", sub("G", "max"), "ρ V<sub>s</sub>²", Gm, "MPa", 1), S("G", "G", "G<sub>max</sub> · G/G<sub>max</sub>", G, "MPa", 2),
      S("Es", sub("E", "s"), "2 (1 + ν) G", Es, "kN/m²", 0), R("K", "K", "1,2 E<sub>s</sub>", K, "kN/m²", 0),
      R("KX", sub("K", "X") + " / unité de largeur", "K / B", K / I.B, "kN/m³", 0), R("KY", sub("K", "Y") + " / unité de largeur", "K / L", K / I.L, "kN/m³", 0)],
      notes: ["Le palier à retenir est celui issu du calcul statique (page Barrettes : loi de réaction latérale)."] };
  } },

{ id: "barrettes-min-sis", cat: "Fondations", t: "Barrettes : minimums sismiques", ref: "Guide SNCF-SETRA (relatif à l'AFPS 92)",
  desc: "Sections minimales et maximales d'armatures longitudinales et transversales.",
  inputs: [N("e", "Épaisseur", "m", 1), N("B", "Longueur", "m", 2.7), H("Transversal Ft1 (sens e)"), N("A1", "Section posée (2 brins)", "cm²", 4.02, sub("A", "1")), N("s1", "Espacement", "m", 0.15, sub("s", "1")),
    H("Transversal Ft2 (sens B)"), N("A2", "Section posée", "cm²", 12.32, sub("A", "2")), N("s2", "Espacement", "m", 0.15, sub("s", "2"))],
  calc(I) {
    const Sb = I.e * I.B, Amin = Sb < 1 ? 0.5 / 100 * Sb * 1e4 : Sb > 2 ? 0.25 / 100 * Sb * 1e4 : 50, Amax = 3 / 100 * Sb * 1e4;
    const t1 = 0.1 / 100 * I.e * 1e4, t2 = 0.1 / 100 * I.B * 1e4, p1 = I.A1 / I.s1, p2 = I.A2 / I.s2;
    return { steps: [S("S", "S", "e · B", Sb, "m²", 3), R("Amin", sub("A", "L,min"), Sb < 1 ? "0,5 % S" : Sb > 2 ? "0,25 % S" : "50 cm²", Amin, "cm²", 1), R("Amax", sub("A", "L,max"), "3 % S", Amax, "cm²", 1),
      S("t1", sub("A", "t1,min"), "0,1 % e (par ml)", t1, "cm²/ml", 1), S("p1", sub("A", "1") + "/s<sub>1</sub>", "posé", p1, "cm²/ml", 2),
      S("t2", sub("A", "t2,min"), "0,1 % B (par ml)", t2, "cm²/ml", 1), S("p2", sub("A", "2") + "/s<sub>2</sub>", "posé", p2, "cm²/ml", 2),
      S("zc", "Zone critique haute", "2,5 e", 2.5 * I.e, "m", 2)],
      checks: [C("Ft1 : A<sub>1</sub>/s<sub>1</sub> ≥ 0,1 % e", p1 >= t1, `${fmt(p1, 1)} ≥ ${fmt(t1, 1)}`), C("Ft2 : A<sub>2</sub>/s<sub>2</sub> ≥ 0,1 % B", p2 >= t2, `${fmt(p2, 1)} ≥ ${fmt(t2, 1)}`)],
      notes: ["Espacement maximal des barres longitudinales et transversales : 30 cm."] };
  } },

{ id: "inclusions", cat: "Fondations", t: "Inclusions rigides sous remblai", ref: "Recommandations ASIRI — vérification simplifiée",
  desc: "Effort en tête d'une inclusion, résistance du béton et capacité portante.",
  inputs: [H("Charges"), N("Hr", "Hauteur du remblai", "m", 7), N("g", "Poids volumique du remblai", "kN/m³", 20, "γ"), N("q", "Surcharge d'exploitation", "kPa", 30),
    N("ma", "Maille a", "m", 2), N("mb", "Maille b", "m", 2), N("Fn", "Frottement négatif", "MN", 0.379, sub("F", "n")),
    H("Inclusion"), N("D", "Diamètre", "m", 0.6, "Ø"), N("fc", "Résistance de calcul du béton", "MPa", 20.84, sub("f", "c")), N("As", "Ferraillage", "cm²", 16.08, sub("A", "s")),
    H("Sol"), N("ple", "Pression limite équivalente en pointe", "MPa", 2.5, "p<sub>le</sub>*"), N("kp", "Facteur de portance", "", 1.2, sub("k", "p")),
    N("L1", "Longueur L1", "m", 5, sub("L", "1")), N("qs1", "Frottement qs1", "MPa", 0.04, sub("q", "s1")), N("L2", "Longueur L2", "m", 2, sub("L", "2")), N("qs2", "Frottement qs2", "MPa", 0.12, sub("q", "s2")), N("Fs", "Coefficient de sécurité", "", 1.5, sub("F", "s"))],
  calc(I) {
    const s = I.Hr * I.g / 1000 + I.q / 1000, Am = I.ma * I.mb, F1 = s * Am + I.Fn, Ai = PI * I.D ** 2 / 4, s1 = F1 / Ai, s2 = 0.3 * I.fc;
    const Qp = I.kp * I.ple * Ai, Qs = PI * I.D * (I.L1 * I.qs1 + I.L2 * I.qs2), Q = Qp + Qs, F2 = Q / I.Fs;
    return { steps: [S("s", "σ", "γ H + q", s, "MPa", 3), S("F0", "σ · a · b", "", s * Am, "MN", 3), R("F1", sub("F", "1"), "σ a b + F<sub>n</sub>", F1, "MN", 3),
      S("Ai", "A", "π Ø² / 4", Ai, "m²", 4), R("s1", "σ<sub>1</sub>", "F<sub>1</sub> / A", s1, "MPa", 2), S("s2", "σ<sub>2</sub>", "0,3 f<sub>c</sub>", s2, "MPa", 2),
      S("Qp", sub("Q", "pu"), "k<sub>p</sub> p<sub>le</sub>* A", Qp, "MN", 3), S("Qs", sub("Q", "su"), "π Ø Σ L<sub>i</sub> q<sub>si</sub>", Qs, "MN", 3), S("Q", sub("Q", "u"), "Q<sub>pu</sub> + Q<sub>su</sub>", Q, "MN", 3),
      R("F2", sub("F", "2"), "Q<sub>u</sub> / F<sub>s</sub>", F2, "MN", 3), S("rho", "ρ<sub>s</sub>", "A<sub>s</sub> / A", I.As / 1e4 / Ai * 100, "%", 3)],
      checks: [C("Béton : σ<sub>1</sub> ≤ 0,3 f<sub>c</sub>", s1 < s2, `${fmt(s1, 2)} ≤ ${fmt(s2, 2)} MPa`), C("Portance : F<sub>1</sub> ≤ Q<sub>u</sub>/F<sub>s</sub>", F1 < F2, `${fmt(F1, 3)} ≤ ${fmt(F2, 3)} MN`)] };
  } },

/* ══════════════ SÉISME ══════════════ */
{ id: "spectre-ec8", cat: "Séisme", t: "Spectres de réponse élastiques", ref: "NF EN 1998-1 — §3.2.2.2 et §3.2.2.3",
  desc: "Spectres horizontal et vertical, accélérations de calcul et valeurs de plateau.",
  inputs: [SEL("ref", "Référentiel", Object.entries(SPECTRES).map(([k, v]) => [k, v.n]).concat([["perso", "Personnalisé (S, T<sub>B</sub>, T<sub>C</sub>, T<sub>D</sub> ci-dessous)"]]), "FR", "Spectre"),
    SEL("sol", "Classe de sol", [["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"]], "E", "Sol"),
    N("agr", "Accélération de référence", "m/s²", 0.981, sub("a", "gR")), N("gI", "Coefficient d'importance", "", 1, "γ<sub>I</sub>"), N("ST", "Amplification topographique", "", 1, sub("S", "T")),
    N("xi", "Amortissement", "%", 5, "ξ"), N("avr", "Rapport a<sub>vg</sub>/a<sub>g</sub>", "", 0.9, "a<sub>vg</sub>/a<sub>g</sub>"), N("yt", "Coefficient ELS (séisme de service)", "", 0.585),
    H("Personnalisé"), N("S", "Paramètre de sol", "", 1.8), N("TB", "T<sub>B</sub>", "s", 0.08), N("TC", "T<sub>C</sub>", "s", 0.45), N("TD", "T<sub>D</sub>", "s", 1.25)],
  calc(I) {
    const P = I.ref === "perso" ? null : SPECTRES[I.ref];
    const [Sx, TB, TC, TD] = P ? P[I.sol] : [I.S, I.TB, I.TC, I.TD];
    const [vB, vC, vD] = P ? P.v : [0.03, 0.2, 2.5];
    const ag = I.agr * I.gI * I.ST, eta = max(sqrt(10 / (5 + I.xi)), 0.55), avg = I.avr * ag;
    const pts = []; for (let T = 0; T <= 4.0001; T += 0.02) pts.push([T, seH(T, Sx, TB, TC, TD, eta) * ag, seV(T, vB, vC, vD, eta) * avg]);
    const tab = [0, TB, TC, 0.55, TD, 2, 3, 4].map(T => [T, seH(T, Sx, TB, TC, TD, eta), seH(T, Sx, TB, TC, TD, eta) * ag, seV(T, vB, vC, vD, eta) * avg]);
    return { steps: [S("ag", sub("a", "g"), "γ<sub>I</sub> a<sub>gR</sub> S<sub>T</sub>", ag, "m/s²", 3), S("agg", "", "soit", ag / 9.81, "g", 4),
      S("par", "S / T<sub>B</sub> / T<sub>C</sub> / T<sub>D</sub>", P ? `${P.n}, sol ${I.sol}` : "personnalisé", `${fmt(Sx, 2)} / ${fmt(TB, 2)} / ${fmt(TC, 2)} / ${fmt(TD, 2)} s`, "", 0),
      S("eta", "η", "√(10 / (5 + ξ)) ≥ 0,55", eta, "", 3),
      R("plH", sub("S", "e,max"), "a<sub>g</sub> S η · 2,5 (plateau horizontal)", ag * Sx * eta * 2.5, "m/s²", 3), R("plV", sub("S", "ve,max"), "a<sub>vg</sub> η · 3 (plateau vertical)", avg * eta * 3, "m/s²", 3),
      S("plELS", sub("S", "e,max") + " ELS", "× " + fmt(I.yt, 3), ag * Sx * eta * 2.5 * I.yt, "m/s²", 3)],
      tables: [{ title: "Valeurs remarquables", head: ["T (s)", "S<sub>e</sub>/a<sub>g</sub>", "S<sub>e</sub> (m/s²)", "S<sub>ve</sub> (m/s²)"], rows: tab, d: [3, 3, 3] }],
      fig: figSpectre(pts), vals: { r055: seH(0.55, Sx, TB, TC, TD, eta), r2: seH(2, Sx, TB, TC, TD, eta), v1: seV(1.0, vB, vC, vD, eta) } };
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
  return svg(220, 130, b + `<text x="188" y="20" fill="${INK}" stroke="none" font-size="9">élastomère</text><text x="188" y="34" fill="#8aa4c8" stroke="none" font-size="9">frettes</text>`); }
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
