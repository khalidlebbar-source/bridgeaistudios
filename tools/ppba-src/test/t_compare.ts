import { readLIR } from "./lir";
import { calcul } from "../src/engine/sollicitations";
import { exempleGrandes, exemplePetites } from "../src/engine/types";
const which = process.env.EX ?? "G";
const ref = readLIR(which === "G" ? "ref/10-GRANDECH.LIR.txt" : "ref/11-PETITECH.LIR.txt");
const t0 = Date.now();
const r = calcul({ ...(which === "G" ? exempleGrandes : exemplePetites), compat: process.env.COMPAT !== "0" });
console.log(`calcul : ${Date.now() - t0} ms`);
const pc = (a: number, b: number) => (b === 0 ? (a === 0 ? "0" : "∞") : ((100 * (a - b)) / Math.abs(b)).toFixed(2) + "%");
const row = (lab: string, a: number, b: number, d = 3) => console.log(lab.padEnd(34), a.toFixed(d).padStart(12), b.toFixed(d).padStart(12), pc(a, b).padStart(9));
row("Surface poutre", r.geo.Aapp, ref.Spoutre); row("Volume poutre", r.poids.Vpoutre, ref.Vpoutre);
row("P1", r.poids.P1, ref.P1); row("Poids entretoises", r.poids.Went, ref.Went); row("Poids travée", r.poids.Wtravee, ref.Wtravee);
row("Inertie composite", r.geo.Icomp, ref.I, 6); row("Inertie torsion", r.geo.Kt, ref.Kt, 4); row("theta", r.theta, ref.theta, 4); row("alpha", r.alpha, ref.alpha, 4);
const dk = ["BC1", "BC2", "BR", "BT1", "BT2", "MC120", "ME120"] as const;
dk.forEach((k, i) => row("delta " + k, (r.surch.dyn as any)[k], ref.dyn[i], 4));
let mx = 0; r.Ktable.forEach((rr, i) => rr.forEach((v, j) => (mx = Math.max(mx, Math.abs(v - ref.ktab[i][j]))))); console.log("Tableau K : écart max", mx.toFixed(5));
const map: [string, string, string][] = [["G", "IV.1", "VIII.1"], ["TR", "IV.2", "VIII.2"], ["A1", "IV.3", "VIII.3"], ["A2", "IV.4", "VIII.4"], ["BC1", "IV.5", "VIII.5"], ["BC2", "IV.6", "VIII.6"], ["BR", "IV.7", "VIII.7"], ["BT1", "IV.8", "VIII.8"], ["BT2", "IV.9", "VIII.9"], ["ME120", "IV.10", "VIII.10"], ["MC120", "IV.11", "VIII.11"], ["D", "IV.12", "VIII.12"], ["E", "IV.13", "VIII.13"]];
const kname: Record<string, string> = { G: "Charges Permanentes", TR: "Charges de trottoirs", A1: "A(L) 1 voie chargée", A2: "A(L) 2 voies chargées", BC1: "BC 1 file", BC2: "BC 2 files", BR: "BR", BT1: "BT 1 tandem", BT2: "BT 2 tandems", MC120: "MC120", ME120: "ME120", D: "D", E: "E" };
console.log("\nCharge          | écart max M glob | T glob | Kmoy (max poutres) prog/réf | M moy | T moy");
for (const [k, iv, viii] of map) {
  const g = (r.glob as any)[k], m = (r.moy as any)[k]; if (!g) continue;
  const e = (a: number[], b: number[]) => Math.max(...a.map((v, i) => (b[i] ? Math.abs(v - b[i]) / Math.abs(b[i]) : 0))) * 100;
  const kref = Math.max(...ref.kmoy[kname[k]]), kme = (r.Kmoy as any)[k][m.beam];
  console.log(k.padEnd(15), e(g.M, ref.tables[iv].M).toFixed(2).padStart(8) + "%", e(g.T, ref.tables[iv].T).toFixed(2).padStart(7) + "%",
    `${kme.toFixed(4)} / ${kref.toFixed(4)}`.padStart(18), e(m.M, ref.tables[viii].M).toFixed(2).padStart(7) + "%", e(m.T, ref.tables[viii].T).toFixed(2).padStart(7) + "%");
}
console.log("\nELU / ELS");
r.ELU.M.forEach((v, j) => console.log(`x/L=${[0, .1, .2, .3, .4, .5][j]}  MELU ${v.v.toFixed(1)} ${v.comb} / ${ref.elu[j].M} ${ref.elu[j].cm}   TELU ${r.ELU.T[j].v.toFixed(1)} ${r.ELU.T[j].comb} / ${ref.elu[j].T} ${ref.elu[j].ct}   MELS ${r.ELS.M[j].v.toFixed(1)} / ${ref.els[j].M}   TELS ${r.ELS.T[j].v.toFixed(1)} / ${ref.els[j].T}`));

console.log("\nRapports T moy / T moy réf par section");
for (const [k, , viii] of map) { const m = (r.moy as any)[k]; if (!m) continue; console.log(k.padEnd(8), m.T.map((v: number, i: number) => (v / ref.tables[viii].T[i]).toFixed(3)).join(" ")); }
