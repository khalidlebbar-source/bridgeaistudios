// Dessins de la saisie PPBA : un même tracé sert au « schéma de principe » (codes des paramètres)
// et à « Votre ouvrage » (cotes réelles en bleu, à l'échelle).
import { Projet } from "../engine/project";

export type Mode = "p" | "r";
const f2 = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d).replace(".", ",").replace("-", "−") : "—");

// ------------------------------------------------------------------ primitives de cotation
function tick(x: number, y: number) { return `<line class="tk" x1="${x - 3}" y1="${y + 3}" x2="${x + 3}" y2="${y - 3}"/>`; }
/** cote horizontale */
export function hd(x1: number, x2: number, y: number, txt: string, on: boolean, ext?: [number, number]) {
  const e = ext ? `<line class="ext" x1="${x1}" y1="${ext[0]}" x2="${x1}" y2="${y + 4}"/><line class="ext" x1="${x2}" y1="${ext[1]}" x2="${x2}" y2="${y + 4}"/>` : "";
  return `<g class="dm${on ? " hl" : ""}">${e}<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>${tick(x1, y)}${tick(x2, y)}<text x="${(x1 + x2) / 2}" y="${y - 4}" text-anchor="middle">${txt}</text></g>`;
}
/** cote verticale (texte à droite ou à gauche) */
export function vd(x: number, y1: number, y2: number, txt: string, on: boolean, side: "r" | "l" = "r", ext?: [number, number]) {
  const e = ext ? `<line class="ext" x1="${ext[0]}" y1="${y1}" x2="${x + (side === "r" ? 4 : -4)}" y2="${y1}"/><line class="ext" x1="${ext[1]}" y1="${y2}" x2="${x + (side === "r" ? 4 : -4)}" y2="${y2}"/>` : "";
  return `<g class="dm${on ? " hl" : ""}">${e}<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>${tick(x, y1)}${tick(x, y2)}<text x="${x + (side === "r" ? 5 : -5)}" y="${(y1 + y2) / 2 + 4}" text-anchor="${side === "r" ? "start" : "end"}">${txt}</text></g>`;
}
const svg = (w: number, h: number, body: string, cls = "") => `<svg class="sk ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img">${body}</svg>`;
const L = (mode: Mode, code: string, v: number, d = 2) => (mode === "p" ? code : f2(v, d));

// ------------------------------------------------------------------ géométrie de principe (proportions lisibles)
const PRINC = { n: 4, e: 2.4, Lh: 10.6, trG: 2.0, trD: 0.7, hd: 0.3, bs: 1.3, hs1: 0.14, hs2: 0.26, b0: 0.4, b0m: 0.4, hame: 0.8, bt: 0.75, ht1: 0.35, ht2: 0.5 };
type Geo = typeof PRINC;
function geoOf(P: Projet, mode: Mode): Geo { const b = P.base; return mode === "p" ? PRINC : { n: b.n, e: b.e, Lh: b.Lh, trG: b.trG, trD: b.trD, hd: b.hd, bs: b.bs, hs1: b.hs1, hs2: b.hs2, b0: b.b0, b0m: b.b0m, hame: b.hame, bt: b.bt, ht1: b.ht1, ht2: b.ht2 }; }
function beamPts(g: Geo, cx: number, top: number, s: number, sv = s) {
  const H = g.hs2 + g.hame + g.ht2;
  const p = [[-g.bs / 2, 0], [g.bs / 2, 0], [g.bs / 2, g.hs1], [g.b0m / 2, g.hs2], [g.b0m / 2, H - g.ht2], [g.bt / 2, H - g.ht1], [g.bt / 2, H], [-g.bt / 2, H], [-g.bt / 2, H - g.ht1], [-g.b0m / 2, H - g.ht2], [-g.b0m / 2, g.hs2], [-g.bs / 2, g.hs1]];
  return p.map(([x, y]) => `${(cx + x * s).toFixed(1)},${(top + y * sv).toFixed(1)}`).join(" ");
}

