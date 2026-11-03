/* FONDATIO — vérification des fondations d'après le Fascicule 62 titre V (CCTG, 1993) à partir d'un sondage
 * pressiométrique SPS (moteur BA.sondpres).
 * Moteur pur (aucun DOM) : module.exports pour node, window.BA.fondatio dans le navigateur.
 *
 * Unités : kN, m, kPa ; pressions pressiométriques et résistances des matériaux en MPa (comme le sondage).
 * Repère : X, Y horizontaux, Z vertical ascendant ; torseurs (Fx, Fy, Fz, Mx, My, Mz) donnés au point (px, py) du
 * plan de la sous-face de semelle, Fz < 0 = charge descendante (convention des fichiers d'origine).
 * Chaque combinaison comprend une part de longue durée (ld) et une part de courte durée (cd).
 *
 * Périmètre :
 *  - fondation superficielle ou semi-profonde (massif, puits) : ple*, De, kp, q'u, q'0, iδ (annexe F1), iβ saisi,
 *    q'ref (3/4) sur la surface comprimée (semelle rigide sur sol sans traction) ou Meyerhof, décompression,
 *    glissement, module de réaction et tassement pressiométrique (annexe F2, Ménard).
 *  - fondation profonde (pieux forés, barrettes) : Qpu, Qsu (courbes Q1…Q7), Qu, Qc, Qtu, Qtc, charges admissibles,
 *    groupe sous semelle infiniment rigide (pieux encastrés) : ressorts axiaux, réaction latérale élasto-plastique de
 *    Ménard (annexe C5), itérations sécantes, efforts et déplacements en tête, diagrammes M, V le long des pieux
 *    (pieu discrétisé avec BA.portique), aciers longitudinaux par une méthode simplifiée (ELU, bloc rectangulaire).
 */
