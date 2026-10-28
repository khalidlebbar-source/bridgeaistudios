// Modules aval de la note : superstructures, poids, ferraillage et épure des poutres, contre-flèche,
// hourdis (abaques de Thénoz), dallette de continuité, entretoises (vérinage), levage, frettes.
import { Resultat, XL } from "./sollicitations";
import { ComplInput } from "./complements";
import { barArea, ft, Ei, EvBAEL, sigmaS, stressesELS, asELU, asELS, Layer } from "./ba";
import { AL, delta } from "./fasc61";
import { areaAbove } from "./geometry";
import { verinage, verinsNormalises, dimEntretoise } from "./verinage";

const r2 = (x: number) => Math.round(x * 100) / 100;

// ---------------------------------------------------------------- Superstructures
export function superstructures(c: ComplInput) {
  const rows = c.superstructures.map(e => {
    const S = e.S ?? (e.a !== undefined && e.b !== undefined ? e.a * e.b : undefined);
    const p = e.poids ?? (S ?? 0) * (e.g ?? 0);
    return { ...e, Scalc: S, prob: p, min: p * e.kmin, max: p * e.kmax };
  });
  const rv = c.revetement;
  const rev = { min: rv.larg * rv.emin * rv.g, max: rv.larg * rv.emax * rv.g };
  const rows2 = [...rows,
    { nom: "Revêtement + rechargement (min)", cote: "S" as const, prob: rev.min, min: rev.min * rv.kmin, max: NaN, kmin: rv.kmin, kmax: NaN, Scalc: rv.larg * rv.emin, g: rv.g },
    { nom: "Revêtement + rechargement (max)", cote: "S" as const, prob: rev.max, min: NaN, max: rev.max * rv.kmax, kmin: NaN, kmax: rv.kmax, Scalc: rv.larg * rv.emax, g: rv.g }];
  const sum = (f: (x: any) => number, filt: (x: any) => boolean) => rows2.filter(filt).reduce((s, x) => s + (isNaN(f(x)) ? 0 : f(x)), 0);
  const lin = (x: any) => x.cote === "D" || x.cote === "G";
  const tot = {
    lin: { prob: sum(x => x.prob, lin), min: sum(x => x.min, lin), max: sum(x => x.max, lin) },
    cen: { prob: sum(x => x.prob, x => x.cote === "C"), min: sum(x => x.min, x => x.cote === "C"), max: sum(x => x.max, x => x.cote === "C") },
    surf: { prob: sum(x => x.prob, x => x.cote === "S" && !/\(max\)/.test(x.nom)), min: sum(x => x.min, x => x.cote === "S"), max: sum(x => x.max, x => x.cote === "S") },
  };
  const total = { prob: tot.lin.prob + tot.cen.prob + tot.surf.prob, min: tot.lin.min + tot.cen.min + tot.surf.min, max: tot.lin.max + tot.cen.max + tot.surf.max };
  return { rows: rows2, tot, total }; // t/ml
}

// ---------------------------------------------------------------- Poids propre du tablier (récapitulatif)
export function poidsTablier(R: Resultat, c: ComplInput) {
  const g = R.input, sup = superstructures(c);
  const Pp = R.poids.Vpoutre * g.gb / 10;                // t par poutre
  const Ph = g.Lh * g.hd * g.Lpoutre * g.gb / 10;          // t
  const Pe = R.poids.Went / 10;                            // t
  const Peq = { min: sup.total.min * g.Lpoutre, max: sup.total.max * g.Lpoutre };
  const tot = { min: g.n * Pp + Ph + Pe + Peq.min, max: g.n * Pp + Ph + Pe + Peq.max };
  return { Pp, Ptot: g.n * Pp, Ph, Pe, Sent: R.poids.Sent, Peq, tot, perMl: (t: number) => t / g.Lpoutre };
}

