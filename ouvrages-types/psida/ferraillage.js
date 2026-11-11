/* PSIDA-EL — ferraillage : ferraillage longitudinal retenu (enveloppes, gamme, épure d'arrêt des barres),
 * étriers, appareils d'appui, ferraillage transversal.
 * computeFer(modele, r) complète r.fer ; renderFer(modele, r, outils) ajoute les pages correspondantes.
 * Règles reconstituées à partir des listings SETRA du corpus de réglage (cf. NOTES.md, § Ferraillage).
 */
(function (G) {
  'use strict';
  const P = G.PSIDA = G.PSIDA || {};
  const PI = Math.PI;
  const aire = phi => PI * phi * phi / 4;
  const r3 = v => Math.round(v * 1000 + 1e-7) / 1000;

  // ------------------------------------------------------------------ groupes de barres longitudinales
  // Les groupes sont disposés sur une grille centrée de pas s ; on retient la parité (nombre pair ou impair) qui
  // donne le plus de groupes en nappe supérieure (largeur totale − 2×0,10 m), à égalité le plus en nappe
  // inférieure (largeur d'intrados − 2×0,10 m). Recalé 9/9 sur le corpus de réglage.
  const BORD = 0.10;
  function nGroupes(B, s, impair) { return impair ? 2 * Math.floor((B / 2 - BORD) / s + 1e-9) + 1 : 2 * Math.floor((B / 2 - BORD) / s + 0.5 + 1e-9); }
  function groupes(W, E1, s) {
    const o = [0, 1].map(p => ({ S: nGroupes(W, s, p), I: nGroupes(E1, s, p) }));
    return o[0].S !== o[1].S ? (o[0].S > o[1].S ? o[0] : o[1]) : (o[0].I >= o[1].I ? o[0] : o[1]);
  }
  // répartition des groupes en 3 familles (poutre élémentaire de 3 groupes) et ordre de remplissage des 9 positions
  // Les groupes sont numérotés depuis le bord gauche de la nappe supérieure (familles A, B, C, A, B, C…) ; la nappe
  // inférieure, centrée, commence à la famille ((nS − nI)/2) mod 3 (3826 : A ; 3603, OA26 : C).
  function familles(n, k0) { const c = [0, 0, 0]; for (let i = 0; i < n; i++) c[(i + (k0 || 0)) % 3]++; return c; }
  const ORDRE = [0, 1, 2, 2, 1, 0, 0, 1, 2];           // A1 B1 C1 C2 B2 A2 A3 B3 C3
  function comptes(n, N1, k0) { const f = familles(n, k0); return ORDRE.slice(0, 3 * N1).map(k => f[k]); }

  // gamme : colonnes (niveau k φ1 seul, puis niveau k + fer suivant en φ2)
  function gamme(n, N1, phi, k0) {
    const c = comptes(n, N1, k0), cols = [];
    const nb = k => c.slice(0, k).reduce((a, b) => a + b, 0);
    const occ = (k, alt) => { const f = familles(n, k0); const used = [0, 0, 0]; ORDRE.slice(0, k + (alt ? 1 : 0)).forEach(q => used[q] = 1); return f.reduce((a, v, q) => a + (used[q] ? v : 0), 0); };
    const col = (k, alt) => { const p1 = nb(k), p2 = alt ? c[k] : 0, p3 = n - occ(k, alt);
      return { p1, p2, p3, om: p1 * aire(phi[0]) + p2 * aire(phi[1]) + p3 * aire(phi[2]) }; };
    cols.push(col(0, false));
    for (let k = 1; k < c.length; k++) { cols.push(col(k, false)); cols.push(col(k, true)); }
    cols.push(col(c.length, false));
    return { comptes: c, cols };
  }

  // ------------------------------------------------------------------ calcul
  function computeFer(m, r) {
    const A3 = m.lignes.A3, A7 = r._A7, A11 = r._A11, mat = r.mat, ph = mat.phi;
    if (!r.moments || !r.ferLong) return;
    const g = r.ferLong, H = g.H, n = r.n;
    const ss = mat.fiss >= 2 && mat.sigS ? mat.sigS[0] : null;
    // hauteurs utiles retenues : nappe supérieure = hauteur provisoire ; nappe inférieure = H − ENROBI − φ2 − φ1/2
    // en fissuration préjudiciable (constat 3826, 3827, 0063, OA26, 3639), sinon hauteur provisoire (3603…3610 ;
    // LIGNINF = 1 : 3452, 3453, 3488). Non expliqué : 3639 nappe supérieure (0,457 au lieu de 0,478).
    const cpd = typeof G.PSIDA_CPS === 'function' ? G.PSIDA_CPS(r) : undefined;   // diagnostic : c' imposé
    if (cpd !== undefined) g.dS = r3(H - A11.ENROBS - cpd);
    const dS = G.PSIDA_DSU ? H - A11.ENROBS - (ph[1] + ph[0] / 2) - 0.1 * (ph[0] + ph[1]) : g.dS, dI = (mat.fiss >= 2 && A3.LIGNINF !== 1) ? r3(H - A11.ENROBI - ph[1] - ph[0] / 2) : g.dI;
    const env = (sup, MM) => (MM || r.moments).map(sp => sp.map(s => {
      const Me = sup ? -s.els.min : s.els.max, Mu = sup ? -s.elu.min : s.elu.max;
      const b = sup ? g.bS : g.bI, d = sup ? dS : dI;
      return Math.max(Me > 0 ? P.asELS(Me, b, d, ss).As : 0, Mu > 0 ? P.asELU(Mu, b, d, mat) : 0);
    }));
    let eS = env(true), eI = env(false);
    if (typeof G.PSIDA_ENV === 'function') { const o = G.PSIDA_ENV(r, eS, eI); if (o) { eS = o.eS || eS; eI = o.eI || eI; } }   // diagnostic : enveloppes imposées
    const amax = e => Math.max(0, ...e.map(t => Math.max(...t)));
    const AmS = amax(eS), AmI = amax(eI);
    // espacement des groupes : ESPAC1 diminué par pas de 5 mm jusqu'à ce que N1 fers φ1 par groupe couvrent le
    // maximum des enveloppes. Non expliqué : 3488 (0,290 au lieu de 0,295) et 3639 (0,305 au lieu de 0,310).
    const N1 = A11.N1 || 3, a1 = aire(ph[0]);
    const W = r.largeurTotale, E1 = A7.EDALLE1;
    let s = A11.ESPAC1 > 0 ? A11.ESPAC1 : 10 * ph[0], ng = groupes(W, E1, s);
    for (let k = 0; k < 200; k++) {
      ng = groupes(W, E1, s);
      if (AmS <= RES * N1 * ng.S * a1 && AmI <= RES * N1 * ng.I * a1) break;
      s = r3(s - 0.005);
    }
    // longueur de recouvrement (scellement droit BAEL) : ls = φ fe / (4 × 0,6 ψs² ftj), ψs = 1,5
    const ls = ph[0] * mat.fe[0] / (4 * 0.6 * 1.5 * 1.5 * mat.ftj);
    r.fer = {
      long: {
        sup: { d: dS, b: g.bS, env: eS, n: ng.S, k0: 0, gamme: gamme(ng.S, N1, ph, 0) },
        inf: { d: dI, b: g.bI, env: eI, n: ng.I, k0: ((ng.S - ng.I) / 2) % 3, gamme: gamme(ng.I, N1, ph, ((ng.S - ng.I) / 2) % 3) },
        s, ls, N1,
      },
    };
    if (r.momentsFin && !G.PSIDA_ENV) { r.fer.long.sup.envF = env(true, r.momentsFin); r.fer.long.inf.envF = env(false, r.momentsFin); r.fer.long.SAF = r.momentsFin[0].map(s => s.a);
      const w = G.PSIDA_R1AVG != null ? G.PSIDA_R1AVG : 0, SA0 = r.moments[0].map(s => s.a), SF = r.fer.long.SAF;
      r.fer.long.inf.envA = r.fer.long.inf.envF.map(v => v.map((x, j) => j > 0 && j < v.length - 1 && !SA0.some(a => Math.abs(a - SF[j]) < 1e-9) ? w * x + (1 - w) * (v[j - 1] + v[j + 1]) / 2 : x)); }
    r.fer.long.epure = epure(r, r.fer.long, H);
    r.fer.etriers = etriers(r, r.fer.long);
    r.fer.appareils = appareils(m, r);
    r.fer.transv = transversal(r);
    r.fer.propose = propose(r);
    r.fer.metre = metre(r);
    r.fer.verif = verification(r);
  }


  // ------------------------------------------------------------------ VERIFICATION DE L'OUVRAGE AUX SECTIONS LES PLUS SOLLICITEES
  // (résumé) Constats v10 (3826, 0063, 3603, 3488, 3639, OA26) : sections = chaque travée (M ELS/ELU max) et chaque appui
  // intermédiaire (M min des deux travées contiguës) ; aciers tendus = première colonne de la GAMME couvrant le maximum
  // de l'enveloppe (φ2 compris : 3826 travée 45 φ32 + 6 φ16) ; largeur = largeur de calcul de la nappe tendue (W en travée,
  // largeur supérieure sur appui), hauteur utile retenue ; n = 15 (exact : rapports σs/σb imprimés). ELU : diagramme
  // parabole-rectangle, pivots A/B, moment pris autour des aciers tendus. APPROXIMATIF : aciers comprimés (section et
  // position non retrouvées ; ici fers de construction de la nappe opposée, colonne 0 de la gamme, à H − d_opposée).
  function verification(r) {
    const F = r.fer.long, H = r.ferLong.H, mat = r.mat, n = r.n, out = [];
    const pick = (G, v) => G.gamme.cols.find(c => c.om >= v - 1e-9) || G.gamme.cols[G.gamme.cols.length - 1];
    const fbu = 0.85 * mat.fcj / 1.5, Es = mat.Es || 2.04e7, fsu = mat.fe[0] / 1.15;
    const pr = ec => { let N = 0, Mt = 0; const nn = 400; for (let i = 0; i < nn; i++) { const z = (i + 0.5) / nn, e = ec * (1 - z), s = e >= 2 ? 1 : 1 - (1 - e / 2) * (1 - e / 2); N += s / nn; Mt += s * z / nn; } return [N, Mt / N]; };
    for (let k = 0; k < 2 * n - 1; k++) {
      const sup = k % 2 === 1, G = sup ? F.sup : F.inf, O = sup ? F.inf : F.sup;
      let env, M, Mu;
      if (!sup) { const i = k / 2; env = Math.max(...G.env[i]); M = Math.max(...r.moments[i].map(s => s.els.max)); Mu = Math.max(...r.moments[i].map(s => s.elu.max)); }
      else { const i = (k - 1) / 2; env = Math.max(G.env[i][G.env[i].length - 1], G.env[i + 1][0]);
        M = -Math.min(...r.moments[i].map(s => s.els.min), ...r.moments[i + 1].map(s => s.els.min));
        Mu = -Math.min(...r.moments[i].map(s => s.elu.min), ...r.moments[i + 1].map(s => s.elu.min)); }
      const As = pick(G, env).om, As2 = O.gamme.cols[0].om, b = G.b, d = G.d, d2 = H - O.d, ne = 15;
      // ELS : section fissurée avec aciers comprimés
      const B = ne * (As + As2), C = -ne * (As * d + As2 * d2), y = (-B + Math.sqrt(B * B - 2 * b * C)) / b;
      const I = b * y * y * y / 3 + ne * As2 * (y - d2) * (y - d2) + ne * As * (d - y) * (d - y);
      // ELU
      const st = t => { let ec, es; if (t <= 1) { ec = 3.5 * t; es = 10; } else { ec = 3.5; es = 10 / t; }
        const x = d * ec / (ec + es), q = pr(ec), e2 = ec * (x - d2) / x, s2 = Math.max(-fsu, Math.min(fsu, Es * e2 / 1000));
        return { ec, es, e2, M: b * x * q[0] * fbu * (d - q[1] * x) + As2 * s2 * (d - d2) }; };
      let lo = 1e-4, hi = 50; for (let it = 0; it < 80; it++) { const mid = Math.sqrt(lo * hi); if (st(mid).M < Mu) lo = mid; else hi = mid; }
      const u = st(lo);
      out.push({ y, sb: -M * y / I, ss2: -ne * M * (y - d2) / I, ss: ne * M * (d - y) / I, ec: -u.ec, e2: -u.e2, es: u.es });
    }
    return out;
  }

  // ------------------------------------------------------------------ avant-métré récapitulatif
  // Béton = aire de la section × longueur totale ; coffrage de sous-dalle = E1 × longueur totale ; autres coffrages =
  // (flancs + sous-faces d'encorbellement + rives) × longueur totale + 2 × aire (abouts) — exact sur 3826.
  // Aciers : poids des épures (APPROXIMATIFS, cf. épure) ; étriers : 2 brins de (H − 2 enrobages) + 15 φ4 par groupe
  // inférieur et par cours (HYPOTHÈSE calée à ±7 % sur 3826, 3603, 0063, 3488) ; ferraillage transversal non reconstitué (0).
  function metre(r) {
    const A7 = r._A7, A11 = r._A11, W = r.largeurTotale, Lt = r.longueurTotale, H = r.section.H, ph = r.mat.phi;
    const E1 = A7.EDALLE1, E3 = A7.EDALLE3, H3 = A7.HDALLE3, H2 = A7.HDALLE2;
    const Lenc = Math.max(0, W / 2 - E1 / 2 - E3 / 2), hr = Math.max(0, H - H3);
    const per = 2 * (Math.hypot(E3 / 2, H3) + Math.hypot(Lenc, hr - H2) + H2);
    const beton = r.section.A * Lt, sousDalle = E1 * Lt, autres = per * Lt + 2 * r.section.A;
    const lon = [0, 0, 0, 0];
    const ep = r.fer.long.epure;
    if (ep) for (const face of ['sup', 'inf']) for (const bl of ep[face]) for (const g of bl.groupes) for (const b of g.fers) {
      const k = ph.indexOf(b.phi); if (k >= 0) lon[k] += b.nb * b.len * aire(b.phi) * 7.85;
    }
    let etr = 0;
    if (r.fer.etriers) for (const t of r.fer.etriers) etr += t.nc * r.fer.long.inf.n * (2 * (H - A11.ENROBS - A11.ENROBI) + 15 * ph[3]) * aire(ph[3]) * 7.85;
    const tra = [0, 0, 0, 0];
    if (r.fer.propose) r.fer.propose.total.forEach((v, i) => { tra[i] = v; });
    const tot = lon.map((v, i) => v + tra[i] + (i === 3 ? etr : 0));
    const ptot = tot.reduce((a, b) => a + b, 0);
    return { lon, tra, etr, tot, ptot, beton, sousDalle, autres, ratio: ptot / beton };
  }

  // ------------------------------------------------------------------ coefficients d'inégalité des appareils d'appui
  // (F61 titre II 1971 ; reconstitution 2026-11-04, cf. NOTES.md § Coefficients d'inégalité — RÈGLE). K = R / Rmoy,
  // Rmoy = réaction totale / Na. CP, A : « bandes porteuses » (centrale s, de rive demi-largeur − (Na−2)s/2) ; Bc, Bt, Mc120 :
  // ligne d'influence de la réaction d'un appui intermédiaire d'une poutre continue à une infinité de travées égales s,
  // convoi placé au plus défavorable. s = espacement imprimé × sin(biais géométrique). Mc120 approché pour Na ≥ 4.
  const kIn = 2 - Math.sqrt(3);                      // rapport des moments d'appui successifs (poutre infinie)
  // réaction de l'appui 0 pour une charge unité à l'abscisse réduite xi = y / s
  function etaIn(xi) {
    xi = Math.abs(xi);
    const j = Math.floor(xi), u = xi - j;
    if (u === 0 && j === 0) return 1;
    const A = u * (1 - u) * (2 - u), B = u * (1 - u) * (1 + u);
    // (4−k) Mj + Mj+1 = −A ; Mj + (4−k) Mj+1 = −B
    const a = 4 - kIn, det = a * a - 1;
    const Mj = (-A * a + B) / det, Mj1 = (-B * a + A) / det;
    if (j === 0) return (1 - u) - (2 + kIn) * Mj + Mj1;          // M−1 = −k·M0
    const M0 = Mj * Math.pow(-kIn, j), M1 = Mj * Math.pow(-kIn, j - 1), Mm1 = Mj * Math.pow(-kIn, j + 1);
    return Mm1 - 2 * M0 + M1;
  }
  const etaMean = (xi, w) => {                       // moyenne de eta sur une largeur réduite w (Simpson)
    if (!(w > 0)) return etaIn(xi);
    const n = 40, h = w / n; let t = 0;
    for (let i = 0; i <= n; i++) t += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * etaIn(xi - w / 2 + i * h);
    return t * h / 3 / w;
  };
  // maximum de Σ p·η sur la position transversale du convoi (parts : [abscisse, poids, largeur])
  function maxR(parts, s) {
    const ys = parts.map(p => p[0]), lo = -Math.max(...ys) - s, hi = -Math.min(...ys) + s;
    const f = o => parts.reduce((t, [y, p, w]) => t + p * etaMean((y + o) / s, (w || 0) / s), 0);
    let bo = lo, bv = -Infinity; const N = 800;
    for (let i = 0; i <= N; i++) { const o = lo + (hi - lo) * i / N, v = f(o); if (v > bv) { bv = v; bo = o; } }
    let a = bo - (hi - lo) / N, b = bo + (hi - lo) / N;           // affinage (section dorée)
    for (let it = 0; it < 60; it++) { const c = b - (b - a) * 0.618, d = a + (b - a) * 0.618; if (f(c) > f(d)) b = d; else a = c; }
    return Math.max(bv, f((a + b) / 2));
  }
  const A1T = { 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] };
  const BCT = { 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1, 1], 3: [1, 1] };
  const tab = (t, n) => t[Math.min(n, t.length) - 1];
  const r3In = x => Math.round(x * 1000 + 1e-9) / 1000;

  /** p = { Na, esp, biais (grades, biais géométrique), Be (largeur équivalente droite), Lch (largeur chargeable),
   *        nvc (nombre de voies), classe (1|2|3), H (HDALLE1), hchau } */
  function coefInegalite(p) {
    const Na = p.Na, s = p.esp * Math.sin(p.biais * Math.PI / 200), cl = p.classe, nv = p.nvc, L = p.Lch;
    // CP : bandes porteuses sur la dalle rectangulaire équivalente ; 2 appareils ⇒ 1
    const CP = Na <= 2 ? 1 : Math.max(s, p.Be / 2 - (Na - 2) * s / 2) / (p.Be / Na);
    // A : bande s (centrale) ou bande de rive sur la largeur chargeable ; R avec a1(1 voie), Rmoy avec a1(nvc)
    const A = Na * Math.max(s, L / 2 - (Na - 2) * s / 2) * tab(A1T[cl], 1) / (tab(A1T[cl], nv) * L);
    // Bc : files de 2,50 m, roues à 2,00 m (charges ponctuelles), Rmoy avec le nombre maximal de files
    const nf = Math.max(1, Math.min(nv, Math.floor(L / 2.5 + 1e-9)));
    let Rbc = 0;
    for (let n = 1; n <= nf; n++) {
      const parts = []; for (let f = 0; f < n; f++) parts.push([f * 2.5, 1, 0], [f * 2.5 + 2, 1, 0]);
      Rbc = Math.max(Rbc, tab(BCT[cl], n) * maxR(parts, s));
    }
    const BCk = Na * Rbc / (tab(BCT[cl], nf) * 2 * nf);
    // Bt : tandems de 3,00 m, roues à 2,00 m ; Rmoy avec le nombre maximal de tandems (bt se simplifie)
    const nt = Math.max(1, Math.min(2, nv, Math.floor(L / 3 + 1e-9)));
    let Rbt = 0;
    for (let n = 1; n <= nt; n++) {
      const parts = []; for (let f = 0; f < n; f++) parts.push([f * 3, 1, 0], [f * 3 + 2, 1, 0]);
      Rbt = Math.max(Rbt, maxR(parts, s));
    }
    const BTk = Na * Rbt / (2 * nt);
    // Mc120 — EMPIRIQUE, NON RÉSOLU pour Na ≥ 4 (sous-estime de 0,018 à 0,036) : 2 chenilles d'entraxe 3,30 m,
    // chacune discrétisée en 21 charges égales réparties (bornes incluses) sur 1 + H + hchau.
    const w = 1 + p.H + (p.hchau || 0), mc = [];
    for (const x0 of [0, 3.30]) for (let i = 0; i < 21; i++) mc.push([x0 - w / 2 + w * i / 20, 0.5 / 21, 0]);
    const MC = Na * maxR(mc, s);
    return { s, CP: r3In(CP), A: r3In(A), BC: r3In(BCk), BT: r3In(BTk), MC120: r3In(MC), CONVOIS: null };
  }

  // ------------------------------------------------------------------ appareils d'appui (DIMENSIONNEMENT …)
  // A vide : max = Gmax × coef CP / NAP, min = Gmin / NAP. En charge (exact sur 3826 avec les coefficients imprimés) :
  // max = (Gmax·cCP + max_cas(R⁺·c_cas·δ) + 2·T⁺)/NAP, min = (Gmin + min_cas(R⁻·c_cas·δ) + 2·T⁻)/NAP, δ convois = 1,1
  // sur appui d'extrémité, Bc/Bt × 1,2 δ, Mc × δ (δ sur appui : cf. non résolus ; 3603 confirme Bc×1,2×δ). Compressions atteintes = réaction en charge / aire. Coefficients d'inégalité : coefInegalite()
  // (CP, A, Bc, Bt exacts ; Mc120 approché ; convois D/E et Mc80 : 1,000, non résolus). Dimensions : largeur 0,25, longueur au pas de
  // 0,05 (min 0,25) pour respecter COMPRENS (hypothèse ; le choix largeur/longueur SETRA n'est pas identifié).
  function appareils(m, r) {
    if (!r.reactions || !r.appuis) return null;
    const A13 = m.lignes.A13 || {}, n = r.n;
    const cas = ['CP', 'A', 'BC', r.nomBt || 'BT', ...((r.chargesC || []).filter(c => /CVOI|MC/.test(c)))];
    return r.appuis.map((ap, k) => {
      const R = r.reactions[k], nap = Math.max(1, ap.nap), l = R.live;
      const coef = {}; for (const c of cas) coef[c] = 1;
      // coefficients d'inégalité (règle 2026-11-04) : CP pour tous règlements ; A, Bc, Bt, Mc120 au F61 1971 ;
      // Mc80, convois D/E : 1,000 conservé (règle non retrouvée).
      if (nap >= 2) {
        const A6 = m.lignes.A6 || {}, A7 = m.lignes.A7 || {};
        const K = coefInegalite({ Na: nap, esp: ap.esp, biais: r.biais || 100, Be: r.section.Eeq, Lch: A6.ESURCH,
          nvc: r.nvoies, classe: r.classe, H: A7.HDALLE1 || r.section.H, hchau: A6.HCHAU || 0 });
        coef.CP = K.CP;
        if (!r.f61_1960) { coef.A = K.A; coef.BC = K.BC; coef.BT = K.BT; if ('MC.120' in coef) coef['MC.120'] = K.MC120; }
      }
      const end = k === 0 || k === n;
      const dy = (r.cmdAppui && r.cmdAppui[k]) || { bc: 1, mc: 1 };
      const cands = [[l.A.pos.v * 1.2, l.A.neg.v * 1.2, coef.A], [l.Bc.max * 1.2 * dy.bc, l.Bc.min * 1.2 * dy.bc, coef.BC],
        [l.Bt.max * 1.2 * dy.bc, l.Bt.min * 1.2 * dy.bc, coef[r.nomBt || 'BT']]];
      for (const c of l.CE || []) { const d = /CVOI/.test(c.nom) ? (end ? 1.1 : 1) : dy.mc; cands.push([c.max.v * d, c.min.v * d, coef[c.nom] || 1]); }
      const vmax = Math.max(...cands.map(c => c[0] * c[2])), vmin = Math.min(...cands.map(c => c[1] * c[2]));
      const videMax = R.G.up * coef.CP / nap, videMin = R.G.dn / nap;
      // trottoirs : facteur Na/2 (v11, activé en v13 avec la section ELU des chevêtres) : 3639 et 3603 (Na = 2) sont exacts avec les
      // trottoirs comptés UNE fois (facteur Na/2) mais le score de réglage baisse (résumé, ferraillage transversal calés sur
      // l'ancien facteur). Crochet PSIDA_AP_TNA2 = 1 : facteur Na/2.
      const kT = G.PSIDA_AP_TNA2 === 0 ? 2 : nap / 2;   // v13 : Na/2 par défaut (réactions exactes 3488, 3603–3606, 3639, 0063)
      const chMax = (R.G.up * coef.CP + vmax + kT * l.T.max) / nap, chMin = (R.G.dn + vmin + kT * l.T.min) / nap;
      const adm = ap.typ === 0 ? (A13.COMPREBS || 3500) : (A13.COMPRENS || 1500);
      // dimensions (v10) : largeur 0,25, 0,30, 0,35… ; pour chaque largeur, longueur de largeur à largeur + 0,25 au pas
      // de 0,05 ; premier couple tel que R/aire ≤ admissible (0,30×0,55 puis 0,35×0,50 : 3604–3610, 3639, 3488, 3452).
      // Crochet PSIDA_AP_V9 = 1 : ancienne règle (largeur 0,25, longueur libre).
      let larg = 0.25, long = Math.max(0.25, Math.ceil(chMax / adm / larg / 0.05 - 1e-9) * 0.05);
      if (!G.PSIDA_AP_V9) {
        const need = chMax / adm; let done = false;
        for (let a = 5; a <= 20 && !done; a++) for (let b = a; b <= a + 5; b++) if ((a * 0.05) * (b * 0.05) >= need - 1e-9) { larg = a * 0.05; long = b * 0.05; done = true; break; }
      }
      // chevêtre (constats 3603, 3607, 3639, 3826, 3488, 0063) : largeur = 2 esp/3 sur appui intermédiaire,
      // about·sin ψ (grades) + esp/3 sur culée ; moment = R en charge max × esp / (12 × largeur) ;
      // section : ELS, section fissurée b = 1, n = 15, d = H − 0,04, σs = σ̄s (exact en fissuration préjudiciable ;
      // approché à ~1 % en peu préjudiciable, règle exacte non retrouvée).
      const ech = end ? (r.about || 0) * Math.sin((r.biais || 100) * Math.PI / 200) + ap.esp / 3 : 2 * ap.esp / 3;
      const mch = ech > 0 ? chMax * ap.esp / (12 * ech) : 0;
      // v23 : hauteur utile du chevêtre d = H − ENROBS − 0,6 φt (φt = plus gros diamètre des fers de zone 1 retenus au
      // FERRAILLAGE TRANSVERSAL PROPOSE ; 0,6 φ = φ/2 majoré de 20 %) : H − 0,0396 pour φt 16, H − 0,0492 pour 3639 (PHI1/PHI2 ALT, φ 32).
      // Ici d provisoire (H − 0,04) ; propose() recalcule ach(d) avec le diamètre choisi. Crochet PSIDA_DCH0 = 1 : H − 0,04 partout.
      const sS = (r.mat.sigS && r.mat.sigS[2]) || 25000;
      let mchu = null;
      const achOf = dch => {
        const mres = A => { const x = -15 * A + Math.sqrt(225 * A * A + 30 * A * dch); return A * sS * (dch - x / 3); };
        let lo = 0, hi = 0.05; for (let it = 0; it < 80; it++) { const md = (lo + hi) / 2; if (mres(md) < mch) lo = md; else hi = md; }
        // v13 : fissuration peu préjudiciable → section à l'ELU (réaction ELU = 1,125[1,2G + 1,42(A|B|Tr) | 1,2 C], moment
        // ELU = R_u esp / (12 largeur)) ; section imprimée « PAR ML LONGITUDINAL » = section × sin φ (3603–3606).
        // Crochet PSIDA_CHV12 = 1 : ancien calcul (ELS σs = 2/3 fe, sans sin φ).
        let ach = hi;
        if (!G.PSIDA_CHV12) {
          if (!(r.mat.fiss >= 2) && ech > 0) {
            const ku = c => c[3] ? 1.35 : 1.5975 / 1.2;
            cands[0][3] = cands[1][3] = cands[2][3] = 0; for (let j = 3; j < cands.length; j++) cands[j][3] = 1;
            const vu = Math.max(...cands.map(c => c[0] * c[2] * ku(c)));
            const chU = (1.35 * R.G.up * coef.CP + vu + 1.5975 * kT * l.T.max) / nap;
            mchu = chU * ap.esp / (12 * ech);
            const fe = r.mat.fe[2] || r.mat.fe[0];
            ach = G.PSIDA.asELU(mchu, 1, dch, Object.assign({}, r.mat, { fe: [fe, fe, fe, fe] }));
          }
          ach *= Math.sin((r.biais || 100) * Math.PI / 200);
        }
        return ach;
      };
      const ach = achOf((r.section.H || 0) - 0.04);
      return { nap: ap.nap, typ: ap.typ, esp: ap.esp, larg, long, coef, cas, videMax, videMin, chMax, chMin, cMin: chMin / (larg * long), cMax: chMax / (larg * long), ech, mch, mchu, ach, achOf };
    });
  }

  // ------------------------------------------------------------------ étriers (pages ETRIERS DE LA TRAVEE i)
  // Section par cours = 2 brins × nombre de groupes inférieurs × aire(φ4). τ limite = 0,2 fcj/1,5 (fissuration
  // peu préjudiciable) ou 0,15 fcj/1,5. Effort tranchant maximal : enveloppe bilinéaire, max de la droite joignant
  // les valeurs ELU maximales des deux extrémités de la travée et de celle joignant les opposées des minimales
  // (exact sur 3826). Cisaillement τ = V / (E DALLE × d), d = H − ENROBS − (φ2 + φ1/2) − 0,1 (φ1 + φ2) (v17). Espacement maximal :
  // min(0,40 ; At fe / (0,4 MPa × E DALLE)), 0,4 MPa = 400/9,81 t/m² (v8). Épure retenue : s = plus grande valeur
  // de la série de Renard R10 ≤ espacement maximal, n = ⌈L/s⌉ cours également espacés sur la portée (v8).
  function etriers(r, F) {
    if (!r.effortsTranchants) return null;
    const mat = r.mat, ph = mat.phi, n = r.n;
    const At = 2 * F.inf.n * aire(ph[3]);
    const tl = (mat.fiss <= 1 ? 0.2 : 0.15) * mat.fcj / 1.5;
    // hauteur utile du cisaillement (v17) : d = H − ENROBS − (φ2 + φ1/2) − 0,1 (φ1 + φ2) non arrondie — constat à 1e-5 m sur
    // 18/19 passages (familles φ1 32 / φ2 16 et φ1 25 / φ2 16, φ4 indifférent) ; 3639 (φ2 14) non expliqué. Crochet PSIDA_TAUD = 0 : d_sup.
    const cpd = typeof G.PSIDA_CPS === 'function' ? G.PSIDA_CPS(r) : undefined;
    const dTau = cpd !== undefined ? r.ferLong.H - r._A11.ENROBS - cpd : G.PSIDA_TAUD === 0 ? F.sup.d : r.ferLong.H - r._A11.ENROBS - (ph[1] + ph[0] / 2) - 0.1 * (ph[0] + ph[1]);
    const bd = r.section.Eeq * dTau;
    // 0,4 MPa converti en t/m² (1 MPa = 1000/9,81 t/m²) : 3639 0,174 et 4015 0,289 exacts (40 t/m² donnait 0,178 / 0,295)
    const smax = Math.min(0.40, At * mat.fe[3] / ((G.PSIDA_TAU40 ? 40 : 400 / 9.81) * r.section.Eeq));
    // espacement de l'épure : plus grande valeur de la série de Renard R10 ≤ smax (3639 0,174 → 0,16 ; 4015 0,289 → 0,25)
    const R10 = [0.40, 0.315, 0.25, 0.20, 0.16, 0.125, 0.10, 0.08, 0.063, 0.05];
    const sEp = G.PSIDA_EP_SMAX ? smax : (R10.find(v => v <= smax + 1e-9) || smax);
    const out = [];
    for (let i = 0; i < n; i++) {
      let [g, d] = r.effortsTranchants[i]; const Li = r.L[i], j = n - 1 - i;
      // ouvrage symétrique : SETRA ne calcule que la première moitié ; travées suivantes = image miroir
      if (j < i && sym(r.L)) { const [gj, dj] = r.effortsTranchants[j], mir = v => ({ elu: { max: -v.elu.min, min: -v.elu.max } }); g = mir(dj); d = mir(gj); }
      const rows = [];
      for (let k = 0; k <= 20; k++) {
        const a = k / 20;
        const v1 = g.elu.max + (d.elu.max - g.elu.max) * a, v2 = -(g.elu.min + (d.elu.min - g.elu.min) * a);
        const V = Math.max(v1, v2);
        rows.push({ a, V, tau: V / bd, s: smax });
      }
      const nc = Math.ceil(Li / sEp - 1e-9);
      // v25 : poids partiel = n cours × nI étriers × longueur développée × aire φ4 × 7,85 ; longueur développée = celle de
      // l'avant-métré (2 (H − ENROBS − ENROBI) + 15 φ4, même formule que la ligne 147) — APPROCHÉE (cf. NOTES v8 / v25).
      const A11e = r._A11 || {}, He = r.ferLong ? r.ferLong.H : 0;
      const poids = nc * F.inf.n * (2 * (He - (A11e.ENROBS || 0) - (A11e.ENROBI || 0)) + 15 * ph[3]) * aire(ph[3]) * 7.85;
      out.push({ rows, At, tl, nc, esp: Li / nc, L: Li, poids });
    }
    return out;
  }

  // ------------------------------------------------------------------ épure d'arrêt des barres (APPROXIMATIVE)
  // Structure reconstituée (3826) : nappe sup. — par travée, fers de construction φ3 « LSTi » ; par appui
  // intermédiaire, fers principaux « LSAk » ; nappe inf. — fers principaux « LITi », fers de construction « LIAk ».
  // Fers principaux : positions de la poutre élémentaire dans l'ordre de remplissage, jusqu'à couvrir le maximum
  // local ; le dernier fer est en φ2 si cela suffit. Fers de construction : positions 1–3 avec les familles de leur
  // nappe, positions suivantes calquées sur les fers principaux de la nappe opposée avec les familles inférieures.
  // Les fers 1–3 inférieurs filent d'un fer de construction d'appui à l'autre avec recouvrement ls.
  // Abscisses d'arrêt : franchissement linéaire de l'enveloppe (grille 0,05 L) + décalage forfaitaire 0,8 H
  // (HYPOTHÈSE : les règles exactes d'arrêt ne sont pas reconstituées).
  function epure(r, F, H) {
    const ph = r.mat.phi, L = r.L, n = r.n, SA = r.moments[0].map(s => s.a), ab = r.about || 0;
    const e = 0.8 * H, ls = F.ls, ls3 = ph[2] * r.mat.fe[2] / (4 * 0.6 * 2.25 * r.mat.ftj);
    const cS = comptes(F.sup.n, F.N1, 0), cI = comptes(F.inf.n, F.N1, F.inf.k0);
    const cum = (c, k, a) => c.slice(0, k).reduce((p, q) => p + q, 0) * a;
    // nombre de positions et diamètre du dernier fer pour couvrir Amax
    function nbFers(c, Am, gm) {
      // nombre de rangs : colonnes de la gamme (fers de construction compris), φ2 pour le dernier fer « au mieux »
      if (gm && !G.PSIDA_NBF_PHI1) { const cl = gm.cols;
        for (let k = 1; k <= c.length; k++) { if (k > 1 && cl[2 * (k - 1)].om >= Am - 1e-12) return { k, last: 1 }; if (cl[2 * k - 1].om >= Am - 1e-12) return { k, last: 0 }; }
        return { k: c.length, last: 0 }; }
      for (let k = 1; k <= c.length; k++) {
        if (cum(c, k - 1, aire(ph[0])) + c[k - 1] * aire(ph[1]) >= Am - 1e-12 && k > 1) return { k, last: 1 };
        if (cum(c, k, aire(ph[0])) >= Am - 1e-12) return { k, last: 0 };
      }
      return { k: c.length, last: 0 };
    }
    // franchissements : depuis l'extrémité gauche (côté 0) ou droite (côté 1) de la travée i, distance à l'appui
    // jusqu'où l'enveloppe dépasse c
    function depuisAppui(env, i, c, cote) {
      const v = env[i], m = v.length, Li = L[i];
      const idx = cote === 0 ? [...Array(m).keys()] : [...Array(m).keys()].reverse();
      const dist = j => (cote === 0 ? SA[j] : 1 - SA[j]) * Li;
      if (!(v[idx[0]] > c)) return 0;
      for (let t = 1; t < m; t++) {
        const j = idx[t], jp = idx[t - 1];
        if (!(v[j] > c)) return dist(jp) + (dist(j) - dist(jp)) * (v[jp] - c) / (v[jp] - v[j]);
      }
      return Li;
    }
    function intervalle(env, i, c) {   // zone centrale où env > c (travée i), abscisses depuis l'appui gauche
      const v = env[i], Li = L[i]; let x1 = null, x2 = null;
      for (let j = 0; j < v.length; j++) if (v[j] > c) {
        if (x1 == null) x1 = j === 0 ? 0 : (SA[j - 1] + (SA[j] - SA[j - 1]) * (c - v[j - 1]) / (v[j] - v[j - 1])) * Li;
        x2 = j === v.length - 1 ? Li : (SA[j] + (SA[j + 1] - SA[j]) * (v[j] - c) / (v[j] - v[j + 1])) * Li;
      }
      return x1 == null ? null : [x1, x2];
    }
    // ---- arrêts par « épure à rampes » (constat 2026-11-10, 3826 LSA2 à ±0,05 m) : un fer de rang r n'est pleinement
    // efficace qu'à ls de son extrémité (résistance linéaire de 0 à l'extrémité à 1 à ls) ; la résistance cumulée
    // Ω(r−1) + Σ ΔΩ·rampe doit couvrir l'enveloppe décalée de 0,8 H (max sur ±0,8 H) ; Ω = colonnes de la gamme
    // (fers de construction compris). Rangs arrêtés par groupes (1)(2,3)(4,5)… (sup.) / (4,5)(6,7)… (inf.), position
    // commune minimale ; groupes traités du rang le plus élevé au plus bas.
    const RAMPE = !G.PSIDA_EPURE_LIN;
    const omegas = (gm, K, last) => { const c = gm.cols, o = [c[0].om]; for (let k = 1; k <= K; k++) o.push(k === K && last ? c[2 * (k - 1)].om : c[2 * k - 1].om); return o; };
    // envS : fonction u -> enveloppe décalée (u >= 0 distance depuis la zone pleine), Lu : longueur utile ; renvoie u_r
    function rampes(envS, Lu, om, lo, K, groups, lr0, ue0) {
      const lr = lr0 != null ? lr0 : G.PSIDA_LSR != null ? Math.max(1e-6, ls * G.PSIDA_LSR) : ls;   // diagnostic : longueur de rampe
      const du = 0.01, N = Math.max(2, Math.ceil(Lu / du)), U = Array.from({ length: N + 1 }, (_, i) => i * Lu / N), E = U.map(envS);
      const ue = Object.assign({}, ue0 || {});
      const ok = (g, x) => { const g0 = Math.min(...g); for (let i = 0; i <= N; i++) { let R = om[g0 - 1]; for (let q = g0; q <= K; q++) { const e = g.includes(q) ? x : ue[q]; R += (om[q] - om[q - 1]) * Math.min(1, Math.max(0, (e - U[i]) / lr)); } if (R < E[i] - 1e-9) return false; } return true; };
      for (const g of groups.slice().sort((a, b) => Math.max(...b) - Math.max(...a))) {
        let a = 0, b = Lu + ls; if (!ok(g, b)) { for (const q of g) ue[q] = b; continue; }
        for (let it = 0; it < 40; it++) { const mm = (a + b) / 2; if (ok(g, mm)) b = mm; else a = mm; }
        for (const q of g) ue[q] = b;
      }
      return ue;
    }
    // v12 (constat 3488, 3603, 3826, 0063, 3639, OA26, 3827, 3452) : chaque rang r a son arrêt théorique t_r = franchissement
    // (interpolation linéaire des sections) de Ω(r−1) par l'enveloppe décalée de 0,8 H, SANS rampe ; les rangs sont ensuite
    // regroupés côté par côté depuis le rang le plus bas : un groupe commence au rang s et englobe les rangs suivants tant que
    // t_s − t_q ≤ ls ; tous les fers du groupe s'arrêtent en t_s (position du rang le plus bas). Crochet PSIDA_EPV11 = 1 : ancien modèle.
    const V12 = RAMPE && !G.PSIDA_EPV11, R0 = 1e-6;
    const gth = G.PSIDA_GTH ? G.PSIDA_GTH * ph[0] : G.PSIDA_GTL ? G.PSIDA_GTL * ls : ls;
    const singles = (lo, K) => { const g = []; for (let q = lo; q <= K; q++) g.push([q]); return g; };
    const regroupe = (u, lo, K) => { const o = {}; let a = lo; while (a <= K) { let q = a; while (q + 1 <= K && u[a] - u[q + 1] <= gth + 1e-9) q++; for (let j = a; j <= q; j++) o[j] = u[a]; a = q + 1; } return o; };
    const grp = (lo, K) => { const V = G.PSIDA_GRP || 'A', g = []; let q = lo;
      if (V === 'S') { for (; q <= K; q++) g.push([q]); return g; }
      if (V === 'C') { let t = K; const h = []; while (t >= lo + (lo === 1 ? 1 : 0)) { h.unshift(t - 1 >= lo + (lo === 1 ? 1 : 0) ? [t - 1, t] : [t]); t -= 2; } if (lo === 1) h.unshift([1]); return h; }
      if (lo === 1) { g.push([1]); q = 2; } for (; q <= K; q += 2) g.push(q + 1 <= K ? [q, q + 1] : [q]);
      if (V === 'B' && g.length > 1 && g[g.length - 1].length === 1 && K > lo) { const z = g.pop(); g[g.length - 1].push(...z); }
      return g; };
    const envAt = (env0, i, isF) => { const fin = isF ? env0 : V12 && F.SAF && (env0 === F.sup.env ? F.sup.envF : env0 === F.inf.env ? F.inf.envF : null), env = fin || env0, S = fin ? F.SAF : SA;
      return x => { const v = env[i], Li = L[i], t = Math.min(Math.max(x / Li, 0), 1); for (let j = 1; j < v.length; j++) if (t <= S[j] + 1e-12) return v[j - 1] + (v[j] - v[j - 1]) * (t - S[j - 1]) / (S[j] - S[j - 1]); return v[v.length - 1]; }; };
    const winMax = (fn, a, b) => { let m = -Infinity; const N = Math.max(1, Math.ceil((b - a) / 0.01)); for (let i = 0; i <= N; i++) m = Math.max(m, fn(a + (b - a) * i / N)); return m; };
    const blocs = { sup: [], inf: [] };
    const fer = (nom, j, phi, nb, o, x, oStar, xStar, len) => ({ nom, j, phi, nb, o, x, oStar: !!oStar, xStar: !!xStar, len: len != null ? len : x - o });
    // --- fers principaux supérieurs sur appuis intermédiaires
    const LSA = {}, cap0S = cum(cS, 3, aire(ph[2]));
    for (let k = 1; k < n; k++) {
      // section maximale à couvrir : demi-travées contiguës à l'appui k (et non l'appui suivant : 3603 LSA2 6 rangs)
      let Am = 0; F.sup.env[k - 1].forEach((v, j) => { if (G.PSIDA_AM_ALL || SA[j] >= 0.5) Am = Math.max(Am, v); }); F.sup.env[k].forEach((v, j) => { if (G.PSIDA_AM_ALL || SA[j] <= 0.5) Am = Math.max(Am, v); });
      const nf = nbFers(cS, Am, F.sup.gamme), list = [];
      if (RAMPE) {
        const om = omegas(F.sup.gamme, nf.k, nf.last), gl = envAt(F.sup.env, k - 1), gr = envAt(F.sup.env, k), Ll = L[k - 1], Lr = L[k];
        const full = X => X < 0 ? gl(Ll + X) : gr(X);                         // X : abscisse depuis l'appui k
        // longueur utile : jusqu'au minimum de l'enveloppe dans la travée (au-delà : zone de l'appui suivant)
        const umin = (fn, Ls) => { let um = 0, vm = Infinity; for (let q = 0; q <= 400; q++) { const v = fn(Ls * q / 400); if (v < vm - 1e-12) { vm = v; um = Ls * q / 400; } } return um; };
        const LuR = umin(u => gr(u), Lr), LuL = umin(u => gl(Ll - u), Ll);
        const V12S = V12 && G.PSIDA_LSA12 !== 0;   // v18 : activé (dernier groupe prolongé à rampes, PSIDA_LSAL)   // appuis : regroupement v12 essayé (PSIDA_LSA12 = 1) — moins bon que les groupes à rampes (dernier groupe trop court)
        let uR = rampes(u => winMax(full, Math.max(-Ll, u - e), Math.min(LuR, u + e)), LuR, om, 1, nf.k, V12S ? singles(1, nf.k) : grp(1, nf.k), V12S ? R0 : null);
        let uL = rampes(u => winMax(full, Math.max(-LuL, -u - e), Math.min(Lr, -u + e)), LuL, om, 1, nf.k, V12S ? singles(1, nf.k) : grp(1, nf.k), V12S ? R0 : null);
        if (V12 && typeof G.PSIDA_DUMP === 'function') { const t = (lr0, gg) => [rampes(u => winMax(full, Math.max(-Ll, u - e), Math.min(LuR, u + e)), LuR, om, 1, nf.k, gg, lr0), rampes(u => winMax(full, Math.max(-LuL, -u - e), Math.min(Lr, -u + e)), LuL, om, 1, nf.k, gg, lr0)]; G.PSIDA_DUMP('LSA', k, { Ll, single: t(R0, singles(1, nf.k)), ramp: t(null, grp(1, nf.k)) }); }
        if (V12S) { uR = regroupe(uR, 1, nf.k); uL = regroupe(uL, 1, nf.k);
          // v18 : dernier groupe (fers les plus courts) prolongé par l'épure à rampes (ancrage ls), les autres groupes restant à t_s
          const LM = G.PSIDA_LSAL == null ? 1 : G.PSIDA_LSAL;
          if (LM) { const K = nf.k, fix = (u, envS, Lu) => { let s0 = K; while (s0 > 1 && Math.abs(u[s0 - 1] - u[K]) < 1e-9) s0--;
              const g = LM === 2 ? [K] : Array.from({ length: K - s0 + 1 }, (_, q) => s0 + q);
              const lr = G.PSIDA_LSALR === 1 ? (nf.last ? ph[1] : ph[0]) / ph[0] * ls : ls;
              const w = rampes(envS, Lu, om, 1, K, [g], lr)[K]; if (w > u[K]) for (let q = s0; q <= K; q++) u[q] = w; };
            fix(uR, u => winMax(full, Math.max(-Ll, u - e), Math.min(LuR, u + e)), LuR); fix(uL, u => winMax(full, Math.max(-LuL, -u - e), Math.min(Lr, -u + e)), LuL); } }
        for (let j = 1; j <= nf.k; j++) { const phi = j === nf.k && nf.last ? ph[1] : ph[0]; list.push(fer('LSA' + (k + 1), j, phi, cS[j - 1], Ll - uL[j], uR[j], false, false, uL[j] + uR[j])); }
        LSA[k] = list; continue;
      }
      for (let j = 1; j <= nf.k; j++) {
        const c = j === 1 ? cap0S : cum(cS, j - 1, aire(ph[0]));
        const dl = depuisAppui(F.sup.env, k - 1, c, 1) + e, dr = depuisAppui(F.sup.env, k, c, 0) + e;
        const phi = j === nf.k && nf.last ? ph[1] : ph[0];
        list.push(fer('LSA' + (k + 1), j, phi, cS[j - 1], L[k - 1] - dl, dr, false, false, dl + dr));
      }
      LSA[k] = list;
    }
    // --- fers principaux inférieurs en travée (fers 4.. ; fers 1–3 après les fers de construction d'appui)
    const LIT = {}, cap0I = cum(cI, 3, aire(ph[2]));
    const LIAext = {};   // extension des fers de construction inférieurs d'appui (côté gauche / droit)
    for (let k = 1; k < n; k++) LIAext[k] = [L[k - 1] - (intervalle(F.inf.env, k - 1, cap0I) || [0, 0])[1] + e, (intervalle(F.inf.env, k, cap0I) || [L[k], L[k]])[0] + e];
    // épure à rampes des fers inférieurs de travée : rangs 1–3 (groupe filant, base = fers de construction d'appui φ3)
    // puis (4,5)(6,7)… ; les fers de construction inférieurs d'appui prolongent les rangs 1–3 d'une longueur ls.
    const RI = {};
    if (RAMPE) for (let i = 0; i < n; i++) {
      let Am = 0; for (const v of F.inf.env[i]) Am = Math.max(Am, v);
      const nf = nbFers(cI, Am, F.inf.gamme), om = omegas(F.inf.gamme, nf.k, nf.last), g = envAt(F.inf.env, i), Li = L[i];
      let tp = 0, vm = -1; for (let q = 0; q <= 400; q++) { const x = Li * q / 400, v = g(x); if (v > vm) { vm = v; tp = x; } }
      const gg = G.PSIDA_LIT13 === 0 ? grp(4, nf.k) : [[1, 2, 3].filter(q => q <= nf.k)].concat(grp(4, nf.k)), lo = G.PSIDA_LIT13 === 0 ? 4 : 1;
      if (V12) {
        // longueur utile prolongée au-delà des appuis (t_r peut dépasser l'appui : rang 1 d'about, 3826 −0,41)
        const g0 = x => (x < -1e-9 || x > Li + 1e-9) ? 0 : g(x);   // hors travée : enveloppe nulle (3607–3610 LIT3 : env(0) > Ω0)
        const ext = 3 * e + ls, tL = rampes(u => winMax(g0, tp - u - e, tp - u + e), tp + ext, om, 1, nf.k, singles(1, nf.k), R0);
        const tR = rampes(u => winMax(g0, tp + u - e, tp + u + e), Li - tp + ext, om, 1, nf.k, singles(1, nf.k), R0);
        // v18 : arrêt théorique du rang 1 (seuil Ω0 = fers de construction) sur l'enveloppe « adoucie » aux sections internes
        // non imprimées (moyenne de la valeur calculée et de la corde des sections voisines, F.inf.envA) ; crochet PSIDA_R1AVG = 1 : sans
        if (F.inf.envA && G.PSIDA_R1AVG !== 1) { const ga = envAt(F.inf.envA, i, true), ga0 = x => (x < -1e-9 || x > Li + 1e-9) ? 0 : ga(x);
          tR[1] = rampes(u => winMax(ga0, tp + u - e, tp + u + e), Li - tp + ext, om, 1, nf.k, singles(1, nf.k), R0)[1];
          tL[1] = rampes(u => winMax(ga0, tp - u - e, tp - u + e), tp + ext, om, 1, nf.k, singles(1, nf.k), R0)[1]; }
        const uL = regroupe(tL, 1, nf.k), uR = regroupe(tR, 1, nf.k);
        // v18 : dernier groupe (rangs les plus élevés, fers les plus courts près du maximum) prolongé par l'épure à rampes,
        // comme pour les LSA (crochet PSIDA_LITL = 0 : t_s sans rampe)
        if (G.PSIDA_LITL !== 0) { const K = nf.k, fix = (u, envS, Lu) => { let s0 = K; while (s0 > 1 && Math.abs(u[s0 - 1] - u[K]) < 1e-9) s0--; if (s0 <= 1) return;
            const w = rampes(envS, Lu, om, 1, K, [Array.from({ length: K - s0 + 1 }, (_, q) => s0 + q)], ls)[K]; if (w > u[K]) for (let q = s0; q <= K; q++) u[q] = w; };
          fix(uR, u => winMax(g0, tp + u - e, tp + u + e), Li - tp + ext); fix(uL, u => winMax(g0, tp - u - e, tp - u + e), tp + ext); }
        RI[i] = { i, tp, uL, uR }; continue;
      }
      const uL = rampes(u => winMax(g, Math.max(0, tp - u - e), Math.min(Li, tp - u + e)), tp, om, lo, nf.k, gg);
      const uR = rampes(u => winMax(g, Math.max(0, tp + u - e), Math.min(Li, tp + u + e)), Li - tp, om, lo, nf.k, gg);
      RI[i] = { i, tp, uL, uR };
    }
    if (RAMPE && G.PSIDA_LIT13 !== 0) for (let k = 1; k < n; k++) LIAext[k] = [L[k - 1] - (RI[k - 1].tp + RI[k - 1].uR[1]) + ls, RI[k].tp - RI[k].uL[1] + ls];
    for (let i = 0; i < n; i++) {
      let Am = 0; for (const v of F.inf.env[i]) Am = Math.max(Am, v);
      const nf = nbFers(cI, Am, F.inf.gamme), list = [];
      for (let j = 1; j <= nf.k; j++) {
        const phi = j === nf.k && nf.last ? ph[1] : ph[0];
        if (V12) {
          // rangs 1–3 côté about : ancrés au bout de la dalle (retour 12 φ1) si leur arrêt tombe avant l'appui d'extrémité
          const R = RI[i], bout = -(ab - r._A11.ENROBI) - 12 * ph[0];
          let o = R.tp - R.uL[j], x = R.tp + R.uR[j], os = false, xs = false;
          if (i === 0 && j <= 3 && o < 0) { o = bout; os = true; }
          if (i === n - 1 && j <= 3 && x > L[i]) { x = L[i] - bout; xs = true; }
          list.push(fer('LIT' + (i + 1), j, phi, cI[j - 1], o, x, os, xs));
        } else if (j <= 3) {
          // fers filants : recouvrement ls avec les fers de construction inférieurs d'appui ; about : extrémité de la
          // dalle moins l'enrobage, plus un retour de 12 φ1 (constat 3826, 3603, 3452…)
          const bout = -(ab - r._A11.ENROBI) - 12 * ph[0];
          const o = i === 0 ? bout : LIAext[i][1] - ls, x = i === n - 1 ? L[i] - bout : L[i] - LIAext[i + 1][0] + ls;
          list.push(fer('LIT' + (i + 1), j, phi, cI[j - 1], o, x, i === 0, i === n - 1));
        } else if (RAMPE) {
          const R = RI[i]; list.push(fer('LIT' + (i + 1), j, phi, cI[j - 1], R.tp - R.uL[j], R.tp + R.uR[j]));
        } else {
          const iv = intervalle(F.inf.env, i, cum(cI, j - 1, aire(ph[0]))) || [L[i] / 2, L[i] / 2];
          list.push(fer('LIT' + (i + 1), j, phi, cI[j - 1], iv[0] - e, iv[1] + e));
        }
      }
      LIT[i] = list;
    }
    // --- fers de construction
    const LST = {}, LIA = {};
    for (let i = 0; i < n; i++) {
      const list = [];
      // fers 1–3 : recouvrement ls avec le fer principal de même rang sur chaque appui ; about : bout de dalle − enrobage
      const bout = -(ab - r._A11.ENROBS);
      for (let j = 1; j <= 3; j++) {
        const bl = i === 0 ? null : LSA[i][Math.min(j, LSA[i].length) - 1], br = i === n - 1 ? null : LSA[i + 1][Math.min(j, LSA[i + 1].length) - 1];
        const o = i === 0 ? bout : bl.x - ls, x = i === n - 1 ? L[i] - bout : br.o + ls;
        list.push(fer('LST' + (i + 1), j, ph[2], cS[j - 1], o, x, i === 0, i === n - 1));
      }
      for (const b of LIT[i]) if (b.j > 3) list.push(fer('LST' + (i + 1), b.j, ph[2], cI[b.j - 1], b.o, b.x, b.oStar, b.xStar, b.len));
      LST[i] = list;
    }
    for (let k = 1; k < n; k++) {
      const list = [], [gl, dr] = LIAext[k];
      for (let j = 1; j <= 3; j++) {
        if (V12) { const bl = LIT[k - 1][Math.min(j, LIT[k - 1].length) - 1], br = LIT[k][Math.min(j, LIT[k].length) - 1];
          const o = bl.x - ls, x = br.o + ls; list.push(fer('LIA' + (k + 1), j, ph[2], cI[j - 1], o, x, false, false, L[k - 1] - o + x)); continue; }
        list.push(fer('LIA' + (k + 1), j, ph[2], cI[j - 1], L[k - 1] - gl, dr, false, false, gl + dr));
      }
      for (const b of LSA[k]) if (b.j > 3) list.push(fer('LIA' + (k + 1), b.j, ph[2], cI[b.j - 1], b.o, b.x, false, false, b.len));
      LIA[k] = list;
    }
    // v18 (constat 3603 rang 4 : LST1 4 → 9,84, LIA2 4 ← 9,85 ; LIT1 4 finit en 10,31, LSA2 4 commence en 9,37) : quand le fer
    // inférieur de travée et le fer supérieur d'appui de même rang (≥ 4) se chevauchent, les fers de construction qui les
    // doublent (LST / LIA) se rejoignent au milieu du chevauchement. NON ACTIVÉ (−24 / −7 valeurs sur l'ensemble) : crochet PSIDA_CMID = 1 pour l'essayer.
    if (V12 && G.PSIDA_CMID === 1) for (let k = 1; k < n; k++) for (const a of LIA[k]) { if (a.j <= 3) continue;
      const tl = LST[k - 1].find(b => b.j === a.j), tr = LST[k].find(b => b.j === a.j);
      if (tl && !tl.xStar && tl.x > a.o) { const mm = (tl.x + a.o) / 2; tl.x = mm; tl.len = tl.x - tl.o; a.o = mm; }
      if (tr && !tr.oStar && tr.o < a.x) { const mm = (tr.o + a.x) / 2; tr.o = mm; tr.len = tr.x - tr.o; a.x = mm; }
      a.len = L[k - 1] - a.o + a.x; }
    for (let i = 0; i < n; i++) {
      blocs.sup.push({ titre: i === 0 ? 'TRAVEE 1' : 'APPUI ' + (i + 1) + '  TRAVEE ' + (i + 1), groupes: (i === 0 ? [] : [{ lab: 'APPUI ' + (i + 1), fers: LSA[i], princ: true }]).concat([{ lab: 'TRAVEE ' + (i + 1), fers: LST[i], princ: false }]) });
      blocs.inf.push({ titre: i === 0 ? 'TRAVEE 1' : 'APPUI ' + (i + 1) + '  TRAVEE ' + (i + 1), groupes: (i === 0 ? [] : [{ lab: 'APPUI ' + (i + 1), fers: LIA[i], princ: false }]).concat([{ lab: 'TRAVEE ' + (i + 1), fers: LIT[i], princ: true }]) });
    }
    // poids (t) : 7,85 t/m3
    for (const face of ['sup', 'inf']) for (const bl of blocs[face]) for (const g of bl.groupes) {
      const w = phi => g.fers.filter(b => b.phi === phi).reduce((p, b) => p + b.nb * b.len * aire(phi) * 7.85, 0);
      g.poids = g.princ ? [w(ph[0]), w(ph[1])] : [g.fers.reduce((p, b) => p + b.nb * b.len * aire(b.phi) * 7.85, 0)];
    }
    return blocs;
  }
  const RES = 1;

  // ------------------------------------------------------------------ rendu
  function renderFer(m, r, T) {
    const { page, f, fx, pad } = T, F = r.fer, ph = r.mat.phi;
    if (!F || !F.long) return;
    renderAppareils(m, r, T);
    const L = F.long, n = r.n;
    const nP = sym(r.L) ? Math.ceil(n / 2) : n;
    const sec = r.moments[0].map(s => s.a);
    for (const [cle, nom] of [['sup', 'SUPERIEUR'], ['inf', 'INFERIEUR']]) {
      const N = L[cle];
      const pl = [
        ' '.repeat(109) + 'HAUTEUR UTILE =' + f(N.d, 6, 3),
        ' '.repeat(61) + 'FERRAILLAGE ' + nom,
        ' '.repeat(69) + '*     *                             LARGEUR DE CALCUL =' + f(N.b, 6, 3),
        ' '.repeat(72) + '*', '',
        ' '.repeat(43) + "ENVELOPPES DES SECTIONS D'ACIER DES DIFFERENTES TRAVEES ET", '',
        ' '.repeat(30) + "GAMME DES SECTIONS D'ACIER COMPTE TENU DES CARACTERISTIQUES DE FERRAILLAGE RETENU",
        ' '.repeat(69) + '*     *', ' '.repeat(72) + '*', '',
        ' '.repeat(43) + "ENVELOPPES DES SECTIONS D'ACIER DES DIFFERENTES TRAVEES", '',
        ' '.repeat(30) + 'ABSCISSE    TRAVEE 1    TRAVEE 2    TRAVEE 3    TRAVEE 4    TRAVEE 5    TRAVEE 6', ''];
      sec.forEach((a, j) => pl.push(' '.repeat(30) + fx(a, 2) + 'L   ' + N.env.slice(0, nP).map(t => f(t[j], 12, 4)).join('')));
      pl.push('', '', '', ' '.repeat(30) + "GAMME DES SECTIONS D'ACIER COMPTE TENU DES CARACTERISTIQUES DE FERRAILLAGE RETENU", '', '', '');
      const C = N.gamme.cols;
      pl.push('PHI1(' + fx(ph[0], 3) + ')' + C.map(c => pad(c.p1, 6)).join(''), '');
      pl.push('PHI2(' + fx(ph[1], 3) + ')' + C.map(c => pad(c.p2, 6)).join(''), '');
      pl.push('PHI3(' + fx(ph[2], 3) + ')' + C.map(c => pad(c.p3, 6)).join(''), '');
      pl.push('OMEGA      ' + C.map(c => ' ' + fx(c.om, 4).replace(/^0/, '')).join(''));
      page('FERRAILLAGE LONGITUDINAL RETENU', pl, { sub: '                           *     *', sub2: '                            *' });
    }
    const pr = ['', '           RAPPEL DES CARACTERISTIQUES DU FERRAILLAGE LONGITUDINAL', '',
      '              LE FERRAILLAGE LONGITUDINAL EST CONSTITUE DE GROUPES COMPORTANT AU MAXIMUM' + pad(L.N1, 3) + ' FERS DE DIAMETRE ' + fx(ph[0], 3),
      '              AUX EXTREMA DE LA COURBE ENVELOPPE ON CHOISIT AUX MIEUX ENTRE LES DIAMETRES ' + fx(ph[0], 3) + ' ET ' + fx(ph[1], 3) + ' POUR LE FER LE PLUS COURT.',
      "              L'ESPACEMENT DE CES GROUPES EST ESPAC1 =" + fx(L.s, 3) + ' M. LA LONGUEUR DE RECOUVREMENT DES BARRES EST ' + fx(L.ls, 2) + ' M.',
      "              3 DE CES GROUPES SONT CONSIDERES ENSEMBLE POUR REALISER L'EPURE D'ARRETS DE BARRES",
      '              CES   3 GROUPES CONSTITUENT UNE POUTRE ELEMENTAIRE DANS LE SENS TRANSVERSAL REPETEE UN NOMBRE ENTIER OU FRACTIONNAIRE',
      '              DE FOIS SELON LA LARGEUR DE LA DALLE.',
      '              LES FERS LONGITUDINAUX DE CONSTRUCTION SONT DE DIAMETRE' + fx(ph[2], 3),
      "            * LES ABSCISSES SONT COMPTEES A PARTIR DE L'APPUI IMMEDIATEMENT A GAUCHE EXCEPTION FAITE DES ABSCISSES MARQUEES D'UN",
      "              ASTERISQUE QUI CORRESPONDENT A DES FERS ANCRES A L'EXTERIEUR DE LA TRAVEE"];
    // épure d'arrêt des barres : une page par bloc ; le premier bloc supérieur est sur la page de rappel
    const E = L.epure; if (!E) { page('FERRAILLAGE LONGITUDINAL RETENU', pr, { sub: '                           *     *', sub2: '                            *' }); renderTransv(m, r, T); renderEtriers(m, r, T); return; }
    const so = (v, st) => st ? '        *' + f(v, 7, 2) : f(v, 16, 2);
    let first = true;
    for (const [face, nom] of [['sup', 'SUPERIEUR'], ['inf', 'INFERIEUR']]) for (const bl of E[face]) {
      const pl = first ? pr.concat(['', ' '.repeat(69) + '*     *', ' '.repeat(72) + '*', '']) : [];
      const t = bl.titre.startsWith('TRAVEE') ? (face === 'sup' ? 'FERRAILLAGE SUPERIEUR  ' : 'FERRAILLAGE INFERIEUR          ') + bl.titre
        : (face === 'sup' ? 'FERRAILLAGE SUPERIEUR- ' : 'FERRAILLAGE INFERIEUR-') + bl.titre;
      pl.push(' '.repeat(first ? 56 : 52) + t, ' '.repeat(69) + '*     *', ' '.repeat(72) + '*', '',
        '                            NUMEROTATION        DIAMETRE        NOMBRE        ORIGINE        EXTREMITE        LONGUEUR        POIDS',
        '                             DES ACIERS                                                                                     PARTIEL', '');
      for (const g of bl.groupes) g.fers.forEach((b, q) => {
        let l = (q === 0 ? '             ' + g.lab.padEnd(18) : ' '.repeat(31)) + b.nom + pad(b.j, 3) + f(b.phi, 16, 3) + pad(b.nb, 14) + so(b.o, b.oStar) + so(b.x, b.xStar) + f(b.len, 16, 2);
        const nf = g.fers.length;
        if (g.princ && q === nf - 2) l += f(g.poids[0], 14, 3);
        if (g.princ && q === nf - 1) l += f(nf === 1 ? g.poids[0] : g.poids[1], 14, 3);
        if (!g.princ && q === nf - 1) l += f(g.poids[0], 14, 3);
        pl.push(l, '');
      });
      page('FERRAILLAGE LONGITUDINAL RETENU', pl, { sub: '                           *     *', sub2: '                            *' });
      first = false;
    }
    renderTransv(m, r, T);
    renderPropose(m, r, T);
    renderEtriers(m, r, T);
  }
  function renderAppareils(m, r, T) {
    const { page, f, pad } = T, AP = r.fer && r.fer.appareils, A13 = m.lignes.A13 || {};
    if (!AP) return;
    const row = (lab, fn, w, d) => lab + AP.map(a => d == null ? pad(fn(a), w) : f(fn(a), w, d)).join('');
    const pl = ['', ' '.repeat(45) + AP.map((_, k) => pad('APPUI ' + (k + 1), 11)).join(''),
      row("           * TYPE DE L'APPAREIL D'APPUI   ", a => a.typ, 11),
      row("             NOMBRE D'APPAREILS D'APPUI   ", a => a.nap, 11),
      row("             ESPACEMENT D'AXE EN AXE      ", a => a.esp, 11, 3),
      row('             DIMENSIONS EN PLAN  LARGEUR  ', a => a.larg, 11, 3),
      row('                                 LONGUEUR ', a => a.long, 11, 3),
      "                       *  0  SYMBOLISE UNE ARTICULATION PAR SECTION REDUITE DE BETON(ARTICULATION FREYSSINET)",
      "                          1  SYMBOLISE UNE PLAQUE D'APPUI SEMI-MOBILE A BASE D'ELASTOMERES (APPUI NEOPRENE)",
      "                          2  SYMBOLISE TOUT AUTRE TYPE D'APPUI QUE L'UTILISATEUR DEVRA DIMENSIONNER",
      ' '.repeat(66) + '*', ' '.repeat(65) + '* *',
      "             COEFFICIENTS D'INEGALITE DE REPARTITION DE LA REACTION D'APPUI ENTRE APPAREILS D'APPUI D'UNE MEME LIGNE D'APPUI"];
    const noms = { CP: 'CHARGE PERMANENTE', A: 'CHARGE A', BC: 'CHARGE BC' };
    for (const c of AP[0].cas) pl.push(row('             ' + (noms[c] || (/^B/.test(c) ? 'CHARGE ' + c : c)).padEnd(29), a => a.coef[c], 11, 3));
    pl.push(' '.repeat(66) + '*', ' '.repeat(65) + '* *', ' '.repeat(42) + "REACTION D'APPUI EXTREME  POUR UN APPAREIL D'APPUI",
      row('             A VIDE (MAX.)                ', a => a.videMax, 11, 2), row('             A VIDE (MIN.)                ', a => a.videMin, 11, 2),
      row('             EN CHARGE (MAX.)             ', a => a.chMax, 11, 2), row('             EN CHARGE (MIN.)             ', a => a.chMin, 11, 2),
      ' '.repeat(66) + '*', ' '.repeat(65) + '* *', ' '.repeat(37) + "COMPRESSIONS MOYENNES DES APPAREILS D'APPUI (ADMISSIBLES ET ATTEINTES)",
      '                                1       0                     ATTEINTES',
      '              MINIMALES     ' + f(A13.COMPRENV || 250, 9, 2) + f(A13.COMPREBV || 2000, 8, 2) + AP.map((a, k) => f(a.cMin, k ? 11 : 7, 2)).join(''),
      '              MAXIMALES     ' + f(A13.COMPRENS || 1500, 9, 2) + f(A13.COMPREBS || 3500, 8, 2) + AP.map((a, k) => f(a.cMax, k ? 11 : 7, 2)).join(''));
    pl.push(' '.repeat(66) + '*', ' '.repeat(65) + '* *',
      "                          FERRAILLAGE DE CALCUL DES CHEVETRES    (PARALLELEMENT A LA DIRECTION DES LIGNES D'APPUI )",
      '             LARGEUR DU CHEVETRE' + AP.map((a, k) => f(a.ech, k ? 11 : 19, 2)).join(''), '',
      '             MOMENT APRES PONDERATION' + AP.map((a, k) => f(a.mch, k ? 11 : 14, 2)).join(''),
      '                         (EN TM/M )',
      '             SECTION DE CALCUL DES FERS' + AP.map((a, k) => f(a.ach, k ? 11 : 13, 6)).join(''),
      '              (EN M**2 PAR ML LONGITUDINAL)');
    // v19 : avertissement imprimé par SETRA en fin de dimensionnement des appareils (page sans en-tête, tous les passages du corpus)
    if (!G.PSIDA_NONOTAAP) pl.push('', '', '',
      "    NOTA : LORSQUE LES APPUIS NE SONT PAS EGALEMENT ESPACES OU LORSQUE LES APPAREILS D'APPUI LATERAUX D'UNE MEME LIGNE", '',
      '           SONT EN FORT RETRAIT PAR RAPPORT AUX BORDS LIBRES LES RESULTATS DE LA NOTE DE CALCUL AUTOMATIQUE DOIVENT', '',
      "           ETRE CORRIGES MANUELLEMENT SELON LES INDICATIONS DE L'ANNEXE 4 DU DOCUMENT PSIDP-EL EDITION OCTOBRE 85", '',
      '         IL EST EGALEMENT RECOMMANDE DE SE REPORTER A CE DOCUMENT POUR APPORTER DES RENFORCEMENTS', '',
      '         AU FERRAILLAGE LONGITUDINAL AU VOISINAGE DES PILES LORSQUE LES APPUIS SONT TROP ESPACES');
    page("DIMENSIONNEMENT DES APPAREILS D'APPUI", pl, { sub: '                        *   *', sub2: "                         GEOMETRIE DES APPAREILS D'APPUI" });
  }

  // ------------------------------------------------------------------ ferraillage transversal inférieur (mi-travée)
  // Moment longitudinal principal = M max travée / E DALLE ; moments transversaux = max des fibres (My ELS / ELU max) ;
  // A1 = 1,2 AS(ν), A2 = 1,2 AU(ν) ; AS, AU avec ν = 0 ; d = H − 0,04 ; AP = 5·10⁻⁴ H ;
  // ANF = ftj H² / (6 × 0,9 d fe) ; A = sup(inf(sup(A1, A2), ANF), AS, AU, AP), A1…AU calculés avec le MOMENT DE CALCUL
  // (My + |T|)/sin² φ (torsion des biais, cf. NOTES v9 ; crochet PSIDA_NOTORS = 1 : ancien modèle sans torsion).
  function transversal(r) {
    if (!r.flexT || !r.flexT[0].my) return null;
    const P = G.PSIDA, mat = r.mat, H = r.section.H, d = H - 0.04, fe = mat.fe[2] || mat.fe[0];
    const mt = Object.assign({}, mat, { fe: [fe, fe, fe, fe] });
    const ss = mat.fiss >= 2 && mat.sigS ? (mat.sigS[2] || mat.sigS[0]) : null;
    const nu = mat.poisson || 0;
    return r.flexT.map((F, sp) => {
      const mom = r.moments[sp];
      const ml = { els: Math.max(...mom.map(x => x.els.max)) / r.section.Eeq, elu: Math.max(...mom.map(x => x.elu.max)) / r.section.Eeq };
      const my = { els: Math.max(...F.my.map(y => y.els.max)), elu: Math.max(...F.my.map(y => y.elu.max)) };
      const my0 = F.my0 ? { els: Math.max(...F.my0.map(y => y.els.max)), elu: Math.max(...F.my0.map(y => y.elu.max)) } : my;
      // Torsion des biais (règle v9, exacte sur 3603–3609) : moments principaux M1 = ml (direction à γ = 100 − ψ de l'axe),
      // M2 = my ; tenseur dans le repère de l'axe (Mx, My, Mxy) ; moment de torsion « dans le béton » sur la facette
      // parallèle aux lignes d'appui (angle φ) : T = Mxy sin φ + My cos φ ; τ = 6 T / H² ; moment de calcul des fers
      // parallèles aux lignes d'appui = (My + |T|) / sin² φ.
      const gr = Math.PI / 200, phi = (r.biais || 100) * gr, gam = (100 - (F.psi != null ? F.psi : (r.biais || 100))) * gr;
      const sp_ = Math.sin(phi), cp = Math.abs(Math.cos(phi)) < 1e-12 ? 0 : Math.cos(phi), sg = Math.sin(gam), cg = Math.cos(gam);
      const tors = (M1, M2) => {
        const Myy = M1 * sg * sg + M2 * cg * cg, Mxy = (M1 - M2) * sg * cg, T = Mxy * sp_ + Myy * cp;
        return { T: Math.abs(T), tau: 6 * Math.abs(T) / (H * H), Mc: cp === 0 && sg === 0 ? M2 : (Myy + Math.abs(T)) / (sp_ * sp_) };
      };
      const tq = { els: tors(ml.els, my.els), elu: tors(ml.elu, my.elu) }, tq0 = { els: tors(ml.els, my0.els), elu: tors(ml.elu, my0.elu) };
      const mc = G.PSIDA_NOTORS ? my : { els: tq.els.Mc, elu: tq.elu.Mc }, mc0 = G.PSIDA_NOTORS ? my0 : { els: tq0.els.Mc, elu: tq0.elu.Mc };
      const asS = M => (ss && M > 0 ? P.asELS(M, 1, d, ss).As : 0), asU = M => P.asELU(M, 1, d, mt);
      const A1 = 1.2 * asS(mc.els), A2 = 1.2 * asU(mc.elu), AS = asS(mc0.els), AU = asU(mc0.elu);
      const AP = 5e-4 * H, ANF = mat.ftj * H * H / (6 * 0.9 * d * fe);
      const A = Math.max(Math.min(Math.max(A1, A2), ANF), AS, AU, AP);
      // couture des scellements droits (constat exact sur 9 passages) : 4 φ1 τs / fe − 5 φ4², τs = 0,6 × 1,5² ftj
      const ph = mat.phi, couture = Math.max(0, 4 * ph[0] * 0.6 * 2.25 * mat.ftj / (mat.fe[0] || fe) - 5 * ph[3] * ph[3]);
      return { nu, ml, my, my0, tq, tq0, mc, mc0, A1, A2, AS, AU, AP, ANF, A, couture, Amin: Math.max(A, couture), d };
    });
  }
  function renderTransv(m, r, T) {
    const { page, f, fx } = T, X = r.fer && r.fer.transv;
    if (!X) return;
    const nu = X[0].nu, two = nu !== 0, row = (lab, fn, w, dd) => { lab = lab.replace(/\s+$/, w === 9 ? ' ' : ''); const v0 = fx(fn(X[0]), dd); const end = w === 9 ? lab.length + 9 : (dd === 6 ? 55 : 52); return lab + ' '.repeat(Math.max(1, end - lab.length - v0.length)) + v0 + X.slice(1).map(x => f(fn(x), 14, dd)).join(''); };
    const tr = ' '.repeat(44) + X.map((_, i) => 'TRAVEE ' + (i + 1)).join('      ');
    const P = [
      '                    ELEMENTS DE CALCUL DU FERRAILLAGE TRANSVERSAL INFERIEUR EN SECTION MEDIANE DE CHAQUE TRAVEE',
      '                                                               *   *', '                                                                 *', tr,
      ' MOMENT LONGITUDINAL PRINCIPAL PONDERE (TM/M)',
      row('        ELS                            ', x => x.ml.els, 14, 2), row('        ELU                            ', x => x.ml.elu, 14, 2),
      ' MOMENT TRANSVERSAL PRINCIPAL PONDERE (TM/M)'];
    const lnu = (e, v) => `        ${e} AVEC POISSON = ${f(v, 4, 2)}           `;
    const both = (fn) => { const o = []; for (const e of ['ELS', 'ELU']) { o.push(row(lnu(e, nu), x => fn(x, e, false), 14, 2)); if (two) o.push(row(lnu(e, 0), x => fn(x, e, true), 14, 2)); } return o; };
    P.push(...both((x, e, z) => (z ? x.my0 : x.my)[e.toLowerCase()]));
    P.push(row(' BIAIS GEOMETRIQUE (GRADES)             ', () => r.biais, 14, 2), row(' BIAIS MECANIQUE (GRADES)               ', (x) => r.flexT[X.indexOf(x)].psi, 14, 2),
      ' MOMENT DE TORSION DANS LE BETON (TM/M)', ...both((x, e, z) => (z ? x.tq0 : x.tq)[e.toLowerCase()].T), ' CONTRAINTE DE CISAILLEMENT SIMPLE (T/M2)', ' DU BETON PAR TORSION', ...both((x, e, z) => (z ? x.tq0 : x.tq)[e.toLowerCase()].tau),
      "             EVALUATION DES SECTIONS D'ACIER  DU FERRAILLAGE TRANSVERSAL INFERIEUR EN SECTION MEDIANE DE CHAQUE TRAVEE",
      "                                 (FERRAILLAGE TRANSVERSAL DISPOSE PARALLELEMENT AUX LIGNES D'APPUI)",
      '                                                               *   *                              HAUTEUR UTILE = ' + f(X[0].d, 6, 2) + ' M',
      '                                                                 *', tr,
      ` CALCUL ELS AVEC POISSON = ${f(nu, 5, 2)}`, row('        MOMEMT (TM/M)                  ', x => x.mc.els, 14, 2), row("        1.2*(SECTION  D'ACIER ) :         A1 =", x => x.A1, 9, 6),
      ` CALCUL ELU AVEC POISSON = ${f(nu, 5, 2)}`, row('        MOMEMT (TM/M)                  ', x => x.mc.elu, 14, 2), row("        1.2*(SECTION  D'ACIER ) :         A2 =", x => x.A2, 9, 6),
      ` CALCUL ELS AVEC POISSON = ${f(0, 5, 2)}`, row('        MOMEMT (TM/M)                  ', x => x.mc0.els, 14, 2), row("        SECTION  D'ACIER :                AS =", x => x.AS, 9, 6),
      ` CALCUL ELU AVEC POISSON = ${f(0, 5, 2)}`, row('        MOMEMT (TM/M)                  ', x => x.mc0.elu, 14, 2), row("        SECTION  D'ACIER :                AU =", x => x.AU, 9, 6),
      row(' ARMATURE DE PEAU  :                      AP =', x => x.AP, 9, 6), row(' CONDITION DE NON-FRAGILITE :             ANF=', x => x.ANF, 9, 6),
      ' SECTION DE CALCUL DU FERRAILLAGE', row(' TRANSVERSAL INFERIEUR (M2/ML) :          A  =', x => x.A, 9, 6),
      ' < A=SUP(INF(SUP(A1,A2),ANF),AS,AU,AP) >', '   ***********************************', ' SECTION MINIMALE DU FERRAILLAGE', ' TRANSVERSAL (M2/ML)',
      row(' (COUTURE DES SCELLEMENTS DROITS) :       ', x => x.couture, 14, 6), row(' SECTION MINIMALE A METTRE EN PLACE (M2/ML)', x => x.Amin, 14, 6), ' *******************************************');
    page('', P);
  }

  // ------------------------------------------------------------------ FERRAILLAGE TRANSVERSAL PROPOSE (cf. NOTES.md v4/v5)
  // Zones par appui : 1G/1D = demi-chevêtre (culée : côté about = ABOUT, côté travée = e − ABOUT), section = section de
  // calcul du chevêtre ; 2G/2D = zone contiguë de longueur e, section / 3 (piles ; culées aussi en fissuration peu
  // préjudiciable) ; travée = reste de la portée, section minimale à mettre en place, n = ⌈plage/s⌉, s = plage/n.
  // Espacement des zones d'appui = aire (moyenne si alternés) / A tronqué au pas de 0,005. Diamètre : premier de la
  // suite PHI3, PHI2/PHI3 ALT, PHI2, PHI1/PHI2 ALT, PHI1 donnant s ≥ 0,10 (en fissuration peu préjudiciable on part
  // de PHI2 ; face sup. en travée = PHI3). Fissuration préjudiciable : s ≤ 0,325 (3488). Longueurs = (W − 0,06)/sin ψ et
  // (E1 − 0,06)/sin ψ ; poids = Σ n × L × masse linéique (barres alternées : n/2 par diamètre).
  const OPTS = [[2], [1, 2], [1], [0, 1], [0]];
  const LAB = o => o ? (o.length === 2 ? 'PHI' + (o[0] + 1) + ' PHI' + (o[1] + 1) + '  ALT' : 'PHI' + (o[0] + 1)) : '';
  function propose(r) {
    const AP = r.fer.appareils, X = r.fer.transv;
    if (!AP || !X || !r._A7) return null;
    const ph = r.mat.phi, n = r.n, famA = !(r.mat.fiss >= 2), cap = famA ? Infinity : 0.325, about = r.about || 0;
    const sn = Math.sin((r.biais || 100) * PI / 200);
    const Ls = (r.largeurTotale - 0.06) / sn, Li = (r._A7.EDALLE1 - 0.06) / sn;
    const ar = o => o.reduce((a, k) => a + aire(ph[k]), 0) / o.length;
    const choose = (A, k0) => { for (let k = k0; k < OPTS.length; k++) if (ar(OPTS[k]) / A >= 0.1 - 1e-9) return OPTS[k]; return OPTS[OPTS.length - 1]; };
    const tr5 = v => Math.floor(v / 0.005 + 1e-6) * 0.005;
    const total = [0, 0, 0];
    // v20 : longueur des aciers inférieurs TB (tête-bêche) = E1/(2 sin ψ) + 3 E1/8 − 0,03 (exacte sur 3603–3610 et la notice O001 :
    // 3,91/3,91/3,94/3,97 pour E1 4,50 et ψ 100/95/90/85 ; 6,09/6,11/6,14/6,19 pour E1 7,00 ; 6,82 pour E1 7,60, ψ 80) ; crochet PSIDA_TBL = 0 : pleine
    const E1 = r._A7.EDALLE1, LiTB = G.PSIDA_TBL === 0 ? Li : E1 / (2 * sn) + 3 * E1 / 8 - 0.03;
    const poids = (z, w) => { for (const [o, L] of [[z.sup, Ls], [z.inf, z.tbI ? LiTB : Li]]) if (o && z.nb) for (const k of o) { const v = z.nb / o.length * L * aire(ph[k]) * 7.85; w[k] += v; total[k] += v; } };
    const zone = (no, o, sup, s, len, plage) => { const nb = s > 0 ? Math.ceil(len / s - 1e-6) : 0; return { no, sup: sup || o, inf: o, s, nb, plage: plage != null ? plage : nb * s }; };
    const vide = no => ({ no, sup: null, inf: null, s: 0, nb: 0, plage: 0 });
    const appuis = AP.map((a, k) => {
      const end = k === 0 || k === n, e = a.ech, A1 = a.ach;
      let o1 = choose(A1, famA ? 2 : 0), A1b = A1;
      if (!G.PSIDA_DCH0 && a.achOf) {
        const H = r.section.H || 0, cS = (r._A11 && r._A11.ENROBS) || 0;
        for (let q = famA ? 2 : 0; q < OPTS.length; q++) {
          const Aq = a.achOf(H - cS - 0.6 * ph[Math.min(...OPTS[q])]);
          if (ar(OPTS[q]) / Aq >= 0.1 - 1e-9 || q === OPTS.length - 1) { o1 = OPTS[q]; A1b = Aq; break; }
        }
        a.ach = A1b;
      }
      const s1 = tr5(Math.min(cap, ar(o1) / A1b));
      // zone 2 : section = max(section du chevêtre / 3, section minimale de la travée contiguë) ; longueur e (culée en
      // fissuration peu préjudiciable : 2·esp/3, face sup. PHI2/PHI3 ALT) — 3605, 3606, 3609, 3610 exacts avec les A imprimés
      const z2 = (no) => {
        const sp = no === '2G' ? k - 1 : k; if ((end && !famA) || !X[sp]) return vide(no);
        const A2 = Math.max(A1b / 3, X[sp].Amin), o2 = choose(A2, famA ? 2 : 0), s2 = tr5(Math.min(cap, ar(o2) / A2));
        return zone(no, o2, end ? [1, 2] : null, s2, end ? 2 * a.esp / 3 / (G.PSIDA_Z2SIN ? sn : 1) : e / (G.PSIDA_Z2SIN === 2 ? sn : 1));
      };
      let Z;
      if (k === 0) Z = [zone('1G', o1, null, s1, about, about), zone('1D', o1, null, s1, G.PSIDA_Z1SIN ? a.esp / 3 / sn : e - about), z2('2D')];
      else if (k === n) Z = [z2('2G'), zone('1G', o1, null, s1, G.PSIDA_Z1SIN ? a.esp / 3 / sn : e - about), zone('1D', o1, null, s1, about, about)];
      else Z = [z2('2G'), zone('1G', o1, null, s1, e / 2), zone('1D', o1, null, s1, e / 2), z2('2D')];
      const w = [0, 0, 0]; for (const z of Z) poids(z, w);
      return { zones: Z, w };
    });
    const travees = r.L.map((L, i) => {
      const g = appuis[i].zones.filter(z => /D/.test(z.no)), d = appuis[i + 1].zones.filter(z => /G/.test(z.no));
      const sum = a => a.reduce((p, z) => p + (z === appuis[i].zones[0] || (i + 1 === n && z === appuis[n].zones[2]) ? 0 : z.plage), 0);
      const plage = L - sum(g) - sum(d), A = X[i].Amin, o = choose(A, famA ? 2 : 0);
      const nb = Math.max(1, Math.ceil(plage / Math.min(cap, ar(o) / A) - 1e-6));
      // v13 : en fissuration peu préjudiciable les aciers inférieurs de travée sont « TB » (tête-bêche) sur 8/8 passages
      // (3603–3610), jamais en fissuration préjudiciable (5/5) ; longueur TB NON RÉSOLUE (≈ 0,88 × longueur pleine) :
      // on imprime la longueur pleine. Crochet PSIDA_TB = 0 : pas de mention TB.
      const z = { no: 'T' + (i + 1), sup: [2], inf: o, s: plage / nb, nb, plage, tbI: famA && G.PSIDA_TB !== 0 }, w = [0, 0, 0]; poids(z, w);
      return { zone: z, w };
    });
    return { appuis, travees, total, Ls, Li, LiTB };
  }
  function renderPropose(m, r, T) {
    const { page, f, pad } = T, Q = r.fer && r.fer.propose;
    if (!Q) return;
    const zl = (lead, z) => lead.padEnd(11) + z.no + '      ' + LAB(z.sup).padEnd(14) + f(z.sup ? Q.Ls : 0, 9, 2) + '         ' + (LAB(z.inf) + (z.tbI ? '  TB' : '')).padEnd(14) +
      f(z.inf ? (z.tbI ? Q.LiTB : Q.Li) : 0, 9, 2) + f(z.s, 14, 3) + pad(z.nb, 9) + f(z.plage, 10, 3);
    const wl = w => f(w[0], 10, 3) + f(w[1], 7, 3) + f(w[2], 7, 3);
    const pl = ['', '                         FACE SUPERIEURE                 FACE INFERIEURE                 DISPOSITIONS                POIDS ', '',
      '           NO        DIAMETRE       LONGUEUR         DIAMETRE       LONGUEUR     ESPACEMENT  NOMBRE   PLAGE    PHI1   PHI2   PHI3 ', ''];
    Q.appuis.forEach((a, k) => {
      const Z = a.zones, i1 = Z.findIndex(z => z.no === '1G');
      Z.forEach((z, j) => { pl.push(zl('', z) + ' '); if (j === i1) pl.push(('APPUI  ' + (k + 1)).padEnd(107) + wl(a.w) + ' '); });
      pl.push(' ', ' ');
      if (k < Q.travees.length) { const t = Q.travees[k]; pl.push(zl('TRAVEE ' + (k + 1), t.zone) + wl(t.w), ' ', ' '); }
    });
    pl.push(' '.repeat(97) + 'TOTAL' + f(Q.total[0], 14, 3) + f(Q.total[1], 7, 3) + f(Q.total[2], 7, 3) + ' ', ' ', ' ',
      '    NOTA -  ALT SIGNIFIE QUE LES ACIERS DE DIAMETRE DIFFERENT SONT ALTERNES ', '            TB  SIGNIFIE QUE LES ACIERS SONT DISPOSES TETE BECHE ', ' ',
      "            L'ESPACEMENT DES ACIERS ET LES PLAGES CORRESPONDANTES SONT MESURES SUIVANT L'AXE LONGITUDINAL DE L'OUVRAGE ");
    page("FERRAILLAGE TRANSVERSAL PROPOSE PARALLELE AUX LIGNES D'APPUIS", pl, { sub: '                      *   * ', sub2: '                        * ' });
  }
  function renderEtriers(m, r, T) {
    const { page, f, fx, pad } = T, E = r.fer && r.fer.etriers;
    if (!E) return;
    E.forEach((t, i) => {
      const pl = [' '.repeat(48) + "SECTION D'ACIER PAR COURS D'ETRIERS" + f(t.At, 14, 8) + ' M2',
        ' '.repeat(48) + 'CONTRAINTE DE CISAILLEMENT LIMITE DU BETON' + f(t.tl, 11, 2), '', '',
        '           ABSCISSE                    EFFORT TRANCHANT                    CISAILLEMENT                         ESPACEMENT MAXIMAL',
        '                                            MAXIMAL                           MAXIMAL                              DES COURS', ''];
      for (const q of t.rows) pl.push('            ' + (q.a === 0 ? '0    ' : fx(q.a, 2) + 'L') + f(q.V, 29, 2) + f(q.tau, 35, 2) + f(q.s, 38, 3));
      page('ETRIERS DE LA TRAVEE ' + (i + 1), pl, { sub2: '                                                           *     *' });
      const pe = [' '.repeat(65) + 'EPURE RETENUE', ' '.repeat(68) + '*     *', ' '.repeat(71) + '*', '',
        '                      ABSCISSE DE DEPART                 ESPACEMENTS                 NOMBRE                 PLAGE COUVERTE', '',
        '                             0.', ' '.repeat(55) + f(t.esp, 10, 3) + pad(t.nc, 23) + f(t.L, 29, 2), '                            ' + fx(t.L, 2), '',
        ' '.repeat(60) + "NOMBRE DE COURS D'ETRIERS" + pad(t.nc, 4) + (G.PSIDA_NOPOIDS || !(t.poids > 0) ? '' : '          POIDS PARTIEL ' + fx(t.poids, 3))];
      page('ETRIERS DE LA TRAVEE  ' + (i + 1), pe, { sub: '                          *     *', sub2: '                             *' });
    });
  }
  function sym(L) { for (let i = 0; i < L.length; i++) if (Math.abs(L[i] - L[L.length - 1 - i]) > 1e-9) return false; return true; }

  P.computeFer = computeFer;
  P.renderFer = renderFer;
  P._fer = { groupes, familles, comptes, gamme };
})(typeof globalThis !== 'undefined' ? globalThis : this);
