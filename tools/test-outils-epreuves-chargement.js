/* EPREUVES — tests (node tools/test-outils-epreuves-chargement.js) */
const E = require('../outils/js/epreuves-chargement.js');
const CH = require('../outils/js/charges.js');
let f = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const near = (a, b, t = 1e-3) => Math.abs(a - b) <= t * Math.max(1e-9, Math.abs(b));
const r2 = (x) => (+x).toFixed(3);

const EI = 30000e3 * 0.5;             // E = 30 000 MPa, I = 0,5 m⁴
const simple = (L, sec, veh, extra = {}) => E.calcul(Object.assign({ usage: 'route', type: 'poutre', travees: [{ L, Ig: 0.5 }], A: 10,
  beton: { mode: 'saisi', E: 30000 }, g: 10, vehicule: veh, route: { classe: 1, Lc: 7, modeles: { AL: true, Bc: true, Bt: true } },
  sections: sec, convoi: { nLmax: 1 }, mesures: { quarts: true } }, extra));

/* 1. Module instantané */
ok(near(E.Ei({ mode: 'bael', fc: 30 }), 11000 * Math.cbrt(30), 1e-12), 'Eij BAEL 30 MPa = ' + r2(E.Ei({ fc: 30 })) + ' MPa');
ok(near(E.Ei({ mode: 'ec2', fc: 30 }), 32837, 1e-4), 'Ecm EC2 C30 = ' + r2(E.Ei({ mode: 'ec2', fc: 30 })) + ' MPa (≈ 33 GPa tab. 3.1)');

/* 2. Poutre simple, essieu unique 10 t à mi-travée : M = PL/4, flèche PL³/48EI, rotation PL²/16EI, réactions P/2 */
{
  const L = 20, P = 100, r = simple(L, [{ type: 'travee', k: 1, xi: 0.5, nF: 1, nL: 1 }], { essieux: [{ d: 0, t: 10 }], av: 1, ar: 1 });
  const c = r.cas[0], mid = c.fl.find((p) => p.xi === 0.5), q = c.fl.find((p) => p.xi === 0.25);
  ok(near(c.Mep, P * L / 4, 1e-6), 'M mi-travée PL/4 = ' + r2(c.Mep));
  ok(near(c.x1, 10, 1e-9), 'position optimale : essieu à mi-travée ' + r2(c.x1));
  ok(near(mid.v, P * L ** 3 / 48 / EI, 1e-6), 'flèche PL³/48EI = ' + (mid.v * 1000).toFixed(4) + ' mm');
  ok(near(q.v, P * 5 * (3 * L * L - 4 * 25) / 48 / EI, 1e-6), 'flèche au quart Pa(3L²−4a²)/48EI');
  ok(near(Math.abs(c.rot[0].th), P * L * L / 16 / EI, 1e-6), 'rotation sur appui PL²/16EI = ' + (c.rot[0].th * 1e3).toFixed(4) + ' mrad');
  ok(near(c.reac[0].R, 50, 1e-6) && near(c.reac[1].R, 50, 1e-6), 'réactions P/2');
}

/* 3. Poutre simple, camion 3 essieux : théorème de Barré (moment maximal absolu) et flèche par superposition */
{
  const L = 18, veh = { essieux: [{ d: 0, t: 6 }, { d: 4.5, t: 12 }, { d: 6, t: 12 }], av: 1, ar: 1 };
  const ax = [{ d: 0, P: 60 }, { d: 4.5, P: 120 }, { d: 6, P: 120 }], W = 300, xR = ax.reduce((s, a) => s + a.P * a.d, 0) / W;
  // Barré : le milieu de la travée partage en deux l'intervalle résultante – essieu k ; on garde l'essieu donnant le plus grand moment
  let best = { M: -1 };
  for (const k of ax) {
    const s = L / 2 + (k.d - xR) / 2;           // abscisse de l'essieu k quand x(1er essieu)=s−k.d
    const x0 = s - k.d; let M = 0;
    for (const a of ax) { const xa = x0 + a.d; if (xa < 0 || xa > L) continue; M += a.P * (xa <= s ? xa * (L - s) / L : s * (L - xa) / L); }
    if (M > best.M) best = { M, s, x0 };
  }
  const r = simple(L, [{ type: 'travee', k: 1, xi: best.s / L, nF: 1, nL: 1 }], veh);
  const c = r.cas[0];
  ok(near(c.Mep, best.M, 2e-4), 'Barré : Mmax absolu ' + r2(best.M) + ' kN·m, obtenu ' + r2(c.Mep));
  const xFirst = Math.min(...c.onDeck.map((a) => a.x)), xLast = Math.max(...c.onDeck.map((a) => a.x));
  ok(near(c.sens > 0 ? xLast - 6 : xFirst, best.x0, 0.01 / best.x0) || near(c.sens > 0 ? L - xLast : xFirst, best.x0, 0.01 / best.x0) || Math.abs((c.sens > 0 ? c.x1 - 6 : c.x1) - best.x0) < 0.051, 'Barré : position du convoi (à 5 cm près)');
  // flèche à mi-travée par superposition des formules de la poutre simple
  const dfl = (a, x) => { const b = L - a; return x <= a ? b * x * (L * L - b * b - x * x) / (6 * EI * L) : a * (L - x) * (L * L - a * a - (L - x) * (L - x)) / (6 * EI * L); };
  const v = c.onDeck.reduce((s, a) => s + a.P * dfl(a.x, L / 2), 0);
  ok(near(c.fl.find((p) => p.xi === 0.5).v, v, 1e-5), 'flèche sous camion = superposition analytique ' + (v * 1000).toFixed(4) + ' mm');
}

