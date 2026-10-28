// Interface du module PPBA — BridgeAI Studios (saisie guidée au format VIPP-EL)
import { projetExemple, Projet } from "../engine/project";
import { NOTE_CSS } from "../engine/note";
import { SuperElt } from "../engine/complements";
import { verinage, verinsNormalises, dimEntretoise } from "../engine/verinage";
import { verinageSVG } from "../engine/verinage-svg";
import { poidsTravee } from "../engine/sollicitations";
import { deckSVG, beamSVG, spanSVG, rebarSVG, superSVG, hourdisSVG, entPrincipeSVG, dalletteSVG } from "./draw";

const $ = (s: string, r: ParentNode = document) => r.querySelector(s) as HTMLElement;
const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(document.querySelectorAll<T>(s as any)) as unknown as T[];
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const fx = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d).replace(".", ",").replace("-", "−") : "—");
const num = (s: string) => parseFloat(s.replace(",", ".").replace("−", "-"));
const STORE = "bai-ppba-v2";

let P: Projet = load() ?? clone(projetExemple);
let tab: "bord" | "res" | "note" = "bord";
let si = 0, page = 0, hl = "", ti = 0;
let lastRes: any = null, worker: Worker | null = null, busy = false;

function load(): Projet | null { try { const s = localStorage.getItem(STORE) ?? localStorage.getItem("bai-ppba-v1"); return s ? JSON.parse(s) : null; } catch { return null; } }
function save() { try { localStorage.setItem(STORE, JSON.stringify(P)); } catch { /* stockage indisponible */ } }
const get = (path: string): any => path.split(".").reduce((o: any, k) => (o == null ? o : o[k]), P);
function set(path: string, v: any) { const ks = path.split("."); let o: any = P; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; save(); lastRes = null; }
const HP = () => P.base.hs2 + P.base.hame + P.base.ht2;

// ------------------------------------------------------------------ définition des champs
interface Fld { c: string; l: string; u?: string; p?: string; t?: "num" | "text" | "sel" | "chk"; opts?: [string, string][]; lock?: boolean; der?: () => number | string; get?: () => number; set?: (v: number) => void; d?: number; w?: number }
interface Grp { t: string; f: Fld[] }
interface Page { n: string; g?: Grp[]; html?: () => string; bind?: () => void }
interface Step { n: string; sub: string; principe: () => string; reel: () => string; pages: Page[]; wtabs?: boolean; reelHtml?: boolean }

// paramètres saisis à l'étape 0, verrouillés ensuite
const S0: Record<string, Fld> = {
  N: { c: "N", l: "Nombre de poutres", p: "base.n", d: 0 },
  E: { c: "E", l: "Entraxe des poutres", u: "m", p: "base.e" },
  LH: { c: "LH", l: "Largeur de l'hourdis", u: "m", p: "base.Lh" },
  TRG: { c: "TRG", l: "Trottoir gauche", u: "m", p: "base.trG" },
  TRD: { c: "TRD", l: "Trottoir droit", u: "m", p: "base.trD" },
  HD: { c: "HD", l: "Épaisseur de l'hourdis", u: "m", p: "base.hd" },
  HP: { c: "HP", l: "Hauteur de la poutre", u: "m", get: HP, set: v => { P.base.hame = Math.max(0.05, v - P.base.hs2 - P.base.ht2); } },
};
const locked = (k: string): Fld => ({ ...S0[k], lock: true });
const Lr = () => P.base.Lh - P.base.trG - P.base.trD;
const nv = () => Math.max(1, Math.floor(Lr() / 3));
const classe = () => (Lr() >= 7 ? 1 : Lr() > 5.5 ? 2 : 3);