// ------------------------------------------------------------------ 1. Coupe transversale du tablier
export function deckSVG(P: Projet, mode: Mode, hl = "", opts: { lanes?: boolean; sup?: boolean } = {}) {
  const g = geoOf(P, mode), W = 640, ml = 46, mr = 120;
  const s = (W - ml - mr) / g.Lh, H = g.hs2 + g.hame + g.ht2;
  const sv = mode === "p" ? s * 1.25 : s;                       // principe : verticales légèrement exagérées
  const X = (y: number) => ml + (y + g.Lh / 2) * s;
  const yTr = 74, y0 = yTr + 9, hS = Math.max(5, g.hd * sv), yB = y0 + hS, yE = yB + H * sv;
  const Lr = g.Lh - g.trG - g.trD, xl = X(-g.Lh / 2), xr = X(g.Lh / 2), rl = X(-g.Lh / 2 + g.trG), rr = X(g.Lh / 2 - g.trD);
  const ys = Array.from({ length: g.n }, (_, i) => (i - (g.n - 1) / 2) * g.e);
  let o = "";
  // trottoirs, dalle, revêtement
  if (g.trG > 0.01) o += `<rect class="trot" x="${xl}" y="${yTr}" width="${rl - xl}" height="${y0 - yTr}"/>`;
  if (g.trD > 0.01) o += `<rect class="trot" x="${rr}" y="${yTr}" width="${xr - rr}" height="${y0 - yTr}"/>`;
  if (opts.sup) o += `<rect class="rev" x="${rl}" y="${y0 - 3}" width="${rr - rl}" height="3"/>`;
  o += `<rect class="slab" x="${xl}" y="${y0}" width="${xr - xl}" height="${hS}"/>`;
  for (const y of ys) o += `<polygon class="beam" points="${beamPts(g, X(y), yB, s, sv)}"/>`;
  // voies
  const nv = Math.max(1, Math.floor(Lr / 3)), v = Lr / nv;
  if (opts.lanes !== false) for (let k = 1; k < nv; k++) o += `<line class="lane" x1="${X(-g.Lh / 2 + g.trG + k * v)}" y1="${y0 - 14}" x2="${X(-g.Lh / 2 + g.trG + k * v)}" y2="${y0 - 2}"/>`;
  // axe du tablier
  o += `<line class="axis" x1="${X(0)}" y1="${yTr - 10}" x2="${X(0)}" y2="${yE + 8}"/>`;
  // cotes horizontales
  o += hd(xl, xr, 18, L(mode, "LH", g.Lh), hl === "LH", [y0, y0]);
  if (g.trG > 0.01) o += hd(xl, rl, 44, L(mode, "TRG", g.trG), hl === "TRG", [yTr, yTr]);
  o += hd(rl, rr, 44, L(mode, "LR", Lr) + (mode === "r" ? "" : ""), hl === "LR", [yTr, yTr]);
  if (g.trD > 0.01) o += hd(rr, xr, 44, L(mode, "TRD", g.trD), hl === "TRD" , [yTr, yTr]);
  // numéros de poutres et entraxe
  const yN = yE + 16;
  ys.forEach((y, i) => (o += `<g class="bub${hl === "N" ? " hl" : ""}"><circle cx="${X(y)}" cy="${yN}" r="8"/><text x="${X(y)}" y="${yN + 3.5}" text-anchor="middle">${i + 1}</text></g>`));
  if (g.n > 1) o += hd(X(ys[0]), X(ys[1]), yN + 30, L(mode, "E", g.e), hl === "E", [yE + 2, yE + 2]);
  const deb = (g.Lh - (g.n - 1) * g.e) / 2;
  o += hd(xl, X(ys[0]), yN + 30, L(mode, "DEB", deb), hl === "DEB");
  // cotes verticales
  const xv = xr + 14;
  o += vd(xv, y0, yB, L(mode, "HD", g.hd), hl === "HD", "r", [xr, xr]);
  o += vd(xv + 44, yB, yE, L(mode, "HP", H), hl === "HP", "r", [X(ys[ys.length - 1]) + (g.bs / 2) * s, X(ys[ys.length - 1]) + (g.bt / 2) * s]);
  if (mode === "r") o += `<text class="ann" x="${(rl + rr) / 2}" y="${y0 - 18}" text-anchor="middle">${nv} voie${nv > 1 ? "s" : ""} de ${f2(v)} m</text>`;
  else o += `<text class="ann" x="${(rl + rr) / 2}" y="${y0 - 18}" text-anchor="middle">NV voies</text>`;
  return svg(W, yN + 46, o);
}