// ---------------------------------------------------------------- Ferraillage longitudinal des poutres (ELS, phasage)
export function litDepths(c: ComplInput, nLits: number) {
  const p = c.poutre, D = p.diam / 10;
  const first = p.enrobage + p.diamCadre + D / 2, out: number[] = [];
  for (let i = 0; i < nLits; i++) out.push(first + Math.floor(i / 2) * (2 * D + p.ecarteur) + (i % 2) * D);
  return out.map(v => v / 100); // m depuis la fibre inférieure
}
export function ferraillagePoutre(R: Resultat, c: ComplInput) {
  const g = R.input, p = c.poutre, geo = R.geo;
  const ssl = sigmaS(g.fe, g.fc28, g.fiss), sbl = 0.6 * g.fc28;
  const H = geo.H, Ht = geo.Htot, L = g.L;
  const q1 = geo.Amid * g.gb + p.bPhase1 * g.hd * g.gb;          // poutre + hourdis frais portés par la poutre seule
  const M1 = (q1 * L * L) / 8;
  const Mels = Math.max(...R.ELS.M.map(m => m.v));               // enveloppe retenue pour toutes les poutres
  const M2 = Mels - M1;
  const Mu = Math.max(...R.ELU.M.map(m => m.v));
  const s1 = { b: g.bs, h0: (g.hs1 + g.hs2) / 2, b0: g.b0m, h: H };
  const s2 = { b: p.bTable, h0: g.hd, b0: g.b0m, h: Ht };
  const Ab = barArea(p.diam);
  const evalLits = (lits: number[]) => {
    const dep = litDepths(c, lits.length);
    const L1: Layer[] = lits.map((nb, i) => ({ A: nb * Ab, d: H - dep[i] })).filter(l => l.A > 0);
    const L2: Layer[] = lits.map((nb, i) => ({ A: nb * Ab, d: Ht - dep[i] })).filter(l => l.A > 0);
    const e1 = stressesELS(s1, L1, M1), e2 = stressesELS(s2, L2, M2);
    const As = lits.reduce((s, n) => s + n, 0) * Ab;
    const dg = L2.reduce((s, l) => s + l.A * l.d, 0) / As;
    const elu = asELU(Mu, p.bTable, dg, g.fc28, g.fe);
    // contrôle ELU de la section en T : table seule suffisante si 0,8·y ≤ h0
    const ok = e1.ssG + e2.ssG <= ssl + 1e-6 && e1.sb <= sbl && e2.sb <= sbl && As >= elu.As;
    return { lits, dep, As, e1, e2, cumul: e1.ssG + e2.ssG, cumulMax: e1.ss + e2.ss, dg, elu, ok };
  };
  let lits = p.lits && p.lits.length ? p.lits.slice() : [];
  let res;
  if (!lits.length) {
    // dimensionnement automatique : on remplit les lits par paires jusqu'à vérification
    for (let nb = p.parLit; nb <= p.parLit * 9; nb += 1) {
      const full = Math.floor(nb / p.parLit), rest = nb % p.parLit;
      const t = Array(full).fill(p.parLit); if (rest) t.push(rest);
      res = evalLits(t); if (res.ok) break;
    }
  } else res = evalLits(lits);
  res = res!;
  // moment résistant ELS par barre (convention de la feuille : z = d − h0/4)
  const MrBar = res.dep.map(d => Ab * 1e-4 * ssl * 1e3 * (Ht - d - g.hd / 4));
  return { q1, M1, M2, Mels, Mu, ssl, sbl, s1, s2, Ab, ...res, MrBar };
}

