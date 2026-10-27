import { Guyon } from "../src/engine/guyon";
const g = new Guyon(0.7435, 0.3543, 4.95);
console.log(g.table().map(r => r.map(v => v.toFixed(4)).join(" ")).join("\n"));
console.log("Br rive", g.K(4.34, 4.7).toFixed(4));
