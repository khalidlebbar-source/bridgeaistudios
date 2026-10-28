// Projet complet : plusieurs types de travées + modules communs
import { PPBAInput, exempleGrandes } from "./types";
import { calcul, Resultat } from "./sollicitations";
import { ComplInput, complExemple } from "./complements";
import * as M from "./modules";

export interface TraveeDef { nom: string; L: number; Lpoutre: number; lits?: number[]; diamCadre: number; cadres: ComplInput["poutre"]["cadres"]; cfRetenu?: number }
export interface Projet { base: PPBAInput; travees: TraveeDef[]; compl: ComplInput }

export const projetExemple: Projet = {
  base: { ...exempleGrandes, travee: "" },
  travees: [
    { nom: "Petites travées", L: 15, Lpoutre: 16, lits: [6, 6, 2], diamCadre: 1.2, cadres: [{ diam: 10, diam2: 10, esp: 12.5 }, { diam: 10, diam2: 10, esp: 12.5 }, { diam: 10, diam2: 10, esp: 20 }, { diam: 10, diam2: 10, esp: 20 }, { diam: 10, diam2: 10, esp: 20 }] },
    { nom: "Grandes travées", L: 26.5, Lpoutre: 27.5, lits: [6, 6, 6, 6, 6], diamCadre: 1.4, cadres: complExemple.poutre.cadres },
  ],
  compl: complExemple,
};

export function runTravee(p: Projet, t: TraveeDef) {
  const g: PPBAInput = { ...p.base, travee: t.nom, L: t.L, Lpoutre: t.Lpoutre };
  const R = calcul(g);
  const c: ComplInput = JSON.parse(JSON.stringify(p.compl));
  c.poutre.lits = t.lits && t.lits.length ? t.lits : undefined;
  c.poutre.diamCadre = t.diamCadre; c.poutre.cadres = t.cadres;
  if (t.cfRetenu) c.contreFleche.retenu = t.cfRetenu;
  const F = M.ferraillagePoutre(R, c);
  const E = M.epure(R, c, F);
  const C = M.cisaillement(R, c, F);
  const CF = M.contreFleche(R, c);
  const PT = M.poidsTablier(R, c);
  const LV = M.levage(R, c);
  return { def: t, R, c, F, E, C, CF, PT, LV };
}
export type TraveeRes = ReturnType<typeof runTravee>;

export function runProjet(p: Projet) {
  const sup = M.superstructures(p.compl);
  const travees = p.travees.map(t => runTravee(p, t));
  const big = travees.reduce((a, b) => (b.R.input.L > a.R.input.L ? b : a));
  const H = M.hourdis(big.R, big.c, sup);
  const DC = M.dallette(big.R, big.c, sup);
  const EN = M.entretoise(big.R, big.c);
  const FR = M.frettes(big.R, big.c);
  return { projet: p, sup, travees, big, H, DC, EN, FR, alertes: alertes(travees, DC) };
}
export type ProjetRes = ReturnType<typeof runProjet>;

function alertes(tr: TraveeRes[], DC: ReturnType<typeof M.dallette>) {
  const a: { niveau: "info" | "attention"; texte: string }[] = [];
  for (const t of tr) {
    if (t.C.Vu0 > t.C.VbielleBAEL)
      a.push({ niveau: "attention", texte: `${t.def.nom} : bielle d'about — Vu = ${t.C.Vu0.toFixed(0)} kN > 0,267·a·b0·fc28 = ${t.C.VbielleBAEL.toFixed(0)} kN (BAEL A.5.1,313). La feuille de référence compare à 0,4·a·b0·fc28 = ${t.C.VbielleFeuille.toFixed(0)} kN, sans γb. Vérifier la largeur a de diffusion de l'appareil d'appui.` });
    if (!t.F.ok) a.push({ niveau: "attention", texte: `${t.def.nom} : ferraillage longitudinal insuffisant (cumul σs = ${t.F.cumul.toFixed(0)} MPa).` });
    if (!t.E.couvert) a.push({ niveau: "attention", texte: `${t.def.nom} : la courbe des moments résistants ne couvre pas la courbe décalée.` });
    if (t.C.rows.some(r => !r.ok)) a.push({ niveau: "attention", texte: `${t.def.nom} : armatures d'effort tranchant insuffisantes dans au moins une zone.` });
  }
  if (DC.tot.ss > DC.ssl) a.push({ niveau: "attention", texte: `Dallette : σs = ${DC.tot.ss.toFixed(0)} MPa > ${DC.ssl.toFixed(0)} MPa.` });
  a.push({ niveau: "info", texte: `Dallette : inerties fictives calculées comme la feuille de référence (I0 / (1 + λμ)). Le BAEL (B.6.5,2) prévoit 1,1·I0 / (1 + λμ), soit des moments supérieurs de 10 %.` });
  return a;
}
export type { Resultat };
