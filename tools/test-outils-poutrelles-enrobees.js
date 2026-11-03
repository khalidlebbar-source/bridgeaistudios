/* INERPE — tests du moteur (node tools/test-outils-poutrelles-enrobees.js). */
const I = require('../outils/js/poutrelles-enrobees.js');
let f = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-30, Math.abs(b));
const near = (a, b, t = 1e-6) => rel(a, b) <= t;

/* 1. Catalogue : A et Iy recalculés à partir de h, b, tw, tf, r (écart < 1 %), Wpl publiés */
{
  const P = I.profiles;
  ok(P.list.length === 96, 'catalogue : 4 séries × 24 tailles = ' + P.list.length + ' profilés');
  let mA = 0, mI = 0, worst = '';
  for (const p of P.list) {
    const a = rel(p.Acalc, p.A), i = rel(p.Iycalc, p.Iy);
    if (Math.max(a, i) > Math.max(mA, mI)) worst = p.nom;
    mA = Math.max(mA, a); mI = Math.max(mI, i);
  }
  ok(mA < 0.01 && mI < 0.01, `A et Iy recalculés : écart max ${(mA * 100).toFixed(2)} % / ${(mI * 100).toFixed(2)} % (${worst})`);
  const wpl = { 'HEB 300': 1869, 'HEA 320': 1628, 'HEB 500': 4815, 'HEM 600': 8772, 'HEB 1000': 14860, 'HEAA 400': 1824 };
  for (const [n, w] of Object.entries(wpl)) ok(rel(P.get(n).Wpl, w) < 0.005, `Wpl ${n} = ${P.get(n).Wpl} cm³ (catalogue ${w})`);
  ok(P.get('HE 320 A') === P.get('HEA 320') && P.get('he_900_b').nom === 'HEB 900' && P.get('HEB900').nom === 'HEB 900', 'lecture des noms « HE 320 A », « HE_900_B », « HEB900 »');
  const s = P.si('HEB 500');
  ok(near(s.h, 0.5) && near(s.Iy, 107175e-8) && near(s.A, 238.6e-4), 'export SI pour les autres modules (BA.enrobees.profiles.si)');
}

