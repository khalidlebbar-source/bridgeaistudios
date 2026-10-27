// Calcul des sollicitations des poutres (équivalent des sections I à IX du programme de référence)
import { PPBAInput } from "./types";
import { geometry, areaAbove } from "./geometry";
import { Guyon } from "./guyon";
import { AL, delta, maxEffect, convoyBc, convoyBt, convoyBr, convoyMc120, convoyMe120, convoyD, convoyE, Convoy } from "./fasc61";

export const XL = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
export type Table = { M: number[]; T: number[] };
export type LoadKey = "G" | "TR" | "A1" | "A2" | "BC1" | "BC2" | "BR" | "BT1" | "BT2" | "MC120" | "ME120" | "D" | "E";
export const LOAD_LABEL: Record<LoadKey, string> = {
  G: "Charges permanentes", TR: "Charges de trottoirs", A1: "A(L) 1 voie chargée", A2: "A(L) 2 voies chargées",
  BC1: "Bc 1 file", BC2: "Bc 2 files", BR: "Br", BT1: "Bt 1 tandem", BT2: "Bt 2 tandems", MC120: "Mc120", ME120: "Me120", D: "D", E: "E",
};

function coefs(classe: number, nv: number) {
  const a1Tab: Record<number, number[]> = { 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] };
  const bcTab: Record<number, number[]> = { 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1, 1], 3: [1, 0.8] };
  const a1 = (k: number) => a1Tab[classe][Math.min(k, a1Tab[classe].length) - 1];
  const bc = (k: number) => bcTab[classe][Math.min(k, bcTab[classe].length) - 1];
  const bt = classe === 1 ? 1 : classe === 2 ? 0.9 : 0;
  const v0 = classe === 1 ? 3.5 : classe === 2 ? 3.0 : 2.75;
  return { a1, bc, bt, v0, nv };
}

