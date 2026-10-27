// Bordereau du module PPBA (tablier à poutres préfabriquées en béton armé)
export interface PPBAInput {
  projet: string; ouvrage: string; travee: string;
  // I.1 Géométrie
  n: number;            // nombre de poutres
  L: number;            // portée de calcul (m)
  Lpoutre: number;      // longueur de la poutre (m) — par défaut L + 1,00
  e: number;            // entraxe des poutres (m)
  bs: number; hs1: number; hs2: number;      // semelle : largeur, hauteur min (rive), hauteur max (gousset)
  b0: number; b0m: number; hame: number;     // âme : largeur sur appui, à mi-travée ; hauteur
  bt: number; ht1: number; ht2: number;      // talon : largeur, hauteur min, hauteur max (gousset)
  Lh: number; hd: number;                    // hourdis : largeur totale, épaisseur
  trG: number; trD: number;                  // trottoirs gauche et droite
  // I.2 Charges permanentes
  qsup: number;         // poids des superstructures (kN/ml)
  ent: { b: number; h: number; ep: number; nb: number }; // entretoises : largeur, hauteur (sous hourdis), épaisseur, nombre
  gb: number;           // poids volumique du béton (kN/m3)
  // I.3 Chargements
  charges: { AL: boolean; Br: boolean; Bt: boolean; Bc: boolean; Mc120: boolean; Me120: boolean; D: boolean; E: boolean };
  qtr: number;          // charge générale de trottoir (kN/m²)
  classe?: 1 | 2 | 3;   // classe du pont (déduite de la largeur roulable si absente)
  nbVoies?: number;     // nombre de voies (déduit si absent)
  DEcentre: boolean;    // convois D et E circulant dans l'axe du tablier (sinon position la plus défavorable)
  compat: boolean;      // reproduire les conventions du programme de référence (.LIR)
  // Matériaux
  fc28: number; fe: number; feDX: number; fiss: "P" | "PP" | "TP";
}

export const exempleGrandes: PPBAInput = {
  projet: "Pont MEDZ sur AR : Pont de l'échangeur", ouvrage: "OA Echangeur", travee: "Grandes travées",
  n: 5, L: 26.5, Lpoutre: 27.5, e: 2.17,
  bs: 1.2, hs1: 0.12, hs2: 0.17, b0: 0.4, b0m: 0.4, hame: 0.78, bt: 0.65, ht1: 0.4, ht2: 0.5,
  Lh: 9.9, hd: 0.2, trG: 2.15, trD: 0.25,
  qsup: 45.5, ent: { b: 9.9, h: 1.05, ep: 0.4, nb: 2 }, gb: 25,
  charges: { AL: true, Br: true, Bt: true, Bc: true, Mc120: true, Me120: true, D: true, E: true },
  qtr: 1.5, DEcentre: true, compat: true,
  fc28: 35, fe: 500, feDX: 235, fiss: "P",
};
export const exemplePetites: PPBAInput = { ...exempleGrandes, travee: "Petites travées", L: 15, Lpoutre: 16 };
