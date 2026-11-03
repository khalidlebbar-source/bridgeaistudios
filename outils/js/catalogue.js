/* Catalogue des outils de calculs des ponts : une entrée par module.
 * statut : 'on' (disponible), 'beta' (disponible, validation en cours), 'dev' (en développement). */
(function (root) {
  const CATALOGUE = [
    { phase: 1, titre: 'Socle de calcul', sous: 'les briques utilisées par tous les autres modules' },
    { code: 'BAEL-EC2', slug: 'bael-ec2', statut: 'on', nom: 'Sections en béton armé', reg: 'EN 1992-2 · BAEL 91 mod. 99 · Livret 2.01',
      desc: 'Sections rectangulaires, en T, circulaires et quelconques : flexion simple, composée et déviée, ELU, ELS, fatigue, diagrammes d’interaction, effort tranchant, torsion, consoles courtes.' },
    { code: 'POUTRE', slug: 'poutre', statut: 'on', nom: 'Poutres continues', reg: 'EN 1991-2 · Livret 2.01 · Fasc. 61 titre II',
      desc: 'Poutres de 1 à 20 travées à inertie constante ou variable : charges fixes et mobiles, UIC 71, SW/0, SW/2, LM1, A(l), Bc, Bt, Mc80, Mc120, enveloppes et combinaisons.' },
    { code: 'GMSLT', slug: 'gmslt', statut: 'on', nom: 'Répartition transversale', reg: 'Guyon-Massonnet-Barès',
      desc: 'Coefficients de répartition transversale et moments de flexion transversale des tabliers de ponts-rails et ponts-routes sous charges réglementaires.' },
    { code: 'RACBA-RAPO', slug: 'racba-rapo', statut: 'dev', nom: 'Cadres et portiques ponts-rails', reg: 'EN 1990 A2 · EN 1991-2 · EN 1992-2 · EN 1998-2',
      desc: 'Cadres fermés (1 à 15 m) et portiques ouverts (5 à 25 m) sous voies ferrées : sollicitations, ferraillage, fissuration, flèche et fondations.' },

    { phase: 2, titre: 'Fondations et appuis' },
    { code: 'SONDPRES', slug: 'sondpres', statut: 'dev', nom: 'Sondages pressiométriques', reg: 'Fasc. 62 titre V · NF P 94-262',
      desc: 'Saisie, lecture et impression des sondages pressiométriques (pl, EM, α) au format SPS, profil graphique.' },
    { code: 'FONDATIO', slug: 'fondatio', statut: 'dev', nom: 'Fondations', reg: 'Fasc. 62 titre V · Livret 2.01 · EN 1992',
      desc: 'Semelles superficielles, puits et groupes de pieux ou barrettes sous semelle rigide : portance, tassements, déplacements, frottement négatif, aciers des pieux.' },
    { code: 'APPMOBIL', slug: 'appmobil', statut: 'on', nom: 'Appareils d’appui en élastomère fretté', reg: 'NF EN 1337-3 · guide SETRA 2000 · Livret 2.01',
      desc: 'Dimensionnement et vérification : distorsions, stabilité au flambement, non-glissement, rotation, épaisseur des frettes.' },
    { code: 'REPHOR', slug: 'rephor', statut: 'on', nom: 'Efforts horizontaux et appareils d’appui', reg: 'EN 1991-2 · EN 1337-3 · Livret 2.01',
      desc: 'Répartition des efforts de freinage, retrait, dilatation et interaction voie-ouvrage entre les appuis d’un ouvrage multi-travées.' },
    { code: 'MODELPRA', slug: 'modelpra', statut: 'dev', nom: 'Modélisation des ponts-rails', reg: 'EN 1990 A2 · EN 1991-2 · EN 1998-2',
      desc: 'Structure plane (poutre continue, portique, cadre multiple) sous charges ferroviaires, dénivellations, retrait, dilatation et séisme.' },
    { code: 'APPUI', slug: 'appui', statut: 'dev', nom: 'Piles et culées', reg: 'EN 1992-2 · EN 1998-2 · Fasc. 62',
      desc: 'Piles, palées, culées enterrées et murs de front, chevêtres sur pieux : stabilité, descente de charges et béton armé.' },

    { phase: 3, titre: 'Tabliers et murs' },
    { code: 'INERPE', slug: 'inerpe', statut: 'on', nom: 'Inerties des poutrelles enrobées', reg: 'EN 1994-2 · catalogue HEA, HEAA, HEB, HEM',
      desc: 'Moment résistant ELU, inerties et modules I/v à court et long terme, béton fissuré ou non, en travée et sur appui.' },
    { code: 'RADBAN-RAPEN', slug: 'radban-rapen', statut: 'dev', nom: 'Tabliers de ponts-rails BA et PE', reg: 'EN 1991-2 · EN 1992-2 · Livret 2.01',
      desc: 'Dalles en béton armé et tabliers à poutrelles enrobées, 1 à 7 travées : flexion, aciers, descentes de charges vers REPHOR et APPUI.' },
    { code: 'RODBAN-ROPEN', slug: 'rodban-ropen', statut: 'dev', nom: 'Tabliers de ponts-routes BA et PE', reg: 'EN 1991-2 · Fasc. 61 titre II · EN 1992-2',
      desc: 'Dalles en béton armé et poutrelles enrobées, portées de 1 à 35 m : LM1, LM2, LM3, A(l), Bc, Bt, Mc, convois exceptionnels.' },
    { code: 'MUR3D', slug: 'mur3d', statut: 'dev', nom: 'Murs de soutènement', reg: 'EN 1997 · EN 1992 · EN 1998 · Fasc. 62',
      desc: 'Murs en béton armé sur semelle, puits, pieux ou barrettes : poussées, eau, séisme, stabilité, aciers, déplacement en tête.' },
    { code: 'MURU', slug: 'muru', statut: 'dev', nom: 'Murs en U', reg: 'EN 1997 · EN 1992 · Fasc. 62',
      desc: 'Deux voiles sur radier partiel ou total : stabilité, réaction du sol, sollicitations et aciers du radier et des voiles.' },

    { phase: 4, titre: 'Compléments', sous: 'modules qui n’étaient pas livrés dans la version de 2015' },
    { code: 'CEDYPIA', slug: 'cedypia', statut: 'beta', nom: 'Dynamique des ponts-rails', reg: 'EN 1991-2 §6.4 · annexe E',
      desc: 'Flèches et accélérations sous trains réels en fonction de la vitesse, par intégration analytique modale, jusqu’à 9 travées.' },
    { code: 'EPREUVES', slug: 'epreuves', statut: 'on', nom: 'Épreuves de chargement', reg: 'Livret 2.01 · Fasc. 61 titre II',
      desc: 'Carnet d’épreuves réglementaires : cas de chargement, positions des camions ou locomotives, flèches et rotations attendues.' },
    { code: 'OUVRAGES TYPES', slug: 'ouvrages-types', statut: 'dev', nom: 'Calcul et dessin des ouvrages types', reg: 'chaîne complète',
      desc: 'Enchaîne tablier, appareils d’appui, appuis et fondations, puis produit notes, implantation, coffrages et gabarits.' },
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOGUE;
  if (root) { root.BA = root.BA || {}; root.BA.catalogue = CATALOGUE; }
})(typeof window !== 'undefined' ? window : globalThis);
