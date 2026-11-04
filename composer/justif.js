/* Bridge Composer — justification par la chaîne des modules de calcul du site (méthodologie KLE, parties C à F) :
 *   tablier (TABLIER ROUTE / TABLIER RAIL) → réactions d'appui → efforts horizontaux et rigidités (HORIZONTAL)
 *   → appareils d'appui (ÉLASTOMÈRES) → piles et culées (PILES-CULÉES : combinaisons, stabilité, aciers) → fondations (FONDATIONS).
 * La chaîne est celle du module OUVRAGES TYPES (outils/js/ouvrages-types.js), appelée sans réécrire ses calculs.
 *
 * Pur (aucun DOM) : COMP.justifMap(S, M, OT) → { ok, type, s, notes[] } ; COMP.justifSummary(R) → résumé sérialisable.
 * Le calcul lui-même tourne dans composer/justif-worker.js (Web Worker) pour ne pas figer l'interface. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.COMP = Object.assign(root.COMP || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const r2 = (v) => Math.round(v * 100) / 100;
  const fr = (v, d) => (+v).toLocaleString('fr-FR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });

  /* fichiers des modules, dans l'ordre de chargement de outils/ouvrages-types.html */
  const LIBS = ['charges', 'portique', 'poutres-continues', 'repartition', 'sections-ba', 'poutrelles-enrobees', 'tablier-rail', 'tablier-route',
    'elastomeres', 'efforts-horizontaux', 'sondages', 'fondations', 'modele-rail', 'cadres-portiques', 'piles-culees', 'ouvrages-types']
    .map((f) => 'outils/js/' + f + '.js');

  /* type d'ouvrage de la chaîne correspondant au tablier du Composer */
  function chainType(S) {
    const rail = S.usage === 'rail', t = S.tablier.type;
    if (t === 'PSIDA') return rail ? 'radba' : 'rodba';
    if (t === 'PRP') return rail ? 'rapen' : 'ropen';
    return null;
  }
  const PROCHAINS = { PSIDP: 'PSIDP-EL (SETRA)', VIPP: 'VIPP-EL (SETRA)', PRAD: 'PRAD (SETRA)', MIXTE: 'bipoutre mixte' };

  function justifMap(S, M, OT) {
    const type = chainType(S), notes = [];
    if (!type) return { ok: false, why: `La chaîne de justification couvre aujourd’hui les dalles en béton armé (PSI-DA) et les poutrelles enrobées (PRP), en pont-route et en pont-rail. Le branchement du ${S.tablier.type} sur ${PROCHAINS[S.tablier.type] || 'son moteur'} est la prochaine étape.` };
    const n = S.travees.length;
    if (n > 7) return { ok: false, why: 'La chaîne traite de 1 à 7 travées (ouvrages types).' };
    const s = OT.defaut(type), rail = S.usage === 'rail';
    s.projet = (S.projet.nom || 'Ouvrage') + (S.projet.ouvrage ? ' (' + S.projet.ouvrage + ')' : '');
    s.regl = S.reglement === 'EC' ? 'ec' : 'livret';
    s.travees = S.travees.slice();
    s.biais = Math.min(130, Math.max(70, S.biais));
    if (s.biais !== S.biais) notes.push(`Biais ramené de ${S.biais} à ${s.biais} gr (domaine du calcul en poutre : 70 à 130 gr).`);
    s.Btot = r2(M.kpi.W);
    if (rail) { s.nVoies = Math.min(2, S.profil.nbVoiesFer); s.entraxe = S.profil.entraxe; if (S.profil.nbVoiesFer > 2) notes.push('Calcul limité à 2 voies ferrées.'); }
    // tablier : épaisseur du prédimensionnement Composer
    if (type === 'radba') s.tab = Object.assign({}, s.tab, { h: r2(M.kpi.h) });
    if (type === 'rodba') s.tab = Object.assign({}, s.tab, { hDalle: r2(M.kpi.h) });
    if (type === 'ropen' || type === 'rapen') notes.push('Profilés et nombre de poutrelles : valeurs du module (à ajuster dans OUVRAGES TYPES).');
    // profil en long : hauteur de fût moyenne du Composer (la chaîne suppose un terrain horizontal)
    const hp = n > 1 ? S.piles.hauteurs : S.culees.hauteurs;
    const H = hp.reduce((a, b) => a + b, 0) / hp.length;
    if (Math.max.apply(null, hp) - Math.min.apply(null, hp) > 0.5) notes.push(`Hauteurs d’appuis différentes : calcul avec la hauteur moyenne ${fr(H, 2)} m (terrain horizontal).`);
    s.zTN = 100; s.pente = 0;
    const f = s.fond, hApp = +s.app.hApp || 0.25;
    const hV = rail ? 0.172 + 0.23 + 0.35 : S.equip.revetement + (S.equip.etancheite ? 0.03 : 0);
    s.zRail0 = r2(s.zTN - f.ancrage + f.es + H + hApp + M.kpi.h + hV);
    // appuis
    const fck = parseInt(String(S.hyp.betonApp).replace(/^C/, ''), 10);
    if (fck > 0) s.app.fck = fck;
    const pt = S.piles.type;
    if (pt === 'voile') s.app.pile = Object.assign({}, s.app.pile, { nfut: 1, larfut: 0, e: 0.8 });
    else if (pt === 'colonnes') {
      const sp = (M.supports || []).find((x) => x.kind !== 'culee'), nc = sp && sp.geo && sp.geo.n ? sp.geo.n : Math.max(2, Math.round(M.kpi.W / 3));
      s.app.pile = Object.assign({}, s.app.pile, { nfut: nc, larfut: 1.2, e: 1.2 });
      notes.push(`Piles : ${nc} colonnes modélisées en fûts rectangulaires 1,20 × 1,20 m.`);
    } else s.app.pile = Object.assign({}, s.app.pile, { nfut: 1, larfut: 3.0, e: 1.5 });
    if (n === 1) notes.splice(0, notes.length, ...notes.filter((x) => !/^Piles/.test(x)));
    if (S.culees.type === 'enterree') notes.push('Culées modélisées en mur de front (culée remblayée) par PILES-CULÉES ; la culée enterrée sur colonnes n’est pas encore traitée.');
    // fondations
    const pieux = S.fond.piles === 'pieux' || S.fond.culees === 'pieux';
    f.type = pieux ? 'pieux' : 'sup';
    if (pieux) { f.pieux = Object.assign({}, f.pieux, { D: S.fond.diam, L: S.fond.long }); if (S.fond.piles !== S.fond.culees) notes.push('Même type de fondation pour tous les appuis : pieux retenus partout.'); }
    s.gab = { type: 'aucun' };
    if (S.sps) { s.sps = S.sps; s.spsNom = S.spsNom || 'sondage importé'; } else notes.push('Aucun sondage pressiométrique importé : fondations justifiées sur le sondage d’exemple du module (à remplacer par votre .sps).');
    return { ok: true, type, s, notes, nom: OT.TYPES[type].nom };
  }

  /* résumé sérialisable du résultat de la chaîne (le résultat brut contient les modules eux-mêmes) */
  function justifSummary(R) {
    const v = (R.verdicts || []).map((x) => ({ partie: x.partie, statut: x.statut, texte: x.texte, module: x.module }));
    const app = (R.appareils || []).map((a) => ({ nom: a.nom, app: a.app, n: a.n, plaque: a.plaque || null, ok: !!a.ok, taux: a.taux }));
    const appuis = (R.appuis || []).map((A) => {
      const g = R.geo.appuis[A.j];
      return { nom: A.nom, culee: A.culee, ok: A.ok, err: A.err || null, verdicts: A.res ? A.res.verdicts : [], hfut: g.hfut != null ? g.hfut : g.hMur, B: g.B, L: g.L, es: g.es };
    });
    const fond = (R.fond || []).map((F) => {
      const r = F.res, sy = r && r.synth, els = sy && sy.els, elu = sy && sy.elu;
      return { nom: F.nom, ok: F.ok, err: F.err || null, type: F.o.type, B: F.o.B, L: F.o.L,
        qref: els ? els.qref : null, qadm: els ? els.qadm : null, decomp: els ? els.decomp : null, qrefU: elu ? elu.qref : null, qadmU: elu ? elu.qadm : null, glis: sy && sy.glis ? sy.glis : null };
    });
    const joints = (R.rephor && R.rephor.joints || []).map((j) => ({ lieu: j.lieu, ouv: Math.max.apply(null, (j.vals || []).map((x) => x.ouv)), ferm: Math.min.apply(null, (j.vals || []).map((x) => x.ferm)) }));
    return {
      type: R.s.type, nom: R.t.nom, regl: R.s.regl, verdicts: v, appareils: app, appuis, fond, joints,
      metres: R.metres ? R.metres.recap : null, metresRows: R.metres ? R.metres.rows : [], alertes: R.alertes || [],
      tab: { hT: R.tabA && R.tabA.hT, B: R.tabA && R.tabA.B }, sps: R.sps ? (R.sps.sondage || 'exemple') : null,
      ok: v.every((x) => x.statut === 'ok'),
    };
  }

  return { justifMap, justifSummary, JUSTIF_LIBS: LIBS, justifChainType: chainType };
});
