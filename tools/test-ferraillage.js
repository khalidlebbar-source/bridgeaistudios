/* Plans coffrage & ferraillage — vérifications (node tools/test-ferraillage.js).
 *  1. Mur M5 KLE (plot 10 m, exemple M5) : masse à ±5 % du plan réel sans écarteur
 *     (591,6 − 12 × 0,875 × 0,617 = 585,1 kg), 67 barres n° 1.
 *     Mur M4 (paramétrage de la feuille de stabilité) : eb, talon, hauteur de poussée.
 *  2. Dalot par défaut : aucune valeur NaN, masses > 0, dessins et DXF sans NaN.
 *  3. Recalcul du nombre de barres quand l'espacement change ; découpe au-delà de 12 m.
 *  4. Fermeture de la semelle : mode « U » (défaut, repères 5-8 + coupe longitudinale) et mode « retours ».
 *     Le plan réel M5 est en retours : le test de masse M5 tourne dans ce mode.
 */
const F = Object.assign({}, require('../ferraillage/calc.js'), require('../ferraillage/draw.js'), require('../ferraillage/dxf.js'));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) fails++; };
const bad = (s) => /NaN|undefined|Infinity/.test(s);

// 1. Mur M5
const ECART = 12 * 0.875 * 0.617; // écarteurs du plan réel (ex-repère 9), retirés de la proposition
const M5 = { total: 591.6 - ECART, HA10: 49.2 - ECART, HA12: 542.4 };
const M5g = F.preset('murT', 'M5');
const RET = { fermeture: 'retours' };
const m = F.compute('murT', M5g, RET, {});
const r1 = m.rows.find((r) => r.id === '1');
const ecart = (m.recap.total - M5.total) / M5.total * 100;
ok(r1 && r1.n === 67 && r1.d === 12 && r1.esp === 0.15, `M5 barre 1 : HA${r1.d} × ${r1.n} e=${r1.esp} (attendu HA12 × 67 e=0.15)`);
ok(m.rows.map((r) => r.id).join() === '1,2,3,4,9,10,11,12' && !m.bars.some((b) => /cart|chaise/i.test(b.role)), 'M5 : aucun écarteur ; numérotation KLE : semelle 1-4 + 9 (maintien), voile 10-12');
ok(Math.abs(ecart) <= 5, `M5 masse totale ${m.recap.total.toFixed(1)} kg vs ${M5.total.toFixed(1)} kg (écart ${ecart >= 0 ? '+' : ''}${ecart.toFixed(2)} %)`);
const ref = { 1: [12, 67, 0.15], 3: [12, 67, 0.15], 10: [12, 134, 0.15], 2: [12, 6, 0.2], 4: [12, 6, 0.2], 11: [12, 10, 0.2], 9: [10, 72, 6], 12: [10, 60, 6] };
for (const [id, [d, tot, esp]] of Object.entries(ref)) {
  const r = m.rows.find((x) => x.id === id);
  ok(r && r.d === d && r.total === tot && r.esp === esp, `M5 repère ${id} : HA${r.d}, ${r.total} barres, esp. ${r.esp}`);
}
for (const d of [10, 12]) {
  const l = m.recap.lignes.find((x) => x.d === d);
  console.log(`  HA${d} : ${l.longueur.toFixed(1)} m / ${l.masse.toFixed(1)} kg (plan réel sans écarteur ${M5['HA' + d].toFixed(1)} kg)`);
}

// 1 bis. Mur M4 : grandeurs déduites comme la feuille Excel, proposition « principe M4 »
const M4g = F.preset('murT', 'M4'), d4 = F.STRUCTURES.murT.derive(M4g);
ok(F.STRUCTURES.murT.validate(M4g).length === 0, 'M4 : saisie cohérente');
ok(Math.abs(d4.Hv - 3.30) < 1e-9, `M4 Hv = ${d4.Hv} (attendu 3,30)`);
ok(Math.abs(d4.eb - 0.4975) < 1e-9, `M4 eb = ${d4.eb} (attendu 0,4975)`);
ok(Math.abs(d4.talon - 2.7025) < 1e-9, `M4 talon = ${d4.talon} (attendu 2,7025)`);
ok(Math.abs(d4.Hp - 5.475) < 0.002, `M4 hauteur de poussée = ${d4.Hp} (attendu ≈ 5,475)`);
const m4 = F.compute('murT', M4g, {}, {});
ok(m4.rows.every((r) => [r.n, r.L, r.Ltot, r.masse].every(Number.isFinite)) && m4.recap.total > 0, `M4 : ${m4.rows.length} lignes sans NaN, masse ${m4.recap.total.toFixed(1)} kg`);
const has = (role, d) => m4.bars.some((b) => b.role.startsWith(role) && b.d === d);
const kd = (k) => (m4.bars.find((b) => b.key === k) || {}).d;
ok(has('Voile face terres', 14) && has('Renfort de pied', 20) && has('Voile face aval', 12) && kd('S') === 20 && kd('I') === 14,
  'M4 : voile terres HA14 + renfort HA20, face avant HA12, semelle sup. HA20 / inf. HA14');
