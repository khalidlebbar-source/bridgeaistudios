// Note de calcul HTML — structure de la note KLE « Note de calcul du tablier »
import { ProjetRes, TraveeRes } from "./project";
import { XL, LOAD_LABEL, LoadKey } from "./sollicitations";
import { barArea } from "./ba";

const f = (x: number | undefined, d = 2) => (x === undefined || !isFinite(x) ? "—" : x.toFixed(d).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace(/ (?=\d*,)/g, " "));
const fx = (x: number, d = 2) => { const s = x.toFixed(d).split("."); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, " "); return s.join(","); };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const tbl = (head: string[], rows: (string | number)[][], cls = "") =>
  `<table class="t ${cls}"><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${i && typeof c !== "string" ? ' class="n"' : i ? ' class="n"' : ""}>${typeof c === "number" ? fx(c) : c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const kv = (rows: [string, string, string?][]) => `<table class="kv">${rows.map(([a, b, u]) => `<tr><td>${a}</td><td class="n">${b}</td><td class="u">${u ?? ""}</td></tr>`).join("")}</table>`;
const ok = (b: boolean) => (b ? '<span class="ok">vérifié</span>' : '<span class="ko">non vérifié</span>');

function chartEpure(t: TraveeRes) {
  const W = 680, H = 260, m = { l: 56, r: 16, t: 14, b: 34 }, L = t.R.input.L;
  const ymax = Math.max(...t.E.pts.map(p => Math.max(p.Mr, p.Md))) * 1.08;
  const X = (x: number) => m.l + (x / L) * (W - m.l - m.r), Y = (v: number) => H - m.b - (v / ymax) * (H - m.t - m.b);
  const path = (k: "M" | "Md" | "Mr") => t.E.pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p[k]).toFixed(1)}`).join("");
  const step = Math.pow(10, Math.floor(Math.log10(ymax))) / (ymax / Math.pow(10, Math.floor(Math.log10(ymax))) > 5 ? 0.5 : 1) / 2;
  let grid = ""; for (let v = 0; v <= ymax; v += step) grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${m.l - 6}" y="${Y(v) + 3}" text-anchor="end">${fx(v, 0)}</text>`;
  for (let x = 0; x <= L + 1e-6; x += L / 10) grid += `<text x="${X(x)}" y="${H - m.b + 14}" text-anchor="middle">${fx(x, 1)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Épure d'arrêt des barres">${grid}
  <path d="${path("Mr")}" class="mr"/><path d="${path("Md")}" class="md"/><path d="${path("M")}" class="mm"/>
  <text x="${W - m.r}" y="${H - 4}" text-anchor="end">x (m)</text><text x="12" y="${m.t + 4}">kN·m</text></svg>
  <div class="leg"><span class="k mm"></span>M ELS <span class="k md"></span>M décalé de 0,8 h <span class="k mr"></span>Moment résistant</div>`;
}
function sketchSection(t: TraveeRes) {
  const g = t.R.input, H = t.R.geo.H, s = 200, W = 400, Hh = (H + g.hd) * s + 40;
  const cx = W / 2, top = 20, y0 = top + g.hd * s;
  const P = (x: number, y: number) => `${(cx + x * s).toFixed(1)},${(y0 + y * s).toFixed(1)}`;
  const bt = [[-g.bs / 2, 0], [g.bs / 2, 0], [g.bs / 2, g.hs1], [g.b0m / 2, g.hs2], [g.b0m / 2, H - g.ht2], [g.bt / 2, H - g.ht1], [g.bt / 2, H], [-g.bt / 2, H], [-g.bt / 2, H - g.ht1], [-g.b0m / 2, H - g.ht2], [-g.b0m / 2, g.hs2], [-g.bs / 2, g.hs1]];
  const dep = t.F.dep; let bars = "";
  const D = t.c.poutre.diam / 1000, cov = (t.c.poutre.enrobage + t.c.poutre.diamCadre) / 100;
  t.F.lits.forEach((nb, i) => {
    const y = H - dep[i], wAvail = g.bt - 2 * cov - D, sp = nb > 1 ? Math.min(wAvail / (t.c.poutre.parLit - 1), wAvail / (nb - 1)) : 0;
    for (let k = 0; k < nb; k++) { const xx = (k - (nb - 1) / 2) * sp; bars += `<circle cx="${(cx + xx * s).toFixed(1)}" cy="${(y0 + y * s).toFixed(1)}" r="${((D / 2) * s).toFixed(1)}" class="bar"/>`; }
  });
  const bT = t.c.poutre.bTable;
  return `<svg viewBox="0 0 ${W} ${Hh}" class="sk" role="img" aria-label="Coupe de la poutre">
  <rect x="${cx - (bT / 2) * s}" y="${top}" width="${bT * s}" height="${g.hd * s}" class="hd"/>
  <polygon points="${bt.map(([x, y]) => P(x, y)).join(" ")}" class="pt"/>${bars}
  <text x="${cx}" y="${top - 6}" text-anchor="middle" class="dim">${fx(bT, 2)}</text>
  <text x="${cx + (g.bs / 2) * s + 8}" y="${y0 + (H / 2) * s}" class="dim">h = ${fx(H + g.hd, 2)}</text></svg>`;
}
const lk = (k: LoadKey) => LOAD_LABEL[k];
function groupBars(t: TraveeRes) {
  const out: { lit: number; nums: string; xd: number; xf: number; cr: boolean; Mr: number }[] = [];
  for (const b of t.E.bars) {
    const last = out[out.length - 1];
    if (last && last.lit === b.lit && last.cr === b.cr && Math.abs(last.xd - b.xd) < 1e-6) { last.nums = last.nums.replace(/–?\d+$/, m => m) ; last.nums = last.nums.split("–")[0] + "–" + b.num; }
    else out.push({ lit: b.lit, nums: String(b.num), xd: b.xd, xf: b.xf, cr: b.cr, Mr: b.Mr });
  }
  return out.map(o => ({ ...o, nums: "N° " + o.nums }));
}