// ------------------------------------------------------------------ 2. Section de la poutre
export function beamSVG(P: Projet, mode: Mode, hl = "") {
  const g = geoOf(P, mode), H = g.hs2 + g.hame + g.ht2, W = 600, Hh = 330;
  const s = Math.min(250 / H, 300 / g.bs), cx = 250, top = 40;
  const X = (x: number) => cx + x * s, Y = (y: number) => top + y * s;
  const on = (c: string) => hl === c;
  let o = `<polygon class="beam" points="${beamPts(g, cx, top, s)}"/>`;
  o += `<line class="axis" x1="${cx}" y1="${top - 14}" x2="${cx}" y2="${Y(H) + 10}"/>`;
  o += hd(X(-g.bs / 2), X(g.bs / 2), top - 14, L(mode, "BS", g.bs), on("BS"), [top, top]);
  o += hd(X(-g.bt / 2), X(g.bt / 2), Y(H) + 22, L(mode, "BT", g.bt), on("BT"), [Y(H), Y(H)]);
  o += hd(X(-g.b0m / 2), X(g.b0m / 2), Y(g.hs2 + g.hame / 2), L(mode, "B0", g.b0m), on("B0") || on("B0M"));
  const xr = X(Math.max(g.bs, g.bt) / 2) + 16;
  o += vd(xr, Y(0), Y(g.hs1), L(mode, "HS1", g.hs1), on("HS1"), "r", [X(g.bs / 2), X(g.bs / 2)]);
  o += vd(xr + 54, Y(0), Y(g.hs2), L(mode, "HS2", g.hs2), on("HS2"), "r", [X(g.bs / 2), X(g.b0m / 2)]);
  o += vd(xr, Y(g.hs2), Y(g.hs2 + g.hame), L(mode, "HAME", g.hame), on("HAME"), "r", [X(g.b0m / 2), X(g.b0m / 2)]);
  o += vd(xr, Y(H - g.ht1), Y(H), L(mode, "HT1", g.ht1), on("HT1"), "r", [X(g.bt / 2), X(g.bt / 2)]);
  o += vd(xr + 54, Y(H - g.ht2), Y(H), L(mode, "HT2", g.ht2), on("HT2"), "r", [X(g.b0m / 2), X(g.bt / 2)]);
  const xl = X(-Math.max(g.bs, g.bt) / 2) - 18;
  o += vd(xl, Y(0), Y(H), L(mode, "HP", H), on("HP"), "l", [X(-g.bs / 2), X(-g.bt / 2)]);
  if (mode === "p") o += `<text class="ann" x="${cx}" y="${Hh - 6}" text-anchor="middle">B0 : largeur d'âme sur appui · B0M : à mi-travée</text>`;
  else o += `<text class="ann" x="${cx}" y="${Hh - 6}" text-anchor="middle">Âme : ${f2(P.base.b0)} sur appui · ${f2(P.base.b0m)} à mi-travée</text>`;
  return svg(W, Hh, o);
}

// ------------------------------------------------------------------ 3. Élévation des travées
export function spanSVG(P: Projet, mode: Mode, hl = "") {
  const W = 640;
  const rows = mode === "p" ? [{ nom: "Travée", L: 20, Lpoutre: 21 }] : P.travees.map(t => ({ nom: t.nom, L: t.L, Lpoutre: t.Lpoutre }));
  const Lmax = Math.max(...rows.map(r => r.Lpoutre)), ml = 30, s = (W - ml - 40) / Lmax;
  const rowH = mode === "p" ? 150 : Math.max(86, Math.min(130, 300 / rows.length));
  let o = "", y = 30;
  const ent = P.base.ent;
  for (const r of rows) {
    const x0 = ml, x1 = ml + r.Lpoutre * s, a = ((r.Lpoutre - r.L) / 2) * s, hb = mode === "p" ? 34 : 22, hs = 6;
    const yb = y + 26;
    o += `<text class="ann b" x="${x0}" y="${y}">${mode === "p" ? "" : r.nom}</text>`;
    o += `<rect class="slab" x="${x0}" y="${yb}" width="${x1 - x0}" height="${hs}"/>`;
    o += `<rect class="beam" x="${x0}" y="${yb + hs}" width="${x1 - x0}" height="${hb}"/>`;
    // entretoises d'about
    const we = Math.max(4, ent.ep * s);
    o += `<rect class="ent" x="${x0}" y="${yb + hs}" width="${we}" height="${hb}"/><rect class="ent" x="${x1 - we}" y="${yb + hs}" width="${we}" height="${hb}"/>`;
    // appuis
    for (const xa of [x0 + a, x1 - a]) o += `<polygon class="sup" points="${xa},${yb + hs + hb} ${xa - 6},${yb + hs + hb + 10} ${xa + 6},${yb + hs + hb + 10}"/>`;
    o += hd(x0, x1, yb - 8, L(mode, "LP", r.Lpoutre), hl === "LP", [yb, yb]);
    o += hd(x0 + a, x1 - a, yb + hs + hb + 28, L(mode, "L", r.L), hl === "L", [yb + hs + hb + 10, yb + hs + hb + 10]);
    y += rowH;
  }
  if (mode === "p") {
    const xe = ml + 21 * s;
    o += `<text class="ann" x="${ml}" y="${y - 10}">Entretoises d'about (hachurées) : ENTH × ENTEP, sur la largeur ENTB · NE par travée</text>`;
    void xe;
  } else o += `<text class="ann" x="${ml}" y="${y - 10}">Entretoises : ${f2(ent.b)} × ${f2(ent.h)} × ${f2(ent.ep)} m · ${ent.nb} par travée</text>`;
  return svg(W, y + 4, `<defs><pattern id="hx" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hxb" width="5" height="5"/><line class="hxl" x1="0" y1="0" x2="0" y2="5"/></pattern></defs>` + o);
}