// ---------------------------------------------------------------- Épure d'arrêt des barres
export function epure(R: Resultat, c: ComplInput, F: ReturnType<typeof ferraillagePoutre>) {
  const g = R.input, L = g.L, Ht = R.geo.Htot;
  const dec = 0.8 * Ht, Ls = (c.poutre.scellement * c.poutre.diam) / 1000;
  const Ms = R.ELS.M.map(m => m.v); // 0..0.5L
  const Mx = (x: number) => { const f = Math.min(x, L - x) / L; if (f <= 0) return 0; const i = Math.min(4, Math.floor(f / 0.1)); const t = (f - XL[i]) / 0.1; return Ms[i] * (1 - t) + Ms[i + 1] * t; };
  // courbe décalée : enveloppe M(x ± 0,8h)
  const Mdec = (x: number) => Math.max(Mx(Math.min(L, x + dec)), Mx(Math.max(0, x - dec)), Mx(x));
  // barres : lit 1 filant (crochets), les autres arrêtées symétriquement là où elles deviennent inutiles
  const bars: { lit: number; num: number; Mr: number; xd: number; xf: number; cr: boolean }[] = [];
  F.lits.forEach((nb, i) => { for (let k = 0; k < nb; k++) bars.push({ lit: i + 1, num: k + 1, Mr: F.MrBar[i], xd: 0, xf: L, cr: i === 0 }); });
  // ordre d'arrêt : du lit le plus haut vers le bas, barre par barre
  const order = bars.filter(b => !b.cr).sort((a, b) => b.lit - a.lit || b.num - a.num);
  const MrTot = bars.reduce((s, b) => s + b.Mr, 0);
  const kMarge = Math.max(1, MrTot / Math.max(...Ms));      // on conserve sur toute la longueur la marge de la section médiane
  const Mreq = (x: number) => kMarge * Mdec(x);
  const MrAt = (x: number) => bars.reduce((s, b) => {
    if (x < b.xd || x > b.xf) return s;
    const ramp = b.cr ? 1 : Math.min(1, (x - b.xd) / Ls, (b.xf - x) / Ls);
    return s + b.Mr * Math.max(0, ramp);
  }, 0);
  for (const b of order) {
    // plus petite abscisse x0 telle qu'en retirant la barre sur [0, x0] la courbe reste couverte
    let x0 = 0;
    for (let x = 0; x <= L / 2; x += 0.05) {
      const save = b.xd; b.xd = x;
      let ok = true; for (let t = 0; t <= L / 2; t += 0.05) if (MrAt(t) + 1e-6 < Mreq(t)) { ok = false; break; }
      b.xd = save; if (ok) x0 = x; else break;
    }
    x0 = Math.floor(x0 * 4) / 4; b.xd = x0; b.xf = L - x0;
  }
  const pts: { x: number; M: number; Md: number; Mr: number }[] = [];
  for (let i = 0; i <= 80; i++) { const x = (i * L) / 80; pts.push({ x, M: Mx(x), Md: Mdec(x), Mr: MrAt(x) }); }
  const couvert = pts.every(p => p.Mr + 1 >= p.Md);
  return { dec, Ls, bars, pts, couvert, kMarge, MrTot };
}

// ---------------------------------------------------------------- Cisaillement ELU et vérifications d'about
export function cisaillement(R: Resultat, c: ComplInput, F: ReturnType<typeof ferraillagePoutre>) {
  const g = R.input, b0 = g.b0, d = F.dg, fe = g.fe;
  const tlim = g.fiss === "P" ? Math.min((0.15 * g.fc28) / 1.5, 4) : g.fiss === "TP" ? Math.min((0.15 * g.fc28) / 1.5, 4) : Math.min((0.2 * g.fc28) / 1.5, 5);
  const rows = XL.slice(0, 5).map((f, i) => {
    const Vu = R.ELU.T[i].v, tu = Vu / 1000 / (b0 * d);
    const req = ((tu * b0 * 1.15) / (0.9 * fe)) * 1e4;   // cm²/ml (k = 0)
    const z = c.poutre.cadres[i] ?? c.poutre.cadres[c.poutre.cadres.length - 1];
    const pose = ((2 * barArea(z.diam) + 2 * barArea(z.diam2)) * 100) / z.esp;
    return { f, Vu, tu, req, ...z, pose, ok: pose >= req && tu <= tlim };
  });
  const Vu0 = R.ELU.T[0].v;
  const AsAppui = (Vu0 * 1.15) / fe * 10;                                  // cm²
  const a = c.poutre.aAppui;
  const VbielleBAEL = (0.4 * g.fc28 / 1.5) * a * b0 * 1000;                // BAEL A.5.1,313 : Vu ≤ 0,267·a·b0·fc28
  const VbielleFeuille = 0.4 * g.fc28 * a * b0 * 1000;                     // convention de la feuille de référence
  return { tlim, d, rows, AsAppui, AsLit1: F.lits[0] * F.Ab, VbielleBAEL, VbielleFeuille, Vu0 };
}