const STEPS: Step[] = [
  { n: "Dimensions principales", sub: "travers · poutre · hourdis", principe: () => deckSVG(P, "p", hl), reel: () => deckSVG(P, "r", hl),
    pages: [{ n: "Dimensions principales", g: [{ t: "Profil en travers (de gauche à droite)", f: [S0.TRG, S0.LH, S0.TRD, S0.N, S0.E] }, { t: "Hourdis et poutre", f: [S0.HD, S0.HP] },
      { t: "Déduit", f: [{ c: "LR", l: "Largeur roulable", u: "m", der: Lr }, { c: "DEB", l: "Débord sur les rives", u: "m", der: () => (P.base.Lh - (P.base.n - 1) * P.base.e) / 2 }] }] }] },
  { n: "Ouvrage", sub: "projet · matériaux · charges", principe: () => deckSVG(P, "p", hl), reel: () => deckSVG(P, "r", hl),
    pages: [
      { n: "Projet et matériaux", g: [{ t: "Projet", f: [{ c: "PROJ", l: "Projet", p: "base.projet", t: "text", w: 2 }, { c: "OUV", l: "Ouvrage", p: "base.ouvrage", t: "text" }] },
        { t: "Matériaux (BAEL 91)", f: [{ c: "FC28", l: "Béton fc28", u: "MPa", p: "base.fc28" }, { c: "FE", l: "Aciers HA", u: "MPa", p: "base.fe" }, { c: "FEDX", l: "Aciers doux", u: "MPa", p: "base.feDX" },
          { c: "FISS", l: "Fissuration", p: "base.fiss", t: "sel", opts: [["PP", "Peu préjudiciable"], ["P", "Préjudiciable"], ["TP", "Très préjudiciable"]] }, { c: "GB", l: "Poids volumique", u: "kN/m³", p: "base.gb" }] }] },
      { n: "Chargements", g: [{ t: "Fascicule 61 titre II", f: [["AL", "A(l)"], ["Bc", "Bc"], ["Bt", "Bt"], ["Br", "Br"], ["Mc120", "Mc120"], ["Me120", "Me120"], ["D", "Convoi D"], ["E", "Convoi E"]].map(([k, l]) => ({ c: k.toUpperCase(), l, p: "base.charges." + k, t: "chk" as const })) },
        { t: "Options", f: [{ c: "QTR", l: "Charge de trottoir", u: "kN/m²", p: "base.qtr" }, { c: "DE", l: "Convois D et E dans l'axe", p: "base.DEcentre", t: "chk" }, { c: "LIR", l: "Conventions de l'ancien programme .LIR", p: "base.compat", t: "chk" }] }] }] },
  { n: "Profil en travers", sub: "chaussée · voies", principe: () => deckSVG(P, "p", hl), reel: () => deckSVG(P, "r", hl),
    pages: [{ n: "Profil en travers", g: [{ t: "Saisi à l'étape 0", f: [locked("TRG"), locked("LH"), locked("TRD"), locked("N"), locked("E"), locked("HD")] },
      { t: "Chaussée", f: [{ c: "LR", l: "Largeur roulable", u: "m", der: Lr }, { c: "CL", l: "Classe du pont", der: () => String(classe()) }, { c: "NV", l: "Nombre de voies", der: () => String(nv()) }, { c: "V", l: "Largeur d'une voie", u: "m", der: () => Lr() / nv() }, { c: "QTR", l: "Charge de trottoir", u: "kN/m²", p: "base.qtr" }] }] }] },
  { n: "Poutre", sub: "section préfabriquée", principe: () => beamSVG(P, "p", hl), reel: () => beamSVG(P, "r", hl),
    pages: [{ n: "Poutre", g: [{ t: "Table de compression", f: [{ c: "BS", l: "Largeur de la semelle", u: "m", p: "base.bs" }, { c: "HS1", l: "Hauteur à la rive", u: "m", p: "base.hs1" }, { c: "HS2", l: "Hauteur au gousset", u: "m", p: "base.hs2" }] },
      { t: "Âme", f: [{ c: "B0", l: "Largeur sur appui", u: "m", p: "base.b0" }, { c: "B0M", l: "Largeur à mi-travée", u: "m", p: "base.b0m" }, { c: "HAME", l: "Hauteur de l'âme", u: "m", der: () => P.base.hame }] },
      { t: "Talon", f: [{ c: "BT", l: "Largeur du talon", u: "m", p: "base.bt" }, { c: "HT1", l: "Hauteur à la rive", u: "m", p: "base.ht1" }, { c: "HT2", l: "Hauteur au gousset", u: "m", p: "base.ht2" }] },
      { t: "Étape 0", f: [locked("HP")] }] }] },
  { n: "Travées", sub: "portées · entretoises", principe: () => spanSVG(P, "p", hl), reel: () => spanSVG(P, "r", hl),
    pages: [{ n: "Types de travées", html: travHtml, bind: travBind },
      { n: "Entretoises d'about", g: [{ t: "Entretoises", f: [{ c: "ENTB", l: "Longueur", u: "m", p: "base.ent.b" }, { c: "ENTH", l: "Hauteur sous hourdis", u: "m", p: "base.ent.h" }, { c: "ENTEP", l: "Épaisseur", u: "m", p: "base.ent.ep" }, { c: "NE", l: "Nombre par travée", p: "base.ent.nb", d: 0 }] }] }] },
  { n: "Superstructures", sub: "équipements · revêtement", principe: () => superSVG("p", hl), reel: () => deckSVG(P, "r", hl, { sup: true }) + `<div class="pan-foot">${supTotHtml()}</div>`,
    pages: [{ n: "Côté droit", html: () => supHtml("D"), bind: supBind }, { n: "Côté gauche", html: () => supHtml("G"), bind: supBind }, { n: "Centre et surface", html: () => supHtml("CS"), bind: supBind },
      { n: "Revêtement et total", g: [{ t: "Revêtement + rechargement", f: [{ c: "REV", l: "Largeur", u: "m", p: "compl.revetement.larg" }, { c: "REV", l: "Épaisseur min.", u: "m", p: "compl.revetement.emin" }, { c: "REV", l: "Épaisseur max.", u: "m", p: "compl.revetement.emax" }, { c: "REV", l: "γ", u: "t/m³", p: "compl.revetement.g" }, { c: "REV", l: "k min", p: "compl.revetement.kmin" }, { c: "REV", l: "k max", p: "compl.revetement.kmax" }] },
        { t: "Retenu pour les poutres", f: [{ c: "QSUP", l: "Superstructures", u: "kN/ml", p: "base.qsup" }] }], bind: () => { const b = $("#useMax"); if (b) b.onclick = () => { P.base.qsup = Math.round(superTot().max * 1000) / 100; save(); lastRes = null; render(); }; } }] },
  { n: "Ferraillage poutres", sub: "lits · cadres · épure", principe: () => rebarSVG(P, "p", hl), reel: () => rebarSVG(P, "r", hl, ti, autoLits()), wtabs: true,
    pages: [{ n: "Barres et cadres", html: ferHtml, bind: ferBind },
      { n: "Paramètres", g: [{ t: "Aciers longitudinaux", f: [{ c: "DIAM", l: "Diamètre des barres", u: "mm", p: "compl.poutre.diam", d: 0 }, { c: "LITS", l: "Barres max. par lit", p: "compl.poutre.parLit", d: 0 }, { c: "ENR", l: "Enrobage inférieur", u: "cm", p: "compl.poutre.enrobage" }, { c: "ECART", l: "Écarteur entre paires", u: "cm", p: "compl.poutre.ecarteur" }, { c: "LS", l: "Scellement", u: "Φ", p: "compl.poutre.scellement", d: 0 }] },
        { t: "Phasage et appui", f: [{ c: "BTAB", l: "Largeur de table (phase 2)", u: "m", p: "compl.poutre.bTable" }, { c: "BPH1", l: "Hourdis porté en phase 1", u: "m", p: "compl.poutre.bPhase1" }, { c: "HPH1", l: "Hourdis frais (contre-flèche)", u: "m", p: "compl.contreFleche.hdPhase1" }, { c: "AAPP", l: "Appui diffusé jusqu'au talon", u: "m", p: "compl.poutre.aAppui" }] }] }] },
  { n: "Hourdis", sub: "abaques de Thénoz", principe: () => hourdisSVG(P, "p", hl), reel: () => hourdisSVG(P, "r", hl),
    pages: [
      { n: "Panneau", g: [{ t: "Géométrie du panneau", f: [{ c: "a", l: "Portée transversale", u: "m", p: "compl.hourdis.a" }, { c: "b", l: "Entre nus des entretoises", u: "m", p: "compl.hourdis.bEnt" }, { c: "A", l: "Débord de la table", u: "m", p: "compl.hourdis.A" }, { c: "h", l: "Épaisseur min. (aciers)", u: "m", p: "compl.hourdis.hmin" }, { c: "h", l: "Épaisseur max. (poids)", u: "m", p: "compl.hourdis.hmax" }, { c: "RED", l: "Encastrement partiel", p: "compl.hourdis.reduc" }] },
        { t: "Charges permanentes", f: [{ c: "e", l: "Étanchéité + revêtement", u: "m", p: "compl.hourdis.e" }, { c: "e", l: "Revêtement", u: "m", p: "compl.hourdis.rev" }, { c: "e", l: "Étanchéité", u: "m", p: "compl.hourdis.etanch" }, { c: "h", l: "Hourdis + prédalle", u: "m", p: "compl.hourdis.hTot" }] }] },
      { n: "Abaques de Thénoz", g: [{ t: "Lectures sur les abaques (kN·m/ml), avant majoration par bc, bt et δ", f: [
        { c: "Ma", l: "Transv. Bc (9)", p: "compl.hourdis.abaques.MaBc" }, { c: "Ma", l: "Transv. Bt (10)", p: "compl.hourdis.abaques.MaBt" }, { c: "Ma", l: "Transv. Mc120 (35)", p: "compl.hourdis.abaques.MaMc" },
        { c: "Mb", l: "Long. Bt (15)", p: "compl.hourdis.abaques.MbBt" }, { c: "Mb", l: "Long. Br (20)", p: "compl.hourdis.abaques.MbBr" }, { c: "Mb", l: "Long. Bc (25)", p: "compl.hourdis.abaques.MbBc" },
        { c: "Mp", l: "Appui poutre Bc (BT1 5)", p: "compl.hourdis.abaques.MpBc" }, { c: "Mp", l: "Appui poutre Bt (BT1 10)", p: "compl.hourdis.abaques.MpBt" }, { c: "Mp", l: "Appui poutre Mc (BT1 27)", p: "compl.hourdis.abaques.MpMc" },
        { c: "Me", l: "Appui entretoise Bc (27 ter)", p: "compl.hourdis.abaques.MeBc" }, { c: "Me", l: "Appui entretoise Mc (28)", p: "compl.hourdis.abaques.MeMc" }] }] },
      { n: "Aciers", g: [
        { t: "Transversaux (Ø1 / Ø2 / esp.)", f: [{ c: "TI", l: "Inf. Ø1", u: "mm", p: "compl.hourdis.aciers.trInf.0", d: 0 }, { c: "TI", l: "Inf. Ø2", u: "mm", p: "compl.hourdis.aciers.trInf.1", d: 0 }, { c: "TI", l: "Inf. esp.", u: "cm", p: "compl.hourdis.aciers.trInf.2" }, { c: "TS", l: "Sup. Ø1", u: "mm", p: "compl.hourdis.aciers.trSup.0", d: 0 }, { c: "TS", l: "Sup. Ø2", u: "mm", p: "compl.hourdis.aciers.trSup.1", d: 0 }, { c: "TS", l: "Sup. esp.", u: "cm", p: "compl.hourdis.aciers.trSup.2" }] },
        { t: "Longitudinaux (Ø1 / Ø2 / esp.)", f: [{ c: "LI", l: "Inf. Ø1", u: "mm", p: "compl.hourdis.aciers.loInf.0", d: 0 }, { c: "LI", l: "Inf. Ø2", u: "mm", p: "compl.hourdis.aciers.loInf.1", d: 0 }, { c: "LI", l: "Inf. esp.", u: "cm", p: "compl.hourdis.aciers.loInf.2" }, { c: "LS", l: "Sup. Ø1", u: "mm", p: "compl.hourdis.aciers.loSup.0", d: 0 }, { c: "LS", l: "Sup. Ø2", u: "mm", p: "compl.hourdis.aciers.loSup.1", d: 0 }, { c: "LS", l: "Sup. esp.", u: "cm", p: "compl.hourdis.aciers.loSup.2" }] },
        { t: "Enrobages et prédalle", f: [{ c: "c", l: "Enrobage inf.", u: "cm", p: "compl.hourdis.enrInf" }, { c: "c", l: "Enrobage sup.", u: "cm", p: "compl.hourdis.enrSup" }, { c: "PD", l: "Épaisseur prédalle", u: "m", p: "compl.hourdis.predalle.ep" }, { c: "PD", l: "Portée prédalle", u: "m", p: "compl.hourdis.predalle.portee" }, { c: "PD", l: "Charge de chantier", u: "kN/m²", p: "compl.hourdis.predalle.chantier" }] }] }] },
  { n: "Entretoises", sub: "placement des vérins", principe: () => entPrincipeSVG(hl), reel: () => `<div id="vgBox" class="vg-box">${jackSVG()}</div>`, reelHtml: true,
    pages: [{ n: "Vérins", html: jackFields, bind: jackBind },
      { n: "Section", g: [{ t: "Section et aciers de l'entretoise", f: [{ c: "BENT", l: "Épaisseur", u: "m", p: "compl.entretoise.bEnt" }, { c: "HENT", l: "Hauteur (hourdis compris)", u: "m", p: "compl.entretoise.Htot" }, { c: "ENR", l: "Distance des aciers au parement", u: "m", p: "compl.entretoise.enr" },
        { c: "FES", l: "fe fibre sup.", u: "MPa", p: "compl.entretoise.feSup" }, { c: "FEI", l: "fe fibre inf.", u: "MPa", p: "compl.entretoise.feInf" }, { c: "FEC", l: "fe cadres", u: "MPa", p: "compl.entretoise.feCis" }] }] }] },
  { n: "Dallette et compléments", sub: "continuité · levage · frettes", principe: () => dalletteSVG(P, "p", hl), reel: () => dalletteSVG(P, "r", hl),
    pages: [
      { n: "Dallette de continuité", g: [{ t: "Géométrie", f: [{ c: "LDC", l: "Portée", u: "m", p: "compl.dallette.L" }, { c: "HDC", l: "Hauteur", u: "m", p: "compl.dallette.H" }, { c: "AS", l: "Enrobage aciers sup.", u: "m", p: "compl.dallette.ch" }, { c: "AI", l: "Enrobage aciers inf.", u: "m", p: "compl.dallette.cb" }, { c: "T", l: "Tassement différentiel", u: "m", p: "compl.dallette.T" }] },
        { t: "Aciers (Ø / esp.)", f: [{ c: "AS", l: "Sup. Ø1", u: "mm", p: "compl.dallette.As.0", d: 0 }, { c: "AS", l: "esp.", u: "cm", p: "compl.dallette.As.1" }, { c: "AS", l: "Sup. Ø2", u: "mm", p: "compl.dallette.As.2", d: 0 }, { c: "AS", l: "esp.", u: "cm", p: "compl.dallette.As.3" },
          { c: "AI", l: "Inf. Ø1", u: "mm", p: "compl.dallette.Ai.0", d: 0 }, { c: "AI", l: "esp.", u: "cm", p: "compl.dallette.Ai.1" }, { c: "AI", l: "Inf. Ø2", u: "mm", p: "compl.dallette.Ai.2", d: 0 }, { c: "AI", l: "esp.", u: "cm", p: "compl.dallette.Ai.3" }] }] },
      { n: "Levage et frettes", g: [{ t: "Levage des poutres", f: [{ c: "FEL", l: "fe aciers de levage", u: "MPa", p: "compl.levage.fe" }, { c: "ØL", l: "Ø aciers de levage", u: "mm", p: "compl.levage.diam", d: 0 }] },
        { t: "Frettes sous appareils d'appui", f: [{ c: "FEF", l: "fe frettes", u: "MPa", p: "compl.frettes.fe" }, { c: "ØF", l: "Ø frettes", u: "mm", p: "compl.frettes.diam", d: 0 }] }] }] },
];