/* 2. ELS analytique : profilé reconstitué sans congés, dalle rectangulaire, calcul par rectangles */
const prs = { mode: 'saisi', h: 0.5, b: 0.3, tf: 0.03, tw: 0.015, r: 0 };
const base = { profil: prs, N: 4, B: 2.4, csup: 0.12, typeSous: 'apparente', ecof: 0, nappes: [], fck: 30, fyk: 500,
  nuance: 'S355', gammaA: 1, nMode: 'saisi', nCourt: 6, nLong: 18, congesELU: false };
{
  const rects = (L) => { const A = L.reduce((s, r) => s + r[0], 0), y = L.reduce((s, r) => s + r[0] * r[1], 0) / A; return { A, y, I: L.reduce((s, r) => s + r[2] + r[0] * (r[1] - y) ** 2, 0) }; };
  const hw = 0.44, st = rects([[0.3 * 0.03, 0.015, 0.3 * 0.03 ** 3 / 12], [0.3 * 0.03, 0.485, 0.3 * 0.03 ** 3 / 12], [0.015 * hw, 0.25, 0.015 * hw ** 3 / 12]]);
  const r = I.calcul(base);
  ok(near(r.seules.I, 4 * st.I, 1e-6), 'poutrelles seules : I = N·Ia ' + r.seules.I.toExponential(5));
  // béton non fissuré de y = 0,03 (dessus de l'aile inférieure) à 0,62, n = 6
  const n = 6, zc = 0.03, H = 0.62, Ac = 2.4 * (H - zc) / n;
  const ref = rects([[4 * st.A, st.y, 4 * st.I], [Ac, (H + zc) / 2, 2.4 * (H - zc) ** 3 / 12 / n]]);
  const c = r.travee.cas.find((x) => x.id === 'ctnf');
  ok(near(c.I, ref.I, 1e-9) && near(c.yG, ref.y, 1e-9), `non fissuré n = 6 : I = ${c.I.toFixed(7)} m⁴ (rectangles ${ref.I.toFixed(7)})`);
  ok(near(c.betonSup.W, n * c.I / (H - c.yG), 1e-9) && near(c.acierInf.W, c.I / c.yG, 1e-9), 'modules I/v : béton n·I/v1, acier I/v2');
  // fissuré : moment statique nul, la zone de béton commence à l'axe neutre
  for (const cas of r.travee.cas.filter((x) => x.fissure).concat(r.appui.cas.filter((x) => x.fissure))) {
    const S = I.prepare(base), [c0, c1] = cas.zoneBeton;
    const m = 4 * S.Ap * (S.yp - cas.yG) + 2.4 * (c1 - c0) / cas.n * ((c0 + c1) / 2 - cas.yG);
    ok(Math.abs(m) < 1e-10 && (cas.sens > 0 ? near(c0, cas.yG, 1e-9) : near(c1, cas.yG, 1e-9)), `${cas.sens > 0 ? 'travée' : 'appui'} ${cas.titre} : moment statique nul à l'axe neutre (y = ${cas.yG.toFixed(4)} m)`);
  }
  // déduction des vides : I non fissuré diminue exactement de N·Ia/n + Steiner
  const r2 = I.calcul(Object.assign({}, base, { deduire: true })), c2 = r2.travee.cas.find((x) => x.id === 'ctnf');
  const ref2 = rects([[4 * st.A, st.y, 4 * st.I], [Ac, (H + zc) / 2, 2.4 * (H - zc) ** 3 / 12 / n], [-4 * (st.A - 0.3 * 0.03) / n, (4 * st.A * st.y / 4 - 0.3 * 0.03 * 0.015) / (st.A - 0.3 * 0.03), 0]]);
  ok(c2.I < c.I && rel(c2.A, ref2.A) < 1e-6, 'déduction de l’acier noyé dans le béton : aire homogénéisée ' + c2.A.toFixed(6));
}

/* 3. Symétrie travée / appui : profilé symétrique entièrement enrobé, nappes symétriques */
{
  const d = Object.assign({}, base, { typeSous: 'enrobee', cinf: 0.12, nappes: [{ pos: 'sup', As: 30, d: 0.05 }, { pos: 'inf', As: 30, d: 0.05 }] });
  const r = I.calcul(d);
  let okS = true;
  for (const id of ['ctnf', 'ltnf', 'ctf', 'ltf']) {
    const t = r.travee.cas.find((x) => x.id === id), a = r.appui.cas.find((x) => x.id === id);
    okS = okS && near(t.I, a.I, 1e-6) && near(t.yG + a.yG, 0.5, 1e-6);
  }
  ok(okS, 'section symétrique : inerties travée = appui, axes neutres symétriques');
  ok(near(r.travee.elu.M, r.appui.elu.M, 1e-6), `section symétrique : Mpl,Rd travée = appui = ${r.travee.elu.M.toFixed(1)} kN·m`);
}