// ---------------------------------------------------------------- Contre-flèche
export function contreFleche(R: Resultat, c: ComplInput) {
  const g = R.input, L = g.L, geo = R.geo;
  const Eiv = Ei(g.fc28), Evv = EvBAEL(g.fc28);
  const Ip = geo.Ipoutre;
  const hd1 = c.contreFleche.hdPhase1 ?? g.hd;
  const qp = geo.Amid * g.gb, qh = hd1 * g.gb * g.e, q1 = qp + qh;
  // inertie globale du tablier : n poutres + hourdis sur toute la largeur
  const Ad = g.Lh * g.hd, Ab = g.n * geo.Amid, yb = g.hd + geo.ygPoutre;
  const yG = (Ad * g.hd / 2 + Ab * yb) / (Ad + Ab);
  const Iglob = c.contreFleche.Iglobal ?? (g.Lh * g.hd ** 3 / 12 + Ad * (yG - g.hd / 2) ** 2 + g.n * geo.Ipoutre + Ab * (yb - yG) ** 2);
  const Gres = c.contreFleche.poidsResistant ?? R.poids.P1;
  const qsup = g.qsup;
  const f = (q: number, E: number, I: number) => (5 * q * L ** 4) / (384 * E * 1000 * I) * 1000; // mm
  const F1 = f(q1, Eiv, Ip), F2 = f(Gres, Evv, Iglob), F3 = f(qsup, Evv, Iglob);
  const Fg = F1 + (2 / 3) * F2 + F3;
  const retenu = c.contreFleche.retenu ?? Math.max(20, Math.ceil((1.3 * Fg) / 10) * 10);
  const allure = XL.map(x => ({ x, X: x * L, cf: retenu * 4 * x * (1 - x) }));
  return { Eiv, Evv, Ip, qp, qh, q1, Iglob, Gres, qsup, F1, F2, F3, Fg, retenu, allure };
}