// ------------------------------------------------------------------ champs
function fieldHtml(f: Fld) {
  const id = "f_" + (f.p ?? f.c).replace(/\W/g, "_");
  const code = `<code>${f.c}</code>`, unit = f.u ? `<em>${f.u}</em>` : "<em></em>", lab = `<span class="sf-l" title="${f.l}">${f.l}</span>`;
  const span = f.w ? ` style="grid-column:span ${f.w}"` : "";
  if (f.t === "chk") return `<label class="sf chk" data-code="${f.c}"${span}><input type="checkbox" data-p="${f.p}" data-t="chk" ${get(f.p!) ? "checked" : ""}/> <span>${f.l}</span></label>`;
  if (f.der) { const v = f.der(); return `<div class="sf" data-code="${f.c}"${span}>${code}${lab}${unit}<input id="${id}" class="der" readonly tabindex="-1" value="${typeof v === "number" ? fx(v, 3) : v}"/></div>`; }
  const v = f.get ? f.get() : get(f.p!);
  if (f.lock) return `<div class="sf" data-code="${f.c}"${span}>${code}${lab}${unit}<input id="${id}" class="lock" readonly tabindex="-1" title="Saisi à l'étape 0 · Dimensions principales" value="${typeof v === "number" ? fmtIn(v, f.d) : v}"/></div>`;
  if (f.t === "sel") return `<div class="sf" data-code="${f.c}"${span}>${code}${lab}${unit}<select id="${id}" class="usr" data-p="${f.p}" data-t="sel">${f.opts!.map(([k, l]) => `<option value="${k}" ${String(v) === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>`;
  const t = f.t === "text" ? "text" : "text";
  return `<div class="sf" data-code="${f.c}"${span}>${code}${lab}${unit}<input id="${id}" class="usr" type="${t}" inputmode="${f.t === "text" ? "text" : "decimal"}" ${f.p ? `data-p="${f.p}"` : `data-s0="${f.c}"`} data-t="${f.t ?? "num"}" value="${typeof v === "number" ? fmtIn(v, f.d) : v ?? ""}"/></div>`;
}
const fmtIn = (v: number, d?: number) => (d === 0 ? String(Math.round(v)) : String(+v.toFixed(4)));
const grpHtml = (g: Grp) => `<fieldset class="sg-g"><legend>${g.t}</legend><div class="sg-fs">${g.f.map(fieldHtml).join("")}</div></fieldset>`;

// ------------------------------------------------------------------ pages spéciales : travées
function travHtml() {
  return `<fieldset class="sg-g"><legend>Types de travées</legend><div class="sg-mx"><table class="ed"><thead><tr><th><code>NOM</code> Nom</th><th><code>L</code> Portée (m)</th><th><code>LP</code> Longueur de poutre (m)</th><th></th></tr></thead><tbody>${P.travees.map((t, i) =>
    `<tr><td><input class="usr" data-tr="${i}" data-k="nom" value="${t.nom}" style="width:180px"/></td><td><input class="usr" data-tr="${i}" data-k="L" data-code="L" value="${t.L}"/></td><td><input class="usr" data-tr="${i}" data-k="Lpoutre" data-code="LP" value="${t.Lpoutre}"/></td><td><button class="mini" data-deltr="${i}" title="Supprimer cette travée" ${P.travees.length < 2 ? "disabled" : ""}>×</button></td></tr>`).join("")}</tbody></table></div>
    <button class="btn-secondary sm" id="addTr">Ajouter un type de travée</button></fieldset>`;
}
function travBind() {
  $$<HTMLInputElement>("[data-tr]").forEach(el => (el.onchange = () => {
    const tr: any = P.travees[+el.dataset.tr!], k = el.dataset.k!;
    if (k === "nom") tr.nom = el.value; else { const v = num(el.value); if (!isNaN(v)) tr[k] = v; }
    save(); lastRes = null; renderPanels();
  }));
  $$("[data-deltr]").forEach(el => (el.onclick = () => { if (P.travees.length > 1) { P.travees.splice(+el.dataset.deltr!, 1); ti = 0; save(); lastRes = null; renderStep(); } }));
  const a = $("#addTr"); if (a) a.onclick = () => { const t = clone(P.travees[P.travees.length - 1]); t.nom += " (2)"; P.travees.push(t); save(); lastRes = null; renderStep(); };
}

// ------------------------------------------------------------------ pages spéciales : superstructures
function superTot() {
  let prob = 0, min = 0, max = 0;
  for (const e of P.compl.superstructures) { const S = e.S ?? (e.a != null && e.b != null ? e.a * e.b : 0); const p = e.poids ?? S * (e.g ?? 0); prob += p; min += p * e.kmin; max += p * e.kmax; }
  const r = P.compl.revetement; prob += r.larg * r.emin * r.g; min += r.larg * r.emin * r.g * r.kmin; max += r.larg * r.emax * r.g * r.kmax;
  return { prob, min, max };
}
function supTotHtml() { const t = superTot(); return `Superstructures : <b>${fx(t.prob, 3)}</b> t/ml probable · <b>${fx(t.min, 3)}</b> min · <b>${fx(t.max, 3)}</b> max · retenu pour les poutres : <b>${fx(P.base.qsup, 2)}</b> kN/ml`; }
const supCode = (n: string) => (/BN4|barri/i.test(n) ? "BN4" : /contre/i.test(n) ? "CCORN" : /corniche/i.test(n) ? "CORN" : /bordure/i.test(n) ? "BORD" : /maigre/i.test(n) ? "MAIGRE" : /chape|étanch/i.test(n) ? "CHAPE" : /revêt/i.test(n) ? "REV" : "");
function supHtml(side: "D" | "G" | "CS") {
  const rows = P.compl.superstructures.map((r, i) => ({ r, i })).filter(({ r }) => (side === "CS" ? r.cote === "C" || r.cote === "S" : r.cote === side));
  const inp = (i: number, k: keyof SuperElt, w = 64) => { const v = (P.compl.superstructures[i] as any)[k]; return `<input class="usr" style="width:${w}px" data-row="${i}" data-k="${k}" value="${v ?? ""}" placeholder="—"/>`; };
  return `<fieldset class="sg-g"><legend>${side === "D" ? "Éléments linéaires de rive droite" : side === "G" ? "Éléments linéaires de rive gauche" : "Éléments centraux et de surface"} (t/ml)</legend><div class="sg-mx"><table class="ed"><thead><tr><th>Élément</th>${side === "CS" ? "<th>Type</th>" : ""}<th>Poids</th><th>S (m²)</th><th>a (m)</th><th>b (m)</th><th>γ (t/m³)</th><th>k min</th><th>k max</th><th></th></tr></thead><tbody>${rows.map(({ r, i }) =>
    `<tr data-code="${supCode(r.nom)}"><td>${inp(i, "nom", 250)}</td>${side === "CS" ? `<td><select class="usr" data-row="${i}" data-k="cote"><option value="C" ${r.cote === "C" ? "selected" : ""}>Central</option><option value="S" ${r.cote === "S" ? "selected" : ""}>Surface</option></select></td>` : ""}<td>${inp(i, "poids")}</td><td>${inp(i, "S")}</td><td>${inp(i, "a")}</td><td>${inp(i, "b")}</td><td>${inp(i, "g", 52)}</td><td>${inp(i, "kmin", 48)}</td><td>${inp(i, "kmax", 48)}</td><td><button class="mini" data-del="${i}" title="Supprimer">×</button></td></tr>`).join("")}</tbody></table></div>
    <button class="btn-secondary sm" data-addsup="${side === "CS" ? "S" : side}">Ajouter un élément</button><span class="sg-note">Poids saisi directement, ou S × γ, ou a × b × γ.</span></fieldset>`;
}
function supBind() {
  $$<HTMLInputElement>("[data-row]").forEach(el => (el.onchange = () => {
    const i = +el.dataset.row!, k = el.dataset.k as keyof SuperElt, row: any = P.compl.superstructures[i];
    if (k === "nom" || k === "cote") row[k] = el.value; else { const v = num(el.value); if (isNaN(v)) delete row[k]; else row[k] = v; }
    save(); lastRes = null; renderPanels();
  }));
  $$<HTMLInputElement>("[data-row]").forEach(el => el.addEventListener("focus", () => setHl(el.closest("tr")?.getAttribute("data-code") ?? "")));
  $$("[data-del]").forEach(el => (el.onclick = () => { P.compl.superstructures.splice(+el.dataset.del!, 1); save(); lastRes = null; renderStep(); }));
  $$("[data-addsup]").forEach(el => (el.onclick = () => { P.compl.superstructures.push({ nom: "Nouvel élément", cote: el.dataset.addsup as any, poids: 0, kmin: 0.95, kmax: 1.05 }); save(); lastRes = null; renderStep(); }));
}

// ------------------------------------------------------------------ pages spéciales : ferraillage
function autoLits(): number[] | undefined { const t = lastRes?.synth?.travees?.[ti]; return t ? t.lits : undefined; }
function ferHtml() {
  return `<fieldset class="sg-g"><legend>Aciers par type de travée</legend><div class="sg-mx"><table class="ed"><thead><tr><th>Travée</th><th><code>LITS</code> Barres par lit (bas → haut)</th><th><code>CADRE</code> Ø cadre (cm)</th><th><code>CAD</code> Cadres 0 → 0,4 L : Ø cadre / Ø étrier / esp. (cm)</th><th><code>CF</code> Contre-flèche (mm)</th></tr></thead><tbody>${P.travees.map((t, i) =>
    `<tr class="${i === ti ? "sel" : ""}"><td><button class="lnk" data-ti="${i}">${t.nom}</button></td><td><input class="usr" style="width:120px" data-tf="${i}" data-k="lits" data-code="LITS" value="${(t.lits ?? []).join(", ")}" placeholder="auto"/></td><td><input class="usr" style="width:56px" data-tf="${i}" data-k="diamCadre" data-code="CADRE" value="${t.diamCadre}"/></td>
    <td><input class="usr" style="width:270px" data-tf="${i}" data-k="cadres" data-code="CADRE" value="${t.cadres.map(c => `${c.diam}/${c.diam2}/${c.esp}`).join(" ; ")}"/></td><td><input class="usr" style="width:60px" data-tf="${i}" data-k="cfRetenu" value="${t.cfRetenu ?? ""}" placeholder="auto"/></td></tr>`).join("")}</tbody></table></div>
    <span class="sg-note">« auto » : nombre de barres et contre-flèche déterminés par le calcul.</span></fieldset>`;
}
function ferBind() {
  $$<HTMLInputElement>("[data-tf]").forEach(el => (el.onchange = () => {
    const tr: any = P.travees[+el.dataset.tf!], k = el.dataset.k!;
    if (k === "lits") tr.lits = el.value.split(/[,; ]+/).map(Number).filter(n => n > 0);
    else if (k === "cadres") tr.cadres = el.value.split(";").map(s => s.trim().split("/").map(Number)).filter(a => a.length === 3 && a.every(n => n > 0)).map(([diam, diam2, esp]) => ({ diam, diam2, esp }));
    else if (k === "cfRetenu") { const v = num(el.value); tr.cfRetenu = isNaN(v) ? undefined : v; }
    else { const v = num(el.value); if (!isNaN(v)) tr[k] = v; }
    ti = +el.dataset.tf!; save(); lastRes = null; renderPanels();
  }));
  $$("[data-ti]").forEach(el => (el.onclick = () => { ti = +el.dataset.ti!; renderStep(); }));
}

// ------------------------------------------------------------------ pages spéciales : vérins
const SNAP = 0.05;
let jSel = -1, drag: { i: number; mate: number } | null = null;
function jacksState() { const en = P.compl.entretoise; if (en.sym === undefined) { en.verins = verinsNormalises(en.verins, en.sym); en.sym = true; save(); } return en; }
function liveVer() {
  const g = P.base, t = P.travees.reduce((a, b) => (b.L > a.L ? b : a)), en = jacksState();
  const Pp = poidsTravee({ ...g, L: t.L, Lpoutre: t.Lpoutre }).Rpoutre;
  const beams = Array.from({ length: g.n }, (_, i) => (i - (g.n - 1) / 2) * g.e);
  const V = verinage(g.ent.b, beams, Pp, en.verins);
  return { Pp, beams, V, D: V.ok ? dimEntretoise(V, en, g.fc28, g.fiss) : null, t };
}
function jackSVG() { const { Pp, beams, V } = liveVer(); return verinageSVG(P.base.ent.b, beams, Pp, V, true, jSel); }
function jackFields() {
  const { Pp, V, D, t } = liveVer(), en = P.compl.entretoise;
  const cells = V.jacks.map((j, i) => `<td class="${i === jSel ? "sel" : ""}"><input class="usr" data-jpos="${i}" value="${fx(j, 2)}" aria-label="Position du vérin ${i + 1}"/><div class="jr${V.reac[i] < 0 ? " ko" : ""}">${V.reac[i] !== undefined ? fx(V.reac[i] / 10, 1) + " t" : "—"}</div><button class="mini" data-jdel="${i}" title="Retirer le vérin ${i + 1}">×</button></td>`).join("");
  const chip = (l: string, v: string, ko = false) => `<div class="chip${ko ? " ko" : ""}"><span>${l}</span><b>${v}</b></div>`;
  return `<fieldset class="sg-g"><legend>Vérins · cliquer sur l'entretoise pour ajouter, glisser pour déplacer, Suppr pour retirer</legend>
    <div class="vg-tools"><label class="sf chk"><input type="checkbox" id="jSym" ${en.sym ? "checked" : ""}/> <span>Symétrique</span></label><button class="btn-secondary sm" id="jMid">Un vérin entre chaque poutre</button><button class="btn-secondary sm" id="jPair">Deux par poutre (± 0,40 m)</button><button class="btn-secondary sm" id="jEx">Exemple MEDZ</button><button class="btn-secondary sm" id="jClr">Tout retirer</button></div>
    <div class="sg-mx"><table class="jt"><tbody><tr><th><code>V</code> Position (m)<br><span>Réaction</span></th>${cells || `<td class="sg-note">Aucun vérin</td>`}</tr></tbody></table></div>
    <div class="chips">${V.ok && D ? chip("M sup. tendue", fx(V.Msup, 0) + " kN·m") + chip("M inf. tendue", fx(V.Minf, 0) + " kN·m") + chip("Acier sup.", `${D.barSup.n} HA${D.barSup.d} (${fx(D.AsSup, 2)} cm²)`) + chip("Acier inf.", `${D.barInf.n} ${en.feInf < 400 ? "DX" : "HA"}${D.barInf.d} (${fx(D.AsInf, 2)} cm²)`) + chip("Cadres", `${D.cadres.brins} HA${D.cadres.d} e = ${fx(D.cadres.esp, 1)}`) + chip("τu", `${fx(D.tu, 2)} / ${fx(D.tlim, 2)} MPa`, D.tu > D.tlim) : chip("Vérinage", V.erreur ?? "", true)}${V.soulev ? chip("Décollement", "un vérin est tendu", true) : ""}${chip("P par poutre", `${fx(Pp, 0)} kN (${t.nom.toLowerCase()})`)}</div></fieldset>`;
}
function setJacks(v: number[]) {
  const en = P.compl.entretoise, half = P.base.ent.b / 2;
  en.verins = Array.from(new Set(v.map(x => Math.round(Math.max(-half, Math.min(half, x)) / SNAP) * SNAP).map(x => +x.toFixed(4)))).sort((a, b) => a - b);
  save(); lastRes = null;
}
function refreshJacks() { const b = $("#vgBox"); if (b) b.innerHTML = jackSVG(); const f = $("#fields"); if (f && STEPS[si].n === "Entretoises" && page === 0) { f.innerHTML = pageHtml(); bindFields(); } }
function mateOf(i: number) { const v = P.compl.entretoise.verins; if (!P.compl.entretoise.sym) return -1; const j = v.findIndex(x => Math.abs(x + v[i]) < 1e-6); return j === i ? -1 : j; }
function xFromEvent(ev: PointerEvent) {
  const s = document.querySelector("#vgBox svg") as SVGSVGElement, r = s.getBoundingClientRect(), vb = s.viewBox.baseVal;
  const k = Math.min(r.width / vb.width, r.height / vb.height), ox = r.left + (r.width - vb.width * k) / 2;
  const sx = (ev.clientX - ox) / k, Lent = P.base.ent.b, mx = 46, sc = (vb.width - 2 * mx) / Lent;
  return (sx - mx) / sc - Lent / 2;
}
function jackBoxBind() {
  const box = $("#vgBox"); if (!box) return;
  box.onpointerdown = (ev: PointerEvent) => {
    const t = ev.target as Element, jg = t.closest("[data-j]") as HTMLElement | null;
    if (jg) { const i = +jg.dataset.j!; jSel = i; drag = { i, mate: mateOf(i) }; box.setPointerCapture(ev.pointerId); ev.preventDefault(); refreshJacks(); return; }
    if (t.closest("[data-track]")) {
      const x = Math.round(xFromEvent(ev) / SNAP) * SNAP, v = P.compl.entretoise.verins.slice();
      if (v.some(y => Math.abs(y - x) < SNAP / 2)) return;
      v.push(x); if (P.compl.entretoise.sym && Math.abs(x) > 1e-6) v.push(-x);
      setJacks(v); jSel = P.compl.entretoise.verins.findIndex(y => Math.abs(y - x) < 1e-6); refreshJacks();
    }
  };
  box.onpointermove = (ev: PointerEvent) => {
    if (!drag) return;
    const v = P.compl.entretoise.verins.slice(), half = P.base.ent.b / 2;
    let x = Math.round(Math.max(-half, Math.min(half, xFromEvent(ev))) / SNAP) * SNAP;
    if (drag.mate >= 0 && Math.abs(x) < SNAP) x = Math.sign(v[drag.i]) * SNAP;
    v[drag.i] = x; if (drag.mate >= 0) v[drag.mate] = -x;
    if (v.some((y, k) => k !== drag!.i && Math.abs(y - x) < SNAP / 2)) return;
    P.compl.entretoise.verins = v; lastRes = null; box.innerHTML = jackSVG();
  };
  box.onpointerup = box.onpointercancel = () => {
    if (!drag) return; const x = P.compl.entretoise.verins[drag.i]; drag = null;
    setJacks(P.compl.entretoise.verins); jSel = P.compl.entretoise.verins.findIndex(y => Math.abs(y - x) < 1e-6); refreshJacks();
  };
  box.onkeydown = (ev: KeyboardEvent) => {
    const jg = (ev.target as Element).closest("[data-j]") as HTMLElement | null; if (!jg) return;
    const i = +jg.dataset.j!, m = mateOf(i), v = P.compl.entretoise.verins.slice();
    if (ev.key === "Delete" || ev.key === "Backspace") { const rm = new Set([i, m]); setJacks(v.filter((_, k) => !rm.has(k))); jSel = -1; refreshJacks(); ev.preventDefault(); return; }
    const d = ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowRight" ? 1 : 0; if (!d) return;
    const x = v[i] + d * (ev.shiftKey ? 5 : 1) * SNAP; v[i] = x; if (m >= 0) v[m] = -x;
    setJacks(v); jSel = P.compl.entretoise.verins.findIndex(y => Math.abs(y - x) < 1e-6); refreshJacks();
    (document.querySelector(`#vgBox [data-j="${jSel}"]`) as HTMLElement | null)?.focus(); ev.preventDefault();
  };
}
function jackBind() {
  $$<HTMLInputElement>("[data-jpos]").forEach(el => (el.onchange = () => {
    const i = +el.dataset.jpos!, x = num(el.value); if (isNaN(x)) return;
    const v = P.compl.entretoise.verins.slice(), m = mateOf(i); v[i] = x; if (m >= 0) v[m] = -x; setJacks(v); jSel = i; refreshJacks();
  }));
  $$("[data-jdel]").forEach(el => (el.onclick = () => { const i = +el.dataset.jdel!, rm = new Set([i, mateOf(i)]); setJacks(P.compl.entretoise.verins.filter((_, k) => !rm.has(k))); jSel = -1; refreshJacks(); }));
  const sym = $("#jSym") as HTMLInputElement | null;
  if (sym) sym.onchange = () => { P.compl.entretoise.sym = sym.checked; if (sym.checked) { const v = P.compl.entretoise.verins; setJacks([...v, ...v.map(x => -x)]); } save(); refreshJacks(); };
  const beams = () => Array.from({ length: P.base.n }, (_, i) => (i - (P.base.n - 1) / 2) * P.base.e);
  const on = (id: string, f: () => void) => { const b = $(id); if (b) b.onclick = () => { f(); refreshJacks(); }; };
  on("#jMid", () => { const b = beams(); setJacks(b.slice(1).map((x, i) => (x + b[i]) / 2)); });
  on("#jPair", () => setJacks(beams().flatMap(x => [x - 0.4, x + 0.4])));
  on("#jEx", () => setJacks([-4, -1.65, -1.2, 1.2, 1.65, 4]));
  on("#jClr", () => { setJacks([]); jSel = -1; });
}