ok(m4.bars.find((b) => b.key === 'Ev').esp === 4 && m4.bars.find((b) => b.key === 'Ev').code === '3001', 'M4 : épingles HA10 4/m², code 3001');
ok(m4.bars.map((b) => +b.id).join() === '1,2,3,4,5,6,7,8,9,10,11,12,13,14', 'M4 (mode U) : semelle 1-9 continue (5-8 fermetures), voile 10-14');
const mb = F.compute('murT', Object.assign({}, M4g, { beche: true }), {}, {});
ok(mb.bars.map((b) => b.id + ':' + b.key).join() === '1:I,2:FsI,3:S,4:FsS,5:U5,6:U6,7:R7,8:R8,9:Es,10:Av,11:Am,12:R,13:Fv,14:Ev,15:Bc,16:Bf', 'M4 avec bêche : semelle 1-9, voile 10-14, bêche 15-16 juste après le voile');
const mbr = F.compute('murT', Object.assign({}, M4g, { beche: true }), RET, {});
ok(mbr.bars.map((b) => b.id + ':' + b.key).join() === '1:I,2:FsI,3:S,4:FsS,9:Es,10:Av,11:Am,12:R,13:Fv,14:Ev,15:Bc,16:Bf', 'M4 retours + bêche : 5-8 libres, bêche 15-16');
const vt = m4.bars.find((b) => b.role.startsWith('Voile face terres'));
ok(Math.abs(vt.segs[1].a - (90 + Math.atan(0.075) * 180 / Math.PI)) < 0.01, `M4 : verticaux terres parallèles au parement (${vt.segs[1].a}°)`);
// options de forme : bêche + biseau, et contrôles de cohérence
const opt = Object.assign({}, M4g, { beche: true, biseau: true, bpos: 'talon', fv: 0.02 });
const mo = F.compute('murT', opt, {}, {});
ok(F.STRUCTURES.murT.validate(opt).length === 0 && mo.rows.every((r) => Number.isFinite(r.masse) && r.masse > 0) && mo.bars.some((b) => b.role.startsWith('Bêche')),
  `M4 bêche + biseau : bêche ferraillée, ${mo.recap.total.toFixed(1)} kg`);
ok(F.STRUCTURES.murT.validate(Object.assign({}, M4g, { B: 0.9 })).some((e) => /Talon négatif/.test(e)), 'Contrôle : talon négatif détecté');
ok(F.STRUCTURES.murT.validate(Object.assign({}, M4g, { beche: true, bpos: 'libre', bx: 3.5 })).some((e) => /bêche/.test(e)), 'Contrôle : bêche hors semelle détectée');

// 2. Dalot par défaut
const g = F.defaults('dalot'), dl = F.compute('dalot', g, {}, {});
ok(dl.rows.length > 0 && dl.rows.every((r) => [r.n, r.L, r.Ltot, r.masse].every(Number.isFinite)), `Dalot : ${dl.rows.length} lignes sans NaN`);
ok(dl.rows.every((r) => r.masse > 0) && dl.recap.total > 0, `Dalot : masses > 0 (total ${dl.recap.total.toFixed(1)} kg)`);
for (const [s, g0] of [['murT', M5g], ['murT', M4g], ['murT', opt], ['dalot', F.defaults('dalot')]]) {
  const gg = F.STRUCTURES[s].derive(g0), res = F.compute(s, g0, {}, {});
  const svgs = [F.toSVG(F.coffrageScene(s, gg, 1 / 300), 300), F.toSVG(F.secondScene(s, gg, 1 / 60), 60),
    F.toSVG(F.ferraillageScene(s, gg, res.bars, res.params, 1 / 300), 300)].concat(res.rows.map((r) => F.croquisSVG(r.shape)));
  ok(!svgs.some(bad), `${s} : dessins SVG sans NaN`);
  const dxf = F.buildDXF(s, gg, res, {});
  ok(!bad(dxf) && dxf.includes('AC1009') && /\r\nEOF\r\n$/.test(dxf) && F.DXF_LAYERS.every((l) => dxf.includes('\r\n' + l + '\r\n')), `${s} : DXF R12 complet (${dxf.length} octets, 5 calques)`);
  ok(/^[\x00-\x7f]*$/.test(dxf), `${s} : DXF en ASCII pur (accents en \\U+XXXX)`);
}