// ---------------------------------------------------------------- Hourdis : abaques de Thénoz
export function hourdis(R: Resultat, c: ComplInput, sup: ReturnType<typeof superstructures>) {
  const g = R.input, h = c.hourdis, ab = h.abaques;
  const E = 0.75 * h.e + 0.5 * h.hmin;
  const P = h.rev * h.grev + h.etanch * h.getanch + h.hTot * g.gb;           // kN/m²
  const Mag = (P * h.a * h.a) / 8, Mbg = 0.2 * Mag;
  // majoration dynamique de l'hourdis
  const xs = R.ys, entRR = xs[xs.length - 1] - xs[0];
  const Ld = Math.min(Math.max(R.surch.Lr, entRR), g.L);
  const G = Ld * (g.Lh * g.hd * g.gb + sup.total.min * 10);
  const bc = R.surch.bc[0], bt = R.surch.bt;
  const SBc = Math.min(2, R.surch.nv) * (Ld >= 4.5 + 1.5 ? 2 * 120 + (Ld >= 6 + 4.5 ? 60 : 0) : 120) * 2 / 2 * (Ld >= 10.5 ? 1 : 1);
  const S = { Bc: Math.min(2, R.surch.nv) * Math.min(600, bcOnLength(Ld)), Bt: Math.min(2, R.surch.nv) * 320, Br: 100, Mc: 1100 };
  void SBc;
  const dB = Math.max(delta(Ld, G, S.Bc), delta(Ld, G, S.Bt), delta(Ld, G, S.Br));
  const dMc = delta(Ld, G, S.Mc);
  const red = h.reduc;
  // moments transversaux à mi-portée (abaques 9, 10, 35)
  const Ma = { Bc: ab.MaBc * bc * dB, Bt: ab.MaBt * bt * dB, Mc: ab.MaMc * dMc };
  const Mb = { Bt: ab.MbBt * bt * dB, Br: ab.MbBr * dB, Bc: ab.MbBc * bc * dB };
  const combT = {
    ELU: [{ n: "1,35 Mg + 1,605 Mbc", v: 1.35 * Mag + 1.605 * Ma.Bc }, { n: "1,35 Mg + 1,605 Mbt", v: 1.35 * Mag + 1.605 * Ma.Bt }, { n: "1,35 Mg + 1,35 Mc120", v: 1.35 * Mag + 1.35 * Ma.Mc }],
    ELS: [{ n: "Mg + 1,2 Mbc", v: Mag + 1.2 * Ma.Bc }, { n: "Mg + 1,2 Mbt", v: Mag + 1.2 * Ma.Bt }, { n: "Mg + Mc120", v: Mag + Ma.Mc }],
  };
  const combL = {
    ELU: [{ n: "1,35 Mg + 1,605 Mbt", v: 1.35 * Mbg + 1.605 * Mb.Bt }, { n: "1,35 Mg + 1,605 Mbr", v: 1.35 * Mbg + 1.605 * Mb.Br }, { n: "1,35 Mg + 1,605 Mbc", v: 1.35 * Mbg + 1.605 * Mb.Bc }],
    ELS: [{ n: "Mg + 1,2 Mbt", v: Mbg + 1.2 * Mb.Bt }, { n: "Mg + 1,2 Mbr", v: Mbg + 1.2 * Mb.Br }, { n: "Mg + 1,2 Mbc", v: Mbg + 1.2 * Mb.Bc }],
  };
  const maxv = (a: { v: number }[]) => Math.max(...a.map(x => x.v));
  const MaxT = { ELU: maxv(combT.ELU) * red, ELS: maxv(combT.ELS) * red }, MaxL = { ELU: maxv(combL.ELU) * red, ELS: maxv(combL.ELS) * red };
  // moments de continuité
  const Mpg = -0.5 * Mag, Meg = -0.5 * Mbg;
  const Mp = { Bc: -ab.MpBc * bc * dB, Bt: -ab.MpBt * bt * dB, Mc: -ab.MpMc * dMc };
  const Me = { Bc: -ab.MeBc * bc * dB, Mc: -ab.MeMc * dMc };
  const cp = {
    ELU: [{ n: "1,35 Mg + 1,605 Mbc", v: 1.35 * Mpg + 1.605 * Mp.Bc }, { n: "1,35 Mg + 1,605 Mbt", v: 1.35 * Mpg + 1.605 * Mp.Bt }, { n: "1,35 Mg + 1,35 Mc120", v: 1.35 * Mpg + 1.35 * Mp.Mc }],
    ELS: [{ n: "Mg + 1,2 Mbc", v: Mpg + 1.2 * Mp.Bc }, { n: "Mg + 1,2 Mbt", v: Mpg + 1.2 * Mp.Bt }, { n: "Mg + Mc120", v: Mpg + Mp.Mc }],
  };
  const ce = {
    ELU: [{ n: "1,35 Mg + 1,605 Mbc", v: 1.35 * Meg + 1.605 * Me.Bc }, { n: "1,35 Mg + 1,35 Mc120", v: 1.35 * Meg + 1.35 * Me.Mc }],
    ELS: [{ n: "Mg + 1,2 Mbc", v: Meg + 1.2 * Me.Bc }, { n: "Mg + Mc120", v: Meg + Me.Mc }],
  };
  const minv = (a: { v: number }[]) => Math.min(...a.map(x => x.v));
  // ferraillage (bande de 1 m)
  const ssl = sigmaS(g.fe, g.fc28, g.fiss);
  const sect = (Mu: number, Ms: number, enr: number, ac: [number, number, number]) => {
    const d1 = ac[0], d2 = ac[1], esp = ac[2];
    const dmax = Math.max(d1, d2) / 1000;
    const d = h.hmin - enr / 100 - dmax / 2;
    const Apose = ((barArea(d1) + (d2 ? barArea(d2) : 0)) * 100) / esp;
    const u = asELU(Math.abs(Mu), 1, d, g.fc28, g.fe);
    const s = asELS(Math.abs(Ms), 1, d, g.fc28, ssl);
    const st = stressesELS({ b: 1, h0: 0, b0: 1, h: h.hmin }, [{ A: Apose, d }], Math.abs(Ms));
    const Acalc = Math.max(u.As, s.As);
    return { d, Apose, Au: u.As, As: s.As, Acalc, ss: st.ss, sb: st.sb, ok: Apose >= Acalc - 1e-6 && st.sb <= 0.6 * g.fc28 };
  };
  const fer = {
    trInf: sect(MaxT.ELU, MaxT.ELS, h.enrInf, h.aciers.trInf),
    trSup: sect(minv(cp.ELU), minv(cp.ELS), h.enrSup, h.aciers.trSup),
    loInf: sect(MaxL.ELU, MaxL.ELS, h.enrInf + Math.max(h.aciers.trInf[0], h.aciers.trInf[1]) / 10, h.aciers.loInf),
    loSup: sect(minv(ce.ELU), minv(ce.ELS), h.enrSup + Math.max(h.aciers.trSup[0], h.aciers.trSup[1]) / 10, h.aciers.loSup),
  };
  // prédalle
  const pd = h.predalle;
  const Mpd = ((g.gb * h.hTot + pd.chantier) * pd.portee ** 2) / 8;
  const Apd = asELS(Mpd, 1, pd.ep / 2, g.fc28, ssl).As;
  // poinçonnement (BAEL A.5.2,4)
  const roues = [
    { n: "Roue avant de Bc", a: 0.2, b: 0.2, P: 30, k: bc }, { n: "Roue arrière de Bc", a: 0.25, b: 0.25, P: 60, k: bc },
    { n: "Roue de Bt", a: 0.25, b: 0.6, P: 80, k: bt }, { n: "Roue Br", a: 0.3, b: 0.6, P: 100, k: 1 },
  ].map(w => {
    const uc = 2 * (w.a + w.b + 2 * 0.75 * h.e * 2 / 2 + 2 * h.hmin / 2 * 1 + 0) - 0; // périmètre au feuillet moyen
    const u = w.a + 2 * 0.75 * h.e + h.hmin, v = w.b + 2 * 0.75 * h.e + h.hmin;
    const ucc = 2 * (u + v);
    void uc;
    const Qlim = (0.045 * ucc * h.hmin * g.fc28 * 1000) / 1.5;
    const Qu = w.P * w.k * dB * 1.605;
    return { ...w, uc: ucc, Qlim, Qu, ok: Qu <= Qlim };
  });
  return { E, P, Mag, Mbg, Ld, G, S, dB, dMc, Ma, Mb, combT, combL, MaxT, MaxL, Mpg, Meg, Mp, Me, cp, ce, minCp: { ELU: minv(cp.ELU), ELS: minv(cp.ELS) }, minCe: { ELU: minv(ce.ELU), ELS: minv(ce.ELS) }, fer, Mpd, Apd, roues, ssl };
}
function bcOnLength(L: number) { // poids d'un camion Bc (sans bc) pouvant tenir sur une longueur L
  const ax = [{ d: 0, P: 60 }, { d: 4.5, P: 120 }, { d: 6, P: 120 }, { d: 10.5, P: 60 }, { d: 15, P: 120 }, { d: 16.5, P: 120 }];
  let w = 0; for (let i = 0; i < ax.length; i++) { let s = 0; for (let j = i; j < ax.length && ax[j].d - ax[i].d <= L + 1e-9; j++) s += ax[j].P; w = Math.max(w, s); }
  return w;
}