/* 4. Deux essieux égaux P, d : Mmax = P(L − d/2)²/(2L) à d/4 du milieu (Barré) */
{
  const L = 15, d = 1.35, P = 160, r = simple(L, [{ type: 'travee', k: 1, xi: (L / 2 - d / 4) / L, nF: 1, nL: 1 }], { essieux: [{ d: 0, t: 16 }, { d: 1.35, t: 16 }] });
  ok(near(r.cas[0].Mep, P * (L - d / 2) ** 2 / (2 * L), 1e-4), 'Barré 2 essieux : ' + r2(r.cas[0].Mep) + ' / ' + r2(P * (L - d / 2) ** 2 / (2 * L)));
}

/* 5. Deux travées égales : moment sur appui sous charge unique, max à a = L/√3 : M = −2PL/(12√3)·… = −0,0962 PL */
{
  const L = 12, P = 100;
  const r = E.calcul({ usage: 'route', type: 'poutre', travees: [{ L, Ig: 0.5 }, { L, Ig: 0.5 }], A: 10, beton: { mode: 'saisi', E: 30000 }, g: 10,
    vehicule: { essieux: [{ d: 0, t: 10 }] }, route: { Lc: 7 }, sections: [{ type: 'appui', k: 1, nF: 1, nL: 1 }], convoi: { nLmax: 1 } });
  const c = r.cas[0], a = L / Math.sqrt(3), Mth = -P * a * (L * L - a * a) / (4 * L * L);
  ok(near(c.Mep, Mth, 2e-4), 'M appui 2 travées max ' + r2(c.Mep) + ' / ' + r2(Mth));
  ok(near(Math.min(c.x1, 2 * L - c.x1), a, 0.06 / a), 'position a = L/√3 = ' + r2(a) + ' (obtenu ' + r2(Math.min(c.x1, 2 * L - c.x1)) + ')');
  ok(near(c.reac.reduce((s, q) => s + q.R, 0), P, 1e-9), 'équilibre vertical');
}

/* 6. Inertie variable (parabolique sur h) : flèche comparée à une intégration de Mohr indépendante */
{
  const L = 20, P = 200, Ig = 1.2, Im = 0.4;
  const r = E.calcul({ usage: 'route', type: 'poutre', travees: [{ L, Ig, Im, Id: Ig }], A: 10, beton: { mode: 'saisi', E: 30000 }, g: 10,
    vehicule: { essieux: [{ d: 0, t: 20 }] }, route: { Lc: 7 }, sections: [{ type: 'travee', k: 1, nF: 1, nL: 1 }], convoi: { nLmax: 1 }, nseg: 40 });
  let s = 0; const N = 4000;
  for (let i = 0; i <= N; i++) { const x = L * i / N, m = (x <= L / 2 ? x / 2 : (L - x) / 2); const w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2; s += w * P * m * m / (30000e3 * E.inertie({ Ig, Im, Id: Ig }, x / L)); }
  const v = s * L / N / 3;
  ok(near(r.cas[0].fl[0].v, v, 2e-3), 'inertie variable : flèche ' + (r.cas[0].fl[0].v * 1000).toFixed(3) + ' / Mohr ' + (v * 1000).toFixed(3) + ' mm');
}