// ------------------------------------------------------------------ 4. Ferraillage longitudinal des poutres
export function rebarSVG(P: Projet, mode: Mode, hl = "", ti = 0, litsAuto?: number[]) {
  const g = geoOf(P, mode), H = g.hs2 + g.hame + g.ht2, W = 600, Hh = 330;
  const c = P.compl.poutre, t = P.travees[Math.min(ti, P.travees.length - 1)];
  const bT = mode === "p" ? 1.7 : c.bTable, hdd = mode === "p" ? 0.25 : P.base.hd;
  const s = Math.min(270 / (H + hdd), 380 / Math.max(bT, g.bs)), cx = 230, top = 34;
  const Y = (y: number) => top + y * s, X = (x: number) => cx + x * s;
  const on = (k: string) => hl === k;
  let o = `<rect class="slab" x="${X(-bT / 2)}" y="${Y(0)}" width="${bT * s}" height="${hdd * s}"/>`;
  o += `<polygon class="beam" points="${beamPts(g, cx, Y(hdd), s)}"/>`;
  o += hd(X(-bT / 2), X(bT / 2), top - 12, L(mode, "BTAB", bT), on("BTAB"), [top, top]);
  const lits = mode === "p" ? [6, 6, 4] : (t.lits && t.lits.length ? t.lits : litsAuto ?? []);
  const D = (mode === "p" ? 32 : c.diam) / 1000, enr = (mode === "p" ? 3 : c.enrobage) / 100, dc = (mode === "p" ? 1.2 : t.diamCadre) / 100, ec = (mode === "p" ? 3.2 : c.ecarteur) / 100;
  const ybot = H + hdd;
  // cadre
  o += `<polyline class="cad${on("CADRE") ? " hl" : ""}" points="${X(-g.bt / 2 + enr)},${Y(hdd + g.hs2)} ${X(-g.bt / 2 + enr)},${Y(ybot - enr)} ${X(g.bt / 2 - enr)},${Y(ybot - enr)} ${X(g.bt / 2 - enr)},${Y(hdd + g.hs2)}"/>`;
  const depth = (i: number) => enr + dc + D / 2 + Math.floor(i / 2) * (2 * D + ec) + (i % 2) * D;
  const wAv = g.bt - 2 * (enr + dc) - D, maxPer = mode === "p" ? 6 : c.parLit;
  lits.forEach((nb, i) => {
    const y = ybot - depth(i), sp = nb > 1 ? Math.min(wAv / (maxPer - 1), wAv / (nb - 1)) : 0;
    for (let k = 0; k < nb; k++) o += `<circle class="bar${on("LITS") || on("DIAM") ? " hl" : ""}" cx="${(X((k - (nb - 1) / 2) * sp)).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="${Math.max(1.6, (D / 2) * s).toFixed(1)}"/>`;
    const ty = Y(ybot) - 2 - i * 15, tx = X(g.bt / 2) + 34;
    o += `<line class="lead" x1="${X(g.bt / 2) - 2}" y1="${Y(y)}" x2="${tx - 3}" y2="${ty - 4}"/><text class="ann" x="${tx}" y="${ty}">${mode === "p" ? "Lit " + (i + 1) : `lit ${i + 1} : ${nb} HA${c.diam}`}</text>`;
  });
  if (!lits.length) o += `<text class="ann" x="${cx}" y="${Y(ybot) - 20}" text-anchor="middle">dimensionnement automatique</text>`;
  const xr = X(Math.max(bT, g.bs) / 2) + 20;
  o += vd(X(-g.bt / 2) - 14, Y(ybot - enr), Y(ybot), L(mode, "ENR", enr * 100, 1), on("ENR"), "l");
  o += vd(xr + 60, Y(0), Y(ybot), L(mode, "HT", ybot), false, "r", [X(bT / 2), X(g.bt / 2)]);
  const lab = mode === "p" ? "Barres DIAM · CADRE Ø · ECART entre paires de lits" : `HA${c.diam} · cadres Ø${f2(t.diamCadre * 10, 0)} · écarteur ${f2(c.ecarteur, 1)} cm`;
  o += `<text class="ann" x="${cx}" y="${Hh - 6}" text-anchor="middle">${lab}</text>`;
  return svg(W, Hh, o);
}