// 2 bis. Dessin : angles cintrés au mandrin, longueur dessinée = longueur développée (±5 mm d'arrondi)
for (const [nm, g0, ids] of [['M5', M5g, ['5', '10', '9']], ['M4', M4g, ['5', '10', '11', '9']]]) {
  const res = F.compute('murT', g0, {}, {});
  ids.forEach((id) => {
    const b = res.bars.find((x) => x.id === id), bp = F.barPath(b, b.place.items[0], res.params), row = res.rows.find((r) => r.id === id);
    const ld = F.pathLength(bp.path), nb = bp.path.filter((v) => Math.abs(v.b) > 1e-9).length;
    ok(Math.abs(ld - row.L) <= 0.005 && nb > 0, `${nm} repère ${id} : dessiné ${ld.toFixed(3)} m / nomenclature ${row.L.toFixed(3)} m, ${nb} arc(s) au rayon ${(bp.R * 100).toFixed(1)} cm`);
  });
}
const thick = F.toSVG(F.ferraillageScene('murT', F.STRUCTURES.murT.derive(M4g), m4.bars, m4.params, 1 / 1000), 1000);
ok(/stroke-width="20\.00"/.test(thick) && /stroke-width="14\.00"/.test(thick), 'Épaisseurs réelles à 1000 px/m : HA20 → 20 px, HA14 → 14 px');
const shift = F.compute('murT', M4g, {}, { 1: { d: 25 } });
const u5y = (res) => res.bars.find((b) => b.key === 'U5').place.items[0].pts.slice(-1)[0][1];
ok(Math.abs(shift.bars[0].place.items[0].pts[1][1] - (0.05 + 0.0125)) < 1e-9 && u5y(shift) > u5y(m4) + 0.01,
  'Ø du repère 1 porté à 25 : axe replacé à enrobage + Ø/2, branche basse des U 5 décalée vers l\u2019intérieur');

// 2 ter. Maintien des nappes : épingles ou étriers (réglage global, choix par barre prioritaire)
for (const [nm, g0] of [['M5', M5g], ['M4', M4g]]) {
  const re = F.compute('murT', g0, { maintien: 'etrier' }, {});
  const et = re.bars.filter((b) => b.maintien === 'etrier');
  ok(et.length === 2 && et.every((b) => b.code === '5201' && b.segs.length === 4 && b.hooks.join() === '135,135' && Math.min(b.segs[0].l, b.segs[1].l) < 0.08), `${nm} étriers (global) : 2 repères, boucle fermée étroite (largeur ${et.map((b) => Math.min(b.segs[0].l, b.segs[1].l)).join(' / ')} m) + 2 crosses 135°`);
  et.forEach((b) => {
    const bp = F.barPath(b, b.place.items[0], re.params), row = re.rows.find((r) => r.id === b.id);
    const ld = F.pathLength(bp.path), dv = F.devLength({ segs: b.segs, hooks: b.hooks }, b.d, re.params).L;
    // voile à fruit : la cote utilise l'épaisseur moyenne, le dessin l'épaisseur à la hauteur dessinée
    const tol = b.key === 'Ev' && g0.fa + g0.fv > 0 ? 0.15 : 0.03;
    ok(Math.abs(ld - row.L) <= tol && Math.abs(dv - row.L) < 1e-9 && bp.path.filter((v) => Math.abs(v.b) > 1e-9).length === 5,
      `${nm} repère ${b.id} étrier : L développée ${row.L.toFixed(3)} m (dessin ${ld.toFixed(3)} m), 2 demi-cercles + 2 crosses cintrés`);
  });
  const svg = F.toSVG(F.ferraillageScene('murT', re.geom, re.bars, re.params, 1 / 300), 300) + re.rows.map((r) => F.croquisSVG(r.shape)).join('');
  ok(!bad(svg), `${nm} étriers : dessins sans NaN`);
}
const idEs = m4.bars.find((b) => b.key === 'Es').id, idEv = m4.bars.find((b) => b.key === 'Ev').id;
const mix = F.compute('murT', M4g, { maintien: 'etrier' }, { [idEs]: { maint: 'epingle' } });
ok(mix.bars.find((b) => b.id === idEs).code === '3001' && mix.bars.find((b) => b.id === idEv).code === '5201', 'Choix par barre prioritaire : semelle en épingles malgré le réglage global « étriers »');
const h180 = F.compute('murT', M4g, {}, { [idEs]: { hooks: [180, 180] } }).rows.find((r) => r.id === idEs);
ok(h180.L > m4.rows.find((r) => r.id === idEs).L - 0.1 && h180.shape.hooks.join() === '180,180', `Épingle à crosses 180° : L = ${h180.L.toFixed(3)} m`);

