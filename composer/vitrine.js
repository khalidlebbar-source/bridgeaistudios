/* BridgeAI Studios — Bridge Composer : projet vitrine affiché à l'ouverture du site
 * PRO2334 — Liaison à grande vitesse Kénitra–Marrakech, lot 10 — projet d'exécution (KLE Ingénierie / ABE, indice 01, 11/2026).
 * Données relevées sur le plan d'ensemble L10-HUBC-X-27-GC-PRO-PLN-CO2334-0002-01 et la note d'appuis 02-PRO2334-NC-Appuis-V01 :
 *   travées 30,00 – 41,70 – 41,70 – 30,00 = 143,40 m ; deux tabliers VIPP jumeaux de 10,50 m (poutres 2,28 + hourdis 0,24) ;
 *   piles : 2 × 2 fûts 1,50 × 1,50 (vide 1,50) sous chevêtre 2,60 × 1,50, massifs 5,50 × 5,50 × 1,50 ;
 *   culées : chevêtre 2,60 × 1,50 sur colonnes / pieux Ø 1,20 (4 par tablier, entraxe 2,70) ;
 *   béton tablier C40/50, appuis C30/37 ; q'u = 4,30 MPa (SCP1) → contrainte admissible ≈ q'u / 3. */
(function (root) {
  'use strict';
  const V = {
    projet: { nom: 'PRO2334 — LGV Kénitra–Marrakech, lot 10', ouvrage: 'PRO2334', moa: 'ONCF — Pôle Projets LGV', lieu: 'Lot 10', ref: 'L10-HUBC-X-27-GC-PRO-PLN-CO2334-0002', phase: 'Projet d’exécution', indice: '01', date: '11/2026', bet: 'KLE Ingénierie — ABE', dessine: 'MA', verifie: 'AA', valide: 'K.L' },
    usage: 'rail',
    profil: { largeurForcee: 21.02 },
    tablier: { type: 'VIPP', h: 2.52, continu: false },
    travees: [30, 41.7, 41.7, 30],
    biais: 100,
    piles: { type: 'colonnes', col: 'carre', paires: true, hauteurs: [8.5, 7.5, 7.5], dim: { D: 1.5, n: 4, sp: 3.0, cp: 10.52, hch: 1.5, bch: 2.6 }, fdim: { B: 5.5, L: 5.5, e: 1.5 } },
    culees: { type: 'enterree', chev: 'L', retours: 'suspendus', section: 'circ', gg: true, dalleTransition: false, hauteurs: [3.0, 7.5], dim: { D: 1.2, n: 8, hs: 1.5, bs: 2.6 } },
    fond: { piles: 'superficielle', culees: 'pieux', sigma: 1.45, diam: 1.2, long: 15 },
    hyp: { betonTab: 'C40/50', betonApp: 'C30/37', betonFond: 'C30/37' },
    nota: 'Les cotes sont exprimées en mètres et les niveaux en m NGM, sauf indication contraire.\nBéton : tablier C40/50 ; culées et piles C30/37.\nToute paroi en contact avec le sol est à badigeonner.\nLes arêtes vues seront chanfreinées à 2 cm × 2 cm.\nRéceptionner les fonds de fouille de toutes les semelles par le laboratoire ; rattraper le bon sol (rocheux) par gros béton si nécessaire.',
  };
  root.COMP = root.COMP || {};
  root.COMP.vitrine = V;
  if (typeof module === 'object' && module.exports) module.exports = { vitrine: V };
})(typeof self !== 'undefined' ? self : this);
