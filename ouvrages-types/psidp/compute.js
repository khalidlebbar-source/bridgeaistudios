// PSIDP-EL — moteur de calcul (pont-dalle continu d'inertie constante en béton précontraint)
// Unités SETRA : m, t, grades, T/m2. Sans dépendance ; Node et navigateur.
(function (root) {
  'use strict';
  var PI = Math.PI;
  var gr = function (x) { return x * PI / 200; };

  // ---------------------------------------------------------------- algèbre
  function solve(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.slice().concat([b[i]]); });
    for (var i = 0; i < n; i++) {
      var p = i;
      for (var k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      var t = M[i]; M[i] = M[p]; M[p] = t;
      for (k = 0; k < n; k++) if (k !== i) {
        var f = M[k][i] / M[i][i];
        if (f) for (var j = i; j <= n; j++) M[k][j] -= f * M[i][j];
      }
    }
    return M.map(function (r, i) { return r[n] / r[i]; });
  }

  // ------------------------------------------------------- section brute
  // Nervure de largeur EDAL1 (intrados) + chanfreins (EDAL3/2 de chaque côté, hauteur HDAL3)
  // + encorbellements EDAL2/2 d'épaisseur HDAL2 à l'extrémité (HDAL1-HDAL3 à l'encastrement).
  function polyProps(P) {
    var A = 0, Sy = 0, Iy = 0;
    for (var i = 0; i < P.length; i++) {
      var a = P[i], b = P[(i + 1) % P.length];
      var c = a[0] * b[1] - b[0] * a[1];
      A += c; Sy += (a[1] + b[1]) * c; Iy += (a[1] * a[1] + a[1] * b[1] + b[1] * b[1]) * c;
    }
    A /= 2; Sy /= 6; Iy /= 12;
    var yg = Sy / A;
    return { A: A, yg: yg, I: Iy - A * yg * yg };
  }
  function sectionBrute(v) {
    var H1 = v.HDAL1, H2 = v.HDAL2, H3 = v.HDAL3, E1 = v.EDAL1, E2 = v.EDAL2, E3 = v.EDAL3;
    var a = E1 / 2, c = E2 / 2;
    var P = [[-a, 0], [a, 0], [a + E3 / 2, H3], [a + c, H1 - H2], [a + c, H1], [-a - c, H1], [-a - c, H1 - H2], [-a - E3 / 2, H3]];
    if (E2 <= 0) P = [[-a, 0], [a, 0], [a, H1], [-a, H1]];
    var p = polyProps(P);
    return { S: p.A, I: p.I, V: H1 - p.yg, VP: p.yg, H: H1, rendement: p.I / (p.A * (H1 - p.yg) * p.yg) };
  }

  // ------------------------------------------------- poutre continue (EI constant)
  // Moments sur appuis (convention : négatifs pour charge descendante) par équation des trois moments.
  function threeMoments(L, rhsFn) {
    var n = L.length, m = n - 1;
    if (m === 0) return [0, 0];
    var A = [], b = [];
    for (var k = 0; k < m; k++) {
      var row = new Array(m).fill(0);
      row[k] = 2 * (L[k] + L[k + 1]);
      if (k > 0) row[k - 1] = L[k];
      if (k < m - 1) row[k + 1] = L[k + 1];
      A.push(row); b.push(rhsFn(k));
    }
    return [0].concat(solve(A, b)).concat([0]);
  }
  // Force unité dans la travée j à l'abscisse relative x -> moments sur appuis
  function supportMomentsUnitForce(L, j, x) {
    return threeMoments(L, function (k) {
      // appui intérieur k+1 entre travées k et k+1
      var r = 0, l;
      if (k === j) { l = L[j]; r -= l * l * x * (1 - x * x); }           // force dans travée gauche (a=x l)
      if (k + 1 === j) { l = L[j]; r -= l * l * x * (1 - x) * (2 - x); } // force dans travée droite
      return r;
    });
  }
  function supportMomentsUniform(L, w) {
    return threeMoments(L, function (k) { return -(w[k] * Math.pow(L[k], 3) + w[k + 1] * Math.pow(L[k + 1], 3)) / 4; });
  }
  // Coefficients cubiques A,B,C des LI des moments sur appuis : M_i(x) = A x^3 + B x^2 + C x (x relatif)
  function liSupportCubics(L) {
    var n = L.length, res = [];
    // M sous force en x est cubique en x : on identifie à partir de 3 points
    for (var j = 0; j < n; j++) {
      var pts = [0.25, 0.5, 0.75].map(function (x) { return supportMomentsUnitForce(L, j, x); });
      res.push(pts);
    }
    var out = []; // out[i][j] = {A,B,C} moment sur appui i (1..n-1) force dans travée j
    for (var i = 1; i < n; i++) {
      var row = [];
      for (j = 0; j < n; j++) {
        var y = [res[j][0][i], res[j][1][i], res[j][2][i]];
        var xs = [0.25, 0.5, 0.75];
        var c = solve(xs.map(function (x) { return [x * x * x, x * x, x]; }), y);
        row.push({ A: c[0], B: c[1], C: c[2] });
      }
      out.push(row);
    }
    return out;
  }
  function partArea(c, a, b, l) { var F = function (x) { return c.A * Math.pow(x, 4) / 4 + c.B * Math.pow(x, 3) / 3 + c.C * x * x / 2 + (c.D || 0) * x; }; return l * (F(b) - F(a)); }
  function cubicArea(c, l) { return l * (c.A / 4 + c.B / 3 + c.C / 2 + (c.D || 0)); }

  // ------------------------------------------- plaque de Guyon-Massonnet (1 harmonique)
  // Bande de largeur 2b, bords libres, appuis simples à la portée L : coefficient K(y, e)
  // = flèche relative en y sous charge linéique sinusoïdale en e / flèche moyenne.
  function basis(y, k) {
    var c = Math.cosh(k * y), s = Math.sinh(k * y);
    return [[c, k * s, k * k * c, k * k * k * s],
      [s, k * c, k * k * s, k * k * k * c],
      [y * c, c + k * y * s, 2 * k * s + k * k * y * c, 3 * k * k * c + k * k * k * y * s],
      [y * s, s + k * y * c, 2 * k * c + k * k * y * s, 3 * k * k * s + k * k * k * y * c]];
  }
  function guyonK(y, e, b, L, nu) {
    var k = PI / L, A = [], r = [];
    var Bl = basis(-b, k), Br = basis(b, k), Be = basis(e, k);
    var mom = function (B, j) { return B[j][2] - nu * k * k * B[j][0]; };
    var sh = function (B, j) { return B[j][3] - (2 - nu) * k * k * B[j][1]; };
    var z4 = [0, 0, 0, 0], idx = [0, 1, 2, 3];
    A.push(idx.map(function (j) { return mom(Bl, j); }).concat(z4)); r.push(0);
    A.push(idx.map(function (j) { return sh(Bl, j); }).concat(z4)); r.push(0);
    A.push(z4.concat(idx.map(function (j) { return mom(Br, j); }))); r.push(0);
    A.push(z4.concat(idx.map(function (j) { return sh(Br, j); }))); r.push(0);
    for (var d = 0; d < 4; d++) { A.push(idx.map(function (j) { return Be[j][d]; }).concat(idx.map(function (j) { return -Be[j][d]; }))); r.push(d === 3 ? -1 : 0); }
    var x = solve(A, r);
    var By = basis(y, k), left = y < e, w = 0;
    for (var j = 0; j < 4; j++) w += (left ? x[j] : x[4 + j]) * By[j][0];
    return w * 2 * b * Math.pow(k, 4);
  }
  // LI de K pour la fibre y, charge en e quelconque (hors dalle : réciprocité, prolongement analytique)
  function makeKline(y, b, L, nu, half) {
    var exact = function (e) { return (e < -b || e > b) ? guyonK(e, y, b, L, nu) : guyonK(y, e, b, L, nu); };
    var h = 0.005, x0 = -(half || b) - 1.5, N = Math.ceil(2 * ((half || b) + 1.5) / h), tab = [];
    for (var i = 0; i <= N; i++) tab.push(exact(x0 + i * h));
    var f = function (e) { var u = (e - x0) / h, i = Math.floor(u); if (i < 0 || i >= N) return exact(e); var t = u - i; return tab[i] * (1 - t) + tab[i + 1] * t; };
    f.exact = exact;
    return f;
  }

  // ---------------------------------------------------------------- Fascicule 61 titre II
  function classePont(Lr) { return Lr >= 7 ? 1 : (Lr > 5.5 ? 2 : 3); }
  function nbVoies(Lc) { return Math.floor(Lc / 3 + 1e-9); }
  var A1TAB = { 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] };
  function a1coef(cl, n) { var t = A1TAB[cl]; return t[Math.min(n, t.length) - 1]; }
  var V0 = { 1: 3.5, 2: 3.0, 3: 2.75 };
  var BC = { 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1, 1], 3: [1, 0.8] };
  var BT = { 1: [1, 1], 2: [0.9, 0.9] };

  // ---------------------------------------------------------------- calcul principal
  function compute(model) {
    var v = model.values, n = v.NT;
    var L = [], ND = [];
    for (var i = 1; i <= n; i++) { L.push(v['D' + i]); ND.push(v['ND' + i]); }
    var R = { n: n, L: L, ND: ND };

    // Géométrie
    var sec = sectionBrute(v);
    R.section = { S: v.S || sec.S, I: v.I || sec.I, V: v.V || sec.V, VP: v.VP || sec.VP, calc: sec };
    var S = R.section.S, I = R.section.I, Vs = R.section.V, Vi = R.section.VP;
    R.section.rendement = I / (S * Vs * Vi);
    R.Be = 12 * I / Math.pow(v.HDAL1, 3);
    var largeurTot = v.ETROG + v.EGAU + v.ESURCH + v.EDROI + v.ETROD;
    R.largeurTot = largeurTot;
    // Portée équivalente : travée seule chargée uniformément ; flèche équivalente
    R.Leq = L.map(function (l, j) {
      var w = L.map(function (_, k) { return k === j ? 1 : 0; });
      var M = supportMomentsUniform(L, w);
      var m = (M[j] + M[j + 1]) / (l * l);
      return l * Math.pow(1 + 4.8 * m, 0.25);
    });
    // Biais mécanique approché (guide CHAMOA, §biais mécanique)
    R.biaisMeca = L.map(function (l) {
      var eta = R.Be / (l * Math.sin(gr(v.BIAIS)));
      if (eta >= 2) return 100;
      return v.BIAIS + (100 - v.BIAIS) * Math.pow(1 - eta / 2, 2);
    });
    R.minorationBiais = R.biaisMeca.map(function (p) { return Math.pow(Math.sin(gr(p)), 2); });

    // Matériaux
    var E = function (f) { return 236980.02 * Math.pow(f, 0.33333); };
    R.EI = E(v.FCJ); R.EI28 = E(v.FC28); R.EF = R.EI28 / 2; R.EV28 = R.EI28 / 3;
    R.retrait = (v.EPSI0 || 4) / 10000;
    R.Sgaine = PI * v.DGAIN * v.DGAIN / 4;

    // BPEL : contraintes limites (T/m2 ; 1 MPa = 100/9.81 T/m2)

    var c0 = 0.6 * 1000 / 9.80665, ftj = c0 + 0.06 * v.FCJ, ft28 = c0 + 0.06 * v.FC28;
    R.limites = {
      compInit: 0.6 * v.FCJ, comp: 0.6 * v.FC28,
      trEnrInit: -0.7 * ftj, trEnrQC: -ft28, trHorsInit: -1.5 * ftj, trHors: -3 * ft28, trHorsQC: -1.5 * ft28,
      aciers: 25000
    };

    // Charges permanentes
    var ossM = S * v.MASVO;
    var qsupM = (v.QSUPX + v.QSUPN) / 2;
    R.cp = {
      oss: [ossM, ossM * v.OSSAX, ossM * v.OSSAN],
      sup: [qsupM, v.QSUPX, v.QSUPN]
    };
    R.cp.tot = [0, 1, 2].map(function (k) { return R.cp.oss[k] + R.cp.sup[k]; });

    // Charges d'exploitation : classe, voies
    var Lr = v.ESURCH + v.EGAU + v.EDROI, Lc = v.ESURCH;
    R.Lc = Lc; R.Lr = Lr;
    R.classe = Math.floor((v.STA || 0) / 100) || classePont(Lr);
    R.nv = v.NV || nbVoies(Lc);
    // charges présentes : A (code A), B (code B), CE = i j k (centaines : généralisées, dizaines : D/E, unités : militaires)
    var ce = v.CE || 0;
    R.loads = { A: (v.A || 0) % 10 === 1 || Math.floor((v.A || 0) / 100) === 1, Agen: Math.floor((v.A || 0) / 100) === 1, B: (v.B || 0) % 10 === 1,
      trot: (v.ETROG + v.ETROD) > 0 && (v.B || 0) % 10 === 1, CE: Math.floor(ce / 10) % 10 > 0, MC120: ce % 10 === 4 || ce % 10 === 2, MC80: ce % 10 === 1 || ce % 10 === 3 };
    R.largeurVoie = Lc / R.nv;
    R.v0 = V0[R.classe];

    // Lignes d'influence
    R.liAppuis = liSupportCubics(L);
    R.liAppuisAires = R.liAppuis.map(function (row) {
      var a = row.map(function (cc, j) { return cubicArea(cc, L[j]); });
      return { parTravee: a, total: a.reduce(function (s, x) { return s + x; }, 0) };
    });
    // Foyers
    R.foyers = fociCompute(L);
    // LI moments en travée : sections 0.05,0.1..0.9,0.95
    R.sectionsMom = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
    R.liTravees = L.map(function (l, t) { return liSpanSection(L, R.liAppuis, t); });
    // LI efforts tranchants (côté gauche de chaque travée = pente) et réactions
    R.X0 = [0]; L.forEach(function (l) { R.X0.push(R.X0[R.X0.length - 1] + l); });
    R.liTraveesAires = R.liTravees.map(function (secs, t) { return secs.map(function (s) {
      var a = []; for (var j = 0; j < n; j++) {
        if (j < t) a.push(cubicArea(s.cols[j], L[j]));
        else if (j === t) a.push(partArea(s.cols[t], 0, s.x0, L[t]) + partArea(s.cols[t + 1], s.x0, 1, L[t]));
        else a.push(cubicArea(s.cols[j + 1], L[j]));
      }
      return { x0: s.x0, abs: s.abs, parTravee: a, total: a.reduce(function (p, q) { return p + q; }, 0) }; }); });
    R.zeros = R.liTravees.map(function (secs, t) { var out = []; secs.forEach(function (s) {
      var l = L[t], ev = function (x) { var c = x <= s.x0 ? s.cols[t] : s.cols[t + 1]; return c.A * x * x * x + c.B * x * x + c.C * x + (c.D || 0); };
      var roots = [], N = 400, prev = ev(1e-6);
      for (var i = 1; i <= N; i++) { var x = i / N - (i === N ? 1e-6 : 0), cur = ev(x);
        if (prev * cur < 0) { var a = (i - 1) / N, b = x; for (var k = 0; k < 60; k++) { var mm = (a + b) / 2; if (ev(a) * ev(mm) <= 0) b = mm; else a = mm; } roots.push((a + b) / 2); }
        prev = cur; }
      if (roots.length === 1) { var z = roots[0];
        var ag = z <= s.x0 ? partArea(s.cols[t], 0, z, l) : partArea(s.cols[t], 0, s.x0, l) + partArea(s.cols[t + 1], s.x0, z, l);
        var tot = partArea(s.cols[t], 0, s.x0, l) + partArea(s.cols[t + 1], s.x0, 1, l);
        out.push({ x0: s.x0, abs: s.abs, zero: z * l, ag: ag, ad: tot - ag, tot: tot }); } }); return out; });
    R.liEffTr = L.map(function (l, t) { return liShear(L, R.liAppuis, t); });
    R.liReac = liReactions(L, R.liAppuis);
    R.liReacAires = liReactionAreas(L, R.liAppuis, v.ABOUT);
    R.liEffTrAires = shearAreas(L, R.liAppuis);

    // Dénivellations d'appuis (1 cm) : moments et réactions, module EI28
    R.deniv = settlements(L, R.EI28 * I);

    // Répartition transversale (Guyon-Massonnet)
    R.transv = transverse(v, R);
    R.K = R.transv.map(function (T) { var o = {}; T.fibres.forEach(function (f) { for (var k in f.coef) { var x = f.coef[k]; var val = (x && typeof x === 'object') ? (x.val !== undefined ? x.val : x.deux) : x; if (o[k] === undefined || val > o[k]) o[k] = val; } }); return o; });
    // majoration dynamique (Fasc. 61 II) par travée
    var dlt = function (l, G, S) { return 1 + 0.4 / (1 + 0.2 * l) + 0.6 / (1 + 4 * G / S); };
    var bcc = BC[R.classe] ? BC[R.classe][Math.min(R.nv, BC[R.classe].length) - 1] : 1;
    R.dyn = { travee: L.map(function (l) { var G = R.cp.tot[0] * l, Sbc = bcLane(l) * R.nv * bcc;
      return { G: G, Sbc: Sbc, bc: dlt(l, G, Sbc), mc: dlt(l, G, 110), ce: 1 }; }) };
    R.dyn.appui = [];
    for (i = 0; i <= n; i++) {
      var a = R.dyn.travee[Math.max(0, i - 1)], b = R.dyn.travee[Math.min(n - 1, i)];
      var o = { bc: Math.max(a.bc, b.bc), mc: Math.max(a.mc, b.mc), ce: 1 };
      // appuis de rive : valeurs fixées forfaitairement (sécurité anti-soulèvement, notice PSIDP-EL)
      if (i === 0 || i === n) { var d0 = R.dyn.travee[i === 0 ? 0 : n - 1]; o = { bc: (d0.bc + 1.5) / 2, mc: (d0.mc + 1.2) / 2, ce: 1.1 }; }
      R.dyn.appui.push(o);
    }
    // tassements : probables (TP) et probables + aléatoires (combinaisons 0/DTP par appui), module EI28/YOUNG
    var EIt = R.EI28 * R.section.I / (v.YOUNG || 3);
    var tpv = [], dtv = [];
    for (i = 0; i <= n; i++) { tpv.push(v['TP' + (i + 1)] || 0); dtv.push(v['DTP' + (i + 1)] || 0); }
    var Mset = function (dl) { return threeMoments(L, function (k) { var ii = k + 1; return -6 * EIt * ((dl[ii] - dl[ii - 1]) / L[ii - 1] - (dl[ii + 1] - dl[ii]) / L[ii]); }).map(function (x) { return -x; }); };
    var Mtp = Mset(tpv), unit = [];
    for (var ia = 0; ia <= n; ia++) { var dl = tpv.map(function () { return 0; }); dl[ia] = dtv[ia]; unit.push(Mset(dl)); }
    // aléa : dénivellation différentielle de deux appuis -> somme des deux plus grands effets en valeur absolue
    R.tass = {
      TP: function (t, x) { return Mtp[t] * (1 - x) + Mtp[t + 1] * x; },
      TA: function (t, x) {
        var e = unit.map(function (M) { return Math.abs(M[t] * (1 - x) + M[t + 1] * x); }).sort(function (p, q) { return q - p; });
        var al = e[0] + (e[1] || 0), tp = Mtp[t] * (1 - x) + Mtp[t + 1] * x;
        return [tp - al, tp + al];
      }
    };
    R.deform = { oss: deflections(R, R.cp.oss[0], R.EI * R.section.I), cpi: deflections(R, R.cp.tot[0], R.EI * R.section.I), cpt: deflections(R, R.cp.tot[0], R.EV28 * R.section.I) };
    R.sol = liveLoads(R, v);
    R.prec = precontrainte(R, v, model);
    return R;
  }

  function bcLane(l) { var seq = [[0, 6], [4.5, 12], [6, 12], [10.5, 6], [15, 12], [16.5, 12]], best = 0;
    seq.forEach(function (st) { var s0 = -st[0]; var w = 0; seq.forEach(function (q) { var x = q[0] + s0; if (x >= -1e-9 && x <= l + 1e-9) w += q[1]; }); if (w > best) best = w; });
    return best; }
  function fociCompute(L) {
    var n = L.length, fg = [null], fd = [];
    // foyers de gauche : rapport phi
    var phi = [0];
    for (var i = 1; i < n; i++) {
      var p = 1 / (2 + (L[i - 1] / L[i]) * (2 - phi[i - 1]));
      phi.push(p);
      fg.push(L[i] * p / (1 + p));
    }
    var psi = new Array(n).fill(0);
    for (i = n - 2; i >= 0; i--) {
      psi[i] = 1 / (2 + (L[i + 1] / L[i]) * (2 - psi[i + 1]));
    }
    for (i = 0; i < n - 1; i++) fd.push(L[i] * (1 - psi[i] / (1 + psi[i])));
    fd.push(null);
    return { gauche: fg, droite: fd };
  }

  // LI moment en section x0 (relative) de la travée t : M = (1-x0) Mg + x0 Md + isostatique
  function liSpanSection(L, liA, t) {
    var n = L.length, l = L[t];
    var getSup = function (i, j) { if (i <= 0 || i >= n) return { A: 0, B: 0, C: 0 }; return liA[i - 1][j]; };
    return [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map(function (x0) {
      var cols = [];
      for (var j = 0; j < n; j++) {
        var g = getSup(t, j), d = getSup(t + 1, j);
        var cc = { A: (1 - x0) * g.A + x0 * d.A, B: (1 - x0) * g.B + x0 * d.B, C: (1 - x0) * g.C + x0 * d.C, D: 0 };
        if (j === t) {
          // force à gauche de la section (x<x0) : iso = x l (1-x0) ; à droite : x0 l (1-x)
          var G = { A: cc.A, B: cc.B, C: cc.C + l * (1 - x0), D: 0 };
          var Dd = { A: cc.A, B: cc.B, C: cc.C - l * x0, D: l * x0 };
          cols.push(G); cols.push(Dd);
        } else cols.push(cc);
      }
      return { x0: x0, abs: x0 * l, cols: cols };
    });
  }
  function liShear(L, liA, t) {
    var n = L.length, l = L[t];
    var getSup = function (i, j) { if (i <= 0 || i >= n) return { A: 0, B: 0, C: 0 }; return liA[i - 1][j]; };
    var cols = [];
    for (var j = 0; j < n; j++) {
      var g = getSup(t, j), d = getSup(t + 1, j);
      var cc = { A: (d.A - g.A) / l, B: (d.B - g.B) / l, C: (d.C - g.C) / l };
      if (j === t) cc.C -= 1;
      cols.push(cc);
    }
    return cols;
  }
  function liReactions(L, liA) {
    var n = L.length, res = [];
    var getSup = function (i, j) { if (i <= 0 || i >= n) return { A: 0, B: 0, C: 0 }; return liA[i - 1][j]; };
    for (var a = 0; a <= n; a++) {
      var cols = [];
      for (var j = 0; j < n; j++) {
        var cc = { A: 0, B: 0, C: 0, D: 0 };
        // R_a = V(droite de a, travée a) - V(gauche de a, travée a-1)
        if (a < n) { var g = getSup(a, j), d = getSup(a + 1, j), l = L[a];
          cc.A += (d.A - g.A) / l; cc.B += (d.B - g.B) / l; cc.C += (d.C - g.C) / l; if (j === a) { cc.C -= 1; cc.D += 1; } }
        if (a > 0) { var g2 = getSup(a - 1, j), d2 = getSup(a, j), l2 = L[a - 1];
          cc.A -= (d2.A - g2.A) / l2; cc.B -= (d2.B - g2.B) / l2; cc.C -= (d2.C - g2.C) / l2; if (j === a - 1) { cc.C += 1; } }
        cols.push(cc);
      }
      res.push(cols);
    }
    return res;
  }
  function liReactionAreas(L, liA, about) {
    var n = L.length, R = liReactions(L, liA);
    return R.map(function (cols, a) {
      var ar = cols.map(function (cc, j) { return cubicArea(cc, L[j]); });
      // about : prolongement en console (pente de la LI de réaction au bord)
      var ab = 0;
      if (a === 0) { var c0 = cols[0]; var slope = -(c0.C) / L[0]; ab = about * (1 + slope * about / 2) ; ab = about + about * about / 2 * (-c0.C / L[0]); }
      if (a === n) { var cn = cols[n - 1]; var der = (3 * cn.A + 2 * cn.B + cn.C) / L[n - 1]; ab = about + about * about / 2 * der; }
      var tot = ar.reduce(function (s, x) { return s + x; }, 0) + ab;
      return { about: (a === 0 || a === n) ? ab : null, parTravee: ar, total: tot };
    });
  }
  function shearAreas(L, liA) {
    var n = L.length, res = [];
    var getSup = function (i, j) { if (i <= 0 || i >= n) return { A: 0, B: 0, C: 0 }; return liA[i - 1][j]; };
    for (var t = 0; t < n; t++) {
      var l = L[t], g = [], d = [];
      for (var j = 0; j < n; j++) {
        var a0 = getSup(t, j), a1 = getSup(t + 1, j);
        var cc = { A: (a1.A - a0.A) / l, B: (a1.B - a0.B) / l, C: (a1.C - a0.C) / l };
        var base = cubicArea(cc, L[j]);
        if (j === t) { g.push(base + l / 2); d.push(base - l / 2); } else { g.push(base); d.push(base); }
      }
      res.push({ gauche: { parTravee: g, total: g.reduce(function (s, x) { return s + x; }, 0) }, droite: { parTravee: d, total: d.reduce(function (s, x) { return s + x; }, 0) } });
    }
    return res;
  }
  function settlements(L, EIval) {
    var n = L.length, m = n - 1, Ms = [], Rs = [];
    for (var a = 0; a <= n; a++) {
      // déplacement unité 0.01 m vers le bas de l'appui a
      var delta = new Array(n + 1).fill(0); delta[a] = 0.01;
      var M = threeMoments(L, function (k) {
        var i = k + 1; // appui intérieur i
        var th1 = (delta[i] - delta[i - 1]) / L[i - 1], th2 = (delta[i + 1] - delta[i]) / L[i];
        return -6 * EIval * (th1 - th2);
      });
      Ms.push(M);
      var R = [];
      for (var s = 0; s <= n; s++) {
        var r = 0;
        if (s < n) r += (M[s + 1] - M[s]) / L[s];
        if (s > 0) r -= (M[s] - M[s - 1]) / L[s - 1];
        R.push(-r);
      }
      Rs.push(R);
    }
    return { M: Ms, R: Rs };
  }

  // Répartition transversale
  function transverse(v, R) {
    var b = R.Be / 2, nu = 0; // SETRA : coefficient de Poisson nul dans Guyon-Massonnet
    var W = R.largeurTot, half = W / 2;
    var res = [];
    var spans = [];
    for (var t = 0; t < R.n; t++) spans.push(t);
    spans.forEach(function (t) {
      var Le = R.Leq[t];
      var theta = b / Le;
      var fibres = [];
      // fibre de rive (bord de la dalle équivalente ou bord de chaussée), fibre bord chaussée, axe
      var yBordChaussee = -(v.ESURCH / 2);
      var yRive = -b;
      var list = [yRive, Math.max(yBordChaussee, -b), 0];
      list.forEach(function (y) {
        var kl = makeKline(y, b, Le, nu, half);
        var pts = [];
        var nstep = Math.floor(W / 0.125 + 1e-9) + 3;
        for (var i = 0; i < nstep; i++) pts.push(kl.exact(-half + i * 0.125));
        fibres.push({ y: y, li: pts, coef: chargeCoefs(kl, v, R, pts) });
      });
      res.push({ Le: Le, theta: theta, fibres: fibres });
    });
    return res;
  }

  // Coefficients K moyens par type de charge : les charges sont discrétisées sur la grille de la LI
  // (pas 0.125 m depuis le bord gauche du tablier), bornes tronquées à la grille, intégration trapèzes.
  function chargeCoefs(k, v, R, grid) {
    var W = R.largeurTot, half = W / 2, h = 0.125;
    var g = grid;
    var idx = function (x) { return Math.floor((x + half) / h + 1e-6); };
    var K = function (i) { return g[Math.max(0, Math.min(g.length - 1, i))]; };
    var trap = function (i0, i1) { if (i1 <= i0) return K(i0); var s = (K(i0) + K(i1)) / 2; for (var i = i0 + 1; i < i1; i++) s += K(i); return s / (i1 - i0); };
    var xg = -half + v.ETROG;
    var xc0 = xg + v.EGAU, xc1 = xc0 + v.ESURCH, xd = xc1 + v.EDROI;
    var out = {};
    if (v.ETROG > 0 || v.ETROD > 0) {
      var tg = v.ETROG > 0 ? trap(0, idx(xg)) : null, td = v.ETROD > 0 ? trap(idx(xd), idx(half)) : null;
      out.trot = { un: Math.max(tg || 0, td || 0), deux: (tg !== null && td !== null) ? (tg * v.ETROG + td * v.ETROD) / (v.ETROG + v.ETROD) : (tg || td) };
    }
    var V = R.largeurVoie, best = { val: -1e9, nv: 1 };
    var nst = Math.round(V / h);
    for (var nvc = 1; nvc <= R.nv; nvc++) {
      var a1 = R.loads.Agen ? (v['CDTA' + nvc] || 1) : a1coef(R.classe, nvc), m = -1e9, wst = Math.round(nvc * V / h);
      for (var i = idx(xc0); i + wst <= idx(xc1) + 1e-9; i++) m = Math.max(m, trap(i, i + wst));
      var val = a1 * m * nvc / R.nv;
      if (val > best.val) best = { val: val, nv: nvc };
    }
    out.A = best;
    var bestB = { val: -1e9, nv: 1 }, bcT = BC[R.classe] || [1];
    for (nvc = 1; nvc <= R.nv; nvc++) {
      var mm = -1e9;
      for (i = idx(xc0 + 0.25); -half + (i + 20 * (nvc - 1) + 16) * h <= xc1 - 0.25 + h - 1e-9; i++) {
        var s2 = 0; for (var f = 0; f < nvc; f++) s2 += K(i + 20 * f) + K(i + 20 * f + 16);
        mm = Math.max(mm, s2 / 2);
      }
      var vb = bcT[Math.min(nvc, bcT.length) - 1] * mm / R.nv;
      if (vb > bestB.val) bestB = { val: vb, nv: nvc };
    }
    out.BC = bestB;
    if (R.classe <= 2) {
      var bestT = { val: -1e9, nv: 1 }, btc = BT[R.classe][0];
      for (nvc = 1; nvc <= Math.min(2, R.nv); nvc++) {
        var m3 = -1e9;
        for (i = idx(xc0 + 0.5); -half + (i + 24 * (nvc - 1) + 16) * h <= xc1 - 0.5 + h - 1e-9; i++) {
          var s3 = 0; for (f = 0; f < nvc; f++) s3 += K(i + 24 * f) + K(i + 24 * f + 16);
          m3 = Math.max(m3, s3 / 2);
        }
        var vt = btc * m3 / R.nv;
        if (vt > bestT.val) bestT = { val: vt, nv: nvc };
      }
      out.BT = bestT;
    }
    var m4 = -1e9;
    for (i = idx(xc0); -half + (i + 34.4) * h <= xc1 + h - 1e-9; i++) m4 = Math.max(m4, (trap(i, i + 8) + trap(i + Math.round(3.3 / h), i + Math.round(4.3 / h))) / 2);
    out.MC120 = m4;
    var xm = Math.min(xc0 + 3.5, (xc0 + xc1) / 2);
    out.CE = (function () { var ss = 0, N = 330; for (var q = 0; q < N; q++) { var x = xm - 1.65 + 3.3 * (q + 0.5) / N, u = (x + half) / h, ii = Math.floor(u), tt = u - ii; ss += K(ii) * (1 - tt) + K(ii + 1) * tt; } return ss / N; })();
    return out;
  }


  // ------------------------------------------------------------- sollicitations longitudinales
  function sectionLI(R, t, x0) {
    var n = R.n, L = R.L, X0 = R.X0, liA = R.liAppuis;
    var sup = function (i, j, x) { if (i <= 0 || i >= n) return 0; var c = liA[i - 1][j]; return c.A * x * x * x + c.B * x * x + c.C * x; };
    return function (X) {
      if (X < 0 || X > X0[n]) return 0;
      var j = 0; while (j < n - 1 && X > X0[j + 1]) j++;
      var x = (X - X0[j]) / L[j];
      var v = (1 - x0) * sup(t, j, x) + x0 * sup(t + 1, j, x);
      if (j === t) v += x <= x0 ? L[t] * x * (1 - x0) : L[t] * x0 * (1 - x);
      return v;
    };
  }
  function spanOf(R, X) { if (X < 0) return 0; var j = 0; while (j < R.n - 1 && X > R.X0[j + 1]) j++; return j; }
  // morceaux de même signe de la LI dans chaque travée : [{j, a, b, area(signée, pondérée), len}]
  function pieces(R, f, wfun, range) {
    var out = [];
    if (range) [[range[0], 0, 0], [R.X0[R.n], range[1], R.n - 1]].forEach(function (z) {
      if (z[1] - z[0] < 1e-9) return; var A = z[0] + 1e-9, B = z[1] - 1e-9, M = 20, h = (B - A) / M, sm = 0;
      for (var k = 0; k <= M; k++) { var w = (k === 0 || k === M) ? 1 : (k % 2 ? 4 : 2); sm += w * f(A + k * h); }
      sm *= h / 3; out.push({ j: z[2], a: A, b: B, len: z[1] - z[0], area: sm * wfun(z[2]) });
    });
    for (var j = 0; j < R.n; j++) {
      var a0 = R.X0[j] + 1e-9, l = R.L[j] - 2e-9, N = 200, xs = [a0];
      var prev = f(a0 + 1e-7);
      for (var i = 1; i <= N; i++) {
        var X = a0 + l * i / N - (i === N ? 1e-7 : 0), cur = f(X);
        if (prev * cur < 0) { var lo = a0 + l * (i - 1) / N, hi = X; for (var k = 0; k < 50; k++) { var mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; } xs.push((lo + hi) / 2); }
        prev = cur;
      }
      xs.push(a0 + l);
      for (i = 0; i + 1 < xs.length; i++) {
        var A = xs[i], B = xs[i + 1], M = 40, h = (B - A) / M, sm = 0;
        for (k = 0; k <= M; k++) { var w = (k === 0 || k === M) ? 1 : (k % 2 ? 4 : 2); sm += w * f(A + k * h); }
        sm *= h / 3;
        if (Math.abs(B - A) > 1e-9) out.push({ j: j, a: A, b: B, len: B - A, area: sm * wfun(j) });
      }
    }
    return out;
  }
  // charge A généralisée : valeurs A(0..4) aux abscisses k*PAS, interpolation linéaire
  function Agen(v, l) { var P = v.PAS || 1, a = [v.A0, v.A1, v.A2, v.A3, v.A4]; var u = l / P, i = Math.floor(u); if (i >= 4) return a[4]; return a[i] + (a[i + 1] - a[i]) * (u - i); }
  function A_l(l) { return Math.max(0.23 + 36 / (l + 12), 0.4 - 0.0002 * l); }

  function searchGrid(R) {
    var n = R.n, L = R.L, X0 = R.X0, grid = [], k, j;
    var e0 = L[0] / 20, e1 = L[n - 1] / 20;
    for (k = -40; k < 0; k++) grid.push(k * e0);
    for (j = 0; j < n; j++) for (k = 0; k < 20; k++) grid.push(X0[j] + k * L[j] / 20);
    for (k = 0; k <= 40; k++) grid.push(X0[n] + k * e1);
    return grid;
  }
  // Effets extrêmes des charges d'exploitation pour une ligne d'influence f(X)
  // cfg.dyn(type, j) : coefficient de majoration ; cfg.minor : coefficient de biais appliqué
  function loadEffects(R, v, f, cfg) {
    var n = R.n, mn = cfg.minor ? R.minorationBiais : R.L.map(function () { return 1; }), K = R.K;
    var Ltot = R.X0[n], grid = R.grid, j, k;
    var XLO = cfg.range ? cfg.range[0] : 0, XHI = cfg.range ? cfg.range[1] : Ltot;
    var KK = cfg.noK ? function () { return 1; } : null;
    var largTrot = (v.ETROG || 0) + (v.ETROD || 0);
    var truckGD = [[0, 12], [1.5, 12], [6, 6]], truckDG = [[0, 6], [4.5, 12], [6, 12]], tandem = [[0, 16], [1.35, 16]];
    var S = {};
    if (R.loads.trot && largTrot > 0) {
      var pt = pieces(R, f, function (jj) { return v.TROT * largTrot * (KK ? 1 : (K[jj].trot || 1)) * mn[jj]; }, cfg.range);
      var pp = 0, pn = 0; pt.forEach(function (p) { if (p.area > 0) pp += p.area; else pn += p.area; });
      S.trot = [pp, pn];
    } else S.trot = [0, 0];
    S.A = [0, 0]; S.Alens = [[], []];
    if (R.loads.A) {
      var pa = pieces(R, f, function (jj) { return (KK ? 1 : (K[jj].A || 1)) * mn[jj]; }, cfg.range);
      [1, -1].forEach(function (sg, si) {
        var cand = pa.filter(function (p) { return p.area * sg > 1e-9; }), nc = Math.min(cand.length, 14);
        for (var mask = 1; mask < (1 << nc); mask++) {
          var ll = 0, aa = 0, lens = [];
          for (var c = 0; c < nc; c++) if (mask >> c & 1) { ll += cand[c].len; aa += cand[c].area; lens.push(cand[c].len); }
          var val = (R.loads.Agen ? Agen(v, ll) * v.LVOIE * R.nv * (v.CDTA1 || 1) : A_l(ll) * R.v0 * R.nv * (KK ? a1coef(R.classe, R.nv) : 1)) * aa;
          if (si === 0 ? val > S.A[0] : val < S.A[1]) { S.A[si] = val; S.Alens[si] = lens; }
        }
      });
    }
    var effAx = function (axles, s, coefK, type) {
      var a = 0;
      for (var ii = 0; ii < axles.length; ii++) { var X = s + axles[ii][0]; if (X < XLO || X > XHI) continue; var jj = (cfg.jfix && X === cfg.jfix[0]) ? cfg.jfix[1] : spanOf(R, X); a += axles[ii][1] * f(X) * coefK(jj) * cfg.dyn(type, jj, X) * mn[jj]; }
      return a;
    };
    var ext = {};
    var onDeck = function (p) { return p > -16 && p < Ltot; };
    var upd = function (key, v2, info) {
      var e = ext[key] || (ext[key] = [{ v: 0 }, { v: 0 }]);
      if (v2 > e[0].v + 1e-7 || v2 < e[1].v - 1e-7) { info.pos = info.pos.filter(function (p, k) { return k === 0 || onDeck(p); }); if (!onDeck(info.pos[0]) && info.pos.length > 1) info.pos.shift(); }
      if (v2 > e[0].v + 1e-7) e[0] = Object.assign({ v: v2 }, info); if (v2 < e[1].v - 1e-7) e[1] = Object.assign({ v: v2 }, info); };
    if (R.loads.B) {
      var kbc = function (jj) { return KK ? 1 : K[jj].BC; };
      [['GD', truckGD], ['DG', truckDG]].forEach(function (tr) {
        var one = grid.map(function (s) { return effAx(tr[1], s, kbc, 'bc'); });
        for (var i1 = 0; i1 < grid.length; i1++) {
          upd('BC', one[i1] * R.nv, { type: 'BC', sens: tr[0], pos: [grid[i1]] });
          for (var i2 = 0; i2 < grid.length; i2++) if (Math.abs(grid[i2] - grid[i1]) >= 10.5 - 1e-9) upd('BC', (one[i1] + one[i2]) * R.nv, { type: 'BC', sens: tr[0], pos: [grid[i1], grid[i2]] });
          [10.5].forEach(function (d) { upd('BC', (one[i1] + effAx(tr[1], grid[i1] + d, kbc, 'bc')) * R.nv, { type: 'BC', sens: tr[0], pos: [grid[i1], grid[i1] + d] }); });
        }
      });
      if (K[0].BT !== undefined) {
        var kbt = function (jj) { return KK ? 1 : K[jj].BT; };
        grid.forEach(function (s) { ['GD', 'DG'].forEach(function (sens) { upd('BT', effAx(tandem, s, kbt, 'bc') * R.nv, { type: 'BT', sens: sens, pos: [s] }); }); });
      }
    }
    var unif = function (s, P, len, coefK, type) {
      var lo = Math.max(XLO, s), hi = Math.min(XHI, s + len), a = 0;
      if (hi <= lo) return 0;
      var br = [lo]; if (0 > lo && 0 < hi) br.push(0); if (Ltot > lo && Ltot < hi) br.push(Ltot); for (var q2 = 1; q2 < n; q2++) if (R.X0[q2] > lo && R.X0[q2] < hi) br.push(R.X0[q2]);
      if (cfg.kink !== undefined && cfg.kink > lo && cfg.kink < hi) br.push(cfg.kink);
      br.sort(function (p1, p2) { return p1 - p2; }); br.push(hi);
      for (var bi = 0; bi + 1 < br.length; bi++) {
        var A0 = br[bi] + 1e-9, B0 = br[bi + 1] - 1e-9, N2 = 16, hh = (B0 - A0) / N2, sm = 0, jj = spanOf(R, (A0 + B0) / 2);
        var cst = coefK(jj) * cfg.dyn(type, jj, (A0 + B0) / 2) * mn[jj];
        for (var ii = 0; ii <= N2; ii++) { var w2 = (ii === 0 || ii === N2) ? 1 : (ii % 2 ? 4 : 2); sm += w2 * f(A0 + ii * hh); }
        a += sm * hh / 3 * cst;
      }
      return a * P / len;
    };
    var consider = function (key, P, len, minGap, maxGap, coefK, type) {
      var one2 = grid.map(function (s) { return unif(s, P, len, coefK, type); });
      for (var i1 = 0; i1 < grid.length; i1++) {
        upd(key, one2[i1], { type: key, pos: [grid[i1]] });
        for (var i2 = 0; i2 < grid.length; i2++) {
          var dg = Math.abs(grid[i2] - grid[i1]);
          if (dg < minGap - 1e-9 || dg > maxGap + 1e-9) continue;
          upd(key, one2[i1] + one2[i2], { type: key, pos: [grid[i1], grid[i2]] });
        }
      }
    };
    if (R.loads.CE) {
      var kce = function (jj) { return KK ? 1 : K[jj].CE; };
      consider('CVOI.D', 140, 11, 18.6, 19.4, kce, 'ce');
      consider('CVOI.E', 200, 15, 32.5, 33.5, kce, 'ce');
    }
    if (R.loads.MC120) consider('MC.120', 110, 6.1, 36.4, 1e9, function (jj) { return KK ? 1 : K[jj].MC120; }, 'mc');
    var pick = function (keys) { var r = [{ v: 0 }, { v: 0 }]; keys.forEach(function (kk) { var e = ext[kk]; if (!e) return; if (e[0].v > r[0].v) r[0] = e[0]; if (e[1].v < r[1].v) r[1] = e[1]; }); return r; };
    var Bx = pick(['BC', 'BT']), Cx = pick(['CVOI.D', 'CVOI.E', 'MC.120']);
    S.B = [Bx[0].v, Bx[1].v]; S.Bpos = Bx; S.C = [Cx[0].v, Cx[1].v]; S.Cpos = Cx; S.ext = ext;
    return S;
  }
  function combine(S, v, withTass) {
    var psi1 = v.PSI1;
    var c = function (si) {
      var cp = S.cp[si], tp = withTass ? S.tp[si] : 0, ta = withTass ? S.ta[si] : 0;
      var mx = si === 0 ? Math.max : Math.min;
      var QB = mx(1.2 * S.A[si], 1.2 * S.B[si], S.C[si]), Qf = mx(S.A[si], S.B[si]), Qu = mx(1.42 * S.A[si], 1.42 * S.B[si], 1.2 * S.C[si]);
      var gG = si === 0 ? (cp >= 0 ? 1.2 : 0.9) : (cp >= 0 ? 0.9 : 1.2);
      return { qlqc: cp + tp + QB + S.trot[si], qlqcta: cp + ta + QB + S.trot[si], freq: cp + tp + psi1 * (Qf + S.trot[si]), elu: 1.125 * (gG * cp + 1.2 * ta + Qu + 1.42 * S.trot[si]) };
    };
    return [c(0), c(1)];
  }
  function integ(R, f) { var area = 0; for (var j = 0; j < R.n; j++) { var M = 60, h = R.L[j] / M, sm = 0; for (var k = 0; k <= M; k++) { var w = (k === 0 || k === M) ? 1 : (k % 2 ? 4 : 2); sm += w * f(R.X0[j] + (k === 0 ? 1e-9 : k === M ? -1e-9 : 0) + k * h); } area += sm * h / 3; } return area; }
  function liveLoads(R, v) {
    var n = R.n, L = R.L, X0 = R.X0, dyn = R.dyn.travee;
    R.grid = searchGrid(R);
    var cfgT = { minor: true, dyn: function (type, j) { return type === 'ce' ? 1 : dyn[j][type]; } };
    var res = [];
    for (var t = 0; t < n; t++) {
      var secs = [];
      for (var q = 0; q <= 10; q++) {
        var x0 = q / 10, f = sectionLI(R, t, x0);
        var S = loadEffects(R, v, f, { minor: true, dyn: cfgT.dyn, kink: X0[t] + x0 * L[t] });
        S.x0 = x0; S.abs = X0[t] + x0 * L[t];
        var area = integ(R, f);
        S.oss = [R.cp.oss[1] * area, R.cp.oss[2] * area]; S.cp = [R.cp.tot[1] * area, R.cp.tot[2] * area];
        if (area < 0) { S.oss.reverse(); S.cp.reverse(); }
        S.tp = [Math.max(0, R.tass.TP(t, x0)), Math.min(0, R.tass.TP(t, x0))];
        var ta = R.tass.TA(t, x0); S.ta = [Math.max(0, ta[1]), Math.min(0, ta[0])];
        S.comb = combine(S, v, true);
        secs.push(S);
      }
      res.push(secs);
    }
    // efforts tranchants sur appuis (côté gauche / droit de chaque travée)
    R.shear = [];
    for (t = 0; t < n; t++) {
      var row = {};
      [['gauche', 1e-7], ['droite', 1 - 1e-7]].forEach(function (cd) {
        var xs = cd[1], tt = t;
        var fs = function (X) { var h = 1e-5 * L[tt]; var fa = sectionLI(R, tt, xs - 1e-5), fb = sectionLI(R, tt, xs + 1e-5); return (fb(X) - fa(X)) / (2e-5 * L[tt]); };
        // LI d'effort tranchant = dérivée de la LI de moment par rapport à la position de la section
        var gS = sectionShearLI(R, tt, cd[0] === 'gauche');
        var S2 = loadEffects(R, v, gS, { minor: false, dyn: cfgT.dyn, jfix: cd[0] === 'gauche' ? [X0[tt], tt] : null });
        var ar = integ(R, gS);
        S2.cp = [R.cp.tot[1] * ar, R.cp.tot[2] * ar]; if (ar < 0) S2.cp.reverse();
        S2.comb = combine(S2, v, false);
        row[cd[0]] = S2;
      });
      R.shear.push(row);
    }
    // réactions d'appui
    var dA = R.dyn.appui;
    var ab = v.ABOUT || 0;
    var cfgR = { minor: false, noK: true, range: [-ab, X0[n] + ab], dyn: function () { return 1; } };
    R.reac = [];
    for (var a = 0; a <= n; a++) {
      var fr = reactionLI(R, a);
      var S3 = loadEffects(R, v, fr, cfgR);
      var ar2 = R.liReacAires[a].total;
      S3.cp = [R.cp.tot[1] * ar2, R.cp.tot[2] * ar2];
      S3.comb = combine(S3, v, false);
      R.reac.push(S3);
    }
    return res;
  }
  function sectionShearLI(R, t, gauche) {
    var n = R.n, L = R.L, X0 = R.X0, liA = R.liAppuis;
    var sup = function (i, j, x) { if (i <= 0 || i >= n) return 0; var c = liA[i - 1][j]; return c.A * x * x * x + c.B * x * x + c.C * x; };
    return function (X) {
      if (X < 0 || X > X0[n]) return 0;
      var j = 0; while (j < n - 1 && X > X0[j + 1]) j++;
      if (gauche && Math.abs(X - X0[t]) < 1e-12) j = t;
      var x = (X - X0[j]) / L[j];
      var v = (sup(t + 1, j, x) - sup(t, j, x)) / L[t];
      if (j === t) v += gauche ? (1 - x) : -x;
      return v;
    };
  }
  function reactionLI(R, a) {
    var n = R.n, L = R.L;
    var gs = a < n ? sectionShearLI(R, a, true) : null, gd = a > 0 ? sectionShearLI(R, a - 1, false) : null;
    var base = function (X) { if (Math.abs(X - R.X0[a]) < 1e-12) return 1; return (gs ? gs(X) : 0) - (gd ? gd(X) : 0); };
    var Lt = R.X0[n], e = 1e-6;
    var s0 = (base(2 * e) - base(e)) / e, s1 = (base(Lt - e) - base(Lt - 2 * e)) / e, f0 = base(e), f1 = base(Lt - e);
    return function (X) { if (X < 0) return (a === 0) ? f0 + s0 * X : 0; if (X > Lt) return (a === n) ? f1 + s1 * (X - Lt) : 0; return base(X); };
  }

  // ------------------------------------------------------------- précontrainte : tensions (BPEL 91)
  // cable : fonction pente dz/dx(X) (X abscisse cumulée) ; ND : divisions par travée ; ancrage actif aux deux
  // extrémités si v.MOD = 0. Retourne pour chaque point de la grille : déviation (grades), T0, perte au blocage.
  function tensionsInitiales(R, v, slopeFn) {
    var n = R.n, G = [], i, k;
    for (i = 0; i < n; i++) for (k = 0; k < R.ND[i]; k++) G.push(R.X0[i] + k * R.L[i] / R.ND[i]);
    G.push(R.X0[n]);
    var th = G.map(function (X, q) { return Math.atan(slopeFn(q === G.length - 1 ? X - 1e-9 : X)); });
    var ag = [0]; for (i = 1; i < G.length; i++) ag.push(ag[i - 1] + Math.abs(th[i] - th[i - 1]));
    var r = v.PHI / v.F, Ltot = R.X0[n];
    var alG = ag.map(function (a, q) { return a + r * G[q]; });
    var alD = ag.map(function (a, q) { return ag[ag.length - 1] - a + r * (Ltot - G[q]); });
    var t0G = alG.map(function (a) { return v.SIGMAP0 * Math.exp(-v.F * a); });
    var t0D = alD.map(function (a) { return v.SIGMAP0 * Math.exp(-v.F * a); });
    var interp = function (arr, X) { var q = 0; while (q < G.length - 2 && X > G[q + 1]) q++; var t = (X - G[q]) / (G[q + 1] - G[q]); return arr[q] * (1 - t) + arr[q + 1] * t; };
    // recul d'ancrage : aire 2∫(T0 - T0(s)) = RECUL·Ep
    var reculLen = function (arr, fromLeft) {
      var lo = 0, hi = Ltot;
      for (var it = 0; it < 60; it++) {
        var sg = (lo + hi) / 2, M = 400, sm = 0, ts = interp(arr, fromLeft ? sg : Ltot - sg);
        for (var m = 0; m <= M; m++) { var x = sg * m / M; sm += (interp(arr, fromLeft ? x : Ltot - x) - ts) * sg / M * ((m === 0 || m === M) ? 0.5 : 1); }
        if (2 * sm > v.RECUL * v.EP) hi = sg; else lo = sg;
      }
      return lo;
    };
    var sg = reculLen(t0G, true), tsg = interp(t0G, sg);
    var sd = v.MOD === 0 ? reculLen(t0D, false) : null, tsd = sd !== null ? interp(t0D, Ltot - sd) : 0;
    var pts = G.map(function (X, q) {
      var useG = v.MOD !== 0 || t0G[q] >= t0D[q];
      var T0 = useG ? t0G[q] : t0D[q];
      var bl = useG ? (X < sg ? 2 * (t0G[q] - tsg) : 0) : (X > Ltot - sd ? 2 * (t0D[q] - tsd) : 0);
      return { X: X, dev: (useG ? alG[q] : alD[q]) * 200 / PI, T0: T0, blocage: bl };
    });
    return { pts: pts, SG: sg, SD: sd !== null ? Ltot - sd : null };
  }
  // Pertes : instantanées (frottement + blocage + raccourcissement élastique dC), valeurs caractéristiques,
  // relaxation, retrait, fluage, terme rectangle (BPEL 3.3 et annexe 2 §5).
  function pertes(v, R, T0, blocage, dC, dFluage) {
    var dInst = (v.SIGMAP0 - T0) + blocage + dC;
    var spi = v.SIGMAP0 - dInst;
    var rho = 6 / 100 * v.RO * (spi / v.FPRG - v.MU0) * spi;
    var dr = R.retrait * v.EP;
    var rect = 2 * rho * (dr + dFluage) / spi;
    return { inst: dInst, proba: spi, maxi: 1.02 * v.SIGMAP0 - 0.8 * dInst, mini: 0.98 * v.SIGMAP0 - 1.2 * dInst,
      relax: rho, retrait: dr, rect: -rect, infini: spi - rho - dr - dFluage + rect };
  }

  // ------------------------------------------------------------- câblage imposé (CABL = 4)
  // Rétro-analyse 2549 : dans chaque travée, sommet de parabole au point de cote minimale ; sur appui
  // intermédiaire, parabole renversée de sommet sur l'appui, de rayon R ENTIER (>= RMIN) raccordée
  // tangentiellement (pente au raccord = 2h/d) ; R retenu = moindres carrés sur les cotes données de la
  // demi-travée. Côté culée : une seule parabole passant exactement par la cote d'about.
  function fitCableImpose(L, cotes, VP, Rmin) {
    var n = L.length, spans = [];
    for (var t = 0; t < n; t++) {
      var c = cotes[t], N = c.length - 1, l = L[t];
      var X = function (k) { return k * l / N; };
      var im = 1, k;
      for (k = 1; k < N; k++) if (c[k] < c[im]) im = k;
      var xm = X(im), zm = c[im] - VP, segs = [];
      [-1, 1].forEach(function (side) {
        var ie = side < 0 ? 0 : N, xe = X(ie), ze = c[ie] - VP, d = Math.abs(xe - xm), h = ze - zm;
        var abut = (side < 0 && t === 0) || (side > 0 && t === n - 1);
        if (abut) { segs.push({ a: h / (d * d), x0: xm, z0: zm, from: Math.min(xm, xe), to: Math.max(xm, xe) }); return; }
        var ks = []; for (k = 1; k < N; k++) if ((X(k) - xm) * side > 1e-9) ks.push(k);
        var best = null;
        for (var Rr = Math.max(1, Math.ceil(Rmin - 1e-9)); Rr <= 2000; Rr++) {
          var a2 = 1 / (2 * Rr), s = h / d, t2 = s / a2, t1 = d - t2;
          if (t1 <= 1e-9) continue;
          var a1 = s / t1, e = 0;
          ks.forEach(function (q) { var u = Math.abs(X(q) - xm); var zz = u <= t1 ? zm + a1 * u * u : ze - a2 * (d - u) * (d - u); e += Math.pow(zz - (c[q] - VP), 2); });
          if (!best || e < best.e - 1e-15) best = { e: e, a1: a1, a2: a2, t1: t1, R: Rr };
        }
        var xt = xm + side * best.t1;
        segs.push({ a: best.a1, x0: xm, z0: zm, from: Math.min(xm, xt), to: Math.max(xm, xt) });
        segs.push({ a: -best.a2, x0: xe, z0: ze, from: Math.min(xt, xe), to: Math.max(xt, xe), R: best.R });
      });
      segs.sort(function (p, q) { return p.from - q.from; });
      segs.forEach(function (g) { g.A = g.a; g.B = -2 * g.a * g.x0; g.C = g.a * g.x0 * g.x0 + g.z0; });
      spans.push(segs);
    }
    // écart quadratique moyen (cm) entre cotes données et paraboles, points intérieurs (NON RÉSOLU : SETRA 0.184 sur 2549)
    var se = 0, ne = 0;
    for (var tt = 0; tt < n; tt++) { var cc = cotes[tt], NN = cc.length - 1; for (var kk = 1; kk < NN; kk++) { var xx = kk * L[tt] / NN, g0 = null;
      spans[tt].forEach(function (g) { if (!g0 && xx <= g.to + 1e-9) g0 = g; }); se += Math.pow(g0.a * (xx - g0.x0) * (xx - g0.x0) + g0.z0 - (cc[kk] - VP), 2); ne++; } }
    var seg = function (t, x) { var S = spans[t]; for (var i = 0; i < S.length; i++) if (x <= S[i].to + 1e-9) return S[i]; return S[S.length - 1]; };
    return {
      spans: spans, ecart: ne ? 100 * Math.sqrt(se / ne) : 0,
      z: function (t, x) { var g = seg(t, x); return g.a * (x - g.x0) * (x - g.x0) + g.z0; },
      slope: function (t, x) { var g = seg(t, x); return 2 * g.a * (x - g.x0); }
    };
  }

  // intégrale de Simpson (composite ; dernier intervalle par Simpson 3/8 si nombre impair)
  function simpsonW(N, h) {
    var w = [], k; for (k = 0; k <= N; k++) w.push(0);
    var M = N % 2 === 0 ? N : N - 3;
    for (k = 0; k < M; k += 2) { w[k] += h / 3; w[k + 1] += 4 * h / 3; w[k + 2] += h / 3; }
    if (M !== N) { w[M] += 3 * h / 8; w[M + 1] += 9 * h / 8; w[M + 2] += 9 * h / 8; w[M + 3] += 3 * h / 8; }
    return w;
  }

  // ------------------------------------------------------------- précontrainte (sections 22 à 26 du listing)
  function precontrainte(R, v, model) {
    var n = R.n, L = R.L, P = {};
    P.N = v.NCA || 0;
    P.Sg = PI * v.DGAIN * v.DGAIN / 4;
    P.Sn = R.section.S - P.N * P.Sg;
    P.coefI = P.N * P.Sg;
    P.nA = P.N * v.SECT * 1e-6;
    if (v.CABL !== 4 || !model.cotes || !model.cotes.values || !P.N) return P;
    var sc = R.section.calc, VP = sc.VP, Vs = sc.V, Ib = R.section.I, Sb = R.section.S, Sn = P.Sn, nA = P.nA;
    var cab = fitCableImpose(L, model.cotes.values, VP, v.RMIN || 0);
    P.cable = cab;
    var slope = function (X) { var t = 0; while (t < n - 1 && X > R.X0[t + 1] + 1e-9) t++; return cab.slope(t, X - R.X0[t]); };
    var ti = tensionsInitiales(R, v, slope);
    P.SG = ti.SG; P.SD = ti.SD;
    // grille par travée (avec doublons aux appuis) ; index global dans ti.pts
    var G = [], off = [0], t, k;
    for (t = 0; t < n; t++) off.push(off[t] + R.ND[t]);
    var Lt = R.X0[n], sym = v.SYM === 1;
    for (t = 0; t < n; t++) for (k = 0; k <= R.ND[t]; k++) {
      var x = k * L[t] / R.ND[t], c = model.cotes.values[t];
      var e = (c && c.length - 1 === R.ND[t]) ? c[k] - VP : cab.z(t, x);
      var q = off[t] + k, X = R.X0[t] + x;
      // ouvrage symétrique : tensions de la moitié gauche reportées par symétrie
      var qs = (sym && X > Lt / 2 + 1e-9) ? off[n] - q : q;
      G.push({ t: t, k: k, x: x, X: X, e: e, q: q, qs: qs, In: Ib - P.coefI * e * e });
    }
    P.G = G;
    var uniq = G.filter(function (g) { return !(g.k === 0 && g.t > 0); });
    var Mu = function (qq) { return supportMomentsUniform(L, L.map(function () { return qq; })); };
    var MuG = Mu(R.cp.tot[0]), MuO = Mu(R.cp.oss[0]);
    var Miso = function (g, qq, mu) { var l = L[g.t]; return qq * g.x * (l - g.x) / 2 + mu[g.t] * (1 - g.x / l) + mu[g.t + 1] * g.x / l; };
    G.forEach(function (g) {
      g.MG = Miso(g, R.cp.tot[0], MuG); g.MO = Miso(g, R.cp.oss[0], MuO);
      var xr = g.x / L[g.t];
      g.d2 = []; for (var j = 1; j < n; j++) { var cc = R.liAppuis[j - 1][g.t]; g.d2.push((6 * cc.A * xr + 2 * cc.B) / (L[g.t] * L[g.t])); }
    });
    var W = L.map(function (l, tt) { return simpsonW(R.ND[tt], l / R.ND[tt]); });
    var hyper = function (Ff) {
      var out = [0];
      for (var j = 1; j < n; j++) { var s = 0; G.forEach(function (g) { s += W[g.t][g.k] * Ff(g) * g.e * g.d2[j - 1]; }); out.push(-s); }
      out.push(0); return out;
    };
    var at = function (M, g) { return M[g.t] * (1 - g.x / L[g.t]) + M[g.t + 1] * g.x / L[g.t]; };
    var pt = function (g) { return ti.pts[g.qs]; };
    var los = function (g, dC, dFl) { var p = pt(g); return pertes(v, R, p.T0, p.blocage, dC, dFl); };
    // --- approximations (NON RÉSOLU, voir NOTES.md) : raccourcissement élastique et fluage approché
    var dC = 0, it;
    for (it = 0; it < 40; it++) {
      var Fi = function (g) { return los(g, dC, 0).proba * nA; };
      var Mh = hyper(Fi), sm = 0;
      uniq.forEach(function (g) { var F = Fi(g); sm += F / Sn + F * g.e * g.e / g.In + (g.MO + at(Mh, g)) * g.e / g.In; });
      dC = v.EP / (2 * R.EI) * sm / uniq.length;
    }
    var ft28 = -R.limites.trEnrQC, rG = R.cp.tot[0] / R.cp.tot[1], dFl = 0, js = -1, Smin = Infinity, j;
    for (j = 1; j < n; j++) { var ss = R.sol[j - 1].filter(function (s) { return Math.abs(s.x0 - 1) < 1e-9; })[0]; if (ss && ss.cp[1] < Smin) { Smin = ss.cp[1]; js = j; } }
    for (it = 0; it < 40 && js > 0; it++) {
      var sel = G.filter(function (g) { return g.t === js - 1 || g.t === js; }), FM = 0;
      sel.forEach(function (g) { FM += los(g, dC, dFl).infini * nA; }); FM /= sel.length;
      var s0 = R.sol[js - 1].filter(function (s) { return Math.abs(s.x0 - 1) < 1e-9; })[0];
      var ge = G.filter(function (g) { return g.t === js && g.k === 0; })[0].e;
      var sig = (FM / Sb) * (1 - 0.8 * ge / Vs) - ft28 * ge / Vs + (s0.cp[1] * rG - s0.comb[1].qlqcta) * ge / Ib;
      dFl = v.KFL * v.EP / R.EI28 * sig;
    }
    P.dC = dC; P.dFl = dFl;
    // --- section 24 : tensions initiales et première approximation à l'infini
    G.forEach(function (g) { var p = pt(g); g.dev = p.dev; g.T0 = p.T0; g.bl = p.blocage; g.p = los(g, dC, dFl); });
    // --- section 25 : phase initiale
    P.hypInit = { moy: hyper(function (g) { return g.p.proba * nA; }), max: hyper(function (g) { return g.p.maxi * nA; }) };
    // --- section 26 : fluage réajusté par section (sigma_b au niveau du câble, service à vide)
    var Finf = function (g) { return g.p.infini * nA; }, MhInf = hyper(Finf), rt = v.RT === undefined ? 0.5 : v.RT;
    G.forEach(function (g) {
      var F = Finf(g), sb = F / Sn + F * g.e * g.e / g.In + (g.MG + at(MhInf, g)) * g.e / g.In;
      var fl = v.KFL * v.EP / R.EI28 * sb, rect = -2 * g.p.relax * (g.p.retrait + fl) / g.p.proba;
      var es = g.p.relax + g.p.retrait + fl + rect, ms = rt * es;
      g.d = { fl: fl, rect: rect, es: es, ms: ms, msMoy: g.p.proba - ms, msMax: g.p.maxi - 0.8 * ms, esMoy: g.p.proba - es, esMin: g.p.mini - 1.2 * es };
    });
    P.hypServ = {
      msMoy: hyper(function (g) { return g.d.msMoy * nA; }), msMax: hyper(function (g) { return g.d.msMax * nA; }),
      esMoy: hyper(function (g) { return g.d.esMoy * nA; }), esMin: hyper(function (g) { return g.d.esMin * nA; })
    };
    // --- sections 27 à 29 : contraintes normales (fibres sup. z = V, inf. z = -V'), I(x) = IG - N.Sg.e²
    var H = P.hypServ, HI = P.hypInit;
    G.forEach(function (g) {
      var s = (R.sol[g.t] || []).filter(function (q) { return Math.abs(q.x0 - g.k / R.ND[g.t]) < 1e-9; })[0];
      var zz = [Vs, -VP], In = g.In;
      var sm = function (M) { return zz.map(function (z) { return M * z / In; }); };
      var sp = function (T, Mh) { var F = T * nA, mh = at(Mh, g); return zz.map(function (z) { return F / Sn + (F * g.e + mh) * z / In; }); };
      var o = { MO: sm(g.MO), MOx: sm(g.MO * v.OSSAX), MOn: sm(g.MO * v.OSSAN), Pi: sp(g.p.proba, HI.moy), Px: sp(g.p.maxi, HI.max),
        MG: sm(g.MG), Pms: sp(g.d.msMoy, H.msMoy), PmsX: sp(g.d.msMax, H.msMax), Pes: sp(g.d.esMoy, H.esMoy), PesN: sp(g.d.esMin, H.esMin) };
      if (s) {
        var tp = s.tp || [0, 0];
        o.QLx = sm(s.cp[0] + tp[0]); o.QLn = sm(s.cp[1] + tp[1]);
        o.qcx = sm(s.comb[0].qlqc); o.qcn = sm(s.comb[1].qlqc); o.frx = sm(s.comb[0].freq); o.frn = sm(s.comb[1].freq);
        o.tax = sm(s.comb[0].qlqcta); o.tan = sm(s.comb[1].qlqcta);
      }
      g.sig = o;
    });
    // --- déformées dues à la précontrainte (section 38) : courbure (F.e + M_hyp)/(E.IG), F et e linéaires entre
    // points de grille, double intégration par travée (flèche nulle sur appuis). Instantanée : F initiale moy., Eij ;
    // fluage : F en service moy. (E.S), EF. Vérifié à ±0.1 mm sur 2549 (forme légèrement différente : NON RÉSOLU).
    var deflP = function (t, Mk, EI) {
      var l = L[t], N = R.ND[t], S = 2000, h = l / S, th = [0], w = [0], i;
      var M = function (x) { var u = x / l * N, ii = Math.min(N - 1, Math.floor(u)), f = u - ii; return Mk[ii] * (1 - f) + Mk[ii + 1] * f; };
      for (i = 1; i <= S; i++) th.push(th[i - 1] + M((i - 0.5) * h) / EI * h);
      for (i = 1; i <= S; i++) w.push(w[i - 1] + (th[i - 1] + th[i]) / 2 * h);
      var cc = w[S] / l, out = [];
      for (var q = 0; q <= 10; q++) out.push((w[Math.round(q / 10 * S)] - cc * q / 10 * l) * 1000);
      return out;
    };
    P.defl = { inst: [], flu: [] };
    for (t = 0; t < n; t++) {
      var gt = G.filter(function (g) { return g.t === t; });
      P.defl.inst.push(deflP(t, gt.map(function (g) { return g.p.proba * nA * g.e + at(HI.moy, g); }), R.EI * Ib));
      P.defl.flu.push(deflP(t, gt.map(function (g) { return g.d.esMoy * nA * g.e + at(H.esMoy, g); }), R.EF * Ib));
    }
    return P;
  }

  // flèches (mm, vers le haut positif) d'une poutre continue sous charge uniforme g, rigidité EI
  function deflections(R, g, EI) {
    var L = R.L, Mu = supportMomentsUniform(L, L.map(function () { return g; }));
    return L.map(function (l, j) {
      var N = 2000, h = l / N, th = [0], w = [0], i;
      var M = function (x) { return g * x * (l - x) / 2 + Mu[j] * (1 - x / l) + Mu[j + 1] * x / l; };
      for (i = 1; i <= N; i++) th.push(th[i - 1] + M((i - 0.5) * h) / EI * h);
      for (i = 1; i <= N; i++) w.push(w[i - 1] + (th[i - 1] + th[i]) / 2 * h);
      var c = w[N] / l, out = [];
      for (var q = 0; q <= 10; q++) { var x = q / 10 * l; out.push((w[Math.round(x / h)] - c * x) * 1000); }
      return out;
    });
  }

  var api = {
    compute: compute, sectionBrute: sectionBrute, guyonK: guyonK, supportMomentsUniform: supportMomentsUniform,
    supportMomentsUnitForce: supportMomentsUnitForce, threeMoments: threeMoments, tensionsInitiales: tensionsInitiales, pertes: pertes
  };
  root.PSIDP_COMPUTE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