// 3. Recalcul quand l'espacement change
const m2 = F.compute('murT', M5g, {}, { 1: { esp: 0.20 }, 2: { esp: 0.10 } });
const n1 = m2.rows.find((r) => r.id === '1').n, n4 = m2.rows.find((r) => r.id === '2').n;
ok(n1 === 50, `Repère 1 à e=0.20 : ${n1} barres (floor(9.90/0.20)+1 = 50)`);
ok(n4 === 12, `Repère 2 (filants inf.) à e=0.10 : ${n4} barres (floor(1.10/0.10)+1 = 12)`);
ok(Math.abs(m2.recap.total - m.recap.total) > 1, `Masse recalculée : ${m2.recap.total.toFixed(1)} kg`);
const m3 = F.compute('murT', M5g, {}, { 10: { d: 14, hooks: [0, 180] } });
const r3 = m3.rows.find((r) => r.id === '10'), r3o = m.rows.find((r) => r.id === '10');
ok(r3.d === 14 && r3.L !== r3o.L, `Repère 10 (voile) en HA14 + crosse 180° : L = ${r3.L.toFixed(3)} m (au lieu de ${r3o.L.toFixed(3)})`);
const long = F.compute('murT', Object.assign({}, M5g, { L: 25 }), {}, {});
const pieces = long.rows.filter((r) => r.barId === '2');
ok(pieces.length === 3 && pieces.every((p) => p.L <= 12 + 1e-9) && pieces.map((p) => p.id).join() === '2a,2b,2c',
  `Bloc de 25 m : filants 2 découpés en ${pieces.map((p) => p.id + ' ' + p.L.toFixed(3)).join(', ')}`);

