/* INERPE — caractéristiques des sections de tabliers à poutrelles enrobées (moteur pur, sans DOM).
 *
 * Références :
 *  - EN 1994-2 §5.4.2.2 (coefficients d'équivalence nL = n0 (1 + ψL φt)), §6.2.1.2 (résistance plastique en flexion),
 *    §6.3 (poutrelles enrobées « filler beam decks » : domaine d'application §6.3.1).
 *  - EN 1992-1-1 tableau 3.1 (Ecm = 22 (fcm/10)^0,3 GPa), EN 1993-1-1 tableau 3.1 (fy selon l'épaisseur).
 *  - Document commun « Ponts-routes à tablier en poutrelles enrobées » (1995) et Livret 2.01 pour les conventions
 *    reprises par le programme de référence : n = 6 / 18, inertie de déformation (I fissurée + I non fissurée)/2.
 *
 * Repère : y vertical, origine à la sous-face des poutrelles, vers le haut. Unités : m, m², m⁴, kN, kN·m ; MPa pour
 * les matériaux (1 MPa = 1000 kPa). Les inerties ELS sont exprimées « en acier » (aire de béton divisée par n).
 *
 * Exporté : module.exports (node) et window.BA.enrobees (navigateur). BA.enrobees.profiles = catalogue des profilés.
 */
