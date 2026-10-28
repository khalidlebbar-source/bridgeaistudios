// Coefficients de répartition transversale de Guyon-Massonnet.
// Solution exacte de la plaque orthotrope (poisson nul) pour une charge linéique sinusoïdale,
// puis interpolation de Massonnet K = K0 + (K1 - K0)·√α  (vérifiée sur le tableau de référence à 1e-4 près).
import { expm, mv } from "./expm";

function Kalpha(alpha: number, theta: number, eta: number, eta0: number): number {
  const s = theta * Math.PI, s2 = s * s, s4 = s2 * s2;
  const A = [[0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [-s4, 0, 2 * alpha * s2, 0]];
  const ex = (t: number) => expm(A.map(r => r.map(v => v * t)));
  const E1 = ex(eta0 + 1), E2 = ex(1 - eta0);
  const start = (p: number, q: number) => [p, q, 0, 2 * alpha * s2 * q];
  const end = (p: number, q: number, J: number) => { const z = mv(E1, start(p, q)); z[3] += J; return mv(E2, z); };
  const res = (z: number[]) => [z[2], z[3] - 2 * alpha * s2 * z[1]];
  const r0 = res(end(0, 0, 1)), rp = res(end(1, 0, 0)), rq = res(end(0, 1, 0));
  const det = rp[0] * rq[1] - rq[0] * rp[1];
  const p = (-r0[0] * rq[1] + rq[0] * r0[1]) / det;
  const q = (-rp[0] * r0[1] + r0[0] * rp[1]) / det;
  let z = start(p, q);
  if (eta <= eta0) return 2 * s4 * mv(ex(eta + 1), z)[0];
  z = mv(E1, z); z[3] += 1;
  return 2 * s4 * mv(ex(eta - eta0), z)[0];
}

export class Guyon {
  private cache = new Map<string, number>();
  constructor(public theta: number, public alpha: number, public b: number) {}
  /** K pour une poutre en y (m) et une charge en e (m), axe du tablier en 0 */
  K(y: number, e: number): number {
    const key = y.toFixed(5) + "|" + e.toFixed(5);
    let v = this.cache.get(key);
    if (v === undefined) {
      const eta = y / this.b, eta0 = e / this.b;
      const k0 = Kalpha(0, this.theta, eta, eta0), k1 = Kalpha(1, this.theta, eta, eta0);
      v = k0 + (k1 - k0) * Math.sqrt(this.alpha);
      this.cache.set(key, v);
    }
    return v;
  }
  /** Moyenne de K sur une bande chargée uniformément [a, c] (intégration de Simpson) */
  Kmean(y: number, a: number, c: number, n = 24): number {
    if (c <= a) return 0;
    if (n % 2) n++;
    const h = (c - a) / n; let s = this.K(y, a) + this.K(y, c);
    for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * this.K(y, a + i * h);
    return (s * h) / 3 / (c - a);
  }
  /** Tableau 5 x 9 (y = 0..b ; e = -b..b) */
  table(): number[][] {
    const b = this.b, rows: number[][] = [];
    for (let i = 0; i <= 4; i++) { const r: number[] = []; for (let j = -4; j <= 4; j++) r.push(this.K((i * b) / 4, (j * b) / 4)); rows.push(r); }
    return rows;
  }
}