/* 7. Taux d'efficacité sur travée simple de 20 m : effets réglementaires calculés indépendamment */
{
  const L = 20, veh = { essieux: [{ d: 0, t: 8 }, { d: 3.8, t: 12 }, { d: 5.15, t: 12 }], av: 1.45, ar: 1.55, voie: 2, larg: 2.5 };
  const r = simple(L, [{ type: 'travee', k: 1, nF: 2, nL: 1 }], veh, { route: { classe: 1, Lc: 7, modeles: { AL: true, Bc: true } } });
  const c = r.cas[0];
  const AL = (2.3 + 360 / (L + 12)) * 1 * 1 * 7 * L * L / 8;      // 2 voies de 3,5 m : a1 = 1, a2 = 3,5/3,5
  // Bc : file la plus défavorable (1 ou 2 camions), balayage indépendant au pas de 1 cm, × 2 files × bc = 1,1
  const BC = [{ d: 0, P: 60 }, { d: 4.5, P: 120 }, { d: 6, P: 120 }];
  const li = (x) => (x < 0 || x > L ? 0 : x <= L / 2 ? x / 2 : (L - x) / 2);
  let file = 0;
  for (let x = -12; x <= L + 30; x += 0.01) {
    let e1 = 0; for (const a of BC) e1 += a.P * li(x + a.d);
    for (let gp = 4.5; gp <= 15; gp += 0.5) { let e2 = e1; for (const a of BC) e2 += a.P * li(x + 6 + gp + a.d); if (e2 > file) file = e2; }
    if (e1 > file) file = e1;
  }
  const Bc = 2 * 1.1 * file, reg = Math.max(AL, Bc);
  ok(near(c.reg.det['A(l)'], AL, 1e-4), 'A(l) 20 m, 2 voies : ' + r2(c.reg.det['A(l)']) + ' / ' + r2(AL));
  ok(near(c.reg.det.Bc, Bc, 1e-3), 'Bc 2 files bc = 1,1 : ' + r2(c.reg.det.Bc) + ' / ' + r2(Bc));
  ok(near(c.etaP, c.Mep / reg, 1e-3) && c.reg.gouv === (AL > Bc ? 'A(l)' : 'Bc'), 'η = ' + r2(c.etaP) + ' (modèle déterminant ' + c.reg.gouv + ')');
  ok(near(c.Mep, c.Mli, 1e-4), 'calcul direct = ligne d’influence (' + r2(c.Mep) + ')');
  // choix automatique du nombre de camions : plus petit nombre donnant η dans [2/3 ; 1]
  const ra = simple(L, [{ type: 'travee', k: 1 }], veh, { route: { classe: 1, Lc: 7, modeles: { AL: true, Bc: true } }, convoi: { nLmax: 3, gmin: 1, gmax: 20 } });
  const ca = ra.cas[0];
  ok(ca.etaP >= 2 / 3 && ca.etaP <= 1 && ca.verdict === 'ok', 'choix automatique : ' + ca.nF + ' file(s) × ' + ca.nL + ' camion(s), η = ' + r2(ca.etaP));
}

/* 8. Courbon : Ki = 1 + n·e·yi/Σy² ; flèche de la poutre la plus chargée = K × flèche moyenne */
{
  const c = E.courbon(4, 2.5, [1.25]);
  ok(near(c.K[3], 1 + 4 * 1.25 * 3.75 / (2 * (3.75 ** 2 + 1.25 ** 2)), 1e-12) && near(c.K.reduce((a, b) => a + b, 0), 4, 1e-12), 'Courbon K = ' + c.K.map((k) => k.toFixed(3)).join(' / '));
  const r = simple(20, [{ type: 'travee', k: 1, nF: 1, nL: 1 }], { essieux: [{ d: 0, t: 10 }], voie: 2, larg: 2.5 },
    { transv: { mode: 'courbon', n: 4, b: 2.5 }, route: { Lc: 7, marge: 0.5, position: 'excentre' } });
  const k = r.cas[0], e = -3.5 + 0.5 + 1.25;
  const K = E.courbon(4, 2.5, [e]).K;
  ok(near(k.Kep, Math.max(...K), 1e-12) && near(k.fl[1].vK, k.fl[1].v * k.Kep, 1e-12), 'flèche poutre la plus chargée = K·f (K = ' + r2(k.Kep) + ')');
}