// ---------------------------------------------------------------- Dallette de continuité
export function dallette(R: Resultat, c: ComplInput, sup: ReturnType<typeof superstructures>) {
  const g = R.input, d = c.dallette;
  const As = (barArea(d.As[0]) * 100) / d.As[1] + (barArea(d.As[2]) * 100) / d.As[3];
  const Ai = (barArea(d.Ai[0]) * 100) / d.Ai[1] + (barArea(d.Ai[2]) * 100) / d.Ai[3];
  const ftj = ft(g.fc28), Eiv = Ei(g.fc28), Evv = Eiv / 3, n = 15;
  const B = 1, H = d.H, A = As * 1e-4, A2 = Ai * 1e-4, dd = H - d.ch, c2 = d.cb;
  // section homogène (béton entier) : I0
  const Sb = B * H, Sa = n * A, Sa2 = n * A2;
  const yg = (Sb * H / 2 + Sa * dd + Sa2 * c2) / (Sb + Sa + Sa2);
  // NB : l'acier tendu A est l'acier supérieur (moments négatifs) — on mesure depuis la fibre inférieure comprimée
  const I0 = (B * H ** 3) / 12 + Sb * (H / 2 - yg) ** 2 + Sa * (dd - yg) ** 2 + Sa2 * (c2 - yg) ** 2;
  const rho = A / (B * dd);
  const li = (0.05 * ftj) / (5 * rho), lv = 0.4 * li;
  const mu = Math.max(0, 1 - (1.75 * ftj) / (4 * rho * g.fe + ftj));
  const Ifi = I0 / (1 + li * mu), Ifv = I0 / (1 + lv * mu);   // convention de la feuille (BAEL B.6.5,2 prévoit 1,1·I0)
  // axe neutre de la section fissurée (comprimé : fibre inf., A' = acier inf à c')
  const qa = B / 2, qb = n * (A + A2), qc = -n * (A2 * c2 + A * dd);
  const y = (-qb + Math.sqrt(qb * qb - 4 * qa * qc)) / (2 * qa);
  const I = (B * y ** 3) / 3 + n * A2 * (y - c2) ** 2 + n * A * (dd - y) ** 2;
  // rotations
  const Lp = g.L, It = d.Itablier ?? contreFleche(R, c).Iglob;
  const Gt = d.Gtablier ?? R.poids.P1, Qs = d.Qsup ?? g.qsup; void sup;
  const apP = (Gt * Lp ** 3) / (24 * Evv * 1000 * It), aeq = (Qs * Lp ** 3) / (24 * Evv * 1000 * It);
  const Lcum = 2 * Lp, Al = AL(Lcum) * R.surch.Lr;          // A(l) sur deux travées, coefficients a1 = a2 = 1 (convention de la feuille)
  const art = (Al * Lp ** 3) / (24 * Eiv * 1000 * It), ats = d.T / Lp;
  const M = (E: number, If: number, a: number) => (E * 1000 * If * 2 * a) / d.L;
  const rows = [
    { n: "Rotation due au poids propre du tablier (2/3)", a: (2 / 3) * apP, M: M(Evv, Ifv, (2 / 3) * apP) },
    { n: "Rotation due au poids des équipements", a: aeq, M: M(Evv, Ifv, aeq) },
    { n: "Rotation due aux charges routières A(l)", a: art, M: M(Eiv, Ifi, art) },
    { n: "Rotation due au tassement différentiel", a: ats, M: M(Evv, Ifv, ats) },
  ].map(r => { const K = r.M / 1000 / I; return { ...r, K, sb: K * y, ss2: n * K * (y - c2), ss: n * K * (dd - y) }; });
  const Mtot = rows.reduce((s, r) => s + r.M, 0), Kt = Mtot / 1000 / I;
  const tot = { M: Mtot, sb: Kt * y, ss2: n * Kt * (y - c2), ss: n * Kt * (dd - y) };
  const ssl = sigmaS(g.fe, g.fc28, g.fiss);
  return { As, Ai, Eiv, Evv, I0, yg, rho, li, lv, mu, Ifi, Ifv, Ifi11: 1.1 * Ifi, y, I, It, Gt, Qs, apP, aeq, Lcum, Al, art, ats, rows, tot, ssl, sbl: 0.6 * g.fc28 };
}