function noteTravee(t: TraveeRes, num: string) {
  const R = t.R, g = R.input, geo = R.geo, P = R.poids, S = R.surch;
  const loads = Object.keys(R.glob) as LoadKey[];
  const tabXL = (k: LoadKey, src: "glob" | "moy") => { const tb = (R as any)[src][k]; return tbl(["x/L", "Moment (kN·m)", "Effort tranchant (kN)"], XL.map((x, i) => [fx(x, 1), tb.M[i], tb.T[i]])); };
  const beams = R.ys.map((_, i) => `P${i + 1}`);
  let h = `<h2 id="tr-${num}">${num}. Dimensionnement des poutres — ${esc(t.def.nom)} (L = ${fx(g.L, 2)} m)</h2>`;
  h += `<h3>${num}.1 Calcul des sollicitations</h3>`;
  h += `<h4>I. Données de calcul</h4>` + kv([
    ["Nombre de poutres", String(g.n)], ["Portée", fx(g.L, 3), "m"], ["Longueur de la poutre", fx(g.Lpoutre, 3), "m"], ["Entraxe", fx(g.e, 3), "m"],
    ["Largeur de la semelle", fx(g.bs, 3), "m"], ["Hauteur min / max de la semelle", `${fx(g.hs1, 3)} / ${fx(g.hs2, 3)}`, "m"],
    ["Largeur de l'âme (appui / mi-travée)", `${fx(g.b0, 3)} / ${fx(g.b0m, 3)}`, "m"], ["Hauteur de l'âme", fx(g.hame, 3), "m"],
    ["Largeur du talon", fx(g.bt, 3), "m"], ["Hauteur min / max du talon", `${fx(g.ht1, 3)} / ${fx(g.ht2, 3)}`, "m"],
    ["Largeur / épaisseur de l'hourdis", `${fx(g.Lh, 3)} / ${fx(g.hd, 3)}`, "m"], ["Trottoir gauche / droit", `${fx(g.trG, 3)} / ${fx(g.trD, 3)}`, "m"],
    ["Superstructures", fx(g.qsup, 3), "kN/ml"], ["Entretoises (largeur × hauteur × épaisseur)", `${fx(g.ent.b, 2)} × ${fx(g.ent.h, 2)} × ${fx(g.ent.ep, 2)}`, "m"],
  ]);
  h += `<h4>II. Inventaire des charges permanentes</h4>` + kv([
    ["Surface de la poutre sur appui / à mi-travée", `${fx(geo.Aapp, 4)} / ${fx(geo.Amid, 4)}`, "m²"], ["Volume d'une poutre", fx(P.Vpoutre, 3), "m³"],
    ["Poids propre de l'ensemble des poutres", fx(P.Ppoutres, 2), "kN"], ["Poids moyen des poutres", fx(P.p1poutres, 3), "kN/ml"],
    ["Poids de la dalle de couverture", fx(P.p1dalle, 3), "kN/ml"], ["Poids du tablier (P1)", fx(P.P1, 3), "kN/ml"], ["Superstructures (P2)", fx(P.P2, 3), "kN/ml"],
    ["Charges permanentes (P1 + P2)", fx(P.P1 + P.P2, 3), "kN/ml"], ["Poids des charges permanentes", fx(P.Wperm, 2), "kN"],
    ["Surface nette d'une entretoise (vue de face)", fx(P.Sent, 4), "m²"], ["Poids des entretoises", fx(P.Went, 2), "kN"], ["Poids de la travée", fx(P.Wtravee, 2), "kN"],
  ]);
  h += `<h4>III. Surcharges de chaussée (fascicule 61 titre II)</h4>` + kv([
    ["Largeur roulable", fx(S.Lr, 3), "m"], ["Classe du pont", String(S.classe)], ["Nombre de voies / largeur", `${S.nv} / ${fx(S.v, 3)}`, "m"],
    ["a1 (1 voie / 2 voies)", `${fx(S.a1[0], 2)} / ${fx(S.a1[1], 2)}`], ["a2", fx(S.a2, 4)], ["A(L)", fx(S.ALv, 4), "kN/m²"],
    ["bc (1 file / 2 files)", `${fx(S.bc[0], 2)} / ${fx(S.bc[1], 2)}`], ["bt", fx(S.bt, 2)],
  ]) + tbl(["Majoration dynamique", "δ"], [["Bc 1 file", fx(S.dyn.BC1, 4)], ["Bc 2 files", fx(S.dyn.BC2, 4)], ["Br", fx(S.dyn.BR, 4)], ["Bt 1 tandem", fx(S.dyn.BT1, 4)], ["Bt 2 tandems", fx(S.dyn.BT2, 4)], ["Mc120", fx(S.dyn.MC120, 4)], ["Me120", fx(S.dyn.ME120, 4)], ["<b>Système B (enveloppe)</b>", `<b>${fx(S.dB, 4)}</b>`]])
    + `<p>Freinage A(L) : S = ${fx(S.Sfr, 2)} m², f = 1 / (20 + 0,0035 S) = ${fx(S.ffr, 5)} ; ` + S.freinage.map(x => `${x.k} voie(s) : ${fx(x.F, 2)} kN`).join(" ; ") + `.</p>`;
  h += `<h4>IV. Sollicitations longitudinales de l'ensemble du tablier</h4><p class="c">Coefficients a1, a2, bc et bt intégrés ; majorations dynamiques non intégrées.</p><div class="grid2">` +
    loads.map(k => `<div><h5>${lk(k)}</h5>${tabXL(k, "glob")}</div>`).join("") + `</div>`;
  h += `<h4>V–VI. Rigidités et paramètres de Guyon-Massonnet</h4>` + kv([
    ["Inertie de la poutre composite (hourdis sur l'entraxe)", fx(geo.Icomp, 6), "m⁴"], ["Centre de gravité (depuis le haut de l'hourdis)", fx(geo.ygComp, 3), "m"],
    ["Module différé retenu E = Ei / 3", fx(R.Ev, 0), "MPa"], ["ρp (poutre, par unité de largeur)", fx(R.rhoP, 3)], ["ρe (dalle)", fx(R.rhoE, 4)],
    ["Paramètre d'entretoisement θ", fx(R.theta, 4)], ["Inertie de torsion de la poutre", fx(geo.Kt, 4), "m⁴"], ["γp", fx(R.gamP, 4)], ["γe", fx(R.gamE, 4)], ["Paramètre de torsion α", fx(R.alpha, 4)],
  ]) + tbl(["Zone", "b (m)", "a (m)", "b/a", "k", "Rt (m⁴)"], geo.zones.map((z, i) => [String(i + 1), fx(Math.max(z.b, z.a), 4), fx(Math.min(z.b, z.a), 4), fx(z.r, 3), fx(z.k, 5), fx(z.Rt, 5)]));
  h += `<h4>VII. Coefficients de répartition transversale</h4><h5>Coefficients K de Guyon-Massonnet</h5>` +
    tbl(["y \\ e", "−b", "−3b/4", "−b/2", "−b/4", "0", "b/4", "b/2", "3b/4", "b"], R.Ktable.map((r, i) => [["0", "b/4", "b/2", "3b/4", "b"][i], ...r.map(v => fx(v, 4))]), "small") +
    `<h5>Kmoy par poutre (poutres numérotées de gauche à droite)</h5>` + tbl(["Charge", ...beams], (Object.keys(R.Kmoy) as LoadKey[]).filter(k => R.glob[k]).map(k => [lk(k), ...R.Kmoy[k].map(v => fx(v, 4))]), "small") +
    `<h5>Coefficients Cp = Kmoy · δ / n</h5>` + tbl(["Charge", ...beams], (Object.keys(R.Cp) as LoadKey[]).filter(k => R.glob[k]).map(k => [lk(k), ...R.Cp[k].map(v => fx(v, 4))]), "small");
  h += `<h4>VIII. Sollicitations maximales par poutre (Mmoy, Tmoy)</h4><p class="c">Coefficients a, bc, bt et δ intégrés. Enveloppe des poutres${g.compat ? " de l'axe vers la rive droite (convention du programme de référence)" : ""}.</p><div class="grid2">` +
    loads.map(k => `<div><h5>${lk(k)} — Cp = ${fx(R.moy[k]!.cp, 4)} (P${R.moy[k]!.beam + 1})</h5>${tabXL(k, "moy")}</div>`).join("") + `</div>`;
  h += `<h4>IX. Sollicitations aux états limites</h4>` + tbl(["x/L", "M ELU (kN·m)", "Comb.", "T ELU (kN)", "Comb.", "M ELS (kN·m)", "Comb.", "T ELS (kN)", "Comb."],
    XL.map((x, i) => [fx(x, 1), R.ELU.M[i].v, lk(R.ELU.M[i].comb as LoadKey), R.ELU.T[i].v, lk(R.ELU.T[i].comb as LoadKey), R.ELS.M[i].v, lk(R.ELS.M[i].comb as LoadKey), R.ELS.T[i].v, lk(R.ELS.T[i].comb as LoadKey)]))
    + `<p class="c">ELU : 1,35 G + 1,605 (Tr + A ou B) ; 1,35 G + 1,605 Tr + 1,35 (Mc120, Me120, D ou E). ELS : G + Tr + 1,2 (A ou B) ; G + Tr + (Mc120, Me120, D ou E).</p>`
    + `<h5>Moments ELS par poutre (kN·m)</h5>` + tbl(["x/L", ...beams], XL.map((x, i) => [fx(x, 1), ...R.ELSbeam.map(b => b[i])]), "small")
    + `<p class="c">Moments assez proches : l'enveloppe est retenue pour l'ensemble des poutres.</p>`;
  // Ferraillage
  const F = t.F;
  h += `<h3>${num}.2 Calcul du ferraillage et épure</h3><div class="flex">${sketchSection(t)}<div>` + kv([
    ["Phase 1 — poutre seule : q = poutre + hourdis frais (b = " + fx(t.c.poutre.bPhase1, 3) + " m)", fx(F.q1, 2), "kN/ml"], ["Moment de phase 1 : M1 = qL²/8", fx(F.M1, 0), "kN·m"],
    ["Moment ELS global (enveloppe)", fx(F.Mels, 0), "kN·m"], ["Reliquat de moment (phase 2, section poutre + hourdis)", fx(F.M2, 0), "kN·m"],
    ["Aciers : " + F.lits.map((n2, i) => `lit ${i + 1} : ${n2} HA${t.c.poutre.diam}`).join(", "), fx(F.As, 2), "cm²"],
    ["Traction des aciers sous M1 (section poutre seule)", fx(F.e1.ssG, 1), "MPa"], ["Traction des aciers sous M2 (section poutre + hourdis)", fx(F.e2.ssG, 1), "MPa"],
    ["Cumul (au centre de gravité des aciers) / limite", `${fx(F.cumul, 1)} / ${fx(F.ssl, 0)}`, "MPa"], ["Compression du béton (phase 1 / phase 2) / limite", `${fx(F.e1.sb, 1)} / ${fx(F.e2.sb, 1)} / ${fx(F.sbl, 1)}`, "MPa"],
    ["Contrôle ELU : Mu = " + fx(F.Mu, 0) + " kN·m → As requis", fx(F.elu.As, 1), "cm²"],
  ]) + `<p>Ferraillage longitudinal : ${ok(F.ok)}.</p></div></div>`;
  h += `<h5>Moment résistant ELS par barre (σs = ${fx(F.ssl, 0)} MPa, z = d − h0/4)</h5>` + tbl(["Lit", "Barres", "d depuis la fibre inf. (cm)", "Mr par barre (kN·m)"], F.lits.map((n2, i) => [`Lit ${i + 1}`, `${n2} HA${t.c.poutre.diam}`, fx(F.dep[i] * 100, 1), fx(F.MrBar[i], 0)]));
  h += `<h5>Épure d'arrêt des barres</h5><p class="c">Décalage de la courbe des moments : 0,8 h = ${fx(t.E.dec, 2)} m ; longueur de scellement ${t.c.poutre.scellement} Φ = ${fx(t.E.Ls, 2)} m. Lit 1 filant avec crochets.</p>` +
    tbl(["Lit", "Barres", "X début (m)", "X fin (m)", "Longueur (m)", "Mr par barre (kN·m)"], groupBars(t).map(b => [`Lit ${b.lit}`, b.nums, b.cr ? "Cr" : fx(b.xd, 2), b.cr ? "Cr" : fx(b.xf, 2), b.cr ? fx(t.R.input.Lpoutre, 2) + " (+ crochets)" : fx(b.xf - b.xd, 2), fx(b.Mr, 0)]), "small") + chartEpure(t) + `<p>Couverture de la courbe décalée : ${ok(t.E.couvert)}.</p>`;
  const C = t.C;
  h += `<h5>Cisaillement ELU</h5><p class="c">τu = Vu / (b0·d) ≤ ${fx(C.tlim, 2)} MPa ; At/St = τu·b0·γs / (0,9·fe) ; d = ${fx(C.d, 3)} m.</p>` +
    tbl(["x", "Vu (kN)", "τu (MPa)", "At/St requis (cm²/ml)", "Cadres", "En place (cm²/ml)", ""], C.rows.map(r => [`${fx(r.f, 1)} L`, r.Vu, fx(r.tu, 2), r.req, `Cadre HA${r.diam} + étrier HA${r.diam2} esp. ${fx(r.esp, 1)}`, r.pose, ok(r.ok)]));
  h += `<h5>Vérifications au voisinage de l'appui</h5>` + kv([
    ["Acier inférieur prolongé : As ≥ Vu·γs / fe", `${fx(C.AsAppui, 2)} ≤ ${fx(C.AsLit1, 2)}`, "cm²"],
    ["Bielle d'about : Vu ≤ 0,267·a·b0·fc28 (a = " + fx(t.c.poutre.aAppui, 2) + " m)", `${fx(C.Vu0, 0)} / ${fx(C.VbielleBAEL, 0)}`, "kN"],
  ]) + `<p>Acier d'about : ${ok(C.AsAppui <= C.AsLit1)} — bielle : ${ok(C.Vu0 <= C.VbielleBAEL)}.</p>`;
  const CF = t.CF;
  h += `<h3>${num}.3 Contre-flèche</h3>` + kv([
    ["Ei (instantané) / Ev (différé)", `${fx(CF.Eiv, 0)} / ${fx(CF.Evv, 0)}`, "MPa"],
    ["Pose : inertie de la poutre seule", fx(CF.Ip, 4), "m⁴"], ["Poids poutre + hourdis frais", fx(CF.q1, 2), "kN/ml"], ["F1 flèche instantanée", fx(CF.F1, 1), "mm"],
    ["Inertie globale du tablier (poutres + hourdis)", fx(CF.Iglob, 4), "m⁴"], ["Poids du tablier (partie résistante)", fx(CF.Gres, 2), "kN/ml"], ["F2 flèche différée", fx(CF.F2, 1), "mm"],
    ["Superstructures", fx(CF.qsup, 2), "kN/ml"], ["F3 flèche différée sous équipements", fx(CF.F3, 1), "mm"],
    ["<b>Flèche globale F1 + 2/3 F2 + F3</b>", `<b>${fx(CF.Fg, 2)}</b>`, "mm"], ["<b>Contre-flèche retenue sur plans</b>", `<b>${fx(CF.retenu, 0)}</b>`, "mm"],
  ]) + tbl(["x/L", ...CF.allure.map(a => fx(a.x, 1) + " L")], [["x (m)", ...CF.allure.map(a => fx(a.X, 2))], ["CF (mm)", ...CF.allure.map(a => fx(a.cf, 0))]], "small");
  return h;
}

