/* ════════════════════════════════════════════════════════════════════
   HandBag — Précontrainte (BPEL 91 révisé 99 et NF EN 1992-1-1 / -2)
   Unités : m, MN ou kN (indiqué), MPa, mm² pour les aciers de précontrainte.
   Conventions : excentricité e comptée positivement vers le bas (sous G).
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, logRange, gauge, tag } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), ln = Math.log;
const SEC = [H("Section (béton seul ou homogénéisée)"), N("A", "Aire", "m²", 0.8, "B"), N("I", "Inertie", "m⁴", 0.33, "I"), N("v", "Distance de G à la fibre supérieure", "m", 0.7, "v"), N("vp", "Distance de G à la fibre inférieure", "m", 1.1, L`v'`)];

/* coupe schématique d'une poutre en I avec G, noyau central et câble */
function girder(o) {
  const W = 330, Hh = o.H || 175, top = 16, hh = Hh - 34, k = hh / (o.v + o.vp), cx = 90, yG = top + o.v * k, X = 60;
  let s = Rc(cx - 52, top, 104, 16) + Rc(cx - 8, top + 15, 16, hh - 40) + P(`M${cx - 8} ${top + hh - 26}L${cx - 30} ${top + hh - 12}V${top + hh}H${cx + 30}V${top + hh - 12}L${cx + 8} ${top + hh - 26}Z`, { c: K.concD, f: K.conc, w: .8 });
  s += P(`M${cx - 62} ${yG}H${cx + 70}`, { c: K.mute, w: .8, dash: "3 2" }) + T(cx + 72, yG + 3, "G", { s: 9.5, w: 500 });
  if (o.c !== undefined) { s += Rc(cx - 3, yG - o.c * k, 6, (o.c + o.cp) * k, { f: K.gold, c: K.gold, op: .55 }) + T(cx + 12, yG - o.c * k + 3, "c = ρv", { s: 8.5, c: K.gold }) + T(cx + 12, yG + o.cp * k + 3, "c' = ρv'", { s: 8.5, c: K.gold }); }
  if (o.e !== undefined) s += Ci(cx, yG + o.e * k, 4.5, { f: K.red, c: "#fff" }) + T(cx - 12, yG + o.e * k + 3, o.eL || "câble", { a: "end", s: 8.5, c: K.red });
  if (o.stress) { const g0 = 210, sc = 40 / max(...o.stress.flat().map(abs), 1e-9);
    o.stress.forEach((st, i) => { const x0 = g0 + i * 62; s += P(`M${x0} ${top}V${top + hh}`, { c: K.ink, w: .8 }) + P(`M${x0} ${top}L${x0 - st[0] * sc} ${top}L${x0 - st[1] * sc} ${top + hh}L${x0} ${top + hh}Z`, { c: K.blue, f: K.blueL, w: .8, op: .9 });
      s += T(x0, top - 4, o.sl[i], { a: "middle", s: 8.5, c: K.mute }) + T(x0 + 3, top + 9, f2(st[0], 1), { s: 8.5 }) + T(x0 + 3, top + hh - 2, f2(st[1], 1), { s: 8.5 }); }); }
  s += dimV(cx - 64, top, top + hh, `h = ${f2(o.v + o.vp, 2)}`);
  return svg(W, Hh, s);
}