/* 4. ELU analytique : axe neutre plastique dans la dalle au-dessus des poutrelles */
{
  const d = Object.assign({}, base, { N: 1, csup: 0.3, fck: 35, gammaC: 1.5, gammaA: 1.0 });
  const r = I.calcul(d), S = I.prepare(d);
  const Fa = 1 * S.Ap * 355, sc = 0.85 * 35 / 1.5, x = Fa / (sc * 2.4);
  const M = Fa * (0.8 - S.yp - x / 2) * 1000;
  ok(x < 0.3 && near(r.travee.elu.xpl, x, 1e-6), `ELU travée : xpl = Na/(0,85 fcd B) = ${x.toFixed(5)} m`);
  ok(near(r.travee.elu.M, M, 1e-6), `ELU travée : Mpl,Rd = Na (H − ya − x/2) = ${M.toFixed(1)} kN·m`);
  // sur appui, armatures supérieures seules, béton tendu négligé : PNA dans l'acier, équilibre des forces
  const da = Object.assign({}, d, { nappes: [{ pos: 'sup', As: 80, d: 0.06 }] });
  const ra = I.calcul(da).appui.elu;
  ok(ra.yn > 0 && ra.yn < 0.5 && ra.M > 0, `ELU appui : axe neutre plastique dans la poutrelle, y = ${ra.yn.toFixed(4)} m, M = ${ra.M.toFixed(1)} kN·m`);
  // appui sans béton comprimé (PNA au-dessus de la sous-face béton impossible) : borne Mpl de l'acier + armatures
  const Mpl = 1 * I.profiles.geomI(500, 300, 15, 30, 0).Wpl * 1e-9 * 355 * 1000;
  ok(ra.M > Mpl, `ELU appui ≥ Mpl des poutrelles seules (${Mpl.toFixed(1)} kN·m)`);
  // réduction β pour S460 (EN 1994-2 §6.2.1.2(2))
  const r46 = I.calcul(Object.assign({}, d, { nuance: 'S460', csup: 0.07 })).travee.elu;
  ok(r46.xplRel <= 0.15 ? r46.beta === 1 : near(r46.beta, 1 - 0.15 * Math.min(1, (r46.xplRel - 0.15) / 0.25), 1e-12), `S460 : β = ${r46.beta.toFixed(4)} pour xpl/h = ${r46.xplRel.toFixed(3)}`);
}

/* 5. Matériaux et coefficients d'équivalence EN 1994-2 §5.4.2.2 */
{
  ok(near(I.Ecm(35), 34077, 1e-4), 'Ecm(C35/45) = 34 077 MPa (EN 1992-1-1 tab. 3.1)');
  const S = I.prepare(Object.assign({}, base, { fck: 35, nMode: 'ec4', phi: 2.5, psiL: 1.1 }));
  ok(near(S.n0, 210000 / I.Ecm(35)) && near(S.nL, S.n0 * (1 + 1.1 * 2.5)), `n0 = ${S.n0.toFixed(3)}, nL = n0 (1 + ψL φt) = ${S.nL.toFixed(3)}`);
  ok(I.fyNuance('S355', 40) === 355 && I.fyNuance('S355', 41) === 335 && I.fyNuance('S460', 60) === 430, 'fy selon l’épaisseur (EN 1993-1-1 tab. 3.1)');
}

/* 6. Lecture d'un fichier .don (jeu de données synthétique) */
{
  const txt = ['application ;', 'INERPE', 'typesec ;', '1', 'typedim ;', '0', 'largtab ;', '3.5', 'eptab ;', '0.62', 'nbpout ;', '5',
    'typepout ;', 'HE 500 B', 'haupout ;', '0.5', 'epaile ;', '0.028', 'epcof ;', '0.02', 'limelas ;', '355', 'nuance ;', '2',
    'fcj ;', '30', 'fe ;', '500', 'nltbael ;', '18', 'nctbael ;', '6', 'acierlonpos ;', '0.06', 'acierloncomp ;', '40', 'FIN_DICO'].join('\r\n');
  const o = I.lireDon(txt);
  ok(o.section === 'appui' && o.donnees.profil.nom === 'HEB 500' && near(o.donnees.csup, 0.12) && o.donnees.nappes[0].pos === 'sup' && o.donnees.N === 5, 'lecture .don : appui, HEB 500, enrobage 0,12 m, nappe supérieure 40 cm²');
}

/* 7. Cas de référence du programme d'origine (exemples Inerpe, Inerpe2, Inerpe3 — valeurs des notes .res).
 * Hypothèses du programme d'origine : γa = 1,05, γc = 1,5, γs = 1,15, n = 6 / 18 saisis, congés ignorés à l'ELU,
 * béton à partir du dessus de l'aile inférieure + coffrage perdu, vides d'acier non déduits. */
