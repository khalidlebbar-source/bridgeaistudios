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
    var cv = model.cotes && model.cotes.values, warnND = [];
    for (var i = 1; i <= n; i++) {
      L.push(v['D' + i]);
      // ND absent, nul ou invalide sur une travée active : divisions par défaut (nombre d'intervalles des cotes du câble
      // imposé si fournies, sinon 10) — évite les divisions par zéro de la grille de précontrainte
      var nd = Math.round(Number(v['ND' + i]));
      if (!(nd >= 1)) { var c0 = cv && cv[i - 1]; nd = (c0 && c0.length > 1) ? c0.length - 1 : 10; warnND.push(i); }
      ND.push(nd);
    }
    var R = { n: n, L: L, ND: ND, warnings: warnND.length ? ['ND nul ou invalide sur la (les) travee(s) ' + warnND.join(', ') + ' : valeur par defaut retenue'] : [] };

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
    R.a1 = R.classe ? a1coef(R.classe, R.nv) : 1; R.bc = R.classe && BC[R.classe] ? BC[R.classe][Math.min(R.nv, BC[R.classe].length) - 1] : 1;

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
    try { R.deformQ = liveDefl(R, v); } catch (err) { R.warnings.push('déformées sous surcharges : ' + err.message); }
    R.prec = precontrainte(R, v, model);
    try { R.flexT = flexionTransversale(R, v); } catch (err) { R.warnings.push('flexion transversale : ' + err.message); }
    try { R.appareils = appareilsAppui(R, v); } catch (err) { R.warnings.push("appareils d'appui : " + err.message); }
    try { R.ferPassif = ferraillagePassif(R, v); } catch (err) { R.warnings.push('ferraillage passif : ' + err.message); }
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
  function tensionsInitiales(R, v, slopeFn, NDg) {
    var n = R.n, G = [], i, k, ND = NDg || R.ND;
    for (i = 0; i < n; i++) for (k = 0; k < ND[i]; k++) G.push(R.X0[i] + k * R.L[i] / ND[i]);
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


  // ------------------------------------------------------------- flexion transversale (Guyon-Massonnet-Barès)
  // Module commun PSIDA/PSIDP (guide PSIDP annexe 6, rétro-analyse moteur PSIDA) : plaque de largeur A1 = Be/sin ψ,
  // longueur DB·sin ψ (travée droite équivalente), harmoniques 1, 3, 5, solution exacte avec le coefficient de Poisson.
  function plateLine(b, L, e, nu, m) {
    var B = m * PI / L;
    var dG = function (t, k) {
      var s = t < 0 ? -1 : 1, a = Math.abs(t), E = Math.exp(-B * a), c = 4 * B * B * B;
      if (k === 0) return (1 + B * a) * E / c;
      if (k === 1) return s * (-B * B * a * E) / c;
      if (k === 2) return (-B * B * E + B * B * B * a * E) / c;
      return s * (2 * B * B * B * E - B * B * B * B * a * E) / c;
    };
    var ch = function (y) { return Math.cosh(B * y); }, sh = function (y) { return Math.sinh(B * y); };
    var H = [
      function (y, k) { return [ch(y), B * sh(y), B * B * ch(y), B * B * B * sh(y)][k]; },
      function (y, k) { return [sh(y), B * ch(y), B * B * sh(y), B * B * B * ch(y)][k]; },
      function (y, k) { return [y * sh(y), sh(y) + B * y * ch(y), 2 * B * ch(y) + B * B * y * sh(y), 3 * B * B * sh(y) + B * B * B * y * ch(y)][k]; },
      function (y, k) { return [y * ch(y), ch(y) + B * y * sh(y), 2 * B * sh(y) + B * B * y * ch(y), 3 * B * B * ch(y) + B * B * B * y * sh(y)][k]; }
    ];
    var rows = [], rhs = [];
    [-b, b].forEach(function (yb) {
      rows.push(H.map(function (h) { return h(yb, 2) - nu * B * B * h(yb, 0); })); rhs.push(-(dG(yb - e, 2) - nu * B * B * dG(yb - e, 0)));
      rows.push(H.map(function (h) { return h(yb, 3) - (2 - nu) * B * B * h(yb, 1); })); rhs.push(-(dG(yb - e, 3) - (2 - nu) * B * B * dG(yb - e, 1)));
    });
    var c = solve(rows, rhs);
    var w = function (y, k) { k = k || 0; var t = dG(y - e, k); for (var i = 0; i < 4; i++) t += c[i] * H[i](y, k); return t; };
    w.B = B;
    return w;
  }
  // LI du coefficient μ_m de la fibre y (coordonnées plaque) ; au-delà de e1 : prolongement linéaire de pente = corde [e1, e1 + 0.125]
  function muLine(b, L, y, m, nu, e1, hh) {
    var cache = {};
    var exact = function (e) {
      var k = e.toFixed(9);
      if (!(k in cache)) { var w = plateLine(b, L, Math.max(-b + 1e-9, Math.min(b - 1e-9, e)), nu, m); cache[k] = -(w(y, 2) - nu * w.B * w.B * w(y, 0)) / b; }
      return cache[k];
    };
    var h = hh || 0.125;
    return function (e) {
      var a = Math.abs(e), sg = e < 0 ? -1 : 1;
      if (a <= e1) return exact(e);
      var v1 = exact(sg * e1), v2 = exact(sg * (e1 + h));
      return v1 + (a - e1) * (v2 - v1) / h;
    };
  }
  // Section 34 (DIMENSIONNEMENT DES APPAREILS D'APPUI) — 2026-11-04 v6.
  // Espacement = trunc2(min(E1/(Na-0.6), Be/(Na-0.3)) / sin(biais)) (14 passages exacts ; Na-0.3 vu seulement avec Na = 2).
  // A vide : max = (Gmax·Kcp + max(Rhyp MS, Rhyp ES))/Na, min = (Gmin + min(Rhyp MS, Rhyp ES))/Na (2549 exact).
  // En charge : vide ± max/min des cas [1.2·A·KA ; 1.2·bc·δB·Bc·KBC ; 1.2·δB·Bt·KBT ; δC·C·KC] + trottoirs (×1) (2549 exact
  // avec les K imprimés). Coefficients d'inégalité : NON RÉSOLUS (constats NOTES.md) — CP = 1 avec 2 appareils (règle),
  // les autres valent 1 provisoirement. Dimensions : provisoires. Chevêtres : règle PSIDA (largeur 2s/3 ou about·sinφ + s/3,
  // M = R·s/(12 e), section ELS fissurée d = H - 0.04, σs fissuration préjudiciable).
  function appareilsAppui(R, v) {
    if (!R.reac || !R.prec || !R.prec.hypInit || !R.prec.hypServ) return null;
    var n = R.n, P = R.prec, sb = Math.sin(gr(v.BIAIS || 100));
    var V = function (M) { return R.L.map(function (l, t) { return (M[t + 1] - M[t]) / l; }); };
    var rh = function (M) { var w = V(M); return R.reac.map(function (_, i) { return (i < n ? w[i] : 0) - (i > 0 ? w[i - 1] : 0); }); };
    var hMS = rh(P.hypServ.msMax), hES = rh(P.hypServ.esMin);
    var c0 = 0.6 * 1000 / 9.80665, ft28 = c0 + 0.06 * v.FC28, fe = v.FE1 || 50000, eta = v.ETA || 1.6;
    var sigS = Math.min(2 * fe / 3, Math.max(fe / 2, 110 * Math.sqrt(eta * ft28 * 0.00980665) / 0.00980665));
    var H = v.HDAL1, d = H - 0.04;
    return R.reac.map(function (r, k) {
      var na = Math.max(1, v['NAP' + (k + 1)] || 2), typ = v['TYPAP' + (k + 1)]; if (typ === undefined || typ === null || typ === '') typ = 1;
      var esp = na > 1 ? Math.floor(Math.min(v.EDAL1 / (na - 0.6), R.Be / (na - 0.3)) / sb * 100 + 1e-6) / 100 : 0;
      var dy = R.dyn.appui[k], end = k === 0 || k === n;
      var K = { CP: na === 2 ? 1 : 1, A: 1, BC: 1, BT: 1 }, cas = [], ext = r.ext || {};
      cas.push(['A', 1.2 * r.A[0], 1.2 * r.A[1]]);
      if (ext.BC) cas.push(['BC', 1.2 * R.bc * dy.bc * ext.BC[0].v, 1.2 * R.bc * dy.bc * ext.BC[1].v]);
      if (ext.BT) cas.push(['BT', 1.2 * dy.bc * ext.BT[0].v, 1.2 * dy.bc * ext.BT[1].v]);
      Object.keys(ext).forEach(function (c) { if (c === 'BC' || c === 'BT') return; K[c] = 1; var dd = /MC/.test(c) ? dy.mc : dy.ce; cas.push([c, dd * ext[c][0].v, dd * ext[c][1].v]); });
      var qmax = 0, qmin = 0; cas.forEach(function (c) { qmax = Math.max(qmax, c[1] * K[c[0]]); qmin = Math.min(qmin, c[2] * K[c[0]]); });
      var vMax = (r.cp[0] * K.CP + Math.max(hMS[k], hES[k])) / na, vMin = (r.cp[1] + Math.min(hMS[k], hES[k])) / na;
      var cMax = vMax + (qmax + r.trot[0]) / na, cMin = vMin + (qmin + r.trot[1]) / na;
      var adm = typ === 0 ? (v.CBS || 3500) : (v.CNS || 1500), amin = cMax / adm;
      var larg = Math.max(0.25, Math.ceil(Math.sqrt(amin) / 0.05 - 1e-9) * 0.05), long = Math.max(larg, Math.ceil(amin / larg / 0.05 - 1e-9) * 0.05);
      var ech = end ? (R.about || v.ABOUT || 0) * sb + esp / 3 : 2 * esp / 3, mch = ech > 0 ? cMax * esp / (12 * ech) : 0;
      var mres = function (A) { var x = -15 * A + Math.sqrt(225 * A * A + 30 * A * d); return A * sigS * (d - x / 3); };
      var lo = 0, hi = 0.05; for (var it = 0; it < 80; it++) { var md = (lo + hi) / 2; if (mres(md) < mch) lo = md; else hi = md; }
      return { typ: typ, na: na, esp: esp, larg: larg, long: long, K: K, cas: cas.map(function (c) { return c[0]; }), vMax: vMax, vMin: vMin, cMax: cMax, cMin: cMin,
        sMin: cMin / (larg * long), sMax: cMax / (larg * long), ech: ech, mch: mch, ach: hi };
    });
  }

  // Section 35 (REPARTITION DU FERRAILLAGE TRANSVERSAL, FERRAILLAGE LONGITUDINAL) — 2026-11-04 v6.
  // Zones (2549, 0013, notice 0015 : exact) : ABOUT = about ; CHEV APP = esp/3/sin φ ; EXT CHEV = 2 esp/3/sin φ (esp de l'appui) ;
  // TRAVEE = L - zones. Sections : CHEV = max(section du chevêtre, minimale de la face) ; EXT = max(chevêtre/3, minimale) ;
  // TRAVEE = minimale (section 32 : parallèle aux lignes d'appui si φ >= 70 gr, sinon perpendiculaire aux bords libres).
  // Espacement par diamètre = aire / section, affiché si 0.10 <= s <= 0.25 (fissuration préjudiciable : min(25 cm, 2h)).
  // Longitudinal : minimum 5e-4·H par m (face sup. sur W, face inf. sur EDAL1) — le reste (ELU, tractions) NON calculé.
  function ferraillagePassif(R, v) {
    var AP = R.appareils, FT = R.flexT; if (!AP || !FT) return null;
    var sb = Math.sin(gr(v.BIAIS || 100)), par = (v.BIAIS || 100) >= 70, n = R.n, PHI = [10, 12, 14, 16, 20];
    var minF = function (t, f) { var fe = FT[t] && FT[t].fer; return fe ? (par ? fe.par[f] : fe.perp[f]) : 0; };
    var esp = function (sec) { return PHI.map(function (d) { var s = Math.PI * d * d / 4e6 / sec; return s >= 0.1 - 1e-9 && s <= 0.25 + 1e-9 ? s : null; }); };
    var zone = function (nom, lg, t, chev, div) { var o = { nom: nom, lg: lg }; ['sup', 'inf'].forEach(function (f) { var mn = minF(t, f), sc = chev === null ? mn : Math.max(chev / div, mn); o[f] = { sec: sc, s: esp(sc) }; }); return o; };
    var tr = [];
    for (var t = 0; t < n; t++) {
      var a = AP[t], b = AP[t + 1], cg = a.esp / 3 / sb, cd = b.esp / 3 / sb, z = [];
      if (t === 0) z.push(zone('ABOUT', v.ABOUT || 0, 0, a.ach, 1));
      z.push(zone('CHEV APP G', cg, t, a.ach, 1), zone('EXT CHEV G', 2 * cg, t, a.ach, 3), zone('TRAVEE', R.L[t] - 3 * cg - 3 * cd, t, null, 1),
        zone('EXT CHEV D', 2 * cd, t, b.ach, 3), zone('CHEV APP D', cd, t, b.ach, 1));
      tr.push(z);
    }
    var lmin = 5e-4 * v.HDAL1;
    return { par: par, travees: tr, longi: { sup: lmin * (v.EDAL1 + v.EDAL2), inf: lmin * v.EDAL1 } };
  }
  function flexionTransversale(R, v) {
    var H = v.HDAL1, hc = v.HCHAU || 0, e0 = 0.25 + 2 * hc + H, e1 = 2 * hc + H, W = R.largeurTot, nu = v.POIS || 0;
    return R.L.map(function (l, t) {
      var DB = R.Leq[t], psi = R.biaisMeca[t], sP = Math.sin(gr(psi)), A1 = R.Be / sP, A2 = A1 / DB;
      var bS = A1 / 2, LS = DB * sP, eInt = FLEXT_EINT(v, sP);
      var term = function (c) { return [1, 3, 5].map(function (m) { var x = m * PI * Math.min(c, DB) / (2 * DB); return Math.sin(x) / x; }); };
      var Lmin = Math.min.apply(null, R.Leq), ch = [['CHARGE REPARTIE', DB]];
      if (R.loads.B) { ch.push(['BC', 1.5 + e0]); ch.push(['BT', 1.35 + e0]); }
      if (R.loads.CE) { ch.push(['CVOI.D', Math.min(Lmin, 11 + e1)]); ch.push(['CVOI.E', Math.min(Lmin, 15 + e1)]); }
      if (R.loads.MC120) ch.push(['MC.120', 6.1 + e1]);
      if (R.loads.MC80) ch.push(['MC.80', 4.9 + e1]);
      var etal = ch.map(function (q) { return { nom: q[0], c: Math.min(q[1], DB), t: term(q[1]) }; });
      var nf = v.NF >= 3 ? 3 : (v.NF >= 2 ? 2 : 1);
      var fibres = [{ n: 1, f: 0 }, { n: 2, f: 0.5 }, { n: 4, f: 0.75 }].slice(0, nf).map(function (fb) {
        var yP = -Math.min(fb.f * bS, eInt);
        var mus = [1, 3, 5].map(function (m) { var mu = muLine(bS, LS, yP, m, nu, eInt, FLEXT_H(sP)); return function (e) { return mu(e / sP); }; });
        var grid = [], kk; for (kk = 0; -W / 2 + kk * 0.5 <= W / 2 + 1e-9; kk++) grid.push(-W / 2 + kk * 0.5); if (grid[grid.length - 1] < W / 2 - 1e-9) grid.push(W / 2);
        return { n: fb.n, y: yP * sP, yP: yP, mus: mus, grid: grid, vals: grid.map(function (e) { return mus.map(function (mu) { return mu(e); }); }), star: mus.map(function (mu) { return mu(yP * sP); }) };
      });
      var F = { psi: psi, DB: DB, Be: R.Be, nu: nu, A1: A1, A2: A2, LS: LS, bS: bS, theta: bS / LS, sinPsi: sP, eInt: eInt, etal: etal, fibres: fibres };
      F.prec = flexTPrec(R, v, t);
      F.my = momentsTransversaux(R, v, F, t);
      F.fer = ferraillageTransversal(R, v, F);
      return F;
    });
  }
  // Effort de précontrainte au centre mécanique (0.4L travée de rive, 0.5L intermédiaire) : ES min (MY max) et MS max (MY min),
  // et somme A2 + A3 des coefficients des deux paraboles principales de la travée (notice PSIDP, annexe 6 § b).
  function flexTPrec(R, v, t) {
    var P = R.prec; if (!P || !P.G || !P.cable) return null;
    var n = R.n, xr = n === 1 ? 0.5 : (t === 0 ? 0.4 : (t === n - 1 ? 0.6 : 0.5)), Nd = P.ND[t];
    var g = P.G.filter(function (q) { return q.t === t && Math.abs(q.k / Nd - xr) < 1e-9; })[0];
    if (!g || !g.d) return null;
    var segs = P.cable.spans[t] || [], As = 0;
    segs.forEach(function (sg) { var a = sg.a !== undefined ? sg.a : sg.A; if (a > 0) As += a; });
    // moment longitudinal principal pondéré au centre mécanique : (QL+QC + P) / Be, P = F.e + M_hyp (ES min pour le max,
    // MS max pour le min) — constat 2549
    var sol = (R.sol[t] || []).filter(function (q) { return Math.abs(q.x0 - xr) < 1e-9; })[0], ML = null;
    if (sol && P.hypServ) {
      var at = function (M) { return M[t] * (1 - g.x / R.L[t]) + M[t + 1] * g.x / R.L[t]; };
      ML = [(sol.comb[0].qlqc + g.d.esMin * P.nA * g.e + at(P.hypServ.esMin)) / R.Be, (sol.comb[1].qlqc + g.d.msMax * P.nA * g.e + at(P.hypServ.msMax)) / R.Be];
    }
    return { xr: xr, Fes: g.d.esMin * P.nA, Fms: g.d.msMax * P.nA, As: As, ML: ML };
  }
  // Ferraillage de flexion transversale en travée (notice PSIDP p. 81 commentée) : facettes OX (My, N cos²ψ), OY (Mx, N sin²ψ),
  // OX0 (Mx cos²ψ + My sin²ψ, N = 0) ; face inférieure : moments max et N = F ES min / Be, face supérieure : moments min et
  // N = F MS max / Be. Section requise par ml = max(5e-4·H, yt·ft28/(2 fe)), yt = hauteur tendue de la section 1 m × HDAL1
  // (terme N_Bt/fe · ft28/σ_Bt du BPEL) — exact sur 2549 (OX0 : yt = H/2 → 0.25 H ft28/fe sur tout le corpus).
  function ferraillageTransversal(R, v, F) {
    if (!F.my || !F.prec || !F.prec.ML) return null;
    var H = v.HDAL1, ft = -R.limites.trEnrQC, fe = v.FE1 || 50000, s2 = Math.pow(Math.sin(gr(F.psi)), 2), c2 = 1 - s2;
    var req = function (M, N) {
      var sn = N / H, sm = 6 * Math.abs(M) / (H * H), st = sn - sm, yt = st >= 0 ? 0 : H * (-st) / (sn + sm - st);
      return Math.max(5e-4 * H, yt * ft / (2 * fe));
    };
    var mt = function (k) { var r = null; F.my.forEach(function (q) { if (r === null || (k === 'max' ? q.pond.max > r : q.pond.min < r)) r = q.pond[k]; }); return r; };
    var face = function (k, Mx, Nf) {
      var My = mt(k), o = { OX: { M: My, N: Nf * c2 }, OY: { M: Mx, N: Nf * s2 }, OX0: { M: Mx * c2 + My * s2, N: 0 } };
      for (var f in o) o[f].w = req(o[f].M, o[f].N);
      return o;
    };
    var inf = face('max', F.prec.ML[0], F.prec.Fes / R.Be), sup = face('min', F.prec.ML[1], F.prec.Fms / R.Be), sphi = Math.sin(gr(v.BIAIS));
    return { inf: inf, sup: sup, perp: { sup: sup.OX0.w, inf: inf.OX0.w }, par: { sup: sup.OX0.w / sphi, inf: inf.OX0.w / sphi }, longi: 5e-4 * H };
  }
  // Moments transversaux My au centre de la travée (guide PSIDP annexe 6 § 3.2.2 ; même module que PSIDA) :
  //   charges réparties My = p·A1·Σ Bm·Dm ; roulantes My = δ·P·A2·Σ Bm·Σμm.
  function momentsTransversaux(R, v, F, sp) {
    var W = R.largeurTot, h = 0.125, A1 = F.A1, A2 = F.A2, cl = R.classe;
    var sn = function (e) { return -W / 2 + Math.round((e + W / 2) / h - 1e-9) * h; };
    var x0r = -W / 2 + (v.ETROG || 0) + (v.EGAU || 0), x0 = sn(x0r), x1 = sn(x0r + v.ESURCH), Lch = v.ESURCH;
    var term = function (nom) { for (var i = 0; i < F.etal.length; i++) if (F.etal[i].nom === nom) return F.etal[i].t; return F.etal[0].t; };
    var etc = function (nom) { for (var i = 0; i < F.etal.length; i++) if (F.etal[i].nom === nom) return F.etal[i].c; return F.DB; };
    var trap = function (f, a, b) { var nn = Math.max(1, Math.round((b - a) / h)), t = 0; for (var i = 0; i <= nn; i++) t += (i === 0 || i === nn ? 0.5 : 1) * f(a + i * (b - a) / nn); return t * (b - a) / nn; };
    var intPL = function (f, a, b) {
      var o = -W / 2, g = function (e) { var k = Math.floor((e - o) / h + 1e-9), e0 = o + k * h, tt = (e - e0) / h; return tt < 1e-12 ? f(e0) : f(e0) * (1 - tt) + f(e0 + h) * tt; };
      var pts = [a], k; for (k = Math.ceil((a - o) / h - 1e-9); o + k * h < b - 1e-9; k++) if (o + k * h > a + 1e-9) pts.push(o + k * h); pts.push(b);
      var s = 0; for (var i = 0; i < pts.length - 1; i++) s += (g(pts[i]) + g(pts[i + 1])) / 2 * (pts[i + 1] - pts[i]); return s;
    };
    var dyn = R.dyn.travee[sp], nv = R.nv, V = Lch / nv;
    var bcN = function (nn) { var tb = BC[cl] || [1]; return tb[Math.min(nn, tb.length) - 1]; };
    var Ltr = R.L[sp], pr = F.prec;
    return F.fibres.map(function (fb) {
      var Z = function (B) { return function (e) { var s = 0; for (var j = 0; j < 3; j++) s += B[j] * fb.mus[j](e); return s; }; };
      var Zr = Z(term('CHARGE REPARTIE')), res = { n: fb.n }, be = R.Be / 2;
      res.cp = { max: R.cp.tot[1] / R.Be * A1 * intPL(Zr, -be, be), min: R.cp.tot[2] / W * A1 * trap(Zr, -W / 2, W / 2) };
      // précontrainte : poussée F·(A2+A3)/EDAL1 uniforme sur l'intrados (ES min → max, MS max → min) — écart 1 à 6 % NON RÉSOLU
      if (pr) { var Dp = intPL(Zr, -v.EDAL1 / 2, v.EDAL1 / 2), cst = -pr.As / v.EDAL1 * A1 * Dp; res.prec = { max: cst * pr.Fes, min: cst * pr.Fms }; }
      else res.prec = { max: 0, min: 0 };
      // charge A par voie
      var aMax = { v: 0, n: 0 }, aMin = { v: 0, n: 0 };
      if (R.loads.A) {
        var q = (R.loads.Agen ? Agen(v, Ltr) * (v.LVOIE || V) / V : A_l(Ltr) * R.v0 / V), lanes = [], k, msk;
        for (k = 0; k < nv; k++) lanes.push(q * A1 * trap(Zr, sn(x0r + k * V), sn(x0r + (k + 1) * V)));
        for (msk = 1; msk < (1 << nv); msk++) { var tt = 0, nn = 0; for (k = 0; k < nv; k++) if (msk & (1 << k)) { tt += lanes[k]; nn++; }
          var val = (R.loads.Agen ? (v['CDTA' + nn] || 1) : a1coef(cl, nn)) * tt; if (val > aMax.v + 1e-12) aMax = { v: val, n: nn }; if (val < aMin.v - 1e-12) aMin = { v: val, n: nn }; }
      }
      res.A = { max: aMax, min: aMin };
      // trottoirs : 0.45 t/m2 (charge locale), trottoir par trottoir
      var tr = [], pt = 0.45;
      if (R.loads.trot) {
        if (v.ETROG > 0) tr.push(pt * A1 * trap(Zr, -W / 2, sn(-W / 2 + v.ETROG)));
        if (v.ETROD > 0) tr.push(pt * A1 * trap(Zr, sn(W / 2 - v.ETROD), W / 2));
      }
      res.T = { max: tr.filter(function (x) { return x > 0; }).reduce(function (a, b) { return a + b; }, 0), min: tr.filter(function (x) { return x < 0; }).reduce(function (a, b) { return a + b; }, 0) };
      // systèmes B : groupes de véhicules accolés
      var groups = function (Zb, nMax, wV, wheels, coef, Pw, d) {
        var S = [], nn, kk, f, w;
        for (nn = 1; nn <= nMax; nn++) { S[nn] = []; for (kk = 0; x0 + kk * h <= x1 - nn * wV + 1e-9; kk++) { var x = x0 + kk * h, t2 = 0; for (f = 0; f < nn; f++) for (w = 0; w < wheels.length; w++) t2 += Zb(x + f * wV + wheels[w]); S[nn].push({ x: x, s: t2 }); } }
        var mx = { v: 0, n: 0 }, mn = { v: 0, n: 0 };
        for (nn = 1; nn <= nMax; nn++) S[nn].forEach(function (g) { var val = coef(nn) * Pw * A2 * d * g.s; if (val > mx.v) mx = { v: val, n: nn }; });
        for (var nL = 0; nL <= nMax; nL++) for (var nR = 0; nL + nR <= nMax; nR++) { if (!nL && !nR) continue;
          var GL = nL ? S[nL] : [{ x: x0 - 1e9, s: 0 }];
          GL.forEach(function (gl) { var xe = nL ? gl.x + nL * wV : x0; var GR = nR ? S[nR].filter(function (g) { return g.x >= xe - 1e-9; }) : [{ s: 0 }];
            GR.forEach(function (gr2) { var val = coef(nL + nR) * Pw * A2 * d * (gl.s + gr2.s); if (val < mn.v) mn = { v: val, n: nL + nR }; }); }); }
        return { max: mx, min: mn };
      };
      var none = { max: { v: 0, n: 0 }, min: { v: 0, n: 0 } }, bc = none, bt = none;
      if (R.loads.B) {
        bc = groups(Z(term('BC')), Math.min(nv, Math.max(1, Math.floor(Lch / 2.5))), 2.5, [0.25, 2.25], bcN, 12, dyn.bc);
        bt = groups(Z(term('BT')), Math.max(1, Math.min(2, nv, Math.floor((Lch + 1e-9) / 3))), 3, [0.5, 2.5], function () { return cl === 2 ? 0.9 : 1; }, 16, dyn.bc);
      }
      res.B = { max: bc.max.v >= bt.max.v ? { v: bc.max.v, n: bc.max.n, typ: 'BC' } : { v: bt.max.v, n: bt.max.n, typ: 'BT' },
        min: bc.min.v <= bt.min.v ? { v: bc.min.v, n: bc.min.n, typ: 'BC' } : { v: bt.min.v, n: bt.min.n, typ: 'BT' } };
      if (!res.B.max.v) res.B.max.typ = ''; if (!res.B.min.v) res.B.min.typ = '';
      // charges C
      var cMx = { v: 0, nom: '' }, cMn = { v: 0, nom: '' };
      var Cl = []; if (R.loads.CE) { Cl.push('CVOI.D'); Cl.push('CVOI.E'); } if (R.loads.MC120) Cl.push('MC.120'); if (R.loads.MC80) Cl.push('MC.80');
      Cl.forEach(function (nom) {
        var Zc = Z(term(nom)), mx = 0, mn = 0, kk;
        if (/^MC/.test(nom)) {
          var big = nom === 'MC.120', Pc = big ? 55 : 36, ent = big ? 3.25 : 2.75;
          var mean = function (a) { var t2 = 0; for (var i = 0; i <= 8; i++) t2 += (i === 0 || i === 8 ? 0.5 : 1) * Zc(a + i / 8); return t2 / 8; };
          for (kk = 0; x0 + kk * h <= x1 - (ent + 1) + 1e-9; kk++) { var x = x0 + kk * h, val = (big ? dyn.mc : dyn.mc) * Pc * A2 * (mean(x) + mean(x + ent)); mx = Math.max(mx, val); mn = Math.min(mn, val); }
        } else {
          var cv = nom === 'CVOI.D' ? { P: 140, len: 11 } : { P: 200, len: 15 }, w = 3.3, pc = cv.P / cv.len / w * Math.min(1, etc(nom) / F.DB), xc = (x0 + x1) / 2;
          [-0.375, 0.375].forEach(function (off) { var x = xc + off - w / 2, val = pc * A1 * trap(Zc, x, x + w); mx = Math.max(mx, val); mn = Math.min(mn, val); });
        }
        if (mx > cMx.v) cMx = { v: mx, nom: nom }; if (mn < cMn.v) cMn = { v: mn, nom: nom };
      });
      res.C = { max: cMx, min: cMn };
      // MY pondéré (ELS) = CP + P + trottoirs + max(1.2A, 1.2B, C) — constat 2549
      res.pond = { max: res.cp.max + res.prec.max + res.T.max + Math.max(1.2 * aMax.v, 1.2 * res.B.max.v, cMx.v),
        min: res.cp.min + res.prec.min + res.T.min + Math.min(1.2 * aMin.v, 1.2 * res.B.min.v, cMn.v) };
      return res;
    });
  }
  // prolongement linéaire au-delà du bord de la nervure (EDAL1/2), corde sur un pas de LI de 0.125 m mesuré perpendiculairement
  // à l'axe (soit 0.125/sin ψ sur la plaque) — exact sur 2549 (PSIDA : 0.125 sur la plaque, ouvrages peu biais)
  function FLEXT_H(sP) { return 0.125 / sP; }
  function FLEXT_EINT(v, sP) { return v.EDAL1 / 2 / sP; }

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

  // ============================================================= câblage automatique (CABL ≠ 4)
  // Règles reconstituées (voir NOTES.md « Câblage automatique ») : tracé de base, pertes approchées /
  // réajustées sur grille 0.1L, fuseau limite (contraintes BPEL, zones d'enrobage), nombres de câbles
  // (ouverture, inscription), paraboles limites T1/T2, tracé concordant (simplexe), transformation linéaire.

  // petit simplexe dense : max c.x, A x <= b, x >= 0 (b quelconque : phase 1 par variable artificielle)
  function lpMax(c, A, b) {
    var m = A.length, nv = c.length, i, j;
    // tableau avec variables d'écart ; lignes à b<0 multipliées par -1 avec artificielle
    var nArt = 0, rows = [];
    for (i = 0; i < m; i++) { var neg = b[i] < 0; rows.push({ a: A[i].map(function (x) { return neg ? -x : x; }), b: neg ? -b[i] : b[i], s: neg ? -1 : 1, art: neg }); if (neg) nArt++; }
    var N = nv + m + nArt, T = [], basis = [], ai = 0;
    for (i = 0; i < m; i++) {
      var r = new Array(N + 1).fill(0);
      for (j = 0; j < nv; j++) r[j] = rows[i].a[j];
      r[nv + i] = rows[i].s;
      if (rows[i].art) { r[nv + m + ai] = 1; basis.push(nv + m + ai); ai++; } else basis.push(nv + i);
      r[N] = rows[i].b; T.push(r);
    }
    var pivot = function (pr, pc) {
      var p = T[pr][pc], k; for (k = 0; k <= N; k++) T[pr][k] /= p;
      for (var q = 0; q < m; q++) if (q != pr && Math.abs(T[q][pc]) > 1e-15) { var f = T[q][pc]; for (k = 0; k <= N; k++) T[q][k] -= f * T[pr][k]; }
      basis[pr] = pc;
    };
    var run = function (obj, allowed) {
      for (var it = 0; it < 500; it++) {
        // coûts réduits
        var best = -1, bv = 1e-12;
        for (var col = 0; col < N; col++) {
          if (!allowed(col) || basis.indexOf(col) >= 0) continue;
          var rc = obj[col] || 0; for (var q = 0; q < m; q++) rc -= (obj[basis[q]] || 0) * T[q][col];
          if (rc > bv) { bv = rc; best = col; break; }
        }
        if (best < 0) return true;
        var pr = -1, rat = Infinity;
        for (var q2 = 0; q2 < m; q2++) if (T[q2][best] > 1e-12) { var rr = T[q2][N] / T[q2][best]; if (rr < rat - 1e-12) { rat = rr; pr = q2; } }
        if (pr < 0) return false;
        pivot(pr, best);
      }
      return true;
    };
    if (nArt) {
      var o1 = []; for (j = 0; j < N; j++) o1.push(j >= nv + m ? -1 : 0);
      run(o1, function () { return true; });
      for (i = 0; i < m; i++) if (basis[i] >= nv + m && T[i][N] > 1e-9) return null;
    }
    var o2 = []; for (j = 0; j < N; j++) o2.push(j < nv ? c[j] : 0);
    if (!run(o2, function (col) { return col < nv + m; })) return null;
    var x = new Array(nv).fill(0); for (i = 0; i < m; i++) if (basis[i] < nv) x[basis[i]] = T[i][N];
    return x;
  }

  // tracé fait de paraboles : segs [{from,to,A,B,C}] par travée (x local)
  function segEval(segs, x) { for (var i = 0; i < segs.length; i++) if (x <= segs[i].to + 1e-9) return segs[i]; return segs[segs.length - 1]; }
  function mkCable(spans) {
    return {
      spans: spans,
      z: function (t, x) { var s = segEval(spans[t], x); return s.A * x * x + s.B * x + s.C; },
      slope: function (t, x) { var s = segEval(spans[t], x); return 2 * s.A * x + s.B; }
    };
  }
  // parabole de sommet (x0, z0) et de coefficient a, sur [from, to]
  function parSeg(a, x0, z0, from, to) { return { A: a, B: -2 * a * x0, C: a * x0 * x0 + z0, from: from, to: to }; }

  // tracé de base / paraboles limites : points (ancrage, bas, appuis) ; côté appui intermédiaire : parabole
  // renversée de sommet sur l'appui sur la longueur t2 (fraction ou rayon imposé), raccord tangent au point bas.
  // opt.side(t, cote) -> { t2 } ou { R } ; défaut : double parabole à inflexion au milieu
  function traceFromPoints(R, P, opt) {
    var n = R.n, spans = [];
    for (var t = 0; t < n; t++) {
      var l = R.L[t], xl = P.xl[t], zl = P.zl[t], segs = [];
      [-1, 1].forEach(function (side) {
        var xe = side < 0 ? 0 : l, d = Math.abs(xe - xl), abut = (side < 0 && t === 0) || (side > 0 && t === n - 1);
        var ze = abut ? 0 : P.zs[side < 0 ? t : t + 1], h = ze - zl;
        if (abut) { segs.push(parSeg(h / (d * d), xl, zl, Math.min(xl, xe), Math.max(xl, xe))); return; }
        var t2 = d / 2, sd = opt && opt.side ? opt.side(t, side, d, h) : null;
        if (sd && sd.t2 !== undefined) t2 = sd.t2;
        if (sd && sd.R !== undefined) { t2 = h / d * 2 * sd.R; }
        t2 = Math.max(1e-6, Math.min(d - 1e-6, t2));
        var a2 = h / (d * t2), t1 = d - t2, a1 = a2 * t2 / t1, xt = xe - side * t2;
        segs.push(parSeg(a1, xl, zl, Math.min(xl, xt), Math.max(xl, xt)));
        segs.push(parSeg(-a2, xe, ze, Math.min(xt, xe), Math.max(xt, xe)));
      });
      segs.sort(function (p, q) { return p.from - q.from; });
      spans.push(segs);
    }
    return mkCable(spans);
  }

  function cablageAuto(R, v) {
    var n = R.n, L = R.L, S = R.section.S, I = R.section.I, V = R.section.V, VP = R.section.VP;
    var A = v.SECT * 1e-6, Phi = v.DGAIN, s0 = v.SIGMAP0, Lm = R.limites, H = v.HDAL1;
    if (!A || !s0 || !Phi || !R.sol) return null;
    var zs = V - v.COUVS - Phi / 2 - v.DECAL, zi = -VP + v.COUVI + Phi / 2 + v.DECAL;
    var Ep = v.EP, kfl = v.KFL * Ep / R.EI28, rt = v.RT === undefined ? 0.5 : v.RT, retr = R.retrait * Ep;
    var sec = function (t, k) { return R.sol[t].filter(function (s) { return Math.abs(s.x0 - k / 10) < 1e-9; })[0]; };
    var Mu = supportMomentsUniform(L, L.map(function () { return R.cp.oss[0]; }));
    var Moss = function (t, x) { var l = L[t]; return R.cp.oss[0] * x * (l - x) / 2 + Mu[t] * (1 - x / l) + Mu[t + 1] * x / l; };
    var ft28 = -Lm.trEnrQC;
    // ---------------------------------------------------------------- bornes du fuseau à une section
    var bounds = function (t, k, Tms, Tes, Ti, N) {
      var s = sec(t, k), c = s.comb, tp = s.tp || [0, 0], x = k / 10;
      var end = t === 0 ? 'L' : (t === n - 1 ? 'R' : null), lo = end === 'L' ? 0.3 : 0.4, hi = end === 'R' ? 0.7 : 0.6;
      var teH = x >= lo - 1e-9 && x <= hi + 1e-9, beH = (x >= 0.9 - 1e-9 && t < n - 1) || (x <= 0.1 + 1e-9 && t > 0);
      var MSmx = N * A * (1.02 * s0 - 0.8 * (s0 - Tms)), ESmn = N * A * (0.98 * s0 - 1.2 * (s0 - Tes)), TImx = N * A * (1.02 * s0 - 0.8 * (s0 - Ti));
      var cs = [];
      [MSmx, ESmn].forEach(function (p) {
        cs.push([p, s.cp[0] + tp[0], 0, Lm.trHors, Lm.comp], [p, s.cp[1] + tp[1], 0, Lm.trHors, Lm.comp]);
        [0, 1].forEach(function (q) { cs.push([p, c[q].qlqc, Lm.trEnrQC, Lm.trHorsQC, Lm.comp], [p, c[q].qlqcta, Lm.trEnrQC, Lm.trHorsQC, Lm.comp], [p, c[q].freq, 0, Lm.trHors, Lm.comp]); });
      });
      cs.push([TImx, s.oss[0], Lm.trEnrInit, Lm.trHorsInit, Infinity], [TImx, s.oss[1], Lm.trEnrInit, Lm.trHorsInit, Infinity]);
      var sup = Infinity, inf = -Infinity;
      cs.forEach(function (q) {
        var P = q[0], M = q[1];
        [[V, teH ? q[3] : q[2]], [-VP, beH ? q[3] : q[2]]].forEach(function (fz) {
          var z = fz[0], b = ((fz[1] - P / S) * I / z - M) / P;
          if (z > 0) inf = Math.max(inf, b); else sup = Math.min(sup, b);
          if (isFinite(q[4])) { var bc = ((q[4] - P / S) * I / z - M) / P; if (z > 0) sup = Math.min(sup, bc); else inf = Math.max(inf, bc); }
        });
      });
      return { sup: sup, inf: inf };
    };
    // ---------------------------------------------------------------- un bloc « éléments de détermination du fuseau »
    var Lt = R.X0[n];
    var block = function (N, base, kind, keyE, FMin) {
      var G = [], t, k;
      for (t = 0; t < n; t++) for (k = 0; k <= 10; k++) G.push({ t: t, k: k, x: k * L[t] / 10, X: R.X0[t] + k * L[t] / 10 });
      var segsAll = []; base.spans.forEach(function (S2, tt) { S2.forEach(function (sg) { segsAll.push({ a: sg.A, from: R.X0[tt] + sg.from, to: R.X0[tt] + sg.to }); }); });
      var angTo = function (X) { var a = 0; segsAll.forEach(function (sg) { var hi2 = Math.min(sg.to, X); if (hi2 > sg.from) a += 2 * Math.abs(sg.a) * (hi2 - sg.from); }); return a; };
      var r = v.PHI / v.F, Atot = angTo(Lt);
      G.forEach(function (g) { g.aG = angTo(g.X) + r * g.X; g.aD = Atot - angTo(g.X) + r * (Lt - g.X); g.t0G = s0 * Math.exp(-v.F * g.aG); g.t0D = s0 * Math.exp(-v.F * g.aD); });
      var U = G.filter(function (g) { return !(g.k === 0 && g.t > 0); });
      var ip = function (key, X) { var q = 0; while (q < U.length - 2 && X > U[q + 1].X) q++; var u = (X - U[q].X) / (U[q + 1].X - U[q].X); return U[q][key] * (1 - u) + U[q + 1][key] * u; };
      var recul = function (key, left) {
        var lo = 0, hi = Lt;
        for (var it = 0; it < 60; it++) {
          var sg = (lo + hi) / 2, ts = ip(key, left ? sg : Lt - sg), pts = [0];
          U.forEach(function (g) { var xx = left ? g.X : Lt - g.X; if (xx > 0 && xx < sg) pts.push(xx); }); pts.push(sg); pts.sort(function (p, q) { return p - q; });
          var sm = 0; for (var i = 0; i < pts.length - 1; i++) { var fa = ip(key, left ? pts[i] : Lt - pts[i]) - ts, fb = ip(key, left ? pts[i + 1] : Lt - pts[i + 1]) - ts; sm += (fa + fb) / 2 * (pts[i + 1] - pts[i]); }
          if (2 * sm > v.RECUL * Ep) hi = sg; else lo = sg;
        }
        return lo;
      };
      var sg = recul('t0G', true), tsg = ip('t0G', sg), sd = v.MOD === 0 ? recul('t0D', false) : null, tsd = sd !== null ? ip('t0D', Lt - sd) : 0;
      G.forEach(function (g) {
        var useG = v.MOD !== 0 || g.t0G >= g.t0D;
        g.dev = (useG ? g.aG : g.aD) * 200 / PI; g.T0 = useG ? g.t0G : g.t0D;
        g.bl = useG ? (g.X < sg ? 2 * (g.t0G - tsg) : 0) : (g.X > Lt - sd ? 2 * (g.t0D - tsd) : 0);
        g.e = base.z(g.t, g.x);
      });
      // raccourcissement élastique (NON RÉSOLU : approximation = Ep/2Eij x contrainte moyenne au niveau du câble)
      var sm = 0; U.forEach(function (g) { var F = N * A * (g.T0 - g.bl); sm += F / S + F * g.e * g.e / I + Moss(g.t, g.x) * g.e / I; });
      var dC = Math.max(0, Ep / (2 * R.EI) * sm / U.length);
      // fluage approché : « CALCUL ITERATIF DU FLUAGE » aux sections clés (FM : NON RÉSOLU, point fixe N.A.T∞ moyen)
      var tab = function (fl) {
        G.forEach(function (g) {
          g.Ti = g.T0 - g.bl - dC;
          g.rel = 6 / 100 * v.RO * (g.Ti / v.FPRG - v.MU0) * g.Ti;
          g.rect = -2 * g.rel * (retr + fl) / g.Ti;
          g.es = g.Ti - g.rel - retr - fl - g.rect; g.ms = g.Ti - rt * (g.Ti - g.es);
        });
      };
      var fluage = function (FM, rec) {
        var rows = [];
        keyE.forEach(function (ke) {
          var s = sec(ke.t, ke.k), tp = s.tp || [0, 0], E = ke.E, CPTM = (s.cp[0] + s.cp[1]) / 2;
          if (ke.abut) { var a1c = FM / S * (1 - 0.8 * E / V); rows.push(a1c); if (rec) rec[ke.id] = { sb: a1c, K: 3, SBB: 0, E: E, XM: 0, SM: 0, CPTM: 0, CPPM: 0, A1: a1c, A2: 0, A3: 0 }; return; }
          var top = ke.app, vv = top ? V : -VP, XM = top ? s.cp[1] + tp[1] : s.cp[0] + tp[0];
          var A1 = FM / S * (1 - 0.8 * E / vv);
          var cand = top ? [[-ft28, s.comb[1].qlqcta, 5]] : [[-ft28, s.comb[0].qlqcta, 5], [0, s.comb[0].freq, 3]], bst = null;
          cand.forEach(function (cd) { var sb = A1 + cd[0] * E / vv + (CPTM - cd[1]) * E / I; rows.push(sb);
            if (!bst || sb > bst.sb) bst = { sb: sb, K: cd[2], SBB: cd[0], E: E, XM: XM, SM: cd[1] - XM, CPTM: CPTM, CPPM: CPTM * R.cp.sup[0] / R.cp.tot[0], A1: A1, A2: cd[0] * E / vv, A3: (CPTM - cd[1]) * E / I }; });
          if (rec) rec[ke.id] = bst;
        });
        return kfl * Math.max.apply(null, rows);
      };
      var FM = FMin || N * A * 0.75 * s0, fl = fluage(FM);
      for (var it = 0; it < 30; it++) {
        tab(fl);
        var me = 0; U.forEach(function (g) { me += g.es; }); me /= U.length;
        var FM2 = FMin || N * A * me, fl2 = fluage(FM2);
        if (Math.abs(fl2 - fl) < 0.01) { fl = fl2; FM = FM2; break; }
        fl = fl2; FM = FM2;
      }
      tab(fl);
      var rec = {}; fluage(FM, rec);
      var mti = 0, mes = 0; U.forEach(function (g) { mti += g.Ti; mes += g.es; });
      G.forEach(function (g) { var b = bounds(g.t, g.k, g.ms, g.es, g.Ti, N); g.sup = b.sup; g.inf = b.inf; });
      return { N: N, kind: kind, G: G, dC: dC, fl: fl, FM: FM, FMJ: kind === 'REAJUSTEES' ? FM * mti / mes : 0, rec: rec, SG: sg, SD: sd !== null ? Lt - sd : null, base: base };
    };
    // nombres de câbles nécessaires (ouverture du fuseau, inscription dans la structure) avec les tensions du bloc
    var nombres = function (B) {
      var at = function (t, k, N) { var g = B.G[t * 11 + k]; return bounds(t, k, g.ms, g.es, g.Ti, N); };
      var open = function (N) { for (var t = 0; t < n; t++) for (var k = 0; k <= 10; k++) { var b = at(t, k, N); if (b.sup < b.inf) return false; } return true; };
      var N = 1; while (!open(N) && N < 200) N += 0.05;
      var lo = Math.max(0.5, N - 0.05), hi = N; for (var i = 0; i < 40; i++) { var m = (lo + hi) / 2; if (open(m)) hi = m; else lo = m; }
      var ouv = hi, ins = [];
      for (var t = 0; t < n; t++) {
        var f = function (Nn) {
          var ml = Infinity, xl = 0; for (var kk = 1; kk < 10; kk++) { var b = at(t, kk, Nn); if (b.sup < ml) { ml = b.sup; xl = kk / 10; } }
          var il = t === 0 ? null : at(t, 0, Nn).inf, ir = t === n - 1 ? null : at(t, 10, Nn).inf;
          if (il !== null && ir !== null) return (il + ir) / 2 - ml - (zs - zi);
          if (il === null && ir === null) return zi - ml;
          if (il === null) return (zi - ml) / xl - (zs - ir);
          return (zi - ml) / (1 - xl) - (zs - il);
        };
        var a = 0.5, b2 = 200; if (f(b2) > 0) { ins.push(NaN); continue; }
        for (var j = 0; j < 60; j++) { var mm = (a + b2) / 2; if (f(mm) > 0) a = mm; else b2 = mm; }
        ins.push(b2);
      }
      return { ouv: ouv, ins: ins, N: Math.ceil(Math.max.apply(null, [ouv].concat(ins.filter(isFinite))) - 1e-9) };
    };
    // point fixe sur N pour un type de bloc
    var solveN = function (N, base, kind, keyE) {
      var B, seen = {};
      for (var it = 0; it < 15; it++) {
        B = block(N, base, kind, keyE); var nb = nombres(B); B.nb = nb;
        if (nb.N === N || seen[nb.N]) break; seen[N] = 1; N = nb.N;
      }
      return B;
    };
    // ---------------------------------------------------------------- tracé de base n°1 et bloc approché
    var P1 = { xl: [], zl: [], zs: [] };
    for (var t = 0; t < n; t++) { var endS = t === 0 || t === n - 1; P1.xl.push((t === 0 ? 0.4 : (t === n - 1 ? 0.6 : 0.5)) * L[t]); P1.zl.push(endS ? -H / 6 : -H / 4); }
    for (var j = 0; j <= n; j++) P1.zs.push(j === 0 || j === n ? 0 : zs);
    var base1 = traceFromPoints(R, P1);
    var key1 = [];
    for (t = 0; t < n; t++) { key1.push({ id: 'b' + t, t: t, k: Math.round(P1.xl[t] / L[t] * 10), E: zi }); if (t < n - 1) key1.push({ id: 'a' + (t + 1), t: t, k: 10, E: zs, app: true }); }
    var N0 = Math.max(1, Math.round(v.NCA || 0)) || 10;
    var BA = solveN(N0, base1, 'APPROCHEES', key1);
    // ---------------------------------------------------------------- tracé de base n°2 (points du fuseau) et bloc réajusté
    var basePts = function (B) {
      var Pp = { xl: [], zl: [], zs: [] }, kl = [];
      for (var t2 = 0; t2 < n; t2++) {
        var bk = 1; for (var kk = 1; kk < 10; kk++) if (B.G[t2 * 11 + kk].sup < B.G[t2 * 11 + bk].sup - 1e-12) bk = kk;
        Pp.xl.push(bk * L[t2] / 10); Pp.zl.push(B.G[t2 * 11 + bk].sup); kl.push(bk);
      }
      for (var jj = 0; jj <= n; jj++) Pp.zs.push(jj === 0 || jj === n ? 0 : B.G[(jj - 1) * 11 + 10].inf);
      Pp.kl = kl; return Pp;
    };
    var P2 = basePts(BA), base2 = traceFromPoints(R, P2), key2 = [{ id: 'c', t: 0, k: 0, E: BA.G[0].inf, abut: true }];
    for (t = 0; t < n; t++) { key2.push({ id: 'b' + t, t: t, k: P2.kl[t], E: P2.zl[t] }); if (t < n - 1) key2.push({ id: 'a' + (t + 1), t: t, k: 10, E: P2.zs[t + 1], app: true }); }
    var BR = solveN(BA.N, base2, 'REAJUSTEES', key2);
    // tentative de tracé concordant pour un bloc réajusté donné et un décalage dz des points de passage sur appuis
    var attempt = function (BR, Nr, dz) {
      // ---------------------------------------------------------------- paraboles limites
      var P3 = basePts(BR); P3.zs = P3.zs.map(function (z, jj) { return (jj === 0 || jj === n) ? z : z + dz; }); var gsup = function (t, k) { return BR.G[t * 11 + k].sup; }, ginf = function (t, k) { return BR.G[t * 11 + k].inf; };
      // T1 : point bas sur le bord supérieur ; côté appui : la plus grande longueur de raccord (<= 0.36 d) restant sous le bord sup.
      var T1 = traceFromPoints(R, P3, { side: function (tt, side, d, h) {
        var best = 0.05 * d;
        for (var f = 0.36; f >= 0.05; f -= 0.0025) {
          var tr = traceFromPoints(R, P3, { side: function (t3, s3, d3) { return (t3 === tt && s3 === side) ? { t2: f * d3 } : { t2: 0.05 * d3 }; } }), ok = true;
          for (var kk = 1; kk < 10; kk++) { var xx = kk * L[tt] / 10; if ((side < 0 ? xx < P3.xl[tt] : xx > P3.xl[tt]) && tr.z(tt, xx) > gsup(tt, kk) + 1e-9) ok = false; }
          if (ok) { best = f * d; break; }
        }
        return { t2: best };
      } });
      // T2 : rayon minimal sur appuis, point bas sur le bord inférieur relevé si nécessaire pour rester au-dessus du bord inf.
      var P4 = { xl: P3.xl.slice(), zl: P3.xl.map(function (x, tt) { return ginf(tt, P3.kl[tt]); }), zs: P3.zs.slice() };
      var rminSide = function () { return { R: v.RMIN || 8 }; };
      for (t = 0; t < n; t++) {
        for (var it2 = 0; it2 < 200; it2++) {
          var tr2 = traceFromPoints(R, P4, { side: rminSide }), ok2 = true;
          for (var kk2 = 1; kk2 < 10; kk2++) if (tr2.z(t, kk2 * L[t] / 10) < ginf(t, kk2) - 1e-9) ok2 = false;
          if (ok2) break; P4.zl[t] += 0.002;
        }
      }
      var T2 = traceFromPoints(R, P4, { side: rminSide });
      // ---------------------------------------------------------------- hyperstatiques des tracés limites (Simpson, F moyen de service)
      var W = simpsonW(10, 1);
      var d2 = function (t, k, j) { var cc = R.liAppuis[j - 1][t], xr = k / 10; return (6 * cc.A * xr + 2 * cc.B) / (L[t] * L[t]); };
      var Fm = function (t, k) { return Nr * A * BR.G[t * 11 + k].es; };
      var hypSpan = function (tr, t) {
        var out = []; for (var jj = 1; jj < n; jj++) { var s = 0; for (var kk = 0; kk <= 10; kk++) s += W[kk] * L[t] / 10 * Fm(t, kk) * tr.z(t, kk * L[t] / 10) * d2(t, kk, jj); out.push(-s); }
        return out;
      };
      var H1 = [], H2 = [];
      for (t = 0; t < n; t++) { H1.push(hypSpan(T1, t)); H2.push(hypSpan(T2, t)); }
      var Mat = [], Rv = [];
      for (j = 1; j < n; j++) {
        var row = [], tot = 0; for (t = 0; t < n; t++) { row.push(H2[t][j - 1] - H1[t][j - 1]); tot += H1[t][j - 1]; }
        Mat.push(row); Rv.push(-tot);
      }
      // tracé concordant : Mat.lambda = R, 0 <= lambda <= 1 (simplexe ; objectif : max somme des lambda)
      var lam = null;
      (function () {
        var Aq = [], bq = [];
        Mat.forEach(function (rw, q) { Aq.push(rw.slice()); bq.push(Rv[q] + 2e-3 * Math.abs(Rv[q]) + 1e-3); Aq.push(rw.map(function (x) { return -x; })); bq.push(-Rv[q] + 2e-3 * Math.abs(Rv[q]) + 1e-3); });
        for (var k3 = 0; k3 < n; k3++) { var e1 = new Array(n).fill(0); e1[k3] = 1; Aq.push(e1); bq.push(1); }
        if (v.SYM === 1) for (var k5 = 0; k5 < Math.floor(n / 2); k5++) { var e2 = new Array(n).fill(0); e2[k5] = 1; e2[n - 1 - k5] = -1; Aq.push(e2); bq.push(1e-9); Aq.push(e2.map(function (x) { return -x; })); bq.push(1e-9); }
        lam = lpMax(new Array(n).fill(1), Aq, bq);
      })();

      return { P3: P3, P4: P4, T1: T1, T2: T2, H1: H1, H2: H2, Mat: Mat, Rv: Rv, lam: lam, Fm: Fm, d2: d2, BR: BR, N: Nr, dz: dz };
    };
    // itérations : décalage vers le haut des points sur appuis (pas 0.01 m jusqu'au bord sup du fuseau), puis +1 câble (max +4)
    var st = null, BAk = BA, BRk = BR, Nr = BR.N, MAXPLUS = 0, DZMAX = 0;
    for (var plus = 0; plus <= MAXPLUS && !(st && st.lam); plus++) {
      if (plus > 0) { Nr = BR.N + plus; BAk = block(Nr, base1, 'APPROCHEES', key1); BAk.nb = nombres(BAk);
        var P2k = basePts(BAk); BRk = block(Nr, traceFromPoints(R, P2k), 'REAJUSTEES', key2); BRk.nb = nombres(BRk); }
      var room = Infinity; for (var jj = 1; jj < n; jj++) { var gg = BRk.G[(jj - 1) * 11 + 10]; room = Math.min(room, gg.sup - gg.inf); }
      for (var dz = 0; dz <= Math.min(DZMAX, Math.max(0, room)) + 1e-9; dz += 0.01) { st = attempt(BRk, Nr, dz); if (st.lam) break; }
      if (!st.lam && plus === MAXPLUS) st = attempt(BR, BR.N, 0);
    }
    if (!st.lam) { Nr = BR.N; BAk = BA; BRk = BR; }
    BA = BAk; BR = BRk;
    var P3 = st.P3, P4 = st.P4, T1 = st.T1, T2 = st.T2, H1 = st.H1, H2 = st.H2, Mat = st.Mat, Rv = st.Rv, lam = st.lam, Fm = st.Fm, d2 = st.d2;
    var concordant = !!lam;
    if (!lam) { // NON RÉSOLU : itérations de décalage / câbles supplémentaires ; à défaut, moindres carrés bornés
      lam = new Array(n).fill(0.5);
      for (var it3 = 0; it3 < 400; it3++) {
        for (var k4 = 0; k4 < n; k4++) {
          var num = 0, den = 0;
          Mat.forEach(function (rw, q) { var r0 = Rv[q]; rw.forEach(function (x, kk) { if (kk !== k4) r0 -= x * lam[kk]; }); num += rw[k4] * r0; den += rw[k4] * rw[k4]; });
          if (den > 0) lam[k4] = Math.max(0, Math.min(1, num / den));
        }
      }
    }
    // combinaison T1 + lambda (T2 - T1), segment par segment (bornes réunies)
    var combo = [];
    for (t = 0; t < n; t++) {
      var br = []; T1.spans[t].concat(T2.spans[t]).forEach(function (sg) { br.push(sg.from, sg.to); });
      br = br.sort(function (p, q) { return p - q; }).filter(function (x, i, a) { return i === 0 || x - a[i - 1] > 1e-7; });
      var sgs = [];
      for (var b3 = 0; b3 < br.length - 1; b3++) {
        var xm = (br[b3] + br[b3 + 1]) / 2, s1 = segEval(T1.spans[t], xm), s2 = segEval(T2.spans[t], xm), lm = lam[t];
        sgs.push({ from: br[b3], to: br[b3 + 1], A: s1.A + lm * (s2.A - s1.A), B: s1.B + lm * (s2.B - s1.B), C: s1.C + lm * (s2.C - s1.C) });
      }
      combo.push(sgs);
    }
    var before = mkCable(combo);
    // transformation linéaire : décalages d_j sur appuis intermédiaires maximisant la plus petite marge
    // (appuis : zs - e ; points bas : e - zi)
    var nd = n - 1, cons = [], bb = [];
    for (j = 1; j < n; j++) { var rw2 = new Array(2 * nd + 1).fill(0); rw2[j - 1] = 1; rw2[nd + j - 1] = -1; rw2[2 * nd] = 1; cons.push(rw2); bb.push(zs - before.z(j - 1, L[j - 1])); }
    for (t = 0; t < n; t++) {
      var xr = P3.xl[t] / L[t], rw3 = new Array(2 * nd + 1).fill(0), el = before.z(t, P3.xl[t]);
      if (t > 0) { rw3[t - 1] -= (1 - xr); rw3[nd + t - 1] += (1 - xr); }
      if (t < n - 1) { rw3[t] -= xr; rw3[nd + t] += xr; }
      rw3[2 * nd] = 1; cons.push(rw3); bb.push(el - zi);
    }
    // variables : d+ (nd), d- (nd), m >= 0 (marge décalée de +10 pour rester positive)
    var shift = 10; bb = bb.map(function (x) { return x + shift; });
    var cobj = new Array(2 * nd + 1).fill(0); cobj[2 * nd] = 1;
    var sol = lpMax(cobj, cons, bb), dj = [0];
    for (j = 1; j < n; j++) dj.push(sol ? sol[j - 1] - sol[nd + j - 1] : 0);
    dj.push(0);
    var after = mkCable(combo.map(function (sgs, t5) {
      var l = L[t5], a0 = dj[t5], a1 = dj[t5 + 1], sl = (a1 - a0) / l;
      return sgs.map(function (sg) { return { from: sg.from, to: sg.to, A: sg.A, B: sg.B + sl, C: sg.C + a0 }; });
    }));
    // câble des pertes : parabole principale de travée + parabole d'appui (sommet sur l'appui, raccord tangent)
    var loss = [];
    for (t = 0; t < n; t++) {
      var l6 = L[t], xl6 = P3.xl[t], sgs6 = after.spans[t];
      var main = function (side) { var xx = xl6 + side * 1e-6; return segEval(sgs6, xx); };
      var out6 = [];
      [-1, 1].forEach(function (side) {
        var abut = (side < 0 && t === 0) || (side > 0 && t === n - 1), m6 = main(side), xe = side < 0 ? 0 : l6;
        if (abut) { out6.push({ A: m6.A, B: m6.B, C: m6.C, from: Math.min(xe, xl6), to: Math.max(xe, xl6) }); return; }
        var ze = after.z(t, xe);
        // z_m(x) = ze - a (x - xe)^2, tangence : résolution en x_t
        var u = xe, Am = m6.A, Bm = m6.B, Cm = m6.C;
        // z_m(x) - ze + (zm'(x)/(2(x-xe)))(x-xe)^2 = 0 -> Am x^2 + Bm x + Cm - ze - (2Am x + Bm)(x - u)/2 = 0
        // => (Bm u/2 + Am x u) ... linéaire en x : Bm x/2 + Am u x + Cm - ze + Bm u/2 = 0
        var xt = -(Cm - ze + Bm * u / 2) / (Bm / 2 + Am * u);
        var a6 = -(2 * Am * xt + Bm) / (2 * (xt - u));
        out6.push({ A: Am, B: Bm, C: Cm, from: Math.min(xl6, xt), to: Math.max(xl6, xt) });
        out6.push({ A: -a6, B: 2 * a6 * u, C: ze - a6 * u * u, from: Math.min(xt, xe), to: Math.max(xt, xe) });
      });
      out6.sort(function (p, q) { return p.from - q.from; });
      loss.push(out6);
    }
    var cable = mkCable(loss); cable.ecart = 0;
    var Hs = function (HH) { var o = []; for (var jj = 0; jj < n - 1; jj++) { var sm2 = 0; HH.forEach(function (h) { sm2 += h[jj]; }); o.push(sm2); } return o; };
    return { N: Nr, cable: cable, blocks: [BA, BR], P2: P2, H1tot: Hs(H1), H2tot: Hs(H2), keyFl: function (e) { return null; }, T1: T1, T2: T2, P3: P3, P4: P4, H1: H1, H2: H2, Mat: Mat, Rv: Rv, lambda: lam, concordant: concordant,
      before: before, after: after, dj: dj, zs: zs, zi: zi, Fm: Fm, d2: d2 };
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
    var sc = R.section.calc, VP = sc.VP, Vs = sc.V, Ib = R.section.I, Sb = R.section.S;
    var cab, ND, imp = v.CABL === 4;
    if (imp) {
      if (!model.cotes || !model.cotes.values || !P.N) return P;
      cab = fitCableImpose(L, model.cotes.values, VP, v.RMIN || 0); ND = R.ND;
    } else {
      // câblage automatique : tracé et nombre de câbles déterminés par cablageAuto (fuseau limite, simplexe)
      var au = model.__cable || cablageAuto(R, v);
      if (!au || !au.cable) { P.auto = au; return P; }
      P.auto = au; cab = au.cable; P.N = au.N; ND = L.map(function () { return 10; });
      P.Sn = R.section.S - P.N * P.Sg; P.coefI = P.N * P.Sg; P.nA = P.N * v.SECT * 1e-6;
    }
    var Sn = P.Sn, nA = P.nA;
    P.ND = ND;
    P.cable = cab;
    var slope = function (X) { var t = 0; while (t < n - 1 && X > R.X0[t + 1] + 1e-9) t++; return cab.slope(t, X - R.X0[t]); };
    var ti = tensionsInitiales(R, v, slope, ND);
    P.SG = ti.SG; P.SD = ti.SD;
    // grille par travée (avec doublons aux appuis) ; index global dans ti.pts
    var G = [], off = [0], t, k;
    for (t = 0; t < n; t++) off.push(off[t] + ND[t]);
    var Lt = R.X0[n], sym = v.SYM === 1;
    for (t = 0; t < n; t++) for (k = 0; k <= ND[t]; k++) {
      var x = k * L[t] / ND[t], c = imp ? model.cotes.values[t] : null;
      var e = (imp && c && c.length - 1 === ND[t]) ? c[k] - VP : cab.z(t, x);
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
    var W = L.map(function (l, tt) { return simpsonW(ND[tt], l / ND[tt]); });
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
    if (!imp && P.auto && P.auto.P3) {
      // fluage approché du câble retenu : « CALCUL ITERATIF DU FLUAGE » (σb max aux sections clés, FM = N.A.T∞ moyen : NON RÉSOLU)
      var kfl = v.KFL * v.EP / R.EI28, keys = [], rec = {};
      for (j = 0; j < n; j++) { keys.push({ id: 'b' + j, t: j, k: P.auto.P3.kl[j] }); if (j < n - 1) keys.push({ id: 'a' + (j + 1), t: j, k: 10, app: true }); }
      var fl2 = function (FM) {
        var mx = -Infinity;
        keys.forEach(function (ke) {
          var g = G.filter(function (q) { return q.t === ke.t && q.k === ke.k; })[0], s = R.sol[ke.t].filter(function (q) { return Math.abs(q.x0 - ke.k / 10) < 1e-9; })[0];
          var tp = s.tp || [0, 0], E = g.e, CPTM = (s.cp[0] + s.cp[1]) / 2, top = ke.app, vv = top ? Vs : -VP, XM = top ? s.cp[1] + tp[1] : s.cp[0] + tp[0];
          var A1 = FM / Sb * (1 - 0.8 * E / vv), cand = top ? [[-ft28, s.comb[1].qlqcta, 5]] : [[-ft28, s.comb[0].qlqcta, 5], [0, s.comb[0].freq, 3]], bst = null;
          cand.forEach(function (cd) { var sb = A1 + cd[0] * E / vv + (CPTM - cd[1]) * E / Ib; if (!bst || sb > bst.sb) bst = { sb: sb, K: cd[2], SBB: cd[0], E: E, XM: XM, SM: cd[1] - XM, CPTM: CPTM, CPPM: CPTM * R.cp.sup[0] / R.cp.tot[0], A1: A1, A2: cd[0] * E / vv, A3: (CPTM - cd[1]) * E / Ib }; });
          rec[ke.id] = bst; mx = Math.max(mx, bst.sb);
        });
        return kfl * mx;
      };
      var FMf = 0, FMJ = 0;
      for (it = 0; it < 40; it++) {
        var mT = 0, mI = 0; uniq.forEach(function (g) { var q = los(g, dC, dFl); mT += q.infini; mI += q.proba; }); mT /= uniq.length; mI /= uniq.length;
        FMf = nA * mT; FMJ = nA * mI; var nf = fl2(FMf); if (Math.abs(nf - dFl) < 0.01) { dFl = nf; break; } dFl = nf;
      }
      P.flBlock = { FM: FMf, FMJ: FMJ, rec: rec };
    }
    // diagnostic (dev/ uniquement) : forcer ΔC / fluage approché pour isoler les pertes
    if (model.__diag) { if (model.__diag.dC != null) dC = model.__diag.dC; if (model.__diag.dFl != null) dFl = model.__diag.dFl; }
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
      var s = (R.sol[g.t] || []).filter(function (q) { return Math.abs(q.x0 - g.k / ND[g.t]) < 1e-9; })[0];
      var zz = [Vs, -VP], In = g.In;
      var sm = function (M) { return zz.map(function (z) { return M * z / In; }); };
      var sp = function (T, Mh) { var F = T * nA, mh = at(Mh, g); return zz.map(function (z) { return F / Sn + (F * g.e + mh) * z / In; }); };
      var o = { MO: sm(g.MO), MOx: sm(Math.max(g.MO * v.OSSAX, g.MO * v.OSSAN)), MOn: sm(Math.min(g.MO * v.OSSAX, g.MO * v.OSSAN)), Pi: sp(g.p.proba, HI.moy), Px: sp(g.p.maxi, HI.max),
        MG: sm(g.MG), Pms: sp(g.d.msMoy, H.msMoy), PmsX: sp(g.d.msMax, H.msMax), Pes: sp(g.d.esMoy, H.esMoy), PesN: sp(g.d.esMin, H.esMin) };
      if (s) {
        var tp = s.tp || [0, 0];
        o.QLx = sm(s.cp[0] + tp[0]); o.QLn = sm(s.cp[1] + tp[1]);
        o.qcx = sm(s.comb[0].qlqc); o.qcn = sm(s.comb[1].qlqc); o.frx = sm(s.comb[0].freq); o.frn = sm(s.comb[1].freq);
        o.tax = sm(s.comb[0].qlqcta); o.tan = sm(s.comb[1].qlqcta);
      }
      g.sig = o;
    });
    // --- section 27 : sections supplémentaires (règle empirique, NON RÉSOLU en toute rigueur) : minimum local de la
    // contrainte de la fibre inférieure (1)+(4) à moins de 0.09L d'un appui intermédiaire (seuil empirique)
    P.extraMT = [];
    var MuO2 = Mu(R.cp.oss[0]);
    for (t = 0; t < n; t++) {
      var gs = G.filter(function (g) { return g.t === t; }), Nd = ND[t], l = L[t];
      var lin = function (f, x) { var u = x / l * Nd, i = Math.min(Nd - 1, Math.floor(u)), w = u - i; return f(gs[i]) * (1 - w) + f(gs[i + 1]) * w; };
      var sgx = function (x) {
        var e = cab.z(t, x), In = Ib - P.coefI * e * e, F = lin(function (g) { return g.p.proba; }, x) * nA, Fx = lin(function (g) { return g.p.maxi; }, x) * nA;
        var mh = HI.moy[t] * (1 - x / l) + HI.moy[t + 1] * x / l, mhx = HI.max[t] * (1 - x / l) + HI.max[t + 1] * x / l;
        var mo = R.cp.oss[0] * x * (l - x) / 2 + MuO2[t] * (1 - x / l) + MuO2[t + 1] * x / l;
        var zz = [Vs, -VP], sm2 = function (M) { return zz.map(function (z) { return M * z / In; }); };
        var spp = function (FF, Mh2) { return zz.map(function (z) { return FF / Sn + (FF * e + Mh2) * z / In; }); };
        return { MO: sm2(mo), MOx: sm2(Math.max(mo * v.OSSAX, mo * v.OSSAN)), MOn: sm2(Math.min(mo * v.OSSAX, mo * v.OSSAN)), Pi: spp(F, mh), Px: spp(Fx, mhx) };
      };
      var zones = []; if (t > 0) zones.push([0, 0.09 * l]); if (t < n - 1) zones.push([0.91 * l, l]);
      zones.forEach(function (zn) {
        var M2 = 400, best = null, vals = [];
        for (var i = 0; i <= M2; i++) { var x = zn[0] + (zn[1] - zn[0]) * i / M2, o2 = sgx(x); vals.push([x, o2.MO[1] + o2.Pi[1]]); }
        for (i = 1; i < M2; i++) if (vals[i][1] < vals[i - 1][1] && vals[i][1] < vals[i + 1][1]) best = vals[i][0];
        if (best !== null) { var o3 = sgx(best); o3.t = t; o3.x = best; o3.X = R.X0[t] + best; o3.lab = best / l; P.extraMT.push(o3); }
      });
    }
    // --- déformées dues à la précontrainte (section 38) : courbure (F.e + M_hyp)/(E.IG), F et e linéaires entre
    // points de grille, double intégration par travée (flèche nulle sur appuis). Instantanée : F initiale moy., Eij ;
    // fluage : F en service moy. (E.S), EF. Vérifié à ±0.1 mm sur 2549 (forme légèrement différente : NON RÉSOLU).
    var deflP = function (t, Mk, EI) {
      var l = L[t], N = ND[t], S = 2000, h = l / S, th = [0], w = [0], i;
      var M = function (x) { var u = x / l * N, ii = Math.min(N - 1, Math.floor(u)), f = u - ii; return Mk[ii] * (1 - f) + Mk[ii + 1] * f; };
      for (i = 1; i <= S; i++) th.push(th[i - 1] + M((i - 0.5) * h) / EI * h);
      for (i = 1; i <= S; i++) w.push(w[i - 1] + (th[i - 1] + th[i]) / 2 * h);
      var cc = w[S] / l, out = [];
      for (var q = 0; q <= 10; q++) out.push((w[Math.round(q / 10 * S)] - cc * q / 10 * l) * 1000);
      out.rg = (th[0] - cc) * 1000; out.rd = (th[S] - cc) * 1000;
      return out;
    };
    P.defl = { inst: [], flu: [], eps: [] };
    for (t = 0; t < n; t++) {
      var gt = G.filter(function (g) { return g.t === t; });
      P.defl.inst.push(deflP(t, gt.map(function (g) { return g.p.proba * nA * g.e + at(HI.moy, g); }), R.EI * Ib));
      P.defl.flu.push(deflP(t, gt.map(function (g) { return g.d.esMoy * nA * g.e + at(H.esMoy, g); }), R.EF * Ib));
      // allongement relatif de la fibre moyenne (x1e4) : instantané -F_moy/(Sn.Eij) ; total -(retrait + F_ES moy/(Sn.EF))
      var fi = 0, fe = 0; gt.forEach(function (g) { fi += g.p.proba * nA; fe += g.d.esMoy * nA; }); fi /= gt.length; fe /= gt.length;
      P.defl.eps.push([-fi / Sn / R.EI * 1e4, -(R.retrait + fe / Sn / R.EF) * 1e4]);
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
      out.rg = (th[0] - c) * 1000; out.rd = (th[N] - c) * 1000;   // rotations sur appuis (rad x 1e3)
      return out;
    });
  }
  // flèches / rotations d'une travée j d'une poutre continue : moments sur appuis Ms (n+1), moment isostatique Mf(x)
  function deflSpan(L, j, Ms, Mf, EI) {
    var l = L[j], N = 2000, h = l / N, th = [0], w = [0], i;
    var M = function (x) { return Mf(x) + Ms[j] * (1 - x / l) + Ms[j + 1] * x / l; };
    for (i = 1; i <= N; i++) th.push(th[i - 1] + M((i - 0.5) * h) / EI * h);
    for (i = 1; i <= N; i++) w.push(w[i - 1] + (th[i - 1] + th[i]) / 2 * h);
    var c = w[N] / l, out = [];
    for (var q = 0; q <= 10; q++) out.push((w[q * N / 10] - c * q / 10 * l) * 1000);
    out.rg = (th[0] - c) * 1000; out.rd = (th[N] - c) * 1000;
    return out;
  }
  // déformées sous charges d'exploitation (section 38 suite) : chaque travée chargée seule, module EI28, sans K ni biais.
  // A : A(L_j)·a1·nv·v0 sur toute la travée ; 48T : 2 voies x 24 t concentrées au milieu de la travée (notice p. 89).
  function liveDefl(R, v) {
    var L = R.L, n = R.n, EI = R.EI28 * R.section.I, res = [];
    var full = function (Ms) { return Ms.length === n + 1 ? Ms : [0].concat(Ms, [0]); };
    for (var j = 0; j < n; j++) {
      var lj = L[j], q = R.loads && R.loads.Agen ? Agen(v, lj) * v.LVOIE * R.nv * (v['CDTA' + R.nv] || 1) : A_l(lj) * R.v0 * R.nv * a1coef(R.classe, R.nv);
      var Mu = full(supportMomentsUniform(L, L.map(function (_, s) { return s === j ? q : 0; })));
      var Mp = full(supportMomentsUnitForce(L, j, 0.5)).map(function (m) { return 48 * m; });
      var rowA = [], rowP = [];
      for (var t = 0; t < n; t++) {
        rowA.push(deflSpan(L, t, Mu, t === j ? function (x) { return q * x * (lj - x) / 2; } : function () { return 0; }, EI));
        rowP.push(deflSpan(L, t, Mp, t === j ? function (x) { return 48 * (x <= lj / 2 ? x / 2 : (lj - x) / 2); } : function () { return 0; }, EI));
      }
      res.push({ A: rowA, P: rowP });   // res[travée chargée].A[travée observée]
    }
    return res;
  }

  var api = {
    compute: compute, sectionBrute: sectionBrute, guyonK: guyonK, supportMomentsUniform: supportMomentsUniform,
    supportMomentsUnitForce: supportMomentsUnitForce, threeMoments: threeMoments, tensionsInitiales: tensionsInitiales, pertes: pertes
  };
  root.PSIDP_COMPUTE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
