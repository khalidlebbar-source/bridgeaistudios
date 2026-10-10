/* ════════════════════════════════════════════════════════════════════
   HandBag — Matériaux (compléments : aciers passifs, fluage, lois de comportement, conformité)
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG, { PI, sqrt, pow, exp, min, max, abs, L, S, R, C, N, SEL, H, fmt } = HB.DSL;
const { K, svg, T, P, Rc, Ci, arrow, dim, dimV, plot, range, logRange, gauge } = HB.FIG, KIT = HB.KIT;
const f2 = (v, d = 2) => fmt(v, d), ln = Math.log;

HB.add("Matériaux", [

{ id: "acier-ba", t: "Acier de béton armé : caractéristiques et diagrammes", ref: "NF EN 1992-1-1 — §3.2, figure 3.8, annexe C (tableau C.1) ; NF A 35-080",
  desc: "Résistances de calcul, déformations et diagramme contrainte-déformation de calcul (palier horizontal ou branche inclinée) selon la classe de ductilité.",
  inputs: [N("fyk", "Limite d'élasticité caractéristique", "MPa", 500, L`f_{yk}`), SEL("cl", "Classe de ductilité", [["A", "A (εuk ≥ 2,5 % ; k ≥ 1,05)"], ["B", "B (εuk ≥ 5 % ; k ≥ 1,08)"], ["C", "C (εuk ≥ 7,5 % ; 1,15 ≤ k < 1,35)"]], "B", ""),
    N("gs", "Coefficient", "", 1.15, L`\gamma_s`), N("Es", "Module d'élasticité", "MPa", 200000, L`E_s`)],
  calc(I) {
    const euk = { A: 2.5, B: 5, C: 7.5 }[I.cl] / 100, k = { A: 1.05, B: 1.08, C: 1.15 }[I.cl], fyd = I.fyk / I.gs, eyd = fyd / I.Es, eud = 0.9 * euk, ftd = k * I.fyk / I.gs;
    const sud = fyd + (ftd - fyd) * (eud - eyd) / (euk - eyd);
    return { steps: [R("fyd", L`f_{yd}`, L`\dfrac{f_{yk}}{\gamma_s}`, fyd, "MPa", 1), S("eyd", L`\varepsilon_{yd}`, L`\dfrac{f_{yd}}{E_s}`, eyd * 1000, "‰", 3), S("euk", L`\varepsilon_{uk}`, "~classe de ductilité (annexe C)", euk * 1000, "‰", 1),
      R("eud", L`\varepsilon_{ud}`, L`0{,}9\,\varepsilon_{uk}`, eud * 1000, "‰", 1), S("k", "k", L`(f_t/f_y)_k`, k, "", 2), S("sud", L`\sigma_{s}(\varepsilon_{ud})`, "~branche inclinée", sud, "MPa", 1), S("rho", L`\rho`, "~masse volumique", 7850, "kg/m³", 0)],
      notes: ["Branche supérieure horizontale (sans limite de déformation) ou inclinée jusqu'à $\\varepsilon_{ud}$ (§3.2.7 (2)) ; l'AN française recommande $\\varepsilon_{ud} = 0{,}9\\,\\varepsilon_{uk}$. Les ponts exigent en général des aciers de classe B ou C (ductilité, fatigue, NF EN 1992-2)."] };
  },
  fig(I, g) { const e1 = g("eyd"), e2 = g("eud"), fyd = g("fyd"); return plot({ series: [{ pts: [[0, 0], [e1, fyd], [e2 * 1.05, fyd]], l: "palier horizontal" }, { pts: [[e1, fyd], [e2, g("sud")]], l: "branche inclinée", c: K.blue, w: 1.6, dash: "5 3" }, { pts: [[0, 0], [I.fyk / I.Es * 1000, I.fyk], [e2 * 1.05, I.fyk * g("k")]], l: "caractéristique", c: K.mute, w: 1, dash: "2 2" }], vlines: [{ x: e2, l: "εud" }], xl: "ε (‰)", yl: "σ (MPa)", ymin: 0, ymax: I.fyk * g("k") * 1.1 }); },
  clair: (I, g) => `L'acier B${I.fyk} se calcule à ${f2(g("fyd"), 0)} MPa ; il se plastifie à ${f2(g("eyd"), 2)} ‰ et peut s'allonger jusqu'à ${f2(g("eud"), 0)} ‰ (classe ${I.cl}).` },

{ id: "fluage-ec2", t: "Coefficient de fluage du béton (Eurocode 2)", ref: "NF EN 1992-1-1 — §3.1.4, annexe B (B.1) à (B.9)",
  desc: "Coefficient de fluage φ(t, t₀) selon l'humidité, le rayon moyen, la résistance, l'âge au chargement et le type de ciment.",
  inputs: [N("fck", "Résistance caractéristique", "MPa", 35, L`f_{ck}`), N("RH", "Humidité relative", "%", 70, "RH"), N("Ac", "Aire de la section", "m²", 2.2, L`A_c`), N("u", "Périmètre exposé à la dessiccation", "m", 12, "u"),
    N("t0", "Âge du béton au chargement", "jours", 28, L`t_0`), N("t", "Âge considéré (∞ : 36 500)", "jours", 36500, "t"), SEL("ct", "Type de ciment", [["-1", "Classe S (α = −1)"], ["0", "Classe N (α = 0)"], ["1", "Classe R (α = 1)"]], "0", L`\alpha`)],
  calc(I) {
    const fcm = I.fck + 8, h0 = 2 * I.Ac / I.u * 1000, a1 = pow(35 / fcm, 0.7), a2 = pow(35 / fcm, 0.2), a3 = pow(35 / fcm, 0.5), hi = fcm > 35;
    const pRH = hi ? (1 + (1 - I.RH / 100) / (0.1 * Math.cbrt(h0)) * a1) * a2 : 1 + (1 - I.RH / 100) / (0.1 * Math.cbrt(h0)), bf = 16.8 / sqrt(fcm), t0 = max(0.5, I.t0 * pow(9 / (2 + pow(I.t0, 1.2)) + 1, +I.ct)), bt0 = 1 / (0.1 + pow(t0, 0.2));
    const phi0 = pRH * bf * bt0, bH = hi ? min(1.5 * (1 + pow(0.012 * I.RH, 18)) * h0 + 250 * a3, 1500 * a3) : min(1.5 * (1 + pow(0.012 * I.RH, 18)) * h0 + 250, 1500), bc = pow((I.t - I.t0) / (bH + I.t - I.t0), 0.3);
    return { steps: [S("h0", L`h_0`, L`\dfrac{2\,A_c}{u}`, h0, "mm", 0), S("pRH", L`\varphi_{RH}`, hi ? L`\left[1 + \dfrac{1 - RH/100}{0{,}1\sqrt[3]{h_0}}\,\alpha_1\right]\alpha_2` : L`1 + \dfrac{1 - RH/100}{0{,}1\sqrt[3]{h_0}}`, pRH, "", 3), S("bf", L`\beta(f_{cm})`, L`\dfrac{16{,}8}{\sqrt{f_{cm}}}`, bf, "", 3),
      S("t0c", L`t_{0}`, L`t_{0,T}\left(\dfrac{9}{2 + t_{0,T}^{1{,}2}} + 1\right)^{\alpha}`, t0, "j", 2), S("bt0", L`\beta(t_0)`, L`\dfrac{1}{0{,}1 + t_0^{0{,}20}}`, bt0, "", 3), R("phi0", L`\varphi_0`, L`\varphi_{RH}\,\beta(f_{cm})\,\beta(t_0)`, phi0, "", 3),
      S("bH", L`\beta_H`, L`1{,}5\left[1 + (0{,}012\,RH)^{18}\right]h_0 + 250\,\alpha_3 \le 1500\,\alpha_3`, bH, "", 0), S("bc", L`\beta_c(t,t_0)`, L`\left[\dfrac{t - t_0}{\beta_H + t - t_0}\right]^{0{,}3}`, bc, "", 3), R("phi", L`\varphi(t,t_0)`, L`\varphi_0\,\beta_c(t,t_0)`, phi0 * bc, "", 3)],
      notes: ["Contrainte de compression ≤ $0{,}45\\,f_{ck}(t_0)$ (fluage linéaire, §3.1.4 (4)). Module effectif : $E_{c,eff} = E_{cm}/(1 + \\varphi)$. Âge $t_0$ éventuellement corrigé de la température (B.10)."] };
  },
  fig(I, g) { const ts = logRange(I.t0 + 1, 36500, 80), bH = g("bH"), phi0 = g("phi0"); return plot({ logx: true, series: [{ pts: ts.map(t => [t, phi0 * pow((t - I.t0) / (bH + t - I.t0), 0.3)]), l: `φ(t, t0 = ${f2(I.t0, 0)} j)` }], hlines: [{ y: phi0, l: `φ0 = ${f2(phi0, 2)}`, c: K.mute }], marks: [{ x: min(max(I.t, I.t0 + 1), 36500), y: g("phi"), l: f2(g("phi"), 2) }], xl: "âge (jours, log)", yl: "φ", xmin: I.t0 + 1, xmax: 36500, ymin: 0 }); },
  clair: (I, g) => `Chargé à ${f2(I.t0, 0)} jours, le béton se déformera à terme ${f2(g("phi"), 2)} fois plus que sa déformation instantanée.` },

{ id: "beton-sargin", t: "Loi de comportement non linéaire du béton (analyse structurale)", ref: "NF EN 1992-1-1 — §3.1.5 (3.14), figure 3.2, tableau 3.1",
  desc: "Relation contrainte-déformation de Sargin pour l'analyse non linéaire et le second ordre : pic, module et déformation ultime.",
  inputs: [N("fck", "Résistance caractéristique", "MPa", 35, L`f_{ck}`)],
  calc(I) {
    const fcm = I.fck + 8, Ecm = 22000 * pow(fcm / 10, 0.3), ec1 = min(0.7 * pow(fcm, 0.31), 2.8), ecu1 = I.fck < 50 ? 3.5 : 2.8 + 27 * pow((98 - fcm) / 100, 4), k = 1.05 * Ecm * ec1 / 1000 / fcm;
    return { steps: [S("fcm", L`f_{cm}`, L`f_{ck} + 8`, fcm, "MPa", 0), S("Ecm", L`E_{cm}`, L`22\,000\,(f_{cm}/10)^{0{,}3}`, Ecm, "MPa", 0), R("ec1", L`\varepsilon_{c1}`, L`0{,}7\,f_{cm}^{0{,}31} \le 2{,}8`, ec1, "‰", 3),
      R("ecu1", L`\varepsilon_{cu1}`, I.fck < 50 ? L`3{,}5` : L`2{,}8 + 27\left[\dfrac{98 - f_{cm}}{100}\right]^4`, ecu1, "‰", 2), S("k", "k", L`1{,}05\,E_{cm}\,\dfrac{|\varepsilon_{c1}|}{f_{cm}}`, k, "", 3),
      S("law", L`\dfrac{\sigma_c}{f_{cm}}`, L`\dfrac{k\eta - \eta^2}{1 + (k - 2)\,\eta},\ \ \eta = \dfrac{\varepsilon_c}{\varepsilon_{c1}}`, "", "", 0)],
      notes: ["Loi destinée à l'analyse structurale non linéaire avec les valeurs moyennes ; pour le dimensionnement des sections, utiliser la loi parabole-rectangle avec $f_{cd}$ (§3.1.7). Pour la méthode générale du second ordre, l'EC2 §5.8.6 remplace $f_{cm}$ par $f_{cd}$ et $E_{cm}$ par $E_{cd} = E_{cm}/\\gamma_{cE}$ (1,2)."] };
  },
  fig(I, g) { const fcm = I.fck + 8, ec1 = g("ec1"), k = g("k"), es = range(0, g("ecu1"), 80); return plot({ series: [{ pts: es.map(e => { const n = e / ec1; return [e, fcm * (k * n - n * n) / (1 + (k - 2) * n)]; }), l: "loi de Sargin (valeurs moyennes)" }, { pts: [[0, 0], [0.4 * fcm / g("Ecm") * 1000, 0.4 * fcm]], l: "module Ecm (sécant à 0,4 fcm)", c: K.mute, w: 1, dash: "4 3" }], vlines: [{ x: ec1, l: "εc1" }, { x: g("ecu1"), l: "εcu1" }], xl: "ε (‰)", yl: "σ (MPa)", ymin: 0, ymax: fcm * 1.1 }); },
  clair: (I, g) => `Un béton C${f2(I.fck, 0)} atteint sa résistance moyenne de ${f2(I.fck + 8, 0)} MPa vers ${f2(g("ec1"), 2)} ‰ de raccourcissement et rompt à ${f2(g("ecu1"), 1)} ‰.` },

{ id: "deformation-imposee", t: "Déformations imposées : dilatation libre et contrainte gênée", ref: "NF EN 1992-1-1 §3.1.3, §7.3.2 ; NF EN 1991-1-5 (variations de température)",
  desc: "Allongement libre sous une variation de température ou un retrait, et contrainte engendrée lorsque la déformation est empêchée (degré de bridage).",
  inputs: [N("dT", "Variation de température (ou retrait équivalent)", "K", 15, L`\Delta T`), N("alpha", "Coefficient de dilatation", "×10⁻⁶ /K", 10, L`\alpha_T`), N("Lx", "Longueur de l'élément", "m", 30, "L"),
    N("E", "Module (instantané ou effectif)", "MPa", 34000, "E"), N("Rb", "Degré de bridage", "", 0.5, "R"), N("fct", "Résistance en traction du béton", "MPa", 3.2, L`f_{ctm}`)],
  calc(I) { const e = I.alpha * 1e-6 * I.dT, dl = e * I.Lx * 1000, sg = I.Rb * I.E * e;
    return { steps: [S("e", L`\varepsilon_{libre}`, L`\alpha_T\,\Delta T`, e * 1000, "‰", 3), R("dl", L`\Delta L`, L`\alpha_T\,\Delta T\,L`, dl, "mm", 1), R("s", L`\sigma`, L`R\,E\,\alpha_T\,\Delta T`, sg, "MPa", 2), S("ratio", "", L`\dfrac{\sigma}{f_{ctm}}`, sg / I.fct, "", 2)],
      checks: [C("Pas de fissuration en traction : $\\sigma \\le f_{ctm}$", sg <= I.fct, `${f2(sg, 2)} ≤ ${f2(I.fct, 2)} MPa`, sg / I.fct)],
      notes: ["Degré de bridage : 0 (libre) à 1 (totalement empêché) ; mur coulé sur une semelle ancienne : 0,5 à 0,8 au voisinage de la reprise. Sous déformation lente (retrait), utiliser $E_{c,eff}$ (fluage). Si $\\sigma > f_{ctm}$, prévoir les armatures minimales de fissuration (§7.3.2) ou des joints."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "σ (bridage R)", v: g("s"), lim: I.fct, u: "MPa" }, { l: "σ (bridage total)", v: I.E * I.alpha * 1e-6 * I.dT, c: K.mute, u: "MPa" }, { l: "fctm", v: I.fct, c: K.blue, u: "MPa" }], { title: `Allongement libre : ${f2(g("dl"), 1)} mm sur ${f2(I.Lx, 0)} m`, left: 100 }); },
  clair: (I, g) => `Libre, l'élément s'allongerait de ${f2(g("dl"), 1)} mm ; empêché à ${f2(I.Rb * 100, 0)} %, il subit ${f2(g("s"), 2)} MPa, ${g("s") <= I.fct ? "sans fissurer" : "assez pour fissurer"}.` },

{ id: "beton-confine", t: "Béton confiné par des cerces ou des frettes", ref: "NF EN 1992-1-1 — §3.1.9 (3.24) à (3.27), figure 3.6",
  desc: "Gain de résistance et de déformation d'un béton fretté (fût de pile, zone d'ancrage) en fonction de la pression latérale de confinement.",
  inputs: [N("fck", "Résistance caractéristique", "MPa", 35, L`f_{ck}`), N("Asp", "Section d'une cerce ou d'une spire", "cm²", 1.13, L`A_{sp}`), N("Dsp", "Diamètre du noyau confiné (axe des cerces)", "m", 1.6, L`D_{sp}`),
    N("s", "Pas des cerces", "m", 0.1, "s"), N("fyk", "Acier des cerces", "MPa", 500, L`f_{yk}`), N("ke", "Coefficient d'efficacité du confinement", "", 0.8, L`k_e`)],
  calc(I) {
    const s2 = I.ke * 2 * I.Asp / 1e4 * I.fyk / (I.Dsp * I.s), r = s2 / I.fck, fc = r <= 0.05 ? I.fck * (1 + 5 * r) : I.fck * (1.125 + 2.5 * r), ec2c = 2 * (fc / I.fck) ** 2, ecu = 3.5 + 0.2 * r * 1000;
    return { steps: [R("s2", L`\sigma_2`, L`k_e\,\dfrac{2\,A_{sp}\,f_{yk}}{D_{sp}\,s}`, s2, "MPa", 3), R("fckc", L`f_{ck,c}`, r <= 0.05 ? L`f_{ck}\left(1 + 5\,\dfrac{\sigma_2}{f_{ck}}\right)` : L`f_{ck}\left(1{,}125 + 2{,}5\,\dfrac{\sigma_2}{f_{ck}}\right)`, fc, "MPa", 2),
      S("ec2c", L`\varepsilon_{c2,c}`, L`\varepsilon_{c2}\left(\dfrac{f_{ck,c}}{f_{ck}}\right)^2`, ec2c, "‰", 3), R("ecuc", L`\varepsilon_{cu2,c}`, L`\varepsilon_{cu2} + 0{,}2\,\dfrac{\sigma_2}{f_{ck}}`, ecu, "‰", 2), S("gain", "", "~gain de résistance", (fc / I.fck - 1) * 100, "%", 1)],
      notes: ["$\\sigma_2$ : contrainte latérale effective de confinement à l'ELU ; $k_e$ traduit la perte d'efficacité entre deux cerces (formule de Mander : $k_e = (1 - s'/2D_{sp})^2/(1 - \\rho_{cc})$). Pour les rotules de piles en zone sismique, voir « Confinement des zones de rotule plastique »."] };
  },
  fig(I, g) { const f = I.fck, fc = g("fckc"), pts = (fx, e2, eu) => range(0, eu, 50).map(e => [e, e < e2 ? fx * (1 - (1 - e / e2) ** 2) : fx]); return plot({ series: [{ pts: pts(f, 2, 3.5), l: "béton non confiné", c: K.mute, w: 1.4, dash: "4 3" }, { pts: pts(fc, g("ec2c"), g("ecuc")), l: "béton confiné" }], xl: "ε (‰)", yl: "σ (MPa)", ymin: 0, ymax: fc * 1.15 }); },
  clair: (I, g) => `Les cerces empêchent le béton de se dilater latéralement : il gagne ${f2(g("gain"), 0)} % de résistance et peut se raccourcir jusqu'à ${f2(g("ecuc"), 1)} ‰ au lieu de 3,5 ‰.` },

{ id: "conformite-en206", t: "Conformité de la résistance du béton (NF EN 206)", ref: "NF EN 206/CN — §8.2.1.3, tableaux 14 et 15",
  desc: "Critères de conformité de la résistance en compression à partir des résultats d'essais (production initiale ou continue).",
  inputs: [N("fck", "Résistance caractéristique spécifiée (cylindre)", "MPa", 35, L`f_{ck}`), SEL("mode", "Production", [["i", "Initiale (n = 3 résultats)"], ["c", "Continue (n ≥ 15 résultats)"]], "c", ""),
    N("n", "Nombre de résultats", "U", 15, "n"), N("fcm", "Moyenne des résultats", "MPa", 42.5, L`f_{cm}`), N("fmin", "Plus faible résultat", "MPa", 34, L`f_{ci,min}`), N("sig", "Écart-type de la production", "MPa", 3.6, L`\sigma`)],
  calc(I) {
    const sg = max(I.sig, 3), c1 = I.mode === "i" ? I.fck + 4 : I.fck + 1.48 * sg, c2 = I.fck - 4, ok1 = I.fcm >= c1, ok2 = I.fmin >= c2;
    return { steps: [S("sg", L`\sigma_{ret}`, L`\max(\sigma\ ;\ 3\ \text{MPa})`, sg, "MPa", 2), R("c1", L`f_{cm,min}`, I.mode === "i" ? L`f_{ck} + 4` : L`f_{ck} + 1{,}48\,\sigma`, c1, "MPa", 2), R("c2", L`f_{ci,min}`, L`f_{ck} - 4`, c2, "MPa", 1),
      S("marge", "", "~marge sur la moyenne", I.fcm - c1, "MPa", 2)],
      checks: [C("Critère 1 (moyenne) : $f_{cm} \\ge$ limite", ok1, `${f2(I.fcm, 1)} ≥ ${f2(c1, 1)} MPa`, c1 / I.fcm), C("Critère 2 (valeur individuelle) : $f_{ci} \\ge f_{ck} - 4$", ok2, `${f2(I.fmin, 1)} ≥ ${f2(c2, 1)} MPa`, c2 / I.fmin)],
      notes: ["Production continue : au moins 15 résultats consécutifs sur une période ≤ 12 mois, $\\sigma$ estimé sur au moins 35 résultats (et pris ≥ 3 MPa). Résistances sur cylindres 16 × 32 cm (ou cubes, avec la classe correspondante). Les bétons de génie civil sont en général soumis au contrôle de production certifié NF."] };
  },
  fig(I, g) { return KIT.barsH([{ l: "moyenne fcm", v: I.fcm, lim: undefined, u: "MPa", c: g("c1") <= I.fcm ? K.teal : K.red }, { l: "seuil moyenne", v: g("c1"), u: "MPa", c: K.mute }, { l: "plus faible fci", v: I.fmin, u: "MPa", c: g("c2") <= I.fmin ? K.teal : K.red }, { l: "seuil individuel", v: g("c2"), u: "MPa", c: K.mute }], { title: `C${f2(I.fck, 0)} — ${I.mode === "i" ? "production initiale" : "production continue"}`, left: 96 }); },
  clair: (I, g) => (g("c1") <= I.fcm && g("c2") <= I.fmin) ? `Les essais sont conformes : moyenne ${f2(I.fcm, 1)} MPa (seuil ${f2(g("c1"), 1)}) et plus faible valeur ${f2(I.fmin, 1)} MPa (seuil ${f2(g("c2"), 1)}).` : `Les essais ne sont pas conformes à la classe C${f2(I.fck, 0)} : examiner les résultats et l'ouvrage (carottages).` },
]);
})(typeof window !== "undefined" ? window : globalThis);
