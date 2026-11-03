/* REPHOR — répartition des efforts horizontaux longitudinaux entre les appuis d'un ouvrage multi-travées
 * et appareils d'appui (moteur pur, aucun DOM ; node → module.exports, navigateur → window.BA.horizontal).
 *
 * Modèle (linéaire, élastique) :
 *  - chaque tablier est un corps rigide en effort normal (raideur axiale supposée infinie) : un point d'abscisse x
 *    du tablier k se déplace de d_k + ε·(x − x0_k) sous une déformation imposée ε (retrait, température) ;
 *  - chaque appui j est un ressort de translation en tête Kp_j (fût en console encastrée en pied, en série avec la
 *    fondation : translation Kh et rotation Kθ au niveau de la base) ;
 *  - chaque ligne d'appareils relie un tablier à une tête d'appui : élastomère fretté K = n·G·A/T (EN 1337-3
 *    §5.3.3.7, guide Sétra 2007), appareil fixe (raideur infinie, pénalité numérique), glissant (raideur nulle,
 *    frottement μ·N imposé, EN 1337-2) ;
 *  - un appui sous joint de dilatation porte deux lignes d'appareils (fin du tablier de gauche, début du suivant).
 *  On résout le système des déplacements d_k (tabliers) et w_j (têtes d'appuis). Le « point fixe » d'un tablier est
 *  le point de déplacement nul sous déformation imposée seule : x_pf = x0_k − d_k/ε.
 *
 * Raideur des fûts : souplesse en tête f = ∫₀ʰ s²/(E·I(s)) ds (console, effort en tête, s mesuré depuis la tête),
 * épaisseur linéaire entre le haut et le bas ; avec le biais φ de l'appui (grades), inertie dans l'axe de l'ouvrage
 * I = Ix·sin²φ + Iy·cos²φ (Ix : flexion longitudinale pour un ouvrage droit). Culées enterrées : inerties majorées
 * pour la butée des terres sur les poteaux (coefficients kx = 1,825 et ky = 2,54 du dossier Sétra PP73, saisissables).
 * Module du béton : E instantané (courte durée) et différé E/(1 + φ) (longue durée), BAEL 91 A.2.1,2
 * (Ei = 11 000·fcj^1/3) ou EN 1992-1-1 tab. 3.1 (Ecm = 22·(fcm/10)^0,3 GPa).
 *
 * Actions (EN 1991-2, EN 1991-1-5, EN 1992-1-1 annexe B) :
 *  - retrait εcs (saisi ou EN 1992-1-1 §3.1.4 + annexe B simplifiée), raideurs longue durée ;
 *  - dilatation / contraction ε = αT·ΔT, part « courte durée » (variation journalière) saisie, raideurs courte durée ;
 *  - ponts-rails, EN 1991-2 §6.5.3 : démarrage Qlak = 33 kN/m × La,b ≤ 1000 kN (LM71, SW/0, SW/2), freinage
 *    Qlbk = 20 kN/m × La,b ≤ 6000 kN (LM71, SW/0), SW/2 35 kN/m, multipliés par α pour LM71/SW0 (§6.5.3(4)),
 *    coefficient de transmission voie → tablier ξ (1 par défaut ; 0,5 = règle du Livret 2.01 pour voie ballastée
 *    en LRS) ;
 *  - interaction voie-ouvrage (rail continu soudé) : effort q·(L2 − L1) par voie (règle simplifiée du Livret 2.01
 *    art. 1.4.3.2, L1/L2 = longueurs dilatables de part et d'autre du point fixe) ; vérifications EN 1991-2 §6.5.4 :
 *    δB ≤ 5 mm (LRS sans appareil de dilatation ou avec un seul) ou 30 mm (appareils aux deux extrémités),
 *    δH ≤ 8 mm, longueur dilatable ≤ 90 m (béton, mixte) / 60 m (acier) ;
 *    LIMITE : pas de modèle non linéaire voie-ouvrage complet (contraintes additionnelles du rail 72/92 MPa non calculées) ;
 *  - ponts-routes, EN 1991-2 §4.4.1 : Qlk = 0,6 αQ1 (2Q1k) + 0,10 αq1 q1k w1 L, 180 αQ1 ≤ Qlk ≤ 900 kN ;
 *    Fascicule 61 titre II : Bc (un camion, 300 kN) et A(l) : F = A1·S/(20 + 0,0035 S).
 * Combinaisons (EN 1990 annexe A2) : ELU fondamentales (trafic ou température dominants), ELS caractéristiques
 * et quasi permanente ; retrait γ = 1,0 (EN 1992-1-1 §2.4.2.1).
 * Appareils en élastomère : vérification / dimensionnement par BA.elastomeres (EN 1337-3 ou guide Sétra 2000).
 *
 * Unités : kN, m ; matériaux en MPa ; raideurs en kN/m ; déplacements en m (affichés en mm par la page).
 */