// ------------------------------------------------------------------ 5. Superstructures (détail de rive)
export function superSVG(mode: Mode, hl = "", tot?: { prob: number; min: number; max: number }) {
  const W = 600, Hh = 300;
  let o = "";
  // dalle et trottoir de droite (détail)
  o += `<rect class="slab" x="40" y="170" width="480" height="34"/>`;
  o += `<rect class="rev${hl === "REV" ? " hl" : ""}" x="40" y="160" width="300" height="10"/>`;
  o += `<rect class="chape${hl === "CHAPE" ? " hl" : ""}" x="40" y="166" width="300" height="4"/>`;
  o += `<rect class="trotb${hl === "MAIGRE" ? " hl" : ""}" x="352" y="134" width="120" height="36"/>`;
  o += `<rect class="bord${hl === "BORD" ? " hl" : ""}" x="340" y="128" width="14" height="42"/>`;
  o += `<polygon class="cor${hl === "CORN" ? " hl" : ""}" points="472,110 520,110 520,224 506,224 506,140 472,140"/>`;
  o += `<rect class="ccor${hl === "CCORN" ? " hl" : ""}" x="460" y="124" width="14" height="46"/>`;
  o += `<g class="${hl === "BN4" ? "hl" : ""}"><line class="steel" x1="492" y1="110" x2="482" y2="36"/><rect class="rail" x="470" y="44" width="30" height="7"/><rect class="rail" x="470" y="64" width="30" height="7"/><rect class="rail" x="470" y="84" width="30" height="7"/></g>`;
  const lab = (x: number, y: number, tx: number, ty: number, t: string, c: string) => `<g class="lb${hl === c ? " hl" : ""}"><line class="lead" x1="${x}" y1="${y}" x2="${tx}" y2="${ty}"/><text x="${tx + (tx < x ? -3 : 3)}" y="${ty + 4}" text-anchor="${tx < x ? "end" : "start"}">${t}</text></g>`;
  o += lab(200, 164, 150, 120, mode === "p" ? "REV : revêtement + rechargement" : "Revêtement + rechargement", "REV");
  o += lab(120, 168, 70, 250, mode === "p" ? "CHAPE : chape d'étanchéité" : "Chape d'étanchéité", "CHAPE");
  o += lab(347, 140, 300, 90, mode === "p" ? "BORD : bordure" : "Bordure de trottoir", "BORD");
  o += lab(410, 150, 380, 250, mode === "p" ? "MAIGRE : béton maigre" : "Béton maigre", "MAIGRE");
  o += lab(467, 130, 420, 70, mode === "p" ? "CCORN" : "Contre-corniche", "CCORN");
  o += lab(515, 200, 560, 250, mode === "p" ? "CORN" : "Corniche", "CORN");
  o += lab(490, 50, 560, 30, mode === "p" ? "BN4" : "BN4 + grillage", "BN4");
  if (mode === "r" && tot) o += `<g class="dm"><text x="40" y="24">Total : ${f2(tot.prob, 3)} t/ml probable · ${f2(tot.min, 3)} min · ${f2(tot.max, 3)} max</text></g>`;
  return svg(W, Hh, o, "big");
}