// ------------------------------------------------------------------ résultats et note
function viewSynth() {
  if (!lastRes) return `<div class="empty">Lancez le calcul depuis le bordereau.</div>`;
  const s = lastRes.synth;
  const cardV = (l: string, v: string, u = "", cls = "", note = "") => `<div class="res-card ${cls}"><div class="res-lbl">${l}</div><div class="res-val">${v}<span class="res-unit">${u}</span></div>${note ? `<div class="res-note">${note}</div>` : ""}</div>`;
  const card = (t: string, b: string) => `<div class="card"><div class="card-title">${t}</div>${b}</div>`;
  let h = s.alertes.length ? card("Points d'attention", s.alertes.map((a: any) => `<div class="alert ${a.niveau}">${a.texte}</div>`).join("")) : "";
  for (const t of s.travees) {
    h += card(`${t.nom} — L = ${fx(t.L, 2)} m`, `<div class="res-grid">${cardV("M ELU max", fx(t.Mu, 0), " kN·m", "", t.MuComb)}${cardV("M ELS max", fx(t.Ms, 0), " kN·m", "hi", t.MsComb)}${cardV("V ELU appui", fx(t.Vu, 0), " kN", "", t.VuComb)}${cardV("θ / α", fx(t.theta, 3) + " / " + fx(t.alpha, 3))}
      ${cardV("Aciers", t.lits.reduce((a: number, b: number) => a + b, 0) + " HA" + t.diam, "", "", t.lits.join(" + ") + " — " + fx(t.As, 1) + " cm²")}${cardV("σs cumulée", fx(t.cumul, 0), " / " + fx(t.ssl, 0) + " MPa", t.okF ? "" : "ko")}${cardV("Flèche globale", fx(t.cf, 1), " mm", "", "contre-flèche " + t.cfRetenu + " mm")}</div>
      <div class="sg-mx"><table class="ctable"><thead><tr><th>x/L</th><th>M ELU</th><th>Comb.</th><th>T ELU</th><th>M ELS</th><th>T ELS</th><th>At/St requis</th><th>En place</th></tr></thead><tbody>${t.ELU.M.map((m: any, i: number) => `<tr><td>${fx(i / 10, 1)}</td><td>${fx(m.v, 0)}</td><td>${m.comb}</td><td>${fx(t.ELU.T[i].v, 0)}</td><td>${fx(t.ELS.M[i].v, 0)}</td><td>${fx(t.ELS.T[i].v, 0)}</td><td>${t.cis[i] ? fx(t.cis[i].req, 2) : ""}</td><td class="${t.cis[i] && !t.cis[i].ok ? "ko" : ""}">${t.cis[i] ? fx(t.cis[i].pose, 2) : ""}</td></tr>`).join("")}</tbody></table></div>`);
  }
  const H = s.hourdis, D = s.dallette, E = s.entretoise;
  h += card("Hourdis, dallette, entretoises", `<div class="res-grid">${cardV("Hourdis transv. inf.", fx(H.trInf.Apose, 2), " cm²/ml", H.trInf.ok ? "" : "ko", "requis " + fx(H.trInf.Acalc, 2))}${cardV("Hourdis transv. sup.", fx(H.trSup.Apose, 2), " cm²/ml", H.trSup.ok ? "" : "ko", "requis " + fx(H.trSup.Acalc, 2))}${cardV("Hourdis long. inf.", fx(H.loInf.Apose, 2), " cm²/ml", "", "requis " + fx(H.loInf.Acalc, 2))}${cardV("Hourdis long. sup.", fx(H.loSup.Apose, 2), " cm²/ml", "", "requis " + fx(H.loSup.Acalc, 2))}
    ${cardV("Dallette σs", fx(D.ss, 0), " / " + fx(D.ssl, 0) + " MPa", D.ss > D.ssl ? "ko" : "")}${cardV("Dallette σb", fx(D.sb, 1), " / " + fx(D.sbl, 1) + " MPa")}${cardV("Entretoise : acier sup. / inf.", fx(E.AsSup, 2) + " / " + fx(E.AsInf, 2), " cm²")}${cardV("Entretoise At/St", fx(E.AtSt, 2), " cm²/ml")}</div>
    <p class="hint">Calcul effectué en ${fx(s.ms / 1000, 1)} s.</p>`);
  return h;
}
function viewNote() {
  if (!lastRes) return `<div class="empty">Aucune note pour l'instant : lancez le calcul depuis le bordereau.</div>`;
  return `<div class="note-tools"><button class="btn-pdf" id="print">Imprimer / PDF</button><button class="btn-secondary" id="dlNote">Télécharger la note (.html)</button></div><article class="note" id="noteBody">${lastRes.note}</article>`;
}