/* 9. Pont-rail : UIC 71 × Φ2 sur travée de 20 m (valeur du socle 6 075,2 kN·m) et locomotive */
{
  const r = E.calcul({ usage: 'rail', type: 'poutre', travees: [{ L: 20, Ig: 1 }], A: 5, beton: { mode: 'saisi', E: 34000 }, g: 10,
    vehicule: E.VEHICULES.bb, rail: { alpha: 1, phi: 'phi2', nVoies: 1, ecc: [0] }, sections: [{ type: 'travee', k: 1, nF: 1, nL: 1 }] });
  const c = r.cas[0];
  ok(near(c.reg.det.UIC71, 6075.2 * CH.phi2(20), 1e-4), 'UIC 71 × Φ2(20) = ' + r2(c.reg.det.UIC71));
  ok(c.reg.det['SW/0'] === undefined, 'SW/0 non retenu en travée isostatique');
  ok(near(c.etaP, c.Mep / c.reg.val, 1e-12), 'η rail = ' + r2(c.etaP));
}

/* 10. Portique (piles encastrées) et cadre (radier sur sol) : équilibre et moment sur appui négatif */
{
  const base = { usage: 'route', travees: [{ L: 12, Ig: 0.3 }, { L: 12, Ig: 0.3 }], A: 3, beton: { mode: 'saisi', E: 32000 }, g: 10,
    vehicule: E.VEHICULES.c64_32, route: { Lc: 7 }, sections: [{ type: 'travee', k: 1, nF: 1, nL: 1 }, { type: 'appui', k: 1, nF: 1, nL: 1 }] };
  const p = E.calcul(Object.assign({}, base, { type: 'portique', appuis: [{ H: 5, I: 0.2, Ap: 1 }, { H: 6, I: 0.3, Ap: 1.5 }, { H: 5, I: 0.2, Ap: 1 }] }));
  const W = p.cas[0].onDeck.reduce((s, a) => s + a.P, 0);
  ok(near(p.cas[0].reac.reduce((s, q) => s + q.R, 0), W, 1e-6), 'portique : Σ réactions = charge sur l’ouvrage (' + r2(W) + ' kN)');
  ok(p.cas[1].Mep < 0, 'portique : moment sur pile négatif ' + r2(p.cas[1].Mep));
  const cd = E.calcul(Object.assign({}, base, { type: 'cadre', cadre: { H: 4, ks: 40000, B: 9, Ir: 0.3 }, appuis: [{ I: 0.1 }, { I: 0.1 }, { I: 0.1 }],
    sections: [{ type: 'travee', k: 1, nF: 1, nL: 1 }, { type: 'appui', k: 0, nF: 1, nL: 1 }] }));
  const sol = cd.cas[0].reac.find((q) => q.sol);
  ok(near(sol.R, cd.cas[0].onDeck.reduce((s, a) => s + a.P, 0), 1e-6), 'cadre : réaction du sol = charge');
  ok(cd.cas[1].Mep < 0, 'cadre : moment d’angle négatif ' + r2(cd.cas[1].Mep));
}

/* 11. Contrôles de saisie : 1 à 30 travées, biais 30 à 170 gr */
{
  const t = (o) => { try { E.calcul(o); return false; } catch (e) { return true; } };
  const o = { travees: Array.from({ length: 31 }, () => ({ L: 10, Ig: 0.1 })), sections: [{ type: 'travee', k: 1 }] };
  ok(t(o), '31 travées refusées');
  ok(t({ travees: [{ L: 10, Ig: 0.1 }], biais: 25, sections: [{ type: 'travee', k: 1 }] }), 'biais 25 gr refusé');
  const r = E.calcul({ travees: Array.from({ length: 30 }, () => ({ L: 10, Ig: 0.1 })), biais: 60, vehicule: E.VEHICULES.c64_26, route: { Lc: 7 }, sections: [{ type: 'travee', k: 15, nF: 1, nL: 1 }] });
  ok(r.cas.length === 1 && r.av.some((s) => /Biais/.test(s)), '30 travées et biais 60 gr (avertissement) : M = ' + r2(r.cas[0].Mep));
}