(function (root) {
  'use strict';
  const MPA = 1000;
  const GR = Math.PI / 200;
  let APPM = null;
  try { APPM = (typeof module !== 'undefined' && module.exports) ? require('./elastomeres.js') : null; } catch (e) { APPM = null; }
  const appm = () => APPM || (root && root.BA && root.BA.elastomeres) || null;

  /* ── matériaux ── */
  function modules(o) {
    const fc = o.fck ?? 32, phi = o.phi ?? 2;
    let Ei;
    if (o.Emode === 'bael') Ei = 11000 * Math.cbrt(fc);                 // BAEL 91 A.2.1,21
    else Ei = 22000 * Math.pow((fc + 8) / 10, 0.3);                     // EN 1992-1-1 tab. 3.1, Ecm
    return { Ecd: Ei, Eld: Ei / (1 + phi) };                            // module effectif EN 1992-1-1 §7.4.3 (5)
  }

  /* retrait EN 1992-1-1 §3.1.4 (6) et annexe B.2 : εcs = kh·εcd,0 + εca(∞) */
  function retraitEC2(o) {
    const fck = o.fck ?? 35, fcm = fck + 8, RH = o.RH ?? 70, h0 = o.h0 ?? 500, cl = o.ciment || 'N';
    const [a1, a2] = { S: [3, 0.13], N: [4, 0.12], R: [6, 0.11] }[cl] || [4, 0.12];
    const bRH = 1.55 * (1 - Math.pow(RH / 100, 3));
    const ecd0 = 0.85 * ((220 + 110 * a1) * Math.exp(-a2 * fcm / 10)) * 1e-6 * bRH;
    const T = [[100, 1.0], [200, 0.85], [300, 0.75], [500, 0.70]];
    let kh = 0.70;
    if (h0 <= 100) kh = 1; else for (let i = 1; i < T.length; i++) if (h0 <= T[i][0]) { const [x0, y0] = T[i - 1], [x1, y1] = T[i]; kh = y0 + (y1 - y0) * (h0 - x0) / (x1 - x0); break; }
    const eca = 2.5 * (fck - 10) * 1e-6;                                 // (3.12)
    return { ecd0, kh, ecd: kh * ecd0, eca, ecs: kh * ecd0 + eca, bRH };
  }

  /* ── raideur d'un fût ── */
  function inertie(ap, e, kx, ky, phi) {
    const s2 = Math.pow(Math.sin(phi), 2), c2 = Math.pow(Math.cos(phi), 2);
    const n = ap.nfut || 1;
    if (ap.section === 'rond') { const I = n * Math.PI * Math.pow(e, 4) / 64; return kx * I * s2 + ky * I * c2; }
    const b = ap.larfut;
    return kx * n * b * e * e * e / 12 * s2 + ky * n * e * b * b * b / 12 * c2;
  }
  /* souplesse en tête (m/kN) d'une console de hauteur h, épaisseur linéaire esup → einf, intégrée par Simpson */
  function soupFut(ap, E, kx, ky, phi) {
    const h = ap.hfut, N = 400;
    if (!(h > 0)) return 0;
    let s = 0;
    for (let i = 0; i <= N; i++) {
      const z = i * h / N, e = ap.esup + (ap.einf - ap.esup) * z / h;
      const w = i === 0 || i === N ? 1 : (i % 2 ? 4 : 2);
      s += w * z * z / (E * MPA * inertie(ap, e, kx, ky, phi));
    }
    return s * h / N / 3;
  }
  const BUTEE = { culee: true, culeeRonde: true };
  const TYPES_APPUI = {
    pile: 'Pile intermédiaire',
    culee: 'Culée enterrée, poteaux rectangulaires (type Robinson)',
    culeeRonde: 'Culée enterrée, poteaux ronds',
    mur: 'Culée mur de front',
    pieux: 'Chevêtre sur pieux / colonnes',
    autre: 'Raideur saisie',
  };

  /* raideurs du béton et du sol en tête d'appui (kN/m), courte et longue durée */
  function raideurAppui(ap, g) {
    const phi = (ap.biais ?? g.biais ?? 100) * GR;
    if (ap.type === 'autre') {
      return { Kfcd: NaN, Kfld: NaN, Kcd: ap.Kcd > 0 ? ap.Kcd : Infinity, Kld: ap.Kld > 0 ? ap.Kld : Infinity, phi, saisie: true };
    }
    const E = modules(g);
    const kx = BUTEE[ap.type] ? (g.kbutLong ?? 1.825) : 1, ky = BUTEE[ap.type] ? (g.kbutTran ?? 2.54) : 1;
    const a = Object.assign({}, ap, { section: (ap.type === 'culeeRonde' || ap.type === 'pieux') ? 'rond' : 'rect' });
    const fcd = soupFut(a, E.Ecd, kx, ky, phi), fld = soupFut(a, E.Eld, kx, ky, phi);
    const H = ap.htot ?? ap.hfut;
    const fs = (Kh, Kr) => (ap.encastre === false ? (Kh > 0 ? 1 / Kh : 0) + (Kr > 0 ? H * H / Kr : 0) : 0);
    const sCD = fs(ap.Khcd, ap.Krcd), sLD = fs(ap.Khld || ap.Khcd, ap.Krld || ap.Krcd);
    return { Kfcd: 1 / fcd, Kfld: 1 / fld, Kcd: 1 / (fcd + sCD), Kld: 1 / (fld + sLD), phi, kx, ky, E,
      Ksol: ap.encastre === false ? { cd: 1 / sCD, ld: 1 / sLD } : null, Ix: inertie(a, ap.esup, 1, 0, Math.PI / 2), Iy: inertie(a, ap.esup, 0, 1, 0) };
  }

  /* ── appareils ── */
  function plaqueT(p, regl) { return regl === 'livret' ? p.n * p.ti : p.n * p.ti + 2 * (p.te || 0); }
  function raideurAppareils(ap, g) {
    const t = ap.app;
    if (t === 'fixe') return { cd: Infinity, ld: Infinity };
    if (t === 'glissant') return { cd: 0, ld: 0 };
    const p = ap.plaque;
    if (!p || !(p.a > 0) || !(p.b > 0) || !(p.n > 0) || !(p.ti > 0)) return { cd: NaN, ld: NaN };
    const T = plaqueT(p, g.reglApp);
    const A = p.forme === 'circ' ? Math.PI * p.D * p.D / 4 : p.a * p.b;
    const n = ap.napp || 1;
    return { cd: n * (g.Gcd ?? 1.8) * MPA * A / T, ld: n * (g.Gld ?? 0.9) * MPA * A / T, T, A };
  }

  /* ── géométrie : abscisses, tabliers, lignes d'appareils ── */
  function geometrie(inp) {
    const L = inp.travees.map(Number);
    const na = L.length + 1;
    const x = [0]; for (const l of L) x.push(x[x.length - 1] + l);
    const joints = new Set((inp.joints || []).map(Number).filter((j) => j > 0 && j < na - 1));
    const decks = [];
    let start = 0;
    for (let j = 1; j < na; j++) {
      if (joints.has(j) || j === na - 1) {
        const k = decks.length;
        decks.push({ k, j0: start, j1: j, x0: start === 0 ? -(inp.about0 || 0) : x[start], x1: j === na - 1 ? x[na - 1] + (inp.aboutn || 0) : x[j] });
        start = j;
      }
    }
    for (const d of decks) d.L = d.x1 - d.x0;
    const lignes = [];
    decks.forEach((d) => {
      for (let j = d.j0; j <= d.j1; j++) {
        const ap = inp.appuis[j];
        const cote = joints.has(j) ? (j === d.j1 ? 'G' : 'D') : '';
        const app = cote === 'D' && ap.appD ? ap.appD : ap.app;
        lignes.push({ j, k: d.k, x: x[j], cote, app });
      }
    });
    return { L, na, x, decks, lignes, joints: [...joints], Ltot: x[na - 1] + (inp.about0 || 0) + (inp.aboutn || 0) };
  }

  /* ── solveur : inconnues [d_0..d_nk-1, w_0..w_na-1] ── */
  function gauss(A, b) {
    const n = b.length;
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (!(Math.abs(A[p][c]) > 1e-300)) throw new Error('Système singulier : un tablier n’est retenu par aucun appareil fixe ou élastomère.');
      [A[p], A[c]] = [A[c], A[p]]; [b[p], b[c]] = [b[c], b[p]];
      for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; if (!f) continue; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
    }
    const xs = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r][k] * xs[k]; xs[r] = s / A[r][r]; }
    return xs;
  }
  /* K : {Kp:[na], Kb:[nl]} ; charge : {eps, Fdeck:[nk], Phead:[na]} */
  function resoudre(G, K, ch) {
    const nk = G.decks.length, na = G.na, n = nk + na;
    const A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
    const kmax = Math.max(1, ...K.Kp.filter(Number.isFinite), ...K.Kb.filter(Number.isFinite));
    const KFIX = kmax * 1e7, KRIG = kmax * 1e7;
    const eps = ch.eps || 0;
    G.lignes.forEach((l, i) => {
      let kb = K.Kb[i]; if (kb === Infinity) kb = KFIX; if (!(kb > 0)) return;
      const d = l.k, w = nk + l.j, e0 = eps * (l.x - G.decks[l.k].x0);
      // force dans la ligne (sur l'appui, sens +x) : kb·(d + e0 − w)
      A[d][d] += kb; A[d][w] -= kb; b[d] -= kb * e0;
      A[w][w] += kb; A[w][d] -= kb; b[w] += kb * e0;
    });
    for (let j = 0; j < na; j++) { const kp = K.Kp[j] === Infinity ? KRIG : K.Kp[j]; A[nk + j][nk + j] += kp; b[nk + j] += (ch.Phead && ch.Phead[j]) || 0; }
    for (let k = 0; k < nk; k++) b[k] += (ch.Fdeck && ch.Fdeck[k]) || 0;
    const s = gauss(A, b);
    const d = s.slice(0, nk), w = s.slice(nk);
    const H = w.map((wj, j) => (K.Kp[j] === Infinity ? KRIG : K.Kp[j]) * wj);
    const lig = G.lignes.map((l, i) => {
      const ud = d[l.k] + eps * (l.x - G.decks[l.k].x0);
      let kb = K.Kb[i]; if (kb === Infinity) kb = KFIX;
      return { ud, rel: ud - w[l.j], F: kb > 0 ? kb * (ud - w[l.j]) : 0 };
    });
    const pf = G.decks.map((dk, k) => (eps ? dk.x0 - d[k] / eps : NaN));
    return { d, w, H, lig, pf };
  }
  const zeros = (n) => new Array(n).fill(0);
  const add = (a, b, f = 1) => a.map((v, i) => v + f * b[i]);
  function combineRes(r1, r2, f2 = 1) {
    return { d: add(r1.d, r2.d, f2), w: add(r1.w, r2.w, f2), H: add(r1.H, r2.H, f2), lig: r1.lig.map((l, i) => ({ ud: l.ud + f2 * r2.lig[i].ud, rel: l.rel + f2 * r2.lig[i].rel, F: l.F + f2 * r2.lig[i].F })), pf: r1.pf };
  }
  function scaleRes(r, f) { return { d: r.d.map((v) => v * f), w: r.w.map((v) => v * f), H: r.H.map((v) => v * f), lig: r.lig.map((l) => ({ ud: l.ud * f, rel: l.rel * f, F: l.F * f })), pf: r.pf }; }

  /* ── freinage et démarrage ── */
  // longueur chargée maximale par SW/2 (deux blocs de 25 m distants de 7 m), EN 1991-2 §6.3.3
  const lSW2 = (L) => (L <= 25 ? L : L <= 32 ? 25 : L <= 57 ? L - 7 : 50);
  function freinageRail(L, g) {
    const al = g.alpha ?? 1, xi = g.xi ?? 1;
    const lm71 = { nom: 'Freinage LM71 / SW0', L, q: g.qFrein ?? 20, F: Math.min((g.qFrein ?? 20) * L, g.FfreinMax ?? 6000) * al };
    const dem = { nom: 'Démarrage LM71 / SW0 / SW2', L: Math.min(L, (g.FdemMax ?? 1000) / (g.qDem ?? 33)), q: g.qDem ?? 33, F: Math.min((g.qDem ?? 33) * L, g.FdemMax ?? 1000) * al };
    const sw2 = g.sw2 === false ? null : { nom: 'Freinage SW/2', L: lSW2(L), q: g.qSW2 ?? 35, F: (g.qSW2 ?? 35) * lSW2(L) };
    const demSW2 = g.sw2 === false ? null : { nom: 'Démarrage SW/2', L: lSW2(L), q: g.qDem ?? 33, F: Math.min((g.qDem ?? 33) * lSW2(L), g.FdemMax ?? 1000) };
    const cas = [lm71, sw2, dem, demSW2].filter(Boolean);
    cas.forEach((c) => { c.Ft = c.F * xi; });
    const frein = Math.max(lm71.F, sw2 ? sw2.F : 0) * xi, demar = Math.max(dem.F, demSW2 ? demSW2.F : 0) * xi;
    // voies chargées simultanément (EN 1991-2 §6.5.3(9) : freinage sur une voie, démarrage sur l'autre)
    const nch = Math.min(g.nvoies || 1, g.nVoiesFrein ?? 2);
    let total = 0; const det = [];
    for (let v = 0; v < nch; v++) {
      const f = v === 0 || !g.freinDem ? Math.max(frein, demar) : demar;
      total += f; det.push(f);
    }
    return { cas, frein, demar, parVoie: Math.max(frein, demar), total, det, nch, xi };
  }
  function freinageRoute(L, g) {
    const C = (root && root.BA && root.BA.charges) || (typeof require === 'function' ? (() => { try { return require('./charges.js'); } catch (e) { return null; } })() : null);
    const cl = g.classeTrafic === 2 ? { Q: 0.9, q: 0.7 } : { Q: 1, q: 1 };
    const aQ = g.aQ1 ?? cl.Q, aq = g.aq1 ?? cl.q, w1 = 3;
    const brut = 0.6 * aQ * 2 * 300 + 0.10 * aq * 9 * w1 * L;           // EN 1991-2 (4.6)
    const Qlk = Math.min(900, Math.max(180 * aQ, brut));
    const res = { cas: [{ nom: 'EN 1991-2 LM1 (Qlk)', L, F: Qlk, brut }], total: Qlk, parVoie: Qlk, xi: 1 };
    if (g.fasc61) {
      const lch = g.lch || 7, classe = g.classeF61 || 1;
      const nv = Math.max(1, Math.floor(lch / 3 + 1e-9));
      const AL = 2.30 + 360 / (L + 12);
      const a1 = C ? C.a1F61(classe, nv) : 1, v0 = C ? C.v0F61(classe) : 3.5, v = lch / nv;
      const A1 = a1 * (v0 / v) * AL, S = L * lch;
      const FA = A1 * S / (20 + 0.0035 * S);                              // Fasc. 61 II art. 4.4
      res.cas.push({ nom: 'Fasc. 61 A(l)', L, F: FA, A1, S }, { nom: 'Fasc. 61 Bc (un camion)', L, F: 300 });
      res.F61 = Math.max(FA, 300);
      if (g.reglRoute === 'f61') { res.total = res.F61; res.parVoie = res.F61; }
      else if (g.reglRoute === 'max') { res.total = Math.max(Qlk, res.F61); res.parVoie = res.total; }
    }
    return res;
  }

  /* ── calcul principal ── */
  function calcRepartition(inp, plaques) {
    const g = inp;
    const G = geometrie(inp);
    const app = inp.appuis.map((a, j) => Object.assign({}, a, plaques && plaques[j] ? { plaque: plaques[j] } : {}));
    const RA = app.map((a) => raideurAppui(a, g));
    const RB = G.lignes.map((l) => raideurAppareils(Object.assign({}, app[l.j], { app: l.app }), g));
    if (RB.some((r) => Number.isNaN(r.cd))) throw new Error('Appareil en élastomère sans dimensions : saisir la plaque ou choisir le prédimensionnement.');
    const Kcd = { Kp: RA.map((r) => r.Kcd), Kb: RB.map((r) => r.cd) }, Kld = { Kp: RA.map((r) => r.Kld), Kb: RB.map((r) => r.ld) };
    // raideur équivalente de chaque appui (ligne(s) d'appareils en série avec le béton/sol)
    const Keq = app.map((a, j) => {
      const ls = G.lignes.map((l, i) => [l, i]).filter(([l]) => l.j === j);
      const sum = (K) => ls.reduce((s, [, i]) => s + (K[i] === Infinity ? 1e30 : K[i]), 0);
      const ser = (k1, k2) => (k1 >= 1e29 ? k2 : k2 >= 1e29 ? k1 : (k1 * k2 === 0 ? 0 : 1 / (1 / k1 + 1 / k2)));
      return { cd: ser(sum(RB.map((r) => r.cd)), RA[j].Kcd === Infinity ? 1e30 : RA[j].Kcd), ld: ser(sum(RB.map((r) => r.ld)), RA[j].Kld === Infinity ? 1e30 : RA[j].Kld) };
    });

    // déformations
    const eR = inp.retraitMode === 'ec2' ? retraitEC2(inp.retraitEC2 || {}).ecs : (inp.epsRetrait || 0);
    const aT = inp.alphaT ?? 1e-5;
    const eDil = aT * (inp.dTdil || 0), eCon = aT * (inp.dTcon || 0), eCD = Math.min(aT * (inp.dTcd || 0), Math.max(eDil, eCon));
    const eDilLD = Math.max(0, eDil - eCD), eConLD = Math.max(0, eCon - eCD), eDilCD = Math.min(eCD, eDil), eConCD = Math.min(eCD, eCon);
    const nk = G.decks.length, na = G.na;
    const NONE = { eps: 0, Fdeck: zeros(nk), Phead: zeros(na) };
    const sol = (K, eps, F, P) => resoudre(G, K, { eps, Fdeck: F || zeros(nk), Phead: P || zeros(na) });

    // frottement des appareils glissants : μ·N opposé au mouvement relatif tablier/tête (EN 1337-2)
    const mu = inp.mu ?? 0.05;
    const frottement = (r) => {
      const F = zeros(nk), P = zeros(na);
      G.lignes.forEach((l, i) => { if (l.app !== 'glissant') return; const N = (app[l.j].Gmax || 0) * (G.joints.includes(l.j) ? 0.5 : 1); const s = Math.sign(r.lig[i].rel) || 0; P[l.j] += s * mu * N; F[l.k] -= s * mu * N; });
      return { F, P, actif: G.lignes.some((l) => l.app === 'glissant') };
    };
    const thermique = (K, eps, avecFrott) => {
      let r = sol(K, eps);
      if (avecFrott) { const f = frottement(r); if (f.actif) { const r2 = sol(K, 0, f.F, f.P); r = combineRes(r, r2); r.frott = r2; } }
      return r;
    };
    const A = {};
    A.retrait = thermique(Kld, -eR, true);
    const dilLD = thermique(Kld, eDilLD, true), dilCD = sol(Kcd, eDilCD);
    const conLD = thermique(Kld, -eConLD, true), conCD = sol(Kcd, -eConCD);
    A.dilLD = dilLD; A.dilCD = dilCD; A.dil = combineRes(dilLD, dilCD);
    A.conLD = conLD; A.conCD = conCD; A.con = combineRes(conLD, conCD);
    // point fixe : déformation imposée seule, raideurs longue durée (sans frottement)
    const pfLD = sol(Kld, 1).pf, pfCD = sol(Kcd, 1).pf;

    // efforts sur le tablier, par tablier chargé (cas indépendants, enveloppe)
    const rail = inp.ouvrage !== 'route';
    const parDeck = G.decks.map((dk, k) => {
      const unit = zeros(nk); unit[k] = 1;
      const u = sol(Kcd, 0, unit), uLD = sol(Kld, 0, unit);
      const fr = rail ? freinageRail(dk.L, inp) : freinageRoute(dk.L, inp);
      const o = { k, L: dk.L, unitCD: u, unitLD: uLD, frein: fr };
      // glissants : effort de frottement possible sous freinage (borne μ·G, sans réduction des autres appuis)
      o.Ffrein = scaleRes(u, fr.total);
      o.deltaB = Math.abs(u.d[k]) * fr.total;
      if (rail && inp.interaction !== false) {
        const xpf = pfLD[k], L2 = Math.max(xpf - dk.x0, dk.x1 - xpf), L1 = Math.min(xpf - dk.x0, dk.x1 - xpf);
        const parV = (inp.qInter ?? 8) * Math.max(0, L2 - L1), tot = parV * (inp.nvoies || 1);
        const fCD = Math.max(eDil, eCon) > 0 ? eCD / Math.max(eDil, eCon) : 0;
        o.inter = { L1, L2, xpf, parVoie: parV, total: tot, fCD };
        o.Finter = combineRes(scaleRes(uLD, tot * (1 - fCD)), scaleRes(u, tot * fCD));
        o.FinterCD = scaleRes(u, tot * fCD); o.FinterLD = scaleRes(uLD, tot * (1 - fCD));
      }
      return o;
    });
    // enveloppe sur les tabliers chargés : valeur absolue maxi par appui
    const env = (key) => {
      const H = zeros(na), w = zeros(na), lig = G.lignes.map(() => ({ F: 0, rel: 0, ud: 0 })), d = zeros(nk);
      for (const o of parDeck) { const r = o[key]; if (!r) continue; r.H.forEach((v, j) => { if (Math.abs(v) > Math.abs(H[j])) H[j] = v; }); r.w.forEach((v, j) => { if (Math.abs(v) > Math.abs(w[j])) w[j] = v; }); r.lig.forEach((l, i) => { if (Math.abs(l.F) > Math.abs(lig[i].F)) lig[i] = Object.assign({}, l); }); r.d.forEach((v, k) => { if (Math.abs(v) > Math.abs(d[k])) d[k] = v; }); }
      return { H: H.map(Math.abs), w: w.map(Math.abs), lig: lig.map((l) => ({ F: Math.abs(l.F), rel: Math.abs(l.rel), ud: Math.abs(l.ud) })), d: d.map(Math.abs) };
    };
    A.frein = env('Ffrein');
    // borne de frottement sur un appui glissant sous freinage
    G.lignes.forEach((l, i) => { if (l.app === 'glissant') { const N = (app[l.j].Gmax || 0) * (G.joints.includes(l.j) ? 0.5 : 1); A.frein.lig[i].F = mu * N; A.frein.H[l.j] = Math.max(A.frein.H[l.j], mu * N); } });
    if (rail && inp.interaction !== false) { A.inter = env('Finter'); A.interCD = env('FinterCD'); A.interLD = env('FinterLD'); }

    return { G, app, RA, RB, Keq, Kcd, Kld, eps: { eR, eDil, eCon, eCD, eDilLD, eConLD, eDilCD, eConCD }, A, parDeck, pfLD, pfCD, rail };
  }

  /* ── combinaisons des efforts en tête d'appui ── */
  function coefs(inp) {
    const rail = inp.ouvrage !== 'route';
    const gQ = inp.gQ ?? (rail ? 1.45 : 1.35), gT = inp.gT ?? 1.5, p0T = inp.psi0T ?? 0.6, p2T = inp.psi2T ?? 0.5;
    const p0Q = inp.psi0Q ?? (rail ? 0.8 : 0);
    return [
      { id: 'ELU1', nom: 'ELU — trafic dominant', etat: 'ELU', cR: 1.0, cT: gT * p0T, cF: gQ, txt: `G + 1,0·Rs + ${fmt2(gQ)}·Qlk + ${fmt2(gT * p0T)}·T` },
      { id: 'ELU2', nom: 'ELU — température dominante', etat: 'ELU', cR: 1.0, cT: gT, cF: gQ * p0Q, txt: `G + 1,0·Rs + ${fmt2(gT)}·T + ${fmt2(gQ * p0Q)}·Qlk` },
      { id: 'ELS1', nom: 'ELS car. — trafic dominant', etat: 'ELS', cR: 1, cT: p0T, cF: 1, txt: `G + Rs + Qlk + ${fmt2(p0T)}·T` },
      { id: 'ELS2', nom: 'ELS car. — température dominante', etat: 'ELS', cR: 1, cT: 1, cF: p0Q, txt: `G + Rs + T + ${fmt2(p0Q)}·Qlk` },
      { id: 'QP', nom: 'ELS quasi permanent', etat: 'ELS', cR: 1, cT: p2T, cF: 0, txt: `G + Rs + ${fmt2(p2T)}·T` },
    ];
  }
  const fmt2 = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
  /* enveloppe d'une grandeur : retrait signé, T ∈ {dilatation, contraction} (+ interaction de même signe), freinage ± */
  function envComb(c, R, Td, Tc, I, F) {
    let mx = -Infinity, mn = Infinity;
    for (const T of [Td, Tc]) {
      const t = T + Math.sign(T || 1) * (I || 0);
      const base = c.cR * R + c.cT * t;
      mx = Math.max(mx, base + c.cF * Math.abs(F), base - c.cF * Math.abs(F));
      mn = Math.min(mn, base + c.cF * Math.abs(F), base - c.cF * Math.abs(F));
    }
    return { max: mx, min: mn, abs: Math.max(Math.abs(mx), Math.abs(mn)) };
  }

  /* ── joints de chaussée / de voie : variation d'ouverture aux extrémités de tabliers ──
   * ouverture > 0 quand le joint s'ouvre. Culée : mouvement relatif tablier / tête de culée (garde-grève) ;
   * joint intermédiaire : mouvement relatif des deux tabliers. Freinage : enveloppe sur le tablier chargé. */
  function souffles(rep, C) {
    const { G, A, eps: e } = rep;
    const ux = (r, k, x, eps) => r.d[k] + eps * (x - G.decks[k].x0);
    const mv = (k, x) => ({
      R: ux(A.retrait, k, x, -e.eR),
      Td: ux(A.dilLD, k, x, e.eDilLD) + ux(A.dilCD, k, x, e.eDilCD),
      Tc: ux(A.conLD, k, x, -e.eConLD) + ux(A.conCD, k, x, -e.eConCD),
    });
    const head = (j) => ({ R: A.retrait.w[j], Td: A.dilLD.w[j] + A.dilCD.w[j], Tc: A.conLD.w[j] + A.conCD.w[j] });
    const out = [];
    const push = (o, rel, F) => {
      const vals = C.filter((x) => x.etat === 'ELU' || x.id === 'ELS2').map((cc) => { const r = envComb(cc, rel.R, rel.Td, rel.Tc, 0, F); return { id: cc.id, ouv: r.max, ferm: r.min }; });
      out.push(Object.assign(o, { relR: rel.R, relTd: rel.Td, relTc: rel.Tc, F, vals, ouvMax: Math.max(...vals.map((v) => v.ouv)), fermMax: Math.min(...vals.map((v) => v.ferm)) }));
    };
    const freinRel = (fn) => Math.max(0, ...rep.parDeck.map((o) => Math.abs(fn(o.Ffrein))));
    // culée origine
    const d0 = G.decks[0], dn = G.decks[G.decks.length - 1];
    { const m = mv(0, d0.x0), h = head(0); push({ lieu: 'Culée origine', j: 0 }, { R: -(m.R - h.R), Td: -(m.Td - h.Td), Tc: -(m.Tc - h.Tc) }, freinRel((r) => r.d[0] - r.w[0])); }
    for (let k = 0; k < G.decks.length - 1; k++) {
      const j = G.decks[k].j1, x = G.x[j], a = mv(k, x), b = mv(k + 1, x);
      push({ lieu: `Joint sur appui ${j}`, j }, { R: b.R - a.R, Td: b.Td - a.Td, Tc: b.Tc - a.Tc }, freinRel((r) => r.d[k + 1] - r.d[k]));
    }
    { const kk = G.decks.length - 1, m = mv(kk, dn.x1), h = head(G.na - 1); push({ lieu: 'Culée extrémité', j: G.na - 1 }, { R: m.R - h.R, Td: m.Td - h.Td, Tc: m.Tc - h.Tc }, freinRel((r) => r.d[kk] - r.w[G.na - 1])); }
    return out;
  }

  /* ── appareils : charges par appareil et combinaisons pour BA.elastomeres (EN 1337-3, hmode 'v') ── */
  function combisAppareil(rep, li, inp) {
    const { G, A, app } = rep, l = G.lignes[li], ap = app[l.j];
    const nl = G.lignes.filter((x) => x.j === l.j).length;
    const n = (ap.napp || 1);
    const G0 = (ap.Gmax || 0) / nl / n, Gm = (ap.Gmin ?? ap.Gmax ?? 0) / nl / n, Q = (ap.Qmax || 0) / nl / n;
    const rail = inp.ouvrage !== 'route';
    const gQ = inp.gQ ?? (rail ? 1.45 : 1.35), gT = inp.gT ?? 1.5, p0T = inp.psi0T ?? 0.6, p0Q = inp.psi0Q ?? (rail ? 0.8 : 0);
    // glissements lents de la ligne (m) et efforts rapides par appareil (kN)
    const vR = A.retrait.lig[li].rel, vTd = A.dilLD.lig[li].rel, vTc = A.conLD.lig[li].rel;
    const vI = A.interLD ? A.interLD.lig[li].rel : 0;
    const fTd = A.dilCD.lig[li].F / n, fTc = A.conCD.lig[li].F / n, fI = A.interCD ? A.interCD.lig[li].F / n : 0, fF = A.frein.lig[li].F / n;
    const phi = rep.RA[l.j].phi, sx = Math.sin(phi), sy = Math.cos(phi);
    const worst = (cT) => {
      const opts = [[vTd, fTd], [vTc, fTc]].map(([v, f]) => ({ v: vR + cT * (v + Math.sign(v || 1) * Math.abs(vI)), f: cT * (Math.abs(f) + Math.abs(fI)) }));
      return opts.sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
    };
    const mk = (type, Nld, Ncd, cT, cF) => { const w = worst(cT); const H = w.f + cF * Math.abs(fF); return { type, Nld, Ncd, Hxld: Math.abs(w.v) * sx, Hyld: Math.abs(w.v) * sy, Hxcd: H * sx, Hycd: H * sy, aa: ap.rot || 0, ab: 0 }; };
    return [
      mk('ELUmax', 1.35 * G0, gQ * Q, gT * p0T, gQ),
      mk('ELUmax', 1.35 * G0, gQ * p0Q * Q, gT, gQ * p0Q),
      mk('ELUmin', 1.0 * Gm, 0, gT, 0),
      mk('ELSmax', G0, Q, p0T, 1),
      mk('ELSmin', Gm, 0, 1, 0),
    ];
  }

  /* prédimensionnement sous charge verticale ELS maxi (σm = N/A′ ≤ σlim, plus petit appareil du catalogue EN 1337-3) */
  function predim(Nels, inp) {
    const M = appm(); if (!M) return null;
    const lim = inp.sigLim ?? 15;
    const cat = M.catalogue('ec');
    for (const p of cat) { const g = M.geom(p); if (Nels / g.Ap / MPA <= lim) return Object.assign({}, p); }
    return Object.assign({}, cat[cat.length - 1]);
  }

  /* ── point d'entrée ── */
  function calc(inp0) {
    const inp = Object.assign({}, inp0);
    const msgs = [];
    const M = appm();
    const na = inp.travees.length + 1;
    if (inp.appuis.length !== na) throw new Error(`Il faut ${na} appuis pour ${inp.travees.length} travée(s).`);
    // plaques : saisies, prédimensionnées ou déterminées (itérations répartition ↔ dimensionnement)
    let plaques = inp.appuis.map((a) => (a.app === 'elasto' || a.appD === 'elasto' ? (a.plaque && a.plaque.a > 0 ? Object.assign({}, a.plaque) : null) : null));
    const mode = inp.modeApp || 'verif';
    if (mode !== 'verif' || plaques.some((p, j) => p === null && (inp.appuis[j].app === 'elasto' || inp.appuis[j].appD === 'elasto'))) {
      if (!M) throw new Error('Module ÉLASTOMÈRES (elastomeres.js) indisponible pour dimensionner les appareils.');
      inp.appuis.forEach((a, j) => {
        if (!(a.app === 'elasto' || a.appD === 'elasto')) return;
        if (mode === 'verif' && plaques[j]) return;
        const nl = 1; const Nels = ((a.Nels > 0 ? a.Nels : (a.Gmax || 0) + (a.Qmax || 0))) / (a.napp || 1) / nl;
        plaques[j] = predim(Nels, inp);
      });
    }
    let rep = calcRepartition(inp, plaques), dims = null, it = 0;
    if (mode === 'dim') {
      for (it = 1; it <= 6; it++) {
        dims = verifAppareils(rep, inp, 'dim');
        let chg = false;
        const np = plaques.map((p, j) => {
          const d = dims.find((x) => x.j === j && x.res && !x.res.echec);
          if (!d) return p;
          const q = d.res.plaque;
          if (!p || q.a !== p.a || q.b !== p.b || q.n !== p.n || q.ts !== p.ts) chg = true;
          return Object.assign({}, q);
        });
        plaques = np;
        rep = calcRepartition(inp, plaques);
        if (!chg) break;
      }
    }
    const app = verifAppareils(rep, inp, 'verif');
    const C = coefs(inp);
    const parAppui = rep.app.map((ap, j) => {
      const A = rep.A;
      const R = A.retrait.H[j], Td = A.dil.H[j], Tc = A.con.H[j], I = A.inter ? A.inter.H[j] : 0, F = A.frein.H[j];
      const wR = A.retrait.w[j], wTd = A.dil.w[j], wTc = A.con.w[j], wI = A.inter ? A.inter.w[j] : 0, wF = A.frein.w[j];
      const combs = C.map((c) => ({ id: c.id, nom: c.nom, etat: c.etat, H: envComb(c, R, Td, Tc, I, F), w: envComb(c, wR, wTd, wTc, wI, wF) }));
      return { j, R, Td, Tc, I, F, TdCD: A.dilCD.H[j], TcCD: A.conCD.H[j], ICD: A.interCD ? A.interCD.H[j] : 0, wR, wTd, wTc, wI, wF, combs };
    });
    // vérifications ponts-rails EN 1991-2 §6.5.4
    let verifsRail = null;
    if (rep.rail) {
      const lim = inp.appDilatVoie === 2 ? 0.030 : 0.005;
      const LTmax = inp.tablierMat === 'acier' ? 60 : 90;
      verifsRail = rep.parDeck.map((o) => {
        const dk = rep.G.decks[o.k];
        const xpf = rep.pfLD[o.k];
        const LT = Math.max(xpf - dk.x0, dk.x1 - xpf);
        const dH = (inp.thetaExt || 0) * (inp.eExt || 0);
        return { k: o.k, deltaB: o.deltaB, limB: lim, okB: o.deltaB <= lim + 1e-12, LT, LTmax, okLT: LT <= LTmax, dH, limH: 0.008, okH: dH <= 0.008 + 1e-12, Ftot: o.frein.total };
      });
    }
    const joints = souffles(rep, C);
    return { inp, rep, plaques, app, parAppui, C, verifsRail, joints, iterations: it, msgs };
  }

  function verifAppareils(rep, inp, mode) {
    const M = appm();
    const out = [];
    rep.G.lignes.forEach((l, i) => {
      const ap = rep.app[l.j];
      const n = ap.napp || 1;
      const nl = rep.G.lignes.filter((x) => x.j === l.j).length;
      const rec = { j: l.j, li: i, cote: l.cote, app: l.app, n };
      if (l.app === 'elasto') {
        if (!M) { rec.err = 'ÉLASTOMÈRES indisponible'; out.push(rec); return; }
        const combis = combisAppareil(rep, i, inp);
        const opts = { G: inp.Gld ?? 0.9, Gd: inp.Gcd ?? 1.8, sigLim: inp.sigLim ?? 15, alpha0: inp.alpha0 ?? 0.003, hmode: 'v', fy: inp.fyFrette ?? 235 };
        const regl = inp.reglApp === 'setra2000' ? 'setra2000' : 'en1337';
        rec.combis = combis;
        if (mode === 'dim') rec.res = M.dimensionner({ regl, mode: 'dim', combis, opts });
        else rec.res = M.verifier({ regl, plaque: ap.plaque, combis, opts });
      } else if (l.app === 'fixe') {
        const F = (k) => Math.abs(rep.A[k] ? rep.A[k].lig[i].F : 0);
        const C = coefs(inp);
        const R = rep.A.retrait.lig[i].F, Td = rep.A.dil.lig[i].F, Tc = rep.A.con.lig[i].F, I = rep.A.inter ? rep.A.inter.lig[i].F : 0, Fr = rep.A.frein.lig[i].F;
        rec.H = C.map((c) => ({ id: c.id, H: envComb(c, R, Td, Tc, I, Fr).abs }));
        const HELS = Math.max(...rec.H.filter((h) => /^ELS/.test(h.id)).map((h) => h.H));
        const Vmin = (ap.Gmin ?? ap.Gmax ?? 0) / nl;
        rec.HV = Vmin > 0 ? HELS / Vmin : Infinity; rec.HVlim = inp.hvMax ?? 0.25;
        rec.ok = rec.HV <= rec.HVlim; void F;
      } else {
        const N = (ap.Gmax || 0) / nl; rec.Hf = (inp.mu ?? 0.05) * N; rec.ok = true;
      }
      out.push(rec);
    });
    return out;
  }

  /* ── export « fichiers appui » (relus par le module PILES-CULÉES) ── */
  function exportAppuis(R) {
    const { rep, parAppui, inp } = R;
    return rep.app.map((ap, j) => {
      const RA = rep.RA[j], pa = parAppui[j], phi = RA.phi, sx = Math.sin(phi), sy = Math.cos(phi);
      const act = (id, nom, H, w, duree) => ({ id, nom, duree, H, HX: H * sx, HY: H * sy, w });
      const lignes = rep.G.lignes.map((l, i) => [l, i]).filter(([l]) => l.j === j).map(([l, i]) => ({ cote: l.cote || 'unique', type: l.app, nombre: ap.napp || 1, plaque: l.app === 'elasto' ? (R.plaques[j] || null) : null, Kcd: rep.RB[i].cd, Kld: rep.RB[i].ld }));
      return {
        format: 'BA.horizontal.appui', version: 1, module: 'HORIZONTAL', projet: inp.projet || '', appui: j, nom: ap.nom || `Appui ${j}`,
        x: rep.G.x[j], biais_gr: phi / GR, type: ap.type, typeLibelle: TYPES_APPUI[ap.type],
        convention: 'H > 0 dans le sens des abscisses croissantes ; HX perpendiculaire à la file d’appuis, HY parallèle (HX = H·sinφ, HY = H·cosφ) ; kN, m',
        raideurs: { futCD: RA.Kfcd, futLD: RA.Kfld, teteCD: RA.Kcd, teteLD: RA.Kld, totaleCD: rep.Keq[j].cd, totaleLD: rep.Keq[j].ld },
        appareils: lignes,
        actions: [
          act('retrait', 'Retrait', pa.R, pa.wR, 'LD'),
          act('dilatation', 'Dilatation', pa.Td, pa.wTd, 'LD+CD'),
          act('contraction', 'Contraction', pa.Tc, pa.wTc, 'LD+CD'),
          act('dilatationCD', 'Dilatation, part courte durée', pa.TdCD, null, 'CD'),
          act('contractionCD', 'Contraction, part courte durée', pa.TcCD, null, 'CD'),
          act('freinage', rep.rail ? 'Freinage-démarrage (± , voies chargées)' : 'Freinage (±)', pa.F, pa.wF, 'CD'),
        ].concat(rep.rail && rep.A.inter ? [act('interaction', 'Interaction voie-ouvrage (±)', pa.I, pa.wI, 'LD+CD'), act('interactionCD', 'Interaction, part courte durée (±)', pa.ICD, null, 'CD')] : []),
        combinaisons: pa.combs.map((c) => ({ id: c.id, nom: c.nom, etat: c.etat, Hmax: c.H.max, Hmin: c.H.min, HXmax: c.H.max * sx, HXmin: c.H.min * sx, HYmax: c.H.max * sy, HYmin: c.H.min * sy, wmax: c.w.max, wmin: c.w.min })),
      };
    });
  }

  /* ── lecture d'un fichier .don d'origine (HORIZONTAL) ── */
  function parseDon(txt) {
    const lines = String(txt).replace(/\r/g, '').split('\n');
    const kv = {};
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (/^FIN_DICO/.test(L.trim())) break;
      if (!L.trim() || L.trim().startsWith(';') || !L.includes(';')) continue;
      const key = L.split(';')[0].trim().toLowerCase();
      const val = (lines[i + 1] ?? '').trim(); i++;
      (kv[key] = kv[key] || []).push(val);
    }
    const n = (k, d = 0, i = 0) => { const v = kv[k] && kv[k][i]; return v !== undefined && v !== '' && Number.isFinite(+v) ? +v : d; };
    const s = (k) => (kv[k] && kv[k][0]) || '';
    const nt = Math.round(n('nbrtrav', 1));
    const travees = Array.from({ length: nt }, (_, i) => n('travee', 10, i));
    const TYP = ['pile', 'culee', 'culeeRonde', 'mur', 'autre', 'pieux'];
    const evB = n('biaiseventailles', 0) === 1;
    const appuis = [];
    for (let j = 0; j <= nt; j++) {
      const ta = Math.round(n('typecalappui', j === 0 || j === nt ? 1 : 0, j));
      const tap = Math.round(n('typeappuis', 1, j));
      const zs = n('zdessusappui', 10, j), zb = n('zbaseappui', 0, j), es = n('epsem', 1, j);
      const plaque = n('larelas', 0, j) > 0 && n('lonelas', 0, j) > 0 && n('nbfeu', 0, j) > 0
        ? { forme: 'rect', a: n('larelas', 0, j), b: n('lonelas', 0, j), n: Math.round(n('nbfeu', 0, j)), ti: n('epfeu', 0.01, j), ts: n('epfre', 0.003, j), te: 0, c: n('enrobfret', 0.005) }
        : null;
      const enc = n('encastrebase', 1, j) !== 0;
      appuis.push({
        nom: j === 0 ? 'C0' : j === nt ? 'C' + nt : 'P' + j, type: TYP[ta] || 'pile',
        app: tap <= 0 ? 'fixe' : tap === 2 ? 'glissant' : 'elasto', napp: Math.round(n('nbappuismobiles', 2, j)) || 1,
        nfut: Math.max(1, Math.round(n('nbfuts', 1, j))), larfut: n('larfut', 1, j), esup: n('epfutsup', 0.8, j), einf: n('epfutinf', 0.8, j),
        hfut: Math.max(0, zs - zb - es), htot: zs - zb, biais: evB ? n('biaisappui', 100, j) : n('biais', 100),
        encastre: enc, Khld: n('raideursolk1ld', 0, j), Krld: n('raideursolk2ld', 0, j), Khcd: n('raideursolk1cd', 0, j), Krcd: n('raideursolk2cd', 0, j),
        Kld: n('raideurld', 0, j), Kcd: n('raideurcd', 0, j),
        Gmax: n('relsmaxappapp', 0, j), Gmin: n('relsmaxappapp', 0, j), Qmax: 0, Nels: n('relsmaxappapp', 0, j), rot: 0, plaque,
      });
    }
    const pra = Math.round(n('pra', 1));
    const tc = Math.round(n('typcalappapp', 2));
    const xi = n('coeffreinvoietab', 0);
    const qi = n('interaction1voie', 0);
    const inp = {
      projet: s('projet'), ouvrage: pra === 0 ? 'route' : 'rail', nvoies: Math.round(n('nbvoipra', 1)) || 1,
      travees, about0: n('about0', 0), aboutn: n('aboutn', 0), joints: [], appuis, biais: n('biais', 100),
      Emode: 'bael', fck: n('fcj', 32), phi: 2, kbutLong: n('kbutlong', 1.825), kbutTran: n('kbuttran', 2.54),
      Gld: n('moglilt', 0.9), Gcd: n('moglict', 1.8), sigLim: n('elasmax', 15), alpha0: n('alpha0_1', 0.003), hvMax: n('hvmax', 0.25), fyFrette: n('fyfret', 235),
      retraitMode: 'saisi', epsRetrait: n('defretrait', 0), alphaT: 1e-5, dTdil: n('defdilatation', 0) / 1e-5, dTcon: n('defcontraction', 0) / 1e-5, dTcd: n('deftemperaturect', 0) / 1e-5,
      qFrein: n('freinuic', 20), qSW2: n('freinsw2', 35), qDem: n('demarrage', 33), FdemMax: n('demarragemax', 1000), FfreinMax: n('freinuicmax', 6000),
      alpha: n('coeffalpha', 1) || 1, xi: xi > 0 ? xi : 0.5, qInter: qi > 0 ? qi : 8, interaction: true, sw2: true, freinDem: false, nVoiesFrein: 2,
      appDilatVoie: Math.round(n('appdilatvoie', 0)), mu: n('coeffrotglissant', 5) / 100,
      modeApp: tc === 0 ? 'predim' : tc === 1 ? 'verif' : 'dim', reglApp: 'en1337',
      lch: n('largeurchargeable', 7) || 7, classeF61: Math.round(n('classe', 1)) || 1, fasc61: true, reglRoute: 'en',
    };
    return inp;
  }

  const api = { modules, retraitEC2, raideurAppui, raideurAppareils, geometrie, resoudre, calcRepartition, freinageRail, freinageRoute, lSW2, coefs, envComb, calc, exportAppuis, parseDon, TYPES_APPUI, predim };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.horizontal = api; }
})(typeof window !== 'undefined' ? window : globalThis);
