// Schéma du vérinage : entretoise, charges des poutres, vérins, réactions et diagramme des moments
import { VerinageRes } from "./verinage";
const fx = (x: number, d = 2) => { const s = Math.abs(x) < 5e-13 ? "0" : x.toFixed(d); const [a, b] = s.split("."); return a.replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace("-", "−") + (b ? "," + b : ""); };

export function verinageSVG(Lent: number, beams: number[], P: number, V: VerinageRes, interactive = false, sel = -1) {
  const W = 680, mx = 46, s = (W - 2 * mx) / Lent, X = (x: number) => mx + (x + Lent / 2) * s;
  const yBar = 50, hBar = 14, yJ = yBar + hBar, amp = 46;
  // étiquettes des vérins : rangées décalées quand deux vérins sont proches
  const rows: number[] = [], lastX: number[] = [];
  V.jacks.forEach(j => { let r = 0; while (lastX[r] !== undefined && X(j) - lastX[r] < 46) r++; rows.push(r); lastX[r] = X(j); });
  const nRows = Math.max(1, ...rows.map(r => r + 1));
  const y0 = yJ + 50 + (nRows - 1) * 28 + amp + 18;
  let o = "";
  // zone cliquable (ajout d'un vérin)
  o += `<rect class="vg-bar" x="${X(-Lent / 2)}" y="${yBar}" width="${Lent * s}" height="${hBar}"/>`;
  for (const b of beams) o += `<line class="vg-load" x1="${X(b)}" x2="${X(b)}" y1="${yBar - 34}" y2="${yBar - 3}"/><polygon class="vg-arrow" points="${X(b) - 4},${yBar - 9} ${X(b) + 4},${yBar - 9} ${X(b)},${yBar - 1}"/>`;
  // zone cliquable (ajout d'un vérin), au-dessus de l'entretoise et sous les vérins
  if (interactive) o += `<rect class="vg-track" x="${X(-Lent / 2)}" y="${yBar - 6}" width="${Lent * s}" height="44" data-track="1"/>`;
  o += `<text class="vg-lbl" x="${X(-Lent / 2)}" y="12">P = ${fx(P, 0)} kN par poutre (${fx(P / 10, 1)} t)</text>`;
  V.jacks.forEach((j, i) => {
    const r = V.reac[i], bad = r !== undefined && r < 0;
    o += `<g class="vg-j${i === sel ? " sel" : ""}${bad ? " bad" : ""}" ${interactive ? `data-j="${i}" tabindex="0" role="button" aria-label="Vérin ${i + 1} à ${fx(j, 2)} m"` : ""}>
      ${interactive ? `<rect class="vg-hit" x="${X(j) - 13}" y="${yJ - 2}" width="26" height="46"/>` : ""}
      <polygon class="vg-jack" points="${X(j)},${yJ} ${X(j) - 8},${yJ + 18} ${X(j) + 8},${yJ + 18}"/>
      ${rows[i] ? `<line class="vg-lead" x1="${X(j)}" x2="${X(j)}" y1="${yJ + 20}" y2="${yJ + 22 + rows[i] * 28}"/>` : ""}
      <text class="vg-pos" x="${X(j)}" y="${yJ + 32 + rows[i] * 28}" text-anchor="middle">${fx(j, 2)}</text>
      ${r !== undefined ? `<text class="vg-reac" x="${X(j)}" y="${yJ + 46 + rows[i] * 28}" text-anchor="middle">${fx(r / 10, 1)} t</text>` : ""}</g>`;
  });
  // diagramme des moments (tracé du côté tendu : M > 0, fibre inférieure tendue, vers le bas)
  if (V.ok && V.pts.length) {
    const Mm = Math.max(V.Msup, V.Minf, 1e-9), Y = (M: number) => y0 + (M / Mm) * amp;
    o += `<line class="vg-axis" x1="${X(-Lent / 2)}" x2="${X(Lent / 2)}" y1="${y0}" y2="${y0}"/>`;
    // remplissage par signe
    const poly = (sign: 1 | -1) => {
      let d = `M${X(V.pts[0].x).toFixed(1)},${y0}`;
      for (let i = 0; i < V.pts.length; i++) {
        const p = V.pts[i], m = sign * p.M > 0 ? p.M : 0;
        if (i) { const q = V.pts[i - 1]; if (q.M * p.M < 0) { const xz = q.x + ((p.x - q.x) * q.M) / (q.M - p.M); d += ` L${X(xz).toFixed(1)},${y0}`; } }
        d += ` L${X(p.x).toFixed(1)},${Y(m).toFixed(1)}`;
      }
      return d + ` L${X(V.pts[V.pts.length - 1].x).toFixed(1)},${y0} Z`;
    };
    o += `<path class="vg-minf" d="${poly(1)}"/><path class="vg-msup" d="${poly(-1)}"/>`;
    o += `<path class="vg-mline" d="${V.pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.M).toFixed(1)}`).join(" ")}"/>`;
    if (V.Msup > 0) o += `<text class="vg-val sup" x="${X(V.xMsup)}" y="${Y(-V.Msup) - 6}" text-anchor="middle">${fx(-V.Msup, 0)} kN·m</text>`;
    if (V.Minf > 0) o += `<text class="vg-val inf" x="${X(V.xMinf)}" y="${Y(V.Minf) + 14}" text-anchor="middle">${fx(V.Minf, 0)} kN·m</text>`;
    o += `<text class="vg-lbl" x="${X(-Lent / 2)}" y="${y0 + amp + 34}">Moments sous vérinage à vide (ELS), tracés du côté tendu</text>`;
  } else if (V.erreur) o += `<text class="vg-err" x="${W / 2}" y="${y0}" text-anchor="middle">${V.erreur}</text>`;
  return `<svg viewBox="0 0 ${W} ${y0 + amp + 42}" class="vg${interactive ? " vg-edit" : ""}" role="img" aria-label="Vérinage de l'entretoise">${o}</svg>`;
}
export const VG_CSS = `
svg.vg{width:100%;max-width:680px;height:auto;font-family:'Outfit',system-ui,sans-serif;font-size:11px;touch-action:none}
.vg .vg-track{fill:transparent;cursor:copy}
.vg .vg-bar{fill:#efeae2;stroke:#5c5f6b;stroke-width:1}
.vg .vg-load{stroke:#3c3f4d;stroke-width:1.3}.vg .vg-arrow{fill:#3c3f4d}
.vg .vg-jack{fill:#c9a84c;stroke:#a07828;stroke-width:1}
.vg .vg-hit{fill:transparent}
.vg .vg-lead{stroke:#c9a84c;stroke-width:.8;stroke-dasharray:2 2}
.vg-edit .vg-j{cursor:grab}.vg-edit .vg-j:focus{outline:none}.vg-edit .vg-j:focus .vg-jack,.vg .vg-j.sel .vg-jack{fill:#a07828;stroke:#18191f;stroke-width:1.6}
.vg .vg-j.bad .vg-jack{fill:#e8a39b;stroke:#c0392b}
.vg .vg-pos{fill:#1a4fd6}.vg .vg-reac{fill:#18191f;font-weight:500}
.vg .vg-lbl{fill:#7a7e8e}.vg .vg-err{fill:#c0392b;font-size:13px}
.vg .vg-axis{stroke:#7a7e8e;stroke-width:.8}
.vg .vg-minf{fill:rgba(26,79,214,.14)}.vg .vg-msup{fill:rgba(192,57,43,.14)}
.vg .vg-mline{fill:none;stroke:#3c3f4d;stroke-width:1.3}
.vg .vg-val{font-weight:500}.vg .vg-val.sup{fill:#c0392b}.vg .vg-val.inf{fill:#1a4fd6}
`;