/* 12. CAS DE RÉFÉRENCE — note d'épreuves KLE « ponts dalles 11,50 + 15,00 + 15,00 + 11,50 m » (PSIDA-EPREUVES-V01, annexe 2 :
 *     sorties ST1). Section 5,717 m², I = 0,1586 m⁴, E = 34 180 MPa, chaussée 7,50 m (2 voies, classe 1), 2 files de 2 camions
 *     8×4 de 29,9 t (5,75 + 5,75 + 9,2 + 9,2 t ; essieux à 0 / 1,795 / 4,775 / 6,175 m). ST1 : t·m, g = 10.
 *     Écarts : ST1 déplace les convois avec un pas plus grossier (≈ 0,5 à 1 m) ; ici 5 cm → moments de travée 0,5 à 1,3 % plus forts,
 *     moments sur appuis identiques. */
{
  const o = { usage: 'route', type: 'poutre', A: 5.717, g: 10, beton: { mode: 'saisi', E: 34180 },
    travees: [11.5, 15, 15, 11.5].map((L) => ({ L, Ig: 0.1586 })),
    vehicule: { essieux: [{ d: 0, t: 5.75 }, { d: 1.795, t: 5.75 }, { d: 4.775, t: 9.2 }, { d: 6.175, t: 9.2 }], av: 1.007, ar: 1.25, voie: 2, larg: 2.5 },
    route: { classe: 1, Lc: 7.5, marge: 0.5, entraxe: 3, modeles: { AL: true, Bc: true, Bt: true, Mc120: true } },
    convoi: { nLmax: 2, gmin: 0, gmax: 20 },
    sections: [{ type: 'travee', k: 1, xi: 0.4, nF: 2, nL: 2 }, { type: 'travee', k: 2, xi: 0.5, nF: 2, nL: 2 }, { type: 'appui', k: 1, nF: 2, nL: 2 }, { type: 'appui', k: 2, nF: 2, nL: 2 }] };
  const r = E.calcul(o), tm = (v) => Math.abs(v) / 10;
  const ref = [
    // [cas, convoi d'épreuve ST1, A(l) ST1, Bc ST1, Mc120 ST1, tolérance épreuve]
    [0, 102.28, 158.37, 121.71, 184.92, 0.015],
    [1, 118.32, 176.22, 129.49, 202.27, 0.01],
    [2, 121.26, 166.52, 137.40, 138.64, 0.002],
    [3, 131.95, 179.35, 148.20, 129.03, 0.002],
  ];
  const nom = ['travée 1 (0,4 L)', 'travée 2 (0,5 L)', 'pile 1', 'pile 2'];
  for (const [i, ep, al, bc, mc, tol] of ref) {
    const c = r.cas[i];
    ok(near(tm(c.Mep), ep, tol), 'ST1 ' + nom[i] + ' : épreuve ' + tm(c.Mep).toFixed(2) + ' / ' + ep + ' t·m (' + ((tm(c.Mep) / ep - 1) * 100).toFixed(2) + ' %)');
    ok(near(tm(c.reg.det['A(l)']), al, 0.012), 'ST1 ' + nom[i] + ' : A(l) ' + tm(c.reg.det['A(l)']).toFixed(2) + ' / ' + al + ' (' + ((tm(c.reg.det['A(l)']) / al - 1) * 100).toFixed(2) + ' %)');
    ok(near(tm(c.reg.det.Bc), bc, 0.01), 'ST1 ' + nom[i] + ' : Bc ' + tm(c.reg.det.Bc).toFixed(2) + ' / ' + bc + ' (' + ((tm(c.reg.det.Bc) / bc - 1) * 100).toFixed(2) + ' %)');
    if (i < 2) ok(near(tm(c.reg.det.Mc120), mc, 0.005), 'ST1 ' + nom[i] + ' : Mc120 ' + tm(c.reg.det.Mc120).toFixed(2) + ' / ' + mc);
  }
  // taux d'efficacité : rapport épreuve / max(A(l), Bc) (charges civiles non pondérées, sans δ) comparé à celui des sorties ST1
  const o2 = JSON.parse(JSON.stringify(o)); o2.route.modeles = { AL: true, Bc: true };
  const r2_ = E.calcul(o2);
  ref.forEach(([i, ep, al, bc]) => { const e0 = ep / Math.max(al, bc), c = r2_.cas[i]; ok(near(c.etaP, e0, 0.02), 'ST1 ' + nom[i] + ' : η = ' + c.etaP.toFixed(3) + ' / ' + e0.toFixed(3)); });
}

/* 13. Schémas SVG : génération sans erreur */
{
  const r = E.calcul({ travees: [{ L: 15, Ig: 0.2 }, { L: 15, Ig: 0.2 }], biais: 80, vehicule: E.VEHICULES.c64_32, route: { Lc: 7 }, transv: { mode: 'courbon', n: 5, b: 1.6 },
    sections: [{ type: 'travee', k: 1 }, { type: 'appui', k: 1 }] });
  const s = E.svgElevation(r, r.cas[0]) + E.svgPlan(r, r.cas[1]);
  ok(/<svg/.test(s) && !/NaN|undefined/.test(s), 'SVG élévation et plan (' + s.length + ' car.)');
}

console.log(`\n${n - f}/${n} tests réussis`);
process.exit(f ? 1 : 0);