export function noteHTML(r: ProjetRes) {
  const p = r.projet, g = p.base, sup = r.sup;
  let h = `<header class="cover"><div class="kicker">${esc(g.projet)}</div><h1>Note de calcul du tablier</h1><div class="sub">${esc(g.ouvrage)} — tablier à poutres préfabriquées en béton armé (PPBA)</div></header>`;
  h += `<nav class="toc"><b>Sommaire</b><ol><li>Hypothèses de calcul</li><li>Charges des superstructures et poids des travées</li>${r.travees.map(t => `<li>Dimensionnement des poutres — ${esc(t.def.nom)}</li>`).join("")}<li>Dimensionnement de l'hourdis</li><li>Dimensionnement de la dallette de continuité</li><li>Dimensionnement des entretoises</li><li>Calculs complémentaires</li></ol></nav>`;
  h += `<h2>1. Hypothèses de calcul</h2><h3>1.1 Règlements</h3><ul><li>Béton armé : BAEL 91 modifié 99</li><li>Chargements : fascicule 61 titre II</li><li>Répartition transversale : méthode de Guyon-Massonnet</li></ul>
  <h3>1.2 Matériaux</h3><ul><li>Béton du tablier : fc28 = ${g.fc28} MPa</li><li>Aciers HA : FeE${g.fe} ; aciers doux : FeE${g.feDX}</li><li>Fissuration ${g.fiss === "P" ? "préjudiciable" : g.fiss === "TP" ? "très préjudiciable" : "peu préjudiciable"}</li></ul>
  <h3>1.3 Chargements</h3><ul><li>Charges de trottoir (${fx(g.qtr, 2)} kN/m²)</li>${g.charges.AL ? "<li>A(l)</li>" : ""}${g.charges.Bc || g.charges.Bt || g.charges.Br ? "<li>Système B (Bc, Bt, Br)</li>" : ""}${g.charges.Mc120 ? "<li>Mc120</li>" : ""}${g.charges.Me120 ? "<li>Me120</li>" : ""}${g.charges.D ? "<li>Convoi D</li>" : ""}${g.charges.E ? "<li>Convoi E</li>" : ""}</ul>`;
  h += `<h2>2. Charges des superstructures et poids des travées</h2><h3>2.1 Détail des superstructures</h3>` +
    tbl(["Élément", "Côté", "Section (m²/ml)", "γ (t/m³)", "Probable (t/ml)", "k min", "Min (t/ml)", "k max", "Max (t/ml)"],
      sup.rows.map(e => [esc(e.nom), ({ D: "Droit", G: "Gauche", C: "Central", S: "Surface" } as any)[e.cote], e.Scalc !== undefined ? fx(e.Scalc, 3) : "—", (e as any).g !== undefined ? fx((e as any).g, 2) : "—", fx(e.prob, 3), isNaN(e.kmin) ? "—" : fx(e.kmin, 2), isNaN(e.min) ? "—" : fx(e.min, 3), isNaN(e.kmax) ? "—" : fx(e.kmax, 2), isNaN(e.max) ? "—" : fx(e.max, 3)]), "small") +
    kv([["Total superstructures — probable / minimal / maximal", `${fx(sup.total.prob, 3)} / ${fx(sup.total.min, 3)} / ${fx(sup.total.max, 3)}`, "t/ml"]]);
  h += `<h3>2.2 Poids propre des travées</h3>` + tbl(["Travée", "Poids d'une poutre (t)", "Poutres (t)", "Hourdis (t)", "Entretoises (t)", "Équipements min / max (t)", "Total min / max (t)", "Total (t/ml)"],
    r.travees.map(t => [esc(t.def.nom), fx(t.PT.Pp, 2), fx(t.PT.Ptot, 0), fx(t.PT.Ph, 0), fx(t.PT.Pe, 1), `${fx(t.PT.Peq.min, 0)} / ${fx(t.PT.Peq.max, 0)}`, `${fx(t.PT.tot.min, 0)} / ${fx(t.PT.tot.max, 0)}`, `${fx(t.PT.tot.min / t.R.input.Lpoutre, 1)} / ${fx(t.PT.tot.max / t.R.input.Lpoutre, 1)}`]));
  r.travees.forEach((t, i) => (h += noteTravee(t, String(3 + i))));
  const n0 = 3 + r.travees.length, H = r.H, hd = p.compl.hourdis;
  h += `<h2>${n0}. Dimensionnement de l'hourdis</h2><p class="c">Calcul en faisant abstraction de la précontrainte : abaques de Thénoz (les valeurs lues sur les abaques sont des données du projet).</p>`;
  h += `<h3>${n0}.1 Données</h3>` + kv([["Étanchéité + revêtement e", fx(hd.e, 3), "m"], ["Épaisseur de la dalle (poids / ferraillage)", `${fx(hd.hmax, 2)} / ${fx(hd.hmin, 2)}`, "m"], ["E = 3/4 e + 1/2 h", fx(H.E, 3), "m"],
    ["a (portée transversale)", fx(hd.a, 2), "m"], ["b (entre nus des entretoises)", fx(hd.bEnt, 2), "m"], ["A", fx(hd.A, 2), "m"]]);
  h += `<h3>${n0}.2 Section à mi-portée (dalle articulée sur ses côtés)</h3>` + kv([["Charge permanente P", fx(H.P, 2), "kN/m²"], ["Mag = P a²/8", fx(H.Mag, 2), "kN·m/ml"], ["Mbg = 0,2 Mag", fx(H.Mbg, 2), "kN·m/ml"],
    ["Longueur pour δ : L = min(max(Lr ; entraxe des rives) ; portée)", fx(H.Ld, 2), "m"], ["G (hourdis + équipements sur L)", fx(H.G, 2), "kN"], ["δ système B (enveloppe) / δ Mc120", `${fx(H.dB, 3)} / ${fx(H.dMc, 3)}`]]) +
    tbl(["Moment transversal", "Abaque (kN·m/ml)", "Valeur majorée"], [["Bc", fx(hd.abaques.MaBc, 2), fx(H.Ma.Bc, 2)], ["Bt", fx(hd.abaques.MaBt, 2), fx(H.Ma.Bt, 2)], ["Mc120", fx(hd.abaques.MaMc, 2), fx(H.Ma.Mc, 2)]]) +
    tbl(["Combinaison", "M (kN·m/ml)", `× ${fx(hd.reduc, 2)} (encastrement partiel)`], [...H.combT.ELU.map(c => [c.n + " (ELU)", fx(c.v, 2), fx(c.v * hd.reduc, 2)]), ...H.combT.ELS.map(c => [c.n + " (ELS)", fx(c.v, 2), fx(c.v * hd.reduc, 2)])]) +
    tbl(["Moment longitudinal", "Abaque (kN·m/ml)", "Valeur majorée"], [["Bt", fx(hd.abaques.MbBt, 2), fx(H.Mb.Bt, 2)], ["Br", fx(hd.abaques.MbBr, 2), fx(H.Mb.Br, 2)], ["Bc", fx(hd.abaques.MbBc, 2), fx(H.Mb.Bc, 2)]]) +
    tbl(["Combinaison", "M (kN·m/ml)", `× ${fx(hd.reduc, 2)}`], [...H.combL.ELU.map(c => [c.n + " (ELU)", fx(c.v, 2), fx(c.v * hd.reduc, 2)]), ...H.combL.ELS.map(c => [c.n + " (ELS)", fx(c.v, 2), fx(c.v * hd.reduc, 2)])]);
  h += `<h3>${n0}.3 Moments de continuité</h3><p class="c">Charges permanentes : moments d'encastrement égaux à 50 % des moments isostatiques : Mpg = ${fx(H.Mpg, 2)}, Meg = ${fx(H.Meg, 2)} kN·m/ml.</p>` +
    tbl(["Encastrement sur les poutres", "M (kN·m/ml)"], [...H.cp.ELU.map(c => [c.n + " (ELU)", fx(c.v, 2)]), ...H.cp.ELS.map(c => [c.n + " (ELS)", fx(c.v, 2)])]) +
    tbl(["Encastrement sur l'entretoise", "M (kN·m/ml)"], [...H.ce.ELU.map(c => [c.n + " (ELU)", fx(c.v, 2)]), ...H.ce.ELS.map(c => [c.n + " (ELS)", fx(c.v, 2)])]);
  const sec = (n: string, s: typeof H.fer.trInf, ac: [number, number, number], Mu: number, Ms: number) => [n, fx(Mu, 2), fx(Ms, 2), `HA${ac[0]}${ac[1] ? " + HA" + ac[1] : ""} esp. ${ac[2]}`, fx(s.Apose, 2), fx(s.Acalc, 2), fx(s.ss, 0), fx(s.sb, 1), ok(s.ok)];
  h += `<h3>${n0}.4 Ferraillage (bande de 1 m, σs ≤ ${fx(H.ssl, 0)} MPa, σb ≤ ${fx(0.6 * g.fc28, 1)} MPa)</h3>` + tbl(["Section", "M ELU", "M ELS", "Aciers", "A posé (cm²)", "A calc. (cm²)", "σs (MPa)", "σb (MPa)", ""], [
    sec("Transversal — centre (inf.)", H.fer.trInf, hd.aciers.trInf, H.MaxT.ELU, H.MaxT.ELS), sec("Transversal — appui sur poutre (sup.)", H.fer.trSup, hd.aciers.trSup, H.minCp.ELU, H.minCp.ELS),
    sec("Longitudinal — centre (inf.)", H.fer.loInf, hd.aciers.loInf, H.MaxL.ELU, H.MaxL.ELS), sec("Longitudinal — appui sur entretoise (sup.)", H.fer.loSup, hd.aciers.loSup, H.minCe.ELU, H.minCe.ELS)]);
  h += `<h3>${n0}.5 Vérifications diverses</h3><h4>Prédalle</h4>` + kv([["Portée de la prédalle", fx(hd.predalle.portee, 2), "m"], ["Charge : hourdis frais + chantier", fx(g.gb * hd.hTot + hd.predalle.chantier, 2), "kN/m²"], ["Moment ELS", fx(H.Mpd, 2), "kN·m/ml"], ["Section d'acier (h = " + fx(hd.predalle.ep, 2) + " m)", fx(H.Apd, 2), "cm²/ml"]]) +
    `<h4>Poinçonnement sous les roues (BAEL A.5.2,4)</h4>` + tbl(["Roue", "a (m)", "b (m)", "uc (m)", "Q limite (kN)", "Q ultime (kN)", ""], H.roues.map(w => [w.n, fx(w.a, 2), fx(w.b, 2), fx(w.uc, 2), fx(w.Qlim, 0), fx(w.Qu, 0), ok(w.ok)]));
  const DC = r.DC, dc = p.compl.dallette;
  h += `<h2>${n0 + 1}. Dimensionnement de la dallette de continuité (bande de 1,00 m)</h2>` + kv([
    ["Portée / hauteur de la dallette", `${fx(dc.L, 3)} / ${fx(dc.H, 3)}`, "m"], ["Acier supérieur (tendu) As", fx(DC.As, 2), "cm²/ml"], ["Acier inférieur Ai", fx(DC.Ai, 2), "cm²/ml"],
    ["Ev / Ei", `${fx(DC.Evv, 0)} / ${fx(DC.Eiv, 0)}`, "MPa"], ["Tassement différentiel", fx(dc.T * 100, 1), "cm"], ["Inertie du tablier", fx(DC.It, 3), "m⁴"], ["Poids mort (poutres + hourdis)", fx(DC.Gt, 2), "kN/ml"], ["Superstructures", fx(DC.Qs, 2), "kN/ml"],
    ["α(pp) = G L³ / (24 Ev I)", fx(DC.apP * 1e3, 2), "10⁻³ rad"], ["α(eq) = Qsup L³ / (24 Ev I)", fx(DC.aeq * 1e3, 2), "10⁻³ rad"], ["A(l) sur " + fx(DC.Lcum, 1) + " m", fx(DC.Al, 2), "kN/ml"], ["α(A(l)) (Ei)", fx(DC.art * 1e3, 2), "10⁻³ rad"], ["α(tassement)", fx(DC.ats * 1e3, 2), "10⁻³ rad"],
    ["I0 (section homogène)", fx(DC.I0 * 1e8, 0), "cm⁴"], ["ρ = A / (B d)", fx(DC.rho * 100, 2), "%"], ["λi / λv / μ", `${fx(DC.li, 3)} / ${fx(DC.lv, 3)} / ${fx(DC.mu, 3)}`], ["Ifi / Ifv", `${fx(DC.Ifi * 1e8, 0)} / ${fx(DC.Ifv * 1e8, 0)}`, "cm⁴"],
    ["Axe neutre y / inertie fissurée", `${fx(DC.y, 3)} m / ${fx(DC.I * 1e8, 0)} cm⁴`],
  ]) + tbl(["Effet", "M (kN·m)", "σb (MPa)", "σs' (MPa)", "σs (MPa)"], [...DC.rows.map(x => [x.n, fx(x.M, 2), fx(x.sb, 2), fx(x.ss2, 2), fx(x.ss, 2)]), ["<b>Combinaison ELS</b>", `<b>${fx(DC.tot.M, 2)}</b>`, `<b>${fx(DC.tot.sb, 1)}</b>`, `<b>${fx(DC.tot.ss2, 0)}</b>`, `<b>${fx(DC.tot.ss, 0)}</b>`], ["Limites", "", fx(DC.sbl, 1), fx(DC.ssl, 0), fx(DC.ssl, 0)]]);
  const EN = r.EN, en = p.compl.entretoise;
  h += `<h2>${n0 + 2}. Dimensionnement des entretoises</h2><p class="c">Hypothèse fondamentale : le vérinage se fait à vide, sans circulation. Charge apportée par chaque poutre : ${fx(EN.P, 1)} kN.</p>` +
    tbl(["Vérin", ...EN.jacks.map((_, i) => String(i + 1))], [["Position (m)", ...EN.jacks.map(x => fx(x, 2))], ["Réaction (t)", ...EN.reac.map(v => fx(v / 10, 1))]], "small") +
    kv([["Moment maximal — fibre supérieure", fx(EN.Msup, 0), "kN·m"], ["Moment maximal — fibre inférieure", fx(EN.Minf, 0), "kN·m"], ["Section : b × H (hourdis compris)", `${fx(en.bEnt, 2)} × ${fx(en.Htot, 2)}`, "m"],
      ["Acier fibre supérieure (FeE" + en.feSup + ")", fx(EN.AsSup, 2), "cm²"], ["Acier fibre inférieure (FeE" + en.feInf + ")", fx(EN.AsInf, 2), "cm²"],
      ["Effort tranchant max / ELU", `${fx(EN.Tmax, 0)} / ${fx(EN.Tu, 0)}`, "kN"], ["τu / limite", `${fx(EN.tu, 2)} / ${fx(EN.tlim, 2)}`, "MPa"], ["At/St", fx(EN.AtSt, 2), "cm²/ml"]]);
  h += `<h2>${n0 + 3}. Calculs complémentaires</h2><h3>Levage des poutres</h3><p class="c">Sous un effort concentré F, on dispose dans les deux sens un ferraillage équilibrant 4 % de F, les aciers travaillant aux 2/3 de leur limite élastique.</p>` +
    tbl(["Travée", "Poids de la poutre (t)", "F par trou de levage (t)", "A (cm²)", "Ferraillage"], r.travees.map(t => [esc(t.def.nom), fx((t.LV.F * 2) / 10, 2), fx(t.LV.F / 10, 2), fx(t.LV.A, 2), `${t.LV.nb} DX${p.compl.levage.diam} par sens`]));
  h += `<h3>Frettes sous appareils d'appui</h3>` + kv([["Réaction maximale ELS (Rmax)", fx(r.FR.Rmax, 0), "kN"], ["A = 0,04 Rmax / (2/3 fe) dans chaque direction", fx(r.FR.A, 2), "cm²"], ["Nombre minimal de brins Φ" + p.compl.frettes.diam + " par sens", fx(r.FR.nmin, 2), ""], ["Retenu", `${r.FR.nb} DX${p.compl.frettes.diam}`, "par sens"]]);
  void barArea;
  return h;
}
export const NOTE_CSS = `
.note{font-family:'Outfit',system-ui,sans-serif;color:var(--ink,#18191f);line-height:1.5;font-size:13.5px}
.note h1{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:34px;margin:4px 0}
.note h2{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:23px;margin:34px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--border,#e2ddd6);page-break-after:avoid}
.note h3{font-size:15.5px;font-weight:500;margin:20px 0 6px;color:var(--gold,#a07828)}
.note h4{font-size:14px;font-weight:500;margin:16px 0 6px}
.note h5{font-size:12.5px;font-weight:500;margin:10px 0 4px;color:var(--ink2,#3c3f4d)}
.note .cover{padding:18px 0 10px;border-bottom:2px solid var(--gold,#a07828)}
.note .kicker{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3,#7a7e8e)}
.note .sub{color:var(--ink2,#3c3f4d)}
.note .toc{margin:16px 0;padding:12px 16px;background:var(--bg2,#f0ede8);border-radius:6px}
.note .toc ol{margin:6px 0 0 20px}
.note ul{margin:4px 0 4px 20px}
.note p.c{color:var(--ink2,#3c3f4d);font-size:12.5px;margin:4px 0 8px}
.note table{border-collapse:collapse;margin:6px 0 10px;font-size:12.5px;font-variant-numeric:tabular-nums}
.note table.t th{background:var(--bg2,#f0ede8);font-weight:500;text-align:left;padding:4px 8px;border:1px solid var(--border,#e2ddd6)}
.note table.t td{padding:3px 8px;border:1px solid var(--border,#e2ddd6)}
.note table.small{font-size:11.5px}
.note td.n{text-align:right;white-space:nowrap}
.note table.kv td{padding:2px 10px 2px 0;border-bottom:1px dotted var(--border,#e2ddd6)}
.note table.kv td.u{color:var(--ink3,#7a7e8e);font-size:11.5px}
.note .grid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:4px 20px}
.note .flex{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}
.note .ok{color:#0a8a78;font-weight:500}.note .ko{color:#c0392b;font-weight:500}
.note svg.chart{width:100%;max-width:680px;height:auto;font-size:10px;fill:var(--ink3,#7a7e8e)}
.note svg .g{stroke:var(--border,#e2ddd6);stroke-width:.6}
.note svg path{fill:none;stroke-width:1.6}
.note svg path.mm,.note .k.mm{stroke:#1a4fd6;background:#1a4fd6}
.note svg path.md,.note .k.md{stroke:#c0392b;background:#c0392b;stroke-dasharray:4 3}
.note svg path.mr,.note .k.mr{stroke:#0a8a78;background:#0a8a78}
.note .leg{font-size:11.5px;color:var(--ink2,#3c3f4d);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.note .leg .k{display:inline-block;width:18px;height:3px;margin-left:10px}
.note svg.sk{width:260px;height:auto}
.note svg.sk .pt{fill:#eae6df;stroke:#3c3f4d;stroke-width:1}
.note svg.sk .hd{fill:#f4f1ec;stroke:#7a7e8e;stroke-width:1}
.note svg.sk .bar{fill:#3c3f4d}
.note svg.sk .dim{fill:#1a4fd6;font-size:11px}
@media print{.note h2{page-break-before:auto}.note table{page-break-inside:avoid}}
`;