(function (root) {
  'use strict';
  const SP = (typeof module !== 'undefined' && module.exports) ? require('./sondpres.js') : (root.BA && root.BA.sondpres);
  const PQ = (typeof module !== 'undefined' && module.exports) ? require('./portique.js') : (root.BA && root.BA.portique);
  const B0 = 0.60; // largeur de référence de Ménard (m)
  const REMBLAI = { nom: 'remblai (entre terrain définitif et terrain naturel)', pl: 1.0, pf: 0.5, em: 10, alpha: 0.5, classe: 'LA', nature: 'L', groupe: 'argile', categorie: 'A', remblai: true };

  /* ── colonne de sol depuis le terrain définitif ──
   * Fasc. 62 titre V : entre le terrain définitif et le terrain naturel (remblai), pl* = 1 MPa et EM = 10 MPa (hypothèse
   * conventionnelle reprise par le programme d'origine) ; sous le terrain naturel, valeurs des couches de calcul (TVCC)
   * du sondage, exploitées comme pl* (pressions limites nettes). Renvoie des segments par cotes décroissantes. */
  function colonne(sps, zdef, zr) {
    // zr : cote de la base du remblai conventionnel (terrain naturel pour les semelles, tête du sondage pour les pieux,
    // comme dans le programme d'origine) ; au-dessus de la tête du sondage, la première couche est prolongée.
    const C = SP.couches(sps), zs = sps.z, segs = [];
    if (!C.length) throw new Error('Le sondage ne comporte aucune couche de calcul (section $$TVCC).');
    let z = zdef;
    if (zr < zdef - 1e-9) { segs.push(Object.assign({}, REMBLAI, { zh: zdef, zb: zr })); z = zr; }
    if (z > zs + 1e-9) { segs.push(Object.assign({}, C[0], { zh: z, zb: zs, nom: C[0].nom + ' (prolongée au-dessus de la tête du sondage)' })); z = zs; }
    for (let k = 0; k < C.length; k++) {
      const c = C[k], zh = zs - c.haut, zb = k === C.length - 1 ? -Infinity : zs - c.bas;
      if (zb >= z) continue;
      segs.push(Object.assign({}, c, { zh: Math.min(z, zh), zb }));
      z = zb;
    }
    segs.zFinSondage = zs - Math.max(sps.finCouches || 0, sps.fin || 0, C[C.length - 1].bas);
    return segs;
  }
  const segAt = (col, z) => col.find((s) => z <= s.zh + 1e-9 && z > s.zb + 1e-9) || (z > col[0].zh ? col[0] : col[col.length - 1]);
  /* intégrale de f(seg) entre deux cotes (z1 > z2), f constante par segment */
  function integ(col, z1, z2, f) {
    let t = 0;
    for (const s of col) { const a = Math.min(z1, s.zh), b = Math.max(z2, s.zb); if (a > b) t += f(s) * (a - b); }
    return t;
  }
  const geoMean = (col, z1, z2, k = 'pl') => Math.exp(integ(col, z1, z2, (s) => Math.log(Math.max(s[k], 1e-6))) / (z1 - z2));
  const arithMean = (col, z1, z2, k = 'pl') => integ(col, z1, z2, (s) => s[k]) / (z1 - z2);

  /* contrainte verticale effective (kPa) à la cote z sous le terrain de cote ztop (γ au-dessus de la nappe, γsat − 10 dessous) */
  function sigmaV(ztop, z, zeau, g, gs) {
    const hTot = Math.max(0, ztop - z), hDry = Math.min(hTot, Math.max(0, ztop - Math.max(zeau, z)));
    return g * hDry + (gs - 10) * (hTot - hDry);
  }

  /* ── Fasc. 62 titre V annexe B (fondations superficielles) : facteur de portance kp ── */
  function kpSup(seg, DeB, BL) {
    const f = 0.6 + 0.4 * Math.min(1, BL);
    const g = seg.groupe, c = seg.categorie;
    if ((g === 'argile' && c === 'A') || (g === 'craie' && c === 'A')) return 0.8 * (1 + 0.25 * f * DeB);
    if (g === 'argile') return 0.8 * (1 + 0.35 * f * DeB);
    if (g === 'sable') return c === 'A' ? 1 + 0.35 * f * DeB : c === 'B' ? 1 + 0.5 * f * DeB : 1 + 0.8 * f * DeB;
    if (g === 'craie') return 1.3 * (1 + 0.27 * f * DeB);
    return 1 + 0.27 * f * DeB; // marnes, marno-calcaires, roches altérées
  }
  /* Fasc. 62 titre V annexe C3 : kp des fondations profondes, éléments mis en œuvre sans refoulement du sol */
  const KP_PROF = { argile: { A: 1.1, B: 1.2, C: 1.3 }, sable: { A: 1.0, B: 1.1, C: 1.2 }, craie: { A: 1.1, B: 1.4, C: 1.8 }, marne: { A: 1.8, B: 1.8 }, roche: { A: 1.1, B: 1.1 } };
  const kpProf = (seg) => ((KP_PROF[seg.groupe] || {})[seg.categorie]) || 1.0;
  /* kp selon De/B : superficiel jusqu'à 1,5 ; profond au-delà de 5 ; interpolation linéaire entre les deux */
  function kpDe(seg, DeB, BL) {
    if (DeB <= 1.5) return { kp: kpSup(seg, DeB, BL), domaine: 'superficielle' };
    if (DeB >= 5) return { kp: kpProf(seg), domaine: 'profonde' };
    const a = kpSup(seg, 1.5, BL), b = kpProf(seg);
    return { kp: a + (b - a) * (DeB - 1.5) / 3.5, domaine: 'semi-profonde' };
  }

  /* ── annexe F1 : coefficient minorateur d'inclinaison iδ ── */
  function iDelta(deltaDeg, frottant, DeB) {
    const d = Math.min(Math.abs(deltaDeg), 90);
    const phi1 = Math.pow(1 - d / 90, 2);
    if (!frottant) return phi1;
    const phi2 = Math.pow(Math.max(0, 1 - d / 45), 2);
    return phi2 + (phi1 - phi2) * (1 - Math.exp(-DeB));
  }

  /* ── annexe F2 : coefficients de forme de Ménard ── */
  const LC = [[1, 1.10], [2, 1.20], [3, 1.30], [5, 1.40], [20, 1.50]], LD_ = [[1, 1.12], [2, 1.53], [3, 1.78], [5, 2.14], [20, 2.65]];
  const interpT = (T, x) => { if (x <= T[0][0]) return T[0][1]; for (let k = 1; k < T.length; k++) if (x <= T[k][0]) return T[k - 1][1] + (T[k][1] - T[k - 1][1]) * (x - T[k - 1][0]) / (T[k][0] - T[k - 1][0]); return T[T.length - 1][1]; };
  function lambdas(B, L, circ) { if (circ) return { lc: 1, ld: 1 }; const r = Math.max(L, B) / Math.min(L, B); return { lc: interpT(LC, r), ld: interpT(LD_, r) }; }

  /* Modules Ec et Ed sous la fondation (annexe F2) : tranches d'épaisseur B/2 jusqu'à 8B ; le module d'une tranche est la
   * moyenne harmonique des valeurs EM des couches de calcul lues à ses deux limites (valeurs connues seulement, comme le
   * programme d'origine) ; les tranches au-delà du sondage sont ignorées et le numérateur 4 est ramené à 3,6 ou 3,2. */
  function modulesMenard(col, zf, B) {
    const h = B / 2, Ez = (z) => (z < col.zFinSondage - 1e-9 ? NaN : segAt(col, z).em);
    const Et = [];
    for (let i = 0; i < 16; i++) {
      const v = [Ez(zf - i * h - 1e-6), Ez(zf - (i + 1) * h + 1e-6)].filter(Number.isFinite);
      Et.push(v.length ? v.length / v.reduce((t, e) => t + 1 / e, 0) : NaN);
    }
    const hm = (a, b) => { const v = Et.slice(a - 1, b).filter(Number.isFinite); return v.length ? v.length / v.reduce((t, e) => t + 1 / e, 0) : NaN; };
    const E1 = Et[0], E2 = Et[1], E35 = hm(3, 5), E68 = hm(6, 8), E916 = hm(9, 16);
    let Ed, num = 4;
    const s = 1 / E1 + 1 / (0.85 * E2) + 1 / E35;
    if (Number.isFinite(E916)) Ed = 4 / (s + 1 / (2.5 * E68) + 1 / (2.5 * E916));
    else if (Number.isFinite(E68)) { num = 3.6; Ed = 3.6 / (s + 1 / (2.5 * E68)); }
    else { num = 3.2; Ed = 3.2 / s; }
    return { Ec: E1, Ed, E1, E2, E35, E68, E916, num };
  }
  /* tassement par unité de contrainte (m/MPa) — annexe F2 : s = sc + sd */
  function souplesseMenard(B, L, circ, alpha, Ec, Ed) {
    const { lc, ld } = lambdas(B, L, circ);
    const sc = alpha * lc * B / (9 * Ec);
    const sd = B > B0 ? 2 * B0 * Math.pow(ld * B / B0, alpha) / (9 * Ed) : 2 * ld * B / (9 * Ed);
    return { sc, sd, s: sc + sd, lc, ld };
  }

  /* ── semelle rigide sur sol sans traction : contraintes σ = max(0, a + b·x + c·y) ── */
  function grille(forme, n = 40) {
    const pts = [];
    if (forme.circ) {
      const R = forme.D / 2, h = forme.D / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = -R + (i + 0.5) * h, y = -R + (j + 0.5) * h; if (x * x + y * y <= R * R) pts.push([x, y, h * h]); }
      // correction d'aire
      const A = Math.PI * R * R, s = pts.reduce((t, p) => t + p[2], 0); pts.forEach((p) => (p[2] *= A / s));
    } else {
      const hx = forme.B / n, hy = forme.L / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pts.push([-forme.B / 2 + (i + 0.5) * hx, -forme.L / 2 + (j + 0.5) * hy, hx * hy]);
    }
    return pts;
  }
  function coins(forme) {
    if (forme.circ) { const R = forme.D / 2, o = []; for (let k = 0; k < 72; k++) o.push([R * Math.cos(k * Math.PI / 36), R * Math.sin(k * Math.PI / 36)]); return o; }
    return [[-forme.B / 2, -forme.L / 2], [-forme.B / 2, forme.L / 2], [forme.B / 2, forme.L / 2], [forme.B / 2, -forme.L / 2]];
  }
  /* N (kN, > 0 compression), Mx, My (kN·m) au centre ; convention : σ(x,y) équilibre N, Σσ·y = Mx, −Σσ·x = My */
  function repartition(forme, N, Mx, My) {
    const A = forme.circ ? Math.PI * forme.D * forme.D / 4 : forme.B * forme.L;
    const Ix = forme.circ ? Math.PI * Math.pow(forme.D, 4) / 64 : forme.B * Math.pow(forme.L, 3) / 12;
    const Iy = forme.circ ? Math.PI * Math.pow(forme.D, 4) / 64 : forme.L * Math.pow(forme.B, 3) / 12;
    if (!(N > 0)) return { ok: false, decomp: 100, smax: NaN, smin: NaN, a: 0, b: 0, c: 0 };
    let a = N / A, b = -My / Iy, c = Mx / Ix;
    const C = coins(forme), sig = (x, y) => a + b * x + c * y;
    const allC = C.every(([x, y]) => sig(x, y) >= -1e-9);
    if (allC) { const v = C.map(([x, y]) => sig(x, y)); return { ok: true, decomp: 0, smax: Math.max(...v), smin: Math.min(...v), a, b, c, Ac: A, A }; }
    // Newton sur (a, b, c) avec intégration sur grille
    const P = grille(forme, 60);
    let conv = false;
    for (let it = 0; it < 200; it++) {
      let R = [0, 0, 0], J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (const [x, y, w] of P) {
        const s = a + b * x + c * y; if (s <= 0) continue;
        R[0] += s * w; R[1] += s * y * w; R[2] += -s * x * w;
        const g = [1, x, y], h = [w, y * w, -x * w];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) J[i][j] += h[i] * g[j];
      }
      const F = [R[0] - N, R[1] - Mx, R[2] - My];
      if (Math.abs(F[0]) < 1e-7 * N && Math.abs(F[1]) + Math.abs(F[2]) < 1e-7 * N * (forme.B || forme.D)) { conv = true; break; }
      let d;
      try { d = PQ.lu(J.map((r) => r.slice()))(F.map((v) => -v)); } catch (e) { break; }
      if (!d.every(Number.isFinite)) break;
      let t = 1; a += t * d[0]; b += t * d[1]; c += t * d[2];
    }
    let Ac = 0; for (const [x, y, w] of P) if (a + b * x + c * y > 0) Ac += w;
    const v = C.map(([x, y]) => sig(x, y));
    return { ok: conv, decomp: 100 * (1 - Ac / A), smax: Math.max(...v), smin: Math.max(0, Math.min(...v)), a, b, c, Ac, A };
  }

  /* ── courbes de frottement latéral Q1…Q7 (Fasc. 62 titre V annexe C3), pl* en MPa → qs en MPa ── */
  function qsCourbe(n, pl) {
    if (!(pl > 0)) return 0;
    const q5 = pl >= 0.2 ? Math.min((pl - 0.2) / 9, (pl + 3.3) / 32) : 0;
    if (n >= 1 && n <= 4) { const qsn = 0.04 * n, pn = 1 + 0.5 * n, r = pl / pn; return r < 1 ? qsn * r * (2 - r) : qsn; }
    if (n === 5) return q5;
    if (n === 6) return Math.min((pl + 0.2) / 10, (pl + 4.0) / 30);
    if (n === 7) return (pl + 0.4) / 10;
    return 0;
  }
  const TYPES_PIEU = {
    1: { nom: 'Foré simple', k1: 1.1, cle: 'simple' },
    2: { nom: 'Foré boue', k1: 1.2, cle: 'boue' },
    3: { nom: 'Foré tubé récupéré, bétonné à sec', k1: 1.1, cle: 'tube' },
    4: { nom: 'Foré tubé perdu, bétonné à sec', k1: 1.1, cle: 'perdu' },
    7: { nom: 'Barrette (forée boue)', k1: 1.2, cle: 'boue', barrette: true },
    8: { nom: 'Puits (semi-profond)', k1: 1.1, cle: 'puits' },
  };
  /* choix de la courbe (tableau de l'annexe C3) ; reale : réalésage / rainurage en fin de forage ; long : L > 30 m */
  const QTAB = {
    simple: { argile: ['Q1', 'Q1', 'Q2'], sable: [null, null, null], craie: ['Q1', 'Q3', 'Q4'], marne: ['Q3', 'Q4'], roche: ['Q6', 'Q6'] },
    boue: { argile: ['Q1', 'Q1', 'Q1'], sable: ['Q1', 'Q2', 'Q3'], craie: ['Q1', 'Q3', 'Q4'], marne: ['Q3', 'Q4'], roche: ['Q6', 'Q6'] },
    tube: { argile: ['Q1', 'Q1', 'Q1'], sable: ['Q1', 'Q2', 'Q3'], craie: ['Q1', 'Q2', 'Q3'], marne: ['Q3', 'Q4'], roche: ['Q6', 'Q6'] },
    perdu: { argile: ['Q1', 'Q1', 'Q1'], sable: ['Q1', 'Q2', 'Q2'], craie: ['Q1', 'Q2', 'Q3'], marne: ['Q2', 'Q3'], roche: ['Q3', 'Q3'] },
    puits: { argile: ['Q1', 'Q2', 'Q3'], sable: [null, null, null], craie: ['Q1', 'Q2', 'Q3'], marne: ['Q4', 'Q5'], roche: ['Q6', 'Q6'] },
  };
  function courbeAuto(type, seg, o = {}) {
    const T = QTAB[(TYPES_PIEU[type] || TYPES_PIEU[1]).cle] || QTAB.boue;
    const row = T[seg.groupe] || T.argile, k = Math.max(0, 'ABC'.indexOf(seg.categorie));
    let q = row[Math.min(k, row.length - 1)], note = '';
    if (!q) { q = 'Q1'; note = 'type de pieu non prévu par le tableau dans ce sol : Q1 retenue'; }
    let n = +q.slice(1);
    if (o.reale && ['argile', 'craie', 'marne'].includes(seg.groupe) && n < 5) { n += 1; note = 'réalésage / rainurage'; }
    if (o.long && seg.groupe === 'sable' && n > 1 && ['boue', 'tube'].includes((TYPES_PIEU[type] || {}).cle)) { n -= 1; note = 'pieu de plus de 30 m'; }
    return { n, note };
  }

  /* ── module de réaction latérale de Ménard (annexe C5) : Es (MPa = kN/m par m de pieu et par m de déplacement… /1000) ── */
  function esMenard(EM, alpha, B) {
    return B >= B0 ? 12 * EM / (4 / 3 * (B0 / B) * Math.pow(2.65 * B / B0, alpha) + alpha) : 12 * EM / (4 / 3 * Math.pow(2.65, alpha) + alpha);
  }

  /* ── combinaisons ── */
  function typeComb(s) {
    const t = String(s || '').toLowerCase();
    if (/elu/.test(t)) return /acc/.test(t) ? 'ELU acc' : /sis|séi|sei/.test(t) ? 'ELU sis' : 'ELU fond';
    if (/qua|q\.?p|perm/.test(t)) return 'ELS qp';
    if (/fr[eé]q/.test(t)) return 'ELS freq';
    return 'ELS rare';
  }
  const isELU = (t) => t.startsWith('ELU');
  /* transport d'un torseur du point (px,py,z0) au point (qx,qy,z1) */
  function transport(T, px, py, z0, qx, qy, z1) {
    const [Fx, Fy, Fz, Mx, My, Mz] = T, rx = px - qx, ry = py - qy, rz = z0 - z1;
    return [Fx, Fy, Fz, Mx + ry * Fz - rz * Fy, My + rz * Fx - rx * Fz, Mz + rx * Fy - ry * Fx];
  }
  const add6 = (a, b) => a.map((v, k) => v + b[k]);

  /* ══════════════ FONDATION SUPERFICIELLE OU SEMI-PROFONDE ══════════════ */
  function calcSup(d) {
    const sps = d.sps, col = colonne(sps, d.zdef, Number.isFinite(d.zRemblai) ? d.zRemblai : d.ztn), notes = [];
    const s = d.sup || {}, circ = s.forme === 'circ';
    const B = circ ? s.D : Math.min(s.B, s.L), L = circ ? s.D : Math.max(s.B, s.L);
    const forme = circ ? { circ: true, D: s.D } : { B: s.B, L: s.L };
    const semi = d.type === 'semi';
    const hM = semi ? (s.h || 0) : 0; // hauteur du massif / puits sous la semelle
    const zf = d.zsem - hM;
    const zeau = Number.isFinite(d.zeau) ? d.zeau : (sps.nappe > 0 ? sps.z - sps.nappe : -1e9);
    // ple* : moyenne géométrique de pl* entre D et D + 1,5 B (annexe B)
    const zInf = zf - 1.5 * B;
    if (zInf < col.zFinSondage - 1e-6) notes.push('Le sondage s’arrête avant D + 1,5 B : les valeurs de la dernière couche sont prolongées.');
    const ple = geoMean(col, zf, zInf);
    const De = integ(col, d.zdef, zf, (g) => g.pl) / ple;
    const seg = segAt(col, zf - 1e-6);
    const kd = kpDe(seg, De / B, B / L);
    if (Number.isFinite(s.kp) && s.kp > 0) { kd.kp = s.kp; kd.domaine += ' (kp imposé)'; }
    const q0 = sigmaV(d.zdef, zf, zeau, d.gamma, d.gammaSat) / 1000; // MPa
    const qu = kd.kp * ple + q0;
    // modules de réaction verticale (annexe F2)
    const mm = modulesMenard(col, zf, B), sm = souplesseMenard(B, L, circ, seg.alpha, mm.Ec, mm.Ed);
    const kvLD = 1 / sm.s, kvCD = kvLD * (d.rapSol || 2);
    const sv0 = sigmaV(Math.min(d.ztn, d.zdef), zf, zeau, d.gamma, d.gammaSat) / 1000; // contrainte initiale (terrain le plus bas)
    const phi = Number.isFinite(s.phi) ? s.phi : (seg.phi || 30), coh = Number.isFinite(s.c) ? s.c : 0;
    const frottant = s.sol ? s.sol === 'frottant' : (seg.groupe === 'sable');
    const mu = Number.isFinite(s.mu) && s.mu > 0 ? s.mu : Math.tan(phi * Math.PI / 180) / 1.2;
    const ib = Number.isFinite(s.ibeta) && s.ibeta > 0 ? s.ibeta : 1;
    const A = circ ? Math.PI * s.D * s.D / 4 : s.B * s.L;
    const poids = semi ? A * hM * (zf < zeau ? d.gammaB - 10 : d.gammaB) : 0;
    const res = (d.combs || []).map((cb, k) => {
      const t = typeComb(cb.type);
      const TLD = transport(cb.ld, d.px || 0, d.py || 0, d.zsem, 0, 0, zf), TCD = transport(cb.cd, d.px || 0, d.py || 0, d.zsem, 0, 0, zf);
      TLD[2] -= poids;
      const T = add6(TLD, TCD);
      const N = -T[2], H = Math.hypot(T[0], T[1]);
      const r = repartition(forme, N, T[3], T[4]);
      const qref = s.methode === 'meyerhof' ? meyerhof(forme, N, T[3], T[4]) : (3 * r.smax + r.smin) / 4 / 1000;
      const delta = N > 0 ? Math.atan(H / N) * 180 / Math.PI : 90;
      const id = iDelta(delta, frottant, De / B);
      const gq = isELU(t) ? 2 : 3;
      const qadm = q0 + (qu - q0) * id * ib / gq;
      const Hres = N * mu + (coh > 0 ? coh * (r.Ac || A) / 1.5 : 0);
      const sLD = Math.max(0, -TLD[2] / A / 1000 - sv0) * sm.s, sCD = Math.max(0, -TCD[2] / A / 1000) * sm.s / (d.rapSol || 2);
      return { n: k + 1, type: t, T, N, H, smax: r.smax / 1000, smin: r.smin / 1000, decomp: r.decomp, qref, delta, id, qadm, okP: qref <= qadm + 1e-9,
        Hres, glis: H > 0 ? Hres / H : Infinity, okG: !isELU(t) || Hres >= H, tass: (sLD + sCD) * 1000, conv: r.ok };
    });
    const lim = { 'ELS freq': 0, 'ELS qp': 0, 'ELS rare': 25, 'ELU fond': 90, 'ELU acc': 90, 'ELU sis': 90 };
    res.forEach((r) => { r.decompAdm = lim[r.type]; r.okD = r.decomp <= r.decompAdm + 1e-6; r.ok = r.okP && r.okD && r.okG; });
    const pire = (f, flt) => res.filter(flt).reduce((m, r) => (!m || f(r) > f(m) ? r : m), null);
    return {
      type: d.type, col, B, L, zf, ple, De, DeB: De / B, seg, kp: kd.kp, domaine: kd.domaine, q0, qu, mm, sm, kvLD, kvCD, sv0, frottant, phi, mu, ibeta: ib,
      poids, A, combs: res, notes,
      synth: {
        els: pire((r) => r.qref / r.qadm, (r) => !isELU(r.type)), elu: pire((r) => r.qref / r.qadm, (r) => isELU(r.type)),
        glis: pire((r) => -r.glis, (r) => isELU(r.type)), ok: res.every((r) => r.ok),
      },
    };
  }
  function meyerhof(forme, N, Mx, My) {
    if (!(N > 0)) return Infinity;
    const ex = Math.abs(My / N), ey = Math.abs(Mx / N);
    if (forme.circ) { const R = forme.D / 2, e = Math.hypot(ex, ey); if (e >= R) return Infinity; const Ae = 2 * (R * R * Math.acos(e / R) - e * Math.sqrt(R * R - e * e)); return N / Ae / 1000; }
    const Bp = forme.B - 2 * ex, Lp = forme.L - 2 * ey;
    return Bp > 0 && Lp > 0 ? N / (Bp * Lp) / 1000 : Infinity;
  }

  /* ══════════════ FONDATION PROFONDE ══════════════ */
  function portance(d) {
    const p = d.pieux, col = colonne(d.sps, d.zdef, Number.isFinite(d.zRemblai) ? d.zRemblai : d.sps.z), notes = [];
    const ty = TYPES_PIEU[p.type] || TYPES_PIEU[2];
    const barr = !!ty.barrette || p.forme === 'barrette';
    const B = p.B, Lb = barr ? Math.max(p.Lb || B, B) : B;
    const Ap = barr ? B * Lb : Math.PI * B * B / 4, P = barr ? 2 * (B + Lb) : Math.PI * B;
    const zt = d.zsem, zb = d.zsem - p.L;
    if (zb < col.zFinSondage - 1e-6) notes.push('La pointe est sous la fin du sondage : couche inférieure prolongée.');
    const a = Math.max(B / 2, 0.5), segB = segAt(col, zb + 1e-6), segBelow = segAt(col, zb - 1e-6);
    const h = Math.max(0, segBelow.zh - zb), b = Math.min(a, h);
    const ple = arithMean(col, zb + b, zb - 3 * a);
    const De = integ(col, d.zdef, zb, (g) => g.pl) / ple;
    const kd = kpDe(segBelow, De / B, B / Lb);
    if (Number.isFinite(p.kp) && p.kp > 0) { kd.kp = p.kp; kd.domaine += ' (kp imposé)'; }
    const qpu = kd.kp * ple; // MPa
    const Qpu = qpu * Ap * 1000;
    // frottement latéral de zt - h0 jusqu'à la pointe
    const h0 = p.h0 || 0, zq = zt - h0, tr = [];
    let Qsu = 0;
    for (const s of col) {
      const a1 = Math.min(zq, s.zh), b1 = Math.max(zb, s.zb);
      if (a1 <= b1) continue;
      let n, note = '', qs;
      const ov = (p.qs || {})[s.nom];
      if (s.remblai) { n = 0; qs = 0; note = 'remblai : frottement négligé'; }
      else if (ov && Number.isFinite(ov.qs)) { qs = ov.qs; n = 0; note = 'qs imposé'; }
      else {
        const ca = ov && ov.n ? { n: ov.n, note: 'courbe imposée' } : courbeAuto(p.type, s, { reale: p.reale, long: p.L > 30 });
        n = ca.n; note = ca.note; qs = qsCourbe(n, s.pl);
      }
      const Q = qs * P * (a1 - b1) * 1000;
      Qsu += Q;
      tr.push({ nom: s.nom, zh: a1, zb: b1, pl: s.pl, courbe: n ? 'Q' + n : '—', qs, Q, note });
    }
    // résistance conventionnelle du béton (art. C.? du titre V, « fc = min(fcj, fc28, 25)/(k1·k2) »)
    const k2 = B < 0.6 ? 1.3 - B / 2 : 1.0;
    const fc = Math.min(d.fcj, 25) / (ty.k1 * k2);
    const Qu = Qpu + Qsu, Qtu = Qsu, Qc = 0.5 * Qpu + 0.7 * Qsu, Qtc = 0.7 * Qsu;
    const ce = Number.isFinite(p.ce) && p.ce > 0 ? p.ce : 1; // coefficient d'efficacité du groupe
    const lim = {
      'ELU fond': [ce * Qu / 1.4, -ce * Qtu / 1.4], 'ELU acc': [ce * Qu / 1.2, -ce * Qtu / 1.3], 'ELU sis': [ce * Qu / 1.2, -ce * Qtu / 1.3],
      'ELS rare': [ce * Qc / 1.1, -ce * Qtc / 1.4], 'ELS freq': [ce * Qc / 1.1, -ce * Qtc / 1.4], 'ELS qp': [ce * Qc / 1.4, 0],
    };
    return { col, B, Lb, barr, Ap, P, zt, zb, a, b, h, ple, De, DeB: De / B, seg: segBelow, kp: kd.kp, domaine: kd.domaine, qpu, Qpu, Qsu, tr, Qu, Qtu, Qc, Qtc, lim,
      fc, k1: ty.k1, k2, Nbeton: 0.3 * fc * Ap * 1000, notes, typeNom: ty.nom };
  }

  /* ressorts latéraux nodaux d'un pieu : k (kN/m) et palier (kN) par nœud, pour une direction donnée */
  function ressortsLateraux(d, pt, dir) {
    const p = d.pieux, col = pt.col, n = p.nseg || 10, L = p.L, hseg = L / n, Bw = pt.barr ? (dir === 'x' ? (p.orientBarrette === 'x' ? pt.B : pt.Lb) : (p.orientBarrette === 'x' ? pt.Lb : pt.B)) : pt.B;
    const zc = 2 * Bw, red = p.reducKf || {}, nodes = [];
    for (let k = 0; k <= n; k++) {
      const s1 = Math.max(0, (k - 0.5) * hseg), s2 = Math.min(L, (k + 0.5) * hseg), tl = s2 - s1;
      let K = 0, Pf = 0;
      for (const sg of col) {
        const a = Math.min(d.zsem - s1, sg.zh), b = Math.max(d.zsem - s2, sg.zb);
        if (a <= b) continue;
        // réduction près de la surface (z mesuré depuis le terrain définitif) : (1 + z/zc)/2 pour z < zc
        const zm = d.zdef - (a + b) / 2, rs = p.surface === false ? 1 : zm < zc ? (1 + Math.max(0, zm) / zc) / 2 : 1;
        const rr = red[dir];
        const rk = Number.isFinite(rr) ? rr : (rr && Number.isFinite(rr[sg.nom]) ? rr[sg.nom] : 1); // coefficient de groupe saisi (global ou par couche)
        K += esMenard(sg.em, sg.alpha, Bw) * rs * rk * (a - b);
        Pf += sg.pf * Bw * rs * (a - b);
      }
      nodes.push({ s: k * hseg, k: K * 1000, P: Pf * 1000, trib: tl });
    }
    return nodes;
  }

  /* modèle 2D d'un pieu (axe s vers le bas → x du portique, déplacement latéral w → y) */
  function modelePieu(n, L, EI, springs, kbase) {
    const nodes = [], elems = [], supports = [];
    for (let k = 0; k <= n; k++) nodes.push({ x: L * k / n, y: 0 });
    for (let k = 0; k < n; k++) elems.push({ i: k, j: k + 1, E: 1, A: 1e6, I: EI });
    supports.push({ n: 0, ux: true, uy: true, rz: true });
    for (let k = 1; k <= n; k++) {
      const sp = { n: k, uy: Math.max(springs[k], 1e-6) };
      if (k === n) { if (kbase.h > 0) sp.uy += kbase.h; if (kbase.r > 0) sp.rz = kbase.r; }
      supports.push(sp);
    }
    if (springs[0] > 0) { /* le ressort du nœud de tête est absorbé par la semelle (déplacement imposé) */ }
    return PQ.prepare({ nodes, elems, supports });
  }

  /* résolution du groupe pour une phase (longue ou courte durée) */
  function phaseGroupe(d, pt, base, F, phase, prev) {
    const p = d.pieux, n = p.nseg || 10, piles = p.piles, np = piles.length;
    const kfac = phase === 'ld' ? 1 / (d.rapSol || 2) : 1;
    const E = base.Ei * (phase === 'ld' ? 1 / (d.rapBet || 3) : 1) * 1000; // kPa
    const EI = { x: E * base.Iy, y: E * base.Ix }, EA = E * pt.Ap, kax = 1 / (p.L / EA + 1 / (p.kbase > 0 ? p.kbase : 1e12));
    const G = E / 2.4, kt = G * base.J / p.L;
    const rows = { x: [...new Set(piles.map((q) => +q.x.toFixed(3)))].sort((a, b) => a - b), y: [...new Set(piles.map((q) => +q.y.toFixed(3)))].sort((a, b) => a - b) };
    const st = piles.map((q, i) => ({
      x: { k0: base.spr.x.map((nd) => nd.k * kfac), P: base.spr.x.map((nd) => nd.P), ks: base.spr.x.map((nd) => nd.k * kfac) },
      y: { k0: base.spr.y.map((nd) => nd.k * kfac), P: base.spr.y.map((nd) => nd.P), ks: base.spr.y.map((nd) => nd.k * kfac) },
    }));
    const pPrev = (i, dir, k) => (prev ? prev.piles[i][dir].p[k] : 0);
    let U = [0, 0, 0, 0, 0, 0], it = 0, conv = false, sol;
    const cache = new Map();
    const getModel = (dir, ks) => { const key = dir + ks.map((v) => v.toPrecision(6)).join(','); if (!cache.has(key)) { if (cache.size > 400) cache.clear(); cache.set(key, modelePieu(n, p.L, EI[dir], ks, { h: p.kbaseH || 0, r: p.kbaseR || 0 })); } return cache.get(key); };
    for (it = 1; it <= (p.itMax || 40); it++) {
      const K = Array.from({ length: 6 }, () => new Array(6).fill(0));
      const heads = [];
      piles.forEach((q, i) => {
        const h = {};
        for (const dir of ['x', 'y']) {
          const m = getModel(dir, st[i][dir].ks);
          const r1 = m.run({ disp: [{ n: 0, dof: 'uy', v: 1 }] }), r2 = m.run({ disp: [{ n: 0, dof: 'rz', v: 1 }] });
          // ressort du nœud de tête (demi-élément sous la semelle) : ajouté directement à la raideur en tête
          const k2 = [[r1.reac[0].Ry + st[i][dir].ks[0], r2.reac[0].Ry], [r1.reac[0].Mz, r2.reac[0].Mz]];
          // w = Ux − θz·y, φ = −θy (direction X) ; w = Uy + θz·x, φ = θx (direction Y)
          const T = dir === 'x' ? [[1, 0, 0, 0, 0, -q.y], [0, 0, 0, 0, -1, 0]] : [[0, 1, 0, 0, 0, q.x], [0, 0, 0, 1, 0, 0]];
          for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) { let v = 0; for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) v += T[r][a] * k2[r][c] * T[c][b]; K[a][b] += v; }
          h[dir] = { m, T };
        }
        const Ta = [0, 0, 1, q.y, -q.x, 0];
        for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) K[a][b] += Ta[a] * kax * Ta[b];
        K[5][5] += kt;
        heads.push(h);
      });
      const Unew = PQ.lu(K.map((r) => r.slice()))(F.slice());
      // réponse des pieux et mise à jour des modules sécants
      let chg = 0;
      const Ut = prev ? Unew.map((v, k) => v + prev.U[k]) : Unew;
      // files arrière (palier × 0,75) selon le sens du déplacement total de la semelle
      const rear = { x: (x) => rows.x.length > 1 && (Ut[0] >= 0 ? x < rows.x[rows.x.length - 1] - 1e-3 : x > rows.x[0] + 1e-3), y: (y) => rows.y.length > 1 && (Ut[1] >= 0 ? y < rows.y[rows.y.length - 1] - 1e-3 : y > rows.y[0] + 1e-3) };
      sol = piles.map((q, i) => {
        const o = {};
        for (const dir of ['x', 'y']) {
          const T = heads[i][dir].T, w = T[0].reduce((t, v, k) => t + v * Unew[k], 0), ph = T[1].reduce((t, v, k) => t + v * Unew[k], 0);
          const r = heads[i][dir].m.run({ disp: [{ n: 0, dof: 'uy', v: w }, { n: 0, dof: 'rz', v: ph }] });
          const fr = rear[dir](dir === 'x' ? q.x : q.y) ? (p.palierArriere || 0.75) : 1;
          const S = st[i][dir], wn = [], pn = [];
          for (let k = 0; k <= n; k++) {
            const wk = r.U[3 * k + 1]; wn.push(wk);
            const P = S.P[k] * fr, p0 = pPrev(i, dir, k), trial = p0 + S.k0[k] * wk;
            let ks = S.k0[k];
            if (Math.abs(trial) > P && Math.abs(wk) > 1e-12) { const tgt = Math.sign(trial) * P; ks = Math.min(S.k0[k], Math.max(S.k0[k] * 1e-6, (tgt - p0) / wk)); }
            chg = Math.max(chg, Math.abs(ks - S.ks[k]) / S.k0[k]);
            S.ks[k] = 0.5 * (S.ks[k] + ks);
            pn.push(S.ks[k] * wk);
          }
          const dg = []; for (let e = 0; e < n; e++) { const a = r.at(e, 0), b = r.at(e, p.L / n); if (!e) dg.push({ s: 0, M: a.M, V: a.V }); dg.push({ s: (e + 1) * p.L / n, M: b.M, V: b.V }); }
          o[dir] = { w, ph, F: r.reac[0].Ry + S.ks[0] * w, M: r.reac[0].Mz, wn, p: pn, dg, plast: pn.map((v, k) => Math.abs(v + pPrev(i, dir, k)) >= S.P[k] * fr * 0.999 && S.P[k] > 0) };
        }
        const dz = Unew[2] + Unew[3] * q.y - Unew[4] * q.x;
        o.N = -kax * dz; o.dz = dz; o.T = kt * Unew[5];
        return o;
      });
      const du = Math.max(...Unew.map((v, k) => Math.abs(v - U[k]))) / Math.max(1e-9, ...Unew.map(Math.abs));
      U = Unew;
      if (it > 1 && chg < 1e-4 && du < 1e-5) { conv = true; break; }
      if (Math.max(...Unew.slice(0, 3).map(Math.abs)) > (p.depMax || 0.2)) break;
    }
    return { U, piles: sol, conv, it, kax, kt, EI };
  }

  function calcPieux(d) {
    const p = d.pieux;
    if (!p.piles || !p.piles.length) throw new Error('Aucun pieu défini.');
    if (p.piles.length > 24) throw new Error('24 pieux au plus.');
    const pt = portance(d);
    if (pt.barr && p.piles.length > 12) throw new Error('12 barrettes au plus.');
    const Ei = 11000 * Math.cbrt(pt.fc); // MPa — module instantané du béton (fc conventionnelle)
    const Ix = pt.barr ? (p.orientBarrette === 'x' ? pt.Lb * Math.pow(pt.B, 3) / 12 : pt.B * Math.pow(pt.Lb, 3) / 12) : Math.PI * Math.pow(pt.B, 4) / 64;
    const Iy = pt.barr ? (p.orientBarrette === 'x' ? pt.B * Math.pow(pt.Lb, 3) / 12 : pt.Lb * Math.pow(pt.B, 3) / 12) : Ix;
    // Ix : flexion dans le plan YZ (déplacement Y) ; Iy : flexion dans le plan XZ (déplacement X)
    const J = pt.barr ? (() => { const a = Math.max(pt.B, pt.Lb), b = Math.min(pt.B, pt.Lb); return a * b * b * b * (1 / 3 - 0.21 * b / a * (1 - Math.pow(b / a, 4) / 12)); })() : Math.PI * Math.pow(pt.B, 4) / 32;
    // discrétisation interne : chaque élément de sortie est subdivisé (ressorts linéiques ≈ répartis), résultats aux nœuds de sortie
    const nOut = p.nseg || 10, sub = p.sub || 4, dI = Object.assign({}, d, { pieux: Object.assign({}, p, { nseg: nOut * sub }) });
    const base = { Ei, Ix, Iy, J, spr: { x: ressortsLateraux(dI, pt, 'x'), y: ressortsLateraux(dI, pt, 'y') } };
    const pick = (a) => a.filter((_, k) => k % sub === 0);
    const fn = p.frotNeg || {};
    const combs = (d.combs || []).map((cb, k) => {
      const t = typeComb(cb.type);
      const Fld = transport(cb.ld, d.px || 0, d.py || 0, d.zsem, 0, 0, d.zsem), Fcd = transport(cb.cd, d.px || 0, d.py || 0, d.zsem, 0, 0, d.zsem);
      const ld = phaseGroupe(dI, pt, base, Fld, 'ld', null);
      const cd = phaseGroupe(dI, pt, base, Fcd, 'cd', ld);
      const gsn = isELU(t) ? (fn.elu || 0) : (fn.els || 0);
      const piles = p.piles.map((q, i) => {
        const a = ld.piles[i], b = cd.piles[i];
        const N = a.N + b.N, Fx = a.x.F + b.x.F, Fy = a.y.F + b.y.F, My = -(a.x.M + b.x.M), Mx = a.y.M + b.y.M;
        const dgx = a.x.dg.map((g, k) => ({ s: g.s, M: g.M + b.x.dg[k].M, V: g.V + b.x.dg[k].V }));
        const dgy = a.y.dg.map((g, k) => ({ s: g.s, M: g.M + b.y.dg[k].M, V: g.V + b.y.dg[k].V }));
        const Mres = dgx.map((g, k) => Math.hypot(g.M, dgy[k].M)), Vres = dgx.map((g, k) => Math.hypot(g.V, dgy[k].V));
        const plast = a.x.plast.some(Boolean) || b.x.plast.some(Boolean) || a.y.plast.some(Boolean) || b.y.plast.some(Boolean);
        const Mfull = Mres, Vfull = Vres;
        return { i: i + 1, N, Ng: N + gsn, Fx, Fy, Mx, My, Mz: a.T + b.T, dx: a.x.w + b.x.w, dy: a.y.w + b.y.w, dz: a.dz + b.dz,
          dgx: pick(dgx), dgy: pick(dgy), Mres: pick(Mfull), Vres: pick(Vfull), MmaxSeg: Math.max(...Mfull), sFine: dgx.map((g) => g.s), MresFine: Mfull,
          wx: pick(a.x.wn.map((v, k) => v + b.x.wn[k])), wy: pick(a.y.wn.map((v, k) => v + b.y.wn[k])),
          px: pick(a.x.p.map((v, k) => v + b.x.p[k])), py: pick(a.y.p.map((v, k) => v + b.y.p[k])), plast };
      });
      const [qmax, qmin] = pt.lim[t];
      const Nmax = Math.max(...piles.map((q) => q.Ng)), Nmin = Math.min(...piles.map((q) => q.N));
      const ok = Nmax <= qmax + 1e-6 && Nmin >= qmin - 1e-6 && (isELU(t) || Nmax <= pt.Nbeton + 1e-6) && ld.conv && cd.conv;
      return { n: k + 1, type: t, piles, Nmax, Nmin, qmax, qmin, ok, conv: ld.conv && cd.conv, it: [ld.it, cd.it], U: ld.U.map((v, j) => v + cd.U[j]), Uld: ld.U, Ucd: cd.U };
    });
    // aciers longitudinaux (méthode simplifiée) : enveloppe ELU de M résultant avec N mini concomitant au pieu
    const acier = aciersPieux(d, pt, combs);
    return { type: 'pieux', pt, base, combs, acier, synth: { ok: combs.every((c) => c.ok) && acier.ok } };
  }

  /* ── section circulaire en flexion composée à l'ELU : moment résistant pour un N donné ──
   * bloc rectangulaire 0,8x à 0,85·fc/1,5 ; aciers élasto-plastiques fe/1,15 ; εcu = 3,5 ‰ ; 24 barres réparties. */
  function mrdCirc(D, c, As, N, fc, fe) {
    const R = D / 2, Rs = R - c, nb = 24, fbu = 0.85 * fc / 1.5 * 1000, fsu = fe / 1.15 * 1000, Es = 2e8, ecu = 0.0035;
    const bars = []; for (let k = 0; k < nb; k++) bars.push(Rs * Math.cos(2 * Math.PI * k / nb));
    const Ab = As / nb;
    const forces = (x) => { // x : profondeur de l'axe neutre depuis la fibre la plus comprimée (y = R)
      const yb = R - 0.8 * x; let Nc = 0, Mc = 0;
      if (0.8 * x > 0) { const nS = 60, y0 = Math.max(-R, yb), h = (R - y0) / nS; for (let k = 0; k < nS; k++) { const y = y0 + (k + 0.5) * h, w = 2 * Math.sqrt(Math.max(0, R * R - y * y)); Nc += fbu * w * h; Mc += fbu * w * h * y; } }
      for (const y of bars) { const eps = ecu * (x - (R - y)) / x; const s = Math.max(-fsu, Math.min(fsu, Es * eps)); Nc += s * Ab; Mc += s * Ab * y; }
      return { N: Nc, M: Mc };
    };
    let lo = 1e-4, hi = 20 * D;
    if (forces(hi).N < N) return 0; // compression excessive
    if (forces(lo).N > N) return 0;
    for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (forces(m).N > N) hi = m; else lo = m; }
    return forces((lo + hi) / 2).M;
  }
  function aciersPieux(d, pt, combs) {
    const p = d.pieux, c = p.enrob || 0.09, out = [];
    if (pt.barr) return { ok: true, sections: [], note: 'Aciers des barrettes non calculés par ce module (section rectangulaire : utiliser le module BAEL-EC2).' };
    const n = p.nseg || 10, Ac = pt.Ap, Amin = (p.pmin != null ? p.pmin : 0.5) / 100 * Ac;
    let ok = true;
    for (let k = 0; k <= n; k++) {
      let req = 0, crit = null;
      for (const cb of combs) {
        if (!isELU(cb.type)) continue;
        for (const q of cb.piles) {
          const M = q.Mres[k], N = q.N; // N au droit de la tête (poids propre et frottement négligés : enveloppe)
          if (mrdCirc(pt.B, c, 0, N, pt.fc, d.fe) >= M) continue;
          let lo = 0, hi = 0.08 * Ac;
          if (mrdCirc(pt.B, c, hi, N, pt.fc, d.fe) < M) { req = Infinity; crit = { comb: cb.n, pieu: q.i, M, N }; ok = false; continue; }
          for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (mrdCirc(pt.B, c, m, N, pt.fc, d.fe) >= M) hi = m; else lo = m; }
          if (hi > req) { req = hi; crit = { comb: cb.n, pieu: q.i, M, N }; }
        }
      }
      out.push({ s: k * p.L / n, Aelu: req * 1e4, Amin: Amin * 1e4, A: Math.max(req, Amin) * 1e4, crit });
    }
    return { ok, sections: out, Amin: Amin * 1e4 };
  }

  /* ══════════════ point d'entrée ══════════════ */
  function defauts(d) {
    return Object.assign({ gamma: 19, gammaSat: 21, gammaB: 25, rapSol: 2, rapBet: 3, fcj: 28, fe: 500, px: 0, py: 0 }, d);
  }
  function calc(d0) {
    const d = defauts(d0);
    if (!d.sps) throw new Error('Sondage pressiométrique manquant.');
    if (!(d.combs && d.combs.length)) throw new Error('Aucune combinaison d’actions.');
    if (d.type === 'pieux') return calcPieux(d);
    return calcSup(d);
  }

  /* ── lecture d'un fichier de données .DON d'origine (format « mot-clé ; commentaire » puis valeur) ── */
  function parseDon(text) {
    const L = String(text).replace(/\r\n?/g, '\n').split('\n');
    const kv = {}, piles = [], combs = [];
    for (let i = 0; i < L.length; i++) {
      const raw = L[i]; if (!raw.trim() || raw.trim().startsWith(';')) continue;
      const key = raw.split(/[;\s]/)[0].trim().toLowerCase();
      if (key === 'pieu') { const v = (L[++i] || '').trim().split(/\s+/).map(Number); piles.push({ x: v[0] || 0, y: v[1] || 0 }); continue; }
      if (key === 'point' || key === 'sempoint') { const v = (L[++i] || '').trim().split(/\s+/).map(Number); (kv['_' + key] = kv['_' + key] || []).push(v); continue; }
      if (key === 'comb') {
        const ld = (L[++i] || '').trim().split(/\s+/).map(Number), cd = (L[++i] || '').trim().split(/\s+/).map(Number), ty = (L[++i] || '').trim();
        const cb = { type: ty, ld: ld.slice(0, 6).map((v) => v || 0), cd: cd.slice(0, 6).map((v) => v || 0) };
        while (i + 1 < L.length && /^(S_CD|ZEAU)/i.test(L[i + 1].trim())) { const t = L[++i].trim().split(/\s+/); if (/^ZEAU/i.test(t[0])) cb.zeau = +t[1]; else cb.scd = +t[1]; }
        combs.push(cb); continue;
      }
      if (/^[a-z_][a-z0-9_]*$/.test(key)) { const v = L[i + 1] !== undefined ? L[i + 1].trim() : ''; if (!v.startsWith(';')) { kv[key] = v; i++; } }
    }
    const n = (k, def) => { const v = parseFloat(kv[k]); return Number.isFinite(v) ? v : def; };
    const tcf = n('typecalfond', 1);
    const type = tcf === 0 ? 'pieux' : tcf === 1 ? 'sup' : 'semi';
    const circ = (type === 'pieux' ? n('typesectionsem', 2) : n('typesection', 2)) === 1;
    const sup = type === 'sup'
      ? { forme: n('typesectionsem', 2) === 1 ? 'circ' : 'rect', B: n('larg_x_sem', 0) || n('larg_x', 0), L: n('lon_y_sem', 0) || n('lon_y', 0), D: n('larg_x_sem', 0), phi: n('phifond', 30), c: n('cohesionfond', 0), sol: n('typesolfrot', 1) ? 'frottant' : 'coherent' }
      : { forme: n('typesection', 2) === 1 ? 'circ' : 'rect', B: n('larg_x', 0), L: n('lon_y', 0), D: n('larg_x', 0), h: n('htmassifs', 0), phi: n('phifond', 30), c: n('cohesionfond', 0), sol: n('typesolfrot', 1) ? 'frottant' : 'coherent' };
    const tp = n('typepieu', 2);
    return {
      type, spsNom: kv.nomficsps || '', zsem: n('zsem', 0), zdef: n('zdef', 0), ztn: n('ztn', 0),
      gamma: n('poivolter', 19), gammaSat: n('poivoltersat', 21), gammaB: n('poivolbet', 25), rapSol: n('rapmodsol', 2), rapBet: n('rapmodbet', 3),
      fcj: n('fcj', 28), fe: n('fe', 500), px: n('pteffx', 0), py: n('pteffy', 0),
      projet: kv.projet || '', sup,
      pieux: { type: n('lfond', 0) > 0 ? 7 : (tp >= 1 && tp <= 4 ? tp : 2), B: n('dfond', 1), Lb: n('lfond', 0), L: n('htfond', 10), h0: n('hsolcompressible', 0), nseg: Math.round(n('nbelpieuxsol', 10)),
        kbase: n('ressortfzpointe', 0) || 1e8, kbaseR: n('ressortmypointe', 0), kbaseH: n('ressortfxpointe', 0), ce: n('ce', 1), enrob: n('distacier', 0.09), palierArriere: 0.75,
        frotNeg: n('calfrotneg', 0) === 2 ? { els: n('frotnegels', 0), elu: n('frotnegelu', 0) } : {}, piles: piles.length ? piles : [{ x: 0, y: 0 }] },
      combs, avert: [n('calfrotneg', 0) === 1 ? 'Frottement négatif « calcul automatique » (Combarieu) non repris : saisir les valeurs Gsn.' : '', n('pieuxinclines', 0) ? 'Pieux inclinés non traités : calcul en pieux verticaux.' : '', n('tmpieu', 0) ? 'Micropieux non traités.' : '', circ && type !== 'pieux' ? '' : ''].filter(Boolean),
    };
  }

  const api = { calc, colonne, portance, qsCourbe, courbeAuto, kpSup, kpProf, kpDe, iDelta, lambdas, modulesMenard, souplesseMenard, repartition, meyerhof, esMenard, mrdCirc, parseDon, typeComb, transport, TYPES_PIEU, geoMean, arithMean, integ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.fondatio = api; }
})(typeof window !== 'undefined' ? window : globalThis);
