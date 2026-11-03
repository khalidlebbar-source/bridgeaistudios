/* SONDPRES — tests du moteur (node tools/test-outils-sondpres.js) : lecture / écriture SPS, contrôles, statistiques. */
const S = require('../outils/js/sondpres.js');
let f = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));

// 1. fichier SPS synthétique (structure du format d'origine : 6 lignes, XYZ, nappe, 2 réels, coupe ***, essais £££, $$TVCC)
const txt = ['Labo', '', 'Projet test', 'Ouvrage', 'SP1', '01/01/2020', '   100.000     200.000      50.000', '3.00  ', '0.00    0.00  ',
  '0.00    remblai', '2.00    argile', '10.00    ***',
  '1.00    0  0.50    0.30    5.00 ', '2.00    0  0.60    0.35    6.00 ', '3.00    0  1.20    0.70    14.00', '£££', '', 'remarque libre', '', '$$TVCC',
  '0.00    "remblai"  0.50    0.30    5.00    0.50    LA', '2.00    "argile grise"  1.20    0.70    14.00   0.67    AB', '10.00    "***"', ''].join('\r\n');
const s = S.parse(txt);
ok(s.sondage === 'SP1' && s.z === 50 && s.x === 100 && s.nappe === 3 && s.fin === 10, 'identification, cote de tête, nappe, fin');
ok(s.lithologie.length === 2 && s.lithologie[1].desc === 'argile', 'coupe lithologique');
ok(s.essais.length === 3 && s.essais[2].em === 14, 'essais (z, pl, pf, EM)');
ok(s.couches.length === 2 && s.couches[1].nom === 'argile grise' && s.couches[1].classe === 'AB' && near(s.couches[1].alpha, 0.67), 'couches de calcul TVCC avec nom entre guillemets');
ok(s.remarques.join('|') === '|remarque libre', 'remarques conservées');
// lecture d'un fichier décodé en latin-1 après passage en UTF-8 (« Â£Â£Â£ »)
ok(S.parse(txt.replace('£££', 'Â£Â£Â£')).essais.length === 3, 'fin des essais reconnue malgré un mauvais décodage de « £££ »');
// 2. aller-retour écriture / lecture
const s2 = S.parse(S.write(s));
ok(JSON.stringify(s2.couches) === JSON.stringify(s.couches) && JSON.stringify(s2.essais) === JSON.stringify(s.essais) && s2.z === s.z && s2.fin === s.fin, 'aller-retour write → parse identique');
ok(S.write(s).includes('\r\n£££\r\n') && S.write(s).includes('$$TVCC'), 'format d’origine (CRLF, £££, $$TVCC)');
s.couches[0].gamma = 18; s.couches[0].phi = 28; s.couches[0].c = 5;
const s3 = S.parse(S.write(s));
ok(s3.couches[0].gamma === 18 && s3.couches[0].phi === 28 && s3.couches[0].c === 5 && Number.isNaN(s3.couches[1].gamma), 'extension $$GPC (γ, φ, c) relue');
// 3. couches normalisées, couche à une profondeur
const C = S.couches(s);
ok(C[0].haut === 0 && C[0].bas === 2 && C[1].bas === 10 && C[1].groupe === 'argile' && C[1].categorie === 'B', 'couches : haut, bas, nature, catégorie');
ok(S.couche(s, 5).nom === 'argile grise' && S.couche(s, 25).nom === 'argile grise', 'couche à une profondeur (prolongement sous le sondage)');
// 4. statistiques : moyenne géométrique de pl, harmonique de EM
const st = S.stats(s, 0, 2.5);
ok(st.n === 2 && near(st.pl, Math.sqrt(0.5 * 0.6)) && near(st.em, 2 / (1 / 5 + 1 / 6)), 'moyennes géométrique (pl) et harmonique (EM)');
// 5. catégories (Fasc. 62 titre V annexe C1) et α (annexe F2)
ok(S.categorieSuggeree('A', 0.5).categorie === 'A' && S.categorieSuggeree('A', 1.5).categorie === 'B' && S.categorieSuggeree('S', 3).categorie === 'C', 'catégorie suggérée');
ok(S.categorieSuggeree('A', 0.9).ambigu === true, 'zone intermédiaire du tableau signalée');
ok(near(S.alphaSuggere('A', 20), 1) && near(S.alphaSuggere('A', 12), 2 / 3) && near(S.alphaSuggere('S', 8), 1 / 3) && near(S.alphaSuggere('G', 12), 1 / 3), 'coefficient rhéologique α');
ok(S.decodeClasse('SB').valide && !S.decodeClasse('XZ').valide && !S.decodeClasse('MC').valide, 'classes valides / invalides');
// 6. contrôles
ok(S.controle(s).ok, 'sondage cohérent : aucune erreur');
const bad = JSON.parse(JSON.stringify(s)); bad.essais.push({ z: 12, ind: 0, pl: 1, pf: 2, em: 5 }); bad.couches[1].classe = 'QQ';
const cb = S.controle(bad);
ok(!cb.ok && cb.err.some((m) => /sous la fin/.test(m)) && cb.err.some((m) => /QQ/.test(m)) && cb.av.some((m) => /pf > pl/.test(m)), 'contrôles : essai sous la fin, classe inconnue, pf > pl');
// 7. exemple par défaut
ok(S.controle(S.exemple()).ok && S.couches(S.exemple()).length === 3, 'jeu d’exemple conforme');
// 8. cas d'origine : sondage « PressioC0 » (Champfleury) reconstitué numériquement — couches LA / SB
const p0 = S.vide(); Object.assign(p0, { z: 160, nappe: 8, fin: 20, finCouches: 20, couches: [{ z: 0, nom: 'limon', pl: 0.4, pf: 0.24, em: 5, alpha: 0.5, classe: 'LA' }, { z: 10.5, nom: 'sable', pl: 3.5, pf: 2.1, em: 20, alpha: 0.33, classe: 'SB' }] });
ok(S.couche(p0, 12).classe === 'SB' && S.cote(p0, 10.5) === 149.5, 'PressioC0 : couche SB sous 10,50 m (cote 149,50)');
process.exit(f ? 1 : 0);
