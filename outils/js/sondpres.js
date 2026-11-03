/* SONDPRES — sondages pressiométriques : lecture / écriture du format texte SPS, contrôles,
 * caractéristiques de calcul par couche (Fascicule 62 titre V, NF P 94-262 annexe E).
 * Moteur pur (aucun DOM) : module.exports pour node, window.BA.sondpres dans le navigateur.
 * Réutilisé par FONDATIO, APPUI, RACBA-RAPO, MUR3D (parse, couches, couche, cote).
 *
 * Unités : profondeurs et cotes en m ; pl, pf, EM en MPa (usage pressiométrique) ; γ en kN/m³ ; φ en degrés ; c en kPa.
 *
 * Format SPS (fichier texte, CRLF, Windows-1252) tel que lu dans les fichiers de référence :
 *   1 entreprise · 2 adresse · 3 projet / affaire · 4 ouvrage · 5 nom du sondage · 6 date
 *   7 « X  Y  Z »  (Z = cote de la tête du sondage)
 *   8 profondeur de la nappe (0 = pas de nappe relevée)
 *   9 deux réels conservés tels quels (le plus souvent « 0.00  0.00 »)
 *   coupe lithologique : « profondeur  description » jusqu'à la ligne « profondeur  *** » (fin du sondage)
 *   essais : « profondeur  indicateur  pl  pf  EM » jusqu'à la ligne « £££ »
 *   lignes libres (remarques), puis « $$TVCC » : caractéristiques de calcul par couche
 *   « cote_haut  "nom"  pl  pf  EM  α  classe » jusqu'à « profondeur  "***" ».
 *   Classe = 2 lettres : nature (A argile, L limon, S sable, G grave, C craie, M marne, R roche) + catégorie (A, B, C).
 *   Les valeurs pl de la section TVCC sont exploitées comme pressions limites nettes pl* par le calcul des fondations.
 * Extension facultative (écrite seulement si renseignée) : section « $$GPC » « profondeur  γ  φ  c » par couche TVCC. */
