/* MODELPRA — modélisation plane des ponts-rails (poutre continue, portique, cadre multiple).
 * Moteur pur (aucun accès au DOM). Node : module.exports ; navigateur : window.BA.modeleRail.
 * Dépend de BA.portique (solveur) et BA.charges (UIC 71, SW/0, SW/2, convois, Φ).
 *
 * API réutilisable (CADRES, APPUI) :
 *   genere(params)                     → modèle {long:{LD,CD,SIS}, trans:{CD,SIS}, geo, params}
 *   calcule(modele[, options])         → résultats (cas élémentaires, rail, séisme, combinaisons)
 *   enveloppesFerroviaires(modele, o)  → enveloppes UIC 71 / SW/0 / SW/2 / convois (max, min, concomitants)
 *   lireDon(texte)                     → paramètres à partir d'un fichier MODELPRA .don
 *
 * Références :
 *  - EN 1990 + annexe A2 (ponts) et AN française : combinaisons (6.4.3.2, 6.5.3), tableaux A2.3 (ψ) et A2.4(B) (γ).
 *  - EN 1991-2 §6.3.2 (LM71, α), §6.3.3 (SW/0, SW/2), §6.4.5 (Φ2, Φ3, tableau 6.2 pour LΦ), §6.5.3 (démarrage, freinage).
 *  - EN 1991-1-5 §6.1.4 (gradient), §6.1.6 (ωN = 0,35, ωM = 0,75).
 *  - EN 1998-1 §3.2.2.2 (spectre élastique), §3.2.2.3 (vertical), §3.2.2.5 (spectre de calcul) + AN française
 *    (paramètres de sol, TB, TC, TD ; agr par zone, arrêté du 22/10/2010 ; γI des ponts, arrêté du 26/10/2011).
 *  - EN 1998-2 §4.1.2 (masses, ψ2,1), §4.2.1.3 (analyse modale, CQC), §4.2.2 (mode fondamental), §4.2.1.4 (directions).
 * Unités : kN, m, kPa ; masses en t (kN·s²/m) ; MPa uniquement pour fck et le module G des élastomères.
 */