const ex = {
  Inerpe: { profil: { mode: 'cat', nom: 'HE 320 A' }, N: 20, B: 13.64, csup: 0.10, ecof: 0.025, nappes: [], fck: 25, fyk: 400, fy: 355,
    gammaA: 1.05, nMode: 'saisi', nCourt: 6, nLong: 18, congesELU: false },
  Inerpe2: { profil: { mode: 'cat', nom: 'HE 900 B' }, N: 8, B: 4.12, csup: 0.10, ecof: 0.03, nappes: [{ pos: 'inf', As: 56, d: 0.05 }], fck: 25, fyk: 400, fy: 225,
    gammaA: 1.05, nMode: 'saisi', nCourt: 6, nLong: 18, congesELU: false },
  Inerpe3: { profil: { mode: 'saisi', h: 0.359, b: 0.309, tf: 0.04, bi: 0.30, tfi: 0.03, tw: 0.021, r: 0 }, N: 1, B: 0.45, csup: 0.091, ecof: 0.02,
    nappes: [{ pos: 'inf', As: 56, d: 0.05 }], fck: 25, fyk: 400, fy: 345, gammaA: 1.05, nMode: 'saisi', nCourt: 6, nLong: 18, congesELU: false },
};
// [Mrd MN·m, Vu m, seules I, seules v2, { cas: [I acier, v1, I/v1 béton, v2, I/v2 acier, (v arm, I/v arm)] }, Idef 18, Idef 6]
const REF = {
  Inerpe: [12.90525, 0.11452, 0.0045856, 0.155, {
    ltf: [0.0073535, 0.196, 0.67425, 0.214, 0.03441], ctf: [0.0098856, 0.151, 0.39299, 0.259, 0.03816],
    ltnf: [0.0084214, 0.218, 0.69598, 0.192, 0.04382], ctnf: [0.0150899, 0.201, 0.45089, 0.209, 0.07213] }, 0.007887488, 0.012487780],
  Inerpe2: [26.52040, 0.31529, 0.0395280, 0.450, {
    ltf: [0.0503132, 0.472, 1.91887, 0.528, 0.09528, 0.413, 0.12181], ctf: [0.0620753, 0.387, 0.96335, 0.613, 0.10120, 0.498, 0.12455],
    ltnf: [0.0567223, 0.519, 1.94103, 0.481, 0.11804], ctnf: [0.0885365, 0.496, 1.06264, 0.504, 0.17564] }, 0.052655229, 0.074177115],
  Inerpe3: [1.62680, 0.24056, 0.0006003, 0.196, {
    ltf: [0.0007812, 0.247, 0.05694, 0.203, 0.00385, 0.103, 0.00758], ctf: [0.0009864, 0.217, 0.02731, 0.233, 0.00423, 0.133, 0.00740],
    ltnf: [0.0008091, 0.254, 0.05392, 0.196, 0.00412], ctnf: [0.0011152, 0.237, 0.02675, 0.213, 0.00523] }, 0.000778022, 0.000981529],
};
const tol = 2e-3;
for (const [nom, d] of Object.entries(ex)) {
  const r = I.calcul(d), R = REF[nom], t = r.travee;
  ok(rel(t.elu.M / 1000, R[0]) < 5e-4 && Math.abs(t.elu.xpl - R[1]) < 5e-5, `${nom} ELU : Mrd = ${(t.elu.M / 1000).toFixed(5)} MN·m (origine ${R[0]}), Vu = ${t.elu.xpl.toFixed(5)} m (origine ${R[1]})`);
  // Poutrelles seules : Inerpe3 (PRS dissymétrique) — l'origine affiche 0,0006003 m⁴ (valeur saisie du .don) alors que ses
  // inerties mixtes sont calculées avec Ia = 0,00059497 m⁴ (recalcul exact, que nous retrouvons) : écart 0,9 % propre à l'origine.
  const tolS = nom === 'Inerpe3' ? 0.01 : tol;
  ok(rel(r.seules.I, R[2]) < tolS && Math.abs(r.seules.acierInf.v - R[3]) < 6e-4, `${nom} poutrelles seules : I = ${r.seules.I.toFixed(7)} (origine ${R[2]}), v2 = ${r.seules.acierInf.v.toFixed(3)}`);
  for (const [id, v] of Object.entries(R[4])) {
    const c = t.cas.find((x) => x.id === id);
    const aOk = rel(c.I, v[0]) < tol && Math.abs(c.betonSup.v - v[1]) < 6e-4 && Math.abs(c.acierInf.v - v[3]) < 6e-4 && rel(c.acierInf.W, v[4]) < 3e-3;
    ok(aOk, `${nom} ${c.titre} (n = ${c.n}) : I = ${c.I.toFixed(7)} (origine ${v[0]}), v1 = ${c.betonSup.v.toFixed(3)}, I/v2 = ${c.acierInf.W.toFixed(5)} (origine ${v[4]})`);
    if (v.length > 5) ok(Math.abs(c.armatures[0].v - v[5]) < 6e-4 && rel(c.armatures[0].W, v[6]) < 3e-3, `${nom} ${c.titre} armatures : v = ${c.armatures[0].v.toFixed(3)}, I/v = ${c.armatures[0].W.toFixed(5)} (origine ${v[6]})`);
    // Module béton I/v1 = n·I/v1. Sans armatures (Inerpe) et en section fissurée, identique à l'origine. En section non
    // fissurée AVEC armatures, la table « ELS/Béton » de l'origine n'est pas cohérente avec sa propre table « ELS/Acier » :
    // elle vaut n·I − (n − 1)·As·(yG − ys)² (armatures comptées comme du béton dans l'inertie mais pas dans le centre de
    // gravité). Nous gardons n·I (cohérent) et vérifions que l'écart s'explique exactement par ce terme.
    let Wb = c.betonSup.W;
    if (!c.fissure && c.armatures.length) {
      const a = c.armatures[0], Ib = c.n * c.I - (c.n - 1) * a.As * a.v * a.v;
      ok(rel(Ib / c.betonSup.v, v[2]) < 3e-3, `${nom} ${c.titre} I/v1 béton : nous ${Wb.toFixed(5)}, origine ${v[2]} — écart ${((Wb / v[2] - 1) * 100).toFixed(1)} % expliqué par le terme (n−1)·As·d² (${(Ib / c.betonSup.v).toFixed(5)})`);
    } else ok(rel(Wb, v[2]) < 3e-3, `${nom} ${c.titre} I/v1 béton = ${Wb.toFixed(5)} m³ (origine ${v[2]})`);
  }
  // Inertie de déformation (If + Inf)/2 : l'origine l'évalue SANS les armatures passives (vérifié sur Inerpe2 : 0,01 %).
  // Inerpe3 (PRS dissymétrique) : la table de l'origine (0,000778 / 0,000982) n'est cohérente avec aucune de ses propres
  // inerties fissurée / non fissurée (moyenne 0,000795 / 0,001051 avec armatures, 0,000731 / 0,000955 sans) — résultat
  // non retrouvé, signalé ; on vérifie seulement qu'il est encadré par nos deux variantes.
  if (nom !== 'Inerpe3') ok(rel(t.deform.longSansAs, R[5]) < tol && rel(t.deform.courtSansAs, R[6]) < tol, `${nom} inertie de déformation (If + Inf)/2 sans armatures : n = 18 ${t.deform.longSansAs.toFixed(7)} (origine ${R[5]}), n = 6 ${t.deform.courtSansAs.toFixed(7)} (origine ${R[6]})`);
  else ok(t.deform.longSansAs < R[5] && R[5] < t.deform.long && t.deform.courtSansAs < R[6] && R[6] < t.deform.court, `${nom} inertie de déformation : origine ${R[5]} / ${R[6]} encadrée par nos valeurs sans / avec armatures (${t.deform.longSansAs.toFixed(7)}–${t.deform.long.toFixed(7)} ; ${t.deform.courtSansAs.toFixed(7)}–${t.deform.court.toFixed(7)}) — écart non expliqué`);
}
process.exit(f ? 1 : 0);
