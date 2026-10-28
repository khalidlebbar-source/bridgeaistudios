// Données complémentaires (feuilles de calcul aval) et valeurs de l'exemple de référence
export interface SuperElt { nom: string; cote: "D" | "G" | "C" | "S"; S?: number; a?: number; b?: number; g?: number; poids?: number; kmin: number; kmax: number }
export interface ComplInput {
  superstructures: SuperElt[];
  revetement: { larg: number; emin: number; emax: number; g: number; kmin: number; kmax: number };
  // Poutres : ferraillage longitudinal
  poutre: {
    bTable: number;          // largeur de table de la section composite (m)
    bPhase1: number;         // largeur d'hourdis portée par la poutre seule (m)
    diam: number; parLit: number; lits?: number[];        // barres par lit, du bas vers le haut (vide : dimensionnement automatique)
    enrobage: number; diamCadre: number; ecarteur: number;   // cm
    scellement: number;      // longueur de scellement en diamètres (40)
    cadres: { diam: number; diam2: number; esp: number }[]; // cadres par zone 0.0L..0.4L
    aAppui: number;          // dimension longitudinale de l'appareil d'appui diffusée (m)
  };
  contreFleche: { retenu?: number; Iglobal?: number; poidsResistant?: number; hdPhase1?: number };
  hourdis: {
    e: number; hmax: number; hmin: number; a: number; bEnt: number; A: number;
    rev: number; grev: number; etanch: number; getanch: number; hTot: number;
    abaques: { MaBc: number; MaBt: number; MaMc: number; MbBt: number; MbBr: number; MbBc: number; MpBc: number; MpBt: number; MpMc: number; MeBc: number; MeMc: number };
    reduc: number; enrInf: number; enrSup: number;
    aciers: { trInf: [number, number, number]; trSup: [number, number, number]; loInf: [number, number, number]; loSup: [number, number, number] }; // [d1, d2, esp cm]
    predalle: { ep: number; portee: number; chantier: number };
  };
  dallette: { L: number; H: number; As: [number, number, number, number]; Ai: [number, number, number, number]; ch: number; cb: number; T: number; Itablier?: number; Gtablier?: number; Qsup?: number };
  entretoise: { verins: number[]; sym?: boolean; // positions des vérins depuis l'axe du tablier (m, signées)
    bEnt: number; Htot: number; feSup: number; feInf: number; feCis: number; enr: number };
  levage: { fe: number; diam: number };
  frettes: { fe: number; diam: number };
}
export const complExemple: ComplInput = {
  superstructures: [
    { nom: "Barrière BN4 + grillage anti-jet de pierre", cote: "D", poids: 0.165, kmin: 0.95, kmax: 1.05 },
    { nom: "Corniche préfabriquée", cote: "D", S: 0.22, g: 2.5, kmin: 0.95, kmax: 1.05 },
    { nom: "Mortier de pose", cote: "D", a: 0.02, b: 0.24, g: 2.4, kmin: 0.95, kmax: 1.05 },
    { nom: "Contre-corniche", cote: "D", a: 0.31, b: 0.41, g: 2.5, kmin: 0.95, kmax: 1.05 },
    { nom: "Bordure de trottoir", cote: "D", a: 0.22, b: 0.15, g: 2.4, kmin: 0.95, kmax: 1.05 },
    { nom: "Mortier de pose", cote: "D", a: 0.02, b: 0.15, g: 2.4, kmin: 0.95, kmax: 1.05 },
    { nom: "Béton maigre", cote: "D", a: 0.27, b: 1.35, g: 2.4, kmin: 0.95, kmax: 1.05 },
    { nom: "Contre-corniche", cote: "G", a: 0.22, b: 0.09, g: 2.5, kmin: 0.95, kmax: 1.05 },
    { nom: "Bordure de trottoir", cote: "G", a: 0.22, b: 0.15, g: 2.4, kmin: 0.95, kmax: 1.05 },
    { nom: "Mortier de pose", cote: "G", a: 0.01, b: 0.15, g: 2.4, kmin: 0.95, kmax: 1.05 },
    { nom: "Débord inférieur des prédalles (3 cm)", cote: "C", S: 0.116, g: 2.5, kmin: 0.95, kmax: 1.05 },
    { nom: "Chape d'étanchéité", cote: "S", a: 9.9, b: 0.005, g: 2.3, kmin: 0.8, kmax: 1.2 },
  ],
  revetement: { larg: 7.5, emin: 0.06, emax: 0.09, g: 2.3, kmin: 0.8, kmax: 1.2 },
  poutre: { bTable: 1.69, bPhase1: 1.697, diam: 32, parLit: 6, enrobage: 3, diamCadre: 1.4, ecarteur: 3.2, scellement: 40,
    cadres: [{ diam: 12, diam2: 10, esp: 12.5 }, { diam: 12, diam2: 10, esp: 12.5 }, { diam: 12, diam2: 10, esp: 20 }, { diam: 12, diam2: 10, esp: 20 }, { diam: 10, diam2: 10, esp: 20 }], aAppui: 0.3 },
  contreFleche: { hdPhase1: 0.23 },
  hourdis: {
    e: 0.065, hmax: 0.2, hmin: 0.2, a: 1.43, bEnt: 26.1, A: 0.38, rev: 0.09, grev: 23, etanch: 0.005, getanch: 23, hTot: 0.23,
    abaques: { MaBc: 25, MaBt: 23, MaMc: 30, MbBt: 11, MbBr: 12, MbBc: 13, MpBc: 28, MpBt: 21, MpMc: 22, MeBc: 30, MeMc: 28 },
    reduc: 0.8, enrInf: 4, enrSup: 3,
    aciers: { trInf: [12, 0, 10], trSup: [14, 0, 10], loInf: [14, 0, 20], loSup: [14, 20, 20] },
    predalle: { ep: 0.06, portee: 0.97, chantier: 2 },
  },
  dallette: { L: 1.1, H: 0.15, As: [14, 20, 20, 20], Ai: [14, 20, 14, 20], ch: 0.05, cb: 0.029, T: 0.01 },
  entretoise: { verins: [-4, -1.65, -1.2, 1.2, 1.65, 4], sym: true, bEnt: 0.4, Htot: 1.25, feSup: 500, feInf: 235, feCis: 500, enr: 0.06 },
  levage: { fe: 235, diam: 10 },
  frettes: { fe: 235, diam: 10 },
};
