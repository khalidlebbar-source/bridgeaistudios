// Interface du module PPBA — BridgeAI Studios
import { projetExemple, Projet, TraveeDef } from "../engine/project";
import { NOTE_CSS } from "../engine/note";
import { SuperElt } from "../engine/complements";

const $ = (s: string, r: ParentNode = document) => r.querySelector(s) as HTMLElement;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const fx = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d).replace(".", ",") : "—");
const STORE = "bai-ppba-v1";

let P: Projet = load() ?? clone(projetExemple);
let step = "ouvrage";
let lastRes: any = null;
let worker: Worker | null = null;

function load(): Projet | null { try { const s = localStorage.getItem(STORE); return s ? JSON.parse(s) : null; } catch { return null; } }
function save() { try { localStorage.setItem(STORE, JSON.stringify(P)); } catch { /* stockage indisponible */ } }
const get = (path: string): any => path.split(".").reduce((o: any, k) => (o == null ? o : o[k]), P);
function set(path: string, v: any) { const ks = path.split("."); let o: any = P; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; save(); }

// ------------------------------------------------------------------ champs
type Fld = { p: string; l: string; u?: string; c?: string; t?: "num" | "text" | "chk" | "sel"; opts?: [string, string][]; step?: number };
function field(f: Fld) {
  const v = get(f.p), id = "f_" + f.p.replace(/\./g, "_");
  const code = f.c ? `<span class="code">${f.c}</span>` : "";
  if (f.t === "chk") return `<label class="chk"><input type="checkbox" data-p="${f.p}" data-t="chk" ${v ? "checked" : ""}/> ${f.l}</label>`;
  if (f.t === "sel") return `<div class="field"><label for="${id}">${f.l} ${code}</label><select id="${id}" data-p="${f.p}" data-t="sel" class="usr">${f.opts!.map(([k, l]) => `<option value="${k}" ${String(v) === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>`;
  const type = f.t === "text" ? "text" : "number";
  return `<div class="field" data-code="${f.c ?? ""}"><label for="${id}">${f.l} ${code}</label><div class="fu"><input id="${id}" class="usr" type="${type}" ${type === "number" ? `step="${f.step ?? "any"}"` : ""} data-p="${f.p}" data-t="${f.t ?? "num"}" value="${v ?? ""}"/>${f.u ? `<span class="fu-unit">${f.u}</span>` : ""}</div></div>`;
}
const grid = (n: number, fs: Fld[]) => `<div class="grid${n}">${fs.map(field).join("")}</div>`;
const card = (title: string, body: string) => `<div class="card"><div class="card-title">${title}</div>${body}</div>`;
const derived = (rows: [string, string][]) => `<div class="derived">${rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join("")}</div>`;

// ------------------------------------------------------------------ croquis
function deckSketch(active = "") {
  const g = P.base, W = 640, Hh = 230, s = Math.min(54, (W - 70) / g.Lh), cx = W / 2, top = 46;
  const H = g.hs2 + g.hame + g.ht2, X = (y: number) => cx + y * s, Y = (z: number) => top + z * s;
  const hi = (c: string) => (active === c ? " hi" : "");
  let beams = "";
  for (let i = 0; i < g.n; i++) {
    const y = (i - (g.n - 1) / 2) * g.e;
    const pts = [[-g.bs / 2, 0], [g.bs / 2, 0], [g.bs / 2, g.hs1], [g.b0m / 2, g.hs2], [g.b0m / 2, H - g.ht2], [g.bt / 2, H - g.ht1], [g.bt / 2, H], [-g.bt / 2, H], [-g.bt / 2, H - g.ht1], [-g.b0m / 2, H - g.ht2], [-g.b0m / 2, g.hs2], [-g.bs / 2, g.hs1]];
    beams += `<polygon class="beam" points="${pts.map(([a, b]) => `${X(y + a).toFixed(1)},${Y(g.hd + b).toFixed(1)}`).join(" ")}"/>`;
  }
  const rl = -g.Lh / 2 + g.trG, rr = g.Lh / 2 - g.trD;
  const dim = (x1: number, x2: number, yy: number, txt: string, c: string) => `<g class="dim${hi(c)}"><line x1="${x1}" x2="${x2}" y1="${yy}" y2="${yy}"/><line x1="${x1}" x2="${x1}" y1="${yy - 4}" y2="${yy + 4}"/><line x1="${x2}" x2="${x2}" y1="${yy - 4}" y2="${yy + 4}"/><text x="${(x1 + x2) / 2}" y="${yy - 5}" text-anchor="middle">${txt}</text></g>`;
  const e0 = X(0), e1 = X(g.e);
  return `<svg viewBox="0 0 ${W} ${Hh}" class="sketch" aria-label="Coupe transversale du tablier">
    <rect class="slab" x="${X(-g.Lh / 2)}" y="${Y(0)}" width="${g.Lh * s}" height="${g.hd * s}"/>
    <rect class="trot" x="${X(-g.Lh / 2)}" y="${Y(0) - 8}" width="${g.trG * s}" height="8"/><rect class="trot" x="${X(rr)}" y="${Y(0) - 8}" width="${g.trD * s}" height="8"/>
    ${beams}
    ${dim(X(-g.Lh / 2), X(g.Lh / 2), 14, fx(g.Lh, 2), "LH")}
    ${dim(X(-g.Lh / 2), X(rl), 32, fx(g.trG, 2), "TRG")}${dim(X(rl), X(rr), 32, fx(rr - rl, 2), "LR")}${g.trD > 0.05 ? dim(X(rr), X(g.Lh / 2), 32, fx(g.trD, 2), "TRD") : ""}
    ${dim(e0, e1, Y(g.hd + H) + 22, fx(g.e, 2), "E")}
    <g class="dim${hi("HD")}"><text x="${X(g.Lh / 2) + 6}" y="${Y(g.hd / 2) + 4}">${fx(g.hd, 2)}</text></g>
    <text class="lbl" x="${X(0)}" y="${Y(g.hd + H) + 42}" text-anchor="middle">${g.n} poutres — chaussée ${fx(rr - rl, 2)} m</text>
  </svg>`;
}
function beamSketch(active = "") {
  const g = P.base, H = g.hs2 + g.hame + g.ht2, s = 150, W = 420, Hh = H * s + 60, cx = 170, top = 30;
  const X = (x: number) => cx + x * s, Y = (y: number) => top + y * s, hi = (c: string) => (active === c ? " hi" : "");
  const pts = [[-g.bs / 2, 0], [g.bs / 2, 0], [g.bs / 2, g.hs1], [g.b0m / 2, g.hs2], [g.b0m / 2, H - g.ht2], [g.bt / 2, H - g.ht1], [g.bt / 2, H], [-g.bt / 2, H], [-g.bt / 2, H - g.ht1], [-g.b0m / 2, H - g.ht2], [-g.b0m / 2, g.hs2], [-g.bs / 2, g.hs1]];
  const hd = (x1: number, x2: number, y: number, t: string, c: string) => `<g class="dim${hi(c)}"><line x1="${X(x1)}" x2="${X(x2)}" y1="${y}" y2="${y}"/><line x1="${X(x1)}" x2="${X(x1)}" y1="${y - 4}" y2="${y + 4}"/><line x1="${X(x2)}" x2="${X(x2)}" y1="${y - 4}" y2="${y + 4}"/><text x="${(X(x1) + X(x2)) / 2}" y="${y - 5}" text-anchor="middle">${t}</text></g>`;
  const vd = (x: number, y1: number, y2: number, t: string, c: string) => `<g class="dim${hi(c)}"><line x1="${x}" x2="${x}" y1="${Y(y1)}" y2="${Y(y2)}"/><line x1="${x - 4}" x2="${x + 4}" y1="${Y(y1)}" y2="${Y(y1)}"/><line x1="${x - 4}" x2="${x + 4}" y1="${Y(y2)}" y2="${Y(y2)}"/><text x="${x + 6}" y="${(Y(y1) + Y(y2)) / 2 + 4}">${t}</text></g>`;
  const xr = X(g.bs / 2) + 18;
  return `<svg viewBox="0 0 ${W} ${Hh}" class="sketch" aria-label="Coupe de la poutre">
    <polygon class="beam" points="${pts.map(([a, b]) => `${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join(" ")}"/>
    ${hd(-g.bs / 2, g.bs / 2, top - 10, fx(g.bs, 2), "BS")}${hd(-g.bt / 2, g.bt / 2, Y(H) + 18, fx(g.bt, 2), "BT")}${hd(-g.b0m / 2, g.b0m / 2, Y(H / 2), fx(g.b0m, 2), "B0")}
    ${vd(xr, 0, g.hs1, fx(g.hs1, 2), "HS1")}${vd(xr + 46, 0, g.hs2, fx(g.hs2, 2), "HS2")}${vd(xr, g.hs2, g.hs2 + g.hame, fx(g.hame, 2), "HAME")}
    ${vd(xr, H - g.ht1, H, fx(g.ht1, 2), "HT1")}${vd(xr + 46, H - g.ht2, H, fx(g.ht2, 2), "HT2")}
    <text class="lbl" x="${X(-g.bs / 2) - 6}" y="${Y(H / 2)}" text-anchor="end">H = ${fx(H, 2)}</text>
  </svg>`;
}
function jackSketch() {
  const g = P.base, W = 640, Hh = 120, s = (W - 60) / g.Lh, cx = W / 2, X = (y: number) => cx + y * s;
  const v = P.compl.entretoise.verins, jacks = [...v.map(x => -x), ...v];
  let out = `<rect class="slab" x="${X(-g.Lh / 2)}" y="40" width="${g.Lh * s}" height="22"/>`;
  for (let i = 0; i < g.n; i++) { const y = (i - (g.n - 1) / 2) * g.e; out += `<line class="load" x1="${X(y)}" x2="${X(y)}" y1="8" y2="38"/><polygon class="arrow" points="${X(y) - 4},32 ${X(y) + 4},32 ${X(y)},39"/>`; }
  for (const j of jacks) out += `<polygon class="jack" points="${X(j)},63 ${X(j) - 7},80 ${X(j) + 7},80"/><text class="dimt" x="${X(j)}" y="96" text-anchor="middle">${fx(Math.abs(j), 2)}</text>`;
  return `<svg viewBox="0 0 ${W} ${Hh}" class="sketch" aria-label="Vérinage de l'entretoise">${out}<text class="lbl" x="${cx}" y="114" text-anchor="middle">Vérins (cotes depuis l'axe du tablier) — charges des poutres</text></svg>`;
}

// ------------------------------------------------------------------ étapes
const STEPS: { id: string; lbl: string; grp: string }[] = [
  { id: "ouvrage", lbl: "Ouvrage et matériaux", grp: "Données" },
  { id: "tablier", lbl: "Coupe transversale", grp: "Données" },
  { id: "poutre", lbl: "Poutre", grp: "Données" },
  { id: "super", lbl: "Superstructures", grp: "Données" },
  { id: "travees", lbl: "Travées et ferraillage", grp: "Données" },
  { id: "hourdis", lbl: "Hourdis (Thénoz)", grp: "Données" },
  { id: "annexes", lbl: "Dallette, entretoises, levage", grp: "Données" },
  { id: "synth", lbl: "Synthèse", grp: "Résultats" },
  { id: "note", lbl: "Note de calcul", grp: "Résultats" },
];

function viewOuvrage() {
  return card("Projet", grid(2, [{ p: "base.projet", l: "Projet", t: "text" }, { p: "base.ouvrage", l: "Ouvrage", t: "text" }])) +
    card("Matériaux", grid(4, [{ p: "base.fc28", l: "fc28", u: "MPa", c: "FC28" }, { p: "base.fe", l: "Aciers HA fe", u: "MPa", c: "FE" }, { p: "base.feDX", l: "Aciers doux fe", u: "MPa", c: "FEDX" },
      { p: "base.fiss", l: "Fissuration", t: "sel", opts: [["PP", "Peu préjudiciable"], ["P", "Préjudiciable"], ["TP", "Très préjudiciable"]] }, { p: "base.gb", l: "Poids volumique du béton", u: "kN/m³", c: "GB" }])) +
    card("Chargements (fascicule 61 titre II)", `<div class="chks">${[["AL", "A(l)"], ["Bc", "Bc"], ["Bt", "Bt"], ["Br", "Br"], ["Mc120", "Mc120"], ["Me120", "Me120"], ["D", "Convoi D"], ["E", "Convoi E"]].map(([k, l]) => field({ p: "base.charges." + k, l, t: "chk" })).join("")}</div>` +
      grid(3, [{ p: "base.qtr", l: "Charge générale de trottoir", u: "kN/m²", c: "QTR" }]) +
      `<div class="chks">${field({ p: "base.DEcentre", l: "Convois D et E circulant dans l'axe du tablier", t: "chk" })}${field({ p: "base.compat", l: "Conventions du programme de référence (.LIR) pour l'effort tranchant", t: "chk" })}</div>`);
}
function viewTablier() {
  const g = P.base, Lr = g.Lh - g.trG - g.trD, cl = Lr >= 7 ? 1 : Lr > 5.5 ? 2 : 3;
  return `<div class="schema">${deckSketch()}</div>` + card("Coupe transversale", grid(3, [{ p: "base.n", l: "Nombre de poutres", c: "N", step: 1 }, { p: "base.e", l: "Entraxe des poutres", u: "m", c: "E" }, { p: "base.Lh", l: "Largeur de l'hourdis", u: "m", c: "LH" },
    { p: "base.hd", l: "Épaisseur de l'hourdis", u: "m", c: "HD" }, { p: "base.trG", l: "Trottoir gauche", u: "m", c: "TRG" }, { p: "base.trD", l: "Trottoir droit", u: "m", c: "TRD" }]) +
    derived([["Largeur roulable", fx(Lr, 2) + " m"], ["Classe du pont", String(cl)], ["Nombre de voies", String(Math.max(1, Math.floor(Lr / 3)))], ["Débord sur les poutres de rive", fx((g.Lh - (g.n - 1) * g.e) / 2, 2) + " m"]]));
}
function viewPoutre() {
  return `<div class="schema">${beamSketch()}</div>` + card("Poutre préfabriquée", grid(3, [
    { p: "base.bs", l: "Largeur de la semelle", u: "m", c: "BS" }, { p: "base.hs1", l: "Hauteur min. de la semelle", u: "m", c: "HS1" }, { p: "base.hs2", l: "Hauteur max. de la semelle", u: "m", c: "HS2" },
    { p: "base.b0", l: "Largeur de l'âme sur appui", u: "m", c: "B0" }, { p: "base.b0m", l: "Largeur de l'âme à mi-travée", u: "m", c: "B0" }, { p: "base.hame", l: "Hauteur de l'âme", u: "m", c: "HAME" },
    { p: "base.bt", l: "Largeur du talon", u: "m", c: "BT" }, { p: "base.ht1", l: "Hauteur min. du talon", u: "m", c: "HT1" }, { p: "base.ht2", l: "Hauteur max. du talon", u: "m", c: "HT2" }])) +
    card("Entretoises d'about", grid(4, [{ p: "base.ent.b", l: "Largeur", u: "m" }, { p: "base.ent.h", l: "Hauteur sous hourdis", u: "m" }, { p: "base.ent.ep", l: "Épaisseur", u: "m" }, { p: "base.ent.nb", l: "Nombre par travée", step: 1 }]));
}
function viewSuper() {
  const rows = P.compl.superstructures;
  const tot = superTot();
  const inp = (i: number, k: keyof SuperElt, w = 64) => `<input class="usr cell" style="width:${w}px" data-row="${i}" data-k="${k}" value="${rows[i][k] ?? ""}"/>`;
  return card("Éléments de superstructure (t/ml)", `<div class="tscroll"><table class="ed"><thead><tr><th>Élément</th><th>Côté</th><th>Poids (t/ml)</th><th>S (m²)</th><th>a (m)</th><th>b (m)</th><th>γ (t/m³)</th><th>k min</th><th>k max</th><th></th></tr></thead><tbody>${rows.map((r, i) =>
    `<tr><td>${inp(i, "nom", 230)}</td><td><select class="usr cell" data-row="${i}" data-k="cote">${[["D", "Droit"], ["G", "Gauche"], ["C", "Central"], ["S", "Surface"]].map(([k, l]) => `<option value="${k}" ${r.cote === k ? "selected" : ""}>${l}</option>`).join("")}</select></td><td>${inp(i, "poids")}</td><td>${inp(i, "S")}</td><td>${inp(i, "a")}</td><td>${inp(i, "b")}</td><td>${inp(i, "g", 52)}</td><td>${inp(i, "kmin", 48)}</td><td>${inp(i, "kmax", 48)}</td><td><button class="mini" data-del="${i}" title="Supprimer">×</button></td></tr>`).join("")}</tbody></table></div><button class="btn-secondary" id="addSup">Ajouter un élément</button>`) +
    card("Revêtement et rechargement", grid(3, [{ p: "compl.revetement.larg", l: "Largeur", u: "m" }, { p: "compl.revetement.emin", l: "Épaisseur min.", u: "m" }, { p: "compl.revetement.emax", l: "Épaisseur max.", u: "m" }, { p: "compl.revetement.g", l: "γ", u: "t/m³" }, { p: "compl.revetement.kmin", l: "k min" }, { p: "compl.revetement.kmax", l: "k max" }])) +
    card("Totaux", derived([["Probable", fx(tot.prob, 3) + " t/ml"], ["Minimal", fx(tot.min, 3) + " t/ml"], ["Maximal", fx(tot.max, 3) + " t/ml"]]) +
      grid(3, [{ p: "base.qsup", l: "Superstructures retenues pour les poutres", u: "kN/ml", c: "QSUP" }]) + `<button class="btn-secondary" id="useMax">Reporter le total maximal (${fx(tot.max * 10, 2)} kN/ml)</button>`);
}
function superTot() {
  let prob = 0, min = 0, max = 0;
  for (const e of P.compl.superstructures) { const S = e.S ?? (e.a != null && e.b != null ? e.a * e.b : 0); const p = e.poids ?? S * (e.g ?? 0); prob += p; min += p * e.kmin; max += p * e.kmax; }
  const r = P.compl.revetement; prob += r.larg * r.emin * r.g; min += r.larg * r.emin * r.g * r.kmin; max += r.larg * r.emax * r.g * r.kmax;
  return { prob, min, max };
}
function viewTravees() {
  const t = P.travees;
  const row = (tr: TraveeDef, i: number) => `<tr><td><input class="usr cell" style="width:150px" data-tr="${i}" data-k="nom" value="${tr.nom}"/></td>
    <td><input class="usr cell" style="width:64px" data-tr="${i}" data-k="L" value="${tr.L}"/></td><td><input class="usr cell" style="width:64px" data-tr="${i}" data-k="Lpoutre" value="${tr.Lpoutre}"/></td>
    <td><input class="usr cell" style="width:110px" data-tr="${i}" data-k="lits" value="${(tr.lits ?? []).join(", ")}" placeholder="auto"/></td><td><input class="usr cell" style="width:52px" data-tr="${i}" data-k="diamCadre" value="${tr.diamCadre}"/></td>
    <td><input class="usr cell" style="width:200px" data-tr="${i}" data-k="cadres" value="${tr.cadres.map(c => `${c.diam}/${c.diam2}/${c.esp}`).join(" ; ")}"/></td>
    <td><input class="usr cell" style="width:56px" data-tr="${i}" data-k="cfRetenu" value="${tr.cfRetenu ?? ""}" placeholder="auto"/></td><td><button class="mini" data-deltr="${i}" title="Supprimer">×</button></td></tr>`;
  return card("Types de travées", `<div class="tscroll"><table class="ed"><thead><tr><th>Nom</th><th>Portée (m)</th><th>Long. poutre (m)</th><th>Barres par lit (bas → haut)</th><th>Ø cadre (cm)</th><th>Cadres par zone 0 → 0,4 L : Ø cadre / Ø étrier / esp. (cm)</th><th>CF (mm)</th><th></th></tr></thead><tbody>${t.map(row).join("")}</tbody></table></div>
    <p class="hint">Laisser « barres par lit » vide pour un dimensionnement automatique ; la contre-flèche vide est arrondie automatiquement.</p><button class="btn-secondary" id="addTr">Ajouter une travée</button>`) +
    card("Ferraillage longitudinal des poutres", grid(4, [{ p: "compl.poutre.diam", l: "Diamètre des barres", u: "mm" }, { p: "compl.poutre.parLit", l: "Barres max. par lit", step: 1 }, { p: "compl.poutre.enrobage", l: "Enrobage inférieur", u: "cm" }, { p: "compl.poutre.ecarteur", l: "Écarteur entre paires de lits", u: "cm" },
      { p: "compl.poutre.scellement", l: "Scellement", u: "Φ" }, { p: "compl.poutre.bTable", l: "Largeur de table (phase 2)", u: "m" }, { p: "compl.poutre.bPhase1", l: "Hourdis porté en phase 1", u: "m" }, { p: "compl.poutre.aAppui", l: "Appui diffusé jusqu'au talon (a)", u: "m" }])) +
    card("Contre-flèche", grid(3, [{ p: "compl.contreFleche.hdPhase1", l: "Épaisseur d'hourdis frais (prédalle comprise)", u: "m" }]));
}
function viewHourdis() {
  const h = "compl.hourdis";
  return card("Données géométriques et modélisation du panneau", grid(3, [{ p: h + ".e", l: "Étanchéité + revêtement e", u: "m" }, { p: h + ".hmax", l: "Épaisseur max. (poids)", u: "m" }, { p: h + ".hmin", l: "Épaisseur min. (ferraillage)", u: "m" },
    { p: h + ".a", l: "a (portée transversale)", u: "m" }, { p: h + ".bEnt", l: "b (entre nus des entretoises)", u: "m" }, { p: h + ".A", l: "A", u: "m" },
    { p: h + ".rev", l: "Revêtement", u: "m" }, { p: h + ".etanch", l: "Étanchéité", u: "m" }, { p: h + ".hTot", l: "Hourdis + prédalle", u: "m" }, { p: h + ".reduc", l: "Coefficient d'encastrement partiel" }])) +
    card("Lectures sur les abaques de Thénoz (kN·m/ml)", `<p class="hint">Valeurs lues sur les abaques pour le panneau (a, b, A, E) ; elles sont ensuite majorées par bc, bt et δ.</p>` + grid(4, [
      { p: h + ".abaques.MaBc", l: "Transv. Bc (abaque 9)" }, { p: h + ".abaques.MaBt", l: "Transv. Bt (abaque 10)" }, { p: h + ".abaques.MaMc", l: "Transv. Mc120 (abaque 35)" }, { p: h + ".abaques.MbBt", l: "Long. Bt (abaque 15)" },
      { p: h + ".abaques.MbBr", l: "Long. Br (abaque 20)" }, { p: h + ".abaques.MbBc", l: "Long. Bc (abaque 25)" }, { p: h + ".abaques.MpBc", l: "Appui poutre Bc (BT1 5)" }, { p: h + ".abaques.MpBt", l: "Appui poutre Bt (BT1 10)" },
      { p: h + ".abaques.MpMc", l: "Appui poutre Mc120 (BT1 27)" }, { p: h + ".abaques.MeBc", l: "Appui entretoise Bc (BT1 27 ter)" }, { p: h + ".abaques.MeMc", l: "Appui entretoise Mc120 (BT1 28)" }])) +
    card("Aciers de l'hourdis (Ø1 / Ø2 / espacement)", grid(4, [{ p: h + ".aciers.trInf.0", l: "Transv. inf. Ø1", u: "mm" }, { p: h + ".aciers.trInf.1", l: "Ø2", u: "mm" }, { p: h + ".aciers.trInf.2", l: "Esp.", u: "cm" }, { p: h + ".enrInf", l: "Enrobage inf.", u: "cm" },
      { p: h + ".aciers.trSup.0", l: "Transv. sup. Ø1", u: "mm" }, { p: h + ".aciers.trSup.1", l: "Ø2", u: "mm" }, { p: h + ".aciers.trSup.2", l: "Esp.", u: "cm" }, { p: h + ".enrSup", l: "Enrobage sup.", u: "cm" },
      { p: h + ".aciers.loInf.0", l: "Long. inf. Ø1", u: "mm" }, { p: h + ".aciers.loInf.1", l: "Ø2", u: "mm" }, { p: h + ".aciers.loInf.2", l: "Esp.", u: "cm" }, { p: h + ".predalle.ep", l: "Épaisseur prédalle", u: "m" },
      { p: h + ".aciers.loSup.0", l: "Long. sup. Ø1", u: "mm" }, { p: h + ".aciers.loSup.1", l: "Ø2", u: "mm" }, { p: h + ".aciers.loSup.2", l: "Esp.", u: "cm" }, { p: h + ".predalle.portee", l: "Portée prédalle", u: "m" }]));
}
function viewAnnexes() {
  const d = "compl.dallette", e = "compl.entretoise";
  return card("Dallette de continuité (bande de 1 m)", grid(4, [{ p: d + ".L", l: "Portée", u: "m" }, { p: d + ".H", l: "Hauteur", u: "m" }, { p: d + ".ch", l: "Enrobage aciers sup.", u: "m" }, { p: d + ".cb", l: "Enrobage aciers inf.", u: "m" },
    { p: d + ".As.0", l: "Sup. Ø1", u: "mm" }, { p: d + ".As.1", l: "Esp.", u: "cm" }, { p: d + ".As.2", l: "Sup. Ø2", u: "mm" }, { p: d + ".As.3", l: "Esp.", u: "cm" },
    { p: d + ".Ai.0", l: "Inf. Ø1", u: "mm" }, { p: d + ".Ai.1", l: "Esp.", u: "cm" }, { p: d + ".Ai.2", l: "Inf. Ø2", u: "mm" }, { p: d + ".Ai.3", l: "Esp.", u: "cm" }, { p: d + ".T", l: "Tassement différentiel", u: "m" }])) +
    `<div class="schema">${jackSketch()}</div>` + card("Entretoises — vérinage à vide", grid(4, [{ p: e + ".verins.0", l: "Vérin intérieur", u: "m" }, { p: e + ".verins.1", l: "Vérin médian", u: "m" }, { p: e + ".verins.2", l: "Vérin extérieur", u: "m" },
    { p: e + ".bEnt", l: "Épaisseur", u: "m" }, { p: e + ".Htot", l: "Hauteur (hourdis compris)", u: "m" }, { p: e + ".feSup", l: "fe fibre sup.", u: "MPa" }, { p: e + ".feInf", l: "fe fibre inf.", u: "MPa" }, { p: e + ".feCis", l: "fe cadres", u: "MPa" }])) +
    card("Levage et frettes", grid(4, [{ p: "compl.levage.fe", l: "fe aciers de levage", u: "MPa" }, { p: "compl.levage.diam", l: "Ø aciers de levage", u: "mm" }, { p: "compl.frettes.fe", l: "fe frettes", u: "MPa" }, { p: "compl.frettes.diam", l: "Ø frettes", u: "mm" }]));
}
function viewSynth() {
  if (!lastRes) return `<div class="card"><p>Lancez le calcul pour afficher les résultats.</p><button class="btn-primary" data-run>Calculer</button></div>`;
  const s = lastRes.synth;
  const cardV = (l: string, v: string, u = "", cls = "", note = "") => `<div class="res-card ${cls}"><div class="res-lbl">${l}</div><div class="res-val">${v}<span class="res-unit">${u}</span></div>${note ? `<div class="res-note">${note}</div>` : ""}</div>`;
  let h = s.alertes.length ? card("Points d'attention", s.alertes.map((a: any) => `<div class="alert ${a.niveau}">${a.texte}</div>`).join("")) : "";
  for (const t of s.travees) {
    h += card(`${t.nom} — L = ${fx(t.L, 2)} m`, `<div class="res-grid">${cardV("M ELU max", fx(t.Mu, 0), " kN·m", "", t.MuComb)}${cardV("M ELS max", fx(t.Ms, 0), " kN·m", "hi", t.MsComb)}${cardV("V ELU appui", fx(t.Vu, 0), " kN", "", t.VuComb)}${cardV("θ / α", fx(t.theta, 3) + " / " + fx(t.alpha, 3))}
      ${cardV("Aciers", t.lits.reduce((a: number, b: number) => a + b, 0) + " HA" + t.diam, "", "", t.lits.join(" + ") + " — " + fx(t.As, 1) + " cm²")}${cardV("σs cumulée", fx(t.cumul, 0), " / " + fx(t.ssl, 0) + " MPa", t.okF ? "" : "ko")}${cardV("Flèche globale", fx(t.cf, 1), " mm", "", "contre-flèche " + t.cfRetenu + " mm")}</div>
      <table class="ctable"><thead><tr><th>x/L</th><th>M ELU</th><th>Comb.</th><th>T ELU</th><th>M ELS</th><th>T ELS</th><th>At/St requis</th><th>En place</th></tr></thead><tbody>${t.ELU.M.map((m: any, i: number) => `<tr><td>${fx(i / 10, 1)}</td><td>${fx(m.v, 0)}</td><td>${m.comb}</td><td>${fx(t.ELU.T[i].v, 0)}</td><td>${fx(t.ELS.M[i].v, 0)}</td><td>${fx(t.ELS.T[i].v, 0)}</td><td>${t.cis[i] ? fx(t.cis[i].req, 2) : ""}</td><td class="${t.cis[i] && !t.cis[i].ok ? "ko" : ""}">${t.cis[i] ? fx(t.cis[i].pose, 2) : ""}</td></tr>`).join("")}</tbody></table>`);
  }
  const H = s.hourdis, D = s.dallette, E = s.entretoise;
  h += card("Hourdis, dallette, entretoises", `<div class="res-grid">${cardV("Hourdis transv. inf.", fx(H.trInf.Apose, 2), " cm²/ml", H.trInf.ok ? "" : "ko", "requis " + fx(H.trInf.Acalc, 2))}${cardV("Hourdis transv. sup.", fx(H.trSup.Apose, 2), " cm²/ml", H.trSup.ok ? "" : "ko", "requis " + fx(H.trSup.Acalc, 2))}${cardV("Hourdis long. inf.", fx(H.loInf.Apose, 2), " cm²/ml", "", "requis " + fx(H.loInf.Acalc, 2))}${cardV("Hourdis long. sup.", fx(H.loSup.Apose, 2), " cm²/ml", "", "requis " + fx(H.loSup.Acalc, 2))}
    ${cardV("Dallette σs", fx(D.ss, 0), " / " + fx(D.ssl, 0) + " MPa", D.ss > D.ssl ? "ko" : "")}${cardV("Dallette σb", fx(D.sb, 1), " / " + fx(D.sbl, 1) + " MPa")}${cardV("Entretoise : acier sup. / inf.", fx(E.AsSup, 2) + " / " + fx(E.AsInf, 2), " cm²")}${cardV("Entretoise At/St", fx(E.AtSt, 2), " cm²/ml")}</div>
    <p class="hint">Calcul effectué en ${fx(s.ms / 1000, 1)} s.</p>`);
  return h;
}
function viewNote() {
  if (!lastRes) return `<div class="card"><p>Lancez le calcul pour produire la note.</p><button class="btn-primary" data-run>Calculer</button></div>`;
  return `<div class="actions noprint"><button class="btn-pdf" id="print">Imprimer / PDF</button><button class="btn-secondary" id="dlNote">Télécharger la note (.html)</button></div><article class="note" id="noteBody">${lastRes.note}</article>`;
}

// ------------------------------------------------------------------ rendu
function render() {
  const groups = Array.from(new Set(STEPS.map(s => s.grp)));
  $("#side").innerHTML = groups.map(g => `<div class="sidebar-section"><div class="sidebar-label">${g}</div>${STEPS.filter(s => s.grp === g).map((s, i) => `<div class="nav-item ${s.id === step ? "active" : ""}" data-step="${s.id}"><span class="nav-num">${g === "Données" ? i : "→"}</span><span class="nav-label">${s.lbl}</span></div>`).join("")}</div>`).join("") +
    `<div class="side-actions"><button class="btn-primary" data-run>Calculer</button><button class="btn-secondary" id="loadEx">Charger l'exemple</button><button class="btn-secondary" id="exportJ">Exporter (.json)</button><label class="btn-secondary file">Importer<input type="file" id="importJ" accept=".json" hidden/></label></div>`;
  const st = STEPS.find(s => s.id === step)!;
  const views: Record<string, () => string> = { ouvrage: viewOuvrage, tablier: viewTablier, poutre: viewPoutre, super: viewSuper, travees: viewTravees, hourdis: viewHourdis, annexes: viewAnnexes, synth: viewSynth, note: viewNote };
  $("#main").innerHTML = `<div class="page-header"><div class="page-eyebrow">PPBA · ${st.grp}</div><h1 class="page-title">${st.lbl}</h1></div><div id="status" class="status"></div>${views[step]()}`;
  bind();
}
function refreshSketch() {
  const sk = document.querySelector(".schema");
  if (!sk) return;
  if (step === "tablier") sk.innerHTML = deckSketch(); else if (step === "poutre") sk.innerHTML = beamSketch(); else if (step === "annexes") sk.innerHTML = jackSketch();
}
function bind() {
  document.querySelectorAll<HTMLElement>("[data-step]").forEach(el => (el.onclick = () => { step = el.dataset.step!; render(); window.scrollTo(0, 0); }));
  document.querySelectorAll<HTMLElement>("[data-run]").forEach(el => (el.onclick = run));
  document.querySelectorAll<HTMLInputElement>("[data-p]").forEach(el => {
    el.onchange = el.oninput = () => {
      const t = el.dataset.t, p = el.dataset.p!;
      if (t === "chk") set(p, el.checked); else if (t === "text" || t === "sel") set(p, el.value); else { const v = parseFloat(el.value.replace(",", ".")); if (!isNaN(v)) set(p, v); }
      lastRes = null; refreshSketch();
      if (step === "tablier" || step === "super") { const d = document.querySelector(".derived"); if (d && el.type !== "checkbox" && (el as any)._t) clearTimeout((el as any)._t); (el as any)._t = setTimeout(() => { if (document.activeElement !== el) render(); }, 600); }
    };
    el.onfocus = () => { const code = el.closest(".field")?.getAttribute("data-code"); if (code && (step === "tablier" || step === "poutre")) { const sk = document.querySelector(".schema"); if (sk) sk.innerHTML = step === "tablier" ? deckSketch(code) : beamSketch(code); } };
  });
  document.querySelectorAll<HTMLInputElement>("[data-row]").forEach(el => (el.onchange = () => {
    const i = +el.dataset.row!, k = el.dataset.k as keyof SuperElt, row: any = P.compl.superstructures[i];
    if (k === "nom" || k === "cote") row[k] = el.value; else { const v = parseFloat(el.value.replace(",", ".")); if (isNaN(v)) delete row[k]; else row[k] = v; }
    save(); lastRes = null; render();
  }));
  document.querySelectorAll<HTMLElement>("[data-del]").forEach(el => (el.onclick = () => { P.compl.superstructures.splice(+el.dataset.del!, 1); save(); render(); }));
  const add = $("#addSup"); if (add) add.onclick = () => { P.compl.superstructures.push({ nom: "Nouvel élément", cote: "D", poids: 0, kmin: 0.95, kmax: 1.05 }); save(); render(); };
  const um = $("#useMax"); if (um) um.onclick = () => { P.base.qsup = Math.round(superTot().max * 1000) / 100; save(); render(); };
  document.querySelectorAll<HTMLInputElement>("[data-tr]").forEach(el => (el.onchange = () => {
    const tr: any = P.travees[+el.dataset.tr!], k = el.dataset.k!;
    if (k === "nom") tr.nom = el.value;
    else if (k === "lits") tr.lits = el.value.split(/[,; ]+/).map(Number).filter(n => n > 0);
    else if (k === "cadres") tr.cadres = el.value.split(";").map(s => s.trim().split("/").map(Number)).filter(a => a.length === 3 && a.every(n => n > 0)).map(([diam, diam2, esp]) => ({ diam, diam2, esp }));
    else if (k === "cfRetenu") { const v = parseFloat(el.value); tr.cfRetenu = isNaN(v) ? undefined : v; }
    else { const v = parseFloat(el.value.replace(",", ".")); if (!isNaN(v)) tr[k] = v; }
    save(); lastRes = null;
  }));
  document.querySelectorAll<HTMLElement>("[data-deltr]").forEach(el => (el.onclick = () => { if (P.travees.length > 1) { P.travees.splice(+el.dataset.deltr!, 1); save(); render(); } }));
  const at = $("#addTr"); if (at) at.onclick = () => { P.travees.push(clone(P.travees[P.travees.length - 1])); P.travees[P.travees.length - 1].nom += " (copie)"; save(); render(); };
  const le = $("#loadEx"); if (le) le.onclick = () => { P = clone(projetExemple); save(); lastRes = null; render(); };
  const ex = $("#exportJ"); if (ex) ex.onclick = () => download("ppba-projet.json", JSON.stringify(P, null, 2), "application/json");
  const im = $("#importJ") as HTMLInputElement; if (im) im.onchange = async () => { const f = im.files?.[0]; if (!f) return; try { P = JSON.parse(await f.text()); save(); lastRes = null; render(); } catch { status("Fichier illisible.", true); } };
  const pr = $("#print"); if (pr) pr.onclick = () => window.print();
  const dl = $("#dlNote"); if (dl) dl.onclick = () => download("note-ppba.html", `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Note de calcul PPBA</title><style>${NOTE_CSS}body{max-width:1000px;margin:24px auto;padding:0 16px}</style><body><article class="note">${lastRes.note}</article></body></html>`, "text/html");
}
function download(name: string, txt: string, type: string) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function status(msg: string, err = false) { const s = $("#status"); if (s) { s.textContent = msg; s.className = "status on" + (err ? " err" : ""); } }
function run() {
  status("Calcul en cours…");
  document.querySelectorAll<HTMLButtonElement>("[data-run]").forEach(b => (b.disabled = true));
  if (worker) worker.terminate();
  worker = new Worker((window as any).PPBA_WORKER || "ppba/ppba-worker.js");
  worker.onmessage = ev => {
    document.querySelectorAll<HTMLButtonElement>("[data-run]").forEach(b => (b.disabled = false));
    if (!ev.data.ok) { status("Erreur de calcul : " + ev.data.error.split("\n")[0], true); return; }
    lastRes = ev.data; step = "synth"; render(); window.scrollTo(0, 0);
  };
  worker.onerror = e => { status("Erreur : " + e.message, true); document.querySelectorAll<HTMLButtonElement>("[data-run]").forEach(b => (b.disabled = false)); };
  worker.postMessage({ projet: P });
}
const st = document.createElement("style"); st.textContent = NOTE_CSS; document.head.appendChild(st);
render();