(function (root) {
  'use strict';
  const P = (typeof module !== 'undefined' && module.exports) ? require('./portique.js') : root.BA.portique;
  const C = (typeof module !== 'undefined' && module.exports) ? require('./charges.js') : root.BA.charges;
  const G_ACC = 9.81;
  const ALPHA_T = 1e-5; // coefficient de dilatation thermique du béton (EN 1992-1-1 §3.1.3(5))

  /* ───────────────────────── paramètres par défaut ───────────────────────── */
  function defauts() {
    return {
      titre: 'Portique ouvert 2 travées sur piédroits',
      travees: [8, 8], consoleDeb: 1.0, consoleFin: 1.0, nbElTrav: 10,
      materiau: { mode: 'BAEL', fck: 35, Ei: 0, phi: 2, gamma: 25 },
      tablier: { mode: 'dalle', b: 1.0, h: 0.80, A: 0.8, I: 0.0427, It: 0, Sreel: 0, goussets: [], loi: 'lin' },
      appuis: [
        { nom: 'Culée C0', type: 'piedroit', h: 6, A: 0.8, I: 0.0427, Ab: 0, Ib: 0, base: 'encastre', kyT: 0, IT: 0 },
        { nom: 'Pile P1', type: 'piedroit', h: 6, A: 0.6, I: 0.018, Ab: 0, Ib: 0, base: 'encastre', kyT: 0, IT: 0 },
        { nom: 'Culée C2', type: 'piedroit', h: 6, A: 0.8, I: 0.0427, Ab: 0, Ib: 0, base: 'encastre', kyT: 0, IT: 0 },
      ],
      nbElPied: 6,
      radier: { actif: false, e: 0.8, b: 1.0, kv: 30000 },
      actions: {
        superstructures: 6, ballast: 20, retrait: -2e-4, denivAppui: 0.005, denivCulees: 0,
        tLD: { con: -2.5e-4, dil: 2.5e-4 }, tCD: { con: -1e-4, dil: 1e-4 }, gradient: { chaud: 15, froid: 8 }, qvent: 0,
      },
      rail: {
        uic: true, sw0: true, sw2: false, alpha: 1.0, entretien: 'soigne', Lphi: 0, kRep: 1.0, pas: 0.1, xDeb: null, xFin: null,
        freinage: true, kFrein: 1.0, nbVoies: 1, convois: [],
      },
      quelconques: [],
      pasTablier: 0,
      seisme: { actif: true, massesAppuis: true, zone: 3, sol: 'B', classe: 'II', agr: 0, q: 1.0, qT: 1.0, xi: 5, methode: 'modal', vertical: true, masseSup: 0, psi2rail: 0.3, nModes: 0 },
      trans: { actif: true },
      combi: { gGsup: 1.35, gGinf: 1.0, gQ: 1.45, gQsw2: 1.35, gQautre: 1.5, gT: 1.5, gSet: 1.2, psi0T: 0.6, psi1T: 0.6, psi2T: 0.5, psi0Q: 0.8, psi0A: 0.8, psi1A: 0.5 },
    };
  }

  /* ───────────────────────── matériaux ─────────────────────────
   * BAEL 91 A.2.1,21 : Eij = 11 000 fcj^(1/3) MPa ; module différé Ed = Ei/(1+φ) (φ = 2 → Evj = Eij/3).
   * EN 1992-1-1 tableau 3.1 : Ecm = 22 000 ((fck+8)/10)^0,3 MPa ; Ed = Ecm/(1+φ).                         */
  function modules(m) {
    let Ei;
    if (m.mode === 'saisie' && m.Ei > 0) Ei = m.Ei;
    else if (m.mode === 'EC2') Ei = 22000 * Math.pow((m.fck + 8) / 10, 0.3) * 1000;
    else Ei = 11000 * Math.cbrt(m.fck) * 1000;
    const Ed = (m.mode === 'saisie' && m.Ed > 0) ? m.Ed : Ei / (1 + (m.phi ?? 2));
    return { Ei, Ed };
  }

  /* section du tablier à l'abscisse locale t (0..L) d'une travée : hauteur variable par goussets
   * (variation linéaire ou parabolique sur la longueur lg depuis l'appui). */
  function hauteurTablier(p, it, t, L) {
    const tb = p.tablier, g = (tb.goussets || [])[it] || {};
    let dh = 0;
    const loi = (u) => tb.loi === 'para' ? u * u : u;
    if (g.hg > 0 && g.lg > 0 && t < g.lg) dh = Math.max(dh, g.hg * loi(1 - t / g.lg));
    if (g.hd > 0 && g.ld > 0 && L - t < g.ld) dh = Math.max(dh, g.hd * loi(1 - (L - t) / g.ld));
    return dh;
  }
  function sectionTablier(p, dh) {
    const tb = p.tablier;
    if (tb.mode === 'section') {
      // section saisie (A, I) : les goussets ajoutent une hauteur dh sur la largeur b
      const h0 = tb.h || Math.cbrt(12 * tb.I / (tb.b || 1));
      const b = tb.b || 1, h = h0 + dh;
      return { A: tb.A + b * dh, I: tb.I * Math.pow(h / h0, 3), h, It: tb.It > 0 ? tb.It : tb.A * b * b / 12 };
    }
    const h = tb.h + dh;
    return { A: tb.b * h, I: tb.b * h * h * h / 12, h, It: h * Math.pow(tb.b, 3) / 12 };
  }

  /* ───────────────────────── génération du modèle ───────────────────────── */
  function genere(params) {
    const p = Object.assign(defauts(), params || {});
    const nT = p.travees.length;
    if (!nT) throw new Error('Saisir au moins une travée.');
    if ((p.appuis || []).length !== nT + 1) throw new Error('Il faut ' + (nT + 1) + ' appuis pour ' + nT + ' travée(s).');
    const mod = modules(p.materiau);
    const gam = p.materiau.gamma || 25;
    const nEl = Math.max(1, Math.round(p.nbElTrav || 10));

    /* géométrie commune : nœuds du tablier (abscisse x) */
    const deck = []; // {x, n}
    const deckEl = []; // {i, j, dh, travee, console}
    const xs = [];
    if (p.consoleDeb > 0) xs.push({ x: -p.consoleDeb, trav: -1 });
    let x = 0; xs.push({ x: 0, appui: 0 });
    const nElT = p.travees.map((L) => (p.pasTablier > 0 ? Math.max(2, Math.round(L / p.pasTablier)) : nEl));
    p.travees.forEach((L, t) => {
      const ne = nElT[t];
      for (let k = 1; k <= ne; k++) xs.push(k === ne ? { x: x + L, appui: t + 1 } : { x: x + L * k / ne });
      x += L;
    });
    if (p.consoleFin > 0) xs.push({ x: x + p.consoleFin });
    const Ltot = x;
    xs.forEach((o, k) => deck.push(Object.assign({ n: k }, o)));
    for (let k = 0; k < deck.length - 1; k++) {
      const a = deck[k].x, b = deck[k + 1].x, xm = (a + b) / 2;
      let trav = -1, dh = 0;
      if (xm < 0) trav = 'deb'; else if (xm > Ltot) trav = 'fin';
      else {
        let x0 = 0; for (let t = 0; t < nT; t++) { if (xm <= x0 + p.travees[t] + 1e-9) { trav = t; dh = hauteurTablier(p, t, xm - x0, p.travees[t]); break; } x0 += p.travees[t]; }
      }
      deckEl.push({ i: k, j: k + 1, travee: trav, dh, L: b - a, x0: a });
    }
    const appuiNode = []; deck.forEach((d) => { if (d.appui !== undefined) appuiNode[d.appui] = d.n; });

    /* masse et poids linéiques du tablier */
    const sec0 = sectionTablier(p, 0);
    const SreelPoids = (p.tablier.Sreel > 0) ? p.tablier.Sreel : null;

    function build(regime) {
      // regime : 'LD' (longue durée, Ed), 'CD' (courte durée, Ei), 'SIS' (séisme, Ei)
      const E = regime === 'LD' ? mod.Ed : mod.Ei;
      const nodes = deck.map((d) => ({ x: d.x, y: 0 }));
      const elems = deckEl.map((e) => { const s = sectionTablier(p, e.dh); return { i: e.i, j: e.j, E, A: s.A, I: s.I, kind: 'deck', travee: e.travee, h: s.h }; });
      const supports = [];
      const appuis = [];
      const nodalPP = []; // poids propre des appuis (nœuds)
      const masses = []; // masses des appuis (t) par nœud
      const radierNodes = [];
      p.appuis.forEach((a, ia) => {
        const top = appuiNode[ia];
        const dhA = Math.max(0, ...deckEl.filter((e) => e.i === top || e.j === top).map((e) => (e.travee === 'deb' || e.travee === 'fin') ? 0 : e.dh));
        const hTab = sectionTablier(p, dhA).h;
        const info = { nom: a.nom || ('Appui ' + (ia + 1)), type: a.type, top, sup: [], elems: [], base: null, x: deck[top].x };
        const kReg = (o, def) => { if (!o) return def; const v = typeof o === 'object' ? o[regime] : o; return v; };
        const ress = (v) => (v === true || v >= 1e12) ? true : (v > 0 ? v : false);
        if (a.type === 'piedroit' || a.type === 'pile') {
          const Ea = E; // béton des appuis supposé identique (saisir E si différent)
          const nb = Math.max(2, Math.round(a.nbEl || p.nbElPied || 6));
          const Atop = a.A, Itop = a.I, Ab = a.Ab > 0 ? a.Ab : a.A, Ib = a.Ib > 0 ? a.Ib : a.I;
          const h = a.h, yTop = -hTab / 2;
          let prev = top;
          if (a.type === 'pile') {
            // liaison appareil d'appui : barre de longueur hTab/2 articulée côté tablier, raideur horizontale k = 3EI/ℓ³
            // raideur horizontale des appareils : saisie (kx) ou élastomère fretté K = n·G·A/T (NF EN 1337-3)
            const l = hTab / 2;
            const Gr = (regime === 'LD' ? a.GLD : regime === 'SIS' ? a.GSIS : a.GCD) || 0;
            let kxv = a.Ael > 0 && a.Tel > 0 && Gr > 0 ? Gr * 1000 * a.Ael / a.Tel * (a.nAp || 1) : kReg(a.kx, 0);
            if (kxv === true || kxv >= 1e12) kxv = 1e10; if (!(kxv > 0)) kxv = 1e-3;
            const kyv = 1e10;
            nodes.push({ x: deck[top].x, y: yTop });
            const nTopPile = nodes.length - 1;
            elems.push({ i: top, j: nTopPile, E: Ea, A: kyv * l / Ea, I: kxv * l * l * l / (3 * Ea), rel: [true, false], kind: 'link', appui: ia });
            info.elems.push(elems.length - 1); info.link = elems.length - 1; info.kx = kxv;
            prev = nTopPile;
            // la pile part du dessous du tablier : nb éléments sur h
            for (let k = 0; k < nb; k++) {
              const y = yTop - h * (k + 1) / nb;
              nodes.push({ x: deck[top].x, y });
              const r = (k + 0.5) / nb;
              elems.push({ i: prev, j: nodes.length - 1, E: Ea, A: Atop + r * (Ab - Atop), I: Itop + r * (Ib - Itop), kind: 'pier', appui: ia });
              info.elems.push(elems.length - 1);
              const zm = h * (k + 0.5) / nb, Am = Atop + (zm / h) * (Ab - Atop);
              nodalPP.push({ n: nodes.length - 1, Fy: -gam * Am * h / nb });
              masses.push({ n: nodes.length - 1, m: gam * Am * h / nb / G_ACC, pier: ia, z: zm / h });
              prev = nodes.length - 1;
            }
          } else {
            // piédroit encastré dans le tablier : 1 élément dans la demi-épaisseur du tablier + (nb−1) sur la hauteur h
            // sections interpolées par indice d'élément (comme le modèle d'origine), poids calculé sur la géométrie réelle
            const ys = [0, yTop]; for (let k = 1; k < nb; k++) ys.push(yTop - h * k / (nb - 1));
            for (let k = 0; k < nb; k++) {
              nodes.push({ x: deck[top].x, y: ys[k + 1] });
              const r = (k + 0.5) / nb;
              elems.push({ i: prev, j: nodes.length - 1, E: Ea, A: Atop + r * (Ab - Atop), I: Itop + r * (Ib - Itop), kind: 'pier', appui: ia });
              info.elems.push(elems.length - 1);
              if (k > 0) {
                const z1 = h * (k - 1) / (nb - 1), z2 = h * k / (nb - 1), zm = (z1 + z2) / 2, Am = Atop + (zm / h) * (Ab - Atop);
                nodalPP.push({ n: nodes.length - 1, Fy: -gam * Am * (z2 - z1) });
                masses.push({ n: nodes.length - 1, m: gam * Am * (z2 - z1) / G_ACC, pier: ia, z: zm / h });
              }
              prev = nodes.length - 1;
            }
          }
          info.base = prev;
          if (p.radier && p.radier.actif) radierNodes.push({ n: prev, ia });
          else {
            const b = a.base || 'encastre';
            const s = { n: prev, ux: true, uy: true, rz: b === 'encastre' }; // 'articule' : rotation libre
            if (b === 'ressorts') { s.ux = ress(kReg(a.kbx, true)); s.uy = ress(kReg(a.kby, true)); s.rz = ress(kReg(a.kbr, 0)); }
            supports.push(s); info.sup.push(supports.length - 1);
          }
        } else {
          // appui direct du tablier : simple (fixe ou mobile), ressorts saisis, appareil en élastomère
          let ux = false, uy = true;
          if (a.type === 'simple') { ux = !!a.fixe; uy = true; }
          else if (a.type === 'ressorts') { ux = ress(kReg(a.kx, 0)); uy = ress(kReg(a.ky, true)); }
          else if (a.type === 'elastomere') {
            // raideur de distorsion K = G·A/T (G longue durée, courte durée, séisme) — NF EN 1337-3 / guide SETRA
            const G = (regime === 'LD' ? a.GLD : regime === 'SIS' ? a.GSIS : a.GCD) || 0.9;
            ux = G * 1000 * (a.Ael || 0) / Math.max(a.Tel || 1e-6, 1e-6) * (a.nAp || 1);
            if (!(ux > 0)) ux = false;
            uy = ress(kReg(a.ky, true));
          }
          supports.push({ n: top, ux, uy, rz: false }); info.sup.push(supports.length - 1);
        }
        appuis.push(info);
      });
      // radier sur sol élastique (Winkler) reliant les pieds des piédroits
      if (p.radier && p.radier.actif && radierNodes.length >= 2) {
        const r = p.radier, Ar = r.b * r.e, Ir = r.b * Math.pow(r.e, 3) / 12;
        const yR = nodes[radierNodes[0].n].y;
        const rn = [radierNodes[0].n];
        for (let k = 0; k < radierNodes.length - 1; k++) {
          const a = radierNodes[k].n, b = radierNodes[k + 1].n, xa = nodes[a].x, xb = nodes[b].x;
          let prev = a;
          for (let s = 1; s <= nEl; s++) {
            let nn;
            if (s === nEl) nn = b; else { nodes.push({ x: xa + (xb - xa) * s / nEl, y: yR }); nn = nodes.length - 1; }
            elems.push({ i: prev, j: nn, E, A: Ar, I: Ir, kind: 'radier' });
            nodalPP.push({ n: prev, Fy: -gam * Ar * (xb - xa) / nEl / 2 }, { n: nn, Fy: -gam * Ar * (xb - xa) / nEl / 2 });
            prev = nn; if (s < nEl) rn.push(nn); else rn.push(b);
          }
        }
        // ressorts verticaux kv·b·(longueur d'influence) ; un seul blocage horizontal au nœud central (isostatique en x)
        const rx = rn.map((n) => nodes[n].x);
        const mid = rn[Math.floor(rn.length / 2)];
        rn.forEach((n, k) => {
          const l = ((k > 0 ? rx[k] - rx[k - 1] : 0) + (k < rn.length - 1 ? rx[k + 1] - rx[k] : 0)) / 2;
          supports.push({ n, ux: n === mid, uy: r.kv * r.b * l, rz: false, radier: true });
        });
        // descente de charges en pied de piédroit = effort transmis au radier par la barre (voir effets())
        appuis.forEach((a) => { a.sup = []; a.radier = true; });
      }
      return { nodes, elems, supports, appuis, nodalPP, masses, regime, E };
    }

    /* modèle transversal : tablier vu en plan sur ressorts horizontaux transversaux (1 par appui) */
    function buildTrans(regime) {
      const E = mod.Ei;
      const nodes = deck.map((d) => ({ x: d.x, y: 0 }));
      const elems = deckEl.map((e) => { const s = sectionTablier(p, e.dh); return { i: e.i, j: e.j, E, A: s.A, I: s.It, kind: 'deck', travee: e.travee }; });
      const supports = [], appuis = [];
      let fixeX = p.appuis.findIndex((a) => (a.type === 'simple' && a.fixe) || a.type === 'piedroit');
      if (fixeX < 0) fixeX = 0;
      p.appuis.forEach((a, ia) => {
        const top = appuiNode[ia];
        let ky = a.kyT > 0 ? a.kyT : 0;
        if (!(ky > 0) && (a.type === 'piedroit' || a.type === 'pile')) {
          // raideur transversale d'un fût encastré en pied, tête libre en rotation : 3EI/H³ (H = h + h_tablier/2)
          const IT = a.IT > 0 ? a.IT : a.I, H = a.h + sec0.h / 2;
          ky = 3 * mod.Ei * IT / Math.pow(H, 3);
        }
        supports.push({ n: top, ux: ia === fixeX, uy: ky > 0 ? ky : true, rz: false });
        appuis.push({ nom: a.nom || ('Appui ' + (ia + 1)), top, sup: [supports.length - 1], ky: ky > 0 ? ky : Infinity });
      });
      return { nodes, elems, supports, appuis, regime, E, nodalPP: [], masses: [] };
    }

    const long = { LD: build('LD'), CD: build('CD'), SIS: build('SIS') };
    const trans = { CD: buildTrans('CD'), SIS: buildTrans('SIS') };
    const poidsDeck = deckEl.map((e) => gam * (SreelPoids && !e.dh ? SreelPoids : sectionTablier(p, e.dh).A * (SreelPoids ? SreelPoids / sec0.A : 1)));
    return { params: p, mod, deck, deckEl, appuiNode, Ltot, long, trans, poidsDeck, sec0 };
  }

  /* ───────────────────────── vecteur d'effets ─────────────────────────
   * Pour chaque barre : [Ni, Vi, Mi, Nj, Vj, Mj] (efforts internes, M > 0 tend la fibre inférieure du tablier) ;
   * pour chaque appui : [Rx, Ry, Mz] (réactions / descente de charges, repère global) ;
   * pour chaque nœud du tablier : flèche uy.                                                                   */
  function layout(m) { const nE = m.elems.length, nA = m.appuis.length; return { nE, nA, nD: m.nodes.length, size: 6 * nE + 3 * nA + m.nodes.length, offA: 6 * nE, offD: 6 * nE + 3 * nA }; }
  function effets(m, r) {
    const L = layout(m), v = new Float64Array(L.size);
    for (let e = 0; e < L.nE; e++) {
      const len = r.lens[e];
      const a = r.at(e, 0), b = r.at(e, len);
      v[6 * e] = a.N; v[6 * e + 1] = a.V; v[6 * e + 2] = a.M; v[6 * e + 3] = b.N; v[6 * e + 4] = b.V; v[6 * e + 5] = b.M;
    }
    m.appuis.forEach((a, k) => {
      let Rx = 0, Ry = 0, Mz = 0;
      if (a.sup.length) for (const s of a.sup) { const rr = r.reac[s]; Rx += rr.Rx; Ry += rr.Ry; Mz += rr.Mz; }
      else if (a.base !== null && a.elems.length) {
        // pied de piédroit sur radier : effort transmis par la barre au radier (repère global)
        const e = a.elems[a.elems.length - 1], F = r.ends[e].F, g = r.geo[e];
        Rx = g.c * F[3] - g.s * F[4]; Ry = g.s * F[3] + g.c * F[4]; Mz = F[5];
      }
      v[L.offA + 3 * k] = Rx; v[L.offA + 3 * k + 1] = Ry; v[L.offA + 3 * k + 2] = Mz;
    });
    for (let n = 0; n < L.nD; n++) v[L.offD + n] = r.U[3 * n + 1];
    return v;
  }
  function prep(m) {
    if (!m._pr) {
      const pr = P.prepare(m);
      m._pr = pr;
      m._lens = pr.elems.map((e) => e.L);
      m._geo = pr.elems;
    }
    return m._pr;
  }
  function run(m, loads) {
    const pr = prep(m), r = pr.run(loads);
    r.lens = m._lens; r.geo = m._geo;
    return { r, v: effets(m, r) };
  }

  /* ───────────────────────── chargements élémentaires ───────────────────────── */
  const deckElems = (m) => m.elems.map((e, k) => (e.kind === 'deck' ? k : -1)).filter((k) => k >= 0);
  function chargesUnitaires(M) {
    const p = M.params, out = {};
    const LD = M.long.LD, CD = M.long.CD;
    const dE = deckElems(LD);
    // 1. poids propre de la structure (tablier : γ·S réelle ; appuis : poids nodaux)
    out.pp = run(LD, { elem: dE.map((e, k) => ({ e, type: 'u', q: -M.poidsDeck[k] })), nodal: LD.nodalPP.map((o) => ({ n: o.n, Fy: o.Fy })) });
    // 2. 1 kN/ml vertical réparti sur le tablier (longue et courte durée)
    out.v1LD = run(LD, { elem: dE.map((e) => ({ e, type: 'u', q: -1 })) });
    out.v1CD = run(CD, { elem: dE.map((e) => ({ e, type: 'u', q: -1 })) });
    // 3. 1 kN/ml horizontal réparti sur le tablier (courte durée : freinage ; longue durée)
    out.h1CD = run(CD, { elem: dE.map((e) => ({ e, type: 'u', dir: 'gx', q: 1 })) });
    out.h1LD = run(LD, { elem: dE.map((e) => ({ e, type: 'u', dir: 'gx', q: 1 })) });
    // 4. allongement unitaire ε = 1e-5 du tablier (retrait, contraction, dilatation)
    out.eLD = run(LD, { strain: dE.map((e) => ({ e, eps: 1e-5 })) });
    out.eCD = run(CD, { strain: dE.map((e) => ({ e, eps: 1e-5 })) });
    // 5. gradient thermique ΔT = +1 °C (fibre supérieure plus chaude) : courbure imposée κ = −α·ΔT/h
    out.grad = run(CD, { strain: dE.map((e) => ({ e, kappa: -ALPHA_T / CD.elems[e].h })) });
    // 6. dénivellations d'appuis : tassement δ = 1 m de chaque appui (longue durée), puis des deux culées
    out.tass = LD.appuis.map((a) => run(LD, tassement(LD, [a], 1)));
    out.tassC = run(LD, tassement(LD, [LD.appuis[0], LD.appuis[LD.appuis.length - 1]], 1));
    // 7. charges quelconques
    out.qq = (p.quelconques || []).map((q) => run(q.cat === 'G' ? LD : CD, chargeQuelconque(M, q.cat === 'G' ? LD : CD, q)));
    return out;
  }
  function tassement(m, appuis, d) {
    const disp = [], nodal = [];
    for (const a of appuis) for (const s of a.sup) {
      const sp = m.supports[s];
      if (sp.uy === true) disp.push({ n: sp.n, dof: 'uy', v: -d });
      else if (sp.uy > 0) nodal.push({ n: sp.n, Fy: -sp.uy * d }); // tassement du sol sous un ressort : force équivalente
    }
    return { disp, nodal };
  }
  function locDeck(M, m, x) {
    const dE = deckElems(m);
    for (let k = 0; k < dE.length; k++) {
      const e = M.deckEl[k];
      if (x >= e.x0 - 1e-9 && (x < e.x0 + e.L - 1e-9 || k === dE.length - 1)) return { e: dE[k], a: Math.min(e.L, Math.max(0, x - e.x0)) };
    }
    return null;
  }
  function chargeQuelconque(M, m, q) {
    const elem = [];
    const x1 = +q.x1, x2 = q.x2 === undefined || q.x2 === '' ? +q.x1 : +q.x2;
    if (Math.abs(x2 - x1) < 1e-9) {
      const l = locDeck(M, m, x1); if (l) { if (q.q1) elem.push({ e: l.e, type: 'p', P: -q.q1, a: l.a }); if (q.H) elem.push({ e: l.e, type: 'p', dir: 'gx', P: q.H, a: l.a }); }
    } else {
      const a = Math.min(x1, x2), b = Math.max(x1, x2), q1 = x1 <= x2 ? +q.q1 : +q.q2, q2 = x1 <= x2 ? +(q.q2 ?? q.q1) : +q.q1;
      deckElems(m).forEach((e, k) => {
        const d = M.deckEl[k], lo = Math.max(a, d.x0), hi = Math.min(b, d.x0 + d.L);
        if (hi - lo < 1e-9) return;
        const f = (x) => q1 + (q2 - q1) * (x - a) / (b - a);
        if (q1 || q2) elem.push({ e, type: 't', q1: -f(lo), q2: -f(hi), a: lo - d.x0, b: hi - d.x0 });
        if (q.H) elem.push({ e, type: 'u', dir: 'gx', q: +q.H, a: lo - d.x0, b: hi - d.x0 });
      });
    }
    return { elem };
  }

  /* ───────────────────────── lignes d'influence et enveloppes ferroviaires ───────────────────────── */
  function lignesInfluence(M, m, o = {}) {
    const p = M.params, pas = o.pas || p.rail.pas || 0.1;
    const x0 = (p.rail.xDeb ?? null) !== null && p.rail.xDeb !== '' ? +p.rail.xDeb : M.deck[0].x;
    const x1 = (p.rail.xFin ?? null) !== null && p.rail.xFin !== '' ? +p.rail.xFin : M.deck[M.deck.length - 1].x;
    const n = Math.max(2, Math.round((x1 - x0) / pas) + 1), dx = (x1 - x0) / (n - 1);
    const xs = [], Y = [];
    for (let k = 0; k < n; k++) {
      const x = x0 + k * dx; xs.push(x);
      const l = locDeck(M, m, x);
      Y.push(run(m, { elem: [{ e: l.e, type: 'p', P: -1, a: l.a }] }).v);
    }
    const size = Y[0].length;
    // tolérance d'arrondi aux extrémités (essieu placé exactement en bout de tablier)
    const tol = (li) => { const at0 = li.at, a = li.x0, b = li.xn; li.at = (x) => at0(x < a && x > a - 1e-7 ? a : x > b && x < b + 1e-7 ? b : x); return li; };
    return { xs, Y, size, li: (k) => tol(C.mkLI(xs, Y.map((y) => y[k]))) };
  }
  // évaluation d'un schéma de chargement sur une ligne d'influence
  function evalPat(li, pat) {
    if (!pat) return 0;
    let s = 0;
    for (const a of pat.ax || []) s += a.P * li.at(a.x);
    for (const d of pat.dist || []) s += d.q * li.integ(d.a, d.b);
    return s * (pat.f || 1);
  }
  // intervalles où la ligne d'influence est du signe sg (interpolation linéaire des zéros)
  function zones(li, sg) {
    const out = []; let cur = null;
    for (let k = 0; k < li.ys.length - 1; k++) {
      const a = li.ys[k] * sg, b = li.ys[k + 1] * sg, xa = li.xs[k], xb = li.xs[k + 1];
      if (a > 0 || b > 0) {
        let lo = xa, hi = xb;
        if (a <= 0) lo = xa + (xb - xa) * (-a) / (b - a);
        if (b <= 0) hi = xa + (xb - xa) * a / (a - b);
        if (cur && Math.abs(cur.b - lo) < 1e-9) cur.b = hi; else { cur = { a: lo, b: hi }; out.push(cur); }
      }
    }
    return out;
  }
  const moins = (Z, a, b) => { const o = []; for (const z of Z) { if (z.b <= a || z.a >= b) o.push(z); else { if (z.a < a) o.push({ a: z.a, b: a }); if (z.b > b) o.push({ a: b, b: z.b }); } } return o; };
  // UIC 71 (EN 1991-2 §6.3.2) : même algorithme que BA.charges.uic71, avec le schéma de chargement retenu
  function uicPat(li, h) {
    const res = {};
    for (const sg of [1, -1]) {
      let best = -Infinity, sb = null;
      const nS = Math.ceil((li.xn - li.x0 + 6.4) / h);
      for (let is = 0; is <= nS; is++) {
        const s = li.x0 - 6.4 + is * h;
        let e = 0; for (const a of C.CONVOIS.UIC71) e += a.P * li.at(s + 0.8 + a.d);
        const part = sg > 0 ? li.pos(li.x0, li.xn) - li.pos(s, s + 6.4) : li.neg(li.x0, li.xn) - li.neg(s, s + 6.4);
        const v = sg * (e + 80 * part);
        if (v > best) { best = v; sb = s; }
      }
      const qOnly = sg * 80 * (sg > 0 ? li.pos(li.x0, li.xn) : li.neg(li.x0, li.xn));
      let pat;
      if (qOnly >= best) pat = { ax: [], dist: zones(li, sg).map((z) => ({ a: z.a, b: z.b, q: 80 })) };
      else pat = { ax: C.CONVOIS.UIC71.map((a) => ({ x: sb + 0.8 + a.d, P: a.P })), dist: moins(zones(li, sg), sb, sb + 6.4).map((z) => ({ a: z.a, b: z.b, q: 80 })) };
      const v = Math.max(0, Math.max(best, qOnly));
      if (sg > 0) { res.max = v; res.pMax = v > 0 ? pat : null; } else { res.min = -v; res.pMin = v > 0 ? pat : null; }
    }
    return res;
  }
  function swPat(li, nom, h) {
    const { q, a, c } = C.SW[nom]; let mx = 0, mn = 0, pM = null, pm = null;
    const nS = Math.ceil((li.xn - li.x0 + 2 * a + c) / h);
    for (let is = 0; is <= nS; is++) {
      const s = li.x0 - 2 * a - c + is * h;
      const e = q * (li.integ(s, s + a) + li.integ(s + a + c, s + 2 * a + c));
      if (e > mx) { mx = e; pM = s; } if (e < mn) { mn = e; pm = s; }
    }
    const pat = (s) => (s === null ? null : { ax: [], dist: [{ a: s, b: s + a, q }, { a: s + a + c, b: s + 2 * a + c, q }] });
    return { max: mx, min: mn, pMax: pat(pM), pMin: pat(pm) };
  }
  function convoiPat(li, ax, h) {
    const r = C.convoi(li, ax, h);
    const pat = (o) => (o && o.x !== null ? { ax: ax.map((a) => ({ x: o.x + o.sens * a.d, P: a.P })), dist: [] } : null);
    return { max: r.max, min: r.min, pMax: r.max > 0 ? pat(r.posMax) : null, pMin: r.min < 0 ? pat(r.posMin) : null };
  }
  // longueur déterminante LΦ (EN 1991-2 tableau 6.2, cas 5.1 : poutres continues de n travées, LΦ = k·Lm)
  function Lphi(p) {
    if (p.rail.Lphi > 0) return p.rail.Lphi;
    const n = p.travees.length, Lm = p.travees.reduce((a, b) => a + b, 0) / n;
    const k = n === 1 ? 1 : n === 2 ? 1.2 : n === 3 ? 1.3 : n === 4 ? 1.4 : 1.5;
    return Math.max(k * Lm, Math.max(...p.travees));
  }
  function coefDyn(p) { const L = Lphi(p); return { Lphi: L, phi: p.rail.entretien === 'normal' ? C.phi3(L) : C.phi2(L) }; }

  function enveloppesFerroviaires(M, o = {}) {
    const p = M.params, m = o.modele || M.long.CD;
    const LI = o.LI || lignesInfluence(M, m, o);
    const h = Math.min(0.1, LI.xs[1] - LI.xs[0]);
    const { phi, Lphi: Lp } = coefDyn(p);
    const fUic = p.rail.alpha * phi * (p.rail.kRep || 1), fSw2 = phi * (p.rail.kRep || 1);
    const L = layout(m), size = LI.size;
    const mk = () => ({ max: new Float64Array(size), min: new Float64Array(size), cMax: new Array(size), cMin: new Array(size) });
    const env = {};
    const modeles = [];
    if (p.rail.uic) modeles.push({ id: 'UIC71', f: fUic, fn: (li) => uicPat(li, h) });
    if (p.rail.sw0) modeles.push({ id: 'SW/0', f: fUic, fn: (li) => swPat(li, 'SW/0', h) });
    if (p.rail.sw2) modeles.push({ id: 'SW/2', f: fSw2, fn: (li) => swPat(li, 'SW/2', h) });
    (p.rail.convois || []).forEach((cv, k) => { if (cv.essieux && cv.essieux.length) modeles.push({ id: cv.nom || ('Convoi ' + (k + 1)), f: cv.f || 1, fn: (li) => convoiPat(li, cv.essieux, h) }); });
    const lis = []; for (let k = 0; k < size; k++) lis.push(LI.li(k));
    // groupes d'effets concomitants : extrémité de barre (N, V, M) et appui (Rx, Ry, Mz)
    const groupe = (k) => (k < L.offA ? [3 * Math.floor(k / 3), 3 * Math.floor(k / 3) + 1, 3 * Math.floor(k / 3) + 2] : k < L.offD ? [L.offA + 3 * Math.floor((k - L.offA) / 3), L.offA + 3 * Math.floor((k - L.offA) / 3) + 1, L.offA + 3 * Math.floor((k - L.offA) / 3) + 2] : [k]);
    for (const md of modeles) {
      const E = mk();
      for (let k = 0; k < size; k++) {
        const r = md.fn(lis[k]);
        E.max[k] = md.f * r.max; E.min[k] = md.f * r.min;
        const g = groupe(k);
        if (r.pMax) E.cMax[k] = g.map((j) => md.f * evalPat(lis[j], r.pMax));
        if (r.pMin) E.cMin[k] = g.map((j) => md.f * evalPat(lis[j], r.pMin));
      }
      env[md.id] = E;
    }
    // enveloppe des charges verticales du groupe 1 (LM71 et SW/0, γQ = 1,45) et du groupe SW/2
    const comb = (ids) => {
      const E = mk(); E.max.fill(0); E.min.fill(0);
      for (const id of ids) { const e = env[id]; if (!e) continue; for (let k = 0; k < size; k++) { if (e.max[k] > E.max[k]) { E.max[k] = e.max[k]; E.cMax[k] = e.cMax[k]; } if (e.min[k] < E.min[k]) { E.min[k] = e.min[k]; E.cMin[k] = e.cMin[k]; } } }
      return E;
    };
    const ids1 = ['UIC71', 'SW/0'].concat((p.rail.convois || []).map((cv, k) => cv.nom || ('Convoi ' + (k + 1))));
    env.V1 = comb(ids1);
    env.V2 = comb(['SW/2']);
    // démarrage / freinage (EN 1991-2 §6.5.3) appliqués sur la longueur chargée, transmis au tablier avec le coefficient kFrein
    const Lch = LI.xs[LI.xs.length - 1] - LI.xs[0];
    const QlaUic = Math.max(Math.min(33 * Lch, 1000), Math.min(20 * Lch, 6000)) * p.rail.alpha;
    const QlbSw2 = Math.max(Math.min(33 * Lch, 1000), 35 * Lch); // SW/2 : Qlbk = 35 kN/m (non pondéré par α)
    const fr = { uic: (p.rail.freinage ? QlaUic / Lch : 0) * (p.rail.kFrein ?? 1) * (p.rail.kRep || 1), sw2: (p.rail.freinage && p.rail.sw2 ? QlbSw2 / Lch : 0) * (p.rail.kFrein ?? 1) * (p.rail.kRep || 1) };
    return { env, LI, phi, Lphi: Lp, fUic, fSw2, frein: fr, Lch, modeles: modeles.map((x) => x.id), layout: L };
  }

  /* ───────────────────────── séisme (EN 1998-1 / EN 1998-2, AN française) ───────────────────────── */
  const AGR = { 1: 0.4, 2: 0.7, 3: 1.1, 4: 1.6, 5: 3.0 }; // m/s², arrêté du 22 octobre 2010
  const GAMMA_I = { I: 0.8, II: 1.0, III: 1.2, IV: 1.4 }; // ponts, arrêté du 26 octobre 2011
  // NF EN 1998-1/NA tableaux 3.2 (zones 1 à 4) et 3.3 (zone 5) : S, TB, TC, TD
  const SOLS = {
    met: { A: [1.0, 0.03, 0.20, 2.5], B: [1.35, 0.05, 0.25, 2.5], C: [1.5, 0.06, 0.40, 2.0], D: [1.6, 0.10, 0.60, 1.5], E: [1.8, 0.08, 0.45, 1.25] },
    z5: { A: [1.0, 0.15, 0.40, 2.0], B: [1.2, 0.15, 0.50, 2.0], C: [1.15, 0.20, 0.60, 2.0], D: [1.35, 0.20, 0.80, 2.0], E: [1.4, 0.15, 0.50, 2.0] },
  };
  function spectre(s) {
    const zone = +s.zone || 3, agr = s.agr > 0 ? s.agr : AGR[zone], gI = GAMMA_I[s.classe] || 1;
    const [S, TB, TC, TD] = SOLS[zone === 5 ? 'z5' : 'met'][s.sol || 'B'];
    const ag = gI * agr, eta = Math.max(0.55, Math.sqrt(10 / (5 + (s.xi ?? 5))));
    const avg = (zone === 5 ? 0.9 : 0.45) * ag; // NF EN 1998-1/NA tableau 3.4 : avg/ag = 0,45 (zones 1 à 4), 0,90 (zone 5)
    // spectre élastique horizontal Se(T), EN 1998-1 (3.2)-(3.5)
    const Se = (T) => T <= TB ? ag * S * (1 + T / TB * (eta * 2.5 - 1)) : T <= TC ? ag * S * eta * 2.5 : T <= TD ? ag * S * eta * 2.5 * TC / T : ag * S * eta * 2.5 * TC * TD / (T * T);
    // spectre de calcul Sd(T), EN 1998-1 (3.13)-(3.16), β = 0,2
    const Sd = (T, q) => {
      if (!(q > 1)) return Se(T);
      const b = 0.2 * ag;
      return T <= TB ? ag * S * (2 / 3 + T / TB * (2.5 / q - 2 / 3)) : T <= TC ? ag * S * 2.5 / q : T <= TD ? Math.max(b, ag * S * 2.5 / q * TC / T) : Math.max(b, ag * S * 2.5 / q * TC * TD / (T * T));
    };
    // spectre élastique vertical Sve(T), EN 1998-1 (3.8)-(3.11), TB = 0,05 ; TC = 0,15 ; TD = 1,0
    const Sve = (T) => T <= 0.05 ? avg * (1 + T / 0.05 * (eta * 3 - 1)) : T <= 0.15 ? avg * eta * 3 : T <= 1 ? avg * eta * 3 * 0.15 / T : avg * eta * 3 * 0.15 / (T * T);
    return { zone, agr, gI, ag, S, TB, TC, TD, eta, avg, Se, Sd, Sve };
  }
  // masses nodales (t) : tablier (poids propre + superstructures + ballast + masse additionnelle), appuis
  function massesNodales(M, m, trans) {
    const p = M.params, a = p.actions, s = p.seisme;
    const mass = new Float64Array(m.nodes.length);
    M.deckEl.forEach((e, k) => {
      const w = (M.poidsDeck[k] + (a.superstructures || 0) + (a.ballast || 0)) / G_ACC + (s.masseSup || 0);
      mass[e.i] += w * e.L / 2; mass[e.j] += w * e.L / 2;
    });
    if (s.massesAppuis === false) return mass;
    if (!trans) M.long.SIS.masses.forEach((o) => { if (o.n < mass.length) mass[o.n] += o.m; });
    else M.long.SIS.masses.forEach((o) => { if (o.z <= 0.5) mass[M.appuiNode[o.pier]] += o.m; }); // moitié supérieure des appuis
    return mass;
  }
  // décomposition propre symétrique (Jacobi cyclique)
  function jacobi(A) {
    const n = A.length, V = Array.from({ length: n }, (_, i) => { const r = new Float64Array(n); r[i] = 1; return r; });
    const a = A.map((r) => Float64Array.from(r));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-22 * Math.max(1, a.reduce((s, r, i) => s + r[i] * r[i], 0))) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    return { val: a.map((r, i) => r[i]), vec: V };
  }
  /* analyse modale : matrice de souplesse sur les ddl massiques (ux, uy des nœuds chargés de masse),
   * A = M^½ F M^½ (symétrique) ; λ = 1/ω². Combinaison CQC (EN 1998-2 §4.2.1.3, ξ = 5 %).                 */
  function modal(M, m, mass, dir, sp, q) {
    const pr = prep(m);
    const dofs = [];
    mass.forEach((mm, n) => { if (mm > 1e-9) { dofs.push({ n, d: 0, m: mm }); dofs.push({ n, d: 1, m: mm }); } });
    const nd = dofs.length, F = Array.from({ length: nd }, () => new Float64Array(nd));
    dofs.forEach((dj, j) => {
      const r = pr.run({ nodal: [{ n: dj.n, Fx: dj.d === 0 ? 1 : 0, Fy: dj.d === 1 ? 1 : 0 }] });
      dofs.forEach((di, i) => { F[i][j] = r.U[3 * di.n + di.d]; });
    });
    const sq = dofs.map((d) => Math.sqrt(d.m));
    const A = F.map((row, i) => Array.from(row, (f, j) => sq[i] * f * sq[j]));
    for (let i = 0; i < nd; i++) for (let j = i + 1; j < nd; j++) { const v = (A[i][j] + A[j][i]) / 2; A[i][j] = A[j][i] = v; }
    const { val, vec } = jacobi(A);
    const ord = val.map((v, i) => i).filter((i) => val[i] > 1e-14).sort((a, b) => val[b] - val[a]);
    const Mtot = dofs.filter((d) => d.d === dir).reduce((s, d) => s + d.m, 0);
    const modes = [];
    let cum = 0;
    const nMax = (M.params.seisme.nModes > 0) ? M.params.seisme.nModes : 30;
    for (const k of ord) {
      const w2 = 1 / val[k], T = 2 * Math.PI / Math.sqrt(w2);
      const phi = dofs.map((d, i) => vec[i][k] / sq[i]); // φ = M^-½ y
      let mg = 0, L = 0; dofs.forEach((d, i) => { mg += d.m * phi[i] * phi[i]; if (d.d === dir) L += d.m * phi[i]; });
      const Gam = L / mg, meff = L * L / mg;
      cum += meff;
      modes.push({ T, f: 1 / T, Gam, meff, ratio: meff / Mtot, cum: cum / Mtot, phi, Sa: 0 });
      if ((modes.length >= nMax) || (cum / Mtot >= 0.999 && modes.length >= 3)) break;
    }
    // réponse : forces F = M φ Γ Sa(T) par mode
    for (const md of modes) {
      md.Sa = dir === 1 && sp.vertical ? sp.Sve(md.T) : sp.Sd(md.T, q);
      const nodal = [];
      dofs.forEach((d, i) => { const f = d.m * md.phi[i] * md.Gam * md.Sa; if (Math.abs(f) > 0) nodal.push({ n: d.n, Fx: d.d === 0 ? f : 0, Fy: d.d === 1 ? f : 0 }); });
      md.v = run(m, { nodal }).v;
    }
    // modes retenus : jusqu'à 90 % de masse effective (EN 1998-2 §4.2.1.3(3))
    let keep = modes.length; for (let i = 0; i < modes.length; i++) if (modes[i].cum >= 0.9) { keep = i + 1; break; }
    const kept = modes.slice(0, Math.max(keep, Math.min(3, modes.length)));
    // CQC, ξ = 5 % (EN 1998-2 éq. 4.4 et 4.5)
    const xi = (M.params.seisme.xi ?? 5) / 100;
    const rho = (wi, wj) => { const r = wj / wi; return 8 * xi * xi * (1 + r) * Math.pow(r, 1.5) / (Math.pow(1 - r * r, 2) + 4 * xi * xi * r * Math.pow(1 + r, 2)); };
    const size = kept[0] ? kept[0].v.length : 0, E = new Float64Array(size);
    for (let k = 0; k < size; k++) {
      let s = 0;
      for (let i = 0; i < kept.length; i++) for (let j = 0; j < kept.length; j++) s += rho(1 / kept[i].T, 1 / kept[j].T) * kept[i].v[k] * kept[j].v[k];
      E[k] = Math.sqrt(Math.max(0, s));
    }
    return { modes, kept, E, Mtot, methode: 'modale' };
  }
  /* mode fondamental (EN 1998-2 §4.2.2) : période de Rayleigh sur la déformée due aux forces m·g dans la direction,
   * T = 2π √(Σ m d² / Σ F d), puis forces F = m·Sd(T) proportionnelles aux masses. */
  function fondamental(M, m, mass, dir, sp, q) {
    const nodal = []; mass.forEach((mm, n) => { if (mm > 0) nodal.push({ n, Fx: dir === 0 ? mm * G_ACC : 0, Fy: dir === 1 ? mm * G_ACC : 0 }); });
    const r = run(m, { nodal }).r;
    let s1 = 0, s2 = 0, Mt = 0; mass.forEach((mm, n) => { if (mm > 0) { const d = r.U[3 * n + dir]; s1 += mm * d * d; s2 += mm * G_ACC * d; Mt += mm; } });
    const T = 2 * Math.PI * Math.sqrt(s1 / s2);
    const K = Mt * Mt * G_ACC * G_ACC / s2; // raideur équivalente K = F²/Σ F·d (F = Σ m·g)
    const Sa = sp.vertical ? sp.Sve(T) : sp.Sd(T, q);
    const f = nodal.map((o) => ({ n: o.n, Fx: o.Fx * Sa / G_ACC, Fy: o.Fy * Sa / G_ACC }));
    const v = run(m, { nodal: f }).v;
    return { modes: [{ T, f: 1 / T, Sa, ratio: 1, cum: 1, meff: Mt, Gam: 1 }], kept: [], E: v.map(Math.abs), Mtot: Mt, T, K, Sa, Ftot: Mt * Sa, methode: 'mode fondamental' };
  }
  function seisme(M) {
    const p = M.params, s = p.seisme;
    if (!s.actif) return null;
    const sp = spectre(s);
    const res = { sp };
    const mL = M.long.SIS, massL = massesNodales(M, mL, false);
    const meth = s.methode === 'fondamental' ? fondamental : modal;
    res.long = meth(M, mL, massL, 0, sp, s.q || 1);
    if (s.vertical) res.vert = modal(M, mL, massL, 1, Object.assign({}, sp, { vertical: true }), 1);
    // directions : E = Ex "+" 0,3 Ez (EN 1998-2 §4.2.1.4) — enveloppe des deux permutations
    const n = res.long.E.length, E = new Float64Array(n);
    for (let k = 0; k < n; k++) { const ex = res.long.E[k], ez = res.vert ? res.vert.E[k] : 0; E[k] = Math.max(ex + 0.3 * ez, 0.3 * ex + ez); }
    res.Elong = E;
    res.massL = Array.from(massL).reduce((a, b) => a + b, 0);
    if (p.trans && p.trans.actif) {
      const mT = M.trans.SIS, massT = massesNodales(M, mT, true);
      // dans le modèle transversal (vue en plan), la direction transversale est l'axe y du modèle
      res.trans = (s.methode === 'fondamental' ? fondamental : modal)(M, mT, massT, 1, Object.assign({}, sp, { vertical: false }), s.qT || 1);
      res.massT = Array.from(massT).reduce((a, b) => a + b, 0);
    }
    return res;
  }

  /* ───────────────────────── combinaisons (EN 1990 annexe A2) ───────────────────────── */
  const add = (o, v, f = 1) => { for (let k = 0; k < o.length; k++) o[k] += f * v[k]; return o; };
  function calcule(M, o = {}) {
    const p = M.params, a = p.actions, c = p.combi, mL = M.long.LD;
    const L = layout(mL), size = L.size;
    const u = chargesUnitaires(M);
    const Z = () => new Float64Array(size);
    // cas élémentaires caractéristiques
    const cas = {};
    cas.G1 = u.pp.v;
    cas.Gs = add(Z(), u.v1LD.v, a.superstructures || 0);
    cas.Gb = add(Z(), u.v1LD.v, a.ballast || 0);
    cas.R = add(Z(), u.eLD.v, (a.retrait || 0) / 1e-5);
    // température uniforme : part longue durée (Ed) + part courte durée (Ei), contraction et dilatation
    cas.Tcon = add(add(Z(), u.eLD.v, (a.tLD.con || 0) / 1e-5), u.eCD.v, (a.tCD.con || 0) / 1e-5);
    cas.Tdil = add(add(Z(), u.eLD.v, (a.tLD.dil || 0) / 1e-5), u.eCD.v, (a.tCD.dil || 0) / 1e-5);
    cas.Gchaud = add(Z(), u.grad.v, a.gradient.chaud || 0);
    cas.Gfroid = add(Z(), u.grad.v, -(a.gradient.froid || 0));
    const tas = u.tass.map((t) => add(Z(), t.v, a.denivAppui || 0));
    const tasC = add(Z(), u.tassC.v, a.denivCulees || 0);
    const qq = u.qq.map((r) => r.v);
    // enveloppes d'actions
    const env = {};
    const E2 = (mx, mn) => ({ max: mx, min: mn });
    env.G = (() => { const mx = Z(), mn = Z(); for (let k = 0; k < size; k++) { const g = cas.G1[k], s = cas.Gs[k], b = cas.Gb[k]; mx[k] = g + Math.max(1.4 * s, 0.8 * s) + Math.max(1.3 * b, 0.7 * b); mn[k] = g + Math.min(1.4 * s, 0.8 * s) + Math.min(1.3 * b, 0.7 * b); } return E2(mx, mn); })();
    env.Gnom = E2(add(add(add(Z(), cas.G1), cas.Gs), cas.Gb), add(add(add(Z(), cas.G1), cas.Gs), cas.Gb));
    env.set = (() => { const mx = Z(), mn = Z(); for (let k = 0; k < size; k++) { let p1 = 0, n1 = 0; for (const t of tas) { p1 += Math.max(0, t[k]); n1 += Math.min(0, t[k]); } mx[k] = Math.max(p1, tasC[k], 0); mn[k] = Math.min(n1, tasC[k], 0); } return E2(mx, mn); })();
    // thermique : ΔTN + ωM ΔTM ou ωN ΔTN + ΔTM (EN 1991-1-5 §6.1.5), ωN = 0,35 ; ωM = 0,75
    env.T = (() => {
      const mx = Z(), mn = Z();
      for (let k = 0; k < size; k++) {
        const vals = [];
        for (const tn of [cas.Tcon[k], cas.Tdil[k]]) for (const tm of [cas.Gchaud[k], cas.Gfroid[k]]) vals.push(tn + 0.75 * tm, 0.35 * tn + tm);
        mx[k] = Math.max(0, ...vals); mn[k] = Math.min(0, ...vals);
      }
      return E2(mx, mn);
    })();
    // charges quelconques : permanentes (G) ou variables (Q autre, ψ0 = 0,8 ; ψ1 = 0,5 ; ψ2 = 0)
    const qG = Z(), qAmx = Z(), qAmn = Z(), qDmx = Z(), qDmn = Z();
    (p.quelconques || []).forEach((q, i) => { if (q.cat === 'U') return; if (q.cat === 'G') add(qG, qq[i]); else if (q.cat === 'Ad') { for (let k = 0; k < size; k++) { qDmx[k] = Math.max(qDmx[k], qq[i][k]); qDmn[k] = Math.min(qDmn[k], qq[i][k]); } } else for (let k = 0; k < size; k++) { qAmx[k] += Math.max(0, qq[i][k]); qAmn[k] += Math.min(0, qq[i][k]); } });
    add(env.G.max, qG); add(env.G.min, qG); add(env.Gnom.max, qG); add(env.Gnom.min, qG);
    env.A = E2(qAmx, qAmn);
    env.Ad = E2(qDmx, qDmn); // actions accidentelles : une seule à la fois (enveloppe)
    // ferroviaire
    const rail = o.sansRail ? null : enveloppesFerroviaires(M, { modele: M.long.CD });
    const H1 = u.h1CD.v;
    const railEnv = (V, fr) => { const mx = Z(), mn = Z(); for (let k = 0; k < size; k++) { const h = Math.abs(fr * H1[k]); mx[k] = V.max[k] + h; mn[k] = V.min[k] - h; } return E2(mx, mn); };
    env.Q1 = rail ? railEnv(rail.env.V1, rail.frein.uic) : E2(Z(), Z());   // gr11 : vertical + 1,0 × démarrage/freinage
    env.Q2 = rail && p.rail.sw2 ? railEnv(rail.env.V2, rail.frein.sw2) : E2(Z(), Z()); // gr16 (SW/2)
    // séisme
    const sis = seisme(M);
    env.AE = sis ? E2(Float64Array.from(sis.Elong), Float64Array.from(sis.Elong, (x) => -x)) : E2(Z(), Z());

    // combinaison générique : termes {e: enveloppe, g: [γ défavorable, γ favorable], perm: bool}
    const combine = (terms) => {
      const mx = Z(), mn = Z();
      for (const t of terms) {
        const [gu, gf] = t.g;
        for (let k = 0; k < size; k++) {
          if (t.perm) { mx[k] += Math.max(gu * t.e.max[k], gf * t.e.max[k]); mn[k] += Math.min(gu * t.e.min[k], gf * t.e.min[k]); }
          else { mx[k] += gu * Math.max(0, t.e.max[k]); mn[k] += gu * Math.min(0, t.e.min[k]); }
        }
      }
      return E2(mx, mn);
    };
    const enveloppe = (list) => { const mx = Z().fill(-Infinity), mn = Z().fill(Infinity); for (const e of list) for (let k = 0; k < size; k++) { if (e.max[k] > mx[k]) mx[k] = e.max[k]; if (e.min[k] < mn[k]) mn[k] = e.min[k]; } return E2(mx, mn); };
    const Rr = E2(cas.R, cas.R);
    const perm = (gs, gi, gset) => [{ e: env.G, g: [gs, gi], perm: true }, { e: Rr, g: [1, 1], perm: true }, { e: env.set, g: [gset, 0], perm: false }];
    const psi1Q = p.rail.nbVoies >= 3 ? 0.6 : p.rail.nbVoies === 2 ? 0.7 : 0.8; // EN 1990 A2 tableau A2.3 (groupes gr11-gr17)
    const comb = {};
    // ELU fondamental (EN 1990 éq. 6.10, A2 tableau A2.4(B)) : action dominante ferroviaire, thermique ou autre
    comb.ELU = enveloppe([
      combine(perm(c.gGsup, c.gGinf, c.gSet).concat([{ e: env.Q1, g: [c.gQ, 0] }, { e: env.T, g: [c.gT * c.psi0T, 0] }, { e: env.A, g: [c.gQautre * c.psi0A, 0] }])),
      combine(perm(c.gGsup, c.gGinf, c.gSet).concat([{ e: env.Q2, g: [c.gQsw2, 0] }, { e: env.T, g: [c.gT * c.psi0T, 0] }, { e: env.A, g: [c.gQautre * c.psi0A, 0] }])),
      combine(perm(c.gGsup, c.gGinf, c.gSet).concat([{ e: env.T, g: [c.gT, 0] }, { e: env.Q1, g: [c.gQ * c.psi0Q, 0] }, { e: env.A, g: [c.gQautre * c.psi0A, 0] }])),
      combine(perm(c.gGsup, c.gGinf, c.gSet).concat([{ e: env.A, g: [c.gQautre, 0] }, { e: env.Q1, g: [c.gQ * c.psi0Q, 0] }, { e: env.T, g: [c.gT * c.psi0T, 0] }])),
    ]);
    // ELS caractéristique (6.14b)
    comb.CAR = enveloppe([
      combine(perm(1, 1, 1).concat([{ e: env.Q1, g: [1, 0] }, { e: env.T, g: [c.psi0T, 0] }, { e: env.A, g: [c.psi0A, 0] }])),
      combine(perm(1, 1, 1).concat([{ e: env.Q2, g: [1, 0] }, { e: env.T, g: [c.psi0T, 0] }, { e: env.A, g: [c.psi0A, 0] }])),
      combine(perm(1, 1, 1).concat([{ e: env.T, g: [1, 0] }, { e: env.Q1, g: [c.psi0Q, 0] }, { e: env.A, g: [c.psi0A, 0] }])),
      combine(perm(1, 1, 1).concat([{ e: env.A, g: [1, 0] }, { e: env.Q1, g: [c.psi0Q, 0] }, { e: env.T, g: [c.psi0T, 0] }])),
    ]);
    // ELS fréquent (6.15b) : ψ1 pour l'action dominante, ψ2 pour les autres (ψ2 = 0 trafic, 0,5 thermique)
    comb.FRE = enveloppe([
      combine(perm(1, 1, 1).concat([{ e: env.Q1, g: [psi1Q, 0] }, { e: env.T, g: [c.psi2T, 0] }])),
      combine(perm(1, 1, 1).concat([{ e: env.T, g: [c.psi1T, 0] }])),
      combine(perm(1, 1, 1).concat([{ e: env.A, g: [c.psi1A, 0] }, { e: env.T, g: [c.psi2T, 0] }])),
    ]);
    // ELS quasi-permanent (6.16b)
    comb.QP = combine(perm(1, 1, 1).concat([{ e: env.T, g: [c.psi2T, 0] }]));
    // ELU sismique (6.12b) : G + AEd + ψ2,1·Q trafic (EN 1998-2 §4.1.2) + ψ2·T
    comb.SIS = sis ? combine(perm(1, 1, 1).concat([{ e: env.AE, g: [1, 0] }, { e: env.Q1, g: [p.seisme.psi2rail ?? 0.3, 0] }, { e: env.T, g: [c.psi2T, 0] }])) : null;

    // ELU accidentel (6.11b) : G + Ad + ψ1,1·Q1 (trafic dominant) + ψ2·T
    const hasAd = (p.quelconques || []).some((q) => q.cat === 'Ad');
    comb.ACC = hasAd ? combine(perm(1, 1, 1).concat([{ e: env.Ad, g: [1, 0] }, { e: env.Q1, g: [psi1Q, 0] }, { e: env.T, g: [c.psi2T, 0] }])) : null;
    // modèle transversal : 1 kN/ml, vent, séisme
    let trans = null;
    if (p.trans && p.trans.actif) {
      const mT = M.trans.CD, dE = deckElems(mT);
      const t1 = run(mT, { elem: dE.map((e) => ({ e, type: 'u', q: 1 })) });
      trans = { unit: t1.v, vent: add(new Float64Array(t1.v.length), t1.v, a.qvent || 0), layout: layout(mT), sis: sis && sis.trans ? sis.trans : null, modele: mT };
    }
    // chargements libres fournis par un module appelant (CADRES, APPUI) : {nom, modele:'LD'|'CD'|'SIS'|'TCD', loads}
    const libres = (o.chargements || []).map((ch) => {
      const mm = ch.modele === 'CD' ? M.long.CD : ch.modele === 'SIS' ? M.long.SIS : ch.modele === 'TCD' ? M.trans.CD : M.long.LD;
      const rr = run(mm, ch.loads || {});
      return { nom: ch.nom, modele: ch.modele || 'LD', v: rr.v, r: rr.r };
    });
    return { M, layout: L, unit: u, cas, tas, tasC, env, rail, sis, comb, trans, psi1Q, libres };
  }

  /* ───────────────────────── extraction pratique ───────────────────────── */
  // valeurs aux sections du tablier (extrémités des éléments) : [{x, e, end, N, V, M}]
  function sectionsTablier(M, v, m) {
    m = m || M.long.LD;
    const out = [];
    deckElems(m).forEach((e, k) => {
      const d = M.deckEl[k];
      out.push({ x: d.x0, e, end: 'i', travee: d.travee, N: v[6 * e], V: v[6 * e + 1], M: v[6 * e + 2] });
      out.push({ x: d.x0 + d.L, e, end: 'j', travee: d.travee, N: v[6 * e + 3], V: v[6 * e + 4], M: v[6 * e + 5] });
    });
    return out;
  }
  function appuisVals(M, v, m) { m = m || M.long.LD; const L = layout(m); return m.appuis.map((a, k) => ({ nom: a.nom, Rx: v[L.offA + 3 * k], Ry: v[L.offA + 3 * k + 1], Mz: v[L.offA + 3 * k + 2] })); }

  /* ───────────────────────── lecture d'un fichier .don MODELPRA ───────────────────────── */
  function lireDon(txt) {
    const lines = String(txt).replace(/\r/g, '').split('\n');
    const kv = {};
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^CHARGESQUELCONQUES/.test(l)) break;
      if (!l || l[0] === ';' || l.indexOf(';') < 0) continue;
      const key = l.slice(0, l.indexOf(';')).trim();
      if (!key || /\s/.test(key)) continue;
      const vals = [];
      while (i + 1 < lines.length && lines[i + 1].indexOf(';') < 0 && lines[i + 1].trim() !== '' && !/^CHARGESQUELCONQUES|^FIN_DICO/.test(lines[i + 1])) { vals.push(lines[i + 1].trim()); i++; }
      (kv[key] = kv[key] || []).push(vals.join(' '));
    }
    const n = (k, i = 0, d = 0) => { const v = kv[k] && kv[k][i]; const x = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(x) ? x : d; };
    const arr = (k) => (kv[k] || []).map((v) => parseFloat(v)).filter(Number.isFinite);
    const p = defauts();
    p.titre = (kv.projet && kv.projet[0]) || 'Import .don';
    p.travees = arr('travees');
    p.consoleDeb = n('console_deb'); p.consoleFin = n('console_fin');
    p.nbElTrav = n('nbeltrav', 0, 10) || 10;
    const fc = n('fcj', 0, 32), Ei = n('ebi'), Ed = n('ebd');
    p.materiau = (n('choixmateriaux') === 1 || (Ei > 0 && Ed > 0)) ? { mode: 'saisie', fck: fc, Ei, Ed, phi: n('fluagebeton', 0, 2), gamma: n('poivolbet', 0, 25) } : { mode: 'BAEL', fck: fc, phi: n('fluagebeton', 0, 2), gamma: n('poivolbet', 0, 25) };
    const cm = n('choixmodelauto');
    p.tablier = cm === 2 ? { mode: 'section', b: n('ltab', 0, 1), h: n('htab', 0, 1), A: n('stab'), I: n('ixtab'), It: n('iytab'), Sreel: n('sreeltab'), goussets: [], loi: 'lin' }
      : { mode: 'dalle', b: n('ltab', 0, 1), h: n('htab', 0, 1), Sreel: n('sreeltab'), goussets: [], loi: 'lin' };
    const g = { hg: arr('htgoussetsg'), lg: arr('longoussetsg'), hd: arr('htgoussetsd'), ld: arr('longoussetsd') };
    p.tablier.goussets = p.travees.map((_, t) => ({ hg: g.hg[t] || 0, lg: g.lg[t] || 0, hd: g.hd[t] || 0, ld: g.ld[t] || 0 }));
    const nA = p.travees.length + 1;
    const ch = arr('choixsaisappuilong');
    p.nbElPied = n('nbelpiedroit', 0, 6) || 6;
    const at = (k, i) => { const a = arr(k); return a.length ? (a[i] ?? a[a.length - 1]) : 0; };
    p.appuis = [];
    for (let i = 0; i < nA; i++) {
      const t = ch[i] ?? ch[ch.length - 1] ?? 0, nom = i === 0 ? 'Appui 1 (origine)' : i === nA - 1 ? 'Appui ' + (i + 1) + ' (extrémité)' : 'Appui ' + (i + 1);
      const ap = { nom, kyT: at('kyappelasttranscd', i) };
      if (t === 4) Object.assign(ap, { type: 'piedroit', h: at('htpiedroits', i), A: at('sectionpiedroits', i), I: at('inertiepiedroits', i), Ab: at('sectionbaspiedroits', i), Ib: at('inertiebaspiedroits', i), base: at('liaisonbasepiedroit', i) === 1 ? 'ressorts' : 'encastre' });
      else if (t === 1 || t === 3) Object.assign(ap, { type: 'ressorts', kx: { LD: at('kxappelastld', i), CD: at('kxappelastcd', i), SIS: at('kxappelastseisme', i) }, ky: { LD: at('kyappelastld', i), CD: at('kyappelastcd', i), SIS: at('kyappelastseisme', i) } });
      else if (t === 2) {
        const T = at('chtappappui', i), A = at('chaappappui', i);
        Object.assign(ap, T > 0 && A > 0 ? { type: 'elastomere', Tel: T, Ael: A, GLD: n('moglilt', 0, 0.9), GCD: n('moglict', 0, 1.8), GSIS: n('modgliseisme', 0, 1.2) } : { type: 'simple', fixe: true });
      } else Object.assign(ap, { type: 'simple', fixe: i === 0 });
      p.appuis.push(ap);
    }
    p.radier = { actif: n('radier') === 1, e: 0.8, b: p.tablier.b || 1, kv: n('ressortlineiquesol') > 0 ? n('ressortlineiquesol') / (p.tablier.b || 1) : 30000 };
    p.actions = {
      superstructures: n('cpsuperstructures'), ballast: n('cpballast'), retrait: n('kdefretrait', 0, -2e-4),
      denivAppui: n('tassdifapp'), denivCulees: n('tassdifculees'),
      tLD: { con: n('kdefcontld', 0, -2.5e-4), dil: n('kdefdilatld', 0, 2.5e-4) }, tCD: { con: n('kdefcontcd', 0, -1e-4), dil: n('kdefdilatcd', 0, 1e-4) },
      gradient: { chaud: 0, froid: 0 }, qvent: n('qvent'),
    };
    const chg = n('charges', 0, 0) | 0;
    p.rail = Object.assign(defauts().rail, { uic: chg ? !!(chg & 1) || !!(chg & 8) : true, sw0: chg ? !!(chg & 2) || !!(chg & 8) : true, sw2: !!(chg & 4), alpha: n('coeffalpha', 0, 1) || 1, pas: n('pas', 0, 0.1) || 0.1, nbVoies: n('nbvoies', 0, 1) || 1 });
    const z = n('ec8zoneseisme', 0, -1);
    p.seisme = Object.assign(defauts().seisme, { actif: z > 0 || n('modelsismique') === 1, zone: z > 0 ? z + 1 : 3, sol: 'ABCDE'[n('ec8siteseisme')] || 'B', classe: ['II', 'III', 'IV'][n('classeoa')] || 'II', agr: n('agr'), q: n('coeffq', 0, 1) || 1, qT: n('coeffqtrans', 0, 1) || 1, xi: n('xsi', 0, 5) || 5, masseSup: n('masseballast') });
    // charges quelconques du modèle longitudinal longue durée (modèle 0) : cas unitaires de descente de charges
    const xsDeck = []; if (p.consoleDeb > 0) xsDeck.push(-p.consoleDeb); { let x = 0; xsDeck.push(0); p.travees.forEach((L) => { for (let k = 1; k <= p.nbElTrav; k++) xsDeck.push(x + L * k / p.nbElTrav); x += L; }); if (p.consoleFin > 0) xsDeck.push(x + p.consoleFin); }
    p.quelconques = [];
    for (let i = 0; i < lines.length; i++) {
      const m = /^CHARGESQUELCONQUES\s+(\d+)\s+(.*)$/.exec(lines[i]);
      // codes 0 et 3 : modèle longitudinal longue durée (abscisse ou nœud) ; 1, 4 : courte durée ; 5 : transversal
      if (!m || (+m[1] !== 0 && +m[1] !== 3)) continue;
      const v = (lines[i + 1] || '').trim().split(/\s+/).map(Number);
      if (v.length < 8) continue;
      let x;
      if (v[0] === 0 && v[1] > 0) x = xsDeck[v[1] - 1];
      else if (v[0] === 1) x = v[3] + (xsDeck[0] || 0);
      else x = v[3];
      const P = v[0] === 0 && v[1] > 0 ? -v[6] : -v[5];
      if (Number.isFinite(x) && P) p.quelconques.push({ nom: m[2].trim(), cat: 'U', x1: +x.toFixed(5), x2: '', q1: P, q2: '', H: 0 });
    }
    return p;
  }

  const api = { defauts, modules, genere, calcule, enveloppesFerroviaires, lignesInfluence, seisme, spectre, massesNodales, modal, fondamental, jacobi, run, layout, sectionsTablier, appuisVals, lireDon, Lphi, coefDyn, uicPat, swPat, evalPat, AGR, GAMMA_I, SOLS, sectionTablier };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.modeleRail = api; }
})(typeof window !== 'undefined' ? window : globalThis);