// ------------------------------------------------------------------ rendu
function headHtml() {
  const t = (k: string, n: string, dot: string) => `<button class="nav-item${tab === k ? " active" : ""}" data-tab="${k}"><span class="nav-dot" style="background:var(--${dot})"></span><span class="nav-label">${n}</span></button>`;
  return `<div class="bord-head"><nav class="bh-nav" aria-label="PPBA">${t("bord", "1 · Bordereau", "gold")}${t("res", "2 · Résultats", "teal")}${t("note", "3 · Note de calcul", "blue")}</nav>
    <div class="bh-title"><b>PPBA</b><span>Tablier à poutres préfabriquées en béton armé · BAEL 91 · fascicule 61 titre II</span></div>
    <label class="drop" title="Ouvrir un projet PPBA (.json)">Importer…<input type="file" id="importJ" accept=".json" hidden/></label>
    <div class="actions bh-act"><button class="btn-primary" data-run ${busy ? "disabled" : ""}>${busy ? "Calcul en cours…" : "Lancer le calcul"}</button><button class="btn-secondary" id="ex">Exemple</button><button class="btn-secondary" id="blank">Nouveau projet</button><button class="btn-secondary" id="saveJ" title="Enregistrer le projet (.json)">Enregistrer</button></div></div>
    <div class="status" id="status"></div>`;
}
function stepsHtml() {
  return `<div class="sg-top"><button class="sg-arw" id="prev" ${si === 0 ? "disabled" : ""} aria-label="Étape précédente">‹</button><div class="sg-steps">${STEPS.map((s, i) => `<button class="sg-st${i === si ? " on" : ""}" data-si="${i}" title="${s.sub}"><b>${i}</b><span>${s.n}</span></button>`).join("")}</div><button class="sg-arw" id="next" ${si === STEPS.length - 1 ? "disabled" : ""} aria-label="Étape suivante">›</button></div>`;
}
function wtabsHtml() {
  if (!STEPS[si].wtabs) return "";
  return `<div class="sg-wtabs">${P.travees.map((t, i) => `<button class="${i === ti ? "on" : ""}" data-wti="${i}">${t.nom}</button>`).join("")}</div>`;
}
function panelsHtml() {
  const s = STEPS[si];
  return `<div class="sg-panels"><section class="sg-pan"><div class="sg-pan-h"><b>Schéma de principe</b></div><div class="fig" id="figP">${s.principe()}</div></section>
    <section class="sg-pan sg-win"><div class="sg-pan-h"><b>Votre ouvrage</b>${wtabsHtml()}</div><div class="fig" id="figR">${s.reel()}</div></section></div>`;
}
function pageHtml() {
  const pg = STEPS[si].pages[page];
  return pg.html ? pg.html() : pg.g!.map(grpHtml).join("") + (STEPS[si].n === "Superstructures" && page === 3 ? `<div class="sg-note">${supTotHtml()} <button class="btn-secondary sm" id="useMax">Reporter le total maximal</button></div>` : "");
}
function fieldsHtml() {
  const s = STEPS[si];
  const ptabs = s.pages.length > 1 ? `<div class="sg-ptabs">${s.pages.map((p, i) => `<button class="sg-tab${i === page ? " on" : ""}" data-pg="${i}"><b>${i + 1}</b>${p.n}</button>`).join("")}<span class="sg-pos">page ${page + 1} / ${s.pages.length}</span></div>` : "";
  return `${ptabs}<div id="fields" class="sg-fields">${pageHtml()}</div>`;
}
function render() {
  const app = $("#app");
  if (tab === "bord") app.innerHTML = `<div class="card bord-card">${headHtml()}${stepsHtml()}${panelsHtml()}${fieldsHtml()}</div>`;
  else app.innerHTML = `<div class="card bord-card free">${headHtml()}<div class="scroll">${tab === "res" ? viewSynth() : viewNote()}</div></div>`;
  bindAll();
}
function renderStep() { render(); }
function renderPanels() {
  const s = STEPS[si];
  const p = $("#figP"), r = $("#figR");
  if (p) p.innerHTML = s.principe();
  if (r && !(s.reelHtml && drag)) { r.innerHTML = s.reel(); if (s.reelHtml) jackBoxBind(); }
  $$<HTMLInputElement>("input.der").forEach(el => { const c = el.closest(".sf")?.getAttribute("data-code"); const f = allFields().find(x => x.c === c && x.der); if (f) { const v = f.der!(); el.value = typeof v === "number" ? fx(v, 3) : v; } });
}
const allFields = () => STEPS[si].pages.flatMap(p => (p.g ?? []).flatMap(g => g.f));
function setHl(c: string) {
  if (hl === c) return; hl = c;
  const s = STEPS[si], p = $("#figP"), r = $("#figR");
  if (p) p.innerHTML = s.principe();
  if (r && !s.reelHtml) r.innerHTML = s.reel();
  $$(".sf").forEach(el => el.classList.toggle("hl", !!c && el.getAttribute("data-code") === c));
}
function bindFields() {
  $$<HTMLInputElement>("#fields [data-p], #fields [data-s0]").forEach(el => {
    el.onchange = el.oninput = () => {
      const t = el.dataset.t;
      if (t === "chk") set(el.dataset.p!, el.checked);
      else if (t === "text" || t === "sel") set(el.dataset.p!, el.value);
      else { const v = num(el.value); if (isNaN(v)) { el.classList.add("bad"); return; } el.classList.remove("bad"); if (el.dataset.s0) { S0[el.dataset.s0].set!(v); save(); lastRes = null; } else set(el.dataset.p!, v); }
      renderPanels();
    };
  });
  $$<HTMLElement>("#fields input, #fields select").forEach(el => el.addEventListener("focus", () => { const c = el.closest(".sf")?.getAttribute("data-code") ?? el.getAttribute("data-code"); if (c) setHl(c); }));
  const pg = STEPS[si].pages[page]; if (pg.bind) pg.bind();
}
function bindAll() {
  $$("[data-tab]").forEach(el => (el.onclick = () => { tab = el.dataset.tab as any; render(); }));
  $$("[data-run]").forEach(el => (el.onclick = run));
  $$("[data-si]").forEach(el => (el.onclick = () => { si = +el.dataset.si!; page = 0; hl = ""; render(); }));
  $$("[data-pg]").forEach(el => (el.onclick = () => { page = +el.dataset.pg!; hl = ""; render(); }));
  $$("[data-wti]").forEach(el => (el.onclick = () => { ti = +el.dataset.wti!; render(); }));
  const pv = $("#prev"), nx = $("#next");
  if (pv) pv.onclick = () => { if (si > 0) { si--; page = 0; hl = ""; render(); } };
  if (nx) nx.onclick = () => { if (si < STEPS.length - 1) { si++; page = 0; hl = ""; render(); } };
  const on = $(".sg-st.on"); if (on) on.scrollIntoView({ block: "nearest", inline: "nearest" });
  const ex = $("#ex"); if (ex) ex.onclick = () => { P = clone(projetExemple); save(); lastRes = null; render(); };
  const bl = $("#blank"); if (bl) bl.onclick = () => { P = clone(projetExemple); P.base.projet = ""; P.base.ouvrage = ""; P.travees = [{ ...clone(projetExemple.travees[1]), nom: "Travée type", lits: [] }]; save(); lastRes = null; si = 0; page = 0; render(); };
  const sv = $("#saveJ"); if (sv) sv.onclick = () => download((P.base.ouvrage || "ppba").replace(/[^\w-]+/g, "_") + ".json", JSON.stringify(P, null, 2), "application/json");
  const im = $("#importJ") as HTMLInputElement | null; if (im) im.onchange = async () => { const f = im.files?.[0]; if (!f) return; try { P = JSON.parse(await f.text()); save(); lastRes = null; render(); } catch { status("Ce fichier n'est pas un projet PPBA lisible (.json).", true); } };
  const pr = $("#print"); if (pr) pr.onclick = () => window.print();
  const dl = $("#dlNote"); if (dl) dl.onclick = () => download("note-ppba.html", `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Note de calcul PPBA</title><style>${NOTE_CSS}body{max-width:1000px;margin:24px auto;padding:0 16px}</style><body><article class="note">${lastRes.note}</article></body></html>`, "text/html");
  if (tab === "bord") { bindFields(); if (STEPS[si].reelHtml) jackBoxBind(); }
}
function download(name: string, txt: string, type: string) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function status(msg: string, err = false) { const s = $("#status"); if (s) { s.textContent = msg; s.className = "status on" + (err ? " err" : ""); } }
function run() {
  busy = true; render(); status("Calcul en cours…");
  if (worker) worker.terminate();
  worker = new Worker((window as any).PPBA_WORKER || "ppba/ppba-worker.js");
  worker.onmessage = ev => {
    busy = false;
    if (!ev.data.ok) { render(); status("Erreur de calcul : " + ev.data.error.split("\n")[0], true); return; }
    lastRes = ev.data; tab = "res"; render(); window.scrollTo(0, 0);
  };
  worker.onerror = e => { busy = false; render(); status("Erreur : " + e.message, true); };
  worker.postMessage({ projet: P });
}
const st = document.createElement("style"); st.textContent = NOTE_CSS; document.head.appendChild(st);
render();