export function calcul(g: PPBAInput) {
  const geo = geometry(g);
  const L = g.L, Lp = g.Lpoutre, n = g.n;
  // ---------- II. Charges permanentes ----------
  const Vpoutre = ((geo.Aapp + geo.Amid) / 2) * Lp;
  const Ppoutres = n * Vpoutre * g.gb;
  const p1poutres = Ppoutres / Lp, p1dalle = g.Lh * g.hd * g.gb, P1 = p1poutres + p1dalle, P2 = g.qsup;
  const Wperm = (P1 + P2) * Lp;
  const Sent = g.ent.b * g.ent.h - n * areaAbove(g, g.ent.h, g.b0);
  const Went = g.ent.nb * Sent * g.ent.ep * g.gb;
  const Wtravee = Wperm + Went;
  const gl = Wtravee / L;   // charge permanente équivalente (kN/ml) — convention du programme
  // ---------- III. Surcharges ----------
  const Lr = g.Lh - g.trG - g.trD;
  const classe = g.classe ?? (Lr >= 7 ? 1 : Lr > 5.5 ? 2 : 3);
  const nv = g.nbVoies ?? Math.max(1, Math.floor(Lr / 3));
  const v = Lr / nv;
  const c = coefs(classe, nv);
  const a2 = c.v0 / v;
  const ALv = AL(L); // kN/m²
  // poids maximal du système B sur la travée (pour δ)
  // poids maximal d'une file Bc pouvant tenir sur la portée (fenêtre glissante sur les essieux)
  const bcAx = convoyBc().axles!; let wBc = 0;
  for (let i = 0; i < bcAx.length; i++) { let w = 0; for (let j = i; j < bcAx.length && bcAx[j].d - bcAx[i].d <= L + 1e-9; j++) w += bcAx[j].P; wBc = Math.max(wBc, w); }
  const nFilesMax = Math.min(nv, 2);
  const S = {
    BC1: c.bc(1) * wBc, BC2: c.bc(2) * wBc * nFilesMax,
    BR: 100, BT1: c.bt * 320, BT2: c.bt * 320 * Math.min(nv, 2), MC120: 1100, ME120: 660,
  };
  const dyn = {
    BC1: delta(L, Wtravee, S.BC1), BC2: delta(L, Wtravee, S.BC2), BR: delta(L, Wtravee, S.BR),
    BT1: delta(L, Wtravee, S.BT1), BT2: delta(L, Wtravee, S.BT2), MC120: delta(L, Wtravee, S.MC120), ME120: delta(L, Wtravee, S.ME120),
  };
  const en = g.charges;
  const dB = Math.max(...([en.Bc ? [dyn.BC1, dyn.BC2] : [], en.Br ? [dyn.BR] : [], en.Bt ? [dyn.BT1, dyn.BT2] : []].flat()), 1);
  // freinage
  const Sfr = Lr * Lp, ffr = 1 / (20 + 0.0035 * Sfr);
  const qA = (k: number) => c.a1(k) * a2 * ALv * v * k;
  const freinage = [1, 2].map(k => ({ k, P4: qA(k), F: qA(k) * Lp * ffr }));

  // ---------- IV. Sollicitations globales (sans majoration dynamique) ----------
  const tabUniform = (q: number): Table => ({ M: XL.map(f => (q * f * L * (L - f * L)) / 2), T: XL.map(f => q * (L / 2 - f * L)) });
  const tabConvoy = (cv: Convoy, k: number): Table => ({
    M: XL.map(f => k * maxEffect(cv, L, f * L, "M")),
    T: XL.map(f => k * (g.compat && cv.axles ? compatT(cv, L, f * L) : maxEffect(cv, L, f * L, "T"))),
  });
  const glob: Partial<Record<LoadKey, Table>> = {};
  glob.G = tabUniform(gl);
  glob.TR = tabUniform(g.qtr * (g.trG + g.trD));
  if (en.AL) { glob.A1 = tabUniform(qA(1)); if (nv >= 2) glob.A2 = tabUniform(qA(2)); }
  if (en.Bc) { glob.BC1 = tabConvoy(convoyBc(), c.bc(1)); if (nv >= 2) glob.BC2 = tabConvoy(convoyBc(), 2 * c.bc(2)); }
  if (en.Br) glob.BR = tabConvoy(convoyBr(), 1);
  if (en.Bt && c.bt) { glob.BT1 = tabConvoy(convoyBt(), c.bt); if (nv >= 2) glob.BT2 = tabConvoy(convoyBt(), 2 * c.bt); }
  if (en.Me120) glob.ME120 = tabConvoy(convoyMe120(), 1);
  if (en.Mc120) glob.MC120 = tabConvoy(convoyMc120(), 1);
  if (en.D) glob.D = tabConvoy(convoyD(), 1);
  if (en.E) glob.E = tabConvoy(convoyE(), 1);

  // ---------- V-VI. Rigidités ----------
  const Ev = (11000 * Math.cbrt(g.fc28)) / 3;
  const rhoP = (Ev * geo.Icomp) / g.e, rhoE = (Ev * g.hd ** 3) / 12;
  const b = g.Lh / 2;
  const theta = (b / L) * Math.pow(rhoP / rhoE, 0.25);
  const gamP = ((Ev / 2) * geo.Kt) / g.e, gamE = (Ev * g.hd ** 3) / 12;
  const alpha = (gamP + gamE) / (2 * Math.sqrt(rhoP * rhoE));
  const gm = new Guyon(theta, alpha, b);

  // ---------- VII. Répartition transversale ----------
  const ys = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * g.e);
  // ligne K de chaque poutre échantillonnée finement puis interpolée
  const STEP = 0.01, NS = Math.round((2 * b) / STEP);
  const lines = ys.map(y => Float64Array.from({ length: NS + 1 }, (_, j) => gm.K(y, -b + j * STEP)));
  const Kat = (i: number, e: number) => {
    const t = Math.min(NS, Math.max(0, (e + b) / STEP)), j = Math.min(NS - 1, Math.floor(t)), f = t - j;
    return lines[i][j] * (1 - f) + lines[i][j + 1] * f;
  };
  const Kmean = (i: number, a: number, cc: number) => {
    if (cc <= a) return 0; const m = Math.max(8, Math.ceil((cc - a) / 0.02)); let s = 0;
    for (let k = 0; k <= m; k++) s += (k === 0 || k === m ? 0.5 : 1) * Kat(i, a + ((cc - a) * k) / m);
    return s / m;
  };
  const rl = -b + g.trG, rr = b - g.trD;  // bords de la chaussée
  const scan = (lo: number, hi: number, f: (x: number) => number, step = 0.02) => { let best = -Infinity; for (let x = lo; x <= hi + 1e-9; x += step) best = Math.max(best, f(x)); return best; };
  const wheels = (i: number, offs: number[], edge: number) => scan(rl + edge, rr - edge - Math.max(...offs), x => offs.reduce((s, o) => s + Kat(i, x + o), 0) / offs.length);
  const strips = (i: number, parts: [number, number][], center: boolean) => {
    const W = parts.reduce((s, [a, c2]) => s + (c2 - a), 0), span = Math.max(...parts.map(p => p[1]));
    const f = (x: number) => parts.reduce((s, [a, c2]) => s + Kmean(i, x + a, x + c2) * (c2 - a), 0) / W;
    return center ? f(-span / 2) : scan(rl, rr - span, f);
  };
  const Kmoy: Record<LoadKey, number[]> = {} as any;
  const all = ys.map((_, i) => i);
  Kmoy.G = all.map(i => Kmean(i, -b, b));
  Kmoy.TR = all.map(i => (Kmean(i, -b, rl) * g.trG + Kmean(i, rr, b) * g.trD) / Math.max(1e-9, g.trG + g.trD));
  Kmoy.A1 = all.map(i => scan(rl, rr - v, x => Kmean(i, x, x + v)));
  Kmoy.A2 = all.map(i => scan(rl, rr - 2 * v, x => Kmean(i, x, x + 2 * v)));
  Kmoy.BC1 = all.map(i => wheels(i, [0, 2], 0.25));
  Kmoy.BC2 = all.map(i => wheels(i, [0, 2, 2.5, 4.5], 0.25));
  Kmoy.BR = all.map(i => wheels(i, [0], 0));
  Kmoy.BT1 = all.map(i => wheels(i, [0, 2], 0.5));
  Kmoy.BT2 = all.map(i => wheels(i, [0, 2, 3, 5], 0.5));
  Kmoy.MC120 = all.map(i => strips(i, [[0, 1], [3.3, 4.3]], false));
  Kmoy.ME120 = all.map(i => strips(i, [[0, 4]], false));
  Kmoy.D = all.map(i => strips(i, [[0, 3.3]], g.DEcentre));
  Kmoy.E = Kmoy.D.slice();
  const dynOf: Record<LoadKey, number> = { G: 1, TR: 1, A1: 1, A2: 1, BC1: dB, BC2: dB, BR: dB, BT1: dB, BT2: dB, MC120: dyn.MC120, ME120: dyn.ME120, D: 1, E: 1 };
  const Cp: Record<LoadKey, number[]> = {} as any;
  (Object.keys(Kmoy) as LoadKey[]).forEach(k => (Cp[k] = Kmoy[k].map(v2 => (v2 * dynOf[k]) / n)));

  // ---------- VIII. Sollicitations moyennes (enveloppe des poutres) ----------
  const keys = (Object.keys(glob) as LoadKey[]);
  const moy: Partial<Record<LoadKey, Table & { cp: number; beam: number; perBeam: number[][] }>> = {};
  for (const k of keys) {
    const t = glob[k]!, cps = Cp[k];
    // poutres prises en compte pour l'enveloppe : toutes, ou (convention du programme de référence) de l'axe vers la rive droite
    const pool = all.filter(i => !g.compat || ys[i] >= -1e-9);
    let ib = pool[0]; pool.forEach(i => { if (cps[i] > cps[ib] + 1e-12) ib = i; });
    const cp = cps[ib];
    const tdyn = g.compat ? dynOf[k] : 1; // le programme de référence réapplique δ à l'effort tranchant
    moy[k] = { M: t.M.map(m => m * cp), T: t.T.map(tt => tt * cp * tdyn), cp, beam: ib, perBeam: cps.map(c2 => t.M.map(m => m * c2)) };
  }
  // ---------- IX. Combinaisons ----------
  const groups: { name: LoadKey; gu: number; gs: number }[] = [];
  for (const k of ["A1", "A2", "BC1", "BC2", "BR", "BT1", "BT2"] as LoadKey[]) if (moy[k]) groups.push({ name: k, gu: 1.605, gs: 1.2 });
  for (const k of ["MC120", "ME120", "D", "E"] as LoadKey[]) if (moy[k]) groups.push({ name: k, gu: 1.35, gs: 1 });
  const comb = (which: "M" | "T", u: boolean) => XL.map((_, j) => {
    let best = -Infinity, nm = "";
    for (const gr of groups) {
      const G = moy.G![which][j], TR = moy.TR![which][j], Q = moy[gr.name]![which][j];
      const v2 = u ? 1.35 * G + 1.605 * TR + gr.gu * Q : G + TR + gr.gs * Q;
      if (v2 > best) { best = v2; nm = gr.name; }
    }
    return { v: best, comb: nm };
  });
  const ELU = { M: comb("M", true), T: comb("T", true) }, ELS = { M: comb("M", false), T: comb("T", false) };
  // ELS par poutre (moment)
  const ELSbeam = ys.map((_, i) => XL.map((_, j) => {
    let best = -Infinity;
    for (const gr of groups) {
      const G = moy.G!.perBeam[i][j] ?? 0, TR = moy.TR!.perBeam[i][j], Q = moy[gr.name]!.perBeam[i][j];
      best = Math.max(best, G + TR + gr.gs * Q);
    }
    return best;
  }));
  return {
    input: g, geo, ys,
    poids: { Vpoutre, Ppoutres, p1poutres, p1dalle, P1, P2, Wperm, Sent, Went, Wtravee, gl },
    surch: { Lr, classe, nv, v, a1: [c.a1(1), c.a1(2)], a2, bc: [c.bc(1), c.bc(2)], bt: c.bt, dyn, dB, ALv, Sfr, ffr, freinage },
    glob, Ev, rhoP, rhoE, theta, gamP, gamE, alpha, Ktable: gm.table(), Kmoy, Cp, moy, ELU, ELS, ELSbeam,
  };
}
/** Effort tranchant selon la convention du programme de référence : 1er essieu compté en entier au droit de la section */
function compatT(cv: Convoy, L: number, x: number) {
  let best = 0;
  const ax = cv.axles!;
  for (const order of [ax, [...ax].reverse().map(a => ({ d: ax[ax.length - 1].d - a.d, P: a.P }))]) {
    let v = order[0].P;
    for (let i = 1; i < order.length; i++) { const s = x + order[i].d; if (s <= L) v += (order[i].P * (L - s)) / L; }
    best = Math.max(best, v);
  }
  return best;
}
export type Resultat = ReturnType<typeof calcul>;
