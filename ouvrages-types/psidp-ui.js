/* PSIDP-EL — définition de la saisie guidée (pont-dalle continu en béton précontraint, BPEL 91, fasc. 61 titre II)
   Programme SETRA PSIDP91 : bordereau des données (cartes LIGN, NT, NV, HDAL1, STA, GEN, PROCEDE, MOD, DSIG, CNV
   et, en câblage imposé, COTES DES CABLES). Unités SETRA : m, t, grades, t/m² (1 MPa ≈ 101,97 t/m²). */
(function (G) {
  'use strict';
  const { fmt, num, esc } = G.OTUI;
  const E = G.PSIDP;
  const FIELDS = (G.PSIDP_PARSE && G.PSIDP_PARSE.FIELDS) || {};
  const SECB = G.PSIDP_COMPUTE && G.PSIDP_COMPUTE.sectionBrute;

  /* styles propres au tracé de câble (le socle ne les définit pas) */
  if (typeof document !== 'undefined' && !document.getElementById('psidp-css')) {
    const st = document.createElement('style'); st.id = 'psidp-css';
    st.textContent = `
.ot svg .cab{fill:none;stroke:#0a8a78;stroke-width:2.2px;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.ot svg .cab2{fill:none;stroke:#0a8a78;stroke-width:1.2px;stroke-dasharray:6 4;vector-effect:non-scaling-stroke;opacity:.75}
.ot svg .cabpt{fill:#fff;stroke:#0a8a78;stroke-width:1px;vector-effect:non-scaling-stroke}
.ot svg .duct{fill:#fff;stroke:#0a8a78;stroke-width:1.3px;vector-effect:non-scaling-stroke}
.ot svg .duct.ghost{fill:none;stroke-dasharray:3 2;opacity:.7}
.ot svg .ductup{fill:none;stroke:#0a8a78;stroke-width:1px;stroke-dasharray:3 2;vector-effect:non-scaling-stroke}
.ot svg .strand{fill:#0a8a78;stroke:#fff;stroke-width:.5px;vector-effect:non-scaling-stroke}
.ot svg .bar{fill:#5d5545}
.ot svg .lane{stroke:#fff;stroke-width:1px;stroke-dasharray:6 5;vector-effect:non-scaling-stroke}
.ot svg .load{fill:rgba(26,79,214,.08);stroke:#1a4fd6;stroke-width:1px;vector-effect:non-scaling-stroke}
.ot svg .arw{stroke:#1a4fd6;stroke-width:1.3px;vector-effect:non-scaling-stroke}
.ot svg .arr{stroke:#c0392b;stroke-width:1.6px;vector-effect:non-scaling-stroke}
.ot svg .grid{stroke:#e2ddd6;stroke-width:1px;vector-effect:non-scaling-stroke}
.ot svg .hl.cab,.ot svg .hl.cab2,.ot svg .hl.duct,.ot svg .hl.ductup{stroke:#c0392b}
.ot svg .hl.strand,.ot svg .hl.bar{fill:#c0392b}
.ot svg .hl.cabpt{stroke:#c0392b;fill:#f6e3b0}
.ot svg .hl.load{stroke:#c0392b;fill:rgba(192,57,43,.1)}
.ot svg .hl.arw,.ot svg .hl.arr{stroke:#c0392b;stroke-width:2.4px}
.ot svg .hl.lane{stroke:#f6e3b0}`;
    document.head.appendChild(st);
  }

  /* ───── accès au modèle ───── */
  const STR = { PROCEDE: 1, UNITE: 1 };
  const CODE3 = { STA: 1, A: 1, B: 1, CE: 1, GEN: 1, BP: 1 };
  const V = (m, k) => { const x = num(((m && m.values) || {})[k]); return isFinite(x) ? x : 0; };
  const has = (m, k) => { const x = num(((m && m.values) || {})[k]); return isFinite(x); };
  let CUR = null;                                   // modèle courant (pages dynamiques des cotes de câble)

  function get(m, k) {
    CUR = m;
    if (k === 'TITRE1' || k === 'TITRE2') return (m.titres || [])[k === 'TITRE1' ? 0 : 1] || '';
    if (k === 'NUMERO') return m.numero || '';
    if (k.startsWith('COT.')) { const [, t, j] = k.split('.'); const r = m.cotes && m.cotes.values && m.cotes.values[+t]; return r ? r[+j] : ''; }
    return (m.values || {})[k];
  }
  function cardOf(k) {
    for (const c of Object.keys(FIELDS)) for (let r = 0; r < FIELDS[c].length; r++) if (FIELDS[c][r].indexOf(k) >= 0) return [c, r];
    return null;
  }
  function likeRaw(ref, v) {
    if (ref == null) return String(v);
    const dec = (String(ref).split('.')[1] || '').length, dot = String(ref).indexOf('.') >= 0;
    return dot ? v.toFixed(dec) + (dec === 0 ? '.' : '') : String(Math.round(v));
  }
  /* le bordereau mémorise la mise en page des cartes : une valeur absente de la carte (appuis ajoutés…) y est
     insérée au pas des colonnes voisines pour être réécrite par formatBordereau */
  function ensureField(m, k) {
    const ck = cardOf(k); if (!ck || !m.layout || !m.layout.cards) return;
    const [cn, rw] = ck;
    if (cn === 'STA' || (cn === 'LIGN' && rw === 1)) return;          // cartes lues par position : non étendues
    const card = m.layout.cards[cn]; if (!card) return;
    const rows = card.rows.filter(r => !r.extra); const row = rows[rw]; if (!row) return;
    const names = FIELDS[cn][rw], idx = names.indexOf(k);
    if (row.pos.some(p => p[0] === k)) return;
    for (let j = row.pos.length; j <= idx; j++) {
      const nm = names[j], P = row.pos, n = P.length;
      const e = n >= 4 ? P[n - 2][2] + (P[n - 2][2] - P[n - 4][2]) : (n ? P[n - 1][2] + 7 : 6);
      if (!has(m, nm)) m.values[nm] = n >= 2 ? (num(m.values[P[n - 2][0]]) || 0) : 0;
      if (m.raw[nm] == null) m.raw[nm] = likeRaw(n >= 2 ? m.raw[P[n - 2][0]] : null, num(m.values[nm]) || 0);
      P.push([nm, e - 5, e]);
    }
  }
  function set(m, k, v) {
    if (k === 'TITRE1' || k === 'TITRE2') {
      const t = (m.titres || []).slice(); while (t.length < 2) t.push('');
      t[k === 'TITRE1' ? 0 : 1] = String(v).toUpperCase(); m.titres = t; return;
    }
    if (k === 'NUMERO') { const n = String(v).replace(/\D/g, '').slice(0, 4).padStart(4, '0'); m.numero = n; m.numeroRaw2 = n + '-' + (m.suffixe || ''); if (m.layout) { m.layout.line0 = null; } return; }
    if (k.startsWith('COT.')) { const [, t, j] = k.split('.'); ensureCotes(m); if (m.cotes.values[+t]) m.cotes.values[+t][+j] = v; return; }
    m.values = m.values || {}; m.raw = m.raw || {};
    if (STR[k]) { const s = String(v).toUpperCase().replace(/\s+/g, ''); m.values[k] = s; m.raw[k] = s; return; }
    m.values[k] = v;
    ensureField(m, k);
    if (CODE3[k] && typeof v === 'number') m.raw[k] = String(Math.round(v)).padStart(3, '0');
    if (k === 'NT') { m.NT = v; }
  }

  /* ───── section brute (formule du moteur) ───── */
  function section(m) {
    const v = m.values || {};
    try { if (SECB && V(m, 'HDAL1') > 0 && V(m, 'EDAL1') > 0) return SECB(Object.assign({}, v, { HDAL1: V(m, 'HDAL1'), HDAL2: V(m, 'HDAL2'), HDAL3: V(m, 'HDAL3'), EDAL1: V(m, 'EDAL1'), EDAL2: V(m, 'EDAL2'), EDAL3: V(m, 'EDAL3') })); } catch (e) { /* section non définie */ }
    const H = V(m, 'HDAL1') || 0.8, B = V(m, 'EDAL1') || 5;
    return { S: B * H, I: B * H * H * H / 12, V: H / 2, VP: H / 2 };
  }

  /* ───── géométrie longitudinale et tracé schématique du câble ───── */
  function geo(m) {
    const n = Math.max(1, Math.min(6, Math.round(V(m, 'NT')) || 1));
    const L = []; for (let i = 1; i <= n; i++) L.push(V(m, 'D' + i) > 0 ? V(m, 'D' + i) : 10);
    const X = [0]; L.forEach(l => X.push(X[X.length - 1] + l));
    const H = V(m, 'HDAL1') > 0 ? V(m, 'HDAL1') : 0.8;
    const sc = section(m);
    const VP = V(m, 'VP') > 0 && V(m, 'VP') < H ? V(m, 'VP') : sc.VP;
    return { n, L, X, Lt: X[n], H, ab: Math.max(0, V(m, 'ABOUT')), VP };
  }
  function cableLevels(m, g) {
    const dg = V(m, 'DGAIN'), dec = V(m, 'DECAL'), cs = V(m, 'COUVS'), ci = V(m, 'COUVI');
    const zlo = Math.min(g.H * 0.45, ci + dg / 2 + dec), zhi = Math.max(g.H * 0.55, g.H - cs - dg / 2 - dec);
    return { zlo, zhi, zc: g.VP };
  }
  function cableAuto(m, g) {
    const { zlo, zhi, zc } = cableLevels(m, g), R0 = Math.max(V(m, 'RMIN'), 0.5);
    const pts = [], low = [], radii = [];
    const half = (xv, zv, xs, zs, rev) => {
      const d = Math.abs(xs - xv), h = zs - zv, sg = Math.sign(xs - xv) || 1, out = [];
      let R = R0, t2 = 0;
      if (rev && h > 0 && d > 0) { t2 = 2 * R * h / d; if (t2 > 0.6 * d) { t2 = 0.6 * d; R = t2 * d / (2 * h); } radii.push({ x: xs, R, t2, z: zs }); }
      const a1 = d > t2 ? (h / d) / (d - t2) : 0;
      for (let i = 0; i <= 40; i++) {
        const s = d * i / 40;
        const z = !rev || h <= 0 ? zv + h * (d ? (s / d) * (s / d) : 0) : (s <= d - t2 ? zv + a1 * s * s : zs - (d - s) * (d - s) / (2 * R));
        out.push([xv + sg * s, z]);
      }
      return out;
    };
    for (let t = 0; t < g.n; t++) {
      const x0 = g.X[t], l = g.L[t];
      const fr = g.n === 1 ? 0.5 : t === 0 ? 0.4 : t === g.n - 1 ? 0.6 : 0.5;
      const xm = x0 + fr * l;
      const lc = t === 0, rc = t === g.n - 1;
      const A = half(xm, zlo, x0, lc ? zc : zhi, !lc).reverse(), B = half(xm, zlo, x0 + l, rc ? zc : zhi, !rc);
      pts.push(...(t ? A.slice(1) : A), ...B.slice(1));
      low.push([xm, zlo]);
    }
    return { pts, low, radii, zlo, zhi, zc, imposed: false };
  }
  function cableCotes(m, g) {
    const rows = m.cotes && m.cotes.values; if (!rows || rows.length < g.n) return null;
    const pts = [], low = [];
    for (let t = 0; t < g.n; t++) {
      const c = rows[t]; if (!c || c.length < 11 || c.some(x => !isFinite(num(x)))) return null;
      const P = c.map((z, j) => [g.X[t] + g.L[t] * j / 10, num(z)]);
      for (let j = 0; j < 10; j++) {           // Catmull-Rom entre les cotes
        const p0 = P[Math.max(0, j - 1)], p1 = P[j], p2 = P[j + 1], p3 = P[Math.min(10, j + 2)];
        for (let s = (t || j) ? 1 : 0; s <= 6; s++) {
          const u = s / 6, u2 = u * u, u3 = u2 * u;
          const f = (a, b, c2, d2) => 0.5 * ((2 * b) + (-a + c2) * u + (2 * a - 5 * b + 4 * c2 - d2) * u2 + (-a + 3 * b - 3 * c2 + d2) * u3);
          pts.push([p1[0] + (p2[0] - p1[0]) * u, f(p0[1], p1[1], p2[1], p3[1])]);
        }
      }
      let jm = 0; c.forEach((z, j) => { if (num(z) < num(c[jm])) jm = j; }); low.push(P[jm]);
    }
    const lv = cableLevels(m, g);
    return Object.assign(lv, { pts, low, radii: [], imposed: true, P: rows });
  }
  const cable = (m, g) => (V(m, 'CABL') === 4 && cableCotes(m, g)) || cableAuto(m, g);
  function ensureCotes(m) {
    const g = geo(m);
    if (!m.cotes) m.cotes = { hdr: ['COTES DES CABLES', '----------------', '   0       0.1L     0.2L     0.3L     0.4L     0.5L     0.6L     0.7L     0.8L     0.9L     1.0L'], rows: [], values: [] };
    const C = m.cotes; C.values = C.values || [];
    if (C.values.length !== g.n) {
      const a = cableAuto(m, g);
      const zAt = x => { let best = a.pts[0]; for (const p of a.pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p; return Math.round(best[1] * 1000) / 1000; };
      while (C.values.length < g.n) { const t = C.values.length; C.values.push(Array.from({ length: 11 }, (_, j) => zAt(g.X[t] + g.L[t] * j / 10))); }
      C.values.length = g.n;
    }
  }

  /* ───── listes ───── */
  const ON = [[1, '1 — oui'], [0, '0 — non']];
  const opt = (k, code, label, help) => ({ k, code, label, type: 'sel', opts: ON, help });
  const DLAB = ['0', '0,1L', '0,2L', '0,3L', '0,4L', '0,5L', '0,6L', '0,7L', '0,8L', '0,9L', '1,0L'];
  const cotesPage = t => ({ label: 'Travée ' + (t + 1), groups: [
    { title: `Cotes de l'axe du câble par rapport à la sous-dalle — travée ${t + 1} (appui ${t + 1} → appui ${t + 2})`, flex: 11, cols: 11, fields: DLAB.map((c, j) => ({ k: `COT.${t}.${j}`, code: c, label: '', unit: 'm', dec: 3, help: `Cote de l'axe du câble moyen au-dessus de l'intrados, à ${c.replace(',', '.')} de la portée ${t + 1}. Les cotes 1,0L d'une travée et 0 de la suivante désignent le même point (sur appui).` })) }] });
  const cotesBase = { label: 'Mode de câblage', groups: [
    { title: 'Câblage', alt: true, flex: 3, cols: 3, fields: [
      { k: 'CABL', code: 'CABL', label: 'câblage', type: 'sel', relayout: true, opts: [[1, '1 — calculé'], [4, '4 — imposé (cotes)']], help: 'CABLAGE. 1 : le programme calcule le câblage (nombre et tracé) ; 4 : vérification d\'un câblage dont on donne le nombre de câbles NCA et les cotes aux dixièmes de portée (lignes D1 à D6).' },
      { k: 'CABL2', code: 'CABL', label: 'impression', type: 'sel', opts: ON, help: 'Impression des résultats du câblage (ligne A4).' },
      { k: 'NCA', code: 'NCA', label: 'nb de câbles', type: 'int', help: 'NCAB : nombre d\'armatures. Obligatoire en câblage imposé (CABL = 4) ; sinon 0 ou valeur minimale, le programme retient le plus grand du nombre donné et du nombre calculé.' },
    ] },
    { title: 'Découpage pour les cotes (rappel du profil en long)', flex: 6, cols: 6, fields: [1, 2, 3, 4, 5, 6].map(i => ({ k: 'ND' + i, code: 'ND' + i, label: 'travée ' + i, type: 'int', help: `Nombre d'intervalles de la travée ${i} entre les sections où le programme imprime la cote du câble (espacement voisin de celui des supports de gaine ; ND ≤ 48).` })) },
  ] };

  const steps = [
    { id: 'id', label: 'Identification', view: 'elev', caption: 'calculs demandés (lignes A3 et A4)', hint: 'Titre de la note et calculs demandés. Porter normalement 1 partout, TASMENT = 2 si l\'on étudie les tassements d\'appui.', pages: [
      { label: 'Titre', groups: [
        { title: 'Titre de la note (lignes A1 et A2)', flex: 5, cols: 2, fields: [
          { k: 'TITRE1', code: 'TITRE', label: 'ligne 1', type: 'txt', help: 'Identité de l\'ouvrage : voie, commune, numéro de l\'ouvrage… (imprimée en tête de la note).' },
          { k: 'TITRE2', code: 'TITRE', label: 'ligne 2', type: 'txt', help: 'Seconde ligne d\'identification de l\'ouvrage.' },
        ] },
        { title: 'Passage', flex: 1, cols: 1, fields: [
          { k: 'NUMERO', code: 'NUM', label: 'numéro', type: 'txt', help: 'Numéro du passage (4 chiffres), rappelé en haut de chaque page de la note.' },
        ] },
      ] },
      { label: 'Calculs (1/2)', groups: [
        { title: 'Exécution des calculs — ligne A3', alt: true, flex: 8, cols: 8, fields: [
          opt('LIGN', 'LIGNINF', 'lignes d\'influence', 'Calcul des équations des lignes d\'influence des moments, efforts tranchants et réactions d\'appui.'),
          { k: 'EXCE', code: 'EXCENTR', label: 'répartition', type: 'sel', opts: [[1, '1 — Guyon-Massonnet'], [0, '0 — K imposés']], help: 'EXCENTR. 1 : coefficients de répartition transversale calculés par Guyon-Massonnet ; 0 : le programme utilise KA, KBC, KBT, KCM, KTR (étape Charges).' },
          opt('MOME', 'MOMENT', 'moments', 'Calcul des courbes enveloppes des moments longitudinaux.'),
          opt('EFTR', 'EFTRAN', 'efforts tranchants', 'Calcul des efforts tranchants extrêmes sur appuis.'),
          opt('REAP', 'REAPPUI', 'réactions', 'Calcul des réactions d\'appui globales extrêmes par appui.'),
          opt('MOTR', 'MOTRAN', 'flexion transv.', 'Calcul des moments de flexion transversale (Guyon-Massonnet) en milieu de travée.'),
          { k: 'TASM', code: 'TASMENT', label: 'tassements', type: 'sel', opts: [[0, '0 — non'], [1, '1 — unitaires'], [2, '2 — étudiés']], help: 'TASMENT. 0 : pas de calcul ; 1 : effets de dénivellations unitaires de 1 cm ; 2 : en plus, sécurité vis-à-vis des tassements donnés à l\'étape Tassements.' },
          opt('DIMA', 'DIMAP', 'appareils d\'appui', 'Dimensionnement des appareils d\'appui (étape Appuis).'),
        ] },
      ] },
      { label: 'Calculs (2/2)', groups: [
        { title: 'Exécution des calculs — ligne A3 (suite)', alt: true, flex: 8, cols: 8, fields: [
          { k: 'CABL', code: 'CABLAGE', label: 'câblage', type: 'sel', relayout: true, opts: [[1, '1 — calculé'], [4, '4 — imposé']], help: 'CABLAGE. 1 : calcul du câblage dans une dalle donnée ; 4 : vérification d\'un câblage dont on donne NCA et le tracé (étape Tracé imposé).' },
          opt('FERT', 'FERTRAN', 'ferraillage transv.', 'Calcul du ferraillage transversal.'),
          opt('ETRI', 'ETRIERS', 'étriers', 'Sécurité vis-à-vis du cisaillement à l\'effort tranchant général.'),
          opt('POIN', 'POINCON', 'poinçonnement', 'Cisaillement de poinçonnement au voisinage des appuis concentrés (non opérationnel : porter 0).'),
          opt('DEFO', 'DEFORM', 'déformations', 'Calcul des déformations probables du tablier (flèches et rotations).'),
          opt('METRE', 'METRE', 'avant-métré', 'Avant-métré récapitulatif (béton, coffrages, aciers).'),
          opt('PP', 'P.P.', 'données PP', 'Tableau récapitulatif utilisable en données du programme Piles et Palées.'),
          opt('DES', 'DESSIN', 'dessin', 'Dessin automatique du câblage (1 : dessin ; 0 : pas de dessin).'),
        ] },
      ] },
      { label: 'Impressions', groups: [
        { title: 'Impression des résultats — ligne A4', flex: 5, cols: 5, fields: [
          opt('LIGN2', 'LIGNINF', 'lignes d\'influence', 'Impression des lignes d\'influence (porter normalement les mêmes chiffres qu\'en ligne A3 pour la vérification par l\'entrepreneur).'),
          { k: 'EXCE2', code: 'EXCENTR', label: 'répartition', type: 'sel', opts: [[1, '1 — détaillée'], [0, '0 — essentielle']], help: 'Impression des résultats intermédiaires de la répartition transversale.' },
          opt('MOME2', 'MOMENT', 'moments', 'Impression détaillée des moments longitudinaux.'),
          opt('MOTR2', 'MOTRAN', 'flexion transv.', 'Impression détaillée de la flexion transversale.'),
          opt('CABL2', 'CABLAGE', 'câblage', 'Impression détaillée du câblage.'),
        ] },
      ] },
    ], schema: (svg) => drawElev(svg, GEN, true, 'opts') },

    { id: 'long', label: 'Profil en long', view: 'elev', caption: 'portées biaises mesurées sur l\'axe', hint: 'Travées de gauche à droite (la travée 1 définit le côté gauche). Portées biaises, mesurées suivant l\'axe de l\'ouvrage.', pages: [
      { label: 'Travées', groups: [
        { title: 'Ouvrage', flex: 3, cols: 3, fields: [
          { k: 'NT', code: 'NT', label: 'nb de travées', type: 'int', relayout: true, help: 'Nombre de travées (1 à 6).' },
          { k: 'BIAIS', code: 'BIAIS', label: 'biais', unit: 'gr', dec: 3, help: 'Biais géométrique moyen : angle en grades entre les lignes d\'appui et l\'axe longitudinal (100 = droit).' },
          { k: 'ABOUT', code: 'ABOUT', label: 'about', unit: 'm', dec: 3, help: 'Longueur biaise d\'about sur appuis extrêmes, mesurée suivant l\'axe entre la ligne d\'appui de rive et l\'extrémité de la dalle.' },
        ] },
        { title: 'Portées biaises (de gauche à droite)', alt: true, flex: 6, cols: 6, fields: [1, 2, 3, 4, 5, 6].map(i => ({ k: 'D' + i, code: 'D' + i, label: 'travée ' + i, unit: 'm', dec: 3, help: `Portée biaise de la travée ${i}, mesurée sur l'axe (portée développée pour un ouvrage courbe). Porter 0 au-delà de NT.` })) },
      ] },
      { label: 'Découpage', groups: [
        { title: 'Nombre d\'intervalles pour les cotes du câble (ND ≤ 48)', flex: 6, cols: 6, fields: [1, 2, 3, 4, 5, 6].map(i => ({ k: 'ND' + i, code: 'ND' + i, label: 'travée ' + i, type: 'int', help: `Nombre d'intervalles de la travée ${i} entre sections équidistantes où l'on veut la cote de l'axe du câble ; longueur d'intervalle voisine de l'espacement des supports de gaine (≈ 1 m).` })) },
      ] },
    ], schema: (svg) => drawElev(svg, GEN, true) },

    { id: 'trav', label: 'Profil en travers', view: 'coupe', caption: 'de gauche à droite, en largeurs droites', hint: 'Profil en travers de la voie portée, de gauche à droite. Somme des largeurs = EDAL1 + EDAL2.', pages: [
      { label: 'Largeurs', groups: [
        { title: 'Profil en travers de la voie portée (de gauche à droite)', flex: 7, cols: 7, fields: [
          { k: 'ETROG', code: 'ETROG', label: 'trottoir G', unit: 'm', dec: 3, help: 'Largeur utile du trottoir de gauche (passage inférieur : bande non chargée à gauche de la glissière).' },
          { k: 'EGAU', code: 'EGAU', label: 'bande G', unit: 'm', dec: 3, help: 'Largeur non chargeable le long du dispositif de retenue de gauche (0,50 m) ; 0 s\'il n\'y en a pas.' },
          { k: 'ESURCH', code: 'ESURCH', label: 'chargeable', unit: 'm', dec: 3, help: 'Largeur chargeable au sens de l\'article 2 du fascicule 61 titre II.' },
          { k: 'EDROI', code: 'EDROI', label: 'bande D', unit: 'm', dec: 3, help: 'Largeur non chargeable le long du dispositif de retenue de droite (0,50 m) ; 0 s\'il n\'y en a pas.' },
          { k: 'ETROD', code: 'ETROD', label: 'trottoir D', unit: 'm', dec: 3, help: 'Largeur utile du trottoir de droite.' },
          { k: 'NV', code: 'NVOIE', label: 'nb de voies', type: 'int', help: 'Nombre de voies de circulation (fasc. 61 II art. 2.2 : partie entière de ESURCH/3, 2 voies entre 5 et 6 m).' },
          { k: 'HCHAU', code: 'HCHAU', label: 'chaussée', unit: 'm', dec: 3, help: 'Épaisseur moyenne de béton équivalent au renformis éventuel, à la chape et à la chaussée.' },
        ] },
      ] },
      { label: 'Symétrie et fibres', groups: [
        { title: 'Symétrie et axe mécanique', flex: 3, cols: 3, fields: [
          { k: 'SYM', code: 'SYMTAB', label: 'symétrie', type: 'sel', opts: [[1, '1 — symétrique'], [0, '0 — non']], help: 'Symétrie transversale du profil : 1 si ETROG = ETROD et EGAU = EDROI, 0 sinon.' },
          { k: 'DISEXT', code: 'DISEXT', label: 'excentr. extrados', unit: 'm', dec: 3, help: 'Distance de l\'axe mécanique à l\'axe géométrique de l\'extrados (profil dissymétrique).' },
          { k: 'DISINT', code: 'DISINT', label: 'excentr. intrados', unit: 'm', dec: 3, help: 'Distance de l\'axe mécanique à l\'axe géométrique de l\'intrados (profil dissymétrique).' },
        ] },
        { title: 'Fibres de la flexion transversale', alt: true, flex: 5, cols: 5, fields: [
          { k: 'NF', code: 'NF', label: 'fibres', type: 'sel', opts: [[1, '1 — axe'], [2, '2 — ± E/4'], [3, '3 — ± E/4, ± 3E/8']], help: 'Fibres étudiées en flexion transversale : 1 axe mécanique ; 2 axe et fibres à ± EDALLE/4 ; 3 en plus fibres à ± 3·EDALLE/8.' },
          { k: 'YY2', code: 'YY(2)', label: 'fibre 2', unit: 'm', dec: 3, help: 'Normalement 0. Profils exceptionnels : distance de la fibre 2 au bord gauche du trottoir gauche.' },
          { k: 'YY3', code: 'YY(3)', label: 'fibre 3', unit: 'm', dec: 3, help: 'Normalement 0. Distance de la fibre 3 au bord gauche du trottoir gauche.' },
          { k: 'YY4', code: 'YY(4)', label: 'fibre 4', unit: 'm', dec: 3, help: 'Normalement 0. Distance de la fibre 4 au bord gauche du trottoir gauche.' },
          { k: 'YY5', code: 'YY(5)', label: 'fibre 5', unit: 'm', dec: 3, help: 'Normalement 0. Distance de la fibre 5 au bord gauche du trottoir gauche.' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true) },

    { id: 'sect', label: 'Section', view: 'coupe', caption: 'nervure, flancs et encorbellements', hint: 'Coupe transversale de la dalle. S, I, V, V\' sont recalculés quand on modifie HDAL ou EDAL.', pages: [
      { label: 'Coffrage', groups: [
        { title: 'Épaisseurs', flex: 3, cols: 3, fields: [
          { k: 'HDAL1', code: 'HDAL1', label: 'nervure', unit: 'm', dec: 3, help: 'Épaisseur de la dalle résistante (épaisseur de la nervure s\'il y a des encorbellements ; épaisseur moyenne si la dalle est bombée).' },
          { k: 'HDAL2', code: 'HDAL2', label: 'bout d\'encorb.', unit: 'm', dec: 3, help: 'Épaisseur à l\'extrémité des encorbellements latéraux.' },
          { k: 'HDAL3', code: 'HDAL3', label: 'flanc', unit: 'm', dec: 3, help: 'Épaisseur verticale du flanc entre l\'intrados et la naissance de l\'encorbellement (cas courant : HDAL1 − HDAL2).' },
        ] },
        { title: 'Largeurs droites', alt: true, flex: 3, cols: 3, fields: [
          { k: 'EDAL1', code: 'EDAL1', label: 'intrados', unit: 'm', dec: 3, help: 'Largeur droite d\'intrados entre arêtes inférieures (entre encorbellements).' },
          { k: 'EDAL2', code: 'EDAL2', label: 'encorb. cumulés', unit: 'm', dec: 3, help: 'Largeur droite cumulée des deux encorbellements (mesurée depuis les arêtes d\'intrados).' },
          { k: 'EDAL3', code: 'EDAL3', label: 'flancs cumulés', unit: 'm', dec: 3, help: 'Largeur droite cumulée des deux flancs obliques.' },
        ] },
      ] },
      { label: 'Caractéristiques', groups: [
        { title: 'Caractéristiques mécaniques de la section brute', flex: 4, cols: 4, fields: [
          { k: 'S', code: 'S', label: 'aire', unit: 'm²', dec: 4, help: 'Aire de la section brute de béton (recalculée à partir du coffrage ; seule donnée à garder pour une section quelconque).' },
          { k: 'I', code: 'I', label: 'inertie', unit: 'm⁴', dec: 6, help: 'Inertie brute de la section de béton par rapport à son centre de gravité.' },
          { k: 'V', code: 'V', label: 'fibre sup.', unit: 'm', dec: 3, help: 'Distance du centre de gravité de la section brute à la fibre supérieure.' },
          { k: 'VP', code: 'V\'', label: 'fibre inf.', unit: 'm', dec: 3, help: 'Distance du centre de gravité de la section brute à la fibre inférieure.' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true, 'sect') },

    { id: 'charg', label: 'Charges', view: 'coupe', caption: 'charges permanentes et fascicule 61 titre II', hint: 'Classe du pont, charges permanentes caractéristiques et charges d\'exploitation.', pages: [
      { label: 'Permanentes', groups: [
        { title: 'Classe', flex: 1, cols: 1, fields: [
          { k: 'STA', code: 'STATUT', label: 'classe du pont', type: 'sel', opts: [[100, '100 — 1re classe'], [200, '200 — 2e classe'], [300, '300 — 3e classe'], [0, '000 — fasc. 61 de 1960']], help: 'STATUT : 100, 200, 300 selon que le pont est de 1re, 2e ou 3e classe (F 61 II art. 3).' },
        ] },
        { title: 'Poids propre de l\'ossature', alt: true, flex: 3, cols: 3, fields: [
          { k: 'MASVO', code: 'MASVOL', label: 'masse volumique', unit: 't/m³', dec: 3, help: 'Valeur probable de la masse volumique du béton.', def: '2,500' },
          { k: 'OSSAX', code: 'OSSAM', label: 'coef. max', dec: 3, help: 'Coefficient multiplicateur pour la valeur caractéristique maximale du poids de l\'ossature.', def: '1,020' },
          { k: 'OSSAN', code: 'OSSAm', label: 'coef. min', dec: 3, help: 'Coefficient multiplicateur pour la valeur caractéristique minimale du poids de l\'ossature.', def: '0,980' },
        ] },
        { title: 'Superstructures', flex: 2, cols: 2, fields: [
          { k: 'QSUPX', code: 'QSUPTM', label: 'max', unit: 't/ml', dec: 3, help: 'Valeur caractéristique maximale du poids des superstructures (équipements ne concourant pas à la résistance), par mètre de tablier.' },
          { k: 'QSUPN', code: 'QSUPTm', label: 'min', unit: 't/ml', dec: 3, help: 'Valeur caractéristique minimale du poids des superstructures, par mètre de tablier.' },
        ] },
      ] },
      { label: 'Exploitation', groups: [
        { title: 'Charges d\'exploitation (fascicule 61 titre II)', flex: 4, cols: 4, fields: [
          { k: 'A', code: 'A', label: 'charge A', type: 'sel', opts: [[1, '001 — A(l) réglementaire'], [100, '100 — A généralisée']], help: 'A. 001 : charge A(l) du fascicule 61 ; 100 : charge A généralisée (passerelle, voie ferrée…) définie par la carte B3 du bordereau.' },
          { k: 'B', code: 'B', label: 'charge B', type: 'sel', opts: [[1, '001 — Bc et Bt'], [0, '000 — aucune'], [100, '100 — BG seuls'], [101, '101 — B + BG']], help: 'B. 001 : camions Bc et tandems Bt selon la classe ; 100/101 : camions généralisés BG (lignes B1 et B2).' },
          { k: 'CE', code: 'CE', label: 'caractère particulier', type: 'sel', opts: [[0, '000 — aucune'], [3, '003 — Mc80'], [4, '004 — Mc120'], [10, '010 — convoi D'], [14, '014 — D + Mc120'], [20, '020 — D et E'], [23, '023 — D, E + Mc80'], [24, '024 — D, E + Mc120']], help: 'CE = imj : i charges généralisées (lignes B4), m convois exceptionnels (1 : D ; 2 : D et E), j charges militaires (3 : Mc80 ; 4 : Mc120).' },
          { k: 'TROT', code: 'PSTROT', label: 'charge trottoirs', unit: 't/m²', dec: 3, help: 'Charge générale des trottoirs : 0 pour une plateforme autoroutière, 0,150 pour la voirie ordinaire.' },
        ] },
      ] },
      { label: 'Répartition imposée', groups: [
        { title: 'Coefficients de répartition transversale imposés (seulement si EXCENTR = 0)', flex: 5, cols: 5, fields: [
          { k: 'KA', code: 'KA', label: 'charge A', dec: 3, help: 'Coefficient correctif de répartition pour A, incluant a1 et l\'excentrement (EXCENTR = 0 seulement).' },
          { k: 'KBC', code: 'KBC', label: 'Bc', dec: 3, help: 'Coefficient correctif pour Bc, incluant bc et l\'excentrement (EXCENTR = 0 seulement).' },
          { k: 'KBT', code: 'KBT', label: 'Bt', dec: 3, help: 'Coefficient correctif pour Bt (EXCENTR = 0 seulement).' },
          { k: 'KCM', code: 'KCM', label: 'char militaire', dec: 3, help: 'Coefficient correctif pour le char militaire (EXCENTR = 0 seulement).' },
          { k: 'KTR', code: 'KTR', label: 'trottoirs', dec: 3, help: 'Coefficient correctif pour la charge des trottoirs (EXCENTR = 0 seulement).' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true, 'loads') },

    { id: 'mat', label: 'Matériaux', view: 'coupe', caption: 'classe de vérification BPEL, béton, aciers passifs', hint: 'Contraintes en t/m² (1 MPa ≈ 101,97 t/m²) ; classe de vérification BPEL.', pages: [
      { label: 'Classe et béton', groups: [
        { title: 'Classe de vérification', alt: true, flex: 3, cols: 3, fields: [
          { k: 'GEN', code: 'GENRE', label: 'classe BPEL', type: 'sel', opts: [[201, '201 — classe II'], [101, '101 — classe I'], [301, '301 — classe III']], help: 'GENRE. 101 : classe I ; 201 : classe II (cas courant) ; 301 : classe III des règles BPEL. 0.1 : classe extra-réglementaire (carte C1).' },
          { k: 'BP', code: 'BP', label: 'BP généralisé', type: 'int', help: 'À remplir seulement en classe extra-réglementaire pour modifier les coefficients et modules (carte C3). Normalement 000.' },
          { k: 'PSI1', code: 'ψ1', label: 'fréquente', dec: 2, help: 'Fraction des charges d\'exploitation sans caractère particulier prise dans la combinaison fréquente (ELS).' },
        ] },
        { title: 'Béton', flex: 3, cols: 3, fields: [
          { k: 'POIS', code: 'POISSON', label: 'Poisson', dec: 2, help: 'Coefficient de Poisson du béton.' },
          { k: 'FCJ', code: 'fcj', label: 'à la mise en tension', unit: 't/m²', dec: 0, help: 'Résistance caractéristique en compression à la mise en précontrainte (3000 t/m² ≈ 29,4 MPa).' },
          { k: 'FC28', code: 'fc28', label: 'à 28 jours', unit: 't/m²', dec: 0, help: 'Résistance caractéristique à 28 jours. Minimum 2500 t/m² (dalle rectangulaire), 3000 t/m² (larges encorbellements).' },
        ] },
      ] },
      { label: 'Aciers passifs', groups: [
        { title: 'Armatures passives', flex: 3, cols: 3, fields: [
          { k: 'FE1', code: 'fe1', label: 'long. et transv.', unit: 't/m²', dec: 0, help: 'Limite d\'élasticité des armatures longitudinales et transversales (50 000 t/m² ≈ 490 MPa).' },
          { k: 'FE2', code: 'fe2', label: 'cadres', unit: 't/m²', dec: 0, help: 'Limite d\'élasticité des armatures verticales (cadres, étriers).' },
          { k: 'ETA', code: 'η', label: 'fissuration', dec: 3, help: 'Coefficient de fissuration des armatures passives (1,6 pour les HA).', def: '1,600' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true, 'mat') },

    { id: 'prec', label: 'Précontrainte', view: 'cable', caption: 'procédé, unité et gaine', hint: 'Procédé et unité de précontrainte. σp0 ≤ min(0,80 fprg ; 0,90 fpeg).', pages: [
      { label: 'Procédé', groups: [
        { title: 'Procédé', flex: 2, cols: 2, fields: [
          { k: 'PROCEDE', code: 'PROCEDE', label: 'nom', type: 'txt', help: 'Nom du procédé de précontrainte en toutes lettres, 10 caractères au plus (FREYSSINET, VSL…).' },
          { k: 'UNITE', code: 'UNITE', label: 'unité', type: 'txt', help: 'Unité de précontrainte, 8 caractères au plus (12T15S, 12T13…).' },
        ] },
        { title: 'Acier de précontrainte', alt: true, flex: 4, cols: 4, fields: [
          { k: 'FPRG', code: 'fprg', label: 'rupture', unit: 't/m²', dec: 0, help: 'Contrainte de rupture garantie (1860 MPa ≈ 189 670 t/m²).' },
          { k: 'FPEG', code: 'fpeg', label: 'élasticité', unit: 't/m²', dec: 0, help: 'Contrainte limite conventionnelle d\'élasticité garantie.' },
          { k: 'SIGMAP0', code: 'σp0', label: 'tension initiale', unit: 't/m²', dec: 0, help: 'Tension à l\'origine : la plus petite de 0,80 fprg et 0,90 fpeg (et de la contrainte maximale agréée).' },
          { k: 'EP', code: 'Ep', label: 'module', unit: 't/m²', dec: 0, help: 'Module d\'élasticité : 19 400 000 t/m² pour les torons, 20 400 000 t/m² pour fils et barres.' },
        ] },
      ] },
      { label: 'Câbles et gaines', groups: [
        { title: 'Câbles', flex: 2, cols: 2, fields: [
          { k: 'NCA', code: 'NCAB', label: 'nb de câbles', type: 'int', help: 'Nombre d\'armatures : seulement en vérification d\'un câblage donné (CABL = 4) ; le programme retient le plus grand du nombre donné et du nombre calculé.' },
          { k: 'SECT', code: 'SECAB', label: 'section', unit: 'mm²', dec: 0, help: 'Section d\'acier d\'une armature en mm² (seule donnée hors tonne et mètre) : 12T15S = 1800 mm².' },
        ] },
        { title: 'Gaine et enrobages', alt: true, flex: 5, cols: 5, fields: [
          { k: 'DGAIN', code: 'DGAINE', label: 'Ø gaine', unit: 'm', dec: 3, help: 'Diamètre d\'encombrement de la gaine.' },
          { k: 'COUVS', code: 'COUVS', label: 'enrobage sup.', unit: 'm', dec: 3, help: 'Couverture minimale de béton au-dessus de la gaine en son point haut (à corriger si la dalle est bombée).' },
          { k: 'COUVI', code: 'COUVI', label: 'enrobage inf.', unit: 'm', dec: 3, help: 'Couverture minimale de béton en dessous de la gaine en son point bas.' },
          { k: 'DECAL', code: 'DECALAGE', label: 'décalage', unit: 'm', dec: 3, help: 'Écart, dans les parties courbes, entre le centre de gravité des aciers et l\'axe de la gaine. Valeur conseillée 0,11 DGAINE.' },
          { k: 'RMIN', code: 'RMIN', label: 'rayon min.', unit: 'm', dec: 3, help: 'Rayon de courbure minimal des gaines (agrément du procédé).' },
        ] },
      ] },
    ], schema: (svg) => drawCable(svg, GEN, true) },

    { id: 'pertes', label: 'Pertes', view: 'tension', caption: 'tension le long du câble', hint: 'Pertes instantanées (frottement, recul d\'ancrage) et différées (retrait, relaxation, fluage).', pages: [
      { label: 'Frottement et recul', groups: [
        { title: 'Pertes instantanées', flex: 4, cols: 4, fields: [
          { k: 'MOD', code: 'MODE', label: 'ancrages', type: 'sel', opts: [[0, '0 — aux deux bouts'], [3, '3 — aux deux bouts'], [1, '1 — à gauche'], [2, '2 — à droite'], [4, '4 — alternés']], help: 'MODE : 0 ou 3, câbles tendus par les deux extrémités ; 1 par la gauche ; 2 par la droite ; 4 alternativement une unité sur deux.' },
          { k: 'F', code: 'f', label: 'frottement', unit: '/rad', dec: 2, help: 'Coefficient de frottement dans les courbes (f·α).' },
          { k: 'PHI', code: 'φ', label: 'déviation parasite', unit: '/m', dec: 4, help: 'Perte relative de tension par mètre (φ·x). Pont courbe en plan : φ\' = φ + f/R.' },
          { k: 'RECUL', code: 'RECULAN', label: 'recul d\'ancrage', unit: 'm', dec: 4, help: 'Rentrée d\'ancrage au blocage (glissement g).' },
        ] },
      ] },
      { label: 'Pertes différées', groups: [
        { title: 'Retrait, relaxation, fluage', alt: true, flex: 5, cols: 5, fields: [
          { k: 'EPSI0', code: 'εr', label: 'retrait', unit: '10⁻⁴', dec: 3, help: 'Raccourcissement de retrait à prendre en compte (en 10⁻⁴) : 3 dans le quart sud-est de la France, 2 ailleurs (climat sec : davantage).' },
          { k: 'RO', code: 'ρ1000', label: 'relaxation', unit: '%', dec: 2, help: 'Relaxation à 1000 heures : 2,5 % pour les aciers TBR (conseillé), 8 % pour RN.' },
          { k: 'MU0', code: 'μ0', label: 'coef. relax.', dec: 2, help: 'Coefficient μ0 de la loi de relaxation : 0,43 pour TBR, 0,30 pour RN.' },
          { k: 'KFL', code: 'Kfl', label: 'fluage', dec: 2, help: 'Facteur de fluage du béton : 2 dans les cas courants (voir annexe du BPEL pour un béton jeune).' },
          { k: 'RT', code: 'r(j)', label: 'à la mise en service', dec: 3, help: 'Fraction des pertes différées effectuées à la mise en service : 0,50 dans les cas courants (≥ 90 jours).' },
        ] },
      ] },
    ], schema: (svg) => drawTension(svg, GEN, true) },

    { id: 'cotes', label: 'Tracé imposé', view: 'elev', caption: 'cotes de l\'axe du câble aux dixièmes de portée', hint: 'En câblage imposé (CABL = 4), cotes de l\'axe du câble par rapport à la sous-dalle aux dixièmes de chaque portée.',
      get pages() {
        const m = CUR; const out = [cotesBase];
        if (m && V(m, 'CABL') === 4) { const n = Math.max(1, Math.min(6, Math.round(V(m, 'NT')) || 1)); for (let t = 0; t < n; t++) out.push(cotesPage(t)); }
        return out;
      },
      schema: (svg) => drawElev(svg, GEN, true, 'cotes') },

    { id: 'tass', label: 'Tassements', view: 'elev', caption: 'tassements probables et aléatoires par appui', hint: 'À remplir si TASMENT = 2 : tassements probables TP et aléatoires ΔTP de chaque appui (NT + 1 appuis).', pages: [
      { label: 'Paramètres', groups: [
        { title: 'Tassements d\'appui (ligne A12)', flex: 3, cols: 3, fields: [
          { k: 'DSIG', code: 'Δσ', label: 'variation σ adm.', unit: 't/m²', dec: 0, help: 'Limite de variation de la contrainte admissible de traction du béton en présence des tassements aléatoires (combinaison rare).' },
          { k: 'YOUNG', code: 'YOUNG', label: 'module différé', dec: 3, help: 'Valeur entre 3 et 4 : le programme utilise Ei28/YOUNG pour les effets des tassements. Sauf précision du marché, YOUNG = 1 + Kfluage.' },
          { k: 'KTP', code: 'KTP', label: 'fraction ELS', dec: 3, help: 'Fraction des tassements à prendre en compte dans l\'étude aux ELS.' },
        ] },
      ] },
      { label: 'Probables', groups: [
        { title: 'Tassements probables par appui', alt: true, flex: 7, cols: 7, fields: [1, 2, 3, 4, 5, 6, 7].map(i => ({ k: 'TP' + i, code: 'TP' + i, label: 'appui ' + i, unit: 'm', dec: 3, help: `Tassement probable de l'appui ${i} (appuis numérotés de gauche à droite, NT + 1 appuis).` })) },
      ] },
      { label: 'Aléatoires', groups: [
        { title: 'Tassements supplémentaires aléatoires par appui', flex: 7, cols: 7, fields: [1, 2, 3, 4, 5, 6, 7].map(i => ({ k: 'DTP' + i, code: 'ΔTP' + i, label: 'appui ' + i, unit: 'm', dec: 3, help: `Tassement supplémentaire aléatoire de l'appui ${i}.` })) },
      ] },
    ], schema: (svg) => drawElev(svg, GEN, true, 'tass') },

    { id: 'app', label: 'Appareils d\'appui', view: 'plan', caption: 'dimensionnement des appareils d\'appui (ligne A13)', hint: 'Contraintes moyennes admissibles et, pour chaque ligne d\'appui, type et nombre d\'appareils.', pages: [
      { label: 'Contraintes', groups: [
        { title: 'Élastomère fretté', flex: 2, cols: 2, fields: [
          { k: 'CNV', code: 'COMPREN V', label: 'σ moy. min', unit: 't/m²', dec: 0, help: 'Contrainte moyenne minimale admissible des appareils en élastomère (risque de cheminement) : 250 t/m² conseillé.' },
          { k: 'CNS', code: 'COMPREN S', label: 'σ moy. max', unit: 't/m²', dec: 0, help: 'Contrainte moyenne maximale admissible des appareils en élastomère : 1500 t/m² conseillé.' },
        ] },
        { title: 'Section rétrécie de béton', alt: true, flex: 2, cols: 2, fields: [
          { k: 'CBV', code: 'COMPREB V', label: 'σ moy. min', unit: 't/m²', dec: 0, help: 'Contrainte moyenne minimale admissible des articulations en béton : 2000 t/m² conseillé.' },
          { k: 'CBS', code: 'COMPREB S', label: 'σ moy. max', unit: 't/m²', dec: 0, help: 'Contrainte moyenne maximale admissible des articulations en béton : 3500 t/m² conseillé.' },
        ] },
        { title: 'Symétrie', flex: 1, cols: 1, fields: [
          { k: 'SYMAP', code: 'SYMAP', label: 'symétrie', type: 'sel', opts: [[0, '0 — aucune'], [1, '1 — longitudinale'], [2, '2 — piles identiques']], help: 'Symétrie longitudinale des appareils : 0 aucune ; 1 symétrie longitudinale ; 2 appareils des appuis intermédiaires tous identiques.' },
        ] },
      ] },
      { label: 'Types', groups: [
        { title: 'Type d\'appareil par ligne d\'appui (0 Freyssinet · 1 élastomère · 2 autre)', alt: true, flex: 7, cols: 7, fields: [1, 2, 3, 4, 5, 6, 7].map(i => ({ k: 'TYPAP' + i, code: 'TYPAP', label: 'appui ' + i, type: 'sel', opts: [[1, '1 — élastomère'], [0, '0 — Freyssinet'], [2, '2 — autre']], help: `Type d'appareil sur l'appui ${i} : 0 articulation Freyssinet, 1 élastomère fretté, 2 autre type.` })) },
      ] },
      { label: 'Nombres', groups: [
        { title: 'Nombre d\'appareils par ligne d\'appui', flex: 7, cols: 7, fields: [1, 2, 3, 4, 5, 6, 7].map(i => ({ k: 'NAP' + i, code: 'NAP', label: 'appui ' + i, type: 'int', help: `Nombre d'appareils d'appui sur la ligne d'appui ${i}.` })) },
      ] },
    ], schema: (svg) => drawPlan(svg, GEN, true) },
  ];

  /* ───── modèle générique des schémas de principe ───── */
  const GEN = { values: {
    NT: 4, BIAIS: 72, ABOUT: 0.75, D1: 14, D2: 20, D3: 20, D4: 14, ND1: 10, ND2: 12, ND3: 12, ND4: 10,
    NV: 2, ETROG: 1.2, EGAU: 0.5, ESURCH: 6, EDROI: 0.5, ETROD: 1.2, HCHAU: 0.08, SYM: 1,
    HDAL1: 0.8, HDAL2: 0.3, HDAL3: 0.5, EDAL1: 5.6, EDAL2: 3.8, EDAL3: 0.5,
    NCA: 8, SECT: 1800, UNITE: '12T15S', DGAIN: 0.085, COUVS: 0.11, COUVI: 0.09, DECAL: 0.01, RMIN: 8, SIGMAP0: 148800, EP: 19400000,
    F: 0.2, PHI: 0.002, RECUL: 0.006, MOD: 0, CABL: 1, NAP1: 3, NAP2: 4, NAP3: 4, NAP4: 4, NAP5: 3, TYPAP1: 1,
  }, cotes: null };
  GEN.values.VP = section(GEN).VP;

  /* ───── dessins ───── */
  const L_ = (m, k, sch, d, u, code) => sch ? (code || k) : fmt(V(m, k), d == null ? 2 : d) + (u || '');
  const supK = i => `TYPAP${i + 1} NAP${i + 1} TP${i + 1} DTP${i + 1}`;
  const ndk = n => Array.from({ length: n }, (_, i) => 'ND' + (i + 1)).join(' ');

  /* élévation longitudinale ; mode : 'opts' | 'tass' | 'cotes' | undefined */
  function drawElev(svg, m, sch, mode) {
    const g = geo(m);
    const ex = Math.max(1, Math.min(40, g.Lt / (10 * g.H)));
    const Hd = g.H * ex, hp = Hd * 1.6, xa = -g.ab, xb = g.Lt + g.ab;
    const top = Hd * (mode === 'opts' ? 3.6 : 2.7), bot = -hp - Hd * (mode === 'tass' ? 1.5 : 0.9);
    const d = svg({ x0: xa - g.Lt * 0.05, y0: bot, x1: xb + g.Lt * 0.02, y1: top }, { pad: 0.035 });
    const u = d.u;
    d.soil([[xa - g.Lt * 0.05, -hp], [xb + g.Lt * 0.02, -hp]], Hd * 0.35);
    // appuis
    const pw = Math.max(Hd * 0.32, g.Lt * 0.006), ap = Hd * 0.12;
    for (let i = 0; i <= g.n; i++) {
      const x = g.X[i], k = supK(i);
      if (i === 0 || i === g.n) {
        const s = i === 0 ? -1 : 1;
        d.poly([[x - s * pw * 1.2, -ap], [x + s * (g.ab + pw * 1.6), -ap], [x + s * (g.ab + pw * 1.6), -hp], [x - s * pw * 1.8, -hp]], 'b2', k);
      } else d.rect(x - pw / 2, -hp, pw, hp - ap, 'b2', k);
      d.rect(x - pw * 0.65, -ap, pw * 1.3, ap, 'b', k);
      d.text(x, -hp - Hd * 0.32, 'A' + (i + 1), { size: 0.85, cls: 'ts', k });
    }
    // tablier, chaussée
    d.rect(xa, 0, xb - xa, Hd, 'b', 'HDAL1 ABOUT');
    d.rect(xa, Hd, xb - xa, Math.max(V(m, 'HCHAU') * ex, u * 0.35), 'road', 'HCHAU');
    // câble
    const c = cable(m, g), Z = z => z * ex;
    const pts = c.pts.map(p => [p[0], Z(p[1])]);
    pts.unshift([xa + u * 0.6, pts[0][1]]); pts.push([xb - u * 0.6, pts[pts.length - 1][1]]);
    d.path(pts, 'cab', 'CABL NCA PROCEDE UNITE SECT ' + (c.imposed ? 'COT' : ''));
    // sections de cotes ND (ou points imposés)
    for (let t = 0; t < g.n; t++) {
      const nd = Math.max(1, Math.round(V(m, 'ND' + (t + 1))) || 10), k = 'ND' + (t + 1);
      if (c.imposed) { for (let j = 0; j <= 10; j++) d.circle(g.X[t] + g.L[t] * j / 10, Z(num(c.P[t][j])), u * 0.32, 'cabpt', `COT.${t}.${j}`); continue; }
      for (let j = 1; j < nd; j++) { const x = g.X[t] + g.L[t] * j / nd; d.line(x, -u * 0.15, x, u * 0.55, 'l', k); }
    }
    // ancrages
    d.rect(xa, Z(c.zc) - u * 0.6, u * 0.6, u * 1.2, 'b2', 'MOD');
    d.rect(xb - u * 0.6, Z(c.zc) - u * 0.6, u * 0.6, u * 1.2, 'b2', 'MOD');
    // cotes des travées
    const yD = Hd + Math.max(V(m, 'HCHAU') * ex, u * 0.35) + Hd * 0.55;
    for (let t = 0; t < g.n; t++) d.dim(g.X[t], yD, g.X[t + 1], yD, L_(m, 'D' + (t + 1), sch, 2), 0.001, 'D' + (t + 1) + ' NT');
    if (g.ab > 0) { d.dim(xa, yD, 0, yD, '', 0.001, 'ABOUT'); d.dim(g.Lt, yD, xb, yD, '', 0.001, 'ABOUT'); d.text(xa - u * 0.4, yD + u * 1.6, sch ? 'ABOUT' : fmt(g.ab, 2), { size: 0.8, a: 'start', cls: sch ? 'tc' : 'dv', k: 'ABOUT' }); }
    d.dim(xa, yD + Hd * 0.75, xb, yD + Hd * 0.75, sch ? 'ABOUT + D1 + … + D' + g.n + ' + ABOUT' : 'longueur ' + fmt(xb - xa, 2) + ' m · ' + g.n + ' travée' + (g.n > 1 ? 's' : ''), 0.001, 'NT ABOUT');
    d.dim(xa, 0, xa, Hd, L_(m, 'HDAL1', sch, 3), g.Lt * 0.013, 'HDAL1', { size: 0.85 });
    // enrobages et rayon (sur la première zone d'appui intermédiaire et le premier point bas)
    if (c.low.length && mode !== 'opts') {
      const xl = c.low[0][0] - g.L[0] * 0.1;
      d.dim(xl, 0, xl, Z(V(m, 'COUVI')), L_(m, 'COUVI', sch, 3), u * 0.9, 'COUVI', { size: 0.7 });
      d.circle(c.low[0][0], Z(c.low[0][1]), u * 0.35, 'cabpt', 'COUVI DGAIN DECAL');
    }
    if (g.n > 1 && !c.imposed && mode !== 'opts') {
      const xs = g.X[1];
      d.dim(xs + u * 0.6, Hd - Z(V(m, 'COUVS')), xs + u * 0.6, Hd, L_(m, 'COUVS', sch, 3), -u * 0.6, 'COUVS', { size: 0.7 });
      const r = c.radii.find(q => Math.abs(q.x - xs) < 1e-6);
      d.text(xs + u * 2.2, Z(c.zhi) - Hd * 0.3, sch ? 'R ≥ RMIN' : 'R ≈ ' + fmt(r ? r.R : V(m, 'RMIN'), 1) + ' m', { size: 0.7, a: 'start', cls: sch ? 'tc' : 'dv', k: 'RMIN' });
    }
    if (!sch && Math.abs(V(m, 'BIAIS') - 100) > 1e-6) d.text(xb, bot + Hd * 0.25, 'biais ' + fmt(V(m, 'BIAIS'), 2) + ' gr', { size: 0.8, a: 'end', cls: 'dv', k: 'BIAIS' });
    if (ex > 1.5 || c.imposed) d.text(xa, bot + Hd * 0.25, (sch ? 'schéma' : 'échelle') + (ex > 1.5 ? ' · hauteurs × ' + fmt(ex, 0) : '') + (c.imposed ? ' · tracé imposé (CABL = 4)' : ''), { size: 0.75, a: 'start', cls: 'ts', k: c.imposed ? 'CABL' : null });
    // compléments
    if (mode === 'opts') {
      const t1 = Math.min(1, g.n - 1), x1 = g.X[t1], l1 = g.L[t1];
      const yM = yD + Hd * 1.6, mPts = [];
      for (let i = 0; i <= 60; i++) { const x = g.X[0] + g.Lt * i / 60; let t = 0; while (t < g.n - 1 && x > g.X[t + 1]) t++; const s = (x - g.X[t]) / g.L[t]; mPts.push([x, yM + Hd * 0.5 * (Math.sin(Math.PI * s) - 0.55 * ((t > 0 ? 1 - s : 0) + (t < g.n - 1 ? s : 0)) ** 3)]); }
      d.path(mPts, 'l', 'MOME MOME2');
      d.text(x1 + l1 * 0.5, yM + Hd * 0.85, 'MOME · EFTR', { cls: 'tc', size: 0.8, k: 'MOME EFTR MOME2' });
      d.text(g.X[0] + g.L[0] * 0.5, yM + Hd * 0.85, 'LIGNINF · EXCENTR', { cls: 'tc', size: 0.8, k: 'LIGN EXCE LIGN2 EXCE2' });
      for (let i = 0; i <= g.n; i++) d.line(g.X[i], -ap - Hd * 0.05, g.X[i], -ap - Hd * 0.8, 'arw', 'REAP DIMA');
      d.text(g.X[g.n] - u * 0.6, -Hd * 0.62, 'REAP · DIMAP', { cls: 'tc', size: 0.75, a: 'end', k: 'REAP DIMA' });
      d.text(x1 + l1 * 0.55, Z(c.zlo) + Hd * 0.35, 'CABLAGE · DESSIN', { cls: 'tc', size: 0.75, k: 'CABL DES CABL2' });
      d.text(x1 + l1 * 0.5, -hp * 0.55, 'DEFORM', { cls: 'tc', size: 0.75, k: 'DEFO' });
      const df = []; for (let i = 0; i <= 20; i++) { const s = i / 20; df.push([x1 + l1 * s, -Hd * 0.1 - Hd * 0.35 * Math.sin(Math.PI * s)]); }
      d.path(df, 'cab2', 'DEFO');
      d.text(g.X[t1 + 1 <= g.n ? t1 + 1 : g.n] + l1 * 0.35, -hp * 0.55, 'FERTRAN · ETRIERS · MOTRAN', { cls: 'tc', size: 0.7, k: 'FERT ETRI MOTR MOTR2 POIN' });
      d.text(g.X[0] + g.L[0] * 0.5, -hp * 0.55, 'TASMENT', { cls: 'tc', size: 0.75, k: 'TASM' });
      d.text(xb, yM + Hd * 0.2, 'METRE · P.P.', { cls: 'tc', size: 0.7, a: 'end', k: 'METRE PP' });
    }
    if (mode === 'tass') {
      for (let i = 0; i <= g.n; i++) {
        const x = g.X[i], y0 = -hp - Hd * 0.55, k = `TP${i + 1} DTP${i + 1} KTP YOUNG`;
        d.line(x, y0, x, y0 - Hd * 0.5, 'arr', k);
        d.poly([[x - u * 0.45, y0 - Hd * 0.42], [x + u * 0.45, y0 - Hd * 0.42], [x, y0 - Hd * 0.6]], 'b', k);
        d.text(x + (i === g.n ? -u * 0.8 : u * 0.8), y0 - Hd * 0.25, sch ? `TP${i + 1} ± ΔTP${i + 1}` : fmt(V(m, 'TP' + (i + 1)) * 100, 1) + ' ± ' + fmt(V(m, 'DTP' + (i + 1)) * 100, 1) + ' cm', { size: 0.7, a: i === g.n ? 'end' : 'start', cls: sch ? 'tc' : 'dv', k });
      }
    }
    if (mode === 'cotes' && sch) {
      const t = 1 < g.n ? 1 : 0, cc = cableAuto(m, g);
      for (let j = 0; j <= 10; j++) {
        const x = g.X[t] + g.L[t] * j / 10; let best = cc.pts[0]; for (const p of cc.pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
        d.line(x, 0, x, Z(best[1]), 'l', 'COT'); d.circle(x, Z(best[1]), u * 0.35, 'cabpt', 'COT');
        if (j % 2 === 0) d.text(x, -Hd * 0.3, DLAB[j], { size: 0.65, cls: 'tc' });
      }
      d.text(g.X[t] + g.L[t] / 2, -Hd * 0.75, 'cotes depuis l\'intrados aux dixièmes de la travée', { size: 0.7, cls: 'ts' });
    }
    return d.toString();
  }

  /* coupe transversale ; mode : 'sect' | 'loads' | 'mat' | undefined
     vue à l'échelle de toute la dalle + détail agrandi de l'encorbellement et des premiers câbles */
  let CLIPN = 0;
  function drawCoupe(svg, m, sch, mode) {
    const H1 = V(m, 'HDAL1') || 0.8, H2 = Math.min(V(m, 'HDAL2'), H1), H3 = Math.min(V(m, 'HDAL3'), H1);
    const E1 = V(m, 'EDAL1') || 5, E2 = Math.max(0, V(m, 'EDAL2')), E3 = Math.min(Math.max(0, V(m, 'EDAL3')), E2);
    const a = E1 / 2, c = E2 / 2, Wd = E1 + E2;
    const ws = ['ETROG', 'EGAU', 'ESURCH', 'EDROI', 'ETROD'].map(k => Math.max(0, V(m, k)));
    const Wp = ws.reduce((x, y) => x + y, 0) || Wd;
    const hc = V(m, 'HCHAU'), ht = 0.2;
    const W = Math.max(Wd, Wp);
    const yT = H1 + hc + ht;
    const loads = mode === 'loads', mat = mode === 'mat', detail = !loads && !mat;
    const n = Math.round(V(m, 'NCA')), dg = Math.max(V(m, 'DGAIN'), 0.03), ci = V(m, 'COUVI'), cs = V(m, 'COUVS');
    const nn = n > 0 ? n : Math.max(4, Math.round((E1 - 0.6) / 0.6) + 1), ghost = !(n > 0);
    const mg = Math.max(0.3, dg), x0 = -a + mg, sp = nn > 1 ? (2 * (a - mg)) / (nn - 1) : 0;
    const ductX = i => nn > 1 ? x0 + sp * i : 0;
    // détail
    const xd0 = -a - c - 0.12, xd1 = -a + Math.max(1.3, mg + sp * 2.4);
    const kd = Math.max(1.5, Math.min(6, W * 0.9 / (xd1 - xd0)));
    const ox = -kd * (xd0 + xd1) / 2, oy = -1.45 - kd * (yT + 0.05);
    const y0 = detail ? oy - 1.05 : -1.15, y1 = yT + (loads ? 4.3 : 1.55);
    const d = svg({ x0: -W / 2 - 0.9, y0, x1: W / 2 + 1.35, y1 }, { pad: 0.03 });
    const u = d.u;
    const kSec = 'HDAL1 HDAL2 HDAL3 EDAL1 EDAL2 EDAL3 S I';
    const P = E2 > 0 ? [[-a, 0], [a, 0], [a + E3 / 2, H3], [a + c, H1 - H2], [a + c, H1], [-a - c, H1], [-a - c, H1 - H2], [-a - E3 / 2, H3]] : [[-a, 0], [a, 0], [a, H1], [-a, H1]];
    const xs = [-Wp / 2]; ws.forEach(w => xs.push(xs[xs.length - 1] + w));
    const nv = Math.max(1, Math.round(V(m, 'NV')) || 1);
    const sc = section(m), VP = V(m, 'VP') > 0 ? V(m, 'VP') : sc.VP;
    /* dessin de la dalle, éventuellement transformé (k, dx, dy) */
    const body = (k, dx, dy) => {
      const T = (x, y) => [dx + k * x, dy + k * y];
      d.poly(P.map(p => T(p[0], p[1])), 'b', kSec);
      const r = (x, y, w, h, cls, kk) => { const p = T(x, y); d.rect(p[0], p[1], w * k, h * k, cls, kk); };
      r(xs[1], H1, xs[4] - xs[1], Math.max(hc, u * 0.3 / k), 'road', 'HCHAU EGAU ESURCH EDROI');
      if (ws[0] > 0) r(xs[0], H1, ws[0], hc + ht, 'b2', 'ETROG');
      if (ws[4] > 0) r(xs[4], H1, ws[4], hc + ht, 'b2', 'ETROD');
      for (let i = 1; i < nv; i++) { const x = xs[2] + ws[2] * i / nv, p = T(x, H1 + hc * 0.15), q = T(x, H1 + Math.max(hc, u * 0.3 / k) * 0.85); d.line(p[0], p[1], q[0], q[1], 'lane', 'NV'); }
      const gl = (x, kk) => { const p = T(x, H1 + hc), q = T(x, H1 + hc + 0.6); d.line(p[0], p[1], q[0], q[1], 'l', kk); };
      if (V(m, 'EGAU') > 0) gl(xs[2], 'EGAU');
      if (V(m, 'EDROI') > 0) gl(xs[3], 'EDROI');
      const g1 = T(-a - c * 0.2, VP), g2 = T(a + c + 0.25, VP); d.line(g1[0], g1[1], g2[0], g2[1], 'ax', 'V VP');
      if (!loads && !mat) for (let i = 0; i < nn; i++) {
        const x = ductX(i), p = T(x, ci + dg / 2), q = T(x, H1 - cs - dg / 2);
        d.circle(p[0], p[1], dg / 2 * k, 'duct' + (ghost ? ' ghost' : ''), 'NCA DGAIN COUVI');
        d.circle(q[0], q[1], dg / 2 * k, 'ductup', 'NCA DGAIN COUVS');
        if (k > 1 && !ghost) { const { n: ns, ds } = strandsOf(m); bundle(ns, ds, dg / 2, true).forEach(s => d.circle(p[0] + s[0] * k, p[1] + s[1] * k, ds / 2 * k, 'strand', 'UNITE')); }
      }
      return T;
    };
    body(1, 0, 0);
    d.line(0, -0.5, 0, yT + 0.35, 'ax', 'SYM DISEXT DISINT');
    if (mat) {
      for (let i = 0; i <= 18; i++) { const x = -a + 0.12 + (E1 - 0.24) * i / 18; d.circle(x, 0.06, 0.025, 'bar', 'FE1'); d.circle(x, H1 - 0.06, 0.025, 'bar', 'FE1'); }
      for (let i = 0; i <= 11; i++) { const x = -a - c + 0.15 + (a + c - 0.15) * 2 * i / 11; if (Math.abs(x) > a) d.circle(x, H1 - 0.06, 0.02, 'bar', 'FE1'); }
      d.rect(-a * 0.62, 0.035, a * 0.36, H1 - 0.07, 'l', 'FE2'); d.rect(a * 0.26, 0.035, a * 0.36, H1 - 0.07, 'l', 'FE2');
      d.text(0, H1 * 0.5, sch ? 'fcj · fc28 · POISSON' : 'fcj ' + fmt(V(m, 'FCJ') / 101.97, 1) + ' MPa · fc28 ' + fmt(V(m, 'FC28') / 101.97, 1) + ' MPa', { size: 0.8, cls: sch ? 'tc' : 'dv', k: 'FCJ FC28 POIS' });
      d.text(-a * 0.44, -0.3, sch ? 'fe2 (cadres)' : 'cadres fe2 ' + fmt(V(m, 'FE2') / 101.97, 0) + ' MPa', { size: 0.7, cls: sch ? 'tc' : 'dv', k: 'FE2' });
      d.text(a * 0.5, -0.3, sch ? 'fe1 · η (aciers longitudinaux)' : 'aciers fe1 ' + fmt(V(m, 'FE1') / 101.97, 0) + ' MPa · η ' + fmt(V(m, 'ETA'), 2), { size: 0.7, cls: sch ? 'tc' : 'dv', k: 'FE1 ETA' });
      d.text(0, yT + 1.25, sch ? 'GENRE (classe BPEL) · ψ1 · BP' : 'classe ' + (['', 'I', 'II', 'III'][Math.floor(V(m, 'GEN') / 100)] || '?') + ' du BPEL · ψ1 = ' + fmt(V(m, 'PSI1'), 2), { size: 0.85, cls: sch ? 'tc' : 'dv', k: 'GEN PSI1 BP' });
    }
    // cotes du profil en travers
    const yy = yT + 0.38;
    ['ETROG', 'EGAU', 'ESURCH', 'EDROI', 'ETROD'].forEach((k, i) => { if (ws[i] > 0 || sch) d.dim(xs[i], yy, xs[i + 1], yy, L_(m, k, sch, 2), 0.001, k, { size: ws[i] < 0.8 && !sch ? 0.65 : 0.8 }); });
    if (!loads && !mat) d.dim(-Wp / 2, yy + 0.62, Wp / 2, yy + 0.62, sch ? 'ETROG + EGAU + ESURCH + EDROI + ETROD' : 'largeur ' + fmt(Wp, 2) + ' m · ' + nv + ' voie' + (nv > 1 ? 's' : ''), 0.001, 'ETROG EGAU ESURCH EDROI ETROD NV');
    if (loads) {
      const yr = yy + 0.45;
      for (let i = 0; i < nv; i++) {
        const lw = ws[2] / nv, cx = xs[2] + lw * (i + 0.5), tw = Math.min(2.5, lw * 0.85), th = 0.7;
        d.rect(cx - tw / 2, yr + 0.3, tw, th, 'car', 'B CE KBC KBT KCM'); d.circle(cx - tw * 0.38, yr + 0.15, 0.15, 'wheel'); d.circle(cx + tw * 0.38, yr + 0.15, 0.15, 'wheel');
      }
      d.text(xs[2] + ws[2] / 2, yr + 1.25, sch ? 'Bc · Bt · Mc · convois (B, CE)' : 'Bc · Bt' + (V(m, 'CE') % 10 === 4 ? ' · Mc120' : V(m, 'CE') % 10 === 3 ? ' · Mc80' : '') + (Math.floor(V(m, 'CE') / 10) % 10 ? ' · convois ' + (Math.floor(V(m, 'CE') / 10) % 10 === 2 ? 'D et E' : 'D') : ''), { size: 0.75, cls: sch ? 'tc' : 'dv', k: 'B CE KBC KBT KCM' });
      d.rect(xs[2], yr + 1.6, ws[2], 0.42, 'load', 'A KA');
      d.text(xs[2] + ws[2] / 2, yr + 1.81, sch ? 'A(l) sur NVOIE voies · KA' : 'A(l) — ' + nv + ' voie' + (nv > 1 ? 's' : ''), { size: 0.75, cls: sch ? 'tc' : 'dv', k: 'A KA NV' });
      for (const [i, k] of [[0, 'ETROG'], [4, 'ETROD']]) if (ws[i] > 0) { for (let j = 0; j < 3; j++) { const x = xs[i] + ws[i] * (j + 1) / 4; d.line(x, yr + 1.0, x, yT + 0.06, 'arw', 'TROT KTR'); } d.text(xs[i] + ws[i] / 2, yr + 1.25, sch ? 'PSTROT' : fmt(V(m, 'TROT'), 2) + ' t/m²', { size: 0.7, cls: sch ? 'tc' : 'dv', k: 'TROT KTR' }); }
      d.rect(-W / 2, yr + 2.3, W, 0.42, 'load', 'MASVO OSSAX OSSAN QSUPX QSUPN');
      d.text(0, yr + 2.51, sch ? 'G = S · MASVOL × OSSAM | OSSAm  +  QSUPTM | QSUPTm' : 'ossature ' + fmt(section(m).S * V(m, 'MASVO'), 2) + ' t/ml · superstructures ' + fmt(V(m, 'QSUPN'), 2) + ' à ' + fmt(V(m, 'QSUPX'), 2) + ' t/ml', { size: 0.75, cls: sch ? 'tc' : 'dv', k: 'MASVO OSSAX OSSAN QSUPX QSUPN' });
      d.text(0, yr + 3.1, sch ? 'STATUT : classe du pont' : 'pont de ' + (['', '1re', '2e', '3e'][Math.floor(V(m, 'STA') / 100)] || '?') + ' classe', { size: 0.8, cls: sch ? 'tc' : 'dv', k: 'STA' });
      d.dim(-a, -0.25, a, -0.25, L_(m, 'EDAL1', sch, 2), 0.001, 'EDAL1');
    }
    if (detail) {
      d.dim(-a, -0.25, a, -0.25, L_(m, 'EDAL1', sch, 2), 0.001, 'EDAL1');
      d.dim(a + c + 0.3, 0, a + c + 0.3, H1, L_(m, 'HDAL1', sch, 3), -0.001, 'HDAL1', { size: 0.75 });
      d.dim(a + c + 0.85, 0, a + c + 0.85, VP, sch ? 'V\'' : fmt(VP, 3), -0.001, 'VP', { size: 0.65 });
      d.dim(a + c + 0.85, VP, a + c + 0.85, H1, sch ? 'V' : fmt(H1 - VP, 3), -0.001, 'V', { size: 0.65 });
      const lab = sch ? (mode === 'sect' ? 'S · I · V · V\'' : 'NCA câbles · DGAINE') : ghost ? 'NCA = 0 : nombre de câbles calculé par le programme' : n + ' câbles ' + (m.values.UNITE || '') + ' — en travée ● · sur appui ○';
      d.text(0, -0.85, lab, { size: 0.75, cls: sch ? 'tc' : 'ts', k: sch && mode === 'sect' ? 'S I V VP' : 'NCA' });
      if (!sch && mode === 'sect') d.text(0, H1 * 0.5, 'S = ' + fmt(V(m, 'S') || sc.S, 4) + ' m² · I = ' + fmt(V(m, 'I') || sc.I, 5) + ' m⁴', { size: 0.75, cls: 'dv', k: 'S I' });
      // cadre de la zone agrandie sur la vue d'ensemble
      d.path([[xd0, -0.05], [xd1, -0.05], [xd1, yT + 0.05], [xd0, yT + 0.05], [xd0, -0.05]], 'cab2');
      // détail agrandi
      const id = 'psdc' + (++CLIPN);
      const cx0 = ox + kd * xd0, cy1 = oy + kd * (yT + 0.05), cw = kd * (xd1 - xd0), ch = kd * (yT + 0.1);
      d.raw(`<defs><clipPath id="${id}"><rect x="${+cx0.toFixed(4)}" y="${+(-cy1).toFixed(4)}" width="${+cw.toFixed(4)}" height="${+ch.toFixed(4)}"/></clipPath></defs><g clip-path="url(#${id})">`);
      const T = body(kd, ox, oy);
      d.raw('</g>');
      d.path([[cx0, oy - kd * 0.05], [cx0 + cw, oy - kd * 0.05], [cx0 + cw, cy1], [cx0, cy1], [cx0, oy - kd * 0.05]], 'cab2');
      d.text(cx0 + cw, cy1 + 0.25, 'détail × ' + fmt(kd, 1).replace('.', ','), { size: 0.75, a: 'end', cls: 'ts' });
      const Dm = (x1, y1, x2, y2, lb, off, k, o) => { const p = T(x1, y1), q = T(x2, y2); d.dim(p[0], p[1], q[0], q[1], lb, off, k, o); };
      if (E2 > 0) {
        Dm(-a - c, 0, -a, 0, sch ? 'EDAL2/2' : fmt(c, 3), -0.32, 'EDAL2', { size: 0.8 });
        if (E3 > 0) Dm(-a - E3 / 2, 0, -a, 0, sch ? 'EDAL3/2' : fmt(E3 / 2, 3), -0.75, 'EDAL3', { size: 0.7 });
        Dm(-a - c, H1 - H2, -a - c, H1, L_(m, 'HDAL2', sch, 3), 0.3, 'HDAL2', { size: 0.8 });
        if (H3 > 0) Dm(-a - E3 / 2, 0, -a - E3 / 2, H3, L_(m, 'HDAL3', sch, 3), 0.3, 'HDAL3', { size: 0.8 });
      }
      Dm(xd1 - 0.04, 0, xd1 - 0.04, H1, L_(m, 'HDAL1', sch, 3), -0.3, 'HDAL1', { size: 0.8 });
      const xf = ductX(0);
      if (xf + dg < xd1) {
        Dm(xf + dg / 2, 0, xf + dg / 2, ci, L_(m, 'COUVI', sch, 3), -0.28, 'COUVI', { size: 0.75 });
        Dm(xf + dg / 2, H1 - cs, xf + dg / 2, H1, L_(m, 'COUVS', sch, 3), -0.28, 'COUVS', { size: 0.75 });
        Dm(xf - dg / 2, ci, xf - dg / 2, ci + dg, L_(m, 'DGAIN', sch, 3), 0.28, 'DGAIN', { size: 0.75 });
      }
    }
    return d.toString();
  }

  /* vue en plan biaise */
  function drawPlan(svg, m, sch) {
    const g = geo(m);
    const W = (V(m, 'EDAL1') + V(m, 'EDAL2')) || 10;
    const b = Math.max(30, Math.min(100, V(m, 'BIAIS') || 100)) * Math.PI / 200;
    const dx = W / Math.tan(b);
    const xa = -g.ab, xb = g.Lt + g.ab;
    const rA = Math.min(W * 0.5, g.L[0] * 0.4);
    const d = svg({ x0: Math.min(xa - Math.abs(dx) / 2, -W * 0.5 / Math.tan(b) - rA * 1.7) - g.Lt * 0.03, y0: -W * 0.75, x1: xb + Math.abs(dx) / 2 + g.Lt * 0.06, y1: W * 1.45 }, { pad: 0.03 });
    const u = d.u;
    const at = (x, y) => [x + (y - W / 2) / Math.tan(b), y];        // point d'une ligne parallèle aux appuis passant par (x, W/2)
    d.poly([at(xa, 0), at(xb, 0), at(xb, W), at(xa, W)], 'b', 'EDAL1 EDAL2 ABOUT NT');
    const ws = ['ETROG', 'EGAU', 'ESURCH', 'EDROI', 'ETROD'].map(k => Math.max(0, V(m, k))), Wp = ws.reduce((x, y) => x + y, 0) || W;
    const y1 = W / 2 + Wp / 2 - ws[0] - ws[1], y0 = W / 2 - Wp / 2 + ws[4] + ws[3];
    if (y1 > y0) d.poly([at(xa, y0), at(xb, y0), at(xb, y1), at(xa, y1)], 'road', 'ESURCH');
    d.line(xa - g.Lt * 0.02, W / 2, xb + g.Lt * 0.02, W / 2, 'ax');
    for (let i = 0; i <= g.n; i++) {
      const x = g.X[i], k = supK(i) + ' SYMAP';
      const p0 = at(x, -W * 0.08), p1 = at(x, W * 1.08);
      d.line(p0[0], p0[1], p1[0], p1[1], 'l', k);
      const nap = Math.max(1, Math.round(V(m, 'NAP' + (i + 1))) || 1), sz = Math.min(W / (nap * 2.4), 0.9);
      for (let j = 0; j < nap; j++) { const y = W * (j + 0.5) / nap, p = at(x, y); d.rect(p[0] - sz / 2, p[1] - sz / 2, sz, sz, V(m, 'TYPAP' + (i + 1)) === 0 ? 'b' : 'b2', k); }
      const q = at(x, W * 1.08);
      d.text(q[0], q[1] + u * 1.6, sch ? `NAP${i + 1} · TYPAP${i + 1}` : 'A' + (i + 1) + ' · ' + nap + ' app.', { size: 0.7, cls: sch ? 'tc' : 'ts', k });
    }
    for (let t = 0; t < g.n; t++) d.dim(g.X[t], -W * 0.42, g.X[t + 1], -W * 0.42, L_(m, 'D' + (t + 1), sch, 2), 0.001, 'D' + (t + 1));
    const xr = Math.max(at(xb, 0)[0], at(xb, W)[0]) + g.Lt * 0.025;
    d.dim(xr, 0, xr, W, sch ? 'EDAL1 + EDAL2' : fmt(W, 2), -0.001, 'EDAL1 EDAL2', { size: 0.8 });
    // angle de biais au premier appui
    const o = at(0, 0), r = rA, arc = [];
    const pe = at(0, -W * 0.48); d.line(o[0], o[1], pe[0], pe[1], 'l', 'BIAIS'); d.line(o[0], o[1], o[0] - r * 1.25, o[1], 'l', 'BIAIS');
    for (let i = 0; i <= 18; i++) { const t = Math.PI + b * i / 18; arc.push([o[0] + r * Math.cos(t), o[1] + r * Math.sin(t)]); }
    d.path(arc, 'l', 'BIAIS');
    d.text(o[0] + r * 1.3 * Math.cos(Math.PI + b / 2), o[1] + r * 1.3 * Math.sin(Math.PI + b / 2), sch ? 'BIAIS' : fmt(V(m, 'BIAIS'), 2) + ' gr', { k: 'BIAIS', cls: sch ? 'tc' : 'dv', size: 0.9, a: 'end' });
    d.text((xa + xb) / 2, -W * 0.68, sch ? 'portées biaises D1 … D' + g.n + ' mesurées sur l\'axe' : 'portées biaises sur l\'axe · portée droite max ' + fmt(Math.max(...g.L) * Math.sin(b), 2) + ' m', { size: 0.75, cls: 'ts', k: 'BIAIS' });
    return d.toString();
  }

  /* détail d'un câble : gaine, torons, enrobages, décalage */
  function strandsOf(m) {
    const s = String((m.values || {}).UNITE || ''); const mm = /(\d+)\s*[TtCc]\s*(\d+)/.exec(s);
    const n = mm ? Math.max(1, Math.min(55, +mm[1])) : 12, t = mm ? +mm[2] : 15;
    return { n, ds: t >= 15 ? 0.0157 : t >= 13 ? 0.0129 : t / 1000 };
  }
  function bundle(n, ds, R, up) {
    const s = ds * 1.04, cand = [];
    for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) { const x = (i + (j % 2 ? 0.5 : 0)) * s, y = j * s * 0.866; if (Math.hypot(x, y) <= R - ds / 2 + 1e-9) cand.push([x, y]); }
    cand.sort((p, q) => up ? (q[1] - p[1]) || (Math.abs(p[0]) - Math.abs(q[0])) : (p[1] - q[1]) || (Math.abs(p[0]) - Math.abs(q[0])));
    return cand.slice(0, n);
  }
  function drawCable(svg, m, sch) {
    const dg = Math.max(V(m, 'DGAIN'), 0.03), ci = V(m, 'COUVI'), cs = V(m, 'COUVS'), dec = V(m, 'DECAL');
    const { n, ds } = strandsOf(m), R = dg / 2;
    const hb = Math.max(0.3, ci + dg + 0.12, cs + dg + 0.12), xR = 0.62, yTop = hb;
    const d = svg({ x0: -0.3, y0: -0.12, x1: xR + 0.3, y1: hb + 0.2 }, { pad: 0.03 });
    const u = d.u;
    // en travée : point bas
    d.rect(-0.24, 0, 0.48, Math.max(hb * 0.62, ci + dg + 0.08), 'b', 'COUVI');
    const cy = ci + R;
    d.circle(0, cy, R, 'duct', 'DGAIN');
    let B = bundle(n, ds, R, true); let gy = B.reduce((s, p) => s + p[1], 0) / (B.length || 1);
    B.forEach(p => d.circle(p[0], cy + p[1], ds / 2, 'strand', 'UNITE SECT'));
    d.line(-R * 1.4, cy, R * 1.4, cy, 'ax');
    d.dim(R, 0, R, ci, L_(m, 'COUVI', sch, 3), -0.075, 'COUVI', { size: 0.85 });
    d.dim(-R, cy - R, -R, cy + R, L_(m, 'DGAIN', sch, 3), 0.06, 'DGAIN', { size: 0.85 });
    d.dim(0, cy, 0, cy + dec, L_(m, 'DECAL', sch, 3), -R - 0.13, 'DECAL', { size: 0.8 });
    d.circle(0, cy + Math.max(dec, gy * 0), u * 0.3, 'cabpt', 'DECAL');
    d.text(0, -0.085, 'en travée — point bas (intrados en bas)', { size: 0.8, cls: 'ts' });
    // sur appui : point haut
    d.rect(xR - 0.24, 0, 0.48, yTop, 'b', 'COUVS');
    d.text(xR, yTop + 0.03, 'extrados', { size: 0.7, cls: 'ts' });
    const cy2 = yTop - cs - R;
    d.circle(xR, cy2, R, 'duct', 'DGAIN');
    B = bundle(n, ds, R, false);
    B.forEach(p => d.circle(xR + p[0], cy2 + p[1], ds / 2, 'strand', 'UNITE SECT'));
    d.line(xR - R * 1.4, cy2, xR + R * 1.4, cy2, 'ax');
    d.dim(xR + R, cy2 + R, xR + R, yTop, L_(m, 'COUVS', sch, 3), -0.075, 'COUVS', { size: 0.85 });
    d.dim(xR, cy2 - dec, xR, cy2, L_(m, 'DECAL', sch, 3), R + 0.13, 'DECAL', { size: 0.8 });
    d.circle(xR, cy2 - dec, u * 0.3, 'cabpt', 'DECAL');
    d.text(xR, -0.085, 'sur appui — point haut', { size: 0.8, cls: 'ts' });
    // caractéristiques
    const P0 = V(m, 'SECT') * 1e-6 * V(m, 'SIGMAP0');
    const lines = sch
      ? [['UNITE : ' + n + ' torons', 'UNITE PROCEDE'], ['SECAB (mm²) · σp0 = SIGMAP0', 'SECT SIGMAP0'], ['P0 = SECAB × σp0', 'SECT SIGMAP0 FPRG FPEG'], ['R ≥ RMIN · Ep', 'RMIN EP']]
      : [[(m.values.PROCEDE || '') + ' ' + (m.values.UNITE || '') + ' — ' + n + ' torons', 'UNITE PROCEDE'], ['section ' + fmt(V(m, 'SECT'), 0) + ' mm² · σp0 ' + fmt(V(m, 'SIGMAP0') / 101.97, 0) + ' MPa', 'SECT SIGMAP0'], ['P0 = ' + fmt(P0, 1) + ' t par câble' + (V(m, 'NCA') > 0 ? ' · ' + fmt(P0 * V(m, 'NCA'), 0) + ' t pour ' + fmt(V(m, 'NCA'), 0) + ' câbles' : ''), 'SECT SIGMAP0 NCA'], ['RMIN ' + fmt(V(m, 'RMIN'), 2) + ' m · Ep ' + fmt(V(m, 'EP') / 101.97 / 1000, 0) + ' GPa', 'RMIN EP']];
    lines.forEach((l, i) => d.text(-0.24, hb + 0.17 - i * u * 2.5, l[0], { size: 0.85, a: 'start', cls: sch ? 'tc' : 'dv', k: l[1] }));
    return d.toString();
  }

  /* tension le long du câble après frottement et recul d'ancrage (estimation graphique) */
  function tensionCurve(m, g) {
    const c = cable(m, g), P = c.pts, s0 = V(m, 'SIGMAP0') || 1, f = V(m, 'F'), phi = V(m, 'PHI'), g0 = V(m, 'RECUL') * V(m, 'EP');
    const N = P.length, al = [0];
    const ang = i => Math.atan2(P[i + 1][1] - P[i][1], P[i + 1][0] - P[i][0]);
    for (let i = 1; i < N - 1; i++) al.push(al[i - 1] + Math.abs(ang(i) - ang(i - 1)));
    al.push(al[N - 2]);
    const xs = P.map(p => p[0]), Lt = xs[N - 1] - xs[0];
    const fromL = xs.map((x, i) => s0 * Math.exp(-(f * al[i] + phi * (x - xs[0]))));
    const fromR = xs.map((x, i) => s0 * Math.exp(-(f * (al[N - 1] - al[i]) + phi * (xs[N - 1] - x))));
    const recul = (S, rev) => {          // zone de recul : aire entre la courbe et sa symétrique = g·Ep
      const ord = rev ? S.map((_, i) => N - 1 - i) : S.map((_, i) => i);
      let area = 0, j = 1;
      const A = k => { let s = 0; for (let q = 1; q <= k; q++) { const a = ord[q - 1], b2 = ord[q]; s += ((S[a] - S[ord[k]]) + (S[b2] - S[ord[k]])) * Math.abs(xs[b2] - xs[a]); } return s; };
      for (j = 1; j < N; j++) { area = A(j); if (area >= g0) break; }
      const kk = Math.min(j, N - 1), ref = S[ord[kk]], out = S.slice();
      for (let q = 0; q <= kk; q++) out[ord[q]] = 2 * ref - S[ord[q]];
      return { out, len: Math.abs(xs[ord[kk]] - xs[ord[0]]) };
    };
    const rl = recul(fromL, false), rr = recul(fromR, true), mod = Math.round(V(m, 'MOD'));
    let fin, fr;
    if (mod === 1) { fin = rl.out; fr = fromL; } else if (mod === 2) { fin = rr.out; fr = fromR; }
    else if (mod === 4) { fin = rl.out.map((x, i) => (x + rr.out[i]) / 2); fr = fromL.map((x, i) => (x + fromR[i]) / 2); }
    else { fin = rl.out.map((x, i) => Math.max(x, rr.out[i])); fr = fromL.map((x, i) => Math.max(x, fromR[i])); }
    return { xs, fin, fr, s0, Lt, sg: rl.len, sd: rr.len, mod, c };
  }
  function drawTension(svg, m, sch) {
    const g = geo(m), T = tensionCurve(m, g), s0 = T.s0;
    const lo = Math.min(...T.fin, ...T.fr), smin = Math.min(0.78 * s0, lo - 0.02 * s0);
    const Hp = g.Lt * 0.3, Y = s => (s - smin) / (s0 - smin) * Hp;
    const ex = Math.max(1, Math.min(40, g.Lt / (13 * g.H))) * 0.45, Hd = g.H * ex;
    const yb = -Hp * 0.2;                                            // base de la petite élévation
    const d = svg({ x0: -g.ab - g.Lt * 0.1, y0: yb - Hd - Hp * 0.22, x1: g.Lt + g.ab + g.Lt * 0.02, y1: Hp * 1.28 }, { pad: 0.03 });
    const u = d.u;
    // grille
    [0.8, 0.85, 0.9, 0.95, 1].forEach(r => { if (r * s0 >= smin) { d.line(T.xs[0], Y(r * s0), T.xs[T.xs.length - 1], Y(r * s0), 'grid'); d.text(T.xs[0] - u * 0.8, Y(r * s0), (sch ? fmt(r, 2) + ' σp0' : fmt(r * s0 / 101.97, 0) + ' MPa'), { size: 0.7, a: 'end', cls: 'ts', k: r === 1 ? 'SIGMAP0' : null }); } });
    d.line(T.xs[0], 0, T.xs[T.xs.length - 1], 0, 'l');
    for (let i = 0; i <= g.n; i++) d.line(g.X[i], 0, g.X[i], -u * 0.8, 'l');
    d.path(T.xs.map((x, i) => [x, Y(T.fr[i])]), 'cab2', 'F PHI');
    d.path(T.xs.map((x, i) => [x, Y(T.fin[i])]), 'cab', 'F PHI RECUL MOD SIGMAP0');
    // zones de recul
    if (T.mod !== 2) d.dim(T.xs[0], Y(s0) + Hp * 0.08, T.xs[0] + T.sg, Y(s0) + Hp * 0.08, sch ? 'RECULAN' : 'recul ' + fmt(T.sg, 1) + ' m', 0.001, 'RECUL', { size: 0.75 });
    if (T.mod === 0 || T.mod === 3 || T.mod === 2) { const xe = T.xs[T.xs.length - 1]; d.dim(xe - T.sd, Y(s0) + Hp * 0.08, xe, Y(s0) + Hp * 0.08, sch ? 'RECULAN' : 'recul ' + fmt(T.sd, 1) + ' m', 0.001, 'RECUL', { size: 0.75 }); }
    const im = T.fin.indexOf(Math.min(...T.fin));
    d.text(T.xs[im], Y(T.fin[im]) - Hp * 0.08, sch ? 'frottement : f·α + φ·x' : 'min ' + fmt(T.fin[im] / s0, 3) + ' σp0 (' + fmt(T.fin[im] / 101.97, 0) + ' MPa)', { size: 0.75, cls: sch ? 'tc' : 'dv', k: 'F PHI' });
    const lab = { 0: 'tendus aux deux extrémités', 3: 'tendus aux deux extrémités', 1: 'tendus par la gauche', 2: 'tendus par la droite', 4: 'tendus alternativement' }[T.mod] || '';
    d.text((T.xs[0] + T.xs[T.xs.length - 1]) / 2, Hp * 1.2, sch ? 'MODE : ancrages actifs' : 'câbles ' + lab + ' · après frottement et recul (estimation graphique)', { size: 0.8, cls: sch ? 'tc' : 'ts', k: 'MOD' });
    // petite élévation avec le câble
    const yT = yb, Z = z => yT - Hd + z * ex;
    d.rect(-g.ab, yT - Hd, g.Lt + 2 * g.ab, Hd, 'b', 'HDAL1');
    d.path(T.c.pts.map(p => [p[0], Z(p[1])]), 'cab', 'CABL');
    for (let i = 0; i <= g.n; i++) d.poly([[g.X[i], yT - Hd], [g.X[i] - u * 0.7, yT - Hd - u * 1.1], [g.X[i] + u * 0.7, yT - Hd - u * 1.1]], 'b2');
    d.text(-g.ab - u, yT - Hd / 2, 'G', { size: 0.8, a: 'end', cls: 'ts' });
    const dif = sch ? 'différées : retrait εr · relaxation ρ1000, μ0 · fluage Kfl · r(j) à la mise en service' : 'pertes différées (retrait ' + fmt(V(m, 'EPSI0'), 1) + '·10⁻⁴, relaxation ' + fmt(V(m, 'RO'), 1) + ' %, fluage Kfl ' + fmt(V(m, 'KFL'), 1) + ') : calculées par le programme';
    d.text((T.xs[0] + T.xs[T.xs.length - 1]) / 2, yT - Hd - Hp * 0.13, dif, { size: 0.75, cls: sch ? 'tc' : 'ts', k: 'EPSI0 RO MU0 KFL RT' });
    return d.toString();
  }

  /* ───── contrôles de cohérence ───── */
  function checks(m) {
    CUR = m;
    const out = [], E_ = (step, k, msg) => out.push({ level: 'e', step, k, msg }), W_ = (step, k, msg) => out.push({ level: 'w', step, k, msg });
    const v = m.values || {};
    const nt = V(m, 'NT');
    if (!(Number.isInteger(nt) && nt >= 1 && nt <= 6)) E_('long', 'NT', 'le nombre de travées NT est un entier de 1 à 6');
    const n = Math.max(1, Math.min(6, Math.round(nt) || 1));
    for (let i = 1; i <= n; i++) if (!(V(m, 'D' + i) > 0)) E_('long', 'D' + i, `la portée D${i} de la travée ${i} doit être positive (NT = ${n})`);
    for (let i = n + 1; i <= 6; i++) if (V(m, 'D' + i) > 0) W_('long', 'D' + i, `D${i} = ${fmt(V(m, 'D' + i), 2)} m sera ignorée (NT = ${n})`);
    for (let i = 1; i <= n; i++) { const nd = V(m, 'ND' + i); if (!(nd >= 1 && nd <= 48)) E_('long', 'ND' + i, `ND${i} : nombre d'intervalles entre 1 et 48`); else if (V(m, 'D' + i) / nd > 2.5) W_('long', 'ND' + i, `ND${i} : intervalles de ${fmt(V(m, 'D' + i) / nd, 2)} m, plus grands que l'espacement usuel des supports de gaine`); }
    const bi = V(m, 'BIAIS');
    if (!(bi > 0 && bi <= 100)) E_('long', 'BIAIS', 'le biais est compris entre 0 et 100 grades');
    else if (bi < 50) W_('long', 'BIAIS', `biais ${fmt(bi, 1)} gr très prononcé : vérifier le domaine d'emploi (biais mécanique, guide SETRA)`);
    if (V(m, 'ABOUT') < 0) E_('long', 'ABOUT', 'about négatif');
    const H = V(m, 'HDAL1'), Ls = Array.from({ length: n }, (_, i) => V(m, 'D' + (i + 1))), Lmax = Math.max(...Ls);
    if (H > 0 && Lmax > 0) {
      const el = Lmax / H;
      if (el > 33) W_('sect', 'HDAL1', `élancement L/h = ${fmt(el, 1)} : dalle mince (usuel 25 à 33 pour une dalle continue)`);
      else if (el < 18) W_('sect', 'HDAL1', `élancement L/h = ${fmt(el, 1)} : dalle épaisse pour la portée (usuel 25 à 33)`);
    }
    if (n >= 2) for (const [r, a] of [[0, 1], [n - 1, n - 2]]) { const q = Ls[r] / Ls[a]; if (Ls[a] > 0 && (q < 0.5 || q > 0.9)) W_('long', 'D' + (r + 1), `travée de rive D${r + 1} = ${fmt(q, 2)} × travée voisine (usuel 0,6 à 0,85)`); }
    // profil en travers
    const ws = ['ETROG', 'EGAU', 'ESURCH', 'EDROI', 'ETROD'];
    for (const k of ws) if (V(m, k) < 0) E_('trav', k, `${k} négatif`);
    const es = V(m, 'ESURCH');
    if (!(es > 0)) E_('trav', 'ESURCH', 'la largeur chargeable ESURCH doit être positive');
    const sum = ws.reduce((a, k) => a + V(m, k), 0), Wd = V(m, 'EDAL1') + V(m, 'EDAL2');
    if (Wd > 0 && Math.abs(sum - Wd) > 0.015) W_('trav', 'ETROG', `somme des largeurs du profil (${fmt(sum, 3)} m) ≠ largeur de la dalle EDAL1 + EDAL2 (${fmt(Wd, 3)} m)`);
    const nvF = es >= 6 ? Math.floor(es / 3) : es >= 5 ? 2 : 1, nv = V(m, 'NV');
    if (!(nv >= 1)) E_('trav', 'NV', 'nombre de voies NVOIE au moins égal à 1');
    else if (nv !== nvF) W_('trav', 'NV', `fasc. 61 II art. 2.2 : ${nvF} voie${nvF > 1 ? 's' : ''} pour ESURCH = ${fmt(es, 2)} m (saisi : ${nv})`);
    if (V(m, 'SYM') === 1 && (Math.abs(V(m, 'ETROG') - V(m, 'ETROD')) > 1e-6 || Math.abs(V(m, 'EGAU') - V(m, 'EDROI')) > 1e-6)) W_('trav', 'SYM', 'SYMTAB = 1 alors que le profil n\'est pas symétrique (ETROG ≠ ETROD ou EGAU ≠ EDROI)');
    if (V(m, 'HCHAU') < 0 || V(m, 'HCHAU') > 0.3) W_('trav', 'HCHAU', 'épaisseur de chaussée HCHAU inhabituelle');
    // section
    if (!(H > 0)) E_('sect', 'HDAL1', 'l\'épaisseur HDAL1 doit être positive');
    if (!(V(m, 'EDAL1') > 0)) E_('sect', 'EDAL1', 'la largeur d\'intrados EDAL1 doit être positive');
    if (V(m, 'HDAL2') > H) E_('sect', 'HDAL2', 'HDAL2 (bout d\'encorbellement) dépasse HDAL1');
    if (V(m, 'EDAL3') > V(m, 'EDAL2') + 1e-9) E_('sect', 'EDAL3', 'les flancs EDAL3 sont plus larges que les encorbellements EDAL2');
    if (V(m, 'EDAL2') > 0 && V(m, 'HDAL3') > H - V(m, 'HDAL2') + 0.001) W_('sect', 'HDAL3', `HDAL3 > HDAL1 − HDAL2 = ${fmt(H - V(m, 'HDAL2'), 3)} m : sous-face d'encorbellement descendante`);
    if (H > 0 && V(m, 'EDAL1') > 0) {
      const sc = section(m);
      const rel = (k, ref) => Math.abs(V(m, k) - ref) / Math.max(Math.abs(ref), 1e-9);
      if (!(V(m, 'S') > 0)) E_('sect', 'S', 'aire S non renseignée'); else if (rel('S', sc.S) > 0.01) W_('sect', 'S', `S = ${fmt(V(m, 'S'), 4)} m² ≠ aire du coffrage ${fmt(sc.S, 4)} m²`);
      if (!(V(m, 'I') > 0)) E_('sect', 'I', 'inertie I non renseignée'); else if (rel('I', sc.I) > 0.01) W_('sect', 'I', `I = ${fmt(V(m, 'I'), 6)} m⁴ ≠ inertie du coffrage ${fmt(sc.I, 6)} m⁴`);
      if (Math.abs(V(m, 'V') + V(m, 'VP') - H) > 0.002) W_('sect', 'V', `V + V' = ${fmt(V(m, 'V') + V(m, 'VP'), 3)} m ≠ HDAL1 = ${fmt(H, 3)} m`);
    }
    // charges
    if (![0, 100, 200, 300].includes(V(m, 'STA'))) E_('charg', 'STA', 'STATUT : 100, 200, 300 (ou 000)');
    if (!(V(m, 'MASVO') > 0)) E_('charg', 'MASVO', 'masse volumique du béton non renseignée');
    if (V(m, 'OSSAN') > V(m, 'OSSAX')) E_('charg', 'OSSAN', 'OSSAm dépasse OSSAM');
    if (V(m, 'QSUPN') > V(m, 'QSUPX')) E_('charg', 'QSUPN', 'superstructures : QSUPTm dépasse QSUPTM');
    if (!(V(m, 'QSUPX') > 0)) W_('charg', 'QSUPX', 'aucun poids de superstructures');
    if (V(m, 'A') === 100 && !(m.layout && m.layout.cards && m.layout.cards.PAS)) E_('charg', 'A', 'charge A généralisée (100) : la carte B3 (PAS, A(0)…A(4)) doit figurer dans le bordereau (mode texte)');
    if (V(m, 'B') >= 100) E_('charg', 'B', 'camions généralisés BG : lignes B1 et B2 non prises en charge par cette saisie');
    const ce = V(m, 'CE');
    if (Math.floor(ce / 100) > 0) E_('charg', 'CE', 'charges généralisées de caractère particulier (lignes B4) non prises en charge');
    if (Math.floor(ce / 10) % 10 > 2 || ![0, 3, 4].includes(ce % 10)) W_('charg', 'CE', 'CE = imj : m = 0, 1 (D) ou 2 (D et E) ; j = 0, 3 (Mc80) ou 4 (Mc120)');
    if (V(m, 'ETROG') + V(m, 'ETROD') > 0 && !(V(m, 'TROT') > 0)) W_('charg', 'TROT', 'trottoirs sans charge PSTROT (normal pour une plateforme autoroutière)');
    const K = ['KA', 'KBC', 'KBT', 'KCM', 'KTR'];
    if (V(m, 'EXCE') === 0) for (const k of K) { if (!(V(m, k) > 0)) E_('charg', k, `EXCENTR = 0 : le coefficient ${k} doit être donné`); }
    else if (K.some(k => V(m, k) !== 0)) W_('charg', 'KA', 'coefficients KA… KTR ignorés (EXCENTR = 1 : Guyon-Massonnet)');
    if (!(V(m, 'A') % 10 === 1 || V(m, 'A') === 100) && !(V(m, 'B') % 10 === 1) && !ce) W_('charg', 'A', 'aucune charge d\'exploitation retenue');
    // matériaux
    if (![101, 201, 301].includes(V(m, 'GEN'))) W_('mat', 'GEN', 'GENRE : 101, 201 ou 301 (classe extra-réglementaire non contrôlée)');
    const fc = V(m, 'FC28'), fj = V(m, 'FCJ');
    if (!(fc > 0)) E_('mat', 'FC28', 'résistance fc28 non renseignée');
    if (fj > fc) E_('mat', 'FCJ', 'fcj (mise en tension) dépasse fc28');
    if (fc > 0 && fc < (V(m, 'EDAL2') > 0 ? 3000 : 2500)) W_('mat', 'FC28', `fc28 = ${fmt(fc, 0)} t/m² inférieur au minimum de la notice (${V(m, 'EDAL2') > 0 ? '3000 t/m², larges encorbellements' : '2500 t/m², dalle rectangulaire'})`);
    if (fc > 0 && fc < 100) E_('mat', 'FC28', 'fc28 doit être donné en t/m² (35 MPa ≈ 3570 t/m²)');
    if (!(V(m, 'POIS') >= 0 && V(m, 'POIS') <= 0.3)) W_('mat', 'POIS', 'coefficient de Poisson inhabituel (0 à 0,2)');
    if (!(V(m, 'PSI1') > 0 && V(m, 'PSI1') <= 1)) W_('mat', 'PSI1', 'ψ1 compris entre 0 et 1');
    if (V(m, 'FE1') > 0 && V(m, 'FE1') < 1000) E_('mat', 'FE1', 'fe1 doit être donné en t/m² (500 MPa ≈ 50 990 t/m²)');
    // précontrainte
    const fprg = V(m, 'FPRG'), fpeg = V(m, 'FPEG'), s0 = V(m, 'SIGMAP0');
    if (!(fprg > 0)) E_('prec', 'FPRG', 'fprg non renseignée');
    if (fpeg > fprg) E_('prec', 'FPEG', 'fpeg dépasse fprg');
    const smax = Math.min(0.8 * fprg, 0.9 * fpeg);
    if (!(s0 > 0)) E_('prec', 'SIGMAP0', 'tension à l\'origine σp0 non renseignée');
    else if (s0 > smax + 0.5) E_('prec', 'SIGMAP0', `σp0 = ${fmt(s0, 0)} t/m² > min(0,80 fprg ; 0,90 fpeg) = ${fmt(smax, 0)} t/m²`);
    else if (s0 < 0.9 * smax) W_('prec', 'SIGMAP0', `σp0 nettement inférieure au maximum réglementaire (${fmt(smax, 0)} t/m²)`);
    if (!(V(m, 'EP') >= 1.7e7 && V(m, 'EP') <= 2.15e7)) W_('prec', 'EP', 'module Ep inhabituel (19 400 000 t/m² pour les torons)');
    if (!String(v.PROCEDE || '').trim()) E_('prec', 'PROCEDE', 'nom du procédé de précontrainte manquant');
    if (String(v.PROCEDE || '').length > 10) W_('prec', 'PROCEDE', 'nom du procédé limité à 10 caractères');
    if (!String(v.UNITE || '').trim()) E_('prec', 'UNITE', 'unité de précontrainte manquante');
    const sect = V(m, 'SECT'), mm = /(\d+)\s*T\s*(\d+)/i.exec(String(v.UNITE || ''));
    if (!(sect > 0)) E_('prec', 'SECT', 'section d\'une armature SECAB (mm²) manquante');
    else if (mm) { const nb = +mm[1], t = +mm[2], r = t >= 15 ? [139, 150] : t >= 13 ? [93, 100] : null; if (r && (sect / nb < 0.9 * r[0] || sect / nb > 1.1 * r[1])) W_('prec', 'SECT', `SECAB = ${fmt(sect, 0)} mm² peu cohérente avec ${v.UNITE} (${nb} × ${r[0]} à ${r[1]} mm²)`); }
    const dg = V(m, 'DGAIN'), ci = V(m, 'COUVI'), cs = V(m, 'COUVS'), dec = V(m, 'DECAL');
    if (!(dg > 0)) E_('prec', 'DGAIN', 'diamètre de gaine manquant');
    else {
      if (sect * 1e-6 > 0.5 * Math.PI * dg * dg / 4) W_('prec', 'DGAIN', 'gaine petite pour la section d\'acier (taux de remplissage > 50 %)');
      if (ci < dg) W_('prec', 'COUVI', `enrobage inférieur COUVI = ${fmt(ci, 3)} m inférieur au diamètre de la gaine`);
      if (cs < dg) W_('prec', 'COUVS', `enrobage supérieur COUVS = ${fmt(cs, 3)} m inférieur au diamètre de la gaine`);
      if (dec > 0.25 * dg || dec < 0.05 * dg) W_('prec', 'DECAL', `décalage conseillé 0,11 DGAINE = ${fmt(0.11 * dg, 3)} m`);
      if (H > 0 && ci + cs + 2 * dg >= H) E_('prec', 'COUVS', 'les enrobages et la gaine ne laissent aucune excentricité dans l\'épaisseur HDAL1');
    }
    if (!(V(m, 'RMIN') > 0)) E_('prec', 'RMIN', 'rayon minimal des gaines manquant');
    // pertes
    if (![0, 1, 2, 3, 4].includes(V(m, 'MOD'))) E_('pertes', 'MOD', 'MODE : 0 à 4');
    if (!(V(m, 'F') >= 0.1 && V(m, 'F') <= 0.3)) W_('pertes', 'F', 'coefficient de frottement f inhabituel (0,18 à 0,20 pour des torons en gaine métallique)');
    if (!(V(m, 'PHI') >= 0.0005 && V(m, 'PHI') <= 0.004)) W_('pertes', 'PHI', 'coefficient φ inhabituel (0,002 /m environ)');
    if (!(V(m, 'RECUL') > 0 && V(m, 'RECUL') <= 0.015)) W_('pertes', 'RECUL', 'recul d\'ancrage inhabituel (6 mm environ)');
    if (!(V(m, 'EPSI0') >= 1 && V(m, 'EPSI0') <= 6)) W_('pertes', 'EPSI0', 'retrait εr inhabituel (2 à 4 ·10⁻⁴)');
    if (Math.abs(V(m, 'RO') - 2.5) < 0.01 && Math.abs(V(m, 'MU0') - 0.43) > 0.005) W_('pertes', 'MU0', 'acier TBR (ρ1000 = 2,5 %) : μ0 = 0,43');
    if (!(V(m, 'RO') > 0)) E_('pertes', 'RO', 'relaxation ρ1000 manquante');
    if (!(V(m, 'KFL') >= 1 && V(m, 'KFL') <= 3)) W_('pertes', 'KFL', 'Kfluage inhabituel (2 dans les cas courants)');
    if (!(V(m, 'RT') >= 0 && V(m, 'RT') <= 1)) E_('pertes', 'RT', 'r(j) compris entre 0 et 1');
    // câblage imposé
    const cabl = V(m, 'CABL');
    if (![1, 4].includes(cabl)) E_('cotes', 'CABL', 'CABLAGE : 1 (calculé) ou 4 (imposé)');
    if (cabl === 4) {
      if (!(V(m, 'NCA') > 0)) E_('cotes', 'NCA', 'câblage imposé : le nombre de câbles NCA doit être donné');
      const C = m.cotes && m.cotes.values;
      if (!C || C.length < n) E_('cotes', 'CABL', `câblage imposé : ${n} lignes de cotes attendues`);
      else {
        const lo = ci + dg / 2, hi = H - cs - dg / 2;
        for (let t = 0; t < n; t++) {
          const r = C[t] || [];
          for (let j = 0; j <= 10; j++) {
            const z = num(r[j]);
            if (!isFinite(z)) { E_('cotes', `COT.${t}.${j}`, `cote manquante travée ${t + 1} à ${DLAB[j]}`); continue; }
            if (H > 0 && (z < lo - 0.002 || z > hi + 0.002)) { W_('cotes', `COT.${t}.${j}`, `travée ${t + 1}, ${DLAB[j]} : cote ${fmt(z, 3)} m hors de l'enveloppe des enrobages (${fmt(lo, 3)} à ${fmt(hi, 3)} m)`); break; }
          }
          if (t > 0 && isFinite(num(r[0])) && Math.abs(num(r[0]) - num(C[t - 1][10])) > 0.0015) W_('cotes', `COT.${t}.0`, `appui ${t + 1} : la cote 0 de la travée ${t + 1} diffère de la cote 1,0L de la travée ${t}`);
        }
      }
    } else if (V(m, 'NCA') < 0) E_('cotes', 'NCA', 'NCA négatif');
    // tassements
    if (V(m, 'TASM') === 2) {
      if (!(V(m, 'YOUNG') >= 3 && V(m, 'YOUNG') <= 4)) W_('tass', 'YOUNG', `YOUNG compris entre 3 et 4 (suggestion : 1 + Kfluage = ${fmt(1 + V(m, 'KFL'), 2)})`);
      if (!(V(m, 'KTP') >= 0 && V(m, 'KTP') <= 1)) E_('tass', 'KTP', 'KTP compris entre 0 et 1');
      for (let i = 1; i <= n + 1; i++) { if (!has(m, 'TP' + i)) E_('tass', 'TP' + i, `TASMENT = 2 : tassement probable de l'appui ${i} manquant`); if (!has(m, 'DTP' + i)) E_('tass', 'DTP' + i, `TASMENT = 2 : tassement aléatoire de l'appui ${i} manquant`); }
    } else if (Array.from({ length: 7 }, (_, i) => V(m, 'TP' + (i + 1)) + V(m, 'DTP' + (i + 1))).some(x => x !== 0)) W_('tass', 'TP1', 'tassements saisis mais TASMENT ≠ 2 : ils ne sont pas étudiés');
    for (let i = 1; i <= 7; i++) if (V(m, 'TP' + i) < 0 || V(m, 'DTP' + i) < 0) E_('tass', 'TP' + i, `tassements de l'appui ${i} négatifs`);
    // appareils d'appui
    if (V(m, 'CNV') >= V(m, 'CNS')) E_('app', 'CNV', 'élastomère : COMPREN V doit être inférieure à COMPREN S');
    if (V(m, 'CBV') >= V(m, 'CBS')) E_('app', 'CBV', 'béton : COMPREB V doit être inférieure à COMPREB S');
    if (![0, 1, 2].includes(V(m, 'SYMAP'))) E_('app', 'SYMAP', 'SYMAP : 0, 1 ou 2');
    if (V(m, 'DIMA') === 1) for (let i = 1; i <= n + 1; i++) {
      if (!has(m, 'NAP' + i) || !(V(m, 'NAP' + i) >= 1)) { if (!(V(m, 'SYMAP') === 1 && i > Math.ceil((n + 1) / 2))) E_('app', 'NAP' + i, `nombre d'appareils de l'appui ${i} manquant`); }
      else if (![0, 1, 2].includes(V(m, 'TYPAP' + i))) E_('app', 'TYPAP' + i, `type d'appareil de l'appui ${i} : 0, 1 ou 2`);
    }
    return out;
  }

  /* ───── résultats ───── */
  function summary(m, r) {
    const kv = (a, b) => `<div class="ot-kv"><span>${esc(a)}</span><b>${b}</b></div>`;
    const card = (t, body) => body ? `<div class="ot-card"><h4>${esc(t)}</h4>${body}</div>` : '';
    const safe = f => { try { return f(); } catch (e) { return ''; } };
    const v = m.values, n = r.n;
    let h = '';
    h += safe(() => card('Section et géométrie de calcul', kv('Aire S', fmt(r.section.S, 4) + ' m²') + kv('Inertie I', fmt(r.section.I, 6) + ' m⁴') + kv('V · V\'', fmt(r.section.V, 3) + ' · ' + fmt(r.section.VP, 3) + ' m') + kv('Rendement ρ', fmt(r.section.rendement, 3)) + kv('Largeur équivalente Be', fmt(r.Be, 2) + ' m') + kv('Profil', fmt(r.largeurTot, 2) + ' m · ' + r.nv + ' voies · classe ' + r.classe)));
    h += safe(() => card('Biais mécanique ψ · minoration sin²ψ', r.L.map((l, i) => kv(`Travée ${i + 1} (${fmt(l, 2)} m)`, `${fmt(r.biaisMeca[i], 1)} gr · ${fmt(r.minorationBiais[i], 3)}`)).join('')));
    h += safe(() => card('Répartition transversale (K max)', r.L.map((l, i) => kv(`Travée ${i + 1}`, `A ${fmt(r.K[i].A, 3)} · Bc ${fmt(r.K[i].BC, 3)}` + (r.K[i].MC120 != null ? ` · Mc ${fmt(r.K[i].MC120, 3)}` : ''))).join('')));
    h += safe(() => card('Charges permanentes', kv('Ossature (moyenne)', fmt(r.cp.oss[0], 2) + ' t/ml') + kv('Superstructures', fmt(r.cp.sup[0], 2) + ' t/ml') + kv('Total G moyen', fmt(r.cp.tot[0], 2) + ' t/ml') + kv('G min · G max', fmt(r.cp.tot[2], 2) + ' · ' + fmt(r.cp.tot[1], 2) + ' t/ml') + kv('δ Bc par travée', r.dyn.travee.map(x => fmt(x.bc, 3)).join(' · '))));
    h += safe(() => {
      const rows = (r.sol || []).map((sec, t) => {
        if (!sec || !sec.length) return '';
        let mx = -Infinity, mn = Infinity;
        sec.forEach(s => { if (s.comb) { mx = Math.max(mx, s.comb[0].elu); mn = Math.min(mn, s.comb[1].elu); } });
        if (!isFinite(mx)) return '';
        return kv(`Travée ${t + 1}`, `${fmt(mx, 1)} · ${fmt(mn, 1)} t·m`);
      }).join('');
      return card('Moments ELU max · min', rows);
    });
    h += safe(() => card('Réactions d\'appui max · min · ELU (t)', (r.reac || []).map((x, i) => kv(`Appui ${i + 1}`, `${fmt(x.comb[0].qlqc, 1)} · ${fmt(x.comb[1].qlqc, 1)} · ${fmt(x.comb[0].elu, 1)}`)).join('')));
    h += safe(() => {
      const P = r.prec; if (!P) return '';
      let b = kv('Câbles', (P.N || 0) + ' × ' + esc(v.UNITE || '') + (v.CABL === 4 ? ' (tracé imposé)' : ''));
      if (P.SG != null) b += kv('Recul : SG · SD', fmt(P.SG, 2) + ' · ' + fmt(P.SD, 2) + ' m');
      if (P.dC != null) b += kv('Raccourcissement élastique', fmt(P.dC, 0) + ' t/m²');
      if (P.dFl != null) b += kv('Fluage (approché)', fmt(P.dFl, 0) + ' t/m²');
      if (!P.N) b += kv('Câblage', 'voir la note de calcul');
      return card('Précontrainte', b);
    });
    h += safe(() => {
      const D = r.deform; if (!D || !D.cpt) return '';
      return card('Flèches probables (G + P, à long terme)', D.cpt.map((a, i) => kv(`Travée ${i + 1}`, fmt(Math.min(...a), 1) + ' mm')).join(''));
    });
    void n;
    return h;
  }

  /* ───── exemples (bordereaux du corpus, titres génériques) ───── */
  const EX1 = [
    '                        BORDEREAU DES DONNEES DU PSIDP91 NUMERO 0001-           PASSAGE DU 04-11-26/09:00:00',
    '                        ----------------------------------------------',
    '         NUM   S  DATE',
    '         0001-    04/11/26',
    'EXEMPLE DE PONT-DALLE PRECONTRAINT',
    'PASSAGE SUPERIEUR 4 TRAVEES DROIT',
    'LIGN  EXCE  MOME  EFTR  REAP  MOTR  TASM  DIMA  CABL  FERT  ETRI  POIN  DEFO  METRE  PP   DES',
    '  1     1     1     1     1     1     2     1     1     1     1     0     1     1     1     1',
    '  1     1     1                 1                 1',
    'NT    BIAIS    ABOUT     D1       D2       D3       D4       D5       D6     ND1  ND2  ND3  ND4  ND5  ND6',
    ' 4   100.000   0.500   14.000   20.000   20.000   14.000    0.000    0.000   14   20   20   14    0    0',
    'NV  ETROG  EGAU    ESURCH  EDROI  ETROD  HCHAU  SYM   DISEXT   DISINT  NF   YY(2)   YY(3)   YY(4)   YY(5)',
    ' 3  0.650  0.500   10.000  0.500  0.650  0.080    1    0.000    0.000   3   0.000   0.000   0.000   0.000',
    "HDAL1  HDAL2  HDAL3   EDAL1  EDAL2  EDAL3     S         I       V      V'",
    '0.727  0.372  0.355   9.200  3.100  0.300   7.8948  0.340483  0.338  0.389',
    'STA  MASVO   OSSAX   OSSAN   QSUPX   QSUPN   A    B    CE   TROT  DT    PSI0     KA     KBC    KBT    KCM    KTR',
    '100  2.500   1.020   0.980   5.700   3.700  001  001  024   0.00               0.000  0.000  0.000  0.000  0.000',
    'GEN   BP   PSI1   POIS   FCJ   FC28    FE1     FE2      ETA',
    '201  000   0.72   0.20  3000.  3500.  50000.  50000.   1.600',
    ' PROCEDE      UNITE    FPRG      FPEG   SIGMAP0     EP      NCA  SECT   DGAIN  COUVS  COUVI  DECAL  RMIN',
    'FREYSSINET  12T15S    186000.  166000.  148800.  19400000.    0  1800.  0.086  0.130  0.090  0.009  8.000',
    'MOD    F     PHI    RECUL  EPSI0   RO     MU0   KFL     RT',
    ' 0   0.20  0.0020  0.0060  4.000   2.50  0.43   2.00  0.500',
    'DSIG   YOUNG   KTP    TP1    DTP1   TP2    DTP2   TP3    DTP3   TP4    DTP4   TP5    DTP5   TP6    DTP6   TP7    DTP7',
    '   0.  3.000  1.000  0.000  0.010  0.000  0.010  0.000  0.010  0.000  0.010  0.000  0.010',
    ' CNV    CBV    CNS    CBS   SYM  APP1   APP2   APP3   APP4   APP5   APP6   APP7',
    ' 250.  2000.  1500.  3500.   1   1  4   1  4   1  4   1  4   1  4', ''].join('\n');
  const EX2 = [
    '                        BORDEREAU DES DONNEES DU PSIDP91 NUMERO 0002-           PASSAGE DU 04-11-26/09:00:00',
    '                        ----------------------------------------------',
    '         NUM   S  DATE',
    '         0002-    04/11/26',
    'EXEMPLE DE PONT-DALLE BIAIS',
    'VERIFICATION D\'UN CABLAGE IMPOSE 12T15',
    'LIGN  EXCE  MOME  EFTR  REAP  MOTR  TASM  DIMA  CABL  FERT  ETRI  POIN  DEFO  METRE  PP   DES',
    '  1     1     1     1     1     1     2     1     4     1     1     0     1     1     1     0',
    '  1     1     1                 1                 0',
    'NT    BIAIS    ABOUT     D1       D2       D3       D4       D5       D6     ND1  ND2  ND3  ND4  ND5  ND6',
    ' 4    75.000   0.750   14.000   20.000   20.000   14.000    0.000    0.000   10   10   10   10    0    0',
    'NV  ETROG  EGAU    ESURCH  EDROI  ETROD  HCHAU  SYM   DISEXT   DISINT  NF   YY(2)   YY(3)   YY(4)   YY(5)',
    ' 2  1.000  0.000    6.000  0.000  1.000  0.090    1    0.000    0.000   3   0.000   0.000   0.000   0.000',
    "HDAL1  HDAL2  HDAL3   EDAL1  EDAL2  EDAL3     S         I       V      V'",
    '0.800  0.305  0.495   4.620  3.380  0.440   4.8358  0.257607  0.349  0.451',
    'STA  MASVO   OSSAX   OSSAN   QSUPX   QSUPN   A    B    CE   TROT  DT    PSI0     KA     KBC    KBT    KCM    KTR',
    '100  2.500   1.030   0.970   4.676   3.367  001  001  004   0.15               0.000  0.000  0.000  0.000  0.000',
    'GEN   BP   PSI1   POIS   FCJ   FC28    FE1     FE2      ETA',
    '201  000   0.72   0.20  3058.  3568.  50970.  50970.   1.600',
    ' PROCEDE      UNITE    FPRG      FPEG   SIGMAP0     EP      NCA  SECT   DGAIN  COUVS  COUVI  DECAL  RMIN',
    'FREYSSINET     12T15  189600.  169220.  151680.  19400000.    9  1706.  0.086  0.110  0.090  0.010  8.000',
    'MOD    F     PHI    RECUL  EPSI0   RO     MU0   KFL     RT',
    ' 0   0.20  0.0020  0.0060  3.000   2.50  0.43   2.00  0.500',
    'DSIG   YOUNG   KTP    TP1    DTP1   TP2    DTP2   TP3    DTP3   TP4    DTP4   TP5    DTP5   TP6    DTP6   TP7    DTP7',
    '   0.  3.000  1.000  0.000  0.010  0.000  0.010  0.000  0.010  0.000  0.010  0.000  0.010',
    ' CNV    CBV    CNS    CBS   SYM  APP1   APP2   APP3   APP4   APP5   APP6   APP7',
    ' 250.  2000.  1500.  3500.   1   1  2   1  2   1  2   1  2   1  2',
    'COTES DES CABLES',
    '----------------',
    '   0       0.1L     0.2L     0.3L     0.4L     0.5L     0.6L     0.7L     0.8L     0.9L     1.0L',
    '  0.451    0.402    0.366    0.343    0.334    0.343    0.377    0.435    0.519    0.601    0.629',
    '  0.629    0.545    0.383    0.263    0.186    0.151    0.164    0.232    0.354    0.530    0.629',
    '  0.629    0.530    0.354    0.232    0.164    0.151    0.186    0.263    0.383    0.545    0.629',
    '  0.629    0.601    0.519    0.435    0.377    0.343    0.334    0.343    0.366    0.402    0.451', ''].join('\n');

  function blank() {
    const m = E.parseBordereau(EX1);
    m.titres = ['', ''];
    m.numero = '0001'; m.numeroRaw2 = '0001-';
    return m;
  }

  function onChange(m, k) {
    if (/^(HDAL|EDAL)[123]$/.test(k)) {
      const s = section(m);
      if (isFinite(s.S) && s.S > 0) { set(m, 'S', +s.S.toFixed(4)); set(m, 'I', +s.I.toFixed(6)); set(m, 'V', +s.V.toFixed(3)); set(m, 'VP', +s.VP.toFixed(3)); }
    }
    if (k === 'NT') {
      const n = Math.max(1, Math.min(6, Math.round(V(m, 'NT')) || 1));
      if (V(m, 'TASM') === 2 || has(m, 'TP1')) for (let i = 1; i <= n + 1; i++) { ensureField(m, 'TP' + i); ensureField(m, 'DTP' + i); }
      for (let i = 1; i <= n + 1; i++) { ensureField(m, 'TYPAP' + i); ensureField(m, 'NAP' + i); }
      if (m.cotes) ensureCotes(m);
    }
    if (k === 'CABL' && V(m, 'CABL') === 4) ensureCotes(m);
  }

  G.PSIDP_UI = {
    prog: 'PSIDP-EL', engine: E, steps, get, set, checks, summary, blank, onChange,
    numero: m => (m.numeroRaw2 || ((m.numero || '0001') + '-')),
    examples: [{ label: 'Passage supérieur 4 travées 14-20-20-14 m, droit', text: EX1 }, { label: 'Pont-dalle biais 75 gr, câblage imposé', text: EX2 }],
    views: [
      { id: 'elev', label: 'Élévation', draw: (svg, m) => drawElev(svg, m, false) },
      { id: 'coupe', label: 'Coupe', draw: (svg, m) => drawCoupe(svg, m, false) },
      { id: 'plan', label: 'Plan', draw: (svg, m) => drawPlan(svg, m, false) },
      { id: 'cable', label: 'Câble', draw: (svg, m) => drawCable(svg, m, false) },
      { id: 'tension', label: 'Tensions', draw: (svg, m) => drawTension(svg, m, false) },
    ],
    _draw: { drawElev, drawCoupe, drawPlan, drawCable, drawTension, cableAuto, tensionCurve, section },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