(function (root) {
  'use strict';

  /* ───────────────────────── Catalogue des profilés ─────────────────────────
   * Valeurs nominales des profilés laminés européens HE (Euronorm 53-62, catalogue ArcelorMittal) :
   * [taille, h mm, b mm, tw mm, tf mm, r mm, A cm², Iy cm⁴, Iz cm⁴]. Wel = 2 Iy / h ; Wpl est recalculé à partir des
   * dimensions (congés compris), écart < 0,2 % avec les valeurs publiées. Contrôle : A et Iy recalculés à partir de
   * h, b, tw, tf, r s'écartent de moins de 1 % des valeurs saisies (test tools/test-outils-poutrelles-enrobees.js). */
  const SERIES = {
    HEAA: [[100,91,100,4.2,5.5,12,15.6,236,92],[120,109,120,4.2,5.5,12,18.6,413,158],[140,128,140,4.3,6.0,12,23.0,719,274],[160,148,160,4.5,7.0,15,30.4,1282,478],[180,167,180,5.0,7.5,15,36.5,1966,729],[200,186,200,5.5,8.0,18,44.1,2944,1068],[220,205,220,6.0,8.5,18,51.5,4170,1510],[240,224,240,6.5,9.0,21,60.4,5835,2077],[260,244,260,6.5,9.5,24,69.0,7980,2788],[280,264,280,7.0,10.0,24,78.0,10557,3664],[300,283,300,7.5,10.5,27,88.9,13804,4733],[320,301,300,8.0,11.0,27,94.6,16447,4959],[340,320,300,8.5,11.5,27,100.5,19552,5184],[360,339,300,9.0,12.0,27,106.6,23037,5410],[400,378,300,9.5,13.0,27,117.7,31252,5861],[450,425,300,10.0,13.5,27,127.1,41887,6087],[500,472,300,10.5,14.0,27,136.9,54643,6313],[550,522,300,11.5,15.0,27,152.8,72871,6766],[600,571,300,12.0,15.5,27,164.1,91871,6993],[650,620,300,12.5,16.0,27,175.8,113944,7220],[700,670,300,13.0,17.0,27,190.9,142720,7673],[800,770,300,14.0,18.0,30,218.5,208882,8133],[900,870,300,15.0,20.0,30,252.2,301144,9041],[1000,970,300,16.0,21.0,30,282.2,406451,9500]],
    HEA: [[100,96,100,5.0,8.0,12,21.2,349,133],[120,114,120,5.0,8.0,12,25.3,606,230],[140,133,140,5.5,8.5,12,31.4,1033,389],[160,152,160,6.0,9.0,15,38.8,1672,615],[180,171,180,6.0,9.5,15,45.3,2510,924],[200,190,200,6.5,10.0,18,53.8,3692,1335],[220,210,220,7.0,11.0,18,64.3,5409,1954],[240,230,240,7.5,12.0,21,76.8,7763,2768],[260,250,260,7.5,12.5,24,86.8,10454,3667],[280,270,280,8.0,13.0,24,97.3,13673,4762],[300,290,300,8.5,14.0,27,112.5,18263,6309],[320,310,300,9.0,15.5,27,124.4,22928,6985],[340,330,300,9.5,16.5,27,133.5,27693,7435],[360,350,300,10.0,17.5,27,142.8,33089,7886],[400,390,300,11.0,19.0,27,159.0,45069,8563],[450,440,300,11.5,21.0,27,178.0,63721,9465],[500,490,300,12.0,23.0,27,197.5,86974,10367],[550,540,300,12.5,24.0,27,211.8,111932,10819],[600,590,300,13.0,25.0,27,226.5,141208,11271],[650,640,300,13.5,26.0,27,241.6,175178,11723],[700,690,300,14.5,27.0,27,260.5,215301,12178],[800,790,300,15.0,28.0,30,285.8,303442,12638],[900,890,300,16.0,30.0,30,320.5,422074,13547],[1000,990,300,16.5,31.0,30,346.8,553846,14004]],
    HEB: [[100,100,100,6.0,10.0,12,26.0,449,167],[120,120,120,6.5,11.0,12,34.0,864,317],[140,140,140,7.0,12.0,12,43.0,1509,549],[160,160,160,8.0,13.0,15,54.3,2491,889],[180,180,180,8.5,14.0,15,65.3,3831,1362],[200,200,200,9.0,15.0,18,78.1,5696,2003],[220,220,220,9.5,16.0,18,91.0,8090,2843],[240,240,240,10.0,17.0,21,106.0,11259,3922],[260,260,260,10.0,17.5,24,118.4,14919,5134],[280,280,280,10.5,18.0,24,131.4,19270,6594],[300,300,300,11.0,19.0,27,149.1,25165,8562],[320,320,300,11.5,20.5,27,161.3,30823,9238],[340,340,300,12.0,21.5,27,170.9,36656,9689],[360,360,300,12.5,22.5,27,180.6,43193,10141],[400,400,300,13.5,24.0,27,197.8,57680,10819],[450,450,300,14.0,26.0,27,218.0,79887,11721],[500,500,300,14.5,28.0,27,238.6,107175,12623],[550,550,300,15.0,29.0,27,254.1,136690,13076],[600,600,300,15.5,30.0,27,270.0,171041,13530],[650,650,300,16.0,31.0,27,286.3,210616,13983],[700,700,300,17.0,32.0,27,306.4,256888,14440],[800,800,300,17.5,33.0,30,334.2,359083,14903],[900,900,300,18.5,35.0,30,371.3,494064,15815],[1000,1000,300,19.0,36.0,30,400.0,644748,16275]],
    HEM: [[100,120,106,12.0,20.0,12,53.2,1142,399],[120,140,126,12.5,21.0,12,66.4,2017,702],[140,160,146,13.0,22.0,12,80.6,3291,1144],[160,180,166,14.0,23.0,15,97.1,5098,1758],[180,200,186,14.5,24.0,15,113.3,7483,2580],[200,220,206,15.0,25.0,18,131.3,10641,3651],[220,240,226,15.5,26.0,18,149.4,14604,5012],[240,270,248,18.0,32.0,21,199.6,24289,8152],[260,290,268,18.0,32.5,24,219.6,31306,10448],[280,310,288,18.5,33.0,24,240.2,39547,13162],[300,340,310,21.0,39.0,27,303.1,59200,19403],[320,359,309,21.0,40.0,27,312.0,68134,19709],[340,377,309,21.0,40.0,27,315.8,76371,19710],[360,395,308,21.0,40.0,27,318.8,84866,19521],[400,432,307,21.0,40.0,27,325.8,104119,19335],[450,478,307,21.0,40.0,27,335.4,131484,19339],[500,524,306,21.0,40.0,27,344.3,161928,19154],[550,572,306,21.0,40.0,27,354.4,197983,19158],[600,620,305,21.0,40.0,27,363.7,237447,18975],[650,668,305,21.0,40.0,27,373.7,281667,18979],[700,716,304,21.0,40.0,27,383.0,329277,18797],[800,814,303,21.0,40.0,30,404.3,442597,18627],[900,910,302,21.0,40.0,30,423.6,570434,18451],[1000,1008,302,21.0,40.0,30,444.2,722299,18459]],
  };

  /* Caractéristiques géométriques d'un profilé en I laminé symétrique (dimensions en mm) :
   * aire et inertie avec les 4 congés (quart de carré moins quart de cercle, aire (1−π/4) r², centre à
   * e = r (10−3π)/(3(4−π)) de la face de l'aile, inertie propre (1/3 − π/16) r⁴ − aire·e²). */
  function geomI(h, b, tw, tf, r) {
    const Af = (1 - Math.PI / 4) * r * r, e = r * (10 - 3 * Math.PI) / (3 * (4 - Math.PI));
    const Io = (1 / 3 - Math.PI / 16) * Math.pow(r, 4) - Af * e * e, d = h / 2 - tf - e;
    const A = 2 * b * tf + (h - 2 * tf) * tw + 4 * Af;
    const Iy = (b * h ** 3 - (b - tw) * (h - 2 * tf) ** 3) / 12 + 4 * (Io + Af * d * d);
    const Wpl = b * tf * (h - tf) + tw * (h - 2 * tf) ** 2 / 4 + 4 * Af * d;
    return { A, Iy, Wpl };
  }

  const profiles = (function () {
    const list = [];
    for (const serie of Object.keys(SERIES)) {
      for (const [t, h, b, tw, tf, r, A, Iy, Iz] of SERIES[serie]) {
        const g = geomI(h, b, tw, tf, r);
        list.push({ nom: serie + ' ' + t, serie, taille: t, h, b, tw, tf, r, A, Iy, Iz,
          Wel: +(2 * Iy / h * 10).toFixed(1), Wpl: +(g.Wpl / 1000).toFixed(1),
          Acalc: g.A / 100, Iycalc: g.Iy / 1e4 });
      }
    }
    const norm = (s) => String(s || '').toUpperCase().replace(/[\s_]+/g, ' ').trim();
    /** Recherche par nom : « HEA 320 », « HE 320 A », « HE_320_A », « HEB500 »… */
    function get(nom) {
      let s = norm(nom).replace(/^HE\s*(\d+)\s*(AA|A|B|M)$/, 'HE$2 $1').replace(/^HE(AA|A|B|M)\s*(\d+)$/, 'HE$1 $2');
      return list.find((p) => p.nom === s) || null;
    }
    /** Profilé en unités SI (m, m², m⁴) pour les autres modules (TABLIER RAIL, RODBAN-ROPEN). */
    function si(nom) {
      const p = typeof nom === 'string' ? get(nom) : nom;
      if (!p) return null;
      return { nom: p.nom, h: p.h / 1e3, b: p.b / 1e3, tw: p.tw / 1e3, tf: p.tf / 1e3, r: p.r / 1e3,
        A: p.A / 1e4, Iy: p.Iy / 1e8, Iz: p.Iz / 1e8, Wel: p.Wel / 1e6, Wpl: p.Wpl / 1e6, masse: p.A * 0.785 };
    }
    return { series: Object.keys(SERIES), list, get, si, geomI,
      tailles: (serie) => list.filter((p) => p.serie === serie).map((p) => p.taille),
      unites: 'h, b, tw, tf, r en mm ; A en cm² ; Iy, Iz en cm⁴ ; Wel, Wpl en cm³' };
  })();

  /* ───────────────────────── Matériaux ───────────────────────── */
  // EN 1993-1-1 tableau 3.1 (EN 10025-2/-4) : fy pour t ≤ 40 mm / 40 < t ≤ 80 mm
  const NUANCES = { S235: [235, 215], S275: [275, 255], S355: [355, 335], S420: [420, 390], S460: [460, 430] };
  function fyNuance(nuance, tmax_mm) {
    const v = NUANCES[nuance] || NUANCES.S355;
    return tmax_mm <= 40 ? v[0] : v[1];
  }
  // EN 1992-1-1 tableau 3.1
  const Ecm = (fck) => 22000 * Math.pow((fck + 8) / 10, 0.3);
  const Ea = 210000; // EN 1993-1-1 §3.2.6

  /* ───────────────────────── Géométrie de l'acier de construction ─────────────────────────
   * Profil en I éventuellement dissymétrique (PRS) : aile sup. bs × tfs, aile inf. bi × tfi, âme tw, congés r.
   * w(y) = largeur d'acier à la hauteur y (une poutrelle). */
  function shape(p) {
    const { h, bs, tfs, bi, tfi, tw } = p, r = p.r || 0;
    const w = (y) => {
      if (y < 0 || y > h) return 0;
      if (y <= tfi) return bi;
      if (y >= h - tfs) return bs;
      let x = tw;
      if (r > 0) {
        const d1 = y - tfi, d2 = h - tfs - y;
        if (d1 < r) x += 2 * (r - Math.sqrt(Math.max(0, r * r - (r - d1) * (r - d1))));
        if (d2 < r) x += 2 * (r - Math.sqrt(Math.max(0, r * r - (r - d2) * (r - d2))));
      }
      return x;
    };
    const br = [0, tfi, h - tfs, h];
    if (r > 0) br.push(tfi + r, h - tfs - r);
    br.sort((a, b) => a - b);
    return { w, br, h };
  }
  // Gauss-Legendre 6 points
  const GX = [-0.9324695142, -0.6612093865, -0.2386191861, 0.2386191861, 0.6612093865, 0.9324695142];
  const GW = [0.1713244924, 0.3607615730, 0.4679139346, 0.4679139346, 0.3607615730, 0.1713244924];
  /** Moments de l'aire d'acier d'UNE poutrelle entre y=a et y=b : [A, S=∫y dA, J=∫y² dA]. */
  function mom(sh, a, b) {
    a = Math.max(a, 0); b = Math.min(b, sh.h);
    if (b <= a) return [0, 0, 0];
    const pts = [a, ...sh.br.filter((x) => x > a && x < b), b];
    let A = 0, S = 0, J = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const n = 24, d = (pts[k + 1] - pts[k]) / n; // subdivision : congés (dérivée infinie aux extrémités)
      for (let s = 0; s < n; s++) {
        const c = pts[k] + (s + 0.5) * d;
        for (let g = 0; g < 6; g++) {
          const y = c + GX[g] * d / 2, wy = sh.w(y) * GW[g] * d / 2;
          A += wy; S += wy * y; J += wy * y * y;
        }
      }
    }
    return [A, S, J];
  }

  /* ───────────────────────── Normalisation des données ───────────────────────── */
  function prepare(inp) {
    const d = Object.assign({
      N: 1, B: 0.7, csup: 0.1, typeSous: 'apparente', ecof: 0.02, cinf: 0.05,
      nappes: [], fck: 35, fyk: 500, nuance: 'S355', fy: 0, gammaA: 1.0, gammaC: 1.5, gammaS: 1.15,
      congesELU: true, deduire: false, nMode: 'ec4', phi: 2, psiL: 1.1, nCourt: 6, nLong: 18,
    }, inp);
    const P = d.profil || { mode: 'cat', nom: 'HEB 500' };
    let pr, Acat = null, Icat = null, nomProf;
    if (P.mode !== 'saisi') {
      const c = profiles.get(P.nom);
      if (!c) throw new Error('Profilé inconnu : ' + P.nom);
      nomProf = c.nom;
      pr = { h: c.h / 1e3, bs: c.b / 1e3, tfs: c.tf / 1e3, bi: c.b / 1e3, tfi: c.tf / 1e3, tw: c.tw / 1e3, r: c.r / 1e3 };
      Acat = c.A / 1e4; Icat = c.Iy / 1e8;
    } else {
      // dimensions saisies en m ; aile inférieure différente possible (PRS)
      pr = { h: +P.h, bs: +P.b, tfs: +P.tf, bi: +(P.bi || P.b), tfi: +(P.tfi || P.tf), tw: +P.tw, r: +(P.r || 0) };
      nomProf = P.nom || 'Profilé saisi';
    }
    if (!(pr.h > 0 && pr.bs > 0 && pr.tw > 0 && pr.tfs > 0 && pr.tfi > 0 && pr.tfs + pr.tfi < pr.h)) throw new Error('Dimensions du profilé incohérentes.');
    const sh = shape(pr);
    const m = mom(sh, 0, pr.h);
    const Ap = Acat || m[0], yp = m[1] / m[0];
    const Ip = Icat || (m[2] - m[0] * yp * yp);
    const H = pr.h + d.csup;                                  // dessus de la dalle
    const zb = d.typeSous === 'apparente' ? pr.tfi + d.ecof : -d.cinf; // sous-face du béton
    const nap = (d.nappes || []).filter((n) => n && +n.As > 0).map((n) => ({
      pos: n.pos === 'sup' ? 'sup' : 'inf', As: +n.As / 1e4, d: +n.d,
      y: n.pos === 'sup' ? H - +n.d : zb + +n.d, nom: n.nom || '' }));
    const tmax = Math.max(pr.tfs, pr.tfi) * 1e3;
    const fy = d.fy > 0 ? d.fy : fyNuance(d.nuance, tmax);
    const E = Ecm(d.fck), n0 = Ea / E;
    let nC, nL;
    if (d.nMode === 'ec4') { nC = n0; nL = n0 * (1 + d.psiL * d.phi); } // EN 1994-2 §5.4.2.2(2)
    else { nC = +d.nCourt; nL = +d.nLong; }
    if (!(H > zb) || !(d.B > 0) || !(d.N >= 1)) throw new Error('Géométrie du tablier incohérente.');
    return { d, pr, sh, Ap, yp, Ip, H, zb, nap, fy, Ecm: E, n0, nC, nL, nomProf, N: Math.round(d.N), B: +d.B };
  }

  /* ───────────────────────── ELS : section homogénéisée ─────────────────────────
   * sens = +1 (travée, moment positif, fibre supérieure comprimée) ; −1 (appui, fibre inférieure comprimée).
   * fissure = true : béton tendu négligé (EN 1994-2 §5.4.2.3 / §6.2.1.5 : section « fissurée »). */
  function els(S, n, fissure, sens) {
    const { pr, sh, Ap, yp, Ip, H, zb, nap, N, B, d } = S;
    // béton compris entre c0 et c1, avec déduction éventuelle des vides (acier et armatures)
    const parts = (yn) => {
      let c0 = zb, c1 = H;
      if (fissure) { if (sens > 0) c0 = Math.max(zb, Math.min(H, yn)); else c1 = Math.min(H, Math.max(zb, yn)); }
      const L = [{ A: N * Ap, y: yp, I: N * Ip }];
      for (const a of nap) L.push({ A: a.As, y: a.y, I: 0 });
      if (c1 > c0) {
        const hc = c1 - c0;
        L.push({ A: B * hc / n, y: (c0 + c1) / 2, I: B * hc ** 3 / 12 / n });
        if (d.deduire) {
          const [a, s, j] = mom(sh, c0, c1);
          if (a > 0) { const yg = s / a; L.push({ A: -N * a / n, y: yg, I: -N * (j - a * yg * yg) / n }); }
          for (const a2 of nap) if (a2.y >= c0 && a2.y <= c1) L.push({ A: -a2.As / n, y: a2.y, I: 0 });
        }
      }
      return { L, c0, c1 };
    };
    const centroid = (L) => { let A = 0, Sy = 0; for (const p of L) { A += p.A; Sy += p.A * p.y; } return { A, yG: Sy / A }; };
    let yG, L, c0, c1;
    if (!fissure) { ({ L, c0, c1 } = parts(0)); yG = centroid(L).yG; }
    else {
      // axe neutre : moment statique nul de la section homogénéisée réduite à sa partie comprimée de béton
      const f = (yn) => parts(yn).L.reduce((s, p) => s + p.A * (p.y - yn), 0);
      let lo = Math.min(0, zb), hi = H;
      for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
      yG = (lo + hi) / 2; ({ L, c0, c1 } = parts(yG));
    }
    const A = L.reduce((s, p) => s + p.A, 0);
    const I = L.reduce((s, p) => s + p.I + p.A * (p.y - yG) ** 2, 0);
    const fib = (y, beton) => { const v = Math.abs(y - yG); return { y, v, W: v > 1e-12 ? (beton ? n : 1) * I / v : Infinity }; };
    // un béton tendu négligé n'a pas de module de flexion
    const betTendu = (y) => fissure && (sens > 0 ? y < yG - 1e-9 : y > yG + 1e-9);
    return {
      n, fissure, sens, A, yG, I, Ib: n * I,
      Ipm: I / B, Ipp: I / N,
      betonSup: betTendu(H) ? null : fib(H, true),
      betonInf: betTendu(zb) ? null : fib(zb, true),
      acierSup: fib(pr.h, false), acierInf: fib(0, false),
      armatures: nap.map((a) => Object.assign({ pos: a.pos, As: a.As }, fib(a.y, false))),
      zoneBeton: [c0, c1],
    };
  }
  function poutrellesSeules(S) {
    const { Ap, yp, Ip, N, pr, B } = S, I = N * Ip;
    return { A: N * Ap, yG: yp, I, Ipm: I / B, Ipp: Ip,
      acierSup: { y: pr.h, v: pr.h - yp, W: I / (pr.h - yp) }, acierInf: { y: 0, v: yp, W: I / yp } };
  }

  /* ───────────────────────── ELU : moment résistant plastique (EN 1994-2 §6.2.1.2) ─────────────────────────
   * (a) acier de construction plastifié à fyd = fy/γa (traction et compression) ;
   * (b) armatures à fsd = fyk/γs (tendues et comprimées) ;
   * (d) béton comprimé à 0,85 fcd sur toute la hauteur comprimée, béton tendu négligé ;
   * la hauteur de béton occupée par l'acier comprimé est déduite (aire nette).
   * Nuances S420/S460 : réduction β de §6.2.1.2(2) si xpl/h > 0,15. */
  function elu(S, sens, conges) {
    const { pr, H, zb, nap, N, B, d } = S;
    const sh = conges ? S.sh : shape(Object.assign({}, pr, { r: 0 }));
    const fcd = d.fck / d.gammaC, sc = 0.85 * fcd, fyd = S.fy / d.gammaA, fsd = d.fyk / d.gammaS;
    const ybot = Math.min(0, zb), Atot = mom(sh, 0, pr.h)[0];
    const zone = (yn) => sens > 0 ? [Math.max(yn, zb), H] : [zb, Math.min(yn, H)]; // béton comprimé
    const steelComp = (yn) => sens > 0 ? mom(sh, yn, pr.h) : mom(sh, 0, yn);
    const F = (yn) => {
      const [c0, c1] = zone(yn);
      let Fc = c1 > c0 ? B * (c1 - c0) * sc - N * mom(sh, c0, c1)[0] * sc : 0;
      const Ac = steelComp(yn)[0];
      let Fs = N * fyd * (2 * Ac - Atot);
      for (const a of nap) {
        const comp = sens > 0 ? a.y > yn : a.y < yn;
        Fs += (comp ? 1 : -1) * a.As * fsd;
        if (comp && a.y >= c0 && a.y <= c1) Fc -= a.As * sc;
      }
      return Fc + Fs; // compression − traction (MPa·m² = MN)
    };
    let lo = ybot, hi = H;
    // F croît quand la zone comprimée grandit
    const g = (yn) => sens > 0 ? -F(yn) : F(yn);
    for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; }
    const yn = (lo + hi) / 2;
    // moment par rapport à l'axe neutre plastique (MN·m)
    const [c0, c1] = zone(yn);
    let M = 0, Fcb = 0;
    if (c1 > c0) {
      const lev = (c0 + c1) / 2 - yn, [a, s] = mom(sh, c0, c1);
      Fcb = B * (c1 - c0) * sc - N * a * sc;
      M += Math.abs(B * (c1 - c0) * sc * lev - N * sc * (s - a * yn));
    }
    const mt = mom(sh, 0, pr.h), mb = mom(sh, 0, yn);
    // ∫ fyd |y − yn| dA = fyd [ (S_haut − yn A_haut) + (yn A_bas − S_bas) ]
    M += N * fyd * ((mt[1] - mb[1]) - yn * (mt[0] - mb[0]) + yn * mb[0] - mb[1]);
    for (const a of nap) {
      const comp = sens > 0 ? a.y > yn : a.y < yn;
      M += a.As * fsd * Math.abs(a.y - yn);
      if (comp && a.y >= c0 && a.y <= c1) M -= a.As * sc * Math.abs(a.y - yn);
    }
    const ht = H - ybot, xpl = sens > 0 ? H - yn : yn - ybot;
    let beta = 1, betaKO = false;
    if (S.fy >= 420 - 1e-9) {
      const r = xpl / ht;
      if (r > 0.15) beta = 1 - 0.15 * Math.min(1, (r - 0.15) / 0.25);
      if (r > 0.4) betaKO = true;
    }
    return { sens, yn, xpl, xplRel: xpl / ht, M: M * 1000 * beta, Mbrut: M * 1000, beta, betaKO,
      fcd, sc, fyd, fsd, Fc: Fcb * 1000, conges, Mpm: M * 1000 * beta / B, Mpp: M * 1000 * beta / N };
  }

  /* ───────────────────────── Domaine d'application EN 1994-2 §6.3.1 (contrôles indicatifs) ───────────────────────── */
  function domaine(S) {
    const { pr, d, N, B } = S, h = pr.h, sw = B / N, b = Math.max(pr.bs, pr.bi), cst = d.csup;
    const L = [];
    L.push({ txt: 'Hauteur des poutrelles 0,21 m ≤ h ≤ 1,10 m', ok: h >= 0.21 - 1e-9 && h <= 1.1 + 1e-9, val: h });
    L.push({ txt: 'Entraxe des âmes sw ≤ 0,75 m', ok: sw <= 0.75 + 1e-9, val: sw });
    L.push({ txt: 'Enrobage supérieur 70 mm ≤ cst ≤ 150 mm', ok: cst >= 0.07 - 1e-9 && cst <= 0.15 + 1e-9, val: cst });
    L.push({ txt: 'Enrobage supérieur cst ≤ h/3', ok: cst <= h / 3 + 1e-9, val: h / 3 });
    if (N > 1) L.push({ txt: 'Distance libre entre ailes ≥ 0,15 m', ok: sw - b >= 0.15 - 1e-9, val: sw - b });
    L.push({ txt: 'Sous-face de l’aile inférieure non enrobée', ok: d.typeSous === 'apparente', val: null });
    return L;
  }

  /** Calcul complet. Retour : {S (données normalisées), seules, travee:{elu, cas[]}, appui:{elu, cas[]}, domaine, deform}. */
  function calcul(inp) {
    const S = prepare(inp);
    const conges = S.d.congesELU !== false;
    const run = (sens) => {
      const cas = [
        { id: 'ctnf', titre: 'Court terme, béton non fissuré', n: S.nC, fiss: false },
        { id: 'ltnf', titre: 'Long terme, béton non fissuré', n: S.nL, fiss: false },
        { id: 'ctf', titre: 'Court terme, béton fissuré', n: S.nC, fiss: true },
        { id: 'ltf', titre: 'Long terme, béton fissuré', n: S.nL, fiss: true },
      ].map((c) => Object.assign({ id: c.id, titre: c.titre }, els(S, c.n, c.fiss, sens)));
      const by = (id) => cas.find((c) => c.id === id);
      // inertie de déformation (I fissurée + I non fissurée)/2 — convention du guide « Ponts-routes à tablier en poutrelles enrobées » (1995) (flèches)
      const deform = { court: (by('ctf').I + by('ctnf').I) / 2, long: (by('ltf').I + by('ltnf').I) / 2 };
      // même moyenne sans les armatures passives (convention de la table « inertie de déformation » du programme de référence)
      const S0 = Object.assign({}, S, { nap: [] });
      deform.courtSansAs = (els(S0, S.nC, true, sens).I + els(S0, S.nC, false, sens).I) / 2;
      deform.longSansAs = (els(S0, S.nL, true, sens).I + els(S0, S.nL, false, sens).I) / 2;
      return { elu: elu(S, sens, conges), cas, deform };
    };
    return { S, seules: poutrellesSeules(S), travee: run(1), appui: run(-1), domaine: domaine(S) };
  }

  /* ───────────────────────── Lecture d'un fichier .don d'origine ───────────────────────── */
  function lireDon(txt) {
    const lines = String(txt).split(/\r?\n/);
    const kv = {}, rep = {};
    for (let i = 0; i < lines.length - 1; i++) {
      const m = lines[i].match(/^([a-z_]+)\s*(;|\t)/i);
      if (!m || lines[i].startsWith(';')) continue;
      const k = m[1].toLowerCase(), v = lines[i + 1].trim();
      rep[k] = (rep[k] || 0) + 1;
      if (!(k in kv)) kv[k] = v; else kv[k + rep[k]] = v;
    }
    const f = (k, def = 0) => { const x = parseFloat(String(kv[k] ?? '').replace(',', '.')); return Number.isFinite(x) ? x : def; };
    if (!/INERPE/i.test(kv.application || '') && !('eptab' in kv)) throw new Error('Ce fichier ne semble pas être un fichier de données .don de poutrelles enrobées.');
    const h = f('haupout'), tf = f('epaile');
    const appui = f('typesec') === 1;
    const nom = String(kv.typepout || '').trim();
    const cat = f('typedim') === 0 ? profiles.get(nom) : null;
    const profil = cat ? { mode: 'cat', nom: cat.nom } : {
      mode: 'saisi', nom: nom || 'PRS', h, b: f('laraile'), tf, tw: f('epame'), r: f('conge'),
      bi: f('laraileinf', f('laraile')), tfi: f('epaileinf', tf) };
    const As = f('acierloncomp');
    const nap = As > 0 ? [{ pos: appui ? 'sup' : 'inf', As, d: f('acierlonpos', f('enrob')) }] : [];
    const fyl = f('limelas');
    return {
      projet: kv.projet || '', section: appui ? 'appui' : 'travee',
      donnees: {
        profil, N: f('nbpout', 1), B: f('largtab'), csup: +(f('eptab') - h).toFixed(6), typeSous: 'apparente', ecof: f('epcof'),
        nappes: nap, fck: f('fcj', 25), fyk: f('fe', 500), nuance: ['S235', 'S275', 'S355', 'S420', 'S460'][f('nuance', 2)] || 'S355',
        fy: fyl > 0 ? fyl : 0, gammaA: 1.05, gammaC: 1.5, gammaS: 1.15, congesELU: false, deduire: false,
        nMode: 'saisi', nCourt: f('nctbael', 6), nLong: f('nltbael', 18), phi: 2, psiL: 1.1,
      },
    };
  }

  const api = { profiles, calcul, prepare, els, elu, lireDon, Ecm, fyNuance, NUANCES, Ea, mom, shape };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.enrobees = api; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