// ------------------------------------------------------------------ 6. Hourdis (panneau de Thénoz)
export function hourdisSVG(P: Projet, mode: Mode, hl = "") {
  const h = P.compl.hourdis, W = 640, Hh = 300, on = (c: string) => hl === c;
  const a = mode === "p" ? 1.6 : h.a, A = mode === "p" ? 0.4 : h.A, hh = mode === "p" ? 0.25 : h.hmin, e = mode === "p" ? 0.08 : h.e;
  // coupe transversale entre deux poutres
  const s = 150 / (a + 2 * A + 0.6), ox = 64, y0 = 110;
  const xa = ox + 0.3 * s + A * s, xb = xa + a * s;
  let o = `<text class="ann b" x="${ox}" y="20">Coupe</text>`;
  o += `<rect class="slab" x="${ox}" y="${y0}" width="${(a + 2 * A + 0.6) * s}" height="${Math.max(8, hh * s * 1.6)}"/>`;
  o += `<rect class="rev" x="${ox}" y="${y0 - Math.max(4, e * s * 1.6)}" width="${(a + 2 * A + 0.6) * s}" height="${Math.max(4, e * s * 1.6)}"/>`;
  const yb = y0 + Math.max(8, hh * s * 1.6);
  for (const xw of [xa - A * s, xb + A * s]) o += `<rect class="beam" x="${xw - A * s}" y="${yb}" width="${2 * A * s}" height="10"/><rect class="beam" x="${xw - 8}" y="${yb + 10}" width="16" height="70"/>`;
  o += hd(xa, xb, yb + 104, L(mode, "a", a), on("a"), [yb + 10, yb + 10]);
  o += hd(xb, xb + A * s, yb + 126, L(mode, "A", A), on("A"), [yb + 10, yb + 10]);
  o += vd(ox - 6, y0, yb, L(mode, "h", hh), on("h"), "l");
  o += vd(ox + (a + 2 * A + 0.6) * s + 8, y0 - Math.max(4, e * s * 1.6), y0, L(mode, "e", e, 3), on("e"), "r");
  // vue en plan
  const px = 330, py = 60, pw = 280, ph = 150;
  o += `<text class="ann b" x="${px}" y="20">Vue en plan du panneau</text>`;
  o += `<rect class="pan${on("b") || on("a") ? " hl" : ""}" x="${px}" y="${py}" width="${pw}" height="${ph}"/>`;
  o += `<rect class="beam" x="${px - 6}" y="${py - 10}" width="${pw + 12}" height="10"/><rect class="beam" x="${px - 6}" y="${py + ph}" width="${pw + 12}" height="10"/>`;
  o += `<rect class="ent" x="${px - 12}" y="${py - 10}" width="12" height="${ph + 20}"/><rect class="ent" x="${px + pw}" y="${py - 10}" width="12" height="${ph + 20}"/>`;
  o += hd(px, px + pw, py + ph + 32, L(mode, "b", mode === "p" ? 20 : h.bEnt), on("b"), [py + ph + 10, py + ph + 10]);
  o += vd(px + pw + 26, py, py + ph, L(mode, "a", a), on("a"), "r", [px + pw + 12, px + pw + 12]);
  o += `<text class="ann" x="${px + pw / 2}" y="${py + ph / 2 + 4}" text-anchor="middle">${mode === "p" ? "Ma (transversal) · Mb (longitudinal)" : "E = 3/4 e + 1/2 h = " + f2(0.75 * h.e + 0.5 * h.hmin, 3)}</text>`;
  return svg(W, Hh, `<defs><pattern id="hx2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hxb" width="5" height="5"/><line class="hxl" x1="0" y1="0" x2="0" y2="5"/></pattern></defs>` + o);
}

