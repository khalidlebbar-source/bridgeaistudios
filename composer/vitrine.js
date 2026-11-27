/* BridgeAI Studios — Bridge Composer : projet vitrine affiché à l'ouverture du site
 * PRO2334 — pont-route franchissant la voie ferrée et l'autoroute, LGV Kénitra–Marrakech lot 10 — projet d'exécution
 * (KLE Ingénierie / ABE, indice 01, 11/2026). Données relevées sur les plans PRO2334 indice 01 :
 *   0002 plan d'ensemble, 0003 piles coffrage, 0004 pl1/2 culées coffrage (C0, C4), 0007 tablier coffrage, et la note d'appuis.
 *   Travées 30,00 – 41,70 – 41,70 – 30,00 = 143,40 m. Tablier VIPP : 2 × 10,50 + joint 0,02 = 21,02 m ; par demi-tablier :
 *   trottoir 2,00 + chaussée 8,00 ; dévers en toit 2,5 % ; 8 poutres de 2,28 m (entraxe 3,00, rives 0,75) + hourdis 0,24.
 *   Piles : sous chaque demi-tablier 2 fûts 1,50 × 1,50 (vide 1,50), chevêtre 2,60 × 1,50, massif 5,50 × 5,50 × 1,50 ;
 *   fûts de 7,00 m (P1) et 6,00 m (P2, P3).
 *   Culée C0 : sommier 2,60 × 1,50 sur 8 pieux Ø 1,20 de 15 m (entraxes 1,20 / 2,70 / … / 3,20 / 0,70).
 *   Culée C4 : sommier 2,60 × 1,50 sur 8 poteaux 0,80 × 1,50 de 6,00 m, semelle 7,00 × 1,50 sur gros béton 1,50 (débord 0,50).
 *   Garde-grève 0,40, corbeau, dalle de transition 4,00 × 0,30 ; murs en retour suspendus 5,00 m, ép. 0,50, 0,80 en bout.
 *   Béton tablier C40/50, appuis C30/37 ; q'u = 4,30 MPa (SCP1) → contrainte admissible ≈ q'u / 3. */
(function (root) {
  'use strict';
  const pos8 = [-9.31, -6.61, -3.91, -1.21, 1.21, 3.91, 6.61, 9.31];
  const V = {
    projet: { nom: 'PRO2334 — Pont-route sur voie ferrée et autoroute (LGV Kénitra–Marrakech, lot 10)', ouvrage: 'PRO2334', moa: 'ONCF — Pôle Projets LGV', lieu: 'Lot 10', ref: 'L10-HUBC-X-27-GC-PRO-PLN-CO2334-0002', phase: 'Projet d’exécution', indice: '01', date: '11/2026', bet: 'KLE Ingénierie — ABE', dessine: 'MA', verifie: 'AA', valide: 'K.L' },
    usage: 'route',
    classe: 1,
    profil: { roulable: 17.02, trottoirG: 2.0, trottoirD: 2.0 },
    tablier: { type: 'VIPP', h: 2.52, continu: false, pos: [-9.76, -6.76, -3.76, -0.76, 0.76, 3.76, 6.76, 9.76] },
    travees: [30, 41.7, 41.7, 30],
    biais: 100,
    piles: { type: 'colonnes', col: 'carre', paires: true, hauteurs: [8.5, 7.5, 7.5], dim: { D: 1.5, n: 4, sp: 3.0, cp: 10.52, hch: 1.5, bch: 2.6 }, fdim: { B: 5.5, L: 5.5, e: 1.5 } },
    culees: {
      type: 'enterree', chev: 'L', retours: 'suspendus', section: 'circ', gg: true, dalleTransition: true, hauteurs: [1.5, 7.5],
      dim: { D: 1.2, hs: 1.5, bs: 2.6, egg: 0.4, Lmr: 5.0, em: 0.5, h2r: 0.8, Ldt: 4.0 },
      par: [
        { fond: 'pieux', pieuxPos: [-9.31, -6.61, -3.91, -1.21, 1.21, 3.91, 6.61, 9.81] },
        { fond: 'superficielle', section: 'rect', pos: pos8, dim: { D: 1.5, bc: 0.8, gb: 1.5 }, fdim: { B: 7.0, L: 21.02, e: 1.5 } },
      ],
    },
    fond: { piles: 'superficielle', culees: 'pieux', sigma: 1.45, diam: 1.2, long: 15 },
    equip: { retenue: 'BN4', corniches: true, etancheite: true, revetement: 0.06 },
    hyp: { betonTab: 'C40/50', betonApp: 'C30/37', betonFond: 'C30/37' },
    nota: 'Les cotes sont exprimées en mètres et les niveaux en m NGM, sauf indication contraire.\nBéton : tablier C40/50 ; culées et piles C30/37.\nToute paroi en contact avec le sol est à badigeonner.\nLes arêtes vues seront chanfreinées à 2 cm × 2 cm.\nRéceptionner les fonds de fouille de toutes les semelles par le laboratoire ; rattraper le bon sol (rocheux) par gros béton si nécessaire.\nBlindage à réaliser lors des fouilles : caniveaux à dévier pendant les travaux et à reconstruire ; les fouilles ne doivent en aucun cas affecter la GBA, qui doit rester intacte.',
  };
  root.COMP = root.COMP || {};
  root.COMP.vitrine = V;
  if (typeof module === 'object' && module.exports) module.exports = { vitrine: V };
})(typeof self !== 'undefined' ? self : this);
