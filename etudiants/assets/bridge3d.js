/* ═══════════════════════════════════════════════════════════════
   BridgeAI Studios — Espace étudiants : maquettes 3D (three.js r128)
   data-model="anatomie" : pont courant à poutres, pièce par pièce,
                           vue éclatée, repères, trafic animé
   data-model="familles" : galerie des grandes familles de ponts
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const T = window.THREE;
  if (!T) return;

  /* ── matériaux ── */
  const M = {};
  function mat(key, color, o = {}) {
    if (!M[key]) M[key] = new T.MeshStandardMaterial(Object.assign({ color, roughness: .78, metalness: .02 }, o));
    return M[key];
  }
  const C = {
    beton: () => mat("beton", 0xc9ced5),
    betonF: () => mat("betonF", 0xb3bac3),
    betonP: () => mat("betonP", 0xdfe3e8),
    pieux: () => mat("pieux", 0x9aa3ae),
    acier: () => mat("acier", 0x3d7bf0, { roughness: .5, metalness: .2 }),
    metal: () => mat("metal", 0xa9b2bc, { roughness: .35, metalness: .7 }),
    neo: () => mat("neo", 0x1d1f24, { roughness: .9 }),
    asph: () => mat("asph", 0x3b3f47, { roughness: .95 }),
    etan: () => mat("etan", 0x2a3f8f, { roughness: .6 }),
    terre: () => mat("terre", 0xc59a63),
    herbe: () => mat("herbe", 0x8fbf72, { transparent: true, opacity: .55, depthWrite: false }),
    route: () => mat("route", 0x51555e, { roughness: .95 }),
    blanc: () => mat("blanc", 0xf4f4f0),
    cable: () => mat("cable", 0xe0a526, { roughness: .4, metalness: .5 }),
    eau: () => mat("eau", 0x5aa9e6, { transparent: true, opacity: .75, roughness: .2 }),
    gold: () => mat("gold", 0xc9a84c, { roughness: .4, metalness: .3 }),
    rouge: () => mat("rouge", 0xd9472b),
    jaune: () => mat("jaune", 0xe8b21f),
    vitre: () => mat("vitre", 0x9fc7e8, { roughness: .2, metalness: .1 })
  };

  /* ── primitives ── */
  function box(w, h, d, m, x = 0, y = 0, z = 0) {
    const g = new T.BoxGeometry(w, h, d);
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    return o;
  }
  function cyl(r, h, m, x = 0, y = 0, z = 0, seg = 20) {
    const o = new T.Mesh(new T.CylinderGeometry(r, r, h, seg), m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    return o;
  }
  function between(a, b, r, m, seg = 8) {
    const va = new T.Vector3(...a), vb = new T.Vector3(...b);
    const len = va.distanceTo(vb);
    const o = new T.Mesh(new T.CylinderGeometry(r, r, len, seg), m);
    o.position.copy(va).add(vb).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    o.castShadow = true;
    return o;
  }
  function extrudeX(pts, len, m, x0 = 0) { // profil (z,y) extrudé suivant x
    const s = new T.Shape();
    pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));
    const g = new T.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
    const o = new T.Mesh(g, m);
    o.rotation.y = Math.PI / 2; // la profondeur part vers +x ; le z local devient -x
    o.position.x = x0; // rotation +90° autour de y : la profondeur (z local) devient +x
    o.castShadow = o.receiveShadow = true;
    return o;
  }
  // profil en I d'une poutre précontrainte (table, âme, talon) — coordonnées (z, y)
  function profilI(h) {
    const bt = 1.2, et = .15, ba = .2, bta = .6, eta = .25;
    return [[-bta / 2, 0], [bta / 2, 0], [bta / 2, eta], [ba / 2, eta + .12], [ba / 2, h - et - .1], [bt / 2, h - et], [bt / 2, h], [-bt / 2, h], [-bt / 2, h - et], [-ba / 2, h - et - .1], [-ba / 2, eta + .12], [-bta / 2, eta]];
  }
  function label(text, opts = {}) {
    const cv = document.createElement("canvas");
    const fs = 44, pad = 18;
    const ctx = cv.getContext("2d");
    ctx.font = `500 ${fs}px Outfit, sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    cv.width = w; cv.height = fs + pad * 1.6;
    const c2 = cv.getContext("2d");
    c2.fillStyle = opts.bg || "rgba(20,23,31,.86)";
    const r = 18;
    c2.beginPath(); c2.moveTo(r, 0); c2.lineTo(w - r, 0); c2.quadraticCurveTo(w, 0, w, r); c2.lineTo(w, cv.height - r); c2.quadraticCurveTo(w, cv.height, w - r, cv.height); c2.lineTo(r, cv.height); c2.quadraticCurveTo(0, cv.height, 0, cv.height - r); c2.lineTo(0, r); c2.quadraticCurveTo(0, 0, r, 0); c2.fill();
    c2.font = `500 ${fs}px Outfit, sans-serif`;
    c2.fillStyle = opts.color || "#f1e6c8";
    c2.textBaseline = "middle";
    c2.fillText(text, pad, cv.height / 2 + 2);
    const tex = new T.CanvasTexture(cv);
    tex.minFilter = T.LinearFilter;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    const s = (opts.size || 1.4) * 1.35;
    sp.scale.set(s * cv.width / cv.height, s, 1);
    sp.renderOrder = 999;
    return sp;
  }
  function truck(color = 0xd9472b) {
    const g = new T.Group();
    const cab = box(1.6, 1.6, 2.3, new T.MeshStandardMaterial({ color, roughness: .5 }), 0, 1.25, 0);
    const win = box(.05, .6, 1.9, C.vitre(), .82, 1.6, 0);
    const bed = box(6, 2.2, 2.4, mat("caisse", 0xe9eef3), -3.9, 1.55, 0);
    g.add(cab, win, bed);
    [[.2, 1.1], [-3.3, 1.1], [-5.6, 1.1]].forEach(([x]) => {
      [-1, 1].forEach(s => { const w = cyl(.45, .35, C.neo(), x, .45, s * 1.05, 14); w.rotation.x = Math.PI / 2; g.add(w); });
    });
    return g;
  }
  function car(color) {
    const g = new T.Group();
    g.add(box(3.8, .7, 1.7, new T.MeshStandardMaterial({ color, roughness: .45, metalness: .2 }), 0, .6, 0));
    g.add(box(2.0, .55, 1.5, C.vitre(), -.2, 1.2, 0));
    [[1.2], [-1.2]].forEach(([x]) => [-1, 1].forEach(s => { const w = cyl(.32, .25, C.neo(), x, .32, s * .8, 12); w.rotation.x = Math.PI / 2; g.add(w); }));
    return g;
  }

  /* ═══════════ MAQUETTE « ANATOMIE » ═══════════ */
  function buildAnatomie() {
    const root = new T.Group();
    const parts = [];
    const P = (key, name, color, desc, ex) => {
      const g = new T.Group(); g.userData.key = key; root.add(g);
      const p = { key, name, color, desc, g, ex: ex || [0, 0, 0] }; parts.push(p); return p;
    };
    const L1 = 25, X1 = 25, X2 = 50, W = 10;
    const yApp = 5.6, hP = 1.45, yBeam = yApp + .2, ySlab = yBeam + hP, eS = .22, yTop = ySlab + eS; // 7,47

    // ── terrain, remblais, voies franchies
    const terrain = P("terrain", "Terrain naturel & remblais d'accès", "#c59a63",
      "Le sol support et les <b>remblais</b> qui amènent la route au niveau du pont. Le remblai contre la culée est difficile à compacter : d'où la dalle de transition.", [0, -1.5, 0]);
    const ground = new T.Mesh(new T.PlaneGeometry(150, 90), C.herbe());
    ground.rotation.x = -Math.PI / 2; ground.position.set(X1, 0, 0); ground.receiveShadow = true;
    terrain.g.add(ground);
    [[-1, -1.2], [1, X2 + 1.2]].forEach(([s, x0]) => {
      // remblai : prisme trapézoïdal
      const sh = new T.Shape();
      sh.moveTo(0, 0); sh.lineTo(16, 0); sh.lineTo(16, yTop - .05); sh.lineTo(0, yTop - .05); sh.lineTo(0, 0);
      const g = new T.ExtrudeGeometry(sh, { depth: 16, bevelEnabled: false });
      g.translate(0, 0, -8);
      const m = new T.Mesh(g, C.terre());
      m.position.set(s < 0 ? x0 - 16 : x0, 0, 0);
      terrain.g.add(m);
    });
    // chaussées franchies (2 × 2 voies sous les travées)
    [12.5, 37.5].forEach(xc => {
      terrain.g.add(box(11, .06, 90, C.route(), xc, .03, 0));
      for (let z = -44; z < 44; z += 6) terrain.g.add(box(.18, .07, 3, C.blanc(), xc, .04, z));
      [-5.3, 5.3].forEach(dx => terrain.g.add(box(.15, .07, 90, C.blanc(), xc + dx, .04, 0)));
    });

    // ── fondations : semelles + pieux
    const fond = P("fondations", "Fondations : semelles", "#8d97a3",
      "Les <b>semelles</b> répartissent les efforts des appuis. Ici elles reposent sur des pieux car le bon sol est profond.", [0, -2.5, 0]);
    const pieux = P("pieux", "Fondations profondes : pieux", "#6e7884",
      "Les <b>pieux</b> (forés, Ø 1,00 m) transmettent les charges en profondeur jusqu'à la couche résistante, par la pointe et par frottement latéral.", [0, -5, 0]);
    const semelle = (x, wx) => {
      fond.g.add(box(wx, 1.2, W + .5, C.betonF(), x, -.6, 0));
      [-1, 1].forEach(sx => [-3.6, 0, 3.6].forEach(z => pieux.g.add(cyl(.5, 14, C.pieux(), x + sx * (wx / 2 - .9), -1.2 - 7, z))));
    };
    semelle(-1.6, 4.2); semelle(X1, 4.2); semelle(X2 + 1.6, 4.2);

    // ── culées
    const cul = P("culees", "Culées (appuis d'extrémité)", "#b9c1ca",
      "La <b>culée</b> porte l'extrémité du tablier et retient les terres du remblai. Elle comprend le mur de front, le sommier d'appui, le mur garde-grève et les murs en retour.", [0, 0, 0]);
    const gg = P("gardegreve", "Mur garde-grève", "#a7b1bc",
      "Petit voile en tête de culée qui <b>retient le remblai</b> derrière l'about du tablier et porte le joint de chaussée côté terre.", [0, 1.2, 0]);
    const ret = P("retour", "Murs en retour", "#d3d8de",
      "Voiles latéraux solidaires de la culée qui <b>tiennent le remblai</b> sur les côtés (parallèles à l'axe du pont).", [0, 0, 0]);
    [[-1, 0], [1, X2]].forEach(([s, xa]) => {
      const xf = xa - s * .6; // mur de front
      cul.g.add(box(1.2, yApp, W, C.beton(), xf, yApp / 2, 0));
      cul.g.add(box(1.8, .5, W, C.beton(), xa - s * .9, yApp - .25, 0)); // sommier
      gg.g.add(box(.3, yTop - yApp + .02, W, C.betonF(), xa - s * 1.05, (yTop + yApp) / 2, 0));
      gg.g.add(box(.35, .3, W, C.betonF(), xa - s * 1.37, yTop - .7, 0)); // corbeau
      [-1, 1].forEach(sz => ret.g.add(box(5.5, yTop - 1, .45, C.betonP(), xa - s * (1.2 + 2.75), 1 + (yTop - 1) / 2, sz * (W / 2 - .2))));
      ret.ex = [0, 0, 0];
      ret.g.userData.exz = 2;
    });

    // ── pile
    const pile = P("pile", "Pile (appui intermédiaire)", "#c3cad2",
      "La <b>pile</b> reprend les réactions du tablier au droit de l'appui intermédiaire : ici deux fûts circulaires Ø 1,20 m.", [0, 0, 0]);
    [-2.8, 2.8].forEach(z => pile.g.add(cyl(.6, yApp - 1, C.beton(), X1, (yApp - 1) / 2, z, 32)));
    const chev = P("chevetre", "Chevêtre", "#d0d6dc",
      "Poutre transversale en tête de pile qui <b>reçoit les appareils d'appui</b> et répartit les charges sur les fûts.", [0, .8, 0]);
    chev.g.add(box(2.1, 1, W - .6, C.betonP(), X1, yApp - .5, 0));

    // ── appareils d'appui
    const app = P("appuis", "Appareils d'appui (néoprène fretté)", "#1d1f24",
      "Blocs d'élastomère fretté posés sur des bossages : ils <b>transmettent les charges verticales</b> et autorisent rotations et dilatations du tablier.", [0, 1.6, 0]);
    const zb = [-4, -2, 0, 2, 4];
    const xBear = [.55, X1 - .45, X1 + .45, X2 - .55];
    xBear.forEach(x => zb.forEach(z => {
      app.g.add(box(.5, .08, .6, C.betonP(), x, yApp + .04, z));
      app.g.add(box(.4, .1, .5, C.neo(), x, yApp + .13, z));
      app.g.add(box(.42, .02, .52, C.metal(), x, yApp + .19, z));
    }));

    // ── poutres
    const pout = P("poutres", "Poutres préfabriquées précontraintes", "#a9b3bf",
      "Les <b>poutres principales</b> portent le tablier d'un appui à l'autre (travées indépendantes type VIPP). Profil en I : table de compression, âme, talon où sont logés les câbles.", [0, 2.6, 0]);
    [[.2, X1 - .2], [X1 + .2, X2 - .2]].forEach(([a, b]) => zb.forEach(z => {
      const m = extrudeX(profilI(hP), b - a, C.beton(), a);
      m.position.set(a, yBeam, z);
      pout.g.add(m);
    }));
    // ── entretoises
    const ent = P("entretoises", "Entretoises d'about", "#8b96a3",
      "Poutres transversales aux extrémités des travées : elles <b>solidarisent les poutres</b> et permettent le vérinage du tablier pour changer les appareils d'appui.", [0, 2.6, 0]);
    [1.0, X1 - 1.0, X1 + 1.0, X2 - 1.0].forEach(x => ent.g.add(box(.35, hP - .35, W - 1.4, C.betonF(), x, yBeam + .25 + (hP - .35) / 2, 0)));

    // ── hourdis
    const hou = P("hourdis", "Hourdis (dalle du tablier)", "#e3e7ec",
      "Dalle en béton armé coulée sur les poutres : elle <b>reçoit directement les roues</b> et répartit les charges transversalement entre les poutres.", [0, 4.2, 0]);
    [[.2, X1 - .2], [X1 + .2, X2 - .2]].forEach(([a, b]) => hou.g.add(box(b - a, eS, W, C.betonP(), (a + b) / 2, ySlab + eS / 2, 0)));

    // ── étanchéité et revêtement
    const eta = P("etancheite", "Chape d'étanchéité", "#2a3f8f",
      "Membrane qui <b>empêche l'eau de pénétrer</b> dans le béton : sans elle, les armatures du tablier rouillent.", [0, 5.4, 0]);
    eta.g.add(box(X2, .03, W - .2, C.etan(), X2 / 2, yTop + .015, 0));
    const rev = P("revetement", "Couche de roulement", "#3b3f47",
      "Enrobé bitumineux (≈ 8 cm) sur lequel circulent les véhicules ; il protège l'étanchéité.", [0, 6.4, 0]);
    rev.g.add(box(X2, .08, 7, C.asph(), X2 / 2, yTop + .07, 0));
    for (let x = 2; x < X2; x += 6) rev.g.add(box(3, .02, .15, C.blanc(), x + 1.5, yTop + .12, 0));

    // ── trottoirs, bordures
    const tro = P("trottoirs", "Trottoirs & bordures", "#d6dbe0",
      "Espaces réservés aux piétons, surélevés par une <b>bordure</b> ; ils abritent souvent des fourreaux pour réseaux (câbles, fibres).", [0, 5.8, 0]);
    [-1, 1].forEach(s => {
      tro.g.add(box(X2, .22, 1.5, C.betonP(), X2 / 2, yTop + .11, s * 4.25));
      tro.g.add(box(X2, .25, .2, C.blanc(), X2 / 2, yTop + .125, s * 3.55));
    });

    // ── corniches
    const cor = P("corniches", "Corniches", "#c9a84c",
      "Éléments de rive qui <b>dessinent la ligne du pont</b> (rôle esthétique) et protègent le bord du hourdis ; une goutte d'eau évite les coulures.", [0, 4.2, 1.8]);
    [-1, 1].forEach(s => cor.g.add(box(X2, .85, .25, mat("cor", 0xe9e2cf), X2 / 2, yTop - .2, s * (W / 2 + .12))));
    cor.g.userData.mirrorZ = true;

    // ── garde-corps
    const gc = P("gardecorps", "Garde-corps", "#9aa4ae",
      "Dispositif de retenue des <b>piétons</b> (hauteur ≈ 1,00 m) ; il ne résiste pas au choc d'un véhicule.", [0, 7.6, 2.4]);
    [-1, 1].forEach(s => {
      const z = s * (W / 2 - .1);
      for (let x = .5; x <= X2 - .5; x += 2) gc.g.add(box(.06, 1, .06, C.metal(), x, yTop + .72, z));
      gc.g.add(box(X2 - 1, .08, .08, C.metal(), X2 / 2, yTop + 1.22, z));
      gc.g.add(box(X2 - 1, .04, .04, C.metal(), X2 / 2, yTop + .55, z));
    });
    gc.g.userData.mirrorZ = true;

    // ── glissières
    const gl = P("glissieres", "Glissières de sécurité", "#7f8a96",
      "Dispositifs de retenue des <b>véhicules légers</b> placés entre chaussée et trottoir (les barrières, plus lourdes, retiennent les poids lourds).", [0, 7.0, 1.2]);
    [-1, 1].forEach(s => {
      const z = s * 3.42;
      for (let x = 1; x <= X2 - 1; x += 2) gl.g.add(box(.1, .7, .1, C.metal(), x, yTop + .35, z));
      gl.g.add(box(X2 - 1.5, .3, .06, C.metal(), X2 / 2, yTop + .55, z));
    });
    gl.g.userData.mirrorZ = true;

    // ── joints
    const jt = P("joints", "Joints de chaussée", "#2f66d6",
      "Dispositifs métalliques aux extrémités du tablier : ils <b>assurent la continuité de la chaussée</b> tout en laissant le tablier se dilater (température, retrait, fluage).", [0, 7.2, 0]);
    [0, X1, X2].forEach(x => jt.g.add(box(.35, .1, W - .3, C.acier(), x, yTop + .08, 0)));

    // ── dalles de transition
    const dt = P("transition", "Dalles de transition", "#e1d3b3",
      "Dalles en béton armé (≈ 30 cm) posées sur le corbeau de la culée : elles <b>effacent la marche</b> due au tassement du remblai.", [0, 3.2, 0]);
    [[-1, 0], [1, X2]].forEach(([s, xa]) => {
      const d = box(5, .3, W - .8, mat("dt", 0xe7dcc2), xa - s * (1.55 + 2.5), yTop - .55, 0);
      d.rotation.z = s * -.05;
      dt.g.add(d);
    });

    // ── évacuation des eaux
    const ev = P("gargouilles", "Évacuation des eaux (gargouilles)", "#3a9ad9",
      "Avaloirs et descentes qui <b>évacuent l'eau de pluie</b> du tablier ; l'eau stagnante abîme la chaussée et l'étanchéité.", [0, 4.0, 1.6]);
    [6, 19, 31, 44].forEach(x => [-1, 1].forEach(s => ev.g.add(cyl(.09, 1.1, mat("garg", 0x3a9ad9, { metalness: .3 }), x, ySlab - .4, s * (W / 2 - .45), 10))));
    ev.g.userData.mirrorZ = true;

    // ── repères (étiquettes)
    const marks = new T.Group();
    const add = (t, x, y, z, o) => { const s = label(t, o); s.position.set(x, y, z); marks.add(s); };
    add("Culée C0", -2, -1.2 + 12, -7, { size: 1.3 });
    add("Pile P1", X1, 2.2, -6.8, { size: 1.3 });
    add("Culée C2", X2 + 2, 10.8, -7, { size: 1.3 });
    add("Travée 1 — portée 25 m", X1 / 2, 12.4, 0, { size: 1.3, bg: "rgba(168,132,42,.92)", color: "#fff" });
    add("Travée 2 — portée 25 m", X1 + X1 / 2, 12.4, 0, { size: 1.3, bg: "rgba(168,132,42,.92)", color: "#fff" });
    add("Tablier", X1 + 6, 10.4, 6.5, { size: 1.15 });
    add("Ouverture (distance libre)", X1 / 2 + .5, 1.6, 8, { size: 1.1, bg: "rgba(15,143,123,.92)", color: "#fff" });
    add("Pieux", -1.6, -7, 7, { size: 1.1 });
    // cotes des portées
    const cote = (a, b, y, z) => {
      marks.add(box(b - a, .05, .05, C.gold(), (a + b) / 2, y, z));
      [a, b].forEach(x => marks.add(box(.05, .8, .05, C.gold(), x, y, z)));
    };
    cote(.55, X1, 10.6, 0); cote(X1, X2 - .55, 10.6, 0);
    const lo = new T.Group();
    lo.add(box(X1 - 1.2 - .55 - .6, .05, .05, mat("teal", 0x0f8f7b), (.6 + X1 - .6) / 2 + .25, .9, 8));
    marks.add(lo);
    root.add(marks);

    // ── trafic
    const traffic = new T.Group();
    const tk = truck(); tk.position.set(-10, yTop + .12, -1.75); traffic.add(tk);
    const c1 = car(0x2f66d6); c1.position.set(30, yTop + .12, 1.75); c1.rotation.y = Math.PI; traffic.add(c1);
    const below = [];
    [[12.5 - 2.7, 0xe8b21f, 1], [12.5 + 2.7, 0x0f8f7b, -1], [37.5 - 2.7, 0xffffff, 1], [37.5 + 2.7, 0xd9472b, -1]].forEach(([x, col, d], i) => {
      const c = car(col); c.rotation.y = d > 0 ? -Math.PI / 2 : Math.PI / 2; c.position.set(x, 0, -40 + i * 21); c.userData.d = d; traffic.add(c); below.push(c);
    });
    root.add(traffic);
    const anim = (t, dt) => {
      tk.position.x += dt * 9; if (tk.position.x > X2 + 22) tk.position.x = -22;
      c1.position.x -= dt * 12; if (c1.position.x < -22) c1.position.x = X2 + 22;
      below.forEach(c => { c.position.z += c.userData.d * dt * 14; if (c.position.z > 45) c.position.z = -45; if (c.position.z < -45) c.position.z = 45; });
    };

    return { root, parts, marks, traffic, anim, target: new T.Vector3(21, 3, 0), cam: new T.Vector3(-16, 21, 50) };
  }

  /* ═══════════ GALERIE « FAMILLES » ═══════════ */
  const FAM = [
    { id: "picf", n: "PICF", t: "Cadre fermé (PICF)", r: "2 à 12 m", d: "Passage inférieur en <b>cadre fermé</b> : traverse, piédroits et radier forment un anneau monolithique en béton armé. Très économique, il convient aux sols médiocres car le radier répartit les charges. Courant pour les passages de petites routes, de pistes ou de petits oueds sous les autoroutes." },
    { id: "pipo", n: "PIPO", t: "Portique ouvert (PIPO)", r: "8 à 20 m", d: "Passage inférieur en <b>portique ouvert</b> : comme le cadre, mais sans radier ; les piédroits reposent sur des semelles ou des pieux. Portée plus grande que le PICF, mais il demande un sol de meilleure qualité." },
    { id: "psida", n: "PSI-DA", t: "Pont-dalle (PSI-DA / DP)", r: "DA : 8 à 20 m — DP : 15 à 30 m", d: "Tablier en <b>dalle pleine</b> coulée sur cintre, en béton armé (DA) ou précontraint (DP), souvent à encorbellements latéraux. Faible épaisseur, grande robustesse, excellent pour les passages supérieurs d'autoroute à 2, 3 ou 4 travées." },
    { id: "vipp", n: "VIPP", t: "Poutres préfabriquées (VIPP / PRAD)", r: "PRAD : 10 à 30 m — VIPP : 30 à 50 m", d: "Poutres <b>préfabriquées précontraintes</b> posées à la grue ou à la poutre de lancement, puis solidarisées par un hourdis. Idéal quand on ne peut pas étayer (voie ferrée, rivière) et pour aller vite." },
    { id: "bipoutre", n: "Mixte", t: "Bipoutre mixte acier-béton", r: "30 à 90 m (jusqu'à ≈ 120 m)", d: "Deux poutres <b>métalliques en I</b> reliées par des pièces de pont, avec une dalle en béton connectée (goujons). Léger, rapide à monter, adapté aux sols médiocres et aux grandes portées — très utilisé sur les LGV et autoroutes." },
    { id: "caisson", n: "Caisson", t: "Caisson par encorbellements", r: "60 à 200 m", d: "Tablier en <b>caisson à hauteur variable</b>, construit par voussoirs successifs de part et d'autre des piles, sans cintre. La hauteur est forte sur pile (≈ L/16 à L/18) et faible à la clé (≈ L/30 à L/40)." },
    { id: "arc", n: "Arc", t: "Pont en arc", r: "50 à 300 m et plus", d: "L'<b>arc travaille en compression</b> : il renvoie les charges en poussées inclinées vers des appuis rocheux solides. Le tablier est porté par des montants (arc sous tablier) ou suspendu (arc au-dessus)." },
    { id: "bequilles", n: "Béquilles", t: "Pont à béquilles", r: "30 à 80 m", d: "Portique dont les <b>appuis sont inclinés</b> : ils réduisent la portée effective du tablier. Très élégant pour franchir une autoroute ou une vallée encaissée." },
    { id: "haubans", n: "Haubans", t: "Pont à haubans", r: "150 à plus de 1 000 m", d: "Le tablier est suspendu directement aux <b>pylônes par des câbles rectilignes</b> (haubans) en éventail ou en harpe. Exemple marocain : le pont Mohammed VI sur le Bouregreg (portée centrale 376 m)." },
    { id: "suspendu", n: "Suspendu", t: "Pont suspendu", r: "300 à plus de 2 000 m", d: "Deux <b>câbles porteurs paraboliques</b> passent sur les pylônes et sont ancrés dans de massifs d'ancrage ; le tablier y est accroché par des suspentes verticales. C'est la famille des records mondiaux de portée." }
  ];

  function deckCars(g, x0, x1, y, list) {
    const cs = [];
    list.forEach((o, i) => { const c = o.truck ? truck(o.c) : car(o.c); c.position.set(x0 + (x1 - x0) * o.f, y, o.z); if (o.d < 0) c.rotation.y = Math.PI; c.userData = { d: o.d, x0, x1 }; g.add(c); cs.push(c); });
    return (t, dt) => cs.forEach(c => { c.position.x += c.userData.d * dt * 10; if (c.position.x > c.userData.x1 + 6) c.position.x = c.userData.x0 - 6; if (c.position.x < c.userData.x0 - 6) c.position.x = c.userData.x1 + 6; });
  }
  function groundPlane(g, cx, w, d, y = 0) {
    const p = new T.Mesh(new T.PlaneGeometry(w, d), mat("herbe2", 0xa6cf8c));
    p.rotation.x = -Math.PI / 2; p.position.set(cx, y, 0); p.receiveShadow = true; g.add(p);
  }
  function roadUnder(g, xc, w = 9, len = 60) {
    g.add(box(w, .05, len, C.route(), xc, .03, 0));
    for (let z = -len / 2 + 2; z < len / 2; z += 5) g.add(box(.15, .06, 2.4, C.blanc(), xc, .05, z));
  }
  function slabDeck(g, x0, x1, y, e = .7, w = 10) {
    g.add(box(x1 - x0, e, w - 3, C.betonP(), (x0 + x1) / 2, y - e / 2, 0));
    [-1, 1].forEach(s => g.add(box(x1 - x0, e * .45, 1.6, C.betonP(), (x0 + x1) / 2, y - e * .225, s * (w / 2 - .8))));
    g.add(box(x1 - x0, .06, 7, C.asph(), (x0 + x1) / 2, y + .03, 0));
    [-1, 1].forEach(s => { for (let x = x0 + .5; x < x1; x += 2) g.add(box(.05, .9, .05, C.metal(), x, y + .45, s * (w / 2 - .1))); g.add(box(x1 - x0, .07, .07, C.metal(), (x0 + x1) / 2, y + .9, s * (w / 2 - .1))); });
  }
  function embank(g, x, s, top, w = 14) {
    const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(14, 0); sh.lineTo(14, top); sh.lineTo(0, top); sh.lineTo(0, 0);
    const geo = new T.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2);
    const m = new T.Mesh(geo, C.terre()); m.position.set(s < 0 ? x - 14 : x, 0, 0); g.add(m);
  }

  const BUILD = {
    picf(g) {
      const L = 8, H = 5.2, e = .5, len = 30, Ht = H + 1.8, top = 7, sl = 1.5;
      groundPlane(g, 0, 90, 80);
      // remblai de la route portée (talus 3/2), interrompu au droit du cadre
      const prof = yb => { const zb = top + sl * (Ht - yb); return [[-zb, yb], [zb, yb], [top, Ht], [-top, Ht]]; };
      g.add(extrudeX(prof(0), 27.5, C.terre(), -32));
      g.add(extrudeX(prof(0), 27.5, C.terre(), L / 2 + e));
      g.add(extrudeX(prof(H), L + 2 * e, C.terre(), -(L / 2 + e)));
      g.add(box(L + 2 * e, e, len, C.beton(), 0, e / 2, 0));               // radier
      g.add(box(L + 2 * e, e, len, C.beton(), 0, H - e / 2, 0));           // traverse
      [-1, 1].forEach(s => g.add(box(e, H, len, C.betonF(), s * (L / 2 + e / 2), H / 2, 0)));
      [-1, 1].forEach(s => [-1, 1].forEach(sz => { const w = box(.4, H - .6, 5, C.betonP(), s * (L / 2 + .3 + 1.1), (H - .6) / 2, sz * (len / 2 + 1.9)); w.rotation.y = s * sz * .55; g.add(w); }));
      g.add(box(64, .08, 9, C.asph(), 0, Ht + .04, 0));
      g.add(box(L - .4, .04, len + 16, C.route(), 0, e + .02, 0));
      g.add(box(L - .4, .04, 20, C.route(), 0, .03, len / 2 + 10));
      const a = deckCars(g, -30, 30, Ht + .09, [{ c: 0xd9472b, z: -2, d: 1, f: .2, truck: true }, { c: 0x2f66d6, z: 2, d: -1, f: .7 }]);
      const c = car(0xe8b21f); c.rotation.y = Math.PI / 2; c.position.set(0, e + .05, 0); g.add(c);
      return { anim: (t, dt) => { a(t, dt); c.position.z -= dt * 8; if (c.position.z < -26) c.position.z = 26; c.position.y = Math.abs(c.position.z) < len / 2 ? e + .05 : .06; }, target: [0, 3, 0], cam: [16, 10, 36] };
    },
    pipo(g) {
      const L = 15, H = 6, e = .6, len = 20;
      groundPlane(g, 0, 80, 60);
      [-1, 1].forEach(s => { embank(g, s * (L / 2 + e), s, H + .9, len + 4); });
      g.add(box(L + 2 * e, .8, len, C.beton(), 0, H - .4, 0));
      [-1, 1].forEach(s => { g.add(box(e, H, len, C.betonF(), s * (L / 2 + e / 2), H / 2, 0)); g.add(box(2.6, .9, len + 1, C.betonP(), s * (L / 2 + e / 2), -.45, 0)); });
      roadUnder(g, 0, 11, 70);
      g.add(box(L + 30, .08, 8, C.asph(), 0, H + .04, 0));
      const a = deckCars(g, -22, 22, H + .1, [{ c: 0x0f8f7b, z: -1.8, d: 1, f: .3 }, { c: 0xffffff, z: 1.8, d: -1, f: .6 }]);
      const t = truck(0xe8b21f); t.rotation.y = Math.PI / 2; t.position.set(-2.5, 0, 10); g.add(t);
      return { anim: (tt, dt) => { a(tt, dt); t.position.z -= dt * 7; if (t.position.z < -34) t.position.z = 34; }, target: [0, 3, 0], cam: [26, 15, 30] };
    },
    psida(g) {
      const spans = [12, 16, 16, 12], Y = 6.8, H = Y - .8;
      groundPlane(g, 28, 110, 70);
      let x = 0; const xs = [0]; spans.forEach(s => { x += s; xs.push(x); });
      embank(g, -1, -1, Y, 14); embank(g, x + 1, 1, Y, 14);
      slabDeck(g, -1, x + 1, Y, .75);
      xs.slice(1, -1).forEach(xp => [-3, 0, 3].forEach(z => g.add(cyl(.4, H, C.beton(), xp, H / 2, z, 24))));
      [0, x].forEach(xc => g.add(box(1, Y - .75, 9, C.betonF(), xc, (Y - .75) / 2, 0)));
      roadUnder(g, 12 + 8, 15, 70); roadUnder(g, 12 + 16 + 8, 15, 70);
      const a = deckCars(g, -10, x + 10, Y + .06, [{ c: 0xd9472b, z: -1.8, d: 1, f: .1, truck: true }, { c: 0x2f66d6, z: 1.8, d: -1, f: .6 }]);
      return { anim: a, target: [x / 2, 3, 0], cam: [x / 2 - 30, 22, 40] };
    },
    vipp(g) {
      const n = 3, Ls = 33, Y = 10, hP = 2.0;
      groundPlane(g, 50, 160, 90);
      g.add(box(130, .06, 30, C.eau(), 50, .05, 22));
      for (let i = 0; i < n; i++) {
        const a = i * Ls + .2, b = (i + 1) * Ls - .2;
        [-3.75, -1.25, 1.25, 3.75].forEach(z => { const m = extrudeX(profilI(hP), b - a, C.beton(), a); m.position.set(a, Y - hP - .2, z); g.add(m); });
        g.add(box(b - a, .22, 10, C.betonP(), (a + b) / 2, Y - .11, 0));
      }
      g.add(box(n * Ls, .06, 7, C.asph(), n * Ls / 2, Y + .03, 0));
      for (let i = 1; i < n; i++) { const xp = i * Ls; [-2.5, 2.5].forEach(z => g.add(cyl(.7, Y - hP - 1.2, C.beton(), xp, (Y - hP - 1.2) / 2, z, 28))); g.add(box(2.2, 1, 9.5, C.betonP(), xp, Y - hP - .7, 0)); }
      [0, n * Ls].forEach(xc => g.add(box(1.4, Y - hP - .2, 10, C.betonF(), xc, (Y - hP - .2) / 2, 0)));
      embank(g, -.7, -1, Y, 14); embank(g, n * Ls + .7, 1, Y, 14);
      [-1, 1].forEach(s => { for (let x = .5; x < n * Ls; x += 2) g.add(box(.05, .9, .05, C.metal(), x, Y + .45, s * 4.9)); g.add(box(n * Ls, .07, .07, C.metal(), n * Ls / 2, Y + .9, s * 4.9)); });
      const a = deckCars(g, -10, n * Ls + 10, Y + .07, [{ c: 0xe8b21f, z: -1.75, d: 1, f: .2, truck: true }, { c: 0x0f8f7b, z: 1.75, d: -1, f: .5 }]);
      return { anim: a, target: [n * Ls / 2, 4, 0], cam: [n * Ls / 2 - 40, 26, 55] };
    },
    bipoutre(g) {
      const spans = [45, 60, 45], Y = 14, h = 2.4;
      groundPlane(g, 75, 200, 100);
      let X = 0; spans.forEach(s => X += s);
      [-3, 3].forEach(z => {
        g.add(box(X, h - .1, .03, C.acier(), X / 2, Y - .3 - h / 2, z));       // âme
        g.add(box(X, .06, .7, C.acier(), X / 2, Y - .33, z));                   // semelle sup
        g.add(box(X, .08, 1.0, C.acier(), X / 2, Y - .3 - h, z));               // semelle inf
      });
      for (let x = 3; x < X; x += 7.5) g.add(box(.25, .7, 6, C.acier(), x, Y - .3 - h + .6, 0)); // pièces de pont
      g.add(box(X, .3, 11, C.betonP(), X / 2, Y - .15, 0));
      g.add(box(X, .06, 7, C.asph(), X / 2, Y + .03, 0));
      let x = 0; spans.slice(0, -1).forEach(s => { x += s; g.add(box(2, Y - h - .6, 8, C.beton(), x, (Y - h - .6) / 2, 0)); });
      [0, X].forEach(xc => g.add(box(1.5, Y - h - .3, 11, C.betonF(), xc, (Y - h - .3) / 2, 0)));
      embank(g, -.75, -1, Y, 16); embank(g, X + .75, 1, Y, 16);
      [-1, 1].forEach(s => { for (let xx = .5; xx < X; xx += 2.5) g.add(box(.05, .9, .05, C.metal(), xx, Y + .45, s * 5.4)); g.add(box(X, .07, .07, C.metal(), X / 2, Y + .9, s * 5.4)); });
      const a = deckCars(g, -10, X + 10, Y + .07, [{ c: 0xd9472b, z: -1.75, d: 1, f: .1, truck: true }, { c: 0x2f66d6, z: 1.75, d: -1, f: .5 }]);
      return { anim: a, target: [X / 2, 5, 0], cam: [X / 2 - 60, 30, 70] };
    },
    caisson(g) {
      const L1 = 55, L2 = 100, Y = 40, seg = 5;
      const X = 2 * L1 + L2;
      // vallée
      const sh = new T.Shape(); sh.moveTo(-20, Y - 1); sh.lineTo(10, Y - 4); sh.lineTo(55, 4); sh.lineTo(105, 0); sh.lineTo(155, 4); sh.lineTo(200, Y - 4); sh.lineTo(230, Y - 1); sh.lineTo(230, -2); sh.lineTo(-20, -2);
      const vg = new T.ExtrudeGeometry(sh, { depth: 70, bevelEnabled: false }); vg.translate(0, 0, -35);
      g.add(new T.Mesh(vg, mat("vallee", 0xa8c48f)));
      g.add(box(30, .08, 70, C.eau(), 105, .3, 0));
      const hOf = x => { // hauteur variable parabolique
        const piles = [L1, L1 + L2];
        const d = Math.min(...piles.map(p => Math.abs(x - p)));
        const half = d > L2 / 2 ? L2 / 2 : d;
        const hp = L2 / 17, hc = L2 / 36;
        const u = Math.min(1, half / (L2 / 2));
        return hc + (hp - hc) * (1 - u) * (1 - u);
      };
      for (let x = 0; x < X; x += seg) {
        const xm = x + seg / 2, h = hOf(xm);
        const col = (Math.floor(x / seg) % 2) ? C.beton() : C.betonP();
        g.add(box(seg - .04, h, 6.2, col, xm, Y - h / 2, 0));           // âmes + hourdis inf (simplifié)
        g.add(box(seg - .04, .3, 12, C.betonP(), xm, Y - .15, 0));       // hourdis sup + encorbellements
      }
      g.add(box(X, .06, 8, C.asph(), X / 2, Y + .03, 0));
      [L1, L1 + L2].forEach(xp => { const hb = Y - L2 / 17; const base = xp === L1 ? 4 : 4; g.add(box(5, hb - base, 6, C.beton(), xp, base + (hb - base) / 2, 0)); });
      [-1, 1].forEach(s => { for (let x = .5; x < X; x += 3) g.add(box(.06, 1, .06, C.metal(), x, Y + .5, s * 5.9)); g.add(box(X, .08, .08, C.metal(), X / 2, Y + 1, s * 5.9)); });
      const a = deckCars(g, -5, X + 5, Y + .07, [{ c: 0xe8b21f, z: -1.8, d: 1, f: .2, truck: true }, { c: 0xd9472b, z: 1.8, d: -1, f: .6 }]);
      return { anim: a, target: [X / 2, 20, 0], cam: [X / 2 - 70, 55, 120] };
    },
    arc(g) {
      const L = 120, f = 30, Y = 34, n = 40;
      const sh = new T.Shape(); sh.moveTo(-40, Y - 1); sh.lineTo(-5, Y - 2); sh.lineTo(0, 2); sh.lineTo(L, 2); sh.lineTo(L + 5, Y - 2); sh.lineTo(L + 40, Y - 1); sh.lineTo(L + 40, -3); sh.lineTo(-40, -3);
      const vg = new T.ExtrudeGeometry(sh, { depth: 60, bevelEnabled: false }); vg.translate(0, 0, -30);
      g.add(new T.Mesh(vg, mat("roche", 0xbfae93)));
      g.add(box(L - 30, .08, 60, C.eau(), L / 2, 2.2, 0));
      const yA = x => 2 + 4 * f * (x / L) * (1 - x / L);
      for (let i = 0; i < n; i++) {
        const xa = L * i / n, xb = L * (i + 1) / n;
        [-2.8, 2.8].forEach(z => g.add(between([xa, yA(xa), z], [xb, yA(xb), z], 1.0, C.beton(), 10)));
      }
      for (let x = 10; x < L; x += 10) { const y0 = yA(x); if (Y - .9 - y0 > .5) [-2.8, 2.8].forEach(z => g.add(box(.7, Y - .9 - y0, .7, C.betonF(), x, (Y - .9 + y0) / 2, z))); }
      slabDeck(g, -12, L + 12, Y, .9, 11);
      const a = deckCars(g, -12, L + 12, Y + .06, [{ c: 0xd9472b, z: -1.8, d: 1, f: .2, truck: true }, { c: 0x2f66d6, z: 1.8, d: -1, f: .6 }]);
      return { anim: a, target: [L / 2, 16, 0], cam: [L / 2 - 50, 40, 95] };
    },
    bequilles(g) {
      const L = 70, Y = 12;
      groundPlane(g, L / 2, 140, 80);
      roadUnder(g, L / 2, 24, 80);
      g.add(box(L + 30, 1.6, 10, C.betonP(), L / 2, Y - .8, 0));
      g.add(box(L + 30, .06, 7, C.asph(), L / 2, Y + .03, 0));
      [-1, 1].forEach(s => [-3, 3].forEach(z => {
        const xt = L / 2 + s * 22, xb = L / 2 + s * 34;
        g.add(between([xb, 0, z], [xt, Y - 1.6, z], .75, C.beton(), 16));
      }));
      embank(g, -15, -1, Y, 14); embank(g, L + 15, 1, Y, 14);
      const a = deckCars(g, -15, L + 15, Y + .07, [{ c: 0x0f8f7b, z: -1.8, d: 1, f: .3 }, { c: 0xe8b21f, z: 1.8, d: -1, f: .5, truck: true }]);
      return { anim: a, target: [L / 2, 5, 0], cam: [L / 2 - 30, 22, 60] };
    },
    haubans(g) {
      const Lc = 180, Ll = 80, Y = 26, Hp = 70;
      const X = 2 * Ll + Lc;
      g.add(box(X + 80, .1, 120, C.eau(), X / 2, 0, 0));
      g.add(box(X, 1.6, 22, C.betonP(), X / 2, Y - .8, 0));
      g.add(box(X, .06, 15, C.asph(), X / 2, Y + .03, 0));
      [Ll, Ll + Lc].forEach(xp => {
        // pylône en A
        [-1, 1].forEach(s => g.add(between([xp, 0, s * 13], [xp, Y + Hp, 0], 1.4, C.beton(), 12)));
        g.add(box(3, 2, 26, C.beton(), xp, Y - 2.6, 0));
        for (let k = 1; k <= 11; k++) {
          const yA = Y + Hp - 22 + k * 1.8;
          [-1, 1].forEach(side => {
            const xd = xp + side * (k * (Lc / 2 - 6) / 11);
            [-1, 1].forEach(zz => g.add(between([xp, yA, 0], [xd, Y, zz * 10.5], .12, C.cable(), 6)));
          });
        }
      });
      [0, X].forEach(xc => g.add(box(4, Y, 22, C.betonF(), xc, Y / 2, 0)));
      [Ll / 2, X - Ll / 2].forEach(xc => g.add(box(3, Y - 1.6, 8, C.beton(), xc, (Y - 1.6) / 2, 0)));
      const a = deckCars(g, -10, X + 10, Y + .07, [{ c: 0xd9472b, z: -4, d: 1, f: .2, truck: true }, { c: 0x2f66d6, z: -1.5, d: 1, f: .5 }, { c: 0xffffff, z: 3, d: -1, f: .4 }]);
      return { anim: a, target: [X / 2, 30, 0], cam: [X / 2 - 120, 90, 200] };
    },
    suspendu(g) {
      const Lc = 300, Ll = 90, Y = 40, Hp = 75;
      const X = 2 * Ll + Lc, xa = Ll, xb = Ll + Lc, yTop = Y + Hp, sag = 60;
      g.add(box(X + 140, .1, 160, C.eau(), X / 2, 0, 0));
      g.add(box(X, 3, 24, C.metal(), X / 2, Y - 1.5, 0));
      g.add(box(X, .06, 16, C.asph(), X / 2, Y + .03, 0));
      [xa, xb].forEach(xp => { [-1, 1].forEach(s => g.add(box(4, yTop, 4, C.beton(), xp, yTop / 2, s * 13))); g.add(box(4, 4, 30, C.beton(), xp, yTop - 6, 0)); g.add(box(4, 4, 30, C.beton(), xp, Y - 6, 0)); });
      [-30, X + 30].forEach(xc => g.add(box(26, 22, 34, C.betonF(), xc, 11, 0)));
      const yc = x => x < xa ? (yTop - (yTop - 18) * (xa - x) / (xa + 30)) : x > xb ? (yTop - (yTop - 18) * (x - xb) / (X - xb + 30)) : (yTop - sag + sag * Math.pow((x - (xa + xb) / 2) / (Lc / 2), 2));
      [-13, 13].forEach(z => {
        const pts = []; for (let x = -30; x <= X + 30; x += 6) pts.push(new T.Vector3(x, yc(x), z));
        const curve = new T.CatmullRomCurve3(pts);
        g.add(new T.Mesh(new T.TubeGeometry(curve, 200, .9, 8, false), C.cable()));
        for (let x = xa + 8; x < xb; x += 10) { const y0 = yc(x); if (y0 - Y > 1) g.add(between([x, Y, z], [x, y0, z], .12, C.cable(), 5)); }
      });
      const a = deckCars(g, -20, X + 20, Y + .07, [{ c: 0xd9472b, z: -4, d: 1, f: .2, truck: true }, { c: 0x2f66d6, z: -1.5, d: 1, f: .55 }, { c: 0xe8b21f, z: 3, d: -1, f: .4 }]);
      return { anim: a, target: [X / 2, 40, 0], cam: [X / 2 - 160, 120, 280] };
    }
  };

  /* ═══════════ MONTAGE D'UNE VISIONNEUSE ═══════════ */
  function mount(v) {
    const model = v.dataset.model;
    let stage = v.querySelector(".stage");
    if (!stage) { stage = document.createElement("div"); stage.className = "stage"; v.prepend(stage); }
    stage.innerHTML = "";
    const W = () => stage.clientWidth, H = () => stage.clientHeight;
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.setSize(W(), H());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    stage.append(renderer.domElement);
    const scene = new T.Scene();
    scene.fog = new T.Fog(0xdde7f1, 260, 900);
    const cam = new T.PerspectiveCamera(42, W() / H(), .1, 3000);
    const ctl = new T.OrbitControls(cam, renderer.domElement);
    ctl.enableDamping = true; ctl.dampingFactor = .08; ctl.maxPolarAngle = Math.PI * .495;
    scene.add(new T.HemisphereLight(0xffffff, 0xb9a98a, .75));
    const sun = new T.DirectionalLight(0xffffff, .85);
    sun.position.set(-60, 120, 80); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, far: 500 });
    scene.add(sun, sun.target);

    const hint = document.createElement("div"); hint.className = "hint"; hint.textContent = "Glisser : tourner · Molette/pincer : zoomer · Clic droit : déplacer";
    stage.append(hint);
    const info = document.createElement("div"); info.className = "info"; stage.append(info);

    let anim = null, world = null, traffic = true, focusKey = null;
    const clock = new T.Clock();
    const parts = [];

    function fit(target, camPos) {
      ctl.target.set(...target);
      cam.position.set(...camPos);
      sun.target.position.set(...target);
      ctl.update();
    }

    if (model === "anatomie") {
      const A = buildAnatomie();
      world = A.root; scene.add(world); anim = A.anim;
      parts.push(...A.parts);
      parts.forEach(p => { p.base = p.g.position.clone(); p.g.traverse(o => { if (o.isMesh) { o.userData.part = p; o.userData.mat = o.material; } }); });
      fit(A.target.toArray(), A.cam.toArray());
      // légende
      const leg = document.createElement("div"); leg.className = "legend" + (stage.clientWidth < 700 ? " closed" : "");
      leg.innerHTML = `<button type="button" class="leg-toggle">Pièces du pont</button><button type="button" data-k="" class="on"><i style="background:linear-gradient(135deg,#c9a84c,#1ab8a0)"></i>Tout le pont</button>` +
        parts.map(p => `<button type="button" data-k="${p.key}"><i style="background:${p.color}"></i>${p.name}</button>`).join("");
      stage.append(leg);
      leg.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.classList.contains("leg-toggle")) { leg.classList.toggle("closed"); return; }
        focus(b.dataset.k || null);
      });
      // barre d'outils
      const bar = document.createElement("div"); bar.className = "bar";
      bar.innerHTML = `<label>Vue éclatée <input type="range" min="0" max="100" value="0"></label>
        <label><input type="checkbox" checked data-o="marks"> Repères</label>
        <label><input type="checkbox" checked data-o="traffic"> Trafic</label>
        <button class="btn sm light" type="button" data-o="reset">Recentrer</button>`;
      v.append(bar);
      const rng = bar.querySelector("input[type=range]");
      rng.addEventListener("input", () => explode(rng.value / 100));
      bar.querySelector("[data-o=marks]").addEventListener("change", e => A.marks.visible = e.target.checked);
      bar.querySelector("[data-o=traffic]").addEventListener("change", e => { traffic = e.target.checked; A.traffic.visible = traffic; });
      bar.querySelector("[data-o=reset]").addEventListener("click", () => fit(A.target.toArray(), A.cam.toArray()));
      function explode(t) {
        parts.forEach(p => {
          const [ex, ey, ez] = p.ex;
          p.g.position.set(p.base.x + ex * t, p.base.y + ey * t, p.base.z + ez * t);
          if (p.g.userData.exz) p.g.children.forEach(c => { c.userData.z0 = c.userData.z0 ?? c.position.z; c.position.z = c.userData.z0 + Math.sign(c.userData.z0) * p.g.userData.exz * t; });
          if (p.g.userData.mirrorZ) p.g.children.forEach(c => { c.userData.z0 = c.userData.z0 ?? c.position.z; c.position.z = c.userData.z0 + Math.sign(c.userData.z0) * ez * t; });
        });
        // les parties symétriques s'écartent dans les deux sens : on annule la translation de groupe en z
        parts.forEach(p => { if (p.g.userData.mirrorZ) p.g.position.z = p.base.z; });
      }
      // focalisation
      const faded = new Map();
      const fadeOf = m => { if (!faded.has(m)) { const f = m.clone(); f.transparent = true; f.opacity = .1; f.depthWrite = false; faded.set(m, f); } return faded.get(m); };
      function focus(k) {
        focusKey = k;
        leg.querySelectorAll("button[data-k]").forEach(b => b.classList.toggle("on", (b.dataset.k || null) === k));
        parts.forEach(p => p.g.traverse(o => { if (o.isMesh) o.material = (!k || p.key === k) ? o.userData.mat : fadeOf(o.userData.mat); }));
        A.traffic.visible = traffic && !k;
        const p = parts.find(q => q.key === k);
        if (p) { info.innerHTML = `<b class="ttl">${p.name}</b>${p.desc}`; info.classList.add("on"); } else info.classList.remove("on");
      }
      // survol / clic dans la scène
      const ray = new T.Raycaster(), mouse = new T.Vector2();
      let downAt = null;
      const meshes = []; parts.forEach(p => { if (p.key !== "terrain") p.g.traverse(o => o.isMesh && meshes.push(o)); });
      const pick = e => {
        const r = renderer.domElement.getBoundingClientRect();
        mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(mouse, cam);
        const hit = ray.intersectObjects(meshes, false).find(h => h.object.material.opacity !== .1);
        return hit ? hit.object.userData.part : null;
      };
      renderer.domElement.addEventListener("pointerdown", e => downAt = [e.clientX, e.clientY]);
      renderer.domElement.addEventListener("pointerup", e => {
        if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
        const p = pick(e); focus(p ? (p.key === focusKey ? null : p.key) : null);
      });
      renderer.domElement.addEventListener("pointermove", e => {
        if (focusKey || e.buttons) return;
        const p = pick(e);
        if (p) { info.innerHTML = `<b class="ttl">${p.name}</b>${p.desc}`; info.classList.add("on"); renderer.domElement.style.cursor = "pointer"; }
        else { info.classList.remove("on"); renderer.domElement.style.cursor = ""; }
      });
    }

    if (model === "familles") {
      const bar = document.createElement("div"); bar.className = "bar";
      bar.innerHTML = `<div class="types">${FAM.map((f, i) => `<button type="button" data-id="${f.id}" class="${i ? "" : "on"}">${f.n}</button>`).join("")}</div>`;
      const desc = document.createElement("div"); desc.className = "type-desc";
      v.append(bar, desc);
      const show = id => {
        const f = FAM.find(q => q.id === id);
        if (world) { scene.remove(world); world.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
        world = new T.Group();
        const r = BUILD[id](world);
        scene.add(world);
        anim = r.anim;
        fit(r.target, r.cam);
        const far = Math.hypot(...r.cam.map((c, i) => c - r.target[i]));
        scene.fog.near = far * 1.6; scene.fog.far = far * 5;
        Object.assign(sun.shadow.camera, { left: -far, right: far, top: far, bottom: -far, far: far * 6 });
        sun.position.set(r.target[0] - far * .4, far * 1.2, far * .6); sun.shadow.camera.updateProjectionMatrix();
        bar.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.id === id));
        desc.innerHTML = `<b>${f.t}</b> — portées usuelles : <b>${f.r}</b><br>${f.d}`;
      };
      bar.addEventListener("click", e => { const b = e.target.closest("button[data-id]"); if (b) show(b.dataset.id); });
      show(v.dataset.start || "picf");
    }

    // rendu
    let visible = true;
    if ("IntersectionObserver" in window) new IntersectionObserver(es => es.forEach(e => visible = e.isIntersecting)).observe(v);
    function loop() {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, clock.getDelta());
      if (!visible) return;
      if (anim && traffic) anim(clock.elapsedTime, dt);
      ctl.update();
      renderer.render(scene, cam);
    }
    loop();
    new ResizeObserver(() => { renderer.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); }).observe(stage);
  }

  window.Bridge3D = { mount };
})();
