import { PPBAInput } from "./types";
export type Pt = [number, number];
/** Propriétés d'un polygone (x horizontal, y vers le haut) */
export function polyProps(p: Pt[]) {
  let A = 0, Sx = 0, Ixx = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length], c = x1 * y2 - x2 * y1;
    A += c; Sx += (y1 + y2) * c; Ixx += (y1 * y1 + y1 * y2 + y2 * y2) * c;
  }
  A /= 2; Sx /= 6; Ixx /= 12;
  const yg = Sx / A;
  return { A: Math.abs(A), yg, I: Math.abs(Ixx - A * yg * yg) };
}
/** Contour de la poutre (origine : fibre supérieure de la poutre, y vers le bas négatif) */
export function beamOutline(g: PPBAInput, b0 = g.b0): Pt[] {
  const H = g.hs2 + g.hame + g.ht2;
  const p: Pt[] = [[-g.bs / 2, 0], [-g.bs / 2, -g.hs1], [-b0 / 2, -g.hs2], [-b0 / 2, -(H - g.ht2)], [-g.bt / 2, -(H - g.ht1)], [-g.bt / 2, -H],
    [g.bt / 2, -H], [g.bt / 2, -(H - g.ht1)], [b0 / 2, -(H - g.ht2)], [b0 / 2, -g.hs2], [g.bs / 2, -g.hs1], [g.bs / 2, 0]];
  return p;
}
/** Aire de la partie de la poutre comprise entre la fibre supérieure et la profondeur h */
export function areaAbove(g: PPBAInput, h: number, b0 = g.b0) {
  const H = g.hs2 + g.hame + g.ht2;
  const w = (y: number) => { // largeur à la profondeur y
    if (y <= g.hs1) return g.bs;
    if (y <= g.hs2) return g.bs + ((b0 - g.bs) * (y - g.hs1)) / (g.hs2 - g.hs1);
    if (y <= H - g.ht2) return b0;
    if (y <= H - g.ht1) return b0 + ((g.bt - b0) * (y - (H - g.ht2))) / (g.ht2 - g.ht1);
    return g.bt;
  };
  const N = 2000; let A = 0; const hh = Math.min(h, H);
  for (let i = 0; i < N; i++) A += w(((i + 0.5) * hh) / N) * (hh / N);
  return A;
}
/** Coefficient de torsion k(b/a) d'un rectangle (série de Saint-Venant) */
export function kTorsion(r: number) {
  if (r >= 1e3) return 1 / 3;
  let s = 0; for (let n = 1; n <= 39; n += 2) s += Math.tanh((n * Math.PI * r) / 2) / n ** 5;
  return (1 / 3) * (1 - (192 / Math.PI ** 5) * (1 / r) * s);
}
export function geometry(g: PPBAInput) {
  const H = g.hs2 + g.hame + g.ht2;
  const app = polyProps(beamOutline(g, g.b0)), mid = polyProps(beamOutline(g, g.b0m));
  // section composite poutre + hourdis de largeur = entraxe (rigidité flexionnelle)
  const Ad = g.e * g.hd, yd = g.hd / 2;
  const yb = g.hd + (-mid.yg);        // CDG poutre mesuré depuis le haut de l'hourdis
  const At = Ad + mid.A, ygc = (Ad * yd + mid.A * yb) / At;
  const Ic = (g.e * g.hd ** 3) / 12 + Ad * (ygc - yd) ** 2 + mid.I + mid.A * (yb - ygc) ** 2;
  // torsion : découpage en rectangles (programme de référence)
  const b0 = g.b0m;
  const zones = [
    { b: g.e, a: g.hd, k: 1 / 6, nb: 1 },                                               // hourdis (moitié du coefficient d'une dalle)
    { b: g.bs, a: g.hs1, k: NaN, nb: 1 },                                                // semelle
    { b: (g.bs - b0) / 2, a: (g.hs2 - g.hs1) / 2, k: NaN, nb: 2 },                       // goussets de la semelle
    { b: H - g.hs1, a: b0, k: NaN, nb: 1, rWeb: true },                                  // âme (+ partie centrale du talon) : k(2h/b0)
    { b: (g.bt - b0) / 2, a: (g.ht2 - g.ht1) / 2, k: NaN, nb: 2 },                       // goussets du talon
    { b: g.ht1, a: (g.bt - b0) / 2, k: NaN, nb: 2 },                                     // débords du talon
  ].map(z => {
    const r = (Math.max(z.b, z.a) / Math.max(1e-9, Math.min(z.b, z.a))) * ((z as any).rWeb ? 2 : 1);
    const k = isNaN(z.k) ? kTorsion(r) : z.k;
    const Rt = z.nb * k * Math.max(z.b, z.a) * Math.min(z.b, z.a) ** 3;
    return { ...z, r, k, Rt };
  });
  const Kt = zones.reduce((s, z) => s + z.Rt, 0);
  return { H, Htot: H + g.hd, Aapp: app.A, Amid: mid.A, Ipoutre: mid.I, ygPoutre: -mid.yg, Acomp: At, Icomp: Ic, ygComp: ygc, zones, Kt };
}
