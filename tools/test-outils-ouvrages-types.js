/* OUVRAGES TYPES — tests de cohérence de la chaîne (node tools/test-outils-ouvrages-types.js).
 * Le module enchaîne des modules déjà validés : on vérifie que les efforts transmis d'un module à l'autre sont identiques
 * à ceux d'un appel direct, que les quantités sont celles de la géométrie, que les plans ne contiennent pas de NaN et que
 * les ouvrages par défaut (dalle BA 3 travées, poutrelles enrobées, cadre, portique, ponts-routes) se calculent de bout en bout.
 * Aucun exemple chiffré d'origine n'existe pour ce module. */
const O = require('../outils/js/ouvrages-types.js');
const RB = require('../outils/js/tablier-rail.js');
const RO = require('../outils/js/tablier-route.js');
const RH = require('../outils/js/efforts-horizontaux.js');
const AM = require('../outils/js/elastomeres.js');
const F = require('../outils/js/fondations.js');
const RR = require('../outils/js/cadres-portiques.js');
const PC = require('../outils/js/piles-culees.js');
let f = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));
const GR = Math.PI / 200;
const noNaN = (t) => !/NaN|undefined|Infinity/.test(t);

/* ───────── 1. Pont-rail dalle BA, 3 travées (jeu par défaut) ───────── */
const s1 = O.defaut('radba');
const R1 = O.calcul(s1);
{
  ok(R1.tab.d.travees.length === 3 && R1.geo.appuis.length === 4, 'Dalle BA 3 travées : tablier et 4 appuis calculés de bout en bout');
  // tablier : identique à un appel direct du module TABLIER RAIL
  const T = RB.calcul(O.tablierInput(O.normaliser(s1)));
  const iMid = T.secs.findIndex((s) => s.kind === 't' && s.travee === 1 && Math.abs(s.x - 24) < 1e-6);
  ok(iMid >= 0 && near(R1.tab.secs[iMid].cM.ELU.max, T.secs[iMid].cM.ELU.max), 'Tablier : M ELU mi-travée centrale identique à l’appel direct (' + T.secs[iMid].cM.ELU.max.toFixed(1) + ' kN·m)');
  ok(T.app.every((a, j) => near(R1.tab.app[j].R.pp, a.R.pp) && near(R1.tab.app[j].R.A.max, a.R.A.max)), 'Tablier : réactions par file identiques');
  // export vers les efforts horizontaux : G et Q par file = export du module de tablier
  const exp = RB.exportRephor(T);
  ok(exp.ap.every((a, j) => a.Gmax === R1.rephorPage.ap[j].Gmax && a.Qmax === R1.rephorPage.ap[j].Qmax), 'Efforts horizontaux : G et Q transmis = export du tablier (' + exp.ap.map((a) => a.Gmax).join(' / ') + ' kN)');
  ok(R1.rephorPage.ap.every((a, j) => a.hfut > 0 && near(a.hfut, +(R1.geo.appuis[j].culee ? R1.geo.appuis[j].hMur : R1.geo.appuis[j].hfut).toFixed(3))), 'Efforts horizontaux : hauteurs des fûts et murs issues du profil en long');
  // répartition des efforts horizontaux : identique à un appel direct
  const H = RH.calc(O.rephorInput(R1.rephorPage.v, R1.rephorPage.ap));
  ok(H.parAppui.every((p, j) => near(p.combs[0].H.abs, R1.rephor.parAppui[j].combs[0].H.abs, 1e-9)), 'Efforts horizontaux : H ELU par appui identiques à l’appel direct (' + H.parAppui.map((p) => p.combs[0].H.abs.toFixed(0)).join(' / ') + ' kN)');
  // appareils : la vérification directe (ÉLASTOMÈRES) de la plaque retenue donne le même verdict
  const ap = R1.appareils.find((a) => a.app === 'elasto' && a.plaque);
  const inp = R1.rephorInp;
  const v = AM.verifier({ regl: 'en1337', plaque: ap.plaque, combis: ap.combis, opts: { G: inp.Gld, Gd: inp.Gcd, sigLim: inp.sigLim, alpha0: inp.alpha0, hmode: 'v', fy: 235 } });
  ok(v.ok === ap.ok && near(v.tauxMax, ap.taux, 1e-9), `Appareils : vérification directe de ${Math.round(ap.plaque.a * 1000)} × ${Math.round(ap.plaque.b * 1000)} identique (taux ${v.tauxMax.toFixed(3)})`);
  const pg = O.preremplissage(R1, 'appareils-appui', 0);
  ok(pg.gen && pg.plaque.a === Math.round(ap.plaque.a * 1000) && pg.combis.length === ap.combis.length && pg.mat.hmode === 'v', 'Appareils : état de page pré-rempli (plaque en mm, combinaisons, effets lents en déplacements)');
}
/* ───────── 2. Piles et culées (PILES-CULÉES) ───────── */
{
  const T = R1.tab, H = R1.rephor, expT = RB.exportAppuis(T), expH = RH.exportAppuis(H);
  ok(R1.appuis.length === 4 && R1.appuis.every((A) => A.res && A.res.futs && A.res.sem && A.res.fond), 'Piles et culées : 4 appuis calculés par PILES-CULÉES (fûts ou mur, semelle, fondation)');
  // actions transmises = fonctions d'import du module appliquées aux exports des modules de tablier et d'efforts horizontaux
  const j = 1, A = R1.appuis[j], tab = PC.depuisTablier(expT[j]).actions, hor = PC.depuisRephor(expH[j]).actions;
  const vT = (cat) => A.d.actions.filter((x) => x.cat === cat).reduce((t, x) => t + x.V, 0);
  ok(near(vT('Gmax'), tab.find((x) => x.cat === 'Gmax').V) && Math.abs(-vT('Gmax') - (T.app[j].R.pp + T.app[j].R.supMax)) < 0.006, `Pile P1 : G tablier maxi transmis = pp + superstructures du tablier (${(-vT('Gmax')).toFixed(1)} kN)`);
  ok(tab.every((x) => A.d.actions.some((y) => y.nom === x.nom && y.V === x.V)), 'Pile P1 : groupes de trafic transmis = import depuisTablier (' + tab.length + ' actions)');
  ok(hor.every((x) => A.d.actions.some((y) => y.nom === x.nom && near(y.HX, x.HX) && near(y.HY, x.HY))), 'Pile P1 : efforts horizontaux transmis = import depuisRephor');
  const fr = hor.find((x) => x.cat === 'F'), Hf = H.parAppui[j].F;
  ok(near(Math.hypot(fr.HX, fr.HY), Math.abs(Hf), 2e-3), `Pile P1 : freinage |H| = HORIZONTAL (${Math.abs(Hf).toFixed(1)} kN)`);
  const C3 = R1.appuis[3], h3 = PC.depuisRephor(expH[3]).actions.find((x) => x.cat === 'Td'), a3 = C3.d.actions.find((x) => x.cat === 'Td' && /efforts/.test(x.nom));
  ok(near(a3.HX, -h3.HX), 'Culée d’extrémité : HX inversé (X vers l’ouvrage)');
  // résultats = appel direct du module avec les mêmes données
  const D = PC.calc(A.d, { sps: R1.sps });
  ok(near(D.futs.AsMax, A.res.futs.AsMax) && near(D.sem.trans.inf, A.res.sem.trans.inf) && D.combs.every((c, k) => near(c.T.tot[2], A.res.combs[k].T.tot[2])), 'Pile P1 : aciers et torseurs identiques à l’appel direct de PILES-CULÉES');
  // géométrie transmise
  const a = R1.geo.appuis[j];
  ok(near(A.d.geo.zBase, a.zsem) && Math.abs(A.d.geo.zBase + A.d.geo.ep + A.d.geo.fut.h - a.zSom) < 1e-3 && Math.abs(A.res.G.zApp - a.zApp) < 2e-3, 'Pile P1 : semelle, fût et niveau des appareils = géométrie de l’ouvrage');
  // poids propres : 25 kN/m³, déjaugés (15 kN/m³) sous la nappe du sondage
  const zw = R1.sps.z - R1.sps.nappe, col = (z0, z1) => 25 * (z1 - z0) - 10 * Math.max(0, Math.min(z1, zw) - z0);
  const pp = A.res.acts.filter((x) => x.cat === 'PP').reduce((t, x) => t - x.F[2], 0);
  const ppAtt = a.e * a.larfut * a.nfut * col(a.zst, a.zSom) + a.B * a.L * col(a.zsem, a.zst);
  ok(near(pp, ppAtt, 2e-4), `Pile P1 : poids propres = volumes de la géométrie, déjaugés sous la nappe (${pp.toFixed(0)} kN)`);
  const c0 = R1.appuis[0], g0 = R1.geo.appuis[0];
  ok(c0.d.type === 'mur' && Math.abs(c0.res.G.xBack - (g0.xb - g0.uc)) < 1e-3 && Math.abs(c0.res.G.xApp - (0 - g0.uc)) < 1e-3 && c0.res.gg && c0.res.retour, 'Culée C0 : mur de front, garde-grève et murs en retour ; dos du mur et axe des appareils = géométrie de l’ouvrage');
  const Ka = Math.pow(Math.tan(Math.PI / 4 - Math.PI / 12), 2);
  ok(near(c0.res.Ka, Ka), 'Culée : Ka = 1/3 pour φ = 30°');
  ok(R1.verdicts.filter((v) => v.module === 'appui').length === 4 && R1.verdicts.filter((v) => v.module === 'appui').every((v) => v.statut === 'ok'), 'Tableau de bord : un verdict par pile ou culée');
  const pg = O.preremplissage(R1, 'appui', 1);
  ok(pg.v === 1 && pg.d.type === 'pile' && pg.d.actions.length === A.d.actions.length && pg.sps, 'Pré-remplissage de la page PILES-CULÉES (données de l’appui et sondage)');
}
/* ───────── 3. Fondations ───────── */
{
  const fj = R1.fond[1], direct = F.calc(O.fondatioInput(R1.s, R1.sps, fj.o));
  ok(fj.res.combs.every((c, k) => near(c.qref, direct.combs[k].qref) && near(c.N, direct.combs[k].N)), 'Fondations : résultats identiques à l’appel direct');
  ok(fj.res.combs.every((c, k) => near(c.N, -R1.appuis[1].res.combs[k].T.tot[2], 1e-9)), 'Fondations : N = torseurs des combinaisons de PILES-CULÉES (' + fj.res.combs.length + ' combinaisons)');
  const pg = O.preremplissage(R1, 'fondations', 1);
  ok(pg.v.type === 'sup' && pg.comb.length === 2 * fj.o.combs.length && pg.comb[0].dur === 'LD' && pg.comb[1].dur === 'CD' && pg.sps && pg.v.B === +fj.o.B.toFixed(3), 'Fondations : état de page pré-rempli (lignes LD/CD, sondage, dimensions)');
  // pieux
  const s = O.defaut('radba'); s.fond.type = 'pieux'; s.fond.pieux = { ptype: 2, D: 1.0, L: 12, nx: 2, ny: 3, ex: 3, ey: 4 };
  const R = O.calcul(s), fp = R.fond[1];
  ok(fp.o.type === 'pieux' && fp.o.piles.length === 6 && fp.res && fp.res.type === 'pieux', 'Fondations profondes : groupe de 6 pieux calculé');
  const sN = fp.res.combs[0].piles.reduce((t, p) => t + p.N, 0);
  ok(near(sN, -(fp.o.combs[0].ld[2] + fp.o.combs[0].cd[2]), 1e-3), 'Fondations profondes : Σ N en tête des pieux = Fz transmis (' + sN.toFixed(0) + ' kN)');
  ok(R.metres.rows.some((r) => /Aciers des pieux/.test(r.designation) && /FONDATIONS/.test(r.origine)), 'Avant-métré : aciers des pieux calculés');
  ok(R.metres.rows.some((r) => /Pieux forés/.test(r.designation) && near(r.q, 6 * 12)), 'Avant-métré : longueur de pieux 6 × 12 m');
}
/* ───────── 4. Quantités ───────── */
{
  const T = R1.tab, Lt = R1.geo.xb - R1.geo.xa;
  const row = (re, p) => R1.metres.rows.find((r) => re.test(r.designation) && (!p || r.partie === p));
  ok(near(row(/^Béton du tablier/).q, T.g.A * Lt, 1e-9), `Béton du tablier = A × L = ${T.g.A.toFixed(3)} × ${Lt.toFixed(2)} m`);
  const A = R1.tabA; let Ac = 0; const B = A.B, nn = 4000; for (let k = 0; k < nn; k++) { const y = -B / 2 + B * (k + 0.5) / nn; Ac += B / nn * (A.top(y) + A.bot(y)); }
  ok(near(Ac, T.g.A, 2e-3), 'Coupe du tablier : aire du profil des plans = aire du module (' + Ac.toFixed(3) + ' m²)');
  const a = R1.geo.appuis[1];
  ok(near(row(/^Béton : semelle/, 'Pile P1').q, a.B * a.L * a.es), 'Semelle de P1 : B × L × e');
  const sm = R1.appuis[1].res.sem, Asem = sm.trans.inf + sm.trans.sup + sm.long.inf + sm.long.sup;
  ok(near(row(/^Aciers : semelle/, 'Pile P1').q, Asem * 1e-4 * a.B * a.L * 7850 * 1.1, 1e-9), `Aciers de la semelle de P1 = sections de PILES-CULÉES (${Asem.toFixed(1)} cm²/m cumulés) × B × L`);
  ok(!R1.metres.rows.some((r) => /ratio forfaitaire/.test(r.origine)), 'Avant-métré : plus aucun ratio forfaitaire pour les appuis');
  ok(near(R1.metres.recap.appareils, R1.appareils.reduce((t, x) => t + x.n, 0)), 'Appareils d’appui : nombre total = somme des files (' + R1.metres.recap.appareils + ')');
  // aciers longitudinaux : ∫ As dx ≥ As maxi × portée la plus courte (ordre de grandeur)
  const al = row(/^Aciers longitudinaux/).q;
  ok(al > 0 && al / (T.g.A * Lt) > 30 && al / (T.g.A * Lt) < 250, `Aciers longitudinaux du tablier : ${(al / (T.g.A * Lt)).toFixed(0)} kg/m³ de béton (plage plausible)`);
  const csv = O.metresCSV(R1.metres);
  ok(csv.startsWith('﻿Partie;Désignation;Unité;Quantité;Origine') && csv.trim().split('\r\n').length === R1.metres.rows.length + 1 && /;\d+,\d{2};/.test(csv), 'Avant-métré : export CSV (séparateur ;, virgule décimale, une ligne par poste)');
  const R4 = O.calcul(O.defaut('rapen')), T4 = R4.tab, L4 = R4.geo.xb - R4.geo.xa;
  ok(near(R4.metres.rows.find((r) => /^Poutrelles/.test(r.designation)).q, T4.d.nPout * L4 * T4.prof.A * 0.785), 'Poutrelles enrobées : masse = n × L × A × 7850 kg/m³');
  ok(R4.verdicts.length >= 5 && R4.fond.length === 4, 'Pont-rail poutrelles enrobées : chaîne complète');
}
/* ───────── 5. Gabarit ───────── */
{
  const s = O.defaut('radba'); s.biais = 100; s.gab = { type: 'route', travee: 2, zObs: 100, H: 4.75, W: 9, dec: 1.5 };
  const R = O.calcul(s), g = R.gabarit, G = R.geo;
  const hT = R.tab.g.hAxe, hV = R.tab.d.hb + O.HTRAV + O.HRAIL;
  ok(near(g.Hdispo, s.zRail0 - hV - hT - 100, 1e-9), `Gabarit (droit, sans pente) : hauteur libre = rail − voie − tablier − obstacle = ${g.Hdispo.toFixed(3)} m`);
  ok(near(g.Wdispo, 20 - s.app.pile.e, 1e-9), 'Gabarit : ouverture droite entre piles = 20 − e = ' + g.Wdispo.toFixed(2) + ' m');
  ok(near(g.margeG, (20 - 0.8) / 2 + 1.5 - 4.5) && near(g.margeD, (20 - 0.8) / 2 - 1.5 - 4.5), 'Gabarit : marges latérales avec décalage de 1,50 m');
  // biais 90 gr et pente 2 % : ouverture droite = Δx·sinφ, point bas de la sous-face côté aval
  const s2 = O.defaut('radba'); s2.pente = -2; s2.gab.W = 9;
  const R2 = O.calcul(s2), g2 = R2.gabarit, G2 = R2.geo;
  ok(near(g2.Wdispo, (G2.X[2] - G2.X[1]) * Math.sin(90 * GR) - 0.8, 1e-9), 'Gabarit biais : ouverture droite = L·sinφ − e');
  const xm = g2.xc + 4.5 / G2.sn + G2.Btot / 2 * G2.cs / G2.sn;
  ok(near(g2.zSFmin, Math.min(G2.zSF(xm), G2.zSF(g2.xc + 4.5 / G2.sn - G2.Btot / 2 * G2.cs / G2.sn)), 1e-9), 'Gabarit biais et pente : hauteur libre au sommet le plus bas de l’emprise');
  const s3 = O.defaut('radba'); s3.gab.H = 6;
  ok(!O.calcul(s3).gabarit.ok, 'Gabarit insuffisant détecté (6,00 m requis)');
  void G;
}
/* ───────── 6. Cadre et portique ───────── */
{
  const s = O.defaut('racba'), R = O.calcul(s), d = R.cadre.d;
  ok(R.cadre && R.fond.length === 1 && R.verdicts.length >= 3, 'Cadre fermé par défaut : calcul de bout en bout');
  ok(near(R.geo.zTopTrav + d.epetan + d.eprem + d.epbal + O.HRAIL, s.zRail0, 1e-3), 'Cadre : remblai sur traverse déduit du profil en long (' + d.eprem.toFixed(3) + ' m)');
  const C = RR.calcul(O.cadreInput(O.normaliser(s)).d);
  ok(C.justif.every((j, k) => !j.As || (near(j.As[0], R.cadre.justif[k].As[0]) && near(j.As[1], R.cadre.justif[k].As[1]))), 'Cadre : sections d’acier identiques à l’appel direct du module');
  const lg = R.cadre.sol.fond[0].lignes.filter((l) => l.N > 0);
  ok(R.fond[0].res.combs.every((c, k) => near(c.N, lg[k].N, 1e-9) && near(c.H, Math.abs(lg[k].H), 1e-9)), 'Cadre → fondations : N et H transmis = torseurs du module (' + lg.length + ' combinaisons)');
  const Lc = d.ouv + 2 * d.eppied;
  ok(near(R.metres.rows.find((r) => r.designation === 'Béton : traverse').q, Lc * d.eptra * d.lontottab), 'Cadre : béton de la traverse = (ouverture + 2 e) × e × longueur');
  ok(near(R.metres.rows.find((r) => r.designation === 'Béton : radier').q, Lc * d.eprad * d.lonrad), 'Cadre : béton du radier');
  ok(near(R.gabarit.Hdispo, d.hauint - d.hauterint - (R.gabarit.reducGousset || 0), 1e-9) && near(R.gabarit.Wdispo, d.ouv), 'Cadre : gabarit = hauteur intérieure (goussets déduits) et ouverture');
  const Rp = O.calcul(O.defaut('rapo'));
  ok(Rp.fond.length === 2 && Rp.metres.rows.some((r) => r.designation === 'Béton : semelles (2)'), 'Portique ouvert par défaut : 2 semelles vérifiées par FONDATIONS');
  const bad = O.defaut('racba'); bad.zRail0 = 104;
  let msg = ''; try { O.calcul(bad); } catch (e) { msg = e.message; }
  ok(/Profil en long incompatible/.test(msg), 'Cadre : profil en long trop bas refusé');
}
/* ───────── 7. Ponts-routes ───────── */
{
  const s = O.defaut('rodba'), R = O.calcul(s);
  const T = RO.calcul(O.tablierInput(O.normaliser(s)));
  const exp = RO.exportRephor(T);
  ok(exp.ap.every((a, j) => a.Gmax === R.rephorPage.ap[j].Gmax && a.Qmax === R.rephorPage.ap[j].Qmax), 'Pont-route dalle BA : G et Q transmis = export du module TABLIER ROUTE');
  ok(R.appuis.every((A, j) => Math.abs(-A.d.actions.find((x) => x.cat === 'Gmax').V - T.app[j].ligne.c.Gk.max) < 0.006), 'Pont-route : G du tablier transmis à PILES-CULÉES = Gk du module');
  ok(R.appuis.every((A) => A.res && A.d.ouvrage === 'route'), 'Pont-route : piles et culées calculées (combinaisons routières)');
  ok(R.rephorInp.ouvrage === 'route' && R.rephor.parAppui.length === 4, 'Pont-route : freinage routier dans la répartition des efforts horizontaux');
  const s2 = O.defaut('ropen'); s2.Btot = 10;
  const R2 = O.calcul(s2);
  ok(near(R2.tab.G.B, 10, 1e-9) && R2.tab.R.N > 0, 'Pont-route poutrelles enrobées : largeur portée à 10 m (chaussée élargie)');
}
/* ───────── 8. Plans et implantation ───────── */
{
  for (const t of ['radba', 'rapen', 'rodba', 'racba', 'rapo']) {
    const R = t === 'radba' ? R1 : O.calcul(O.defaut(t)), V = O.vues(R);
    const svg = V.map((v) => O.svgVue(v)).join(''), dx = O.dxf(V);
    ok(V.length >= 3 && noNaN(svg) && noNaN(dx) && dx.includes('AC1009') && dx.trim().endsWith('EOF'), `Plans (${O.TYPES[t].nom}) : ${V.length} vues SVG et DXF R12 sans NaN`);
  }
  const s = O.defaut('radba'); s.biais = 100; s.imp = { E0: 1000, N0: 2000, gis: 100 };
  const R = O.calcul(s), p = R.implantation.filter((q) => q.point === 'axe');
  ok(near(p[0].E, 1000) && near(p[0].N, 2000) && near(p[1].E, 1014) && near(p[1].N, 2000, 1e-9), 'Implantation : gisement 100 gr → P1 à E0 + 14 m');
  const g = R.implantation.find((q) => q.appui === 'C0' && q.point === 'rive gauche');
  ok(near(g.E, 1000, 1e-9) && near(g.N, 2000 + s.Btot / 2, 1e-9), 'Implantation : rive gauche de C0 à N0 + B/2');
}
/* ───────── 9. Disponibilité et contrôles ───────── */
{
  ok(!R1.verdicts.some((v) => v.statut === 'bientot'), 'Plus aucune partie « bientôt »');
  ok(O.disponible('rodba').ok && O.disponible('racba').ok, 'Types disponibles : ponts-routes, cadres et portiques');
  const s = O.defaut('radba'); s.zRail0 = 97;
  let m = ''; try { O.calcul(s); } catch (e) { m = e.message; }
  ok(/négative/.test(m), 'Profil en long trop bas : hauteur d’appui négative refusée');
  const s2 = O.defaut('radba'); s2.travees = [10, 10, 10, 10, 10, 10, 10, 10];
  m = ''; try { O.calcul(s2); } catch (e) { m = e.message; }
  ok(/1 à 7 travées/.test(m), 'Plus de 7 travées refusé');
  ok(O.preremplissage(R1, 'tablier-rail').travees.join() === '14,20,14' && O.preremplissage(R1, 'efforts-horizontaux').ap.length === 4 && O.preremplissage(R1, 'sondages-pressio').s.couches.length > 0, 'Pré-remplissage des pages tablier, efforts horizontaux et sondage');
}
console.log(f ? `\n${f} échec(s) sur ${n}` : `\nTous les tests passent (${n}).`);
process.exit(f ? 1 : 0);