(function (root) {
  'use strict';

  const NATURES = {
    A: { nom: 'Argile', groupe: 'argile' }, L: { nom: 'Limon', groupe: 'argile' },
    S: { nom: 'Sable', groupe: 'sable' }, G: { nom: 'Grave', groupe: 'sable' },
    C: { nom: 'Craie', groupe: 'craie' }, M: { nom: 'Marne, marno-calcaire', groupe: 'marne' },
    R: { nom: 'Roche altérée', groupe: 'roche' }, T: { nom: 'Tourbe', groupe: 'argile' },
  };
  /* Catégories conventionnelles du Fascicule 62 titre V (annexe C1, tableau des classes de sols) : pl en MPa. */
  const CLASSES = {
    argile: [['A', 'argiles et limons mous', 0, 0.7], ['B', 'argiles et limons fermes', 1.2, 2.0], ['C', 'argiles très fermes à dures', 2.5, Infinity]],
    sable: [['A', 'lâches', 0, 0.5], ['B', 'moyennement compacts', 1.0, 2.0], ['C', 'compacts', 2.5, Infinity]],
    craie: [['A', 'molles', 0, 0.7], ['B', 'altérées', 1.0, 2.5], ['C', 'compactes', 3.0, Infinity]],
    marne: [['A', 'tendres', 1.5, 4.0], ['B', 'compacts', 4.5, Infinity]],
    roche: [['A', 'altérées', 2.5, 4.0], ['B', 'fragmentées', 4.5, Infinity]],
  };

  const num = (s, d = NaN) => { const n = parseFloat(String(s).trim().replace(',', '.')); return Number.isFinite(n) ? n : d; };
  const f2 = (x, n = 2) => (Number.isFinite(+x) ? (+x).toFixed(n) : (0).toFixed(n));
  const pad = (s, w) => { s = String(s); return s.length >= w ? s + ' ' : s + ' '.repeat(w - s.length); };

  function vide() {
    return { entreprise: '', adresse: '', projet: '', ouvrage: '', sondage: '', date: '', x: 0, y: 0, z: 0, nappe: 0,
      l9: [0, 0], lithologie: [], fin: 0, essais: [], remarques: [], couches: [], finCouches: 0 };
  }

  /* ── lecture ── */
  function parse(text) {
    const L = String(text).replace(/\r\n?/g, '\n').split('\n');
    const s = vide(), warn = [];
    let i = 0;
    const line = () => (i < L.length ? L[i++] : null);
    ['entreprise', 'adresse', 'projet', 'ouvrage', 'sondage', 'date'].forEach((k) => { const l = line(); s[k] = l === null ? '' : l.trim(); });
    const xyz = (line() || '').trim().split(/\s+/).map((v) => num(v, 0));
    if (xyz.length < 3) warn.push('Ligne des coordonnées X Y Z incomplète.');
    [s.x, s.y, s.z] = [xyz[0] || 0, xyz[1] || 0, xyz[2] || 0];
    s.nappe = num(line(), 0);
    const l9 = (line() || '').trim().split(/\s+/).map((v) => num(v, 0));
    s.l9 = [l9[0] || 0, l9[1] || 0];
    // coupe lithologique
    let l;
    while ((l = line()) !== null) {
      const t = l.trim(); if (!t) continue;
      const m = t.match(/^(-?[\d.,]+)\s*(.*)$/);
      if (!m) { warn.push('Ligne de coupe illisible : « ' + t + ' »'); continue; }
      const z = num(m[1]), d = m[2].trim();
      if (d === '***') { s.fin = z; break; }
      s.lithologie.push({ z, desc: d });
    }
    // essais
    while ((l = line()) !== null) {
      const t = l.trim(); if (!t) continue;
      // fin des essais : « £££ » (lu Â£Â£Â£ si le fichier a été décodé en latin-1 après un passage en UTF-8) ou toute ligne non numérique
      if (!/^-?[\d.,]/.test(t)) { if (t.startsWith('$$')) i--; break; }
      const v = t.split(/\s+/).map((x) => num(x));
      if (v.length < 5 || v.some((x) => !Number.isFinite(x))) { warn.push('Ligne d’essai illisible : « ' + t + ' »'); continue; }
      s.essais.push({ z: v[0], ind: v[1], pl: v[2], pf: v[3], em: v[4] });
    }
    // remarques jusqu'à $$TVCC
    const rem = [];
    while ((l = line()) !== null) { if (l.trim().startsWith('$$TVCC')) break; rem.push(l.replace(/\s+$/, '')); }
    while (rem.length && !rem[rem.length - 1].trim()) rem.pop();
    s.remarques = rem;
    // caractéristiques de calcul
    while ((l = line()) !== null) {
      const t = l.trim(); if (!t) continue;
      if (t.startsWith('$$')) { i--; break; }
      const m = t.match(/^(-?[\d.,]+)\s+"([^"]*)"\s*(.*)$/) || t.match(/^(-?[\d.,]+)\s+(\S+)\s*(.*)$/);
      if (!m) { warn.push('Ligne TVCC illisible : « ' + t + ' »'); continue; }
      const z = num(m[1]), nom = m[2].trim();
      if (nom === '***') { s.finCouches = z; break; }
      const r = m[3].trim().split(/\s+/);
      s.couches.push({ z, nom, pl: num(r[0], 0), pf: num(r[1], 0), em: num(r[2], 0), alpha: num(r[3], 0.5), classe: (r[4] || '').toUpperCase(),
        gamma: NaN, phi: NaN, c: NaN });
    }
    // extension facultative γ, φ, c
    while ((l = line()) !== null) {
      const t = l.trim();
      if (!t.startsWith('$$GPC')) continue;
      while ((l = line()) !== null) {
        const v = l.trim().split(/\s+/).map((x) => num(x));
        if (!l.trim() || v.length < 4) break;
        const c = s.couches.find((k) => Math.abs(k.z - v[0]) < 1e-6);
        if (c) { c.gamma = v[1]; c.phi = v[2]; c.c = v[3]; }
      }
    }
    if (!s.finCouches && s.couches.length) s.finCouches = s.fin;
    s._avert = warn;
    return s;
  }

  /* ── écriture (format d'origine, CRLF) ── */
  function write(s, o = {}) {
    const out = [];
    ['entreprise', 'adresse', 'projet', 'ouvrage', 'sondage', 'date'].forEach((k) => out.push(String(s[k] || '').replace(/[\r\n]/g, ' ')));
    out.push(`${(+s.x || 0).toFixed(3).padStart(10)}  ${(+s.y || 0).toFixed(3).padStart(10)}  ${(+s.z || 0).toFixed(3).padStart(10)}`);
    out.push(pad(f2(s.nappe), 6));
    out.push(pad(f2((s.l9 || [0, 0])[0]), 8) + pad(f2((s.l9 || [0, 0])[1]), 6));
    for (const c of s.lithologie || []) out.push(pad(f2(c.z), 8) + String(c.desc || '').replace(/[\r\n]/g, ' '));
    out.push(pad(f2(s.fin), 8) + ' ***');
    for (const e of s.essais || []) out.push(pad(f2(e.z), 8) + pad(String(Math.round(e.ind || 0)), 3) + pad(f2(e.pl), 8) + pad(f2(e.pf), 8) + pad(f2(e.em), 6));
    out.push('£££');
    for (const r of s.remarques || []) out.push(r);
    out.push('', '$$TVCC');
    for (const c of s.couches || []) {
      out.push(pad(f2(c.z), 8) + `"${String(c.nom || '').replace(/"/g, "'")}"  ` + pad(f2(c.pl), 8) + pad(f2(c.pf), 8) + pad(f2(c.em), 8) + pad(f2(c.alpha), 8) + String(c.classe || '').toUpperCase());
    }
    out.push(pad(f2(s.finCouches || s.fin), 8) + ' "***"');
    const gpc = (s.couches || []).filter((c) => [c.gamma, c.phi, c.c].some(Number.isFinite));
    if (gpc.length && o.ext !== false) {
      out.push('$$GPC');
      for (const c of gpc) out.push(pad(f2(c.z), 8) + pad(f2(Number.isFinite(c.gamma) ? c.gamma : 0), 8) + pad(f2(Number.isFinite(c.phi) ? c.phi : 0), 8) + f2(Number.isFinite(c.c) ? c.c : 0));
    }
    out.push('');
    return out.join('\r\n');
  }

  /* ── classes ── */
  function decodeClasse(code) {
    const c = String(code || '').toUpperCase();
    const nat = NATURES[c[0]] ? c[0] : null, cat = c[1] || '';
    const grp = nat ? NATURES[nat].groupe : null;
    const ok = !!grp && CLASSES[grp].some((k) => k[0] === cat);
    return { nature: nat, groupe: grp, categorie: cat, valide: ok, libelle: nat ? `${NATURES[nat].nom}${cat ? ' — catégorie ' + cat : ''}` : 'classe inconnue' };
  }
  /* Catégorie suggérée d'après pl (Fasc. 62 titre V annexe C1). Les intervalles du tableau ne sont pas jointifs :
   * dans une lacune on retient la catégorie inférieure et on le signale (ambigu = true). */
  function categorieSuggeree(nature, pl) {
    const grp = (NATURES[nature] || {}).groupe; if (!grp || !Number.isFinite(pl)) return null;
    const T = CLASSES[grp];
    for (let k = 0; k < T.length; k++) {
      if (pl >= T[k][2] && pl <= T[k][3]) return { categorie: T[k][0], ambigu: false, libelle: T[k][1] };
      if (k + 1 < T.length && pl > T[k][3] && pl < T[k + 1][2]) return { categorie: T[k][0], ambigu: true, libelle: T[k][1] };
    }
    if (pl < T[0][2]) return { categorie: T[0][0], ambigu: true, libelle: T[0][1] };
    return { categorie: T[T.length - 1][0], ambigu: false, libelle: T[T.length - 1][1] };
  }
  /* Coefficient rhéologique α de Ménard (Fasc. 62 titre V annexe F2, tableau) d'après EM/pl. */
  function alphaSuggere(nature, ratio) {
    const r = ratio;
    switch (nature) {
      case 'T': return 1;
      case 'A': return r > 16 ? 1 : r >= 9 ? 2 / 3 : 1 / 2;
      case 'L': return r > 14 ? 2 / 3 : 1 / 2;
      case 'S': return r > 12 ? 1 / 2 : 1 / 3;
      case 'G': return r > 10 ? 1 / 3 : 1 / 4;
      case 'C': case 'M': case 'R': return 1 / 2; // roche « normale » (fracturation courante)
      default: return 1 / 2;
    }
  }

  /* ── couches normalisées ──
   * renvoie [{haut, bas, nom, pl, pf, em, alpha, classe, nature, groupe, categorie, gamma, phi, c}] (profondeurs / tête de sondage). */
  function couches(s) {
    const C = (s.couches || []).slice().sort((a, b) => a.z - b.z);
    const fin = Math.max(s.finCouches || 0, s.fin || 0, C.length ? C[C.length - 1].z : 0);
    return C.map((c, k) => {
      const d = decodeClasse(c.classe);
      return Object.assign({}, c, { haut: c.z, bas: k + 1 < C.length ? C[k + 1].z : fin, nature: d.nature, groupe: d.groupe, categorie: d.categorie });
    });
  }
  /* couche à la profondeur z (au-delà de la dernière : prolongement de la dernière couche) */
  function couche(s, z, cl) {
    const C = cl || couches(s);
    if (!C.length) return null;
    for (const c of C) if (z >= c.haut - 1e-9 && z < c.bas - 1e-9) return c;
    return z < C[0].haut ? C[0] : C[C.length - 1];
  }
  const cote = (s, z) => s.z - z;
  const profondeur = (s, cot) => s.z - cot;

  /* ── statistiques des essais dans une tranche [z1, z2[ ──
   * pl et pf : moyenne géométrique (règle usuelle pour ple*), EM : moyenne harmonique (Fasc. 62 annexe F2). */
  function stats(s, z1, z2) {
    const E = (s.essais || []).filter((e) => e.z >= z1 - 1e-9 && e.z < z2 - 1e-9 && e.pl > 0 && e.em > 0);
    if (!E.length) return null;
    const g = (k) => Math.exp(E.reduce((t, e) => t + Math.log(Math.max(e[k], 1e-6)), 0) / E.length);
    const em = E.length / E.reduce((t, e) => t + 1 / e.em, 0);
    const pl = g('pl'), pf = E.every((e) => e.pf > 0) ? g('pf') : NaN;
    return { n: E.length, pl, pf, em, ratio: em / pl, plMin: Math.min(...E.map((e) => e.pl)), emMin: Math.min(...E.map((e) => e.em)) };
  }

  /* ── contrôles de cohérence ── */
  function controle(s) {
    const err = [], av = [];
    const L = s.lithologie || [], E = s.essais || [], C = s.couches || [];
    if (!(s.fin > 0) && (L.length || E.length)) err.push('Profondeur de fin de sondage non renseignée.');
    for (let k = 1; k < L.length; k++) if (!(L[k].z > L[k - 1].z)) err.push(`Coupe : profondeurs non croissantes (${L[k - 1].z} puis ${L[k].z}).`);
    if (L.length && L[L.length - 1].z >= s.fin) err.push('Coupe : la dernière formation commence sous la fin du sondage.');
    for (let k = 0; k < E.length; k++) {
      const e = E[k];
      if (k && !(e.z > E[k - 1].z)) err.push(`Essais : profondeurs non croissantes (${E[k - 1].z} puis ${e.z}).`);
      if (s.fin > 0 && e.z > s.fin + 1e-9) err.push(`Essai à ${e.z} m sous la fin du sondage (${s.fin} m).`);
      if (e.pl < 0 || e.pf < 0 || e.em < 0) err.push(`Essai à ${e.z} m : valeur négative.`);
      if (e.pf > e.pl + 1e-9 && e.pl > 0) av.push(`Essai à ${e.z} m : pf > pl.`);
    }
    for (let k = 0; k < C.length; k++) {
      const c = C[k];
      if (k && !(c.z > C[k - 1].z)) err.push(`Couches de calcul : profondeurs non croissantes (${C[k - 1].z} puis ${c.z}).`);
      const d = decodeClasse(c.classe);
      if (!d.valide) err.push(`Couche « ${c.nom} » : classe « ${c.classe} » non reconnue (ex. AB, SB, MA, RB).`);
      if (!(c.pl > 0)) err.push(`Couche « ${c.nom} » : pl nulle.`);
      if (!(c.em > 0)) err.push(`Couche « ${c.nom} » : EM nul.`);
      if (c.pf > c.pl + 1e-9) av.push(`Couche « ${c.nom} » : pf > pl.`);
      if (!(c.alpha > 0 && c.alpha <= 1)) err.push(`Couche « ${c.nom} » : α doit être compris entre 0 et 1.`);
      if (d.valide && c.pl > 0) {
        const sg = categorieSuggeree(d.nature, c.pl);
        if (sg && sg.categorie !== d.categorie) av.push(`Couche « ${c.nom} » : pl = ${c.pl} MPa correspond plutôt à la catégorie ${sg.categorie}${sg.ambigu ? ' (zone intermédiaire du tableau)' : ''}.`);
      }
    }
    if (C.length && C[0].z > 1e-6) av.push('La première couche de calcul ne commence pas en tête de sondage.');
    if (C.length && s.fin > 0 && Math.abs((s.finCouches || s.fin) - s.fin) > 1e-6) av.push('La fin des couches de calcul diffère de la fin du sondage.');
    return { err, av, ok: !err.length };
  }

  /* points pour les profils (escalier des couches de calcul) */
  function profilCouches(s, k) {
    const C = couches(s), xs = [], ys = [];
    for (const c of C) { xs.push(c.haut, c.bas); ys.push(c[k], c[k]); }
    return { z: xs, v: ys };
  }

  function exemple() {
    // Sondage fictif représentatif : limon sur sables et graves, nappe à 3 m.
    return {
      entreprise: 'Laboratoire géotechnique', adresse: '', projet: 'Ouvrage de franchissement', ouvrage: 'Culée C0', sondage: 'SP1', date: '15/03/2026',
      x: 0, y: 0, z: 100.00, nappe: 3.00, l9: [0, 0],
      lithologie: [{ z: 0, desc: 'Terre végétale' }, { z: 0.4, desc: 'Limon brun' }, { z: 4.5, desc: 'Sable fin gris' }, { z: 9.0, desc: 'Grave sableuse compacte' }],
      fin: 18.0,
      essais: [
        [1, 0.45, 0.28, 4.2], [2, 0.52, 0.31, 5.1], [3, 0.48, 0.30, 4.6], [4, 0.60, 0.36, 6.0], [5, 1.10, 0.65, 9.5], [6, 1.45, 0.85, 12.8],
        [7, 1.62, 0.95, 14.1], [8, 1.80, 1.05, 16.0], [9, 2.30, 1.35, 22.0], [10, 2.90, 1.70, 28.5], [11, 3.20, 1.90, 31.0], [12, 3.60, 2.10, 36.0],
        [13, 3.40, 2.00, 33.0], [14, 3.80, 2.20, 39.0], [15, 4.10, 2.40, 42.0], [16, 4.00, 2.35, 40.5], [17, 4.30, 2.55, 45.0],
      ].map(([z, pl, pf, em]) => ({ z, ind: 0, pl, pf, em })),
      remarques: [],
      couches: [
        { z: 0.0, nom: 'Limon brun', pl: 0.50, pf: 0.30, em: 5.0, alpha: 0.5, classe: 'LA', gamma: 19, phi: 25, c: 5 },
        { z: 4.5, nom: 'Sable fin gris', pl: 1.50, pf: 0.90, em: 12.0, alpha: 0.33, classe: 'SB', gamma: 20, phi: 32, c: 0 },
        { z: 9.0, nom: 'Grave sableuse', pl: 3.40, pf: 2.00, em: 33.0, alpha: 0.33, classe: 'GC', gamma: 21, phi: 38, c: 0 },
      ],
      finCouches: 18.0,
    };
  }

  const api = { parse, write, vide, exemple, couches, couche, cote, profondeur, stats, controle, decodeClasse, categorieSuggeree, alphaSuggere, profilCouches, NATURES, CLASSES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.sondpres = api; }
})(typeof window !== 'undefined' ? window : globalThis);
