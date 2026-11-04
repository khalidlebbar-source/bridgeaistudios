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
    const dS = g.dS, dI = (mat.fiss >= 2 && A3.LIGNINF !== 1) ? r3(H - A11.ENROBI - ph[1] - ph[0] / 2) : g.dI;
    const env = (sup) => r.moments.map(sp => sp.map(s => {
      const Me = sup ? -s.els.min : s.els.max, Mu = sup ? -s.elu.min : s.elu.max;
      const b = sup ? g.bS : g.bI, d = sup ? dS : dI;
      return Math.max(Me > 0 ? P.asELS(Me, b, d, ss).As : 0, Mu > 0 ? P.asELU(Mu, b, d, mat) : 0);
    }));
    const eS = env(true), eI = env(false);
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
    r.fer.long.epure = epure(r, r.fer.long, H);
    r.fer.etriers = etriers(r, r.fer.long);
    r.fer.appareils = appareils(m, r);
    r.fer.transv = transversal(r);
    r.fer.metre = metre(r);
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
    const tot = lon.map((v, i) => v + tra[i] + (i === 3 ? etr : 0));
    const ptot = tot.reduce((a, b) => a + b, 0);
    return { lon, tra, etr, tot, ptot, beton, sousDalle, autres, ratio: ptot / beton };
  }

  // ------------------------------------------------------------------ appareils d'appui (DIMENSIONNEMENT …)
  // A vide : max = Gmax × coef CP / NAP, min = Gmin / NAP. En charge (exact sur 3826 avec les coefficients imprimés) :
  // max = (Gmax·cCP + max_cas(R⁺·c_cas·δ) + 2·T⁺)/NAP, min = (Gmin + min_cas(R⁻·c_cas·δ) + 2·T⁻)/NAP, δ convois = 1,1
  // sur appui d'extrémité, Bc/Bt × 1,2 δ, Mc × δ (δ sur appui : cf. non résolus ; 3603 confirme Bc×1,2×δ). Compressions atteintes = réaction en charge / aire. Coefficients d'inégalité : CP = 1 avec
  // 2 appareils ; les autres NE SONT PAS RECONSTITUÉS (1,000 imprimé). Dimensions : largeur 0,25, longueur au pas de
  // 0,05 (min 0,25) pour respecter COMPRENS (hypothèse ; le choix largeur/longueur SETRA n'est pas identifié).
  function appareils(m, r) {
    if (!r.reactions || !r.appuis) return null;
    const A13 = m.lignes.A13 || {}, n = r.n;
    const cas = ['CP', 'A', 'BC', r.nomBt || 'BT', ...((r.chargesC || []).filter(c => /CVOI|MC/.test(c)))];
    return r.appuis.map((ap, k) => {
      const R = r.reactions[k], nap = Math.max(1, ap.nap), l = R.live;
      const coef = {}; for (const c of cas) coef[c] = 1;
      const end = k === 0 || k === n;
      const dy = (r.cmdAppui && r.cmdAppui[k]) || { bc: 1, mc: 1 };
      const cands = [[l.A.pos.v * 1.2, l.A.neg.v * 1.2, coef.A], [l.Bc.max * 1.2 * dy.bc, l.Bc.min * 1.2 * dy.bc, coef.BC],
        [l.Bt.max * 1.2 * dy.bc, l.Bt.min * 1.2 * dy.bc, coef[r.nomBt || 'BT']]];
      for (const c of l.CE || []) { const d = /CVOI/.test(c.nom) ? (end ? 1.1 : 1) : dy.mc; cands.push([c.max.v * d, c.min.v * d, coef[c.nom] || 1]); }
      const vmax = Math.max(...cands.map(c => c[0] * c[2])), vmin = Math.min(...cands.map(c => c[1] * c[2]));
      const videMax = R.G.up * coef.CP / nap, videMin = R.G.dn / nap;
      const chMax = (R.G.up * coef.CP + vmax + 2 * l.T.max) / nap, chMin = (R.G.dn + vmin + 2 * l.T.min) / nap;
      const adm = ap.typ === 0 ? (A13.COMPREBS || 3500) : (A13.COMPRENS || 1500);
      const larg = 0.25, long = Math.max(0.25, Math.ceil(chMax / adm / larg / 0.05 - 1e-9) * 0.05);
      // chevêtre (constats 3603, 3607, 3639, 3826, 3488, 0063) : largeur = 2 esp/3 sur appui intermédiaire,
      // about·sin ψ (grades) + esp/3 sur culée ; moment = R en charge max × esp / (12 × largeur) ;
      // section : ELS, section fissurée b = 1, n = 15, d = H − 0,04, σs = σ̄s (exact en fissuration préjudiciable ;
      // approché à ~1 % en peu préjudiciable, règle exacte non retrouvée).
      const ech = end ? (r.about || 0) * Math.sin((r.biais || 100) * Math.PI / 200) + ap.esp / 3 : 2 * ap.esp / 3;
      const mch = ech > 0 ? chMax * ap.esp / (12 * ech) : 0;
      const sS = (r.mat.sigS && r.mat.sigS[2]) || 25000, dch = (r.section.H || 0) - 0.04;
      const mres = A => { const x = -15 * A + Math.sqrt(225 * A * A + 30 * A * dch); return A * sS * (dch - x / 3); };
      let lo = 0, hi = 0.05; for (let it = 0; it < 80; it++) { const md = (lo + hi) / 2; if (mres(md) < mch) lo = md; else hi = md; }
      return { nap: ap.nap, typ: ap.typ, esp: ap.esp, larg, long, coef, cas, videMax, videMin, chMax, chMin, cMin: chMin / (larg * long), cMax: chMax / (larg * long), ech, mch, ach: hi };
    });
  }

  // ------------------------------------------------------------------ étriers (pages ETRIERS DE LA TRAVEE i)
  // Section par cours = 2 brins × nombre de groupes inférieurs × aire(φ4). τ limite = 0,2 fcj/1,5 (fissuration
  // peu préjudiciable) ou 0,15 fcj/1,5. Effort tranchant maximal : enveloppe bilinéaire, max de la droite joignant
  // les valeurs ELU maximales des deux extrémités de la travée et de celle joignant les opposées des minimales
  // (exact sur 3826). Cisaillement τ = V / (E DALLE × d_sup) (à 0,1 % près). Espacement maximal :
  // min(0,40 ; At fe / (0,4 MPa × E DALLE)). Épure retenue : n = ⌈L/s⌉ cours également espacés sur la portée.
  function etriers(r, F) {
    if (!r.effortsTranchants) return null;
    const mat = r.mat, ph = mat.phi, n = r.n;
    const At = 2 * F.inf.n * aire(ph[3]);
    const tl = (mat.fiss <= 1 ? 0.2 : 0.15) * mat.fcj / 1.5;
    const bd = r.section.Eeq * F.sup.d;
    const smax = Math.min(0.40, At * mat.fe[3] / (40 * r.section.Eeq));
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
      const nc = Math.ceil(Li / smax - 1e-9);
      out.push({ rows, At, tl, nc, esp: Li / nc, L: Li });
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
    function nbFers(c, Am) {
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
    const blocs = { sup: [], inf: [] };
    const fer = (nom, j, phi, nb, o, x, oStar, xStar, len) => ({ nom, j, phi, nb, o, x, oStar: !!oStar, xStar: !!xStar, len: len != null ? len : x - o });
    // --- fers principaux supérieurs sur appuis intermédiaires
    const LSA = {}, cap0S = cum(cS, 3, aire(ph[2]));
    for (let k = 1; k < n; k++) {
      let Am = 0; for (const i of [k - 1, k]) for (const v of F.sup.env[i]) Am = Math.max(Am, v);
      const nf = nbFers(cS, Am), list = [];
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
    for (let i = 0; i < n; i++) {
      let Am = 0; for (const v of F.inf.env[i]) Am = Math.max(Am, v);
      const nf = nbFers(cI, Am), list = [];
      for (let j = 1; j <= nf.k; j++) {
        const phi = j === nf.k && nf.last ? ph[1] : ph[0];
        if (j <= 3) {
          // fers filants : recouvrement ls avec les fers de construction inférieurs d'appui ; about : extrémité de la
          // dalle moins l'enrobage, plus un retour de 12 φ1 (constat 3826, 3603, 3452…)
          const bout = -(ab - r._A11.ENROBI) - 12 * ph[0];
          const o = i === 0 ? bout : LIAext[i][1] - ls, x = i === n - 1 ? L[i] - bout : L[i] - LIAext[i + 1][0] + ls;
          list.push(fer('LIT' + (i + 1), j, phi, cI[j - 1], o, x, i === 0, i === n - 1));
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
      for (let j = 1; j <= 3; j++) list.push(fer('LIA' + (k + 1), j, ph[2], cI[j - 1], L[k - 1] - gl, dr, false, false, gl + dr));
      for (const b of LSA[k]) if (b.j > 3) list.push(fer('LIA' + (k + 1), b.j, ph[2], cI[b.j - 1], b.o, b.x, false, false, b.len));
      LIA[k] = list;
    }
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
    page("DIMENSIONNEMENT DES APPAREILS D'APPUI", pl, { sub: '                        *   *', sub2: "                         GEOMETRIE DES APPAREILS D'APPUI" });
  }

  // ------------------------------------------------------------------ ferraillage transversal inférieur (mi-travée)
  // Moment longitudinal principal = M max travée / E DALLE ; moments transversaux = max des fibres (My ELS / ELU max) ;
  // A1 = 1,2 AS(ν), A2 = 1,2 AU(ν) ; AS, AU avec ν = 0 ; d = H − 0,04 ; AP = 5·10⁻⁴ H ;
  // ANF = ftj H² / (6 × 0,9 d fe) ; A = sup(inf(sup(A1, A2), ANF), AS, AU, AP). Torsion (biais) et section de couture des
  // scellements droits NON reconstituées (0).
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
      const asS = M => (ss && M > 0 ? P.asELS(M, 1, d, ss).As : 0), asU = M => P.asELU(M, 1, d, mt);
      const A1 = 1.2 * asS(my.els), A2 = 1.2 * asU(my.elu), AS = asS(my0.els), AU = asU(my0.elu);
      const AP = 5e-4 * H, ANF = mat.ftj * H * H / (6 * 0.9 * d * fe);
      const A = Math.max(Math.min(Math.max(A1, A2), ANF), AS, AU, AP);
      // couture des scellements droits (constat exact sur 9 passages) : 4 φ1 τs / fe − 5 φ4², τs = 0,6 × 1,5² ftj
      const ph = mat.phi, couture = Math.max(0, 4 * ph[0] * 0.6 * 2.25 * mat.ftj / (mat.fe[0] || fe) - 5 * ph[3] * ph[3]);
      return { nu, ml, my, my0, A1, A2, AS, AU, AP, ANF, A, couture, Amin: Math.max(A, couture), d };
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
      ' MOMENT DE TORSION DANS LE BETON (TM/M)', ...both(() => 0), ' CONTRAINTE DE CISAILLEMENT SIMPLE (T/M2)', ' DU BETON PAR TORSION', ...both(() => 0),
      "             EVALUATION DES SECTIONS D'ACIER  DU FERRAILLAGE TRANSVERSAL INFERIEUR EN SECTION MEDIANE DE CHAQUE TRAVEE",
      "                                 (FERRAILLAGE TRANSVERSAL DISPOSE PARALLELEMENT AUX LIGNES D'APPUI)",
      '                                                               *   *                              HAUTEUR UTILE = ' + f(X[0].d, 6, 2) + ' M',
      '                                                                 *', tr,
      ` CALCUL ELS AVEC POISSON = ${f(nu, 5, 2)}`, row('        MOMEMT (TM/M)                  ', x => x.my.els, 14, 2), row("        1.2*(SECTION  D'ACIER ) :         A1 =", x => x.A1, 9, 6),
      ` CALCUL ELU AVEC POISSON = ${f(nu, 5, 2)}`, row('        MOMEMT (TM/M)                  ', x => x.my.elu, 14, 2), row("        1.2*(SECTION  D'ACIER ) :         A2 =", x => x.A2, 9, 6),
      ` CALCUL ELS AVEC POISSON = ${f(0, 5, 2)}`, row('        MOMEMT (TM/M)                  ', x => x.my0.els, 14, 2), row("        SECTION  D'ACIER :                AS =", x => x.AS, 9, 6),
      ` CALCUL ELU AVEC POISSON = ${f(0, 5, 2)}`, row('        MOMEMT (TM/M)                  ', x => x.my0.elu, 14, 2), row("        SECTION  D'ACIER :                AU =", x => x.AU, 9, 6),
      row(' ARMATURE DE PEAU  :                      AP =', x => x.AP, 9, 6), row(' CONDITION DE NON-FRAGILITE :             ANF=', x => x.ANF, 9, 6),
      ' SECTION DE CALCUL DU FERRAILLAGE', row(' TRANSVERSAL INFERIEUR (M2/ML) :          A  =', x => x.A, 9, 6),
      ' < A=SUP(INF(SUP(A1,A2),ANF),AS,AU,AP) >', '   ***********************************', ' SECTION MINIMALE DU FERRAILLAGE', ' TRANSVERSAL (M2/ML)',
      row(' (COUTURE DES SCELLEMENTS DROITS) :       ', x => x.couture, 14, 6), row(' SECTION MINIMALE A METTRE EN PLACE (M2/ML)', x => x.Amin, 14, 6), ' *******************************************');
    page('', P);
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
        ' '.repeat(60) + "NOMBRE DE COURS D'ETRIERS" + pad(t.nc, 4)];
      page('ETRIERS DE LA TRAVEE  ' + (i + 1), pe, { sub: '                          *     *', sub2: '                             *' });
    });
  }
  function sym(L) { for (let i = 0; i < L.length; i++) if (Math.abs(L[i] - L[L.length - 1 - i]) > 1e-9) return false; return true; }

  P.computeFer = computeFer;
  P.renderFer = renderFer;
  P._fer = { groupes, familles, comptes, gamme };
})(typeof globalThis !== 'undefined' ? globalThis : this);