HB.add("Précontrainte", [

{ id: "pc-frottement-recul", t: "Pertes par frottement et par recul d'ancrage", ref: "BPEL 91 — art. 3.3.1, 3.3.21 (recul) ; NF EN 1992-1-1 §5.10.5.2, 5.10.5.3",
  desc: "Tension le long d'un câble tendu par une extrémité, longueur d'influence du recul d'ancrage et tension à l'ancrage après blocage.",
  inputs: [N("s0", "Tension à l'origine (avant blocage)", "MPa", 1488, L`\sigma_0`), N("L", "Longueur du câble", "m", 40, "L"), N("al", "Déviation angulaire totale", "rad", 0.35, L`\alpha`),
    N("f", "Coefficient de frottement en courbe", "rad⁻¹", 0.18, L`f\ (\mu)`), N("phi", "Coefficient de frottement en ligne", "m⁻¹", 0.002, L`\varphi\ (\mu k)`),
    N("g", "Recul d'ancrage", "mm", 6, "g"), N("Ep", "Module de l'acier", "MPa", 195000, L`E_p`)],
  calc(I) {
    const k = I.f * I.al / I.L + I.phi, sL = I.s0 * exp(-k * I.L), q = I.g / 1000 * I.Ep * k / I.s0, lam = q < 1 ? -ln(1 - sqrt(q)) / k : Infinity;
    const s0p = I.s0 * exp(-2 * k * lam), sl = I.s0 * exp(-k * lam);
    return { steps: [S("k", "k", L`\dfrac{f\,\alpha}{L} + \varphi` + "\\quad\\text{(déviation répartie)}", k, "m⁻¹", 5), R("sL", L`\sigma(L)`, L`\sigma_0\,e^{-(f\alpha + \varphi L)}`, sL, "MPa", 1),
      S("pf", L`\Delta\sigma_{frot}(L)`, L`\sigma_0 - \sigma(L)`, I.s0 - sL, "MPa", 1),
      R("lam", L`\lambda`, L`-\dfrac{1}{k}\ln\left(1 - \sqrt{\dfrac{g\,E_p\,k}{\sigma_0}}\right)`, lam, "m", 2), S("sl", L`\sigma(\lambda)`, L`\sigma_0\,e^{-k\lambda}`, sl, "MPa", 1),
      R("s0p", L`\sigma_0'`, L`\dfrac{\sigma(\lambda)^2}{\sigma_0}`, s0p, "MPa", 1), S("pr", L`\Delta\sigma_{recul}(0)`, L`\sigma_0 - \sigma_0'`, I.s0 - s0p, "MPa", 1)],
      checks: [C("Longueur d'influence inférieure à la longueur du câble : $\\lambda \\le L$", lam <= I.L, `${f2(lam, 1)} ≤ ${f2(I.L, 1)} m`, lam / I.L)],
      notes: ["Le recul se répartit symétriquement (en échelle logarithmique) autour de $\\sigma(\\lambda)$ : $\\sigma'(x) = \\sigma(\\lambda)^2/\\sigma(x)$ pour $x \\le \\lambda$ ; l'aire comprise entre les deux courbes vaut $g\\,E_p$ (résolution exacte). Valeurs BPEL : $f = 0{,}16$ à 0,20 rad⁻¹, $\\varphi = 0{,}002$ m⁻¹ (gaines métalliques) ; EC2 : $\\mu = 0{,}19$, $k = 0{,}005$ à 0,01 rad/m.", "Si $\\lambda > L$, le recul affecte tout le câble : le calcul simplifié n'est plus valable."] };
  },
  fig(I, g) {
    const k = g("k"), lam = g("lam"), xs = range(0, I.L, 80), s = x => I.s0 * exp(-k * x), sl = g("sl");
    return plot({ series: [{ pts: xs.map(x => [x, s(x)]), l: "après frottement", c: K.mute, w: 1.4, dash: "5 3" }, { pts: xs.map(x => [x, x < lam ? sl * sl / s(x) : s(x)]), l: "après recul d'ancrage" }],
      vlines: [{ x: min(lam, I.L), l: `λ = ${f2(lam, 1)} m`, c: K.red }], marks: [{ x: 0, y: g("s0p"), l: `σ0' = ${f2(g("s0p"), 0)}` }, { x: I.L, y: g("sL"), l: `${f2(g("sL"), 0)} MPa` }], xl: "abscisse x (m)", yl: "σp (MPa)", ymin: I.s0 * 0.8, ymax: I.s0 * 1.02 });
  },
  clair: (I, g) => `Le frottement fait perdre ${f2((I.s0 - g("sL")) / I.s0 * 100, 0)} % de tension au bout du câble ; au blocage, le recul de ${f2(I.g, 0)} mm se fait sentir sur ${f2(g("lam"), 1)} m et ramène la tension d'ancrage à ${f2(g("s0p"), 0)} MPa.` },

{ id: "pc-raccourcissement", t: "Perte par raccourcissement élastique du béton", ref: "BPEL 91 — art. 3.3.23 ; NF EN 1992-1-1 — §5.10.5.1 (5.44)",
  desc: "Perte due à la mise en tension successive des câbles : chaque câble tendu raccourcit le béton et détend les câbles déjà bloqués.",
  inputs: [N("sb", "Contrainte du béton au niveau des câbles (P + charges permanentes à la mise en tension)", "MPa", 9, L`\Delta\sigma_b`), N("n", "Nombre de câbles (ou de groupes tendus)", "U", 6, "n"),
    N("fcj", "Résistance du béton à la mise en tension", "MPa", 30, L`f_{cj}`), N("Ep", "Module de l'acier", "MPa", 195000, L`E_p`), N("s0", "Tension initiale (pour le pourcentage)", "MPa", 1400, L`\sigma_{pi}`)],
  calc(I) {
    const Eij = 11000 * Math.cbrt(I.fcj), n = max(1, Math.round(I.n)), dB = 0.5 * I.Ep / Eij * I.sb, dE = (n - 1) / (2 * n) * I.Ep / Eij * I.sb;
    return { steps: [S("Eij", L`E_{ij}`, L`11\,000\,f_{cj}^{1/3}`, Eij, "MPa", 0), S("ratio", L`E_p/E_{ij}`, "", I.Ep / Eij, "", 3),
      R("dB", L`\Delta\sigma_{pe}^{BPEL}`, L`\dfrac{1}{2}\,\dfrac{E_p}{E_{ij}}\,\Delta\sigma_b`, dB, "MPa", 1), R("dE", L`\Delta\sigma_{pe}^{EC2}`, L`\dfrac{n - 1}{2\,n}\,\dfrac{E_p}{E_{cm}(t)}\,\Delta\sigma_c`, dE, "MPa", 1),
      S("pct", "", "~perte BPEL rapportée à la tension initiale", dB / I.s0 * 100, "%", 2)],
      notes: ["Le BPEL retient forfaitairement la moitié de la perte maximale, ce qui correspond à $n \\to \\infty$ ; l'EC2 tient compte du nombre réel de mises en tension. Pour l'EC2, $E_{cm}(t)$ remplace $E_{ij}$ (ici pris égal pour comparaison). En prétension, la perte totale vaut $\\dfrac{E_p}{E_{cm}}\\,\\sigma_c$."] };
  },
  fig(I, g) { const n = max(1, Math.round(I.n)); return plot({ series: [{ pts: range(1, 20, 19).map(m => [m, (m - 1) / (2 * m) * g("ratio") * I.sb]), l: "EC2 : (n−1)/2n" }], hlines: [{ y: g("dB"), l: `BPEL : ½ → ${f2(g("dB"), 0)} MPa`, c: K.blue }], marks: [{ x: min(n, 20), y: g("dE"), l: `${f2(g("dE"), 0)} MPa` }], xl: "nombre de câbles tendus successivement", yl: "perte (MPa)", ymin: 0, ymax: g("dB") * 1.25, xstep: 2 }); },
  clair: (I, g) => `En tendant les câbles l'un après l'autre, le béton se raccourcit : les premiers câbles perdent en moyenne ${f2(g("dB"), 0)} MPa (${f2(g("pct"), 1)} %) selon le BPEL.` },

{ id: "pc-relaxation", t: "Perte par relaxation des aciers de précontrainte", ref: "BPEL 91 — art. 3.3.24 ; NF EN 1992-1-1 — §3.3.2 (3.29), classe 2",
  desc: "Relaxation finale selon le BPEL et évolution dans le temps selon l'Eurocode 2 (torons et fils à très basse relaxation).",
  inputs: [N("spi", "Tension initiale (après pertes instantanées)", "MPa", 1350, L`\sigma_{pi}`), N("fprg", "Résistance garantie à la rupture", "MPa", 1860, L`f_{prg}\ (f_{pk})`),
    N("r1000", "Relaxation à 1 000 h", "%", 2.5, L`\rho_{1000}`), SEL("mu0", "Coefficient µ₀ (BPEL)", [["0.43", "Très basse relaxation (0,43)"], ["0.30", "Relaxation normale (0,30)"], ["0.35", "Autres aciers (0,35)"]], "0.43", L`\mu_0`),
    N("t", "Durée (EC2)", "h", 500000, "t")],
  calc(I) {
    const mu = I.spi / I.fprg, dB = 6 / 100 * I.r1000 * (mu - +I.mu0) * I.spi, rE = 0.66 * I.r1000 * exp(9.1 * mu) * pow(I.t / 1000, 0.75 * (1 - mu)) * 1e-5, dE = rE * I.spi;
    return { steps: [S("mu", L`\mu`, L`\dfrac{\sigma_{pi}}{f_{prg}}`, mu, "", 4), R("dB", L`\Delta\sigma_\rho^{BPEL}`, L`\dfrac{6}{100}\,\rho_{1000}\,(\mu - \mu_0)\,\sigma_{pi}`, max(dB, 0), "MPa", 1),
      R("dE", L`\Delta\sigma_{pr}^{EC2}`, L`0{,}66\,\rho_{1000}\,e^{9{,}1\mu}\left(\dfrac{t}{1000}\right)^{0{,}75(1-\mu)} 10^{-5}\,\sigma_{pi}`, dE, "MPa", 1),
      S("pB", "", "~perte BPEL / tension initiale", max(dB, 0) / I.spi * 100, "%", 2), S("pE", "", "~perte EC2 / tension initiale", rE * 100, "%", 2)],
      notes: ["EC2 : la valeur finale se prend à $t = 500\\,000$ h (§3.3.2 (8)). Dans les pertes différées, la relaxation est réduite par l'interaction avec le retrait et le fluage : coefficient 5/6 (BPEL) ou 0,8 (EC2, formule 5.46)."] };
  },
  fig(I, g) {
    const mu = g("mu"), f = t => 0.66 * I.r1000 * exp(9.1 * mu) * pow(t / 1000, 0.75 * (1 - mu)) * 1e-5 * I.spi, ts = logRange(10, 1e6, 60);
    return plot({ logx: true, series: [{ pts: ts.map(t => [t, f(t)]), l: "EC2 classe 2" }], hlines: [{ y: g("dB"), l: `BPEL final : ${f2(g("dB"), 0)} MPa`, c: K.blue }], vlines: [{ x: 1000, l: "1 000 h" }, { x: 500000 }], marks: [{ x: min(max(I.t, 10), 1e6), y: g("dE"), l: `${f2(g("dE"), 0)} MPa` }], xl: "durée (heures, échelle log)", yl: "perte (MPa)", xmin: 10, xmax: 1e6, ymin: 0 });
  },
  clair: (I, g) => `Tendu à ${f2(g("mu") * 100, 0)} % de sa résistance, l'acier se détend lentement de ${f2(g("dE"), 0)} MPa (${f2(g("pE"), 1)} %) au cours de la vie de l'ouvrage.` },

{ id: "pc-pertes-bpel", t: "Pertes différées de précontrainte (BPEL)", ref: "BPEL 91 révisé 99 — art. 3.3.21 à 3.3.25",
  desc: "Pertes par retrait, fluage et relaxation, et leur cumul forfaitaire.",
  inputs: [N("spi", "Tension après pertes instantanées", "MPa", 1350, L`\sigma_{pi}`), N("fprg", "Résistance garantie", "MPa", 1860, L`f_{prg}`), N("r1000", "Relaxation à 1 000 h", "%", 2.5, L`\rho_{1000}`),
    N("mu0", "Coefficient µ₀", "", 0.43, L`\mu_0`), N("er", "Retrait final du béton", "", 3e-4, L`\varepsilon_r`), N("rt0", "Retrait déjà effectué à la mise en tension", "", 0.2, L`r(t_0)`),
    N("sb", "Contrainte finale du béton au niveau du câble", "MPa", 8, L`\sigma_b`), N("sM", "Contrainte maximale au niveau du câble", "MPa", 10, L`\sigma_M`),
    N("fcj", "Résistance du béton (module Eij)", "MPa", 35, L`f_{cj}`), N("Ep", "Module de l'acier", "MPa", 195000, L`E_p`)],
  calc(I) {
    const Eij = 11000 * Math.cbrt(I.fcj), dr = I.Ep * I.er * (1 - I.rt0), sM = min(I.sM, 1.5 * I.sb), dfl = (I.sb + sM) * I.Ep / Eij;
    const drho = max(0, 6 / 100 * I.r1000 * (I.spi / I.fprg - I.mu0) * I.spi), tot = dr + dfl + 5 / 6 * drho;
    return { steps: [S("Eij", L`E_{ij}`, L`11\,000\,f_{cj}^{1/3}`, Eij, "MPa", 0), R("dr", L`\Delta\sigma_r`, L`E_p\,\varepsilon_r\,\left[1 - r(t_0)\right]`, dr, "MPa", 1),
      R("dfl", L`\Delta\sigma_{fl}`, L`(\sigma_b + \sigma_M)\,\dfrac{E_p}{E_{ij}},\ \ \sigma_M \le 1{,}5\,\sigma_b`, dfl, "MPa", 1),
      R("drho", L`\Delta\sigma_\rho`, L`\dfrac{6}{100}\,\rho_{1000}\left(\dfrac{\sigma_{pi}}{f_{prg}} - \mu_0\right)\sigma_{pi}`, drho, "MPa", 1),
      R("tot", L`\Delta\sigma_d`, L`\Delta\sigma_r + \Delta\sigma_{fl} + \tfrac{5}{6}\,\Delta\sigma_\rho`, tot, "MPa", 1), S("pct", "", "~en pourcentage de $\\sigma_{pi}$", tot / I.spi * 100, "%", 1),
      S("sinf", L`\sigma_{p\infty}`, L`\sigma_{pi} - \Delta\sigma_d`, I.spi - tot, "MPa", 1)],
      notes: ["$\\varepsilon_r$ (BPEL art. 2.1.5) : $1{,}5\\cdot10^{-4}$ en climat très humide, $2\\cdot10^{-4}$ humide, $3\\cdot10^{-4}$ tempéré sec, $4\\cdot10^{-4}$ chaud et sec, $5\\cdot10^{-4}$ très sec ou désertique. $\\sigma_b$ et $\\sigma_M$ : contraintes finale et maximale du béton au niveau du câble moyen sous charges permanentes."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "retrait", v: g("dr"), u: "MPa", d: 0, c: K.gold }, { l: "fluage", v: g("dfl"), u: "MPa", d: 0, c: K.blue }, { l: "5/6 relaxation", v: 5 / 6 * g("drho"), u: "MPa", d: 0, c: K.teal }, { l: "total différé", v: g("tot"), u: "MPa", d: 0, c: K.red }], { title: `Pertes différées : ${f2(g("pct"), 1)} % de σpi`, left: 92 }); },
  clair: (I, g) => `Au fil des années, retrait, fluage et relaxation font perdre ${f2(g("tot"), 0)} MPa aux câbles, soit ${f2(g("pct"), 0)} % de leur tension : il reste ${f2(g("sinf"), 0)} MPa.` },

{ id: "pc-pertes-ec2", t: "Pertes différées de précontrainte (Eurocode 2)", ref: "NF EN 1992-1-1 — §5.10.6 (5.46)",
  desc: "Méthode simplifiée de l'Eurocode 2 : retrait, fluage et relaxation en interaction, au niveau du câble.",
  inputs: [N("ecs", "Déformation de retrait", "", 3e-4, L`\varepsilon_{cs}`), N("dspr", "Perte par relaxation (pure)", "MPa", 60, L`\Delta\sigma_{pr}`), N("phi", "Coefficient de fluage", "", 1.8, L`\varphi(t,t_0)`),
    N("scqp", "Contrainte du béton au niveau des câbles (quasi permanent)", "MPa", 8, L`\sigma_{c,QP}`), N("Ap", "Aire des câbles", "mm²", 9000, L`A_p`),
    N("Ac", "Aire de béton", "m²", 0.8, L`A_c`), N("Ic", "Inertie", "m⁴", 0.33, L`I_c`), N("zcp", "Excentricité des câbles", "m", 0.85, L`z_{cp}`), N("Ecm", "Module du béton", "MPa", 34000, L`E_{cm}`), N("Ep", "Module de l'acier", "MPa", 195000, L`E_p`), N("spi", "Tension initiale", "MPa", 1350, L`\sigma_{pi}`)],
  calc(I) {
    const n = I.Ep / I.Ecm, Ap = I.Ap / 1e6, num = I.ecs * I.Ep + 0.8 * I.dspr + n * I.phi * I.scqp, den = 1 + n * Ap / I.Ac * (1 + I.Ac / I.Ic * I.zcp ** 2) * (1 + 0.8 * I.phi), d = num / den;
    return { steps: [S("n", L`\dfrac{E_p}{E_{cm}}`, "", n, "", 3), S("t1", "", "~retrait : $\\varepsilon_{cs}E_p$", I.ecs * I.Ep, "MPa", 1), S("t2", "", "~relaxation : $0{,}8\\,\\Delta\\sigma_{pr}$", 0.8 * I.dspr, "MPa", 1),
      S("t3", "", "~fluage : $\\dfrac{E_p}{E_{cm}}\\varphi\\,\\sigma_{c,QP}$", n * I.phi * I.scqp, "MPa", 1),
      S("den", "", L`1 + \dfrac{E_p}{E_{cm}}\,\dfrac{A_p}{A_c}\left(1 + \dfrac{A_c}{I_c}z_{cp}^2\right)\left[1 + 0{,}8\,\varphi(t,t_0)\right]`, den, "", 4),
      R("d", L`\Delta\sigma_{p,c+s+r}`, L`\dfrac{\varepsilon_{cs}E_p + 0{,}8\,\Delta\sigma_{pr} + \dfrac{E_p}{E_{cm}}\varphi\,\sigma_{c,QP}}{1 + \dots}`, d, "MPa", 1),
      S("pct", "", "~en pourcentage de $\\sigma_{pi}$", d / I.spi * 100, "%", 1), R("dP", L`\Delta P_{c+s+r}`, L`A_p\,\Delta\sigma_{p,c+s+r}`, Ap * d * 1000, "kN", 0)],
      notes: ["Formule (5.46), câbles adhérents, $\\sigma_{c,QP}$ au niveau des câbles sous poids propre, précontrainte initiale et autres actions quasi permanentes. $\\Delta\\sigma_{pr}$ : voir la feuille « Relaxation » (calculée avec $\\sigma_p$ dû à P et aux charges QP)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "retrait", v: g("t1"), u: "MPa", d: 0, c: K.gold }, { l: "fluage", v: g("t3"), u: "MPa", d: 0, c: K.blue }, { l: "0,8 relaxation", v: g("t2"), u: "MPa", d: 0, c: K.teal }, { l: "total (÷ interaction)", v: g("d"), u: "MPa", d: 0, c: K.red }], { title: `Pertes différées : ${f2(g("pct"), 1)} %`, left: 104 }); },
  clair: (I, g) => `Les pertes différées atteignent ${f2(g("d"), 0)} MPa (${f2(g("pct"), 0)} %), soit ${f2(g("dP"), 0)} kN de précontrainte en moins à long terme.` },

{ id: "pc-contraintes", t: "Contraintes normales sous précontrainte et charges", ref: "BPEL 91 — art. 6.1 ; NF EN 1992-1-1 — §5.10.2.2, §7.2",
  desc: "Contraintes aux fibres extrêmes à vide (précontrainte maximale, moment minimal) et en service (précontrainte minimale, moment maximal).",
  inputs: [...SEC, H("Précontrainte et moments"), N("Pmax", "Précontrainte maximale (à vide)", "MN", 8.3, L`P_{max}`), N("Pmin", "Précontrainte minimale (en service)", "MN", 7.3, L`P_{min}`),
    N("e", "Excentricité du câble (sous G)", "m", 0.9, L`e_0`), N("Mm", "Moment minimal", "MN·m", 4.5, L`M_m`), N("MM", "Moment maximal", "MN·m", 9, L`M_M`),
    H("Limites"), N("sc", "Compression admissible", "MPa", 21, L`\bar\sigma_c`), N("st", "Traction admissible (négatif)", "MPa", 0, L`\bar\sigma_t`)],
  calc(I) {
    const st = (Pf, M) => [Pf / I.A + (M - Pf * I.e) * I.v / I.I, Pf / I.A - (M - Pf * I.e) * I.vp / I.I];
    const [s1, i1] = st(I.Pmax, I.Mm), [s2, i2] = st(I.Pmin, I.MM), ok = x => x >= I.st - 1e-9 && x <= I.sc + 1e-9;
    return { steps: [S("W", L`\dfrac{I}{v}\ ;\ \dfrac{I}{v'}`, "", `${f2(I.I / I.v, 3)} ; ${f2(I.I / I.vp, 3)}`, "m³", 0),
      R("s1", L`\sigma_{sup}^{vide}`, L`\dfrac{P_{max}}{B} + \dfrac{(M_m - P_{max}\,e_0)\,v}{I}`, s1, "MPa", 2), R("i1", L`\sigma_{inf}^{vide}`, L`\dfrac{P_{max}}{B} - \dfrac{(M_m - P_{max}\,e_0)\,v'}{I}`, i1, "MPa", 2),
      R("s2", L`\sigma_{sup}^{serv}`, L`\dfrac{P_{min}}{B} + \dfrac{(M_M - P_{min}\,e_0)\,v}{I}`, s2, "MPa", 2), R("i2", L`\sigma_{inf}^{serv}`, L`\dfrac{P_{min}}{B} - \dfrac{(M_M - P_{min}\,e_0)\,v'}{I}`, i2, "MPa", 2)],
      checks: [C("À vide : fibre supérieure dans les limites", ok(s1), `${f2(s1)} MPa`), C("À vide : fibre inférieure ≤ compression admissible", ok(i1), `${f2(i1)} ≤ ${f2(I.sc, 1)} MPa`, i1 / I.sc),
        C("En service : fibre supérieure ≤ compression admissible", ok(s2), `${f2(s2)} ≤ ${f2(I.sc, 1)} MPa`, s2 / I.sc), C("En service : fibre inférieure ≥ traction admissible", ok(i2), `${f2(i2)} ≥ ${f2(I.st, 2)} MPa`)],
      notes: ["Compression comptée positivement. EC2 : $\\bar\\sigma_c = 0{,}6\\,f_{ck}$ (caractéristique, classes XD/XF/XS) ou $0{,}6\\,f_{ck}(t)$ à la mise en tension (§5.10.2.2) ; décompression ($\\bar\\sigma_t = 0$) sous combinaison fréquente ou quasi permanente selon la classe d'exposition (NF EN 1992-2, tableau 7.101NF). BPEL classe II : $\\bar\\sigma_t = -f_{tj}$ hors zone d'enrobage."] };
  },
  fig(I, g) { return girder({ v: I.v, vp: I.vp, e: I.e, stress: [[g("s1"), g("i1")], [g("s2"), g("i2")]], sl: ["à vide", "en service"] }); },
  clair: (I, g) => `À vide, la fibre basse est comprimée à ${f2(g("i1"), 1)} MPa ; en service, elle descend à ${f2(g("i2"), 1)} MPa et la fibre haute monte à ${f2(g("s2"), 1)} MPa.` },

{ id: "pc-noyau", t: "Noyau central et rendement géométrique", ref: "Résistance des matériaux ; BPEL 91 — art. 6.1.2 (précontrainte minimale)",
  desc: "Rendement de la section, position des limites du noyau central et excentricité maximale possible du câble.",
  inputs: [...SEC, N("dp", "Enrobage du câble (axe à la fibre inférieure)", "m", 0.15, L`d'`)],
  calc(I) {
    const rho = I.I / (I.A * I.v * I.vp), c = rho * I.v, cp = rho * I.vp, emax = I.vp - I.dp;
    return { steps: [R("rho", L`\rho`, L`\dfrac{I}{B\,v\,v'}`, rho, "", 4), S("i2", L`i^2`, L`\dfrac{I}{B}`, I.I / I.A, "m²", 4), R("c", "c", L`\rho\,v` + "\\quad\\text{(au-dessus de G)}", c, "m", 3),
      R("cp", L`c'`, L`\rho\,v'` + "\\quad\\text{(au-dessous de G)}", cp, "m", 3), S("emax", L`e_{0,max}`, L`v' - d'`, emax, "m", 3), S("h", "h", L`v + v'`, I.v + I.vp, "m", 3)],
      notes: ["Une force de compression appliquée à l'intérieur du noyau $[-c' ; +c]$ ne crée aucune traction. $\\rho \\approx 1/3$ pour un rectangle ; 0,45 à 0,55 pour les poutres en I ou les caissons (sections efficaces)."] };
  },
  fig(I, g) { return girder({ v: I.v, vp: I.vp, c: g("c"), cp: g("cp"), e: g("emax"), eL: "câble (e max)" }); },
  clair: (I, g) => `Le rendement de la section vaut ${f2(g("rho"), 2)} : tant que la résultante de compression reste entre ${f2(g("c"), 2)} m au-dessus et ${f2(g("cp"), 2)} m au-dessous du centre de gravité, aucune fibre n'est tendue.` },

{ id: "pc-pmin", t: "Précontrainte minimale : sections sous- et sur-critiques", ref: "BPEL 91 — art. 6.1.2 ; méthode de Guyon (traction nulle)",
  desc: "Force de précontrainte minimale permettant de reprendre la variation de moment sans traction, et nature de la section.",
  inputs: [...SEC, N("dp", "Enrobage du câble (axe)", "m", 0.15, L`d'`), N("Mm", "Moment minimal", "MN·m", 4.5, L`M_m`), N("MM", "Moment maximal", "MN·m", 9, L`M_M`)],
  calc(I) {
    const h = I.v + I.vp, rho = I.I / (I.A * I.v * I.vp), dM = I.MM - I.Mm, P1 = dM / (rho * h), P2 = I.MM / (rho * I.v + I.vp - I.dp), sur = P2 > P1, Pm = max(P1, P2);
    const e0 = sur ? I.vp - I.dp : rho * I.vp + I.Mm / P1;
    return { steps: [S("rho", L`\rho`, L`\dfrac{I}{B\,v\,v'}`, rho, "", 4), S("dM", L`\Delta M`, L`M_M - M_m`, dM, "MN·m", 3),
      R("P1", L`P_I`, L`\dfrac{\Delta M}{\rho\,h}` + "\\quad\\text{(sous-critique)}", P1, "MN", 3), R("P2", L`P_{II}`, L`\dfrac{M_M}{\rho\,v + v' - d'}` + "\\quad\\text{(sur-critique)}", P2, "MN", 3),
      S("nat", "", "~nature de la section", sur ? "sur-critique" : "sous-critique", "", 0), R("Pm", L`P_{min}`, L`\max(P_I\ ;\ P_{II})`, Pm, "MN", 3), S("e0", L`e_0`, sur ? L`v' - d'\ \ \text{(câble au plus bas)}` : L`c' + \dfrac{M_m}{P_I}`, e0, "m", 3)],
      notes: ["Section sous-critique : le fuseau de passage est entièrement dans la section, $P_I$ suffit. Section sur-critique : le fuseau sort de la section par le bas ; le câble est placé au plus bas et $P_{II}$ gouverne. $P_{min}$ est la précontrainte à long terme (après toutes les pertes)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "PI (ΔM / ρh)", v: g("P1"), u: "MN", c: g("nat") === "sous-critique" ? K.red : K.gold }, { l: "PII (sur-critique)", v: g("P2"), u: "MN", c: g("nat") === "sur-critique" ? K.red : K.blue }], { title: `Section ${g("nat")} : Pmin = ${f2(g("Pm"), 2)} MN`, left: 104 }); },
  clair: (I, g) => `Il faut au moins ${f2(g("Pm"), 2)} MN de précontrainte à long terme pour que la poutre ne soit jamais tendue ; la section est ${g("nat")}.` },

{ id: "pc-fuseau", t: "Fuseau de passage du câble moyen", ref: "BPEL 91 — art. 6.1 ; limites du noyau central sous $M_m$ et $M_M$",
  desc: "Zone dans laquelle doit passer le câble moyen d'une travée isostatique pour qu'aucune fibre ne soit tendue.",
  inputs: [N("L", "Portée", "m", 33, "L"), N("P", "Précontrainte à long terme", "MN", 7.3, "P"), N("Mm", "Moment minimal à mi-travée", "MN·m", 4.5, L`M_m`), N("MM", "Moment maximal à mi-travée", "MN·m", 9, L`M_M`),
    ...SEC.slice(1), N("dp", "Enrobage du câble (axe)", "m", 0.15, L`d'`), N("em", "Excentricité du câble à mi-travée", "m", 0.93, L`e_0`)],
  calc(I) {
    const rho = I.I / (I.A * I.v * I.vp), lo = rho * I.vp + I.Mm / I.P, hi = -rho * I.v + I.MM / I.P;   // e (sous G) : hi ≤ e ≤ lo
    const ok = I.em <= lo + 1e-9 && I.em >= hi - 1e-9 && I.em <= I.vp - I.dp;
    return { steps: [S("rho", L`\rho`, L`\dfrac{I}{B\,v\,v'}`, rho, "", 4), R("lo", L`e_{inf}`, L`\rho\,v' + \dfrac{M_m}{P}` + "\\quad\\text{(limite basse)}", lo, "m", 3),
      R("hi", L`e_{sup}`, L`\dfrac{M_M}{P} - \rho\,v` + "\\quad\\text{(limite haute)}", hi, "m", 3), S("w", "", "~épaisseur du fuseau", lo - hi, "m", 3), S("emax", L`v' - d'`, "~excentricité maximale physique", I.vp - I.dp, "m", 3)],
      checks: [C("Le fuseau existe : $e_{sup} \\le e_{inf}$ (soit $P \\ge \\Delta M/\\rho h$)", hi <= lo, `${f2(hi, 3)} ≤ ${f2(lo, 3)} m`), C("Le câble passe dans le fuseau et dans la section", ok, `e0 = ${f2(I.em, 3)} m`)],
      notes: ["Moments paraboliques (charges réparties) : $M(x) = 4\\,M\\,\\dfrac{x\\,(L - x)}{L^2}$. Le fuseau est tracé sous G (excentricités positives vers le bas). Section sur-critique : la limite basse sort de la section ($e_{inf} > v' - d'$)."] };
  },
  fig(I, g) {
    const rho = g("rho"), xs = range(0, I.L, 60), m = (M, x) => 4 * M * x * (I.L - x) / I.L ** 2, lo = x => rho * I.vp + m(I.Mm, x) / I.P, hi = x => -rho * I.v + m(I.MM, x) / I.P, cab = x => 4 * I.em * x * (I.L - x) / I.L ** 2;
    return plot({ series: [{ pts: xs.map(x => [x, -lo(x)]), l: "limite basse", c: K.blue, w: 1.4 }, { pts: xs.map(x => [x, -hi(x)]), l: "limite haute", c: K.teal, w: 1.4 }, { pts: xs.map(x => [x, -cab(x)]), l: "câble moyen", c: K.red, w: 2 }],
      hlines: [{ y: I.v, l: "fibre sup.", c: K.mute }, { y: -I.vp, l: "fibre inf.", c: K.mute }], xl: "x (m)", yl: "cote / G (m)", ymin: -I.vp * 1.15, ymax: I.v * 1.3 });
  },
  clair: (I, g) => `À mi-travée, le câble doit passer entre ${f2(g("hi"), 2)} m et ${f2(g("lo"), 2)} m sous le centre de gravité ; à ${f2(I.em, 2)} m, il ${g("hi") <= I.em && I.em <= g("lo") ? "est bien placé" : "sort du fuseau"}.` },

{ id: "pc-parabole", t: "Câble parabolique : géométrie et charge équivalente", ref: "Méthode des charges équivalentes ; BPEL 91 — art. 3.3.1",
  desc: "Tracé parabolique entre deux ancrages, pente aux extrémités, déviation angulaire et charges équivalentes à la précontrainte.",
  inputs: [N("L", "Longueur entre ancrages", "m", 33, "L"), N("f", "Flèche du câble (corde → point bas)", "m", 0.75, "f"), N("P", "Force de précontrainte", "kN", 7000, "P"), N("x", "Abscisse étudiée", "m", 8, "x")],
  calc(I) {
    const q = 8 * I.P * I.f / I.L ** 2, a0 = Math.atan(4 * I.f / I.L), y = 4 * I.f * I.x * (I.L - I.x) / I.L ** 2, sl = 4 * I.f * (I.L - 2 * I.x) / I.L ** 2;
    return { steps: [R("q", "q", L`\dfrac{8\,P\,f}{L^2}`, q, "kN/m", 1), R("a0", L`\alpha_0`, L`\arctan\dfrac{4\,f}{L}`, a0, "rad", 4), S("a0d", "", "~en degrés", a0 * 180 / PI, "°", 2),
      S("dev", L`\alpha_{tot}`, L`2\,\alpha_0` + "\\quad\\text{(déviation totale)}", 2 * a0, "rad", 4), S("V", L`P\sin\alpha_0`, "~composante verticale à l'ancrage", I.P * Math.sin(a0), "kN", 1),
      S("y", L`y(x)`, L`4\,f\,\dfrac{x\,(L - x)}{L^2}`, y, "m", 3), S("sl", L`y'(x)`, L`\dfrac{4\,f\,(L - 2x)}{L^2}`, sl, "", 4)],
      notes: ["Le câble exerce sur le béton une charge uniforme $q$ dirigée vers le haut, équilibrée par les composantes verticales $P\\sin\\alpha_0$ aux ancrages : c'est la base du « balancement » des charges permanentes."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, x1 = 26, x2 = 304, yb = 40, sc = 70 / max(I.f, 0.1), X = x => x1 + (x2 - x1) * x / I.L; let s = Rc(x1, yb - 12, x2 - x1, 92, { f: "#f3efe6" });
    s += P(range(0, I.L, 60).map((x, i) => (i ? "L" : "M") + X(x).toFixed(1) + " " + (yb + 4 * I.f * x * (I.L - x) / I.L ** 2 * sc).toFixed(1)).join(""), { c: K.red, w: 2.2 });
    for (let i = 1; i < 10; i++) { const x = X(I.L * i / 10); s += arrow(x, yb + 96, x, yb + 84, K.blue, 1); }
    s += P(`M${x1} ${yb + 96}H${x2}`, { c: K.blue, w: 1 }) + T(165, yb + 112, `q = 8Pf/L² = ${f2(g("q"), 0)} kN/m (vers le haut)`, { a: "middle", s: 9.5, c: K.blue });
    s += arrow(x1 + 26, yb - 2, x1 - 4, yb - 2 - 26 * Math.tan(g("a0")) * 0 + 0, K.red, 1.6) + T(x1 + 4, yb - 16, "P", { s: 9.5, c: K.red }) + dimV(165, yb, yb + I.f * sc, `f = ${f2(I.f, 2)} m`, K.mute, 1);
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Ce câble tendu à ${f2(I.P, 0)} kN pousse la poutre vers le haut avec ${f2(g("q"), 0)} kN par mètre, comme une charge inversée.` },

{ id: "pc-hyperstatique", t: "Effets hyperstatiques de précontrainte (poutre continue à 2 travées)", ref: "BPEL 91 — art. 6.1.3 ; NF EN 1992-1-1 — §5.10.7",
  desc: "Moment isostatique, moment hyperstatique et moment total au droit de l'appui central, câble parabolique par travée.",
  inputs: [N("L", "Portée de chaque travée", "m", 30, "L"), N("P", "Précontrainte", "MN", 8, "P"), N("e1", "Excentricité à l'appui de rive (sous G)", "m", 0, L`e_1`),
    N("em", "Excentricité à mi-travée (sous G)", "m", 0.6, L`e_m`), N("e2", "Excentricité sur appui central (sous G, négatif au-dessus)", "m", -0.55, L`e_2`)],
  calc(I) {
    const e = x => { const t = x / I.L; return I.e1 * (1 - t) * (1 - 2 * t) + 4 * I.em * t * (1 - t) + I.e2 * t * (2 * t - 1); };
    const Mi = x => -I.P * e(x); let n = 200, s1 = 0; for (let i = 0; i <= n; i++) { const x = I.L * i / n, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2; s1 += w * Mi(x) * x / I.L; } s1 *= I.L / (3 * n);
    const X = -s1 / (I.L / 3), Mt = Mi(I.L) + X;
    return { steps: [S("Miso", L`M_{iso}(B)`, L`-P\,e_2`, Mi(I.L), "MN·m", 3), S("d10", L`\delta_{10}`, L`\dfrac{2}{EI}\int_0^L M_{iso}(x)\,\dfrac{x}{L}\,dx`, 2 * s1, "MN·m² / EI", 3),
      S("d11", L`\delta_{11}`, L`\dfrac{2}{EI}\int_0^L \left(\dfrac{x}{L}\right)^2 dx = \dfrac{2L}{3EI}`, 2 * I.L / 3, "m / EI", 3),
      R("X", L`M_{hyp}(B)`, L`-\dfrac{\delta_{10}}{\delta_{11}}`, X, "MN·m", 3), R("Mt", L`M_{P}(B)`, L`M_{iso}(B) + M_{hyp}(B)`, Mt, "MN·m", 3), S("ec", L`e_{conc}`, L`-\dfrac{M_P(B)}{P}`, -Mt / I.P, "m", 3),
      S("R", L`\Delta R_{A}`, L`\dfrac{M_{hyp}(B)}{L}`, X / I.L * 1000, "kN", 1)],
      notes: ["Inertie constante, câble en trois points paraboliques par travée (travées symétriques). Le moment hyperstatique varie linéairement de 0 aux appuis de rive à $M_{hyp}(B)$ ; il modifie les réactions d'appui (ΔR aux rives, −2ΔR sur l'appui central). Le câble « concordant » donnerait $M_{hyp} = 0$."] };
  },
  fig(I, g) {
    const e = x => { const t = x / I.L; return I.e1 * (1 - t) * (1 - 2 * t) + 4 * I.em * t * (1 - t) + I.e2 * t * (2 * t - 1); }, X = g("X");
    const xs = range(0, 2 * I.L, 120), Mi = x => -I.P * e(x <= I.L ? x : 2 * I.L - x), Mh = x => X * (x <= I.L ? x / I.L : (2 * I.L - x) / I.L);
    return plot({ series: [{ pts: xs.map(x => [x, Mi(x)]), l: "M isostatique −P·e", c: K.mute, w: 1.4, dash: "5 3" }, { pts: xs.map(x => [x, Mh(x)]), l: "M hyperstatique", c: K.blue, w: 1.4 }, { pts: xs.map(x => [x, Mi(x) + Mh(x)]), l: "M total" }],
      marks: [{ x: I.L, y: g("Mt"), l: `${f2(g("Mt"), 2)} MN·m` }], vlines: [{ x: I.L, l: "appui central" }], xl: "x (m)", yl: "MN·m" });
  },
  clair: (I, g) => `La continuité gêne la déformation imposée par les câbles : il apparaît ${f2(g("X"), 2)} MN·m de moment hyperstatique sur l'appui central (total ${f2(g("Mt"), 2)} MN·m).` },

{ id: "pc-about", t: "Zone d'about : frettage de surface et d'éclatement", ref: "BPEL 91 — annexe 4 ; NF EN 1992-1-1 — §5.10.2.3, §6.5.3, §6.7",
  desc: "Armatures de surface, armatures d'éclatement du prisme symétrique et pression localisée sous la plaque d'ancrage.",
  inputs: [N("P0", "Force à l'ancrage (à la mise en tension)", "kN", 2900, L`F_{j0}`), N("a", "Côté de la plaque d'ancrage", "m", 0.30, "a"), N("d", "Côté du prisme symétrique (2 × distance au bord ou entraxe)", "m", 0.60, "d"),
    N("fcj", "Résistance du béton à la mise en tension", "MPa", 30, L`f_{cj}`), N("fe", "Limite élastique des frettes", "MPa", 500, L`f_e`), N("gP", "Coefficient sur la force (effets locaux)", "", 1.2, L`\gamma_{P,unfav}`)],
  calc(I) {
    const sl = 2 / 3 * I.fe, As = 0.04 * I.P0 / 1000 / sl * 1e4, Fe = 0.25 * (1 - I.a / I.d) * I.P0, Ae = Fe / 1000 / sl * 1e4, Fu = I.gP * I.P0, fcd = I.fcj / 1.5;
    const Fr = min(I.a * I.a * fcd * sqrt((I.d * I.d) / (I.a * I.a)), 3 * fcd * I.a * I.a) * 1000;
    return { steps: [S("sl", L`\sigma_{s,lim}`, L`\tfrac{2}{3}\,f_e`, sl, "MPa", 0), R("As", L`A_s^{surf}`, L`0{,}04\,\dfrac{F_{j0}}{\sigma_{s,lim}}`, As, "cm²", 2),
      S("Fe", L`F_{\acute{e}cl}`, L`0{,}25\left(1 - \dfrac{a}{d}\right) F_{j0}`, Fe, "kN", 0), R("Ae", L`A_e`, L`\dfrac{F_{\acute{e}cl}}{\sigma_{s,lim}}` + "\\quad\\text{(par direction, entre } 0{,}1d \\text{ et } d\\text{)}", Ae, "cm²", 2),
      S("Fu", L`F_{Ed}`, L`\gamma_{P}\,F_{j0}`, Fu, "kN", 0), S("Fr", L`F_{Rdu}`, L`a^2\,f_{cd}\sqrt{\dfrac{d^2}{a^2}} \le 3\,f_{cd}\,a^2`, Fr, "kN", 0)],
      checks: [C("Pression sous la plaque : $F_{Ed} \\le F_{Rdu}$", Fu <= Fr, `${f2(Fu, 0)} ≤ ${f2(Fr, 0)} kN`, Fu / Fr)],
      notes: ["Les dispositifs d'ancrage sont couverts par leur Agrément Technique Européen (ETE) qui fixe les frettes locales, l'entraxe et la distance au bord minimaux ainsi que la résistance du béton requise : ces valeurs prévalent. Le frettage général d'équilibre (diffusion sur la hauteur de la poutre) est à traiter en complément."] };
  },
  fig(I, g) {
    const W = 330, Hh = 170, k = 130 / I.d, x0 = 30, cy = 85, hd = I.d * k / 2, ha = I.a * k / 2; let s = Rc(x0, cy - hd, 260, 2 * hd);
    s += Rc(x0, cy - ha, 8, 2 * ha, { f: K.steel, c: "#5a6f8e" }) + arrow(x0 - 22, cy, x0 - 1, cy, K.red, 2) + T(x0 - 20, cy - 6, "Fj0", { s: 9, c: K.red });
    s += P(`M${x0 + 8} ${cy - ha}C${x0 + hd * 0.8} ${cy - ha} ${x0 + hd * 1.2} ${cy - hd} ${x0 + 2 * hd} ${cy - hd}M${x0 + 8} ${cy + ha}C${x0 + hd * 0.8} ${cy + ha} ${x0 + hd * 1.2} ${cy + hd} ${x0 + 2 * hd} ${cy + hd}`, { c: K.blue, w: 1.2, dash: "4 3" });
    for (let i = 0; i < 4; i++) s += P(`M${x0 + 0.25 * hd + i * 0.45 * hd} ${cy - hd + 6}V${cy + hd - 6}`, { c: K.red, w: 2 });
    s += T(x0 + 2 * hd + 8, cy + 3, "prisme symétrique", { s: 9, c: K.blue }) + T(x0 + 0.9 * hd, cy + hd + 14, `éclatement : ${f2(g("Ae"), 1)} cm²`, { a: "middle", s: 9.5, c: K.red });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Derrière l'ancrage, l'effort s'épanouit et tend à faire éclater le béton (${f2(g("Fe"), 0)} kN) : ${f2(g("Ae"), 1)} cm² de frettes par direction, plus ${f2(g("As"), 1)} cm² en surface.` },

{ id: "pc-mise-tension", t: "Mise en tension : effort au vérin et pression au manomètre", ref: "NF EN 1992-1-1 — §5.10.2.1 (5.41) ; fascicule 65 (programme de mise en tension)",
  desc: "Tension maximale admise, force à appliquer au vérin, pression de lecture et allongement théorique attendu.",
  inputs: [N("n", "Nombre de torons", "U", 12, "n"), N("Ap1", "Section d'un toron", "mm²", 150, L`A_{p1}`), N("fpk", "Résistance caractéristique", "MPa", 1860, L`f_{pk}`), N("fp01", "Limite à 0,1 %", "MPa", 1640, L`f_{p0,1k}`),
    N("s0", "Tension visée à l'ancrage", "MPa", 1470, L`\sigma_{p0}`), N("pv", "Pertes dans le vérin et l'ancrage", "%", 2, L`\delta_v`), N("Sv", "Section utile du piston", "cm²", 1060, L`S_v`),
    N("Lc", "Longueur du câble (pour l'allongement)", "m", 40, L`L`), N("kf", "Coefficient de transmission moyen", "", 0.9, L`\bar\sigma/\sigma_0`), N("Ep", "Module", "MPa", 195000, L`E_p`)],
  calc(I) {
    const Ap = I.n * I.Ap1, smax = min(0.8 * I.fpk, 0.9 * I.fp01), F = I.s0 * Ap / 1000, Fv = F * (1 + I.pv / 100), dl = I.kf * I.s0 * I.Lc / I.Ep * 1000;
    const pbar = Fv * 1000 / (I.Sv * 100) * 10;  // kN → N, cm² → mm², MPa → bar
    return { steps: [S("Ap", L`A_p`, L`n\,A_{p1}`, Ap, "mm²", 0), S("smax", L`\sigma_{p,max}`, L`\min\left(0{,}8\,f_{pk}\ ;\ 0{,}9\,f_{p0,1k}\right)`, smax, "MPa", 0),
      R("F", L`P_0`, L`\sigma_{p0}\,A_p`, F, "kN", 0), R("Fv", L`F_{v\acute{e}rin}`, L`P_0\,(1 + \delta_v)`, Fv, "kN", 0), R("p", "p", L`\dfrac{F_{v\acute{e}rin}}{S_v}`, pbar, "bar", 0),
      R("dl", L`\Delta L`, L`\dfrac{\bar\sigma\,L}{E_p}`, dl, "mm", 0)],
      checks: [C("$\\sigma_{p0} \\le \\min(0{,}8\\,f_{pk} ; 0{,}9\\,f_{p0,1k})$", I.s0 <= smax + 1e-9, `${f2(I.s0, 0)} ≤ ${f2(smax, 0)} MPa`, I.s0 / smax)],
      notes: ["Surtension admise ponctuellement jusqu'à $0{,}95\\,f_{p0,1k}$ si le vérin mesure la force à ±5 % (§5.10.2.1 (2)). La pression lue dépend de l'étalonnage du couple vérin–manomètre : utiliser la courbe d'étalonnage du matériel. L'écart d'allongement mesuré/théorique toléré est en général de ±5 % à ±10 % (programme de mise en tension)."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "σp0 visée", v: I.s0, lim: g("smax"), u: "MPa", d: 0 }, { l: "0,8 fpk", v: 0.8 * I.fpk, c: K.mute, u: "MPa", d: 0 }, { l: "0,9 fp0,1k", v: 0.9 * I.fp01, c: K.mute, u: "MPa", d: 0 }], { title: `Vérin : ${f2(g("Fv"), 0)} kN · manomètre ${f2(g("p"), 0)} bar · ΔL ≈ ${f2(g("dl"), 0)} mm`, left: 84 }); },
  clair: (I, g) => `Pour tendre ce câble de ${Math.round(I.n)} torons, le vérin doit développer ${f2(g("Fv"), 0)} kN, soit environ ${f2(g("p"), 0)} bar au manomètre ; le câble doit s'allonger d'environ ${f2(g("dl"), 0)} mm.` },

{ id: "pc-poussee-vide", t: "Poussée au vide des câbles courbes", ref: "Équilibre d'un câble courbe ($q = P/R$) ; NF EN 1992-1-1 — §8.10.4 (ancrages et déviateurs)",
  desc: "Force radiale exercée par un câble courbe sur le béton (intrados des poutres en courbe, déviateurs, gousset) et épingles de reprise.",
  inputs: [N("P", "Force dans le câble", "kN", 3500, "P"), N("R", "Rayon de courbure", "m", 12, "R"), N("s", "Espacement des épingles", "m", 0.15, "s"), N("fe", "Limite élastique des épingles", "MPa", 500, L`f_e`)],
  calc(I) {
    const q = I.P / I.R, F = q * I.s, A = F / 1000 / (I.fe / 1.15) * 1e4, A2 = 1.2 * F / 1000 / (I.fe / 1.15) * 1e4;
    return { steps: [R("q", "q", L`\dfrac{P}{R}`, q, "kN/m", 1), S("F", L`F_s`, L`q\,s`, F, "kN", 1), R("A", L`A_{\acute{e}pingle}`, L`\dfrac{F_s}{f_{yd}}`, A, "cm²", 2), S("A2", L`A_{\acute{e}pingle}^{\gamma_P}`, L`\dfrac{1{,}2\,F_s}{f_{yd}}`, A2, "cm²", 2)],
      notes: ["Les épingles doivent entourer la gaine et être ancrées dans la masse du béton du côté opposé à la poussée. Avec $\\gamma_P = 1{,}2$ (effets locaux de la précontrainte), retenir $A^{\\gamma_P}$. Rayons minimaux des gaines : voir l'ETE du procédé (souvent $R \\ge 3$ à 6 m)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 160, cx = 165, cy = 210, r = 150; let s = P(`M${cx - 120} ${cy - sqrt(r * r - 120 * 120)}A${r} ${r} 0 0 1 ${cx + 120} ${cy - sqrt(r * r - 120 * 120)}`, { c: K.red, w: 3 });
    for (let a = -0.7; a <= 0.71; a += 0.175) { const x = cx + r * Math.sin(a), y = cy - r * Math.cos(a); s += arrow(x, y, x + 22 * Math.sin(a), y - 22 * Math.cos(a), K.blue, 1.2); }
    s += T(cx, 26, `q = P/R = ${f2(g("q"), 0)} kN/m vers l'extérieur de la courbe`, { a: "middle", s: 9.5, c: K.blue }) + T(cx - 128, cy - sqrt(r * r - 120 * 120) + 16, "P", { s: 9.5, c: K.red }) + T(cx + 122, cy - sqrt(r * r - 120 * 120) + 16, "P", { s: 9.5, c: K.red });
    return svg(W, Hh, s);
  },
  clair: (I, g) => `En courbe, le câble pousse le béton vers l'extérieur de ${f2(g("q"), 0)} kN par mètre : il faut une épingle de ${f2(g("A2"), 2)} cm² tous les ${f2(I.s * 100, 0)} cm pour le retenir.` },

{ id: "pc-tranchant", t: "Effort tranchant des poutres précontraintes", ref: "NF EN 1992-1-1 — §6.2.2 (6.2a), (6.4), §6.2.3 (6.9), (6.11.aN)",
  desc: "Résistance sans armatures en zone fissurée et non fissurée en flexion, et résistance des bielles avec le coefficient αcw.",
  inputs: [N("V", "Effort tranchant", "kN", 1400, L`V_{Ed}`), N("bw", "Largeur d'âme (gaines déduites)", "m", 0.25, L`b_{w}`), N("d", "Hauteur utile", "m", 1.65, "d"), N("Ac", "Aire de la section", "m²", 0.8, L`A_c`),
    N("Ic", "Inertie", "m⁴", 0.33, "I"), N("Sx", "Moment statique au-dessus de G", "m³", 0.22, "S"), N("NEd", "Précontrainte (compression)", "kN", 7000, L`N_{Ed}`),
    N("Asl", "Armatures tendues (passives + adhérentes)", "cm²", 30, L`A_{sl}`), N("fck", "Béton", "MPa", 40, L`f_{ck}`), N("cot", "Inclinaison des bielles", "", 1.5, L`\cot\theta`), N("z", "Bras de levier", "m", 1.45, "z")],
  calc(I) {
    const fcd = I.fck / 1.5, k = min(1 + sqrt(0.2 / I.d), 2), rl = min(I.Asl / 1e4 / (I.bw * I.d), 0.02), scp = min(I.NEd / 1000 / I.Ac, 0.2 * fcd);
    const Vc1 = max(0.12 * k * Math.cbrt(100 * rl * I.fck), 0.035 * pow(k, 1.5) * sqrt(I.fck)) * I.bw * I.d + 0.15 * scp * I.bw * I.d;
    const fctd = 0.7 * 0.3 * pow(I.fck, 2 / 3) / 1.5, Vc2 = I.Ic * I.bw / I.Sx * sqrt(fctd * fctd + 1 * (I.NEd / 1000 / I.Ac) * fctd);
    const s = I.NEd / 1000 / I.Ac, acw = s <= 0.25 * fcd ? 1 + s / fcd : s <= 0.5 * fcd ? 1.25 : 2.5 * (1 - s / fcd), nu = 0.6 * (1 - I.fck / 250), Vmax = acw * I.bw * I.z * nu * fcd / (I.cot + 1 / I.cot);
    return { steps: [S("scp", L`\sigma_{cp}`, L`\dfrac{N_{Ed}}{A_c} \le 0{,}2\,f_{cd}`, scp, "MPa", 2), R("Vc1", L`V_{Rd,c}^{fiss}`, L`\left[0{,}12\,k\,(100\rho_l f_{ck})^{1/3} + 0{,}15\,\sigma_{cp}\right] b_w d`, Vc1 * 1000, "kN", 0),
      R("Vc2", L`V_{Rd,c}^{non\,fiss}`, L`\dfrac{I\,b_w}{S}\sqrt{f_{ctd}^2 + \alpha_l\,\sigma_{cp}\,f_{ctd}}`, Vc2 * 1000, "kN", 0), S("acw", L`\alpha_{cw}`, s <= 0.25 * fcd ? L`1 + \dfrac{\sigma_{cp}}{f_{cd}}` : s <= 0.5 * fcd ? L`1{,}25` : L`2{,}5\left(1 - \dfrac{\sigma_{cp}}{f_{cd}}\right)`, acw, "", 3),
      R("Vmax", L`V_{Rd,max}`, L`\dfrac{\alpha_{cw}\,b_w\,z\,\nu_1 f_{cd}}{\cot\theta + \tan\theta}`, Vmax * 1000, "kN", 0), R("Asw", L`\dfrac{A_{sw}}{s}`, L`\dfrac{V_{Ed}}{z\,f_{ywd}\cot\theta}`, I.V / 1000 / (I.z * 434.78 * I.cot) * 1e4, "cm²/m", 2)],
      checks: [C("Bielles : $V_{Ed} \\le V_{Rd,max}$", I.V / 1000 <= Vmax, `${f2(I.V, 0)} ≤ ${f2(Vmax * 1000, 0)} kN`, I.V / 1000 / Vmax), C("Sans armatures (zone non fissurée) : $V_{Ed} \\le V_{Rd,c}$", I.V / 1000 <= Vc2, `${f2(I.V, 0)} ≤ ${f2(Vc2 * 1000, 0)} kN`, I.V / 1000 / Vc2)],
      notes: ["$\\alpha_l = 1$ (post-tension) ; en prétension $\\alpha_l = l_x/l_{pt2} \\le 1$. Largeur d'âme nominale : $b_{w,nom} = b_w - 0{,}5\\sum\\varnothing$ (gaines injectées métalliques, §6.2.3 (6)). $f_{ywd} = 500/1{,}15$. Les armatures d'effort tranchant restent obligatoires (minimum) dans les âmes de ponts."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "VEd", v: I.V, u: "kN", d: 0, c: K.red }, { l: "VRd,c fissurée", v: g("Vc1"), u: "kN", d: 0, c: K.mute }, { l: "VRd,c non fissurée", v: g("Vc2"), u: "kN", d: 0, c: K.gold }, { l: "VRd,max (bielles)", v: g("Vmax"), u: "kN", d: 0, c: K.blue }], { title: `αcw = ${f2(g("acw"), 2)} · cot θ = ${f2(I.cot, 2)}`, left: 112 }); },
  clair: (I, g) => `La précontrainte comprime l'âme et la renforce : bielles jusqu'à ${f2(g("Vmax"), 0)} kN ; il faut ${f2(g("Asw"), 1)} cm²/m de cadres pour ${f2(I.V, 0)} kN.` },

{ id: "pc-mrd", t: "Moment résistant ultime d'une section précontrainte", ref: "NF EN 1992-1-1 — §3.3.6 (diagramme à palier), §6.1",
  desc: "Moment résistant d'une section en T précontrainte par armatures adhérentes, avec armatures passives, et contrôle de l'allongement des câbles.",
  inputs: [N("beff", "Largeur de la table", "m", 2.2, L`b_{eff}`), N("hf", "Épaisseur de la table", "m", 0.2, L`h_f`), N("bw", "Largeur d'âme", "m", 0.25, L`b_w`),
    N("Ap", "Aire des câbles", "mm²", 9000, L`A_p`), N("dp", "Hauteur utile des câbles", "m", 1.65, L`d_p`), N("As", "Armatures passives tendues", "cm²", 20, L`A_s`), N("ds", "Hauteur utile des aciers passifs", "m", 1.74, L`d_s`),
    N("spm", "Tension à long terme", "MPa", 1150, L`\sigma_{pm\infty}`), N("fpk", "fpk", "MPa", 1860, L`f_{pk}`), N("fp01", "fp0,1k", "MPa", 1640, L`f_{p0,1k}`), N("fck", "Béton", "MPa", 40, L`f_{ck}`), N("Med", "Moment ultime", "MN·m", 16, L`M_{Ed}`)],
  calc(I) {
    const fcd = I.fck / 1.5, fpd = I.fp01 / 1.15, fyd = 500 / 1.15, Ap = I.Ap / 1e6, As = I.As / 1e4, Ft = Ap * fpd + As * fyd;
    let x = Ft / (0.8 * I.beff * fcd), Mr;
    if (0.8 * x <= I.hf) Mr = Ap * fpd * (I.dp - 0.4 * x) + As * fyd * (I.ds - 0.4 * x);
    else { const Ff = (I.beff - I.bw) * I.hf * fcd; x = (Ft - Ff) / (0.8 * I.bw * fcd); Mr = Ff * (I.dp - I.hf / 2) + 0.8 * x * I.bw * fcd * (I.dp - 0.4 * x) + As * fyd * (I.ds - I.dp); }
    const ep0 = I.spm / 195000, dep = 3.5e-3 * (I.dp - x) / x, ep = ep0 + dep, epd = fpd / 195000;
    return { steps: [S("fpd", L`f_{pd}`, L`\dfrac{f_{p0,1k}}{\gamma_s}`, fpd, "MPa", 1), S("Ft", L`F_t`, L`A_p f_{pd} + A_s f_{yd}`, Ft * 1000, "kN", 0),
      R("x", L`x_u`, 0.8 * x <= I.hf ? L`\dfrac{F_t}{0{,}8\,b_{eff}\,f_{cd}}\ \ \text{(table)}` : L`\dfrac{F_t - (b_{eff} - b_w)\,h_f\,f_{cd}}{0{,}8\,b_w\,f_{cd}}`, x, "m", 3),
      S("ep", L`\varepsilon_p`, L`\dfrac{\sigma_{pm\infty}}{E_p} + \varepsilon_{cu3}\,\dfrac{d_p - x_u}{x_u}`, ep * 1000, "‰", 2), R("MRd", L`M_{Rd}`, "~moment des forces par rapport au béton comprimé", Mr, "MN·m", 2)],
      checks: [C("$M_{Ed} \\le M_{Rd}$", I.Med <= Mr, `${f2(I.Med, 1)} ≤ ${f2(Mr, 1)} MN·m`, I.Med / Mr), C("Câbles plastifiés : $\\varepsilon_p \\ge f_{pd}/E_p$", ep >= epd, `${f2(ep * 1000, 2)} ≥ ${f2(epd * 1000, 2)} ‰`),
        C("Allongement limite : $\\varepsilon_p \\le \\varepsilon_{ud} = 0{,}9\\,\\varepsilon_{uk}$ (≈ 31,5 ‰) si la branche inclinée est utilisée", ep <= 0.0315, `${f2(ep * 1000, 1)} ‰`)],
      notes: ["Diagramme rectangulaire du béton ($\\lambda = 0{,}8$, $\\eta = 1$), acier de précontrainte à palier horizontal $f_{pd}$ (§3.3.6 (7)). Câbles non adhérents : la surtension est limitée (§5.10.8) — ce calcul ne s'applique pas."] };
  },
  fig(I, g) { return KIT.section({ beff: I.beff, hf: I.hf, bw: I.bw, h: I.ds + 0.08, d: I.dp, As: 1, nb: 3, x: g("x"), lam: 0.8, z: true, fcl: "fcd", Fs: `Ap·fpd + As·fyd` }); },
  clair: (I, g) => `À la rupture, les câbles et les aciers passifs tirent ${f2(g("Ft") / 1000, 1)} MN : la section résiste à ${f2(g("MRd"), 1)} MN·m (taux ${f2(I.Med / g("MRd") * 100, 0)} %).` },

{ id: "pc-pretension", t: "Prétension : longueurs de transmission et d'ancrage", ref: "NF EN 1992-1-1 — §8.10.2.2 (8.15) à (8.18), §8.10.2.3 (8.21)",
  desc: "Longueur de transmission de la précontrainte par adhérence des torons, valeurs de calcul et longueur de régularisation.",
  inputs: [N("phi", "Diamètre nominal du toron", "mm", 15.7, L`\varnothing`), N("spm0", "Contrainte juste après le relâchement", "MPa", 1350, L`\sigma_{pm0}`),
    N("fctm", "Résistance en traction du béton au relâchement", "MPa", 2.9, L`f_{ctm}(t)`), SEL("type", "Armature", [["t", "Toron 7 fils (ηp1 = 3,2 ; α2 = 0,19)"], ["f", "Fil cranté (ηp1 = 2,7 ; α2 = 0,25)"]], "t", ""),
    SEL("rel", "Relâchement", [["1", "Progressif (α1 = 1,0)"], ["1.25", "Brutal (α1 = 1,25)"]], "1.25", L`\alpha_1`), N("d", "Hauteur utile de la section", "m", 0.9, "d"),
    N("spd", "Contrainte de calcul ELU dans le toron", "MPa", 1426, L`\sigma_{pd}`), N("spinf", "Contrainte à long terme", "MPa", 1150, L`\sigma_{pm\infty}`)],
  calc(I) {
    const tor = I.type === "t", np1 = tor ? 3.2 : 2.7, a2 = tor ? 0.19 : 0.25, np2 = tor ? 1.2 : 1.4, fctd = 0.7 * I.fctm / 1.5, fbpt = np1 * fctd, lpt = +I.rel * a2 * I.phi * I.spm0 / fbpt;
    const ldisp = sqrt(lpt ** 2 + (I.d * 1000) ** 2), fbpd = np2 * fctd, lbpd = 1.2 * lpt + a2 * I.phi * (I.spd - I.spinf) / fbpd;
    return { steps: [S("fctd", L`f_{ctd}(t)`, L`\dfrac{0{,}7\,f_{ctm}(t)}{\gamma_c}`, fctd, "MPa", 3), S("fbpt", L`f_{bpt}`, L`\eta_{p1}\,\eta_1\,f_{ctd}(t)`, fbpt, "MPa", 3),
      R("lpt", L`l_{pt}`, L`\alpha_1\,\alpha_2\,\varnothing\,\dfrac{\sigma_{pm0}}{f_{bpt}}`, lpt, "mm", 0), S("lpt1", L`l_{pt1}\ ;\ l_{pt2}`, L`0{,}8\,l_{pt}\ ;\ 1{,}2\,l_{pt}`, `${f2(0.8 * lpt, 0)} ; ${f2(1.2 * lpt, 0)}`, "mm", 0),
      S("ldisp", L`l_{disp}`, L`\sqrt{l_{pt}^2 + d^2}`, ldisp, "mm", 0), R("lbpd", L`l_{bpd}`, L`l_{pt2} + \alpha_2\,\varnothing\,\dfrac{\sigma_{pd} - \sigma_{pm\infty}}{f_{bpd}}`, lbpd, "mm", 0)],
      notes: ["$\\eta_1 = 1$ (bonnes conditions d'adhérence). $l_{pt1}$ sert aux vérifications locales au relâchement, $l_{pt2}$ aux états limites ultimes ; $f_{bpd} = \\eta_{p2}\\eta_1 f_{ctd}$ avec $\\eta_{p2} = 1{,}2$ (torons) ou 1,4 (fils crantés)."] };
  },
  fig(I, g) {
    const W = 330, Hh = 150, x0 = 30, Lx = 270, lp = g("lpt"), lb = g("lbpd"), k = Lx / (lb * 1.15), X = l => x0 + l * k;
    let s = Rc(x0, 30, Lx, 50) + P(`M${x0} 66H${x0 + Lx}`, { c: K.red, w: 2.5 }) + P(`M${x0} 120L${X(lp)} 92H${x0 + Lx}`, { c: K.gold, w: 2 }) + T(X(lp) + 6, 104, "σpm0 atteinte", { s: 9, c: K.gold });
    s += P(`M${X(1.2 * lp)} 26V126M${X(lb)} 26V126`, { c: K.mute, w: .8, dash: "3 3" }) + T(X(1.2 * lp), 138, "lpt2", { a: "middle", s: 9 }) + T(X(lb), 138, "lbpd", { a: "middle", s: 9 }) + dim(x0, X(lp), 20, `lpt = ${f2(lp, 0)} mm`);
    return svg(W, Hh, s);
  },
  clair: (I, g) => `Le toron transmet sa tension au béton progressivement sur ${f2(g("lpt") / 1000, 2)} m ; à l'ELU, il lui faut ${f2(g("lbpd") / 1000, 2)} m pour être entièrement ancré.` },
]);
})(typeof window !== "undefined" ? window : globalThis);