// ---------------------------------------------------------------- Entretoises (vérinage à vide)
export function entretoise(R: Resultat, c: ComplInput) {
  const g = R.input, en = c.entretoise;
  const P = R.moy.G!.T[0];                                   // réaction maximale d'une poutre sous charges permanentes
  const jacks = verinsNormalises(en.verins, en.sym);
  const V = verinage(g.ent.b, R.ys, P, jacks);
  const D = dimEntretoise(V, en, g.fc28, g.fiss);
  return { P, Lent: g.ent.b, beams: R.ys, V, ...D, jacks: V.jacks, reac: V.reac, Msup: V.Msup, Minf: V.Minf, Tmax: V.Vmax };
}
function gauss(A: number[][], b: number[]) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}

// ---------------------------------------------------------------- Levage et frettes
export function levage(R: Resultat, c: ComplInput) {
  const F = (R.poids.Vpoutre * R.input.gb) / 2;               // kN par trou de levage
  const A = ((0.04 * F) / ((2 / 3) * c.levage.fe * 1000)) * 1e4; // cm²
  const nb = Math.max(2, Math.ceil(A / barArea(c.levage.diam)));
  return { F, A, nb };
}
export function frettes(R: Resultat, c: ComplInput) {
  const Rmax = R.ELS.T[0].v;
  const A = ((0.04 * Rmax) / ((2 / 3) * c.frettes.fe * 1000)) * 1e4;
  const nmin = A / barArea(c.frettes.diam);
  return { Rmax, A, nmin, nb: Math.max(2, Math.ceil(nmin)) };
}
export { areaAbove, r2 };
