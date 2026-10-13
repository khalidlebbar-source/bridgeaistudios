/* Plans coffrage & ferraillage — vérifications (node tools/test-ferraillage.js).
 *  1. Mur M5 KLE (plot 10 m, exemple M5) : masse à ±5 % de 591,6 kg, 67 barres n° 1.
 *     Mur M4 (paramétrage de la feuille de stabilité) : eb, talon, hauteur de poussée.
 *  2. Dalot par défaut : aucune valeur NaN, masses > 0, dessins et DXF sans NaN.
 *  3. Recalcul du nombre de barres quand l'espacement change ; découpe au-delà de 12 m.
 */
const F = Object.assign({}, require('../ferraillage/calc.js'), require('../ferraillage/draw.js'), require('../ferraillage/dxf.js'));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) fails++; };
const bad = (s) => /NaN|undefined|Infinity/.test(s);

// 1. Mur M5
const M5 = { total: 591.6, HA10: 49.2, HA12: 542.4 };
const M5g = F.preset('murT', 'M5');
const m = F.compute('murT', M5g, {}, {});
const r1 = m.rows.find((r) => r.id === '1');
const ecart = (m.recap.total - M5.total) / M5.total * 100;
ok(r1 && r1.n === 67 && r1.d === 12 && r1.esp === 0.15, `M5 barre 1 : HA${r1.d} × ${r1.n} e=${r1.esp} (attendu HA12 × 67 e=0.15)`);
ok(Math.abs(ecart) <= 5, `M5 masse totale ${m.recap.total.toFixed(1)} kg vs ${M5.total} kg (écart ${ecart >= 0 ? '+' : ''}${ecart.toFixed(2)} %)`);
const ref = { 1: [12, 67, 0.15], 2: [12, 67, 0.15], 3: [12, 134, 0.15], 4: [12, 6, 0.2], 5: [12, 6, 0.2], 6: [12, 10, 0.2], 7: [10, 72, 6], 8: [10, 60, 6], 9: [10, 12, 1] };
for (const [id, [d, tot, esp]] of Object.entries(ref)) {
  const r = m.rows.find((x) => x.id === id);
  ok(r && r.d === d && r.total === tot && r.esp === esp, `M5 repère ${id} : HA${r.d}, ${r.total} barres, esp. ${r.esp}`);
}
for (const d of [10, 12]) {
  const l = m.recap.lignes.find((x) => x.d === d);
  console.log(`  HA${d} : ${l.longueur.toFixed(1)} m / ${l.masse.toFixed(1)} kg (plan réel ${M5['HA' + d]} kg)`);
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
ok(has('Voile face terres', 14) && has('Renfort de pied', 20) && has('Voile face aval', 12) && has('U semelle — nappe sup', 20) && has('U semelle — nappe inf', 14),
  'M4 : voile terres HA14 + renfort HA20, face avant HA12, semelle sup. HA20 / inf. HA14');
ok(m4.bars.find((b) => b.role === 'Épingles voile').esp === 4, 'M4 : épingles HA10 4/m²');
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

// 3. Recalcul quand l'espacement change
const m2 = F.compute('murT', M5g, {}, { 1: { esp: 0.20 }, 4: { esp: 0.10 } });
const n1 = m2.rows.find((r) => r.id === '1').n, n4 = m2.rows.find((r) => r.id === '4').n;
ok(n1 === 50, `Repère 1 à e=0.20 : ${n1} barres (floor(9.90/0.20)+1 = 50)`);
ok(n4 === 12, `Repère 4 à e=0.10 : ${n4} barres (floor(1.10/0.10)+1 = 12)`);
ok(Math.abs(m2.recap.total - m.recap.total) > 1, `Masse recalculée : ${m2.recap.total.toFixed(1)} kg`);
const m3 = F.compute('murT', M5g, {}, { 3: { d: 14, hooks: [0, 180] } });
const r3 = m3.rows.find((r) => r.id === '3'), r3o = m.rows.find((r) => r.id === '3');
ok(r3.d === 14 && r3.L !== r3o.L, `Repère 3 en HA14 + crosse 180° : L = ${r3.L.toFixed(3)} m (au lieu de ${r3o.L.toFixed(3)})`);
const long = F.compute('murT', Object.assign({}, M5g, { L: 25 }), {}, {});
const pieces = long.rows.filter((r) => r.barId === '4');
ok(pieces.length === 3 && pieces.every((p) => p.L <= 12 + 1e-9) && pieces.map((p) => p.id).join() === '4a,4b,4c',
  `Bloc de 25 m : filants 4 découpés en ${pieces.map((p) => p.id + ' ' + p.L.toFixed(3)).join(', ')}`);

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent');
process.exit(fails ? 1 : 0);