// ------------------------------------------------------------------ 7. Entretoise (principe du vérinage)
export function entPrincipeSVG(hl = "") {
  const W = 640, Hh = 250, xl = 50, xr = 590, y = 90;
  let o = `<rect class="slab" x="${xl}" y="${y}" width="${xr - xl}" height="16"/>`;
  const beams = [0.1, 0.3, 0.5, 0.7, 0.9].map(f => xl + f * (xr - xl));
  beams.forEach(x => (o += `<line class="load" x1="${x}" y1="${y - 40}" x2="${x}" y2="${y - 4}"/><polygon class="arrowh" points="${x - 4},${y - 10} ${x + 4},${y - 10} ${x},${y - 2}"/><text class="ann" x="${x}" y="${y - 46}" text-anchor="middle">P</text>`));
  const jacks = [0.2, 0.42, 0.58, 0.8].map(f => xl + f * (xr - xl));
  jacks.forEach((x, i) => (o += `<polygon class="jack${hl === "V" ? " hl" : ""}" points="${x},${y + 16} ${x - 8},${y + 34} ${x + 8},${y + 34}"/><text class="code" x="${x}" y="${y + 48}" text-anchor="middle">V${i + 1}</text>`));
  const xc = (xl + xr) / 2;
  o += `<line class="axis" x1="${xc}" y1="${y - 54}" x2="${xc}" y2="${y + 110}"/>`;
  o += hd(xc, jacks[3], y + 74, "x(V4)", hl === "V", [y + 34, y + 34]);
  o += hd(xl, xr, y + 104, "ENTB", hl === "ENTB", [y + 16, y + 16]);
  o += vd(xr + 12, y, y + 16, "HENT", hl === "HENT", "r");
  o += `<text class="ann" x="${xl}" y="${Hh - 8}">Positions des vérins comptées depuis l'axe ; P : réaction d'une poutre sous charges permanentes</text>`;
  return svg(W, Hh, o);
}

// ------------------------------------------------------------------ 8. Dallette de continuité
export function dalletteSVG(P: Projet, mode: Mode, hl = "") {
  const d = P.compl.dallette, W = 640, Hh = 290, on = (c: string) => hl === c;
  const Ld = mode === "p" ? 1.1 : d.L, H = mode === "p" ? 0.15 : d.H;
  const s = 260 / Math.max(Ld, 0.6), cx = 320, y0 = 90, hD = Math.max(22, H * s * 1.2);
  const x1 = cx - (Ld / 2) * s, x2 = cx + (Ld / 2) * s;
  let o = "";
  o += `<rect class="slab" x="40" y="${y0}" width="${x1 - 40}" height="${hD + 14}"/><rect class="slab" x="${x2}" y="${y0}" width="${600 - x2}" height="${hD + 14}"/>`;
  o += `<rect class="beam" x="40" y="${y0 + hD + 14}" width="${x1 - 50}" height="70"/><rect class="beam" x="${x2 + 10}" y="${y0 + hD + 14}" width="${600 - x2 - 10}" height="70"/>`;
  o += `<rect class="dc" x="${x1}" y="${y0}" width="${x2 - x1}" height="${hD}"/>`;
  o += `<rect class="pier" x="${cx - 40}" y="${y0 + hD + 84}" width="80" height="60"/>`;
  const ys = y0 + 7, yi = y0 + hD - 7;
  o += `<line class="rbar${on("AS") ? " hl" : ""}" x1="${x1 - 60}" y1="${ys}" x2="${x2 + 60}" y2="${ys}"/><line class="rbar${on("AI") ? " hl" : ""}" x1="${x1 - 40}" y1="${yi}" x2="${x2 + 40}" y2="${yi}"/>`;
  o += hd(x1, x2, y0 - 16, L(mode, "LDC", Ld, 3), on("LDC"), [y0, y0]);
  o += vd(x2 + 80, y0, y0 + hD, L(mode, "HDC", H, 3), on("HDC"), "r", [x2 + 60, x2 + 60]);
  o += `<text class="ann" x="${x1 - 60}" y="${y0 - 4}">${mode === "p" ? "AS (aciers supérieurs)" : `sup. : HA${d.As[0]}/${d.As[1]} + HA${d.As[2]}/${d.As[3]}`}</text>`;
  o += `<text class="ann" x="${cx}" y="${y0 + hD + 30}" text-anchor="middle">${mode === "p" ? "AI (aciers inférieurs)" : `inf. : HA${d.Ai[0]}/${d.Ai[1]} + HA${d.Ai[2]}/${d.Ai[3]}`}</text>`;
  o += `<text class="ann" x="${cx}" y="${y0 + hD + 160}" text-anchor="middle">${mode === "p" ? "Tassement différentiel T de l'appui intermédiaire" : "Tassement différentiel : " + f2(d.T * 100, 1) + " cm"}</text>`;
  return svg(W, Hh, o);
}