// 4. Fermeture de la semelle en U (défaut) : repères 5 à 8, longueurs, comptes, coupe longitudinale
for (const [nm, g0] of [['M5', M5g], ['M4', M4g], ['M4 biseau', Object.assign({}, M4g, { biseau: true })]]) {
  const re = F.compute('murT', g0, {}, {}), gg = re.geom, p = re.params, c = p.cTerre;
  const row = (id) => re.rows.find((r) => r.id === id), bar = (id) => re.bars.find((b) => b.id === id);
  const ids = re.rows.map((r) => r.id);
  ok(['1', '2', '3', '4', '5', '6', '9', '10'].every((x) => ids.includes(x)) && new Set(ids).size === ids.length, `${nm} (U) : repères ${ids.join(',')}`);
  ok(bar('1').segs.length === 1 && bar('2').segs.length === 1 && bar('4').segs.length === 1, `${nm} (U) : 1, 2, 4 droits (sans retours)`);
  const m6 = bar('6').d / 1000;
  ok(Math.abs(bar('2').segs[0].l - (gg.L - 2 * c - 2 * m6)) < 1e-6, `${nm} (U) : filants 2 = L − 2c − 2Ø6 = ${bar('2').segs[0].l} m`);
  const n6 = Math.floor((gg.B - 2 * c) / 0.20 + 1e-9) + 1;
  ok(row('6').n === n6 && row('6').total === 2 * n6 && row('5').total === 2 * row('1').n, `${nm} (U) : 6 = ${n6} par joint × 2 = ${row('6').total} ; 5 = ${row('5').total} (2 par position des 1)`);
  const sg5 = bar('5').segs, br5 = sg5[sg5.length - 1].l; // branche basse (la haute peut suivre le biseau en 2 segments)
  ok(Math.abs(br5 - Math.min(p.recouv * bar('5').d / 1000, (gg.B - 2 * c) / 2)) < 0.005, `${nm} (U) : branche des U 5 = ${br5} m (recouv·Ø plafonné)`);
  // longueurs dessinées = nomenclature (coupe transversale pour 1, 3, 5 ; coupe longitudinale pour 6)
  const lenT = (id, k) => F.pathLength(F.barPath(bar(id), bar(id).place.items[k || 0], p).path);
  const lenL = (id) => F.pathLength(F.barPath({ d: bar(id).d, hooks: [0, 0], segs: [{ l: 0, a: 0 }] }, { pts: bar(id).longi.items[0].pts }, p).path);
  // biseau : axe décalé sur les pentes (≈ 1 cm) ; âme des 6 variable sur la largeur (nomenclature à l'épaisseur moyenne)
  const tolB = g0.biseau ? 0.03 : 0.006;
  [['1', lenT('1')], ['3', lenT('3')], ['5', lenT('5')], ['5 (talon)', lenT('5', 1)], ['6', lenL('6')]].forEach(([id, ld]) => {
    const L0 = row(id.split(' ')[0]).L;
    ok(Math.abs(ld - L0) <= (g0.biseau ? (id === '6' ? 0.2 : tolB) : 0.006), `${nm} (U) repère ${id} : dessin ${ld.toFixed(3)} m / nomenclature ${L0.toFixed(3)} m`);
  });
  if (nm === 'M5') ok(!ids.includes('7') && !ids.includes('8'), 'M5 (U) : semelle de 0,25 m — pas de place pour les répartitions 7 et 8 (repères non créés)');
  if (nm === 'M4') {
    ok(row('7') && row('7').n === 3 && row('7').total === 6 && row('8').n === 3 && row('8').total === 6 && bar('7').d === 10 && bar('7').esp === 0.15,
      `M4 (U) : 7 et 8 en HA10 e15, ${row('7').n} positions intermédiaires × 2 chacun`);
    ok(bar('5').d === 12 && bar('5').esp === 0.15 && bar('6').d === 12 && bar('6').esp === 0.20, 'M4 (U) : 5 = HA12 e15, 6 = HA12 e20');
  }
  const svgT = F.toSVG(F.ferraillageScene('murT', gg, re.bars, p, 1 / 300), 300), svgL = F.toSVG(F.longiScene('murT', gg, re.bars, p, 1 / 300), 300);
  ok(!bad(svgT + svgL + re.rows.map((r) => F.croquisSVG(r.shape)).join('')) && /data-bar="6"/.test(svgL) && /data-bar="1"/.test(svgL) && !/data-bar="6"/.test(svgT),
    `${nm} (U) : coupes transversale et longitudinale sans NaN (6 visible en coupe longitudinale)`);
  const dxf = F.buildDXF('murT', gg, re, {});
  ok(!bad(dxf) && dxf.includes('COUPE LONGITUDINALE A-A') && /^[\x00-\x7f]*$/.test(dxf), `${nm} (U) : DXF avec coupe longitudinale titrée`);
}
const r7 = F.compute('murT', M4g, {}, { 7: { esp: 0.10 } }).rows.find((r) => r.id === '7');
ok(r7.n === 4, `Répartition 7 à e=0,10 : ${r7.n} barres (nombre recalculé)`);
const ret = F.compute('murT', M4g, RET, {});
ok(!ret.rows.some((r) => ['5', '6', '7', '8'].includes(r.id)) && ret.bars.find((b) => b.id === '1').segs.length === 3, 'Mode retours : 1 en U à retours, pas de repères 5 à 8');
ok(!bad(F.toSVG(F.longiScene('murT', ret.geom, ret.bars, ret.params, 1 / 300), 300)), 'Mode retours : coupe longitudinale sans NaN (filants à retours aux joints)');

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent');
process.exit(fails ? 1 : 0);
