/* CEDYPIA — tests node (node tools/test-outils-cedypia.js).
 * Pas d'exemple d'origine : ce module n'existait pas dans la version 2015 possédée par l'utilisateur.
 * Les tests sont analytiques (solutions fermées indépendantes du moteur) + valeurs réglementaires recalculées à la main. */
const C = require('../outils/js/cedypia.js');
let f = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-30, Math.abs(b));
const PI = Math.PI;

/* 1. fréquence poutre isostatique : f1 = π/(2L²)·√(EI/m) — solution analytique et éléments finis */
{
  const L = 20, EI = 3.2e7, m = 16; // kN·m², t/m
  const f1 = PI / (2 * L * L) * Math.sqrt(EI / m);
  const a = C.modes([{ L, EI, m }]), e = C.modes([{ L, EI, m }], { forceEF: true });
  ok(rel(a.freq[0], f1) < 1e-12, `f1 analytique ${a.freq[0].toFixed(4)} Hz = π/(2L²)√(EI/m) = ${f1.toFixed(4)}`);
  ok(rel(e.freq[0], f1) < 1e-6, `f1 éléments finis ${e.freq[0].toFixed(5)} Hz (écart ${(rel(e.freq[0], f1) * 100).toExponential(1)} %)`);
  ok(rel(e.freq[1], 4 * f1) < 1e-4 && rel(e.freq[2], 9 * f1) < 1e-3, `f2 = 4 f1, f3 = 9 f1 (EF : ${(e.freq[1] / f1).toFixed(4)}, ${(e.freq[2] / f1).toFixed(4)})`);
  // normalisation φᵀMφ = 1 : ∫ m φ² dx = 1, et forme modale EF = √(2/mL) sin(πx/L)
  const o = new Float64Array(e.nModes), oa = new Float64Array(a.nModes);
  let s = 0; const n = 2000; for (let k = 0; k < n; k++) { const x = (k + 0.5) * L / n; e.eval(x, o); s += m * o[0] * o[0] * L / n; }
  e.eval(7.3, o); a.eval(7.3, oa);
  ok(Math.abs(s - 1) < 1e-4 && rel(o[0], oa[0]) < 1e-5, `mode EF normé (∫mφ² = ${s.toFixed(6)}), φ1(7,3) = ${o[0].toFixed(6)} / analytique ${oa[0].toFixed(6)}`);
}
/* 2. deux travées égales : f1 = f1 isostatique ; f2 : λ2·L = 3,9266 (encastré-appuyé) */
{
  const L = 18, EI = 2e7, m = 12, md = C.modes([{ L, EI, m }, { L, EI, m }]);
  const f1 = PI / (2 * L * L) * Math.sqrt(EI / m), f2 = Math.pow(3.926602, 2) / (2 * PI * L * L) * Math.sqrt(EI / m);
  ok(rel(md.freq[0], f1) < 1e-5, `2 travées : f1 ${md.freq[0].toFixed(4)} Hz = isostatique ${f1.toFixed(4)}`);
  ok(rel(md.freq[1], f2) < 1e-4, `2 travées : f2 ${md.freq[1].toFixed(4)} Hz = (3,9266/L)²√(EI/m)/2π = ${f2.toFixed(4)}`);
  ok(md.fmax >= 30 && md.freq[md.nModes - 1] <= md.fmax + 1e-9, `modes retenus jusqu'à ${md.fmax.toFixed(1)} Hz : ${md.nModes} modes`);
}
/* 3. flèche statique sous charge unique */
{
  const L = 16, EI = 1.5e7, P = 200;
  const li = C.influence([{ L, EI, m: 10 }], L / 2);
  ok(rel(P * li.at(L / 2), P * L ** 3 / (48 * EI)) < 1e-9, `flèche isostatique PL³/48EI = ${(P * L ** 3 / 48 / EI * 1000).toFixed(4)} mm`);
  const a = 5, b = L - a, xp = 8;
  ok(rel(li.at(a), a * (3 * L * L - 4 * a * a) / (48 * EI)) < 1e-9, `réciprocité de Maxwell, charge à a = ${a} m`);
  void b; void xp;
  const l2 = C.influence([{ L, EI, m: 10 }, { L, EI, m: 10 }], L / 2);
  ok(rel(P * l2.at(L / 2), 23 * P * L ** 3 / (1536 * EI)) < 1e-9, `2 travées, P en mi-travée 1 : 23PL³/1536EI = ${(23 * P * L ** 3 / 1536 / EI * 1000).toFixed(4)} mm`);
}
/* 4. récurrence exacte (Nigam-Jennings) : réponse indicielle d'un oscillateur amorti */
{
  const w = 2 * PI * 5, z = 0.02, dt = 0.013, cf = C.coefNJ(w, z, dt), P = 3;
  let u = 0, ud = 0, err = 0;
  for (let s = 1; s <= 200; s++) {
    const nu = cf.A * u + cf.B * ud + cf.C * P + cf.D * P, nud = cf.Ap * u + cf.Bp * ud + cf.Cp * P + cf.Dp * P; u = nu; ud = nud;
    const t = s * dt, wd = w * Math.sqrt(1 - z * z), ex = P / (w * w) * (1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z / Math.sqrt(1 - z * z) * Math.sin(wd * t)));
    err = Math.max(err, Math.abs(u - ex) / (P / (w * w)));
  }
  ok(err < 1e-10, `réponse indicielle exacte, écart max ${err.toExponential(1)} (pas de temps grossier ω·Δt = ${(w * dt).toFixed(2)})`);
}
/* 5. force mobile unique, vitesse faible : facteur dynamique → 1 */
{
  const L = 20, EI = 3e7, m = 15, sp = [{ L, EI, m }];
  const md = C.modes(sp), v = 5 / 3.6, P = 100;
  const r = C.passage(md, [{ d: 0, P }], v, [L / 2], 0.02);
  const ys = P * L ** 3 / (48 * EI);
  ok(Math.abs(r.ymax[0] / ys - 1) < 0.005, `force unique à 5 km/h : ydyn/ystat = ${(r.ymax[0] / ys).toFixed(4)}`);
}
/* 6. solution de Frýba (poutre simple, force mobile, sans amortissement) : série modale exacte
 * v(x,t) = Σ (2P/(mL)) sin(jπx/L) / (ωj² − Ωj²) · [sin Ωj t − (Ωj/ωj) sin ωj t], Ωj = jπv/L (Frýba 1972, éq. 1.30) */
{
  const L = 25, EI = 4e7, m = 18, P = 150, sp = [{ L, EI, m }], md = C.modes(sp);
  for (const vk of [100, 250]) {
    const v = vk / 3.6, alpha = v / (2 * md.freq[0] * L);
    const r = C.passage(md, [{ d: 0, P }], v, [L / 2, L / 4], 0, { histo: true, nHisto: 100000, queue: 0 });
    const H = r.histo; let em = 0, ymax = 0;
    for (let k = 0; k < H.t.length; k++) {
      const t = H.t[k]; if (v * t >= L) break;
      let y = 0;
      for (let j = 1; j <= 60; j++) { const wj = j * j * PI * PI / (L * L) * Math.sqrt(EI / m), Wj = j * PI * v / L; y += 2 * P / (m * L) * Math.sin(j * PI / 2) / (wj * wj - Wj * Wj) * (Math.sin(Wj * t) - Wj / wj * Math.sin(wj * t)); }
      em = Math.max(em, Math.abs(H.y[0][k] - y)); ymax = Math.max(ymax, Math.abs(y));
    }
    // le moteur tronque à n ≤ 30 Hz (3 modes) : écart dû aux modes négligés, < 0,5 %
    ok(em / ymax < 5e-3, `Frýba v = ${vk} km/h (α = ${alpha.toFixed(3)}) : écart max ${(em / ymax * 100).toFixed(3)} % de ymax`);
  }
  // α petit : amplification ≈ 1 + α (approximation de Frýba pour α ≤ 0,1... ici on vérifie la tendance croissante)
  const v = 60 / 3.6, r = C.passage(md, [{ d: 0, P }], v, [L / 2], 0);
  const a = v / (2 * md.freq[0] * L), ys = P * L ** 3 / (48 * EI);
  ok(r.ymax[0] / ys > 1 && r.ymax[0] / ys < 1 + 2 * a, `α = ${a.toFixed(4)} : 1 < ydyn/ystat = ${(r.ymax[0] / ys).toFixed(4)} < 1 + 2α`);
}
/* 7. résonance : train régulier d'essieux équidistants d → pic d'accélération à v = n0·d (L/d = 0,83)
 *    et annulation du 1er mode quand L/d = 1,5 (L = (i + ½)·d, ERRI D214) : le pic se déplace à v = n0·d/2 */
{
  const L = 15, m = 12, EI = 4e6, sp = [{ L, EI, m }];
  const d = 18, ax = Array.from({ length: 40 }, (_, k) => ({ d: k * d, P: 170 }));
  const r = C.calcul({ spans: sp, type: 'bp', zeta: 1, trains: 'user', convoi: ax, vmin: 150, vmax: 300, vstep: 2, vmaxEtude: 340, pts: [{ x: L / 2, nom: 'mi' }] });
  const vRes = r.n0 * d * 3.6;
  const env = r.env[0][0].a, k = env.indexOf(Math.max(...env));
  ok(Math.abs(r.vit[k] - vRes) <= 3, `résonance : pic à ${r.vit[k]} km/h, n0·d = ${vRes.toFixed(1)} km/h (n0 = ${r.n0.toFixed(3)} Hz)`);
  ok(r.synth[0].phiDyn > 0.5, `amplification à la résonance (1 + φ'dyn) = ${(1 + r.synth[0].phiDyn).toFixed(2)}`);
  const d2 = 10, ax2 = Array.from({ length: 40 }, (_, k) => ({ d: k * d2, P: 170 }));
  const sp2 = [{ L, EI: 1.6e7, m }], md = C.modes(sp2), vr = md.freq[0] * d2;
  const a1 = C.passage(md, ax2, vr, [L / 2], 0.01).amax[0], a2 = C.passage(md, ax2, vr / 2, [L / 2], 0.01).amax[0];
  ok(a1 < 0.5 * a2, `annulation L = 1,5·d : a(n0·d) = ${a1.toFixed(2)} m/s² < a(n0·d/2) = ${a2.toFixed(2)} m/s²`);
}
/* 8. EN 1991-2 tableau 6.6, éq. (6.13), figure 6.10, tableau 6.2, φ'' */
{
  ok(Math.abs(C.zetaTab('bp', 10) - 1.7) < 1e-12 && C.zetaTab('bp', 25) === 1.0, 'ζ béton précontraint : 1,0 + 0,07(20 − L) ; 1,0 % pour L ≥ 20 m');
  ok(Math.abs(C.zetaTab('ba', 12) - 2.06) < 1e-12 && Math.abs(C.zetaTab('acier', 10) - 1.75) < 1e-12, 'ζ béton armé / poutrelles enrobées, acier et mixte');
  ok(Math.abs(C.deltaZeta(10) - 0.123 / 0.374) < 1e-9 && C.deltaZeta(30) === 0, `Δζ(10 m) = ${C.deltaZeta(10).toFixed(4)} % ; nul pour L ≥ 30 m`);
  const l = C.n0Limites(20);
  ok(Math.abs(l.inf - 4) < 1e-12 && Math.abs(C.n0Limites(20.0001).inf - 23.58 * Math.pow(20.0001, -0.592)) < 1e-12 && Math.abs(l.sup - 94.76 * Math.pow(20, -0.748)) < 1e-12, `limites n0 à 20 m : [${l.inf.toFixed(3)} ; ${l.sup.toFixed(3)}] Hz`);
  ok(C.lPhi([20, 25, 20]) === Math.max(1.3 * 65 / 3, 25) && C.lPhi([10, 30]) === 30, 'LΦ poutres continues : k·Lm ≥ max Li (tableau 6.2 cas 5.1)');
  ok(Math.abs(C.phi2(20) - 1.157068) < 1e-6, 'Φ2(20 m) = 1,1571');
}
/* 9. trains HSLM-A : tableau E.1 et nombre d'essieux */
{
  const T = C.HSLM_A;
  ok(T.A1.N === 18 && T.A1.D === 18 && T.A1.d === 2 && T.A1.P === 170 && T.A10.N === 11 && T.A10.D === 27 && T.A10.P === 210, 'tableau E.1 : A1 (18 ; 18 m ; 2,0 m ; 170 kN) … A10 (11 ; 27 m ; 210 kN)');
  const a1 = C.hslmAxles('A1'), a10 = C.hslmAxles('A10');
  ok(a1.length === 50 && a10.length === 36, `nombre d'essieux : A1 = ${a1.length}, A10 = ${a10.length} (2N + 14)`);
  ok(Math.abs(a1[a1.length - 1].d - (2 * 17 + 2 * 3.525 + 3 + 20 * 18)) < 1e-9, `longueur A1 entre essieux extrêmes : ${a1[a1.length - 1].d.toFixed(3)} m`);
  let sym = true; const Lt = a1[a1.length - 1].d; for (let k = 0; k < a1.length; k++) if (Math.abs(a1[k].d + a1[a1.length - 1 - k].d - Lt) > 1e-9) sym = false;
  ok(sym, 'convoi symétrique (motrice + voiture d\'extrémité en tête et en queue)');
}
/* 10. organigramme figure 6.9 */
{
  ok(C.organigramme({ V: 250, continu: false, L: 15, n0: 8 }).requise === true, 'V > 200 km/h → analyse dynamique requise');
  ok(C.organigramme({ V: 160, continu: true, L: 20, n0: 6 }).requise === false, 'V ≤ 200, continue, n0 dans les limites → non requise');
  ok(C.organigramme({ V: 160, continu: false, L: 15, n0: 2 }).requise === true, 'n0 < limite inférieure → requise');
}
/* 11. convoi utilisateur, limite de 99 essieux, calcul complet multi-travées */
{
  const ax = C.lireConvoi('10 200\n0 200 ; tête\n\n12,5 150');
  ok(ax.length === 3 && ax[0].d === 0 && ax[2].d === 12.5 && ax[1].P === 200, 'lecture du convoi utilisateur (tri, virgule décimale, commentaires)');
  let thr = false; try { C.calcul({ spans: [{ L: 10, EI: 1e7, m: 10 }], type: 'ba', trains: 'user', convoi: Array.from({ length: 100 }, (_, k) => ({ d: k, P: 100 })), vmin: 100, vmax: 120, vstep: 10 }); } catch (e) { thr = /99/.test(e.message); }
  ok(thr, 'plus de 99 essieux refusé');
  const r = C.calcul({ spans: [{ L: 20, EI: 4e7, m: 18 }, { L: 25, EI: 4e7, m: 18 }, { L: 20, EI: 4e7, m: 18 }], type: 'bp', dzeta: true, trains: ['A1', 'A4'], vmin: 140, vmax: 250, vstep: 10, ballast: true });
  ok(r.vit.length === 17 && r.vit[r.vit.length - 1] <= 300 && r.synth.length === 9 && r.synth.every((s) => s.ydyn > 0 && s.ystat > 0 && s.amax > 0), `3 travées : ${r.nModes} modes, n0 = ${r.n0.toFixed(2)} Hz, ${r.vit.length} vitesses, a max = ${r.synth[r.iA].amax.toFixed(2)} m/s²`);
  ok(r.synth.every((s) => s.ydyn >= 0.98 * s.ystat), 'flèche dynamique ≥ flèche statique (vitesse minimale ≈ quasi-statique)');
  ok(r.histo.t.length > 100 && r.histo.y.length === 9, `historique flèche/accélération à ${r.histo.v} km/h (${r.histo.train})`);
}
console.log(f ? `\n${f} échec(s)` : '\nTous les tests passent.');
process.exit(f ? 1 : 0);
