// Surcharges du fascicule 61 titre II — effets longitudinaux sur une travée isostatique.
export interface Axle { d: number; P: number }            // position relative (m), charge (kN)
export interface Strip { d: number; len: number; P: number } // charge répartie : début relatif, longueur, charge totale
export interface Convoy { name: string; axles?: Axle[]; strips?: Strip[]; reversible?: boolean }

/** Camion Bc : essieu avant 60 kN, deux essieux arrière 120 kN (4,50 m puis 1,50 m) ; 2 camions par file, 4,50 m entre camions */
export function convoyBc(nTrucks = 2): Convoy {
  const axles: Axle[] = []; let x = 0;
  for (let t = 0; t < nTrucks; t++) { if (t) x += 4.5; axles.push({ d: x, P: 60 }); x += 4.5; axles.push({ d: x, P: 120 }); x += 1.5; axles.push({ d: x, P: 120 }); }
  return { name: "Bc", axles, reversible: true };
}
export const convoyBt = (): Convoy => ({ name: "Bt", axles: [{ d: 0, P: 160 }, { d: 1.35, P: 160 }] });
export const convoyBr = (): Convoy => ({ name: "Br", axles: [{ d: 0, P: 100 }] });
export const convoyMc120 = (): Convoy => ({ name: "Mc120", strips: [{ d: 0, len: 6.1, P: 1100 }] });
export const convoyMe120 = (): Convoy => ({ name: "Me120", axles: [{ d: 0, P: 330 }, { d: 1.8, P: 330 }] });
/** Convoi D : deux remorques 1400 kN sur 11 m, 19 m d'axe en axe */
export const convoyD = (): Convoy => ({ name: "D", strips: [{ d: 0, len: 11, P: 1400 }, { d: 19, len: 11, P: 1400 }] });
/** Convoi E : deux remorques 2000 kN sur 15 m, 33 m d'axe en axe */
export const convoyE = (): Convoy => ({ name: "E", strips: [{ d: 0, len: 15, P: 2000 }, { d: 33, len: 15, P: 2000 }] });

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Ligne d'influence du moment en x (travée L) — intégrale sur [a,c] */
function imM(L: number, x: number, s: number) { return s <= x ? (s * (L - x)) / L : (x * (L - s)) / L; }
function intM(L: number, x: number, a: number, c: number) {
  a = clamp(a, 0, L); c = clamp(c, 0, L); if (c <= a) return 0;
  const F = (s: number) => (s <= x ? ((L - x) * s * s) / (2 * L) : ((L - x) * x * x) / (2 * L) + (x * ((L - x) * x - (L - s) * (L - s) / 2 + (L - x) * (L - x) / 2 - (L - x) * x)) / L);
  // primitive exacte par morceaux
  const G = (s: number) => {
    if (s <= x) return ((L - x) * s * s) / (2 * L);
    const p1 = ((L - x) * x * x) / (2 * L);
    const p2 = (x / L) * (L * (s - x) - (s * s - x * x) / 2);
    return p1 + p2;
  };
  void F;
  return G(c) - G(a);
}
/** Ligne d'influence de l'effort tranchant juste à droite de x */
function imT(L: number, x: number, s: number) { return s < x ? -s / L : s > x ? (L - s) / L : (L - x) / L; }
function intT(L: number, x: number, a: number, c: number) {
  a = clamp(a, 0, L); c = clamp(c, 0, L); if (c <= a) return 0;
  const G = (s: number) => (s <= x ? -(s * s) / (2 * L) : -(x * x) / (2 * L) + (L * (s - x) - (s * s - x * x) / 2) / L);
  return G(c) - G(a);
}

function effect(cv: Convoy, L: number, x: number, x0: number, dir: 1 | -1, kind: "M" | "T") {
  let v = 0;
  for (const a of cv.axles ?? []) { const s = x0 + dir * a.d; if (s >= 0 && s <= L) v += a.P * (kind === "M" ? imM(L, x, s) : imT(L, x, s)); }
  for (const st of cv.strips ?? []) {
    const s1 = x0 + dir * st.d, s2 = x0 + dir * (st.d + st.len);
    const a = Math.min(s1, s2), c = Math.max(s1, s2), q = st.P / st.len;
    v += q * (kind === "M" ? intM(L, x, a, c) : intT(L, x, a, c));
  }
  return v;
}
function extent(cv: Convoy) {
  let m = 0; for (const a of cv.axles ?? []) m = Math.max(m, a.d); for (const s of cv.strips ?? []) m = Math.max(m, s.d + s.len); return m;
}
/** Valeur maximale (M ou T) en x en déplaçant le convoi (pas fin + positions critiques) */
export function maxEffect(cv: Convoy, L: number, x: number, kind: "M" | "T"): number {
  const ext = extent(cv); let best = 0;
  const cands = new Set<number>();
  const pts: number[] = []; for (const a of cv.axles ?? []) pts.push(a.d); for (const s of cv.strips ?? []) pts.push(s.d, s.d + s.len);
  for (const dir of [1, -1] as const) {
    cands.clear();
    // positions mettant un essieu / une extrémité sur la section, sur un appui
    for (const p of pts) for (const t of [x, 0, L, x - 1e-9, x + 1e-9]) cands.add(t - dir * p);
    const step = Math.max(0.01, (L + 2 * ext) / 4000);
    for (let x0 = -ext - 1; x0 <= L + ext + 1; x0 += step) cands.add(x0);
    for (const x0 of cands) {
      // pour T : on ne garde que les positions où la section est juste à gauche des charges principales
      const v = effect(cv, L, x, x0, dir, kind);
      if (v > best) best = v;
    }
  }
  return best;
}
/** Valeur de A(L) (kN/m²) — fascicule 61, art. 4 */
export const AL = (L: number) => 2.3 + 360 / (L + 12);
/** Coefficient de majoration dynamique */
export const delta = (L: number, G: number, S: number) => 1 + 0.4 / (1 + 0.2 * L) + 0.6 / (1 + (4 * G) / S);
