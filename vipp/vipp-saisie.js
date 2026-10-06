"use strict";
(() => {
  // src/engine/bordereau.ts
  var NUM = /-?\d+(?:\.\d*)?|-?\.\d+/g;
  var nums = (s) => (s.match(NUM) ?? []).map(Number);
  function parseBordereau(text) {
    const all = text.split(/\r?\n/);
    const start = all.findIndex((l) => /BORDEREAU DES DONNEES/.test(l));
    if (start < 0) throw new Error("bordereau introuvable");
    let end = all.findIndex((l, i) => i > start && /VIPPEL NO/.test(l));
    if (end < 0) end = all.length;
    const L = all.slice(start, end).map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length);
    const after = (re, occ = 0) => {
      let k = -1;
      for (let i = 0; i < L.length; i++) if (re.test(L[i])) {
        if (occ-- === 0) {
          k = i;
          break;
        }
      }
      if (k < 0) throw new Error("ligne absente : " + re);
      for (let j = k + 1; j < L.length; j++) {
        const v = nums(L[j]);
        if (v.length && !/[A-Z]{3,}/.test(L[j].replace(/E[+-]?\d/g, ""))) return v;
      }
      throw new Error("donn\xE9es absentes : " + re);
    };
    const t = (n) => {
      const v = L.find((l) => l.startsWith(n + " :"))?.replace(/^\d+ :\s*/, "") ?? "";
      return v === "-" ? "" : v;
    };
    const l1 = t(1).split(" ");
    const date = l1.pop() ?? "", numero = l1.pop() ?? "";
    const titre = [l1.join(" "), t(2), t(3)];
    const l4 = nums(t(4));
    const poutres = l4.slice(0, l4.length - 14);
    const a1 = after(/^LIGNE A1\b/);
    const [SYMTAB, NVOIE, ETROTG, EGAU, ESURCH, EDROI, ETROTD, NPOUT, ENTRAPOUT, DPOUT1, PORTEE, ABOUT, NE, ENTINT, ENTAPP, NT, BIAIS] = a1;
    const shape = (v) => {
      const [PENTPOUT, ETAB, ETALON, HPOUT, HPIED, H1, H2, H3D, H3G, HTAB, E1, E2, D3D, D3G, GDA, LIN, EPAM, LONGOUS, PLA, HPLA] = v;
      return { PENTPOUT, ETAB, ETALON, HPOUT, HPIED, H1, H2, H3D, H3G, HTAB, E1, E2, D3D, D3G, GDA, LIN, EPAM, LONGOUS, PLA, HPLA };
    };
    const beam = shape(after(/^LIGNE A2\b/));
    const a3 = after(/^LIGNE A3\b/);
    const cross = { AMEN: a3[4], H5D: a3[5], H5G: a3[6], H7D: a3[7], H7G: a3[8], H9D: a3[9], H9G: a3[10], AMORD: a3[11], AMORG: a3[12] };
    const a4 = after(/^TYPOURI\b/);
    const TYPOURI = [a4[0], a4[1]];
    const beamRive = TYPOURI[0] === 0 || TYPOURI[1] === 0 ? shape(a4.slice(2)) : void 0;
    const edge = (v, left) => {
      const [HHOUR, HEXT, EEXT, PENTSUP, PENTINF, AMEN, H5D, H5G, H7D, H7G, H9, AMORD, AMORG] = v;
      return { HHOUR, HEXT, EEXT, PENTSUP, PENTINF, cross: { AMEN, H5D, H5G, H7D, H7G, H9D: H9, H9G: H9, AMORD, AMORG } };
    };
    const slabG = edge(after(/^LIGNE A5\b/), true), slabD = edge(after(/^LIGNE A6\b/), false);
    const b1 = after(/^LIGNE B1\b/);
    const b2 = after(/^LIGNE B2\b/);
    const qsup = [];
    for (let i = 0; i + 3 < b2.length; i += 4) qsup.push({ de: b2[i], a: b2[i + 1], max: b2[i + 2], min: b2[i + 3] });
    const b3 = after(/^LIGNE B3\b/);
    const c1 = after(/^LIGNE C1\b/), c2 = after(/^LIGNE C2\b/);
    const sys = (v) => {
      const [ARMA, FPRG, FPEG, SIGP0, EP, SECAB, DGAINE, ENROB, DECAL, F, PHI, RECUL, R1000, NGA, TYPE, AV, AH] = v;
      return { ARMA, FPRG, FPEG, SIGP0, EP, SECAB, DGAINE, ENROB, DECAL, F, PHI, RECUL, R1000, NGA, TYPE, AV, AH };
    };
    const systems = [sys(after(/^LIGNE C3\b/)), sys(after(/^LIGNE C4\b/))];
    const c5 = after(/^LIGNE C5\b/);
    let c6 = [];
    try {
      c6 = after(/^A CALCULER\b/);
    } catch {
      c6 = [];
    }
    const cablings = [];
    const nCab = Math.floor(c6.length / 8);
    const dStarts = L.map((l, i) => /TABLEAU D - DEFINITION DU TRACE/.test(l) ? i : -1).filter((i) => i >= 0);
    for (let c = 0; c < nCab; c++) {
      const v = c6.slice(8 * c, 8 * c + 8);
      const from = dStarts[c], to = c + 1 < dStarts.length ? dStarts[c + 1] : L.length;
      let abscisses = [];
      const ordonnees = [];
      const cables = [];
      for (let i = from; i < to; i++) {
        const l = L[i];
        if (/^LIGNE D' /.test(l)) {
          const w = nums(l.slice(8));
          const [, num2, ARMA, SECAB, SIGP0, ANPA, SYM, ABDECO, ORFICO, ABFICO, ABSOR, ANGSOR, EXTRAN, ABDEHO, ABFIHO, YENCO, DENCO] = w;
          cables.push({ num: num2, ARMA, SECAB, SIGP0, ANPA, SYM, ABDECO, ORFICO, ABFICO, ABSOR, ANGSOR, EXTRAN, ABDEHO, ABFIHO, YENCO, DENCO });
        } else if (/^LIGNE D /.test(l)) {
          const w = nums(l.slice(7));
          if (w[0] === 0 && !abscisses.length) abscisses = w.slice(1);
          else ordonnees.push(w.slice(1));
        }
      }
      cablings.push({ poutres: v.slice(0, 5).filter((p) => p > 0), NCAB11: v[5], NCAB12: v[6], NCAB2: v[7], abscisses, ordonnees, cables });
    }
    return {
      titre,
      numero,
      date: date.replace(/^(\d\d)(\d\d)(\d\d)$/, "$1.$2.$3"),
      poutresACalculer: poutres,
      SYMTAB,
      NVOIE,
      ETROTG,
      EGAU,
      ESURCH,
      EDROI,
      ETROTD,
      NPOUT,
      ENTRAPOUT,
      DPOUT1,
      PORTEE,
      ABOUT,
      NE,
      ENTINT,
      ENTAPP,
      NT,
      BIAIS,
      beam,
      slab: { HHOUR: a3[0], HAXE: a3[1], PENTSUP: a3[2], PENTINF: a3[3] },
      cross,
      HENTA: a3[13],
      HENTI: a3[14],
      TYPOURI,
      beamRive,
      slabG,
      slabD,
      MASVOL: b1[0],
      OSSAMAXP: b1[1],
      OSSAMINP: b1[2],
      OSSAMAXH: b1[3],
      OSSAMINH: b1[4],
      DBAG: b1[5],
      PBAGMAX: b1[6],
      PBAGMIN: b1[7],
      DBAD: b1[8],
      PBADMAX: b1[9],
      PBADMIN: b1[10],
      PDALMAX: b1[11],
      PDALMIN: b1[12],
      qsup,
      CLASSE: b3[0] >= 100 ? Math.round(b3[0] / 100) : b3[0],
      A: b3[1],
      B: b3[2],
      CM: b3[3],
      CE: b3[4],
      PSTROT: b3[5],
      A1: b3[6],
      A2: b3[7],
      A3: b3[8],
      CLASSEBP: c1[0] >= 100 ? Math.round(c1[0] / 100) : c1[0],
      POISSON: c1[1],
      FC11: c1[2],
      FC12: c1[3],
      FC28: c1[4],
      FC4H: c1[5],
      FC5H: c1[6],
      FC28H: c1[7],
      EPSR: c1[8],
      FE1: c2[0],
      SIGS: c2[1],
      TYPEAP: c2[2],
      DAP: c2[3],
      ES: c2[4],
      FE2: c2[5],
      NH: c2[6],
      NS3: c2[7],
      NP3: c2[8],
      NP0: c2[9],
      RO: c2[10],
      SPSI1: c2[11],
      DFPRG: c2[12],
      KTABF: c2[13],
      systems,
      J: { J1: c5[0], J2: c5[1], J3: c5[2], J4: c5[3], J5: c5[4], J6: c5[5], J999: c5[6], JSUP: c5[7] },
      cablings
    };
  }
  function checkBordereau(b) {
    const out = [];
    b.cablings.forEach((c, ic) => c.cables.forEach((d) => {
      if (d.ABSOR < 1 || !d.ANGSOR) return;
      const t0 = Math.tan(d.ANGSOR * Math.PI / 200);
      const y0 = b.beam.HPOUT - t0 * (d.ABDECO - d.ABSOR);
      const drop = y0 - d.ORFICO, para = t0 * (d.ABFICO - d.ABDECO) / 2;
      const r = drop / para;
      if (Math.abs(r - 1) > 0.03) out.push({
        cablage: ic + 1,
        cable: d.num,
        message: `trac\xE9 vertical non parabolique : chute ${drop.toFixed(3)} m pour ${para.toFixed(3)} m attendus (rapport ${r.toFixed(2)}) \u2014 r\xE9sultats de tension pouvant diff\xE9rer de VIPP-EL de quelques MPa`
      });
    }));
    return out;
  }

  // src/engine/bordereau_write.ts
  var f = (v, d = 3) => {
    if (!isFinite(v)) v = 0;
    for (let k = d; k <= 6; k++) {
      const s = v.toFixed(k);
      if (Math.abs(Number(s) - v) < 1e-9) return s;
    }
    return String(+v.toFixed(8));
  };
  var i0 = (v) => String(Math.round(v || 0));
  var fd = (v) => Number.isInteger(v) ? v + "." : f(v);
  var row = (vals, w = 8) => "           " + vals.map((s) => s.padStart(w)).join(" ");
  var shapeVals = (s) => [
    f(s.PENTPOUT),
    f(s.ETAB),
    f(s.ETALON),
    f(s.HPOUT),
    f(s.HPIED),
    f(s.H1),
    f(s.H2),
    f(s.H3D),
    f(s.H3G),
    f(s.HTAB),
    f(s.E1),
    f(s.E2),
    f(s.D3D),
    f(s.D3G),
    i0(s.GDA),
    i0(s.LIN),
    f(s.EPAM),
    f(s.LONGOUS),
    i0(s.PLA),
    f(s.HPLA)
  ];
  var ZERO_SHAPE = { PENTPOUT: 0, ETAB: 0, ETALON: 0, HPOUT: 0, HPIED: 0, H1: 0, H2: 0, H3D: 0, H3G: 0, HTAB: 0, E1: 0, E2: 0, D3D: 0, D3G: 0, GDA: 0, LIN: 0, EPAM: 0, LONGOUS: 0, PLA: 0, HPLA: 0 };
  var edgeVals = (e, left) => [
    f(e.HHOUR),
    f(e.HEXT),
    f(e.EEXT),
    f(e.PENTSUP),
    f(e.PENTINF),
    i0(e.cross.AMEN),
    f(e.cross.H5D),
    f(e.cross.H5G),
    f(e.cross.H7D),
    f(e.cross.H7G),
    f(left ? e.cross.H9D : e.cross.H9G),
    f(e.cross.AMORD),
    f(e.cross.AMORG),
    f(0),
    f(0)
  ];
  var sysVals = (s) => [
    i0(s.ARMA),
    f(s.FPRG, 1),
    f(s.FPEG, 1),
    f(s.SIGP0, 1),
    fd(s.EP),
    fd(s.SECAB),
    f(s.DGAINE),
    f(s.ENROB),
    f(s.DECAL),
    f(s.F),
    f(s.PHI, 4),
    f(s.RECUL),
    f(s.R1000, 2),
    i0(s.NGA),
    i0(s.TYPE),
    f(s.AV),
    f(s.AH)
  ];
  function formatBordereau(b) {
    const L = [];
    const P = (...s) => L.push(...s);
    const dateRaw = (b.date || "").replace(/^(\d\d)\.(\d\d)\.(\d\d)$/, "$1$2$3") || "000000";
    const titre = [...b.titre, "", "", ""].slice(0, 3).map((t) => (t || "").toUpperCase().replace(/\s+/g, " ").trim() || "-");
    P(
      "                                                        BORDEREAU DES DONNEES",
      "                                                        =====================",
      "",
      "LIGNE NO                                 TITRE                                  NO    DATE",
      "",
      "  1 :   " + titre[0].padEnd(72) + " " + (b.numero || "0001").padStart(5) + " " + dateRaw,
      "  2 :   " + titre[1],
      "  3 :   " + titre[2],
      "",
      "                  POUTRES A CALCULER",
      "             ----------------------------------------------------------",
      "  4 :   " + b.poutresACalculer.map((p) => String(p).padStart(5)).join(" ") + "    1 0 0 0 0 0 2 1 1 0 1 1 0 0",
      "  5 :                                      1 0 0 0 0 1 0 0 0 0 0 0 0 0",
      "",
      "                              TABLEAU A - CARACTERISTIQUES GEOMETRIQUES DE L'OUVRAGE",
      "                              ======================================================",
      "",
      "LIGNE A1   SYMTAB NVOIE ETROTG   EGAU ESURCH     EDROI ETROTD NPOUT ENTRAPOUT DPOUT1 PORTEE ABOUT NE ENTINT ENTAPP NT BIAIS EDESS",
      row([
        i0(b.SYMTAB),
        i0(b.NVOIE),
        f(b.ETROTG),
        f(b.EGAU),
        f(b.ESURCH),
        f(b.EDROI),
        f(b.ETROTD),
        i0(b.NPOUT),
        f(b.ENTRAPOUT),
        f(b.DPOUT1),
        f(b.PORTEE),
        f(b.ABOUT),
        i0(b.NE),
        f(b.ENTINT),
        f(b.ENTAPP),
        i0(b.NT),
        f(b.BIAIS, 2),
        f(0),
        "0"
      ], 6),
      "",
      "           POUTRES INTERMEDIAIRES",
      "LIGNE A2   PENTPOUT ETAB ETALON HPOUT HPIED  H1    H2   H3D   H3G H TAB    E1    E2   D3D   D3G GOUDAM LIN EPAM LONGOUS PLAB HPLA",
      row(shapeVals(b.beam), 6),
      "",
      "LIGNE A3   HHOUR H AXE   PENT SUP PENT INF   AMEN H5D    H5G   H7D   H7G   H9D   H9G     AMORD     AMORG    HENTA   HENTI   EABOUT DEXTR",
      row([
        f(b.slab.HHOUR),
        f(b.slab.HAXE),
        f(b.slab.PENTSUP),
        f(b.slab.PENTINF),
        i0(b.cross.AMEN),
        f(b.cross.H5D),
        f(b.cross.H5G),
        f(b.cross.H7D),
        f(b.cross.H7G),
        f(b.cross.H9D),
        f(b.cross.H9G),
        f(b.cross.AMORD),
        f(b.cross.AMORG),
        f(b.HENTA),
        f(b.HENTI),
        f(0),
        f(0)
      ], 6),
      "",
      "          POUTRES DE RIVE",
      "LIGNE A4",
      "  TYPOURI PENTPOUT ETAB ETALON HPOUT HPIED  H1    H2   H3D   H3G H TAB    E1    E2   D3D   D3G GOUDAM LIN EPAM LONGOUS PLAB HPLA",
      "    " + i0(b.TYPOURI[0]) + " " + i0(b.TYPOURI[1]) + " " + shapeVals(b.beamRive ?? ZERO_SHAPE).map((s) => s.padStart(6)).join(" "),
      "",
      "           ENCORBELLEMENT DE GAUCHE",
      "LIGNE A5   HHOUR H GAU E GAUH PENTSUPG PENTINFG     AMEN H5D    H5G   H7D   H7G   H9D     AMORD     AMORG   EABOUT DEXTR",
      row(edgeVals(b.slabG, true), 6),
      "",
      "           ENCORBELLEMENT DE DROITE",
      "LIGNE A6   HHOUR HDROI EDROIH PENTSUPD PENTINFD     AMEN H5D    H5G   H7D   H7G   H9G     AMORD     AMORG   EABOUT DEXTR",
      row(edgeVals(b.slabD, false), 6),
      "",
      "                                     TABLEAU B - DEFINITION DES ACTIONS ET SOLLICITATIONS",
      "                                     ====================================================",
      "",
      "                       POUTRE            HOURDIS",
      "LIGNE B1   MASVOL OSSAMAX OSSAMIN OSSAMAX OSSAMIN                      DBAG PBAGMAX PBAGMIN       DBAD PBADMAX PBADMIN PREDALMAX PREDALMIN",
      row([f(b.MASVOL), f(b.OSSAMAXP), f(b.OSSAMINP), f(b.OSSAMAXH), f(b.OSSAMINH), f(b.DBAG), f(b.PBAGMAX), f(b.PBAGMIN), f(b.DBAD), f(b.PBADMAX), f(b.PBADMIN), f(b.PDALMAX), f(b.PDALMIN)], 7),
      "",
      "           NUM QSUP QSUP                NUM QSUP QSUP              NUM QSUP QSUP          NUM QSUP QSUP",
      "LIGNE B2   POUT MAX    MIN              POUT MAX    MIN            POUT MAX    MIN        POUT MAX    MIN",
      "           " + (b.qsup.length ? b.qsup : [{ de: 1, a: b.NPOUT, max: 0, min: 0 }]).map((q) => `${i0(q.de)} ${i0(q.a)} ${f(q.max)} ${f(q.min)}`).join("        "),
      "",
      "LIGNE B3   CLASSE     A             B           CM          CE         PSTROT     A1     A2       A3",
      row([i0(b.CLASSE * 100), i0(b.A), i0(b.B), i0(b.CM), i0(b.CE), f(b.PSTROT), f(b.A1), f(b.A2), f(b.A3)], 9),
      ""
    );
    for (const k of [4, 5, 6, 7]) P(
      `LIGNE B${k}   IEL G PREC        G GMAX      G GMIN      PSI A       PSI BC    PSI BT   PSI ME   PSI MC      PSI EX   PSI BG   PSI TR`,
      row(["1", ...Array(11).fill(f(0))], 7),
      ""
    );
    P(
      "                                     TABLEAU C - DEFINITION DES MATERIAUX",
      "                                     ====================================",
      "",
      "LIGNE C1   CL BP POIS          FC1        FC2        FC28     FC4H       FC5H   FC28H    EPS R",
      row([i0(b.CLASSEBP * 100), f(b.POISSON), f(b.FC11, 1), f(b.FC12, 1), f(b.FC28, 1), f(b.FC4H, 1), f(b.FC5H, 1), f(b.FC28H, 1), f(b.EPSR)], 9),
      "",
      "LIGNE C2     FE1      SIGS         TYPE        D          ES             FE2   NH    NS3 NP3      NP0     RO    S.PSI1   D.FPRG   KF",
      row([f(b.FE1, 1), f(b.SIGS, 1), i0(b.TYPEAP), f(b.DAP), fd(b.ES), f(b.FE2, 1), f(b.NH, 1), f(b.NS3, 1), f(b.NP3, 1), f(b.NP0, 1), f(b.RO, 2), f(b.SPSI1, 1), f(b.DFPRG, 1), i0(b.KTABF)], 8),
      ""
    );
    b.systems.slice(0, 2).forEach((s, k) => P(
      `LIGNE C${3 + k}   ARMA    FPRG         FPEG         SIGPO        EP    SECAB DGAINE ENROB DECAL  F     PHI                 RECUL R1000 NG TYPE  AV    AH`,
      row(sysVals(s), 7),
      ""
    ));
    if (b.systems.length < 2) P("LIGNE C4   ARMA    FPRG         FPEG         SIGPO        EP    SECAB DGAINE ENROB DECAL  F     PHI                 RECUL R1000 NG TYPE  AV    AH", row(sysVals(b.systems[0]), 7), "");
    const J = b.J;
    P(
      "LIGNE C5    J1      J2        J3        J4      J5      J6        J7     JSUP",
      row([J.J1, J.J2, J.J3, J.J4, J.J5, J.J6, J.J999, J.JSUP].map(i0), 7),
      ""
    );
    P(
      "LIGNE C6   " + b.cablings.map((_, i) => `            CABLAGE ${i + 1}          `).join(""),
      "           " + b.cablings.map(() => "   POUTRES         NCAB          ").join(""),
      "A CALCULER " + b.cablings.map(() => "                11 12   2        ").join(""),
      "           " + b.cablings.map((c) => [...c.poutres, 0, 0, 0, 0, 0].slice(0, 5).map(i0).join(" ") + "   " + [c.NCAB11, c.NCAB12, c.NCAB2].map(i0).join(" ")).join("     "),
      ""
    );
    b.cablings.forEach((c, ic) => {
      P(
        `                              TABLEAU D - DEFINITION DU TRACE DU CABLAGE ${ic + 1}`,
        "                              ============================================",
        "",
        "                                    ABSCISSES DE DEFINITION DES CABLES",
        "",
        "LIGNE D   0  " + c.abscisses.map((x) => f(x).padStart(8)).join(" "),
        "",
        "                                  ORDONNEES DES AXES DES GAINES EN CES ABSCISSES",
        ""
      );
      c.ordonnees.forEach((o, k) => P(`LIGNE D   ${k + 1}  ` + o.map((y) => f(y).padStart(8)).join(" "), ""));
      P(
        "",
        `                              TABLEAU D' - CARACTERISTIQUES COMPLEMENTAIRES DES CABLES DANS LE CABLAGE ${ic + 1}`,
        "                               ==========================================================================",
        "",
        "              NUM ARMA SECAB     SIGPO    MODE NCASY ABDECO ORFICO ABFICO ABSOR ANGSOR EXTRAN ABDEHO ABFIHO YENCO DENCO",
        ""
      );
      c.cables.forEach((d, k) => P(`LIGNE D' ${k + 1}  ` + [
        i0(d.num),
        i0(d.ARMA),
        fd(d.SECAB),
        fd(d.SIGP0),
        i0(d.ANPA),
        i0(d.SYM),
        f(d.ABDECO),
        f(d.ORFICO),
        f(d.ABFICO),
        f(d.ABSOR),
        f(d.ANGSOR, 2),
        f(d.EXTRAN, 2),
        f(d.ABDEHO),
        f(d.ABFIHO),
        f(d.YENCO),
        f(d.DENCO)
      ].map((s) => s.padStart(8)).join(" "), ""));
    });
    return L.join("\n");
  }

  // src/engine/gm.ts
  function matMul(a, b) {
    const n = a.length, r = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
      const v = a[i][k];
      if (v !== 0) for (let j = 0; j < n; j++) r[i][j] += v * b[k][j];
    }
    return r;
  }
  function matVec(a, v) {
    return a.map((row2) => row2.reduce((s, x, j) => s + x * v[j], 0));
  }
  function expm(a) {
    const n = a.length;
    let norm = 0;
    for (const row2 of a) norm = Math.max(norm, row2.reduce((s2, x) => s2 + Math.abs(x), 0));
    let sq = 0;
    while (norm > 0.25) {
      norm /= 2;
      sq++;
    }
    const s = Math.pow(2, sq);
    const as = a.map((r) => r.map((x) => x / s));
    let term = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => i === j ? 1 : 0));
    let sum = term.map((r) => r.slice());
    for (let k = 1; k < 24; k++) {
      term = matMul(term, as).map((r) => r.map((x) => x / k));
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sum[i][j] += term[i][j];
    }
    for (let k = 0; k < sq; k++) sum = matMul(sum, sum);
    return sum;
  }
  function solve(A, b) {
    const n = b.length;
    const M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) {
        const f2 = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f2 * M[c][k];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  function kExact(theta, alpha, y, e) {
    const S = Math.PI * theta;
    const c = 2 * alpha;
    const A = [[0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [-1, 0, 2 * alpha, 0]];
    const se = e * S;
    const E1 = expm(A.map((r) => r.map((x) => x * (se + S))));
    const E2 = expm(A.map((r) => r.map((x) => x * (S - se))));
    const j = [0, 0, 0, S];
    const B = [[0, 0, 1, 0], [0, -c, 0, 1]];
    const E21 = matMul(E2, E1);
    const rowTimes = (bb, M) => [0, 1, 2, 3].map((k) => bb.reduce((s, x, i) => s + x * M[i][k], 0));
    const rows = [B[0], B[1], rowTimes(B[0], E21), rowTimes(B[1], E21)];
    const E2j = matVec(E2, j);
    const rhs = [0, 0, -B[0].reduce((s, x, i) => s + x * E2j[i], 0), -B[1].reduce((s, x, i) => s + x * E2j[i], 0)];
    const X0 = solve(rows, rhs);
    const sy = y * S;
    let Xy;
    if (sy <= se) Xy = matVec(expm(A.map((r) => r.map((x) => x * (sy + S)))), X0);
    else {
      const Xe = matVec(E1, X0).map((v, i) => v + j[i]);
      Xy = matVec(expm(A.map((r) => r.map((x) => x * (sy - se)))), Xe);
    }
    return 2 * Xy[0];
  }
  var _GuyonMassonnet = class _GuyonMassonnet {
    // points par côté du point anguleux (écart < 1e-6 sur K)
    constructor(theta, alpha) {
      this.theta = theta;
      this.alpha = alpha;
      this.cache = /* @__PURE__ */ new Map();
      this.grids = /* @__PURE__ */ new Map();
    }
    exact(y, e) {
      const k0 = kExact(this.theta, 0, y, e);
      const k1 = kExact(this.theta, 1 - 1e-9, y, e);
      return k0 + (k1 - k0) * Math.sqrt(this.alpha);
    }
    /** K(y, e) : tabulé en e pour chaque y (positions de poutres), de part et d'autre du point anguleux e = y,
     *  interpolation de Catmull-Rom sur chaque côté */
    K(y, e) {
      const ee = Math.max(-1, Math.min(1, e));
      const ky = y.toFixed(9), n = _GuyonMassonnet.N;
      let g = this.grids.get(ky);
      if (!g) {
        g = new Float64Array(2 * (n + 1));
        for (let i2 = 0; i2 <= n; i2++) {
          g[i2] = this.exact(y, -1 + (y + 1) * i2 / n);
          g[n + 1 + i2] = this.exact(y, y + (1 - y) * i2 / n);
        }
        this.grids.set(ky, g);
      }
      const left = ee <= y, a = left ? -1 : y, w = left ? y + 1 : 1 - y, off = left ? 0 : n + 1;
      if (w < 1e-12) return g[off];
      const u = (ee - a) / w * n, i = Math.min(n - 1, Math.floor(u)), t = u - i;
      const p1 = g[off + i], p2 = g[off + i + 1];
      const p0 = i > 0 ? g[off + i - 1] : 2 * p1 - p2, p3 = i + 2 <= n ? g[off + i + 2] : 2 * p2 - p1;
      return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
    }
    /** valeur exacte (contrôle) */
    Kexact(y, e) {
      const k = y.toFixed(9) + "|" + e.toFixed(9);
      let v = this.cache.get(k);
      if (v === void 0) {
        v = this.exact(y, Math.max(-1, Math.min(1, e)));
        this.cache.set(k, v);
      }
      return v;
    }
  };
  _GuyonMassonnet.N = 400;
  var GuyonMassonnet = _GuyonMassonnet;

  // src/engine/geometry.ts
  function inter(p1, p2, p3, p4) {
    const d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
    const a = p1[0] * p2[1] - p1[1] * p2[0];
    const b = p3[0] * p4[1] - p3[1] * p4[0];
    return [(a * (p3[0] - p4[0]) - (p1[0] - p2[0]) * b) / d, (a * (p3[1] - p4[1]) - (p1[1] - p2[1]) * b) / d];
  }
  function beamOutline(s, dE) {
    const yT = s.HPIED + s.H1;
    const yW = yT + s.H2;
    const side = (sg) => {
      const H3 = sg > 0 ? s.H3D : s.H3G, D3 = sg > 0 ? s.D3D : s.D3G;
      const xt = s.ETALON / 2, xa = s.E1 / 2, xb = s.E2 / 2, xe = s.ETAB / 2;
      const xg = xe - D3, yg = yW + H3;
      const yTopEdge = s.HPOUT + sg * s.PENTPOUT * xe;
      const d = dE / 2;
      const w0 = [xa + d, yT], w1 = [xb + d, yW];
      let pT, pG;
      if (d <= 1e-12) {
        pT = [xa, yT];
        pG = [xb, yW];
      } else {
        pT = inter([xt, s.HPIED], [xa, yT], w0, w1);
        if (s.GDA === 2) {
          pG = [xb + d, yW];
        } else {
          pG = inter([xb, yW], [xg, yg], w0, w1);
        }
      }
      const pts = [[xt, 0], [xt, s.HPIED], pT, pG];
      if (s.GDA === 2 && d > 0) pts.push([Math.min(xg + d, xe), yg]);
      else pts.push([xg, yg]);
      pts.push([xe, yTopEdge - s.HTAB], [xe, yTopEdge]);
      return pts.map(([x, y]) => [sg * x, y]);
    };
    const R = side(1), L = side(-1);
    return [...R, ...L.reverse()];
  }
  function webExtra(b, s, x) {
    const L = b.PORTEE + 2 * b.ABOUT;
    const xx = x <= L / 2 ? x : L - x;
    if (s.GDA === 0 || s.EPAM <= 0) return 0;
    const xa = b.ABOUT + s.EPAM / 2;
    const xb = b.ABOUT + s.LONGOUS;
    if (s.LIN === 0) return xx <= xb ? s.EPAM : 0;
    if (xx <= xa) return s.EPAM;
    if (xx >= xb) return 0;
    return s.EPAM * (xb - xx) / (xb - xa);
  }
  function slabFor(b, ip) {
    const n = b.NPOUT, b0 = b.ENTRAPOUT;
    const isG = ip === 1, isD = ip === n;
    const xl = isG ? -b.slabG.EEXT : -b0 / 2;
    const xr = isD ? b.slabD.EEXT : b0 / 2;
    const HH = isG ? b.slabG.HHOUR : isD ? b.slabD.HHOUR : b.slab.HHOUR;
    return {
      xl,
      xr,
      HHOUR: HH,
      psL: isG ? b.slabG.PENTSUP : b.slab.PENTSUP,
      psR: isD ? b.slabD.PENTSUP : b.slab.PENTSUP,
      piL: isG ? b.slabG.PENTINF : b.slab.PENTINF,
      piR: isD ? b.slabD.PENTINF : b.slab.PENTINF,
      hMidL: isG ? b.slabG.HEXT : b.slab.HAXE,
      hMidR: isD ? b.slabD.HEXT : b.slab.HAXE,
      cantL: isG,
      cantR: isD
    };
  }
  function slabPolygon(s, g) {
    const top = s.HPOUT;
    const e2 = s.ETAB / 2;
    const yTop = (x) => top + g.HHOUR + (x >= 0 ? g.psR : g.psL) * x;
    const yTab = (x) => top + s.PENTPOUT * x;
    const yLine = (x) => {
      const right = x > 0, xm = right ? g.xr : g.xl;
      return yTop(xm) - (right ? g.hMidR : g.hMidL) + (right ? g.piR : g.piL) * (x - xm);
    };
    const bot = [];
    if (g.xl < -e2 - 1e-9) {
      bot.push([g.xl, yLine(g.xl)]);
      bot.push([-e2, yLine(-e2 - 1e-12)]);
    }
    bot.push([Math.max(g.xl, -e2), yTab(Math.max(g.xl, -e2))]);
    bot.push([0, yTab(0)]);
    bot.push([Math.min(g.xr, e2), yTab(Math.min(g.xr, e2))]);
    if (g.xr > e2 + 1e-9) {
      bot.push([e2, yLine(e2 + 1e-12)]);
      bot.push([g.xr, yLine(g.xr)]);
    }
    return [...bot, [g.xr, yTop(g.xr)], [0, yTop(0)], [g.xl, yTop(g.xl)]];
  }

  // src/engine/env.ts
  var envVar = (k) => typeof globalThis !== "undefined" && globalThis.process?.env ? globalThis.process.env[k] : void 0;

  // src/engine/transverse.ts
  function layout(bd) {
    const X3 = bd.ETROTG + bd.EGAU, X6 = X3 + bd.ESURCH;
    const width = X6 + bd.EDROI + bd.ETROTD;
    const x1 = X3 + bd.ESURCH / 2 - bd.DPOUT1;
    const xBeam = Array.from({ length: bd.NPOUT }, (_, i) => x1 + i * bd.ENTRAPOUT);
    const xc = x1 + (bd.NPOUT - 1) * bd.ENTRAPOUT / 2;
    const b = bd.NPOUT * bd.ENTRAPOUT / 2;
    let NV = bd.NVOIE;
    if (!NV) {
      NV = Math.floor(bd.ESURCH / 3 + 1e-9);
      if (bd.ESURCH >= 5 && bd.ESURCH < 6) NV = 2;
      if (NV < 1) NV = 1;
    }
    NV = Math.min(NV, 10);
    return { width, X3, X6, xBeam, xc, b, NV, v: bd.ESURCH / NV };
  }
  var ALPHA_CAL = envVar("ACAL") ? +envVar("ACAL") : 0.99065;

  // src/engine/cables.ts
  var GR = Math.PI / 200;
  var SIGMODE = "exp";
  function hermite(x0, y0, s0, x1, y1, s1, x) {
    const h = x1 - x0, t = (x - x0) / h;
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t, h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
    const d00 = 6 * t * t - 6 * t, d10 = 3 * t * t - 4 * t + 1, d01 = -6 * t * t + 6 * t, d11 = 3 * t * t - 2 * t;
    return { y: h00 * y0 + h10 * h * s0 + h01 * y1 + h11 * h * s1, d: (d00 * y0 + d10 * h * s0 + d01 * y1 + d11 * h * s1) / h };
  }
  function buildCable(bd, cab, def, idx) {
    const sys = bd.systems.find((s) => s.ARMA === def.ARMA) ?? bd.systems[0];
    const nFam1 = cab.NCAB11 + cab.NCAB12;
    const family = idx < nFam1 ? 1 : 2;
    const stage = idx < cab.NCAB11 ? 1 : idx < nFam1 ? 2 : 3;
    const ords = cab.ordonnees[idx];
    const Dx = cab.abscisses;
    const t0 = Math.tan(def.ANGSOR * GR);
    const xmid = bd.ABOUT + bd.PORTEE / 2;
    const pts = Dx.map((x, i) => ({ x, y: ords[i] })).filter((p) => p.y > 0 && p.x >= def.ABSOR - 1e-9);
    const first = pts[0];
    const yAt = (x) => first.y + t0 * (first.x - x);
    const xExit = def.ABSOR, yExit = yAt(def.ABSOR);
    const yDeco = yAt(def.ABDECO);
    const inner = pts.filter((p) => p.x > def.ABDECO + 1e-9 && p.x < def.ABFICO - 1e-9);
    const nodes = [{ x: def.ABDECO, y: yDeco, s: -t0 }, ...inner.map((p) => ({ x: p.x, y: p.y, s: 0 })), { x: def.ABFICO, y: def.ORFICO, s: 0 }];
    const n = nodes.length;
    const ch = (i) => (nodes[i + 1].y - nodes[i].y) / (nodes[i + 1].x - nodes[i].x);
    for (let i = 1; i < n - 1; i++) {
      if (i === 1) nodes[i].s = 2 * ch(0) - nodes[0].s;
      else {
        const h0 = nodes[i].x - nodes[i - 1].x, h1 = nodes[i + 1].x - nodes[i].x;
        nodes[i].s = (ch(i - 1) * h1 + ch(i) * h0) / (h0 + h1);
      }
    }
    const evalV = (x) => {
      const xx = Math.min(x, 2 * xmid - x);
      if (xx <= def.ABDECO) return { y: yAt(xx), d: -t0 };
      if (xx >= def.ABFICO) return { y: def.ORFICO, d: 0 };
      for (let i = 0; i < n - 1; i++) if (xx <= nodes[i + 1].x + 1e-12) return hermite(nodes[i].x, nodes[i].y, nodes[i].s, nodes[i + 1].x, nodes[i + 1].y, nodes[i + 1].s, xx);
      return { y: def.ORFICO, d: 0 };
    };
    const H = def.EXTRAN, x0h = def.ABDEHO, x1h = def.ABFIHO, Dh = x1h - x0h, xmh = (x0h + x1h) / 2;
    const zpOf = (x) => {
      const xx = Math.min(x, 2 * xmid - x);
      if (H === 0 || xx <= x0h || xx >= x1h) return 0;
      const c = 2 * H / (Dh * Dh);
      return xx <= xmh ? 2 * c * (xx - x0h) : 2 * c * (x1h - xx);
    };
    const angH = (x) => Math.atan(zpOf(x)) / GR;
    const hTot = H === 0 ? 0 : 2 * Math.atan(2 * H / Dh);
    const hLeft = (x) => H === 0 || x <= x0h ? 0 : x >= x1h ? hTot : hTot * (x - x0h) / Dh;
    const hCum = (x) => x <= xmid ? hLeft(x) : 2 * hLeft(xmid) - hLeft(2 * xmid - x);
    const keyL = [xExit, def.ABDECO, ...inner.map((p) => p.x), def.ABFICO].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const angleAt = (x) => Math.atan(Math.abs(evalV(x).d));
    const vCum = (x) => {
      const a0 = Math.atan(t0);
      if (x <= xmid) return a0 - angleAt(x);
      return a0 + angleAt(x);
    };
    const chordNodes = [xExit, ...keyL.filter((x) => x > xExit), xmid].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const sLen = (x) => {
      let s = 0, px = xExit, py = evalV(xExit).y;
      for (const nx of chordNodes) {
        if (nx <= xExit) continue;
        const xx = Math.min(nx, x);
        const yy = evalV(xx).y;
        s += Math.hypot(xx - px, yy - py);
        px = xx;
        py = yy;
        if (nx >= x) break;
      }
      return s;
    };
    const sig0 = def.SIGP0 || sys.SIGP0 || Math.min(0.8 * sys.FPRG, 0.9 * sys.FPEG);
    const area = def.SECAB || sys.SECAB;
    const nodesX = [...keyL, xmid];
    const nodeData = nodesX.map((x) => ({ x, s: sLen(x), alpha: vCum(x) + hCum(x) }));
    const allNodes = [...nodeData, ...nodeData.slice(0, -1).reverse().map((nd) => ({ x: 2 * xmid - nd.x, s: 2 * nodeData[nodeData.length - 1].s - nd.s, alpha: 2 * nodeData[nodeData.length - 1].alpha - nd.alpha }))];
    const vInterp = (x) => {
      for (let i = 0; i + 1 < nodeData.length; i++) {
        const a = nodeData[i], b = nodeData[i + 1];
        if (x <= b.x + 1e-12) {
          const t = (x - a.x) / (b.x - a.x || 1);
          return vCum(a.x) + t * (vCum(b.x) - vCum(a.x));
        }
      }
      return vCum(xmid);
    };
    const interp = (x) => {
      for (let i = 0; i + 1 < allNodes.length; i++) {
        const a = allNodes[i], b = allNodes[i + 1];
        if (x >= a.x - 1e-12 && x <= b.x + 1e-12) {
          const t = (x - a.x) / (b.x - a.x || 1);
          return { s: a.s + t * (b.s - a.s), alpha: a.alpha + t * (b.alpha - a.alpha) };
        }
      }
      return { s: allNodes[allNodes.length - 1].s, alpha: allNodes[allNodes.length - 1].alpha };
    };
    const sigE = (x) => {
      const { s, alpha } = interp(x);
      return sig0 * Math.exp(-(sys.F * alpha + sys.PHI * s));
    };
    const sigNode = allNodes.map((nd) => sig0 * Math.exp(-(sys.F * nd.alpha + sys.PHI * nd.s)));
    const sigL = (x) => {
      for (let i = 0; i + 1 < allNodes.length; i++) {
        const a = allNodes[i], b = allNodes[i + 1];
        if (x >= a.x - 1e-12 && x <= b.x + 1e-12) {
          const s = interp(x).s;
          const t = (s - a.s) / (b.s - a.s || 1);
          return sigNode[i] + t * (sigNode[i + 1] - sigNode[i]);
        }
      }
      return sigNode[sigNode.length - 1];
    };
    const sigF = SIGMODE === "exp" ? sigE : sigL;
    const gEp = sys.RECUL * sys.EP;
    const areaTo = (xl) => {
      const xs = [...allNodes.map((a) => a.x).filter((v) => v > xExit + 1e-9 && v < xl - 1e-9), xl];
      let r = 0, px = xExit;
      const sfl = sigL(xl);
      for (const nx of xs) {
        r += 2 * ((sigL(px) + sigL(nx)) / 2 - sfl) * (interp(nx).s - interp(px).s);
        px = nx;
      }
      return r;
    };
    let lambda;
    let dTM = 0;
    if (areaTo(xmid) < gEp) {
      lambda = xmid;
      dTM = (gEp - areaTo(xmid)) / (interp(xmid).s - interp(xExit).s);
    } else {
      let lo = xExit, hi = xmid;
      for (let it = 0; it < 60; it++) {
        const m = (lo + hi) / 2;
        if (areaTo(m) < gEp) lo = m;
        else hi = m;
      }
      lambda = (lo + hi) / 2;
    }
    const sigLam = sigE(lambda);
    const sigAfter = (x) => {
      const xx = Math.min(x, 2 * xmid - x);
      const sf = xx <= xExit ? sig0 : sig0 * Math.exp(-(sys.F * (vCum(xx) + interp(xx).alpha - vInterp(xx)) + sys.PHI * interp(xx).s));
      const sb = xx < lambda || dTM > 0 ? 2 * sigLam - sf - dTM : sf;
      return { f: sf - sig0, c: sb - sf, sig: sb };
    };
    const diagX = [...keyL, lambda, xmid].filter((v, i, a) => a.findIndex((w) => Math.abs(w - v) < 1e-6) === i).sort((a, b) => a - b);
    const diag = diagX.map((x) => {
      const { s, alpha } = interp(x);
      const sf = sigF(x);
      return { x, s, alpha, sig0: sf, sigBlock: x < lambda ? 2 * sigLam - sf : sf };
    });
    let allong = 0;
    {
      const N = 400;
      for (let i = 0; i < N; i++) {
        const x1 = xExit + (xmid - xExit) * i / N, x2 = xExit + (xmid - xExit) * (i + 1) / N;
        allong += (sigF(x1) + sigF(x2)) / 2 * (interp(x2).s - interp(x1).s);
      }
      allong /= sys.EP;
    }
    return {
      def,
      sys,
      family,
      stage,
      nodes,
      xExit,
      yExit,
      slope0: t0,
      y: (x) => evalV(x).y,
      yp: (x) => evalV(x).d,
      zp: zpOf,
      angleV: (x) => Math.atan(Math.abs(evalV(x).d)) / GR,
      angleH: angH,
      exists: (x) => {
        const xx = Math.min(x, 2 * xmid - x);
        return xx >= xExit - 1e-9;
      },
      diag,
      lambda,
      allongement: allong,
      sigAfter,
      sigP0: sig0,
      area,
      _dbg: (x) => ({ s: interp(x).s, alpha: interp(x).alpha, h: interp(x).alpha - vInterp(x) })
    };
  }

  // src/web/sketches.ts
  var r1 = (v) => Math.round(v * 10) / 10;
  var SW = 460;
  var esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  var num = (v, d = 3) => Number.isInteger(v) && d <= 2 ? String(v) : (+v).toFixed(d);
  var CLIP = 0;
  var SCHEMA = false;
  var VALS = null;
  var VONLY = false;
  function asValues(fn) {
    VONLY = true;
    try {
      return fn();
    } finally {
      VONLY = false;
    }
  }
  var DW = 860;
  var KS = 1;
  function setDrawScale(k) {
    KS = Math.max(0.3, Math.min(1, k));
  }
  function setDrawWidth(w) {
    DW = Math.max(360, Math.min(1e3, Math.round(w)));
  }
  function asSchema(fn, vals) {
    SCHEMA = true;
    VALS = vals ?? null;
    try {
      return fn();
    } finally {
      SCHEMA = false;
      VALS = null;
    }
  }
  var KEYNAME = { W: "largeur totale", Lt: "longueur des poutres" };
  var Sk = class {
    constructor(x0, x1, y0, y1, sx, sy, pad = { l: 30, r: 30, t: 30, b: 30 }, hl = "") {
      this.x0 = x0;
      this.x1 = x1;
      this.y0 = y0;
      this.y1 = y1;
      this.sx = sx;
      this.sy = sy;
      this.pad = pad;
      this.hl = hl;
      this.parts = [];
      this.top = [];
      this.schema = SCHEMA;
      this.vals = VALS;
      this.vonly = VONLY;
      this.X = (x) => this.pad.l + (x - this.x0) * this.sx;
      this.Y = (y) => this.pad.t + (this.y1 - y) * this.sy;
      this.pts = (p) => p.map(([x, y]) => `${r1(this.X(x))},${r1(this.Y(y))}`).join(" ");
      this.sx = sx * KS;
      this.sy = sy * KS;
    }
    // vonly : cotes chiffrées seules, sans nom
    /** libellé de cote : en schéma, le code du paramètre seul */
    lab(label, key = "") {
      if (label === "") return "";
      if (this.vonly) {
        const m = label.match(/(?:^|\s)(-?\d[\d.,]*(?:\s*(?:m|%))?)/);
        return m ? m[1] : "";
      }
      if (!this.schema) return label;
      const k = key.split("|")[0];
      const code = k ? KEYNAME[k] ?? k.split(".").pop() : "";
      if (code) {
        const v = this.vals?.(key);
        return v !== void 0 ? `${code} = ${v}` : code;
      }
      return label.replace(/\s*[-+]?\d[\d.,]*\s*(m|gr|%|MPa)?\s*$/, "").trim();
    }
    get W() {
      return Math.ceil(this.pad.l + (this.x1 - this.x0) * this.sx + this.pad.r);
    }
    get H() {
      return Math.ceil(this.pad.t + (this.y1 - this.y0) * this.sy + this.pad.b);
    }
    poly(p, cls) {
      this.parts.push(`<polygon class="${cls}" points="${this.pts(p)}"/>`);
    }
    pline(p, cls) {
      this.parts.push(`<polyline class="${cls}" points="${this.pts(p)}"/>`);
    }
    line(xa, ya, xb, yb, cls) {
      this.lineP(this.X(xa), this.Y(ya), this.X(xb), this.Y(yb), cls);
    }
    lineP(xa, ya, xb, yb, cls, front = false) {
      (front ? this.top : this.parts).push(`<line class="${cls}" x1="${r1(xa)}" y1="${r1(ya)}" x2="${r1(xb)}" y2="${r1(yb)}"/>`);
    }
    text(px, py, s, cls = "tx", anchor = "middle", front = true) {
      if (this.schema && !/\bbnt\b/.test(cls)) {
        const m = s.match(/^([A-Z][A-Z0-9]+(?: [A-Z][A-Z0-9]+)?)\s+[-+]?\d/);
        if (m) s = m[1];
        else if (/^[-+]?\d[\d.,]*(\s*(m|gr|%))?$/.test(s)) s = "";
      }
      if (this.vonly && !/\bbnt\b/.test(cls)) {
        const cv = s.match(/^[A-Z][A-Z0-9]*(?: [A-Z][A-Z0-9]*)?\s+([+-]?\d[\d.,]*(?:\s*(?:m|%|gr))?)\s*$/);
        s = cv ? cv[1] : /^[+-]?\d[\d.,]*(\s*(m|%|gr))?$/.test(s.trim()) ? s.trim() : "";
      }
      if (!s) return;
      if (this.schema && this.vals && !/\bbnt\b/.test(cls)) s = s.replace(/(^|[\s(·,/])([A-Z][A-Z0-9]*)(?=$|[),·/]|\s(?!=))/g, (m, pre, c) => {
        const v = this.vals(c);
        return v !== void 0 ? `${pre}${c} = ${v}` : m;
      });
      (front ? this.top : this.parts).push(`<text class="${cls}" x="${r1(px)}" y="${r1(py)}" text-anchor="${anchor}">${esc(s)}</text>`);
    }
    circleP(px, py, rad, cls) {
      this.parts.push(`<circle class="${cls}" cx="${r1(px)}" cy="${r1(py)}" r="${r1(rad)}"/>`);
    }
    isHl(key) {
      if (!key || !this.hl) return false;
      const last = this.hl.split(".").pop();
      return key.split("|").some((k) => k === this.hl || k === last);
    }
    /** cote horizontale entre xa et xb, tracée dy px sous (dy>0) ou sur (dy<0) le point d'attache yA (modèle) */
    dimH(xa, xb, yA, dy, label, key = "", yB = yA, prefer) {
      if (Math.abs(xb - xa) < 1e-6) return;
      label = this.lab(label, key);
      const h = this.isHl(key), c = h ? "dim hl" : "dim";
      const pa = this.X(xa), pb = this.X(xb), py = Math.max(this.Y(yA), this.Y(yB)) * (dy > 0 ? 1 : 0) + Math.min(this.Y(yA), this.Y(yB)) * (dy > 0 ? 0 : 1) + dy;
      this.lineP(pa, this.Y(yA) + Math.sign(dy) * 3, pa, py + Math.sign(dy) * 4, "ext", true);
      this.lineP(pb, this.Y(yB) + Math.sign(dy) * 3, pb, py + Math.sign(dy) * 4, "ext", true);
      this.lineP(pa, py, pb, py, c, true);
      for (const p of [pa, pb]) this.lineP(p - 3, py + 3, p + 3, py - 3, c, true);
      const w = label.length * 6.9, fits = Math.abs(pb - pa) > w + 6;
      const mx = (pa + pb) / 2;
      const right = prefer ? prefer === "r" : Math.max(pa, pb) + 4 + w < this.W - 2;
      this.text(fits ? mx : right ? Math.max(pa, pb) + 4 : Math.min(pa, pb) - 4, py - 4, label, h ? "tx dl cote hl" : "tx dl cote", fits ? "middle" : right ? "start" : "end");
    }
    /** cote verticale entre ya et yb, à dx px à droite (dx>0) ou à gauche du point d'attache x */
    dimV(ya, yb, x, dx, label, key = "", side = dx > 0 ? "r" : "l") {
      if (Math.abs(yb - ya) < 1e-6) return;
      label = this.lab(label, key);
      const h = this.isHl(key), c = h ? "dim hl" : "dim";
      const px = this.X(x) + dx, pa = this.Y(ya), pb = this.Y(yb);
      this.lineP(this.X(x) + Math.sign(dx) * 3, pa, px + Math.sign(dx) * 4, pa, "ext", true);
      this.lineP(this.X(x) + Math.sign(dx) * 3, pb, px + Math.sign(dx) * 4, pb, "ext", true);
      this.lineP(px, pa, px, pb, c, true);
      for (const p of [pa, pb]) this.lineP(px - 3, p + 3, px + 3, p - 3, c, true);
      const my = (pa + pb) / 2 + 4;
      this.text(side === "r" ? px + 5 : px - 5, my, label, h ? "tx dl cote hl" : "tx dl cote", side === "r" ? "start" : "end");
    }
    svg(title, aria = title) {
      return `<figure class="skf${this.schema ? " sch" : ""}"><figcaption>${this.schema ? "Sch\xE9ma de principe \u2014 " : ""}${esc(title)}</figcaption><svg viewBox="0 0 ${this.W} ${this.H}" style="max-width:${this.W}px;margin:0 auto" role="img" aria-label="${esc(aria)}"><defs><pattern id="hx" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hxb" width="6" height="6"/><line class="hxl" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>${this.parts.join("")}${this.top.join("")}</svg></figure>`;
    }
  };
  var shapeOf = (bd, ip) => ip === 1 && bd.TYPOURI[0] === 0 || ip === bd.NPOUT && bd.TYPOURI[1] === 0 ? bd.beamRive ?? bd.beam : bd.beam;
  var crossOf = (bd, ip) => ip === 1 ? bd.slabG.cross : ip === bd.NPOUT ? bd.slabD.cross : bd.cross;
  var tr = (p, dx, dy = 0) => p.map(([x, y]) => [x + dx, y + dy]);
  var shiftY = (bd, s) => bd.beam.HPOUT - s.HPOUT;
  function deck(bd) {
    const L = layout(bd);
    const ready = bd.NPOUT >= 1 && bd.beam.HPOUT > 0 && bd.beam.ETAB > 0 && (bd.NPOUT === 1 || bd.ENTRAPOUT > 0);
    if (!ready) L.xBeam = [];
    const raw = L.xBeam.map((x, i) => {
      const ip = i + 1, s = shapeOf(bd, ip);
      return { ip, x, s, g: slabFor(bd, ip), dy: shiftY(bd, s) };
    });
    const top = (r, xr) => r.s.HPOUT + r.dy + r.g.HHOUR + (xr >= 0 ? r.g.psR : r.g.psL) * xr;
    for (let i = 1; i < raw.length; i++) {
      const a = raw[i - 1], b = raw[i], xm = (b.x - a.x) / 2;
      b.dy += top(a, xm) - top(b, -xm);
    }
    const m = Math.min(...raw.map((r) => r.dy));
    raw.forEach((r) => r.dy -= m);
    const beams = raw.map(({ ip, x, s, g, dy }) => ({ ip, x, dy, s, outline: tr(beamOutline(s, 0), x, dy), slab: tr(slabPolygon(s, g), x, dy), xl: x + g.xl, xr: x + g.xr }));
    const topAt = (x) => {
      if (!beams.length) return bd.slab.PENTSUP * (x - L.X3 - bd.ESURCH / 2);
      const b = beams.find((b2) => x >= b2.xl - 1e-9 && x <= b2.xr + 1e-9) ?? (x < beams[0].xl ? beams[0] : beams[beams.length - 1]);
      const g = slabFor(bd, b.ip), xx = Math.max(g.xl, Math.min(g.xr, x - b.x));
      return b.s.HPOUT + b.dy + g.HHOUR + (xx >= 0 ? g.psR : g.psL) * xx;
    };
    return { L, beams, topAt };
  }
  function drawSlab(sk, slabs) {
    for (const p of slabs) sk.poly(p, "slabf");
    const topLine = [];
    slabs.forEach((p, i) => {
      const bot = p.slice(0, -3), tp = p.slice(-3).reverse();
      sk.pline(bot, "slabl");
      topLine.push(...i ? tp.slice(1) : tp);
      if (i === 0) sk.line(bot[0][0], bot[0][1], tp[0][0], tp[0][1], "slabl");
      if (i === slabs.length - 1) sk.line(bot[bot.length - 1][0], bot[bot.length - 1][1], tp[tp.length - 1][0], tp[tp.length - 1][1], "slabl");
    });
    sk.pline(topLine, "slabl");
  }
  function crossSection(bd, hl, mode = "geo") {
    const D = deck(bd), { L } = D;
    const xmin = Math.min(0, D.beams[0].xl), xmax = Math.max(L.width, D.beams[D.beams.length - 1].xr);
    const ymax = Math.max(...D.beams.map((b) => b.s.HPOUT + b.dy)) + 0.6, ymin = Math.min(...D.beams.map((b) => b.dy));
    const sx = SW / Math.max(1, xmax - xmin);
    const sk = new Sk(xmin, xmax, ymin, ymax, sx, sx, { l: 24, r: 86, t: mode === "charges" ? 58 : 50, b: 84 }, hl);
    for (const b of D.beams) sk.poly(b.outline, "beam");
    drawSlab(sk, D.beams.map((b) => b.slab));
    const pv = 0.18;
    const strip = (a, c, cls) => {
      if (c - a < 1e-6) return;
      const n = 12, p = [];
      for (let i = 0; i <= n; i++) {
        const x2 = a + (c - a) * i / n;
        p.push([x2, D.topAt(x2)]);
      }
      for (let i = n; i >= 0; i--) {
        const x2 = a + (c - a) * i / n;
        p.push([x2, D.topAt(x2) + pv]);
      }
      sk.poly(p, cls);
    };
    strip(0, bd.ETROTG, "trot");
    strip(L.width - bd.ETROTD, L.width, "trot");
    const yc = (x2) => D.topAt(x2) + 0.08;
    sk.pline([[L.X3, yc(L.X3)], [L.X6, yc(L.X6)]].map(([x2]) => [x2, yc(x2)]), "road");
    for (let i = 1; i < L.NV; i++) {
      const x2 = L.X3 + i * L.v;
      sk.line(x2, yc(x2), x2, yc(x2) + 0.25, "lane");
    }
    for (let i = 0; i < L.NV; i++) {
      const x2 = L.X3 + (i + 0.5) * L.v;
      sk.text(sk.X(x2), sk.Y(yc(x2)) - 6, `voie ${i + 1}`, "tx sm mute");
    }
    const barrier = (x2, key, lbl) => {
      const y = D.topAt(x2), h = 0.55, w = 0.16;
      const c = sk.isHl(key) ? "bar hl" : "bar";
      sk.poly([[x2 - w, y], [x2 + w, y], [x2 + w * 0.45, y + h], [x2 - w * 0.45, y + h]], c);
    };
    if (bd.PBAGMAX > 0 || bd.DBAG > 0) barrier(L.X3 - bd.DBAG, "DBAG|PBAGMAX|PBAGMIN", `${num(bd.PBAGMAX)} t/m`);
    if (bd.PBADMAX > 0 || bd.DBAD > 0) barrier(L.X6 + bd.DBAD, "DBAD|PBADMAX|PBADMIN", `${num(bd.PBADMAX)} t/m`);
    const xa = L.X3 + bd.ESURCH / 2;
    sk.line(xa, ymin - 0.15, xa, D.topAt(xa) + 0.5, "axis");
    const yT = Math.max(...[0, L.X3, L.X6, L.width].map((x2) => D.topAt(x2))) + pv;
    const geoDims = !(sk.schema && mode === "charges");
    let x = 0;
    if (geoDims) {
      for (const [k, w] of [["ETROTG", bd.ETROTG], ["EGAU", bd.EGAU], ["ESURCH", bd.ESURCH], ["EDROI", bd.EDROI], ["ETROTD", bd.ETROTD]]) {
        const narrow = (sk.schema ? 1.6 : 1.2) > w;
        sk.dimH(x, x + w, yT, -(mode === "charges" ? 26 : 18), w < 1.2 ? num(w, 2) : `${k} ${num(w, 2)}`, k, yT, narrow ? k === "EGAU" ? "r" : k === "EDROI" ? "l" : void 0 : void 0);
        x += w;
      }
      sk.dimH(0, L.width, yT, -(mode === "charges" ? 44 : 36), `largeur ${num(L.width, 2)} m`, "W");
    }
    if (mode === "charges") {
      if (bd.DBAG > 0) sk.dimH(L.X3 - bd.DBAG, L.X3, D.topAt(L.X3), 22 + 0, `DBAG ${num(bd.DBAG, 2)}`, "DBAG");
      if (bd.DBAD > 0) sk.dimH(L.X6, L.X6 + bd.DBAD, D.topAt(L.X6), 22, `DBAD ${num(bd.DBAD, 2)}`, "DBAD");
    }
    for (const b of D.beams) {
      const on = mode === "calc" && bd.poutresACalculer.includes(b.ip);
      sk.circleP(sk.X(b.x), sk.Y(ymin) + 15, 9, on ? "bn on" : "bn");
      sk.text(sk.X(b.x), sk.Y(ymin) + 19, String(b.ip), on ? "tx bnt on" : "tx bnt");
    }
    const b0 = D.beams[0], bn = D.beams[D.beams.length - 1];
    if (geoDims) {
      sk.dimH(b0.xl, b0.x, ymin, 42, `EEXT ${num(bd.slabG.EEXT, 2)}`, "slabG.EEXT|EEXT");
      for (let i = 0; i + 1 < D.beams.length; i++) sk.dimH(D.beams[i].x, D.beams[i + 1].x, ymin, 42, i === 0 ? `ENTRAPOUT ${num(bd.ENTRAPOUT, 2)}` : num(bd.ENTRAPOUT, 2), "ENTRAPOUT");
      sk.dimH(bn.x, bn.xr, ymin, 42, `EEXT ${num(bd.slabD.EEXT, 2)}`, "slabD.EEXT|EEXT");
      sk.dimH(b0.x, xa, ymin, 64, `DPOUT1 ${num(bd.DPOUT1, 3)}`, "DPOUT1");
      sk.dimV(bn.dy, bn.s.HPOUT + bn.dy, bn.xr, 14, `HPOUT ${num(bd.beam.HPOUT, 2)}`, "beam.HPOUT|HPOUT");
    }
    const hT = D.topAt(bn.xr);
    void hT;
    if (mode === "charges") {
      const T = (px, py, t, key, a = "middle") => sk.text(px, py, t, sk.isHl(key) ? "tx dl hl" : "tx dl", a);
      const lead = (x1, y1, x2, y2) => sk.lineP(x1, y1, x2, y2, "lead", true);
      const arrows = (a, c, key) => {
        if (c - a < 1e-6) return;
        const n = Math.max(2, Math.round((c - a) / 0.5));
        for (let i = 0; i <= n; i++) {
          const xx = a + (c - a) * i / n, py = sk.Y(D.topAt(xx) + pv), cl = sk.isHl(key) ? "dim hl" : "dim";
          sk.lineP(sk.X(xx), py - 14, sk.X(xx), py - 2, cl, true);
          sk.lineP(sk.X(xx) - 2.5, py - 6, sk.X(xx), py - 2, cl, true);
          sk.lineP(sk.X(xx) + 2.5, py - 6, sk.X(xx), py - 2, cl, true);
        }
      };
      arrows(0, bd.ETROTG, "PSTROT");
      arrows(L.width - bd.ETROTD, L.width, "PSTROT");
      const top0 = 16, top1 = 32;
      const sch = sk.schema;
      if (sch && bd.ETROTG > 0) {
        const px = sk.X(bd.ETROTG * 0.3);
        lead(px, sk.Y(D.topAt(bd.ETROTG * 0.3) + pv) - 15, px, top1 + 3);
        T(px - 2, top1, sch ? "PSTROT" : `${num(bd.PSTROT)} t/m\xB2`, "PSTROT", "start");
      }
      if (sch && (bd.PBAGMAX > 0 || bd.DBAG > 0)) {
        const px = sk.X(L.X3 - bd.DBAG), py = sk.Y(D.topAt(L.X3) + 0.55);
        lead(px, py, px, top0 + 3);
        T(px - 2, top0, sch ? "PBAGMAX / PBAGMIN" : `${num(bd.PBAGMAX)} / ${num(bd.PBAGMIN)} t/m`, "PBAGMAX|PBAGMIN|DBAG", "start");
      }
      if (sch && (bd.PBADMAX > 0 || bd.DBAD > 0)) {
        const px = sk.X(L.X6 + bd.DBAD), py = sk.Y(D.topAt(L.X6) + 0.55);
        lead(px, py, px, top1 + 3);
        T(px + 2, top1, sch ? "PBADMAX / PBADMIN" : `${num(bd.PBADMAX)} / ${num(bd.PBADMIN)} t/m`, "PBADMAX|PBADMIN|DBAD", "end");
      }
      if (sch) T(sk.X(xa), sk.Y(D.topAt(xa) + 0.08) - 20, "CLASSE \xB7 A (A1, A2, A3) \xB7 B \xB7 CM \xB7 CE", "CLASSE|A|B|CM|CE|A1|A2|A3");
      if (sch) {
        const yb = sk.H - 26, bm = D.beams[Math.min(D.beams.length - 1, 2)];
        const pxm = sk.X(bm.x) + 4, pym = sk.Y(bm.dy + bm.s.HPOUT * 0.5);
        lead(pxm, pym, pxm + 14, yb - 4);
        T(pxm + 16, yb, "MASVOL \xB7 OSSAMAX P/H \xB7 OSSAMIN P/H", "MASVOL|OSSAMAX|OSSAMIN", "start");
        if (D.beams.length > 1) {
          const xm = (D.beams[0].x + D.beams[1].x) / 2, px = sk.X(xm), py = sk.Y(D.topAt(xm) - bd.slab.HHOUR) + 2;
          lead(px, py, px, sk.H - 10 - 10);
          T(px - 4, sk.H - 10, "PREDALMAX / PREDALMIN (pr\xE9dalles)", "PREDALMAX|PREDALMIN", "start");
        }
      }
      if (sk.schema) return sk.svg("Coupe transversale \u2014 charges", "Coupe transversale avec charges");
      const it = (k, t) => `<span${sk.isHl(k) ? ' class="hl"' : ""}>${esc(t)}</span>`;
      return sk.svg("Coupe transversale \u2014 charges", "Coupe transversale avec barri\xE8res et trottoirs") + `<div class="sk-leg">${[
        it("PBAGMAX|PBAGMIN|DBAG", `Barri\xE8re G : ${num(bd.PBAGMAX)} / ${num(bd.PBAGMIN)} t/m`),
        it("PBADMAX|PBADMIN|DBAD", `Barri\xE8re D : ${num(bd.PBADMAX)} / ${num(bd.PBADMIN)} t/m`),
        it("PSTROT", `Trottoirs : ${num(bd.PSTROT)} t/m\xB2`),
        `<span>${L.NV} voie(s) de ${num(L.v, 2)} m</span>`
      ].join("")}</div>`;
    }
    return sk.svg("Coupe transversale", "Coupe transversale du tablier cot\xE9e");
  }
  function spanViews(bd, hl, opt = {}) {
    const Lt = bd.PORTEE + 2 * bd.ABOUT, b = bd.beam, H = b.HPOUT, hs = bd.slab.HHOUR, mid = Lt / 2;
    const TW = DW - 20, sx = TW / (Lt + 1.4), sy = Math.min((opt.h ?? 150) / (H + hs), sx * 8), ex = sy / sx;
    const sk = new Sk(-0.7, Lt + 0.7, -1, H + hs + 0.12, sx, sy, { l: 84, r: 96, t: 46, b: 72 }, hl);
    const yT = b.HPIED + b.H1, yW = yT + b.H2;
    for (const xs of [bd.ABOUT, Lt - bd.ABOUT]) {
      const outside = xs < mid ? -1 : 1;
      sk.poly([[xs - 0.9 * (outside < 0 ? 1.4 : 1), -1], [xs + 0.9 * (outside > 0 ? 1.4 : 1), -1], [xs + 0.9 * (outside > 0 ? 1.4 : 1), -0.1], [xs - 0.9 * (outside < 0 ? 1.4 : 1), -0.1]].map(([x, y]) => [Math.max(-0.7, Math.min(Lt + 0.7, x)), y]), "pier");
      sk.poly([[xs - 0.2, -0.1], [xs + 0.2, -0.1], [xs + 0.2, 0], [xs - 0.2, 0]], "pad");
      sk.line(xs, -1, xs, H + hs + 0.12, "axis");
    }
    sk.poly([[0, 0], [Lt, 0], [Lt, H], [0, H]], "beam");
    sk.line(0, yT, Lt, yT, "hid");
    sk.line(0, yW, Lt, yW, "hid");
    if (b.GDA > 0 && b.EPAM > 0) {
      const xg = bd.ABOUT + b.LONGOUS, key = "beam.EPAM|beam.LONGOUS|EPAM|LONGOUS";
      for (const [a, c] of [[0, Math.min(xg, mid)], [Math.max(Lt - xg, mid), Lt]]) sk.poly([[a, yT], [c, yT], [c, yW], [a, yW]], sk.isHl(key) ? "gous hl" : "gous");
      sk.text(sk.X((bd.ABOUT + Math.min(xg, mid)) / 2 + 1), sk.Y((yT + yW) / 2) + 4, `\xE2me \xE9paissie sur ${num(b.LONGOUS, 2)} m`, sk.isHl(key) ? "tx sm hl" : "tx sm");
    }
    sk.poly([[0, H], [Lt, H], [Lt, H + hs], [0, H + hs]], "slab");
    sk.poly([[0, H + hs], [Lt, H + hs], [Lt, H + hs + 0.08], [0, H + hs + 0.08]], "rev");
    const ent = (xc, w, depth, key) => {
      if (depth <= 0) return;
      const ww = Math.max(w, 0.3);
      sk.poly([[xc - ww / 2, Math.max(0.05, H - depth)], [xc + ww / 2, Math.max(0.05, H - depth)], [xc + ww / 2, H], [xc - ww / 2, H]], sk.isHl(key) ? "ent hl" : "ent");
    };
    ent(bd.ABOUT, bd.ENTAPP, bd.HENTA, "ENTAPP|HENTA");
    ent(Lt - bd.ABOUT, bd.ENTAPP, bd.HENTA, "ENTAPP|HENTA");
    const ni = Math.max(0, bd.NE - 2);
    for (let i = 1; i <= ni; i++) ent(bd.ABOUT + bd.PORTEE * i / (ni + 1), bd.ENTINT, bd.HENTI, "ENTINT|HENTI|NE");
    for (const xj of [0, Lt]) sk.lineP(sk.X(xj), sk.Y(H + hs + 0.08) - 2, sk.X(xj), sk.Y(H + hs + 0.08) + 8, "joint", true);
    sk.line(mid, -0.3, mid, H + hs + 0.12, "axis");
    sk.text(sk.X(mid) + 4, sk.Y(-0.3) - 4, "mi-trav\xE9e", "tx sm mute", "start");
    sk.text(sk.X(bd.ABOUT) + 4, sk.Y(-1) - 6, "axe d'appui", "tx sm mute", "start");
    sk.dimH(0, bd.ABOUT, -1, 22, `ABOUT ${num(bd.ABOUT, 2)}`, "ABOUT", -1, "l");
    sk.dimH(bd.ABOUT, Lt - bd.ABOUT, -1, 22, `PORTEE ${num(bd.PORTEE, 2)} m`, "PORTEE");
    sk.dimH(Lt - bd.ABOUT, Lt, -1, 22, `ABOUT ${num(bd.ABOUT, 2)}`, "ABOUT", -1, "r");
    sk.dimH(0, Lt, -1, 46, `longueur des poutres ${num(Lt, 2)} m`, "Lt");
    if (bd.ENTAPP > 0) sk.dimH(bd.ABOUT - Math.max(bd.ENTAPP, 0.3) / 2, bd.ABOUT + Math.max(bd.ENTAPP, 0.3) / 2, H + hs + 0.08, -12, `ENTAPP ${num(bd.ENTAPP, 2)}`, "ENTAPP", H + hs + 0.08, "r");
    if (ni > 0 && bd.ENTINT > 0) {
      const xi = bd.ABOUT + bd.PORTEE / (ni + 1);
      sk.dimH(xi - Math.max(bd.ENTINT, 0.3) / 2, xi + Math.max(bd.ENTINT, 0.3) / 2, H + hs + 0.08, -12, `ENTINT ${num(bd.ENTINT, 2)}`, "ENTINT", H + hs + 0.08, "r");
    }
    sk.text(sk.X(bd.ABOUT + bd.PORTEE * 0.3), sk.Y(H + hs + 0.08) - 28, sk.schema ? "NE entretoises (abouts compris)" : `NE = ${bd.NE} entretoises (abouts compris)`, sk.isHl("NE") ? "tx dl hl" : "tx sm mute");
    sk.dimV(0, H, Lt, 18, `HPOUT ${num(H, 2)}`, "beam.HPOUT|HPOUT");
    sk.dimV(H, H + hs, Lt, 18, `HHOUR ${num(hs, 2)}`, "slab.HHOUR|HHOUR");
    if (bd.HENTA > 0) sk.dimV(Math.max(0.05, H - bd.HENTA), H, 0, -10, `HENTA ${num(bd.HENTA, 2)}`, "HENTA", "l");
    if (ni > 0 && bd.HENTI > 0) {
      const xi = bd.ABOUT + bd.PORTEE / (ni + 1);
      sk.dimV(Math.max(0.05, H - bd.HENTI), H, xi + Math.max(bd.ENTINT, 0.3) / 2, 8, `HENTI ${num(bd.HENTI, 2)}`, "HENTI");
    }
    sk.text(sk.W - 8, 14, `\xE9chelle des hauteurs \xD7${num(ex, 1)}`, "tx sm mute", "end");
    const elev = sk.svg("\xC9l\xE9vation d'une poutre", "\xC9l\xE9vation d'une poutre avec appuis, entretoises et \xE2me \xE9paissie");
    if (opt.plan === false) return elev;
    const Ld = layout(bd), W = Ld.width, phi = (bd.BIAIS || 100) * Math.PI / 200, off = Math.abs(phi - Math.PI / 2) < 1e-9 ? 0 : W / Math.tan(phi);
    const xs0 = Math.min(0, off) - 0.6, xs1 = Math.max(Lt, Lt + off) + 0.6;
    const sp = Math.min(TW / (xs1 - xs0), 240 / W);
    const pl = new Sk(xs0, xs1, 0, W, sp, sp, { l: 110, r: 30, t: 20, b: 46 }, hl);
    const sh = (y) => off * (W - y) / W;
    pl.poly([[sh(0), 0], [Lt + sh(0), 0], [Lt + sh(W), W], [sh(W), W]], "slab");
    for (const xc of [Ld.X3, Ld.X6]) {
      const y = W - xc;
      pl.line(sh(y), y, Lt + sh(y), y, "edge");
    }
    pl.text(pl.X(Lt / 2 + sh(W - Ld.X3)), pl.Y(W - Ld.X3) - 4, "bord de chauss\xE9e", "tx sm mute");
    const entL = (x0, w, key) => {
      const ww = Math.max(w, 0.3);
      pl.poly([[x0 - ww / 2 + sh(0), 0], [x0 + ww / 2 + sh(0), 0], [x0 + ww / 2 + sh(W), W], [x0 - ww / 2 + sh(W), W]], pl.isHl(key) ? "ent hl" : "ent");
    };
    entL(bd.ABOUT, bd.ENTAPP, "ENTAPP|HENTA");
    entL(Lt - bd.ABOUT, bd.ENTAPP, "ENTAPP|HENTA");
    for (let i = 1; i <= ni; i++) entL(bd.ABOUT + bd.PORTEE * i / (ni + 1), bd.ENTINT, "ENTINT|HENTI|NE");
    Ld.xBeam.forEach((xb, k) => {
      const y = W - xb;
      pl.line(sh(y), y, Lt + sh(y), y, "beamline");
      pl.circleP(pl.X(sh(y)) - 16, pl.Y(y), 8, "bn");
      pl.text(pl.X(sh(y)) - 16, pl.Y(y) + 3.5, String(k + 1), "tx bnt");
    });
    for (const xs of [bd.ABOUT, Lt - bd.ABOUT]) pl.line(xs + sh(0), 0, xs + sh(W), W, pl.isHl("BIAIS") ? "supl hl" : "supl");
    const ang = (bd.BIAIS || 100).toFixed(2).replace(".", ",");
    pl.text(pl.X(bd.ABOUT + sh(W / 2)) + 10, pl.Y(W * 0.75), `BIAIS ${ang} gr`, pl.isHl("BIAIS") ? "tx dl hl" : "tx dl", "start");
    pl.dimV(0, W, xs0 + 0.6, -40, `${num(W, 2)} m`, "W");
    pl.dimH(bd.ABOUT + sh(0), Lt - bd.ABOUT + sh(0), 0, 22, `PORTEE ${num(bd.PORTEE, 2)} m`, "PORTEE");
    pl.text(pl.X(xs1) - 4, pl.H - 8, bd.BIAIS && Math.abs(bd.BIAIS - 100) > 1e-6 ? "ouvrage biais : angle entre l'axe et la ligne d'appui" : "ouvrage droit (100 gr)", "tx sm mute", "end");
    return elev + pl.svg("Vue en plan", "Vue en plan du tablier, des poutres et du biais");
  }
  function beamSection(bd, hl, rive = false) {
    const s = rive ? bd.beamRive ?? bd.beam : bd.beam, pre = rive ? "beamRive." : "beam.";
    const k = (c) => `${pre}${c}|${c}`;
    if (!(s.HPOUT > 0 && s.ETAB > 0)) return '<div class="sk-empty">G\xE9om\xE9trie de poutre de rive identique aux poutres interm\xE9diaires.</div>';
    const xe = s.ETAB / 2, sy = 260 / s.HPOUT;
    const sk = new Sk(-xe, xe, 0, s.HPOUT + Math.abs(s.PENTPOUT) * xe, sy, sy, { l: 140, r: 110, t: 38, b: 40 }, hl);
    if (s.GDA > 0 && s.EPAM > 0) sk.poly(beamOutline(s, s.EPAM), sk.isHl(k("EPAM")) || sk.isHl(k("GDA")) ? "thick hl" : "thick");
    sk.poly(beamOutline(s, 0), "beam");
    sk.line(0, -0.05, 0, s.HPOUT + 0.05, "axis");
    const yT = s.HPIED + s.H1, yW = yT + s.H2;
    const xr = xe;
    sk.dimV(0, s.HPIED, xr, 14, `HPIED ${num(s.HPIED, 2)}`, k("HPIED"));
    sk.dimV(s.HPIED, yT, xr, 14, `H1 ${num(s.H1, 2)}`, k("H1"));
    sk.dimV(yT, yW, xr, 14, `H2 ${num(s.H2, 2)}`, k("H2"));
    sk.dimV(yW, yW + s.H3D, xr, 14, `H3D ${num(s.H3D, 2)}`, k("H3D"));
    const yTopR = s.HPOUT + s.PENTPOUT * xe;
    sk.dimV(yTopR - s.HTAB, yTopR, xr, 14, `HTAB ${num(s.HTAB, 2)}`, k("HTAB"));
    sk.dimV(0, s.HPOUT, -xe, -54, `HPOUT ${num(s.HPOUT, 2)}`, k("HPOUT"));
    sk.dimV(yW, yW + s.H3G, -xe, -14, `H3G`, k("H3G"));
    sk.dimH(-xe, xe, s.HPOUT + Math.abs(s.PENTPOUT) * xe, -14, `ETAB ${num(s.ETAB, 2)}`, k("ETAB"));
    sk.dimH(-s.ETALON / 2, s.ETALON / 2, 0, 18, `ETALON ${num(s.ETALON, 2)}`, k("ETALON"));
    const lab = (x, y, t, key) => sk.text(sk.X(x), sk.Y(y), t, sk.isHl(key) ? "tx dl hl" : "tx dl", "start");
    sk.lineP(sk.X(-s.E1 / 2), sk.Y(yT + 0.06), sk.X(s.E1 / 2), sk.Y(yT + 0.06), sk.isHl(k("E1")) ? "dim hl" : "dim", true);
    sk.text(sk.X(s.E1 / 2 + 0.02), sk.Y(yT + 0.08), sk.lab(`E1 ${num(s.E1, 2)}`, k("E1")), sk.isHl(k("E1")) ? "tx dl cote hl" : "tx dl cote", "start");
    sk.lineP(sk.X(-s.E2 / 2), sk.Y(yW - 0.06), sk.X(s.E2 / 2), sk.Y(yW - 0.06), sk.isHl(k("E2")) ? "dim hl" : "dim", true);
    sk.text(sk.X(s.E2 / 2 + 0.02), sk.Y(yW - 0.04), sk.lab(`E2 ${num(s.E2, 2)}`, k("E2")), sk.isHl(k("E2")) ? "tx dl cote hl" : "tx dl cote", "start");
    sk.dimH(xe - s.D3D, xe, yW + s.H3D, 16, `D3D`, k("D3D"), yW + s.H3D, "l");
    sk.dimH(-xe, -xe + s.D3G, yW + s.H3G, 16, `D3G`, k("D3G"), yW + s.H3G, "r");
    if (s.GDA > 0 && s.EPAM > 0) lab(s.E1 / 2 + s.EPAM / 2 + 0.03, (yT + yW) / 2, `EPAM +${num(s.EPAM, 2)}`, k("EPAM"));
    if (s.PENTPOUT) sk.text(sk.X(xe * 0.5), sk.Y(s.HPOUT + s.PENTPOUT * xe * 0.5) - 6, `PENTPOUT ${num(s.PENTPOUT * 100, 1)} %`, sk.isHl(k("PENTPOUT")) ? "tx dl hl" : "tx dl");
    let out = sk.svg(rive ? "Poutre de rive \u2014 coupe" : "Poutre pr\xE9fabriqu\xE9e \u2014 coupe courante", "Coupe de la poutre pr\xE9fabriqu\xE9e");
    if (s.GDA > 0 && s.EPAM > 0) {
      const Lh = bd.ABOUT + bd.PORTEE / 2, sxx = SW / Lh, syy = 46 / s.EPAM;
      const g = new Sk(0, Lh, 0, s.EPAM, sxx * (SW - 50) / SW, syy, { l: 74, r: 24, t: 16, b: 48 }, hl);
      const p = [[0, 0]];
      for (let i = 0; i <= 120; i++) {
        const x = Lh * i / 120;
        p.push([x, webExtra(bd, s, x)]);
      }
      p.push([Lh, 0]);
      g.poly(p, sk.isHl(k("EPAM")) || sk.isHl(k("LONGOUS")) || sk.isHl(k("LIN")) ? "thick hl" : "thick");
      g.line(0, 0, Lh, 0, "beamline");
      g.parts.push(`<polygon class="sup" points="${g.X(bd.ABOUT)},${g.Y(0)} ${g.X(bd.ABOUT) - 6},${g.Y(0) + 10} ${g.X(bd.ABOUT) + 6},${g.Y(0) + 10}"/>`);
      g.dimH(bd.ABOUT, bd.ABOUT + s.LONGOUS, 0, 30, `LONGOUS ${num(s.LONGOUS, 2)}`, k("LONGOUS"));
      g.dimV(0, s.EPAM, 0, -6, `EPAM ${num(s.EPAM, 2)}`, k("EPAM"));
      g.text(g.X(bd.ABOUT + s.LONGOUS * 0.6), g.Y(s.EPAM * 0.55), sk.schema ? "GOUDAM = 1 : \xE2me \xE9paissie aux abouts" : "\xE2me \xE9paissie aux abouts (GOUDAM = 1)", sk.isHl(k("GDA")) || sk.isHl("GOUDAM") ? "tx sm hl" : "tx sm", "start");
      g.text(g.X(Lh), 12, s.LIN ? "variation lin\xE9aire (LIN = 1)" : "variation discontinue (LIN = 0)", "tx sm mute", "end");
      out += g.svg("Sur\xE9paisseur d'\xE2me sur appui (demi-poutre)", "Sur\xE9paisseur d'\xE2me le long de la demi-poutre");
    }
    if (s.PLA > 0 && s.HPLA > 0) {
      const se = 130 / s.HPOUT, Le = Math.max(bd.ABOUT + 1.5, (SW - 136) / se - 0.2), ep = 0.2;
      const e = new Sk(-0.2, Le, -0.15, s.HPOUT + 0.1, se, se, { l: 112, r: 24, t: 18, b: 30 }, hl);
      e.poly([[0, 0], [Le, 0], [Le, s.HPOUT], [0, s.HPOUT]], "beam");
      e.poly([[0, 0], [ep, 0], [ep, Math.min(s.HPLA, s.HPOUT)], [0, Math.min(s.HPLA, s.HPOUT)]], e.isHl(k("HPLA")) || e.isHl(k("PLA")) ? "ent hl" : "ent");
      e.parts.push(`<polygon class="sup" points="${e.X(bd.ABOUT)},${e.Y(0)} ${e.X(bd.ABOUT) - 6},${e.Y(0) + 10} ${e.X(bd.ABOUT) + 6},${e.Y(0) + 10}"/>`);
      e.line(bd.ABOUT, -0.15, bd.ABOUT, s.HPOUT + 0.1, "axis");
      e.dimV(0, Math.min(s.HPLA, s.HPOUT), 0, -12, `HPLA ${num(s.HPLA, 2)}`, k("HPLA"));
      e.dimV(0, s.HPOUT, 0, -50, `HPOUT ${num(s.HPOUT, 2)}`, k("HPOUT"));
      e.text(e.X(bd.ABOUT) + 8, e.Y(Math.min(s.HPLA, s.HPOUT) * 0.5), e.schema ? "PLAB = 1 : plaque d'about pr\xE9fabriqu\xE9e" : "plaque d'about pr\xE9fabriqu\xE9e", e.isHl(k("PLA")) || e.isHl("PLAB") ? "tx sm hl" : "tx sm", "start");
      out += e.svg("Extr\xE9mit\xE9 de poutre \u2014 plaque d'about", "\xC9l\xE9vation de l'extr\xE9mit\xE9 de poutre avec la plaque d'about pr\xE9fabriqu\xE9e");
    }
    return out;
  }
  function slabZoom(bd, hl, hlPath = "") {
    const D = deck(bd), n = D.beams.length;
    const right = /^slabD\./.test(hlPath);
    const bs = right ? D.beams.slice(Math.max(0, n - 2)) : D.beams.slice(0, Math.min(2, n));
    const edge = right ? D.beams[n - 1].xr : D.beams[0].xl;
    const inner = right ? bs[0].x - bd.ENTRAPOUT / 2 : bs[bs.length - 1].x + (n > 2 ? bd.ENTRAPOUT / 2 : bs[bs.length - 1].xr - bs[bs.length - 1].x);
    const x0 = Math.min(edge, inner) - 0.05, x1 = Math.max(edge, inner) + 0.05;
    const ymax = Math.max(...bs.map((b) => b.s.HPOUT + b.dy)) + 0.45, ymin = ymax - 1.5;
    const sx = SW / (x1 - x0);
    const sk = new Sk(x0, x1, ymin, ymax, sx, sx, { l: 84, r: 84, t: 58, b: 40 }, hl);
    const cid = "cz" + ++CLIP;
    sk.parts.push(`<clipPath id="${cid}"><rect x="${r1(sk.X(x0))}" y="0" width="${r1(sk.X(x1) - sk.X(x0))}" height="${r1(sk.Y(ymin))}"/></clipPath><g clip-path="url(#${cid})">`);
    for (const b of bs) sk.poly(b.outline, "beam");
    drawSlab(sk, D.beams.map((b) => b.slab));
    sk.parts.push("</g>");
    const side = right ? "slabD" : "slabG", E = right ? bd.slabD : bd.slabG;
    const be = right ? bs[bs.length - 1] : bs[0], bi = right ? bs[0] : bs[bs.length - 1];
    const H = be.s.HPOUT + be.dy;
    const yTop = (x) => D.topAt(x);
    sk.dimV(yTop(edge) - E.HEXT, yTop(edge), edge, right ? 14 : -14, right ? `HEXT ${num(E.HEXT, 2)}` : `HEXT ${num(E.HEXT, 2)}`, `${side}.HEXT`);
    sk.dimV(H, H + E.HHOUR, be.x, right ? -10 : 10, `HHOUR ${num(E.HHOUR, 2)}`, `${side}.HHOUR`, right ? "l" : "r");
    if (n > 2 || bs.length > 1) {
      const xm = (bs[0].x + bs[bs.length - 1].x) / 2;
      sk.dimV(yTop(xm) - bd.slab.HAXE, yTop(xm), xm, 10, `HAXE ${num(bd.slab.HAXE, 2)}`, "slab.HAXE");
      if (n > 2) sk.dimV(bi.s.HPOUT + bi.dy, bi.s.HPOUT + bi.dy + bd.slab.HHOUR, bi.x, right ? -10 : 10, `HHOUR ${num(bd.slab.HHOUR, 2)}`, "slab.HHOUR", right ? "l" : "r");
    }
    sk.dimH(Math.min(edge, be.x), Math.max(edge, be.x), H, -(yTop(be.x) - H) * sk.sx - 34, `EEXT ${num(E.EEXT, 2)}`, `${side}.EEXT`);
    if (bs.length > 1) sk.dimH(bs[0].x, bs[1].x, H, -(yTop(bs[0].x) - H) * sk.sx - 34, `ENTRAPOUT ${num(bd.ENTRAPOUT, 2)}`, "ENTRAPOUT");
    const slope = (x, v, key, below, label) => {
      sk.text(sk.X(x), sk.Y(yTop(x) - (below ? 0.35 : 0)) + (below ? 14 : -6), `${label} ${num(v * 100, 1)} %`, sk.isHl(key) ? "tx dl hl" : "tx sm");
    };
    const xc = (edge + be.x) / 2, xi = (bs[0].x + bs[bs.length - 1].x) / 2;
    slope(xc, E.PENTSUP, `${side}.PENTSUP`, false, "PENTSUP");
    slope(xc, E.PENTINF, `${side}.PENTINF`, true, "PENTINF");
    if (bs.length > 1) {
      slope(xi + 0.4 * (right ? -1 : 1) * bd.ENTRAPOUT / 4, bd.slab.PENTSUP, "slab.PENTSUP", false, "PENTSUP");
      slope(xi, bd.slab.PENTINF, "slab.PENTINF", true, "PENTINF");
    }
    return sk.svg(right ? "Hourdis \u2014 encorbellement droit" : "Hourdis \u2014 encorbellement gauche", "D\xE9tail du hourdis et de l'encorbellement");
  }
  function crossBeamView(bd, hl, hlPath = "") {
    const n = bd.NPOUT;
    if (n < 2) return "";
    let A = n >= 4 ? 2 : 1;
    if (/^slabG\./.test(hlPath)) A = 1;
    else if (/^slabD\./.test(hlPath)) A = n - 1;
    else if (/^cross\./.test(hlPath) && n >= 3) A = Math.min(2, n - 1);
    const B = A + 1, D = deck(bd);
    const bA = D.beams[A - 1], bB = D.beams[B - 1];
    const crA = crossOf(bd, A), crB = crossOf(bd, B);
    const pA = A === 1 ? "slabG.cross" : A === n ? "slabD.cross" : "cross", pB = B === 1 ? "slabG.cross" : B === n ? "slabD.cross" : "cross";
    const x0 = bA.x - bA.s.ETAB / 2 - 0.1, x1 = bB.x + bB.s.ETAB / 2 + 0.1;
    const ymax = Math.max(bA.s.HPOUT + bA.dy, bB.s.HPOUT + bB.dy) + 0.45;
    const sx = Math.min(SW / (x1 - x0), 240 / ymax);
    const sk = new Sk(x0, x1, 0, ymax, sx, sx, { l: 70, r: 70, t: 22, b: 40 }, hl);
    const gA = slabFor(bd, A), gB = slabFor(bd, B);
    const under = (b, g, xr) => {
      const yTop = (x) => b.s.HPOUT + b.dy + g.HHOUR + (x >= 0 ? g.psR : g.psL) * x;
      const r = xr > 0, xm = r ? g.xr : g.xl;
      return yTop(xm) - (r ? g.hMidR : g.hMidL) + (r ? g.piR : g.piL) * (xr - xm);
    };
    const xmid = (bA.x + bB.x) / 2;
    const side = (b, cr, sg, g) => {
      const lim = sg > 0 ? cr.AMORD : cr.AMORG, h5 = (sg > 0 ? cr.H5D : cr.H5G) + b.dy, h7 = sg > 0 ? cr.H7D : cr.H7G, h9 = (sg > 0 ? cr.H9D : cr.H9G) + b.dy;
      const xm = Math.abs(xmid - b.x);
      if (cr.AMEN && lim > 0) {
        const xf = b.s.E2 / 2, endY = h7 > 0 && lim > xf ? h5 + h7 : h9;
        sk.poly([[b.x, h5], [b.x + sg * xf, h5], [b.x + sg * lim, endY], [b.x + sg * lim, b.s.HPOUT + b.dy + 0.02], [b.x, b.s.HPOUT + b.dy + 0.02]], "amorce");
      }
      const xs = cr.AMEN ? lim : b.s.ETAB / 2;
      if (xm > xs && bd.HENTA > 0) {
        const yb = under(b, g, sg * xm) - bd.HENTA;
        sk.poly([[b.x + sg * xs, cr.AMEN ? h9 : yb], [b.x + sg * xm, yb], [b.x + sg * xm, under(b, g, sg * xm) + 0.05], [b.x + sg * xs, under(b, g, sg * xs) + 0.05]], "ent");
      }
    };
    side(bA, crA, 1, gA);
    side(bB, crB, -1, gB);
    sk.poly(bA.outline, "beam");
    sk.poly(bB.outline, "beam");
    drawSlab(sk, [bA.slab, bB.slab]);
    sk.line(xmid, 0, xmid, ymax, "axis");
    if (crA.AMEN) {
      sk.dimH(bA.x, bA.x + crA.AMORD, bA.dy, 18, `AMORD ${num(crA.AMORD, 2)}`, `${pA}.AMORD`);
      sk.dimV(bA.dy, crA.H5D + bA.dy, bA.x + bA.s.E2 / 2, -bA.s.E2 * sk.sx - 30, `H5D ${num(crA.H5D, 2)}`, `${pA}.H5D`);
      sk.dimV(bA.dy, crA.H9D + bA.dy, bA.x + crA.AMORD, -8, `H9D ${num(crA.H9D, 2)}`, `${pA}.H9D`);
      if (crA.H7D > 0) sk.dimV(crA.H5D + bA.dy, crA.H5D + crA.H7D + bA.dy, bA.x + crA.AMORD, 8, `H7D ${num(crA.H7D, 2)}`, `${pA}.H7D`);
    }
    if (crB.AMEN) {
      sk.dimH(bB.x - crB.AMORG, bB.x, bB.dy, 18, `AMORG ${num(crB.AMORG, 2)}`, `${pB}.AMORG`);
      sk.dimV(bB.dy, crB.H9G + bB.dy, bB.x - crB.AMORG, 8, `H9G ${num(crB.H9G, 2)}`, `${pB}.H9G`);
      if (crB.H7G > 0) sk.dimV(crB.H5G + bB.dy, crB.H5G + crB.H7G + bB.dy, bB.x - crB.AMORG, -8, `H7G ${num(crB.H7G, 2)}`, `${pB}.H7G`);
      sk.dimV(bB.dy, crB.H5G + bB.dy, bB.x - bB.s.E2 / 2, bB.s.E2 * sk.sx + 30, `H5G ${num(crB.H5G, 2)}`, `${pB}.H5G`);
    }
    const ym = under(bA, gA, xmid - bA.x);
    if (bd.HENTA > 0) sk.dimV(ym - bd.HENTA, ym, xmid, 8, `HENTA ${num(bd.HENTA, 2)}`, "HENTA");
    sk.text(sk.X(bA.x), sk.Y(0) + 34, `poutre ${A}`, "tx sm mute");
    sk.text(sk.X(bB.x), sk.Y(0) + 34, `poutre ${B}`, "tx sm mute");
    return sk.svg(`Entretoise d'about entre les poutres ${A} et ${B}`, "Vue de l'entretoise d'about avec amorces");
  }
  function materialsView(bd, hl) {
    const s = bd.beam, n = bd.NPOUT, ip = n >= 3 ? 2 : 1, g = slabFor(bd, ip);
    const x0 = Math.min(g.xl, -s.ETAB / 2), x1 = Math.max(g.xr, s.ETAB / 2), ymax = s.HPOUT + g.HHOUR + 0.05;
    const sx = Math.min(250 / (x1 - x0), 290 / ymax);
    const sk = new Sk(x0, x1, 0, ymax, sx, sx, { l: 20, r: 190, t: 30, b: 16 }, hl);
    sk.poly(beamOutline(s, 0), "beam");
    sk.poly(slabPolygon(s, g), "slab");
    const d = bd.DAP, H = s.HPOUT, Hh = H + g.HHOUR, hd = sk.isHl("DAP");
    const rows = [[Hh - d, g.xr - d, "aciers sup\xE9rieurs du hourdis"], [H + d, g.xr - d, "aciers inf\xE9rieurs du hourdis"], [H - d, s.ETAB / 2 - d, "aciers sup\xE9rieurs de la poutre"], [d, s.ETALON / 2 - d, "aciers inf\xE9rieurs de la poutre"]];
    let ly = -Infinity;
    const xl = sk.X(x1) + 34;
    for (const [y, hw, t] of rows) {
      for (let i = 0; i <= 6; i++) {
        const x = -hw + 2 * hw * i / 6;
        sk.circleP(sk.X(x), sk.Y(y), 2.2, hd ? "rb hl" : "rb");
      }
      const py = Math.max(sk.Y(y), ly + 15);
      ly = py;
      sk.lineP(sk.X(hw) + 4, sk.Y(y), xl - 4, py, "ext", true);
      sk.text(xl, py + 4, t, "tx sm", "start");
    }
    sk.dimV(0, d, s.ETALON / 2, 14, `D ${num(d, 3)}`, "D|DAP");
    sk.text(sk.X(x0), 14, sk.schema ? "Hourdis : FC28H (FC4H, FC5H)" : `Hourdis : fc28 = ${num(bd.FC28H, 1)} MPa`, sk.isHl("FC28H") || sk.isHl("FC4H") || sk.isHl("FC5H") ? "tx sm hl" : "tx sm", "start");
    sk.text(sk.X(-s.E1 / 2) - 8, sk.Y(H * 0.55), `Poutre`, "tx sm mute", "end");
    sk.text(sk.X(-s.E1 / 2) - 8, sk.Y(H * 0.55) + 14, sk.schema ? "FC28 (FC1, FC2)" : `fc28 = ${num(bd.FC28, 1)} MPa`, sk.isHl("FC28") || sk.isHl("FC11") || sk.isHl("FC12") ? "tx sm hl" : "tx sm", "end");
    return sk.svg("Section composite et aciers passifs", "Section composite avec les lits d'aciers passifs");
  }
  function phasingView(bd, hl) {
    const J = bd.J;
    const ev = [
      ["J.J1", J.J1, "tension de la 1re famille"],
      ["J.J2", J.J2, "2e partie de la 1re famille"],
      ["J.J3", J.J3, "b\xE9tonnage du hourdis"],
      ["J.J4", J.J4, "tension de la 2e famille"],
      ["J.J5", J.J5, "superstructures"],
      ["J.J6", J.J6, "mise en service"]
    ];
    const tmax = Math.max(10, ...ev.map((e2) => e2[1])) * 1.1;
    const L = 190, R = SW + 60, W = R + 30, rowH = 22, top = 14, H = top + ev.length * rowH + 26;
    const X = (t) => L + (R - L) * t / tmax;
    const step = tmax > 150 ? 50 : tmax > 60 ? 20 : 10;
    const p = [];
    for (let t = 0; t <= tmax; t += step) p.push(`<line class="ext" x1="${r1(X(t))}" y1="${top - 4}" x2="${r1(X(t))}" y2="${H - 22}"/><text class="tx sm mute" x="${r1(X(t))}" y="${H - 8}" text-anchor="middle">${t}</text>`);
    ev.forEach(([k, t, lbl], i) => {
      const y = top + i * rowH + 10, h = hl === k || hl === k.slice(2);
      p.push(`<text class="tx dl${h ? " hl" : ""}" x="6" y="${y + 4}">${k.slice(2)}</text><text class="tx sm${h ? " hl" : " mute"}" x="30" y="${y + 4}">${esc(lbl)}</text>`);
      p.push(`<line class="${h ? "dim hl" : "tl"}" x1="${L}" y1="${y}" x2="${r1(X(t))}" y2="${y}"/><circle class="dot${h ? " hl" : ""}" cx="${r1(X(t))}" cy="${y}" r="${h ? 5 : 3.5}"/><text class="tx sm${h ? " hl" : ""}" x="${r1(X(t)) + 8}" y="${y + 4}">j${t}</text>`);
    });
    const svgT = `<figure class="skf"><figcaption>Phasage (\xE2ge du b\xE9ton de la poutre, en jours)</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Phasage de construction">${p.join("")}</svg></figure>`;
    const sys = bd.systems[0];
    const Rg = sys.DGAINE / 2, e = sys.ENROB, dc = sys.DECAL;
    const sc = 1500;
    const g = new Sk(-0.1, 0.1, 0, e + 2 * Rg + 0.02, sc, sc, { l: 150, r: 150, t: 34, b: 12 }, hl);
    g.poly([[-0.1, 0], [0.1, 0], [0.1, e + 2 * Rg + 0.02], [-0.1, e + 2 * Rg + 0.02]], "beam");
    g.circleP(g.X(0), g.Y(e + Rg), Rg * g.sx, g.isHl("systems.0.DGAINE") ? "duct hl" : "duct");
    const rc = Rg * 0.75;
    g.circleP(g.X(0), g.Y(e + Rg - dc), rc * g.sx, "strand");
    g.dimV(0, e, 0.1, 12, `ENROB ${num(e, 3)}`, "systems.0.ENROB");
    g.dimH(-Rg, Rg, e + 2 * Rg, -14, `DGAINE ${num(2 * Rg, 3)}`, "systems.0.DGAINE");
    g.dimV(e + Rg - dc, e + Rg, -0.1, -12, `DECAL ${num(dc, 3)}`, "systems.0.DECAL");
    g.text(g.X(0.1) + 12, g.Y(e + 2 * Rg + 0.02) + 14, "talon de la poutre", "tx sm mute", "start");
    const av = sys.AV || 0.22, ah = sys.AH || 0.22, sa = Math.min(260 / Math.max(av, ah), 600);
    const pa = new Sk(-ah, ah, -av, av, sa, sa, { l: 120, r: 120, t: 16, b: 24 }, hl);
    pa.poly([[-ah / 2, -av / 2], [ah / 2, -av / 2], [ah / 2, av / 2], [-ah / 2, av / 2]], pa.isHl("systems.0.AV") || pa.isHl("systems.0.AH") ? "steel hl" : "steel");
    pa.circleP(pa.X(0), pa.Y(0), R * pa.sx, "duct");
    pa.dimH(-ah / 2, ah / 2, av / 2, -10, `AH ${num(ah, 3)}`, "systems.0.AH");
    pa.dimV(-av / 2, av / 2, ah / 2, 12, `AV ${num(av, 3)}`, "systems.0.AV");
    return svgT + g.svg("Gaine en partie basse (syst\xE8me 1)", "Coupe d'une gaine avec enrobage et d\xE9calage du c\xE2ble") + pa.svg("Plaque d'ancrage (syst\xE8me 1)", "Encombrement de la plaque d'ancrage");
  }
  function cablesView(bd, ic, hl, hlPath = "") {
    const cab = bd.cablings[ic];
    if (!cab) return "";
    const Lh = bd.ABOUT + bd.PORTEE / 2, H = bd.beam.HPOUT, hs = bd.slab.HHOUR;
    const sx = (DW + 100) / Lh, sy = Math.min(240 / (H + hs), sx * 8);
    const sk = new Sk(0, Lh, -0, H + hs, sx, sy, { l: 36, r: 20, t: 46, b: 64 }, hl);
    sk.poly([[0, 0], [Lh, 0], [Lh, H], [0, H]], "beam");
    sk.poly([[0, H], [Lh, H], [Lh, H + hs], [0, H + hs]], "slab");
    sk.parts.push(`<polygon class="sup" points="${sk.X(bd.ABOUT)},${sk.Y(0)} ${sk.X(bd.ABOUT) - 7},${sk.Y(0) + 11} ${sk.X(bd.ABOUT) + 7},${sk.Y(0) + 11}"/>`);
    sk.line(Lh, -0.05, Lh, H + hs + 0.05, "axis");
    sk.text(sk.X(Lh) - 4, sk.Y(H + hs) - 6, "mi-trav\xE9e", "tx sm mute", "end");
    const m = hlPath.match(/^cablings\.\d+\.(?:ordonnees|cables)\.(\d+)(?:\.(\w+))?/);
    const selK = m ? +m[1] : -1, col = m ? m[2] ?? "" : "";
    const ma = hlPath.match(/^cablings\.\d+\.(?:abscisses|ordonnees\.\d+)\.(\d+)$/), selX = ma ? +ma[1] : -1;
    cab.abscisses.forEach((x, i) => {
      const h = i === selX;
      sk.lineP(sk.X(x), sk.Y(0) + 2, sk.X(x), sk.Y(0) + 8, h ? "dim hl" : "ext", true);
      sk.text(sk.X(x), sk.Y(0) + (i % 2 ? 32 : 20), num(x, 2), h ? "tx sm hl" : "tx sm mute");
    });
    sk.text(sk.X(0), sk.Y(0) + 48, "abscisses depuis l'about (m)", "tx sm mute", "start");
    const n1 = cab.NCAB11 + cab.NCAB12;
    let geoms = [];
    geoms = cab.cables.map((d, k) => {
      try {
        return buildCable(bd, cab, d, k);
      } catch {
        return null;
      }
    });
    geoms.forEach((g, k) => {
      const d = cab.cables[k];
      const fam = k < n1 ? 1 : 2;
      const sel = k === selK;
      if (g) {
        const p = [];
        const xs = Math.max(0, d.ABSOR);
        for (let i = 0; i <= 160; i++) {
          const x = xs + (Lh - xs) * i / 160;
          p.push([x, g.y(x)]);
        }
        sk.pline(p, `cab f${fam}${sel ? " sel" : ""}`);
        sk.text(sk.X(xs) + (xs > 0.3 ? -3 : 3), sk.Y(g.y(xs)) - 3, String(d.num || k + 1), sel ? "tx sm hl" : "tx sm", xs > 0.3 ? "end" : "start");
      }
      const o = cab.ordonnees[k] ?? [];
      o.forEach((y, i) => {
        if (y > 0 && cab.abscisses[i] !== void 0) sk.circleP(sk.X(cab.abscisses[i]), sk.Y(y), sel || i === selX ? 3.6 : 2.4, `pt f${fam}${sel && (i === selX || selX < 0) ? " hl" : ""}`);
      });
    });
    if (selK >= 0 && cab.cables[selK]) {
      const d = cab.cables[selK], g = geoms[selK];
      let row2 = 0;
      const mark = (x, code, lbl) => {
        const h = col === code;
        sk.lineP(sk.X(x), sk.Y(0), sk.X(x), sk.Y(H + hs) - 4 - 12 * row2, h ? "mk hl" : "mk", true);
        sk.text(sk.X(x) + 3, sk.Y(H + hs) - 7 - 12 * row2, `${lbl} ${num(x, 3)}`, h ? "tx sm hl" : "tx sm", "start");
        row2++;
      };
      mark(d.ABSOR, "ABSOR", "ABSOR");
      mark(d.ABDECO, "ABDECO", "ABDECO");
      mark(d.ABFICO, "ABFICO", "ABFICO");
      if (col === "ABDEHO" || col === "ABFIHO" || col === "EXTRAN") {
        mark(d.ABDEHO, "ABDEHO", "ABDEHO");
        mark(d.ABFIHO, "ABFIHO", "ABFIHO");
      }
      if (g && col === "ORFICO") sk.dimV(0, d.ORFICO, Math.min(Lh, d.ABFICO + 0.4), 8, `ORFICO ${num(d.ORFICO, 3)}`, "ORFICO");
      if (col === "ANGSOR" && g) sk.text(sk.X(d.ABSOR) + 6, sk.Y(g.y(d.ABSOR)) + 14, `ANGSOR ${num(d.ANGSOR, 2)} gr`, "tx dl hl", "start");
    }
    const leg = `<div class="sk-leg"><span><i class="lf1"></i>1re famille (${n1})</span><span><i class="lf2"></i>2e famille (${cab.NCAB2})</span><span>\xE9chelle verticale \xD7${num(sy / sx, 1)}</span></div>`;
    return sk.svg(`C\xE2blage ${ic + 1} \u2014 trac\xE9 des c\xE2bles (demi-poutre)`, "\xC9l\xE9vation de la demi-poutre avec le trac\xE9 des c\xE2bles") + leg;
  }
  var EQUIP_LABEL = { BN4: "Barri\xE8re BN4", GBA: "GBA (glissi\xE8re b\xE9ton)", GC: "Garde-corps", AUCUN: "Aucun" };
  function defaultEquip(bd) {
    const L = bd.ETROTG > 0 ? "BN4" : "GBA", R = bd.ETROTD > 0 ? "BN4" : "GBA";
    return { L, R, corL: L !== "GBA", corR: R !== "GBA" };
  }
  var hasCorniche = (eq, side) => side === "L" ? eq.corL ?? eq.L !== "GBA" : eq.corR ?? eq.R !== "GBA";
  var hasTrottoir = (eq, side) => (side === "L" ? eq.trL : eq.trR) ?? true;
  function edgeIcon(kind, side) {
    const deck2 = '<path class="i-slab" d="M4 30 H70 V38 H22 L14 44 H4 Z"/>';
    const body = kind === "BN4" ? '<rect class="i-lon" x="4" y="25" width="18" height="5"/><path class="i-steel" d="M7 25 H15 V4 H12 Z"/><path class="i-steel" d="M15 25 H17 L15 21 Z"/><rect class="i-rail" x="16" y="17.5" width="5" height="3.2" rx=".8"/><rect class="i-rail" x="16" y="10.5" width="5" height="3.2" rx=".8"/><rect class="i-rail" x="16" y="3.4" width="5" height="3.2" rx=".8"/>' : kind === "TR" ? '<path class="i-tro" d="M4 30 V24 H44 L46 25 V30 Z"/><rect class="i-bord" x="40" y="24" width="6" height="6"/><path class="i-rev" d="M46 30 H70 V28.6 H46 Z"/>' : '<path class="i-gba" d="M4 30 V8 H11 L13 21 L22 28 V30 Z"/><path class="i-rev" d="M22 30 H70 V28.6 H22 Z"/>';
    return `<svg viewBox="0 0 74 48" aria-hidden="true"${side === "R" ? ' style="transform:scaleX(-1)"' : ""}>${deck2}${body}</svg>`;
  }
  function generalSection(bd, hl, eq = defaultEquip(bd), mode = "geo", win, opt = {}) {
    const D = deck(bd), { L } = D, W = L.width;
    const ys = (x2) => D.topAt(Math.max(0, Math.min(W, x2)));
    const wd = 2.6, edgeY = win ? ys(win === "L" ? 0 : W) : 0;
    if (!(W > 0)) return '<div class="sk-empty">La coupe se dessine au fur et \xE0 mesure : commencez par les largeurs (trottoirs, bandes, chauss\xE9e).</div>';
    const nb = D.beams.length;
    if (win && !nb) return "";
    const xmin = win === "L" ? -0.3 : win === "R" ? W - wd : Math.min(-0.2, nb ? D.beams[0].xl - 0.2 : -0.2);
    const xmax = win === "L" ? wd : win === "R" ? W + 0.3 : Math.max(W + 0.2, nb ? D.beams[nb - 1].xr + 0.2 : W + 0.2);
    const ymin = win ? edgeY - 0.75 : nb ? Math.min(...D.beams.map((b) => b.dy)) : -0.6, ymax = win ? edgeY + 1.45 : Math.max(ys(0), ys(W)) + (opt.bare ? 0.35 : 1.95);
    const TW = win ? Math.min(420, DW) : DW, sx = TW / (xmax - xmin);
    const sk = new Sk(xmin, xmax, ymin, ymax, sx, sx, win ? { l: 16, r: 16, t: 14, b: 40 } : opt.bare ? { l: 84, r: 100, t: 68, b: 116 } : { l: 84, r: 96, t: 66, b: opt.clean && mode !== "calc" ? 82 : SCHEMA ? 116 : 100 }, hl);
    if (opt.clean) sk.vonly = true;
    const cwid = "cw" + ++CLIP;
    if (win) sk.parts.push(`<clipPath id="${cwid}"><rect x="${r1(sk.X(xmin))}" y="0" width="${r1(sk.X(xmax) - sk.X(xmin))}" height="${r1(sk.Y(ymin))}"/></clipPath><g clip-path="url(#${cwid})">`);
    const RV = 0.08;
    const at = (side, s) => side === "L" ? s : W - s;
    const P = (side, pts, yb) => pts.map(([s, v]) => {
      const x2 = at(side, s);
      return [x2, yb(x2) + v];
    });
    for (const b of D.beams) sk.poly(b.outline, "beam");
    drawSlab(sk, D.beams.map((b) => b.slab));
    const labels = [];
    const zone = { L: { inner: 0 }, R: { inner: 0 } };
    for (const side of opt.bare ? [] : ["L", "R"]) {
      const wT = side === "L" ? bd.ETROTG : bd.ETROTD, type = side === "L" ? eq.L : eq.R;
      const yE = ys(at(side, 0));
      const sgn = side === "L" ? -1 : 1;
      const yTop = wT > 0 ? 0.25 : RV + 0.04;
      const cor = hasCorniche(eq, side);
      if (cor) {
        sk.poly(P(side, [[-0.12, yTop + 0.02], [0.18, yTop + 0.02], [0.18, 0], [0, 0], [0, -0.38], [-0.04, -0.46], [-0.12, -0.46]], () => yE), "cor");
        labels.push({ x: at(side, -0.06), y: yE - 0.42, t: "Corniche", dx: sgn * 14, dy: side === "R" ? 84 : 36 });
      }
      let s0 = cor ? 0.18 : 0;
      if (type === "BN4" || type === "GC") {
        const lw = type === "BN4" ? 0.5 : 0.3;
        const yL = Math.max(yTop, 0.25);
        sk.poly(P(side, [[s0, 0], [s0 + lw, 0], [s0 + lw, yL - 0.03], [s0 + lw - 0.03, yL], [s0, yL]], ys), "lon");
        const sp = s0 + (type === "BN4" ? 0.2 : lw / 2), yb = yL;
        const Q = (pts, cls) => sk.poly(P(side, pts, () => yE), cls);
        Q(type === "BN4" ? [[sp - 0.19, yb], [sp + 0.14, yb], [sp + 0.14, yb + 0.025], [sp - 0.19, yb + 0.025]] : [[sp - 0.11, yb], [sp + 0.11, yb], [sp + 0.11, yb + 0.025], [sp - 0.11, yb + 0.025]], "steel");
        for (const dx of type === "BN4" ? [-0.13, 0.1] : [-0.07, 0.07]) {
          const [a0, a1] = P(side, [[sp + dx, yb - 0.16], [sp + dx, yb]], () => yE);
          sk.line(a0[0], a0[1], a1[0], a1[1], "bolt");
        }
        if (type === "BN4") {
          const f2 = sp + 0.06;
          Q([[sp - 0.17, yb + 0.025], [f2, yb + 0.025], [f2, yb + 1], [f2 - 0.09, yb + 1]], "steel post");
          Q([[f2, yb + 0.025], [f2 + 0.06, yb + 0.025], [f2, yb + 0.13]], "steel");
          for (const h of [0.385, 0.7, 1]) {
            const y0 = yb + h - 0.075, y1 = yb + h + 0.01;
            Q([[f2, y0 + 0.012], [f2 + 0.035, y0 + 0.012], [f2 + 0.035, y1 - 0.012], [f2, y1 - 0.012]], "steel");
            Q([[f2 + 0.035, y0], [f2 + 0.11, y0], [f2 + 0.12, y0 + 0.012], [f2 + 0.12, y1 - 0.012], [f2 + 0.11, y1], [f2 + 0.035, y1]], "rail");
            Q([[f2 + 0.05, y0 + 0.02], [f2 + 0.1, y0 + 0.02], [f2 + 0.1, y1 - 0.02], [f2 + 0.05, y1 - 0.02]], "railin");
            sk.pline(P(side, [[f2 + 0.02, y0 - 0.012], [f2 + 0.125, y0 - 0.012], [f2 + 0.14, y0 + 4e-3], [f2 + 0.14, y1 - 4e-3], [f2 + 0.125, y1 + 0.012], [f2 + 0.02, y1 + 0.012]], () => yE), "clamp");
          }
        } else {
          sk.poly(P(side, [[sp - 0.07, yb + 0.98], [sp + 0.07, yb + 0.98], [sp + 0.07, yb + 1.03], [sp - 0.07, yb + 1.03]], () => yE), "steel");
          sk.poly(P(side, [[sp - 0.02, yb + 0.5], [sp + 0.02, yb + 0.5], [sp + 0.02, yb + 0.54], [sp - 0.02, yb + 0.54]], () => yE), "steel");
          labels.push({ x: at(side, sp), y: yE + yb + 1.03, t: "Garde-corps", dx: -sgn * 46, dy: -6, key: side === "L" ? "DBAG|PBAGMAX|PBAGMIN" : "DBAD|PBADMAX|PBADMIN" });
        }
        s0 = s0 + lw;
      }
      if (wT > 0 && hasTrottoir(eq, side)) {
        const sT = Math.max(s0, wT);
        sk.poly(P(side, [[s0, 0], [sT, 0], [sT, yTop], [s0, yTop]], ys), "trotb");
        sk.poly(P(side, [[sT - 0.15, 0], [sT, 0], [sT, yTop - 0.02], [sT - 0.03, yTop], [sT - 0.15, yTop]], ys), "bord");
        labels.push({ x: at(side, (s0 + sT) / 2), y: ys(at(side, (s0 + sT) / 2)) + yTop, t: "Trottoir", dx: -sgn * 30, dy: -40, key: side === "L" ? "ETROTG" : "ETROTD" });
        s0 = sT;
      }
      if (type === "GBA") {
        const b02 = s0, wG = 0.42;
        const prof = [[b02, 0], [b02, RV + 0.8], [b02 + 0.19, RV + 0.8], [b02 + 0.24, RV + 0.33], [b02 + 0.42 - 0, RV + 0.075], [b02 + wG, 0]];
        sk.poly(P(side, prof, ys), "gba");
        labels.push({ x: at(side, b02 + 0.1), y: ys(at(side, b02)) + RV + 0.8, t: "GBA", dx: -sgn * 46, dy: -4, key: side === "L" ? "DBAG|PBAGMAX|PBAGMIN" : "DBAD|PBADMAX|PBADMIN" });
        s0 = b02 + wG;
      }
      zone[side].inner = s0;
    }
    const xa = zone.L.inner, xb = W - zone.R.inner;
    if (xb > xa && !opt.bare) {
      const n = 24, p = [];
      for (let i = 0; i <= n; i++) {
        const x2 = xa + (xb - xa) * i / n;
        p.push([x2, ys(x2)]);
      }
      for (let i = n; i >= 0; i--) {
        const x2 = xa + (xb - xa) * i / n;
        p.push([x2, ys(x2) + RV]);
      }
      sk.poly(p, "rev");
      const xm = xa + (xb - xa) * 0.58;
      labels.push({ x: xm, y: ys(xm) + RV, t: "Enrob\xE9 + \xE9tanch\xE9it\xE9", dx: -10, dy: -30 });
    }
    const xa2 = L.X3 + bd.ESURCH / 2;
    if (!win) {
      if (!opt.bare) for (let i = 1; i < L.NV; i++) {
        const x2 = L.X3 + i * L.v;
        sk.line(x2, ys(x2) + RV, x2, ys(x2) + RV + 0.12, "lane");
      }
      if (!opt.bare && !opt.clean) for (let i = 0; i < L.NV; i++) {
        const x2 = L.X3 + (i + 0.5) * L.v;
        sk.text(sk.X(x2), sk.Y(ys(x2) + RV) - 7, sk.schema ? i === 0 ? "NVOIE voies" : "" : `voie ${i + 1}`, sk.isHl("NVOIE") ? "tx sm hl" : "tx sm mute");
      }
      sk.line(xa2, ymin - 0.2, xa2, ys(xa2) + (opt.bare ? 0.15 : 1), "axis");
      if (!opt.bare && !opt.clean) sk.text(sk.X(xa2) + 4, sk.Y(ys(xa2) + 1) + 10, "axe", "tx sm mute", "start");
      const ps = bd.slab.PENTSUP;
      if (Math.abs(ps) > 1e-6 && !opt.bare && !opt.clean) {
        const x1 = L.X3 + L.v * 0.15, x2 = x1 + 1.6, y1 = ys(x1) + RV + 0.35, y2 = ys(x2) + RV + 0.35;
        const [ax, ay, bx, by] = ps > 0 ? [x2, y2, x1, y1] : [x1, y1, x2, y2];
        sk.lineP(sk.X(ax), sk.Y(ay), sk.X(bx), sk.Y(by), sk.isHl("slab.PENTSUP") ? "arrow hl" : "arrow", true);
        const ang = Math.atan2(sk.Y(by) - sk.Y(ay), sk.X(bx) - sk.X(ax));
        sk.top.push(`<polygon class="arrowh" points="${r1(sk.X(bx))},${r1(sk.Y(by))} ${r1(sk.X(bx) - 8 * Math.cos(ang) + 3.5 * Math.sin(ang))},${r1(sk.Y(by) - 8 * Math.sin(ang) - 3.5 * Math.cos(ang))} ${r1(sk.X(bx) - 8 * Math.cos(ang) - 3.5 * Math.sin(ang))},${r1(sk.Y(by) - 8 * Math.sin(ang) + 3.5 * Math.cos(ang))}"/>`);
        sk.text((sk.X(x1) + sk.X(x2)) / 2, Math.min(sk.Y(y1), sk.Y(y2)) - 6, sk.schema ? "PENTSUP" : `${num(Math.abs(ps) * 100, 1)} %`, sk.isHl("slab.PENTSUP") ? "tx dl hl" : "tx dl");
      }
    }
    if (win) {
      sk.parts.push("</g>");
      const side = win, wT = side === "L" ? bd.ETROTG : bd.ETROTD, E = side === "L" ? bd.slabG : bd.slabD, pre = side === "L" ? "slabG." : "slabD.";
      const xe = at(side, 0), yE = ys(xe), inn = (d) => at(side, d);
      if (wT > 0) sk.dimH(Math.min(xe, inn(wT)), Math.max(xe, inn(wT)), yE + 0.25, -16, `${side === "L" ? "ETROTG" : "ETROTD"} ${num(wT, 2)}`, side === "L" ? "ETROTG" : "ETROTD");
      sk.dimV(yE - E.HEXT, yE, xe, side === "L" ? 34 : -34, `HEXT ${num(E.HEXT, 2)}`, pre + "HEXT", side === "L" ? "r" : "l");
      const typ = side === "L" ? eq.L : eq.R;
      void typ;
      if (wT > 0) {
        const xc = inn(wT);
        sk.dimV(ys(xc) + RV, ys(xc) + 0.25, xc, side === "L" ? 10 : -10, "bordure 0.17", "", side === "L" ? "r" : "l");
      }
      for (const l of labels.filter((l2) => l2.x > xmin && l2.x < xmax)) {
        const dx = l.t === "Corniche" ? -l.dx * 1.6 : l.dx;
        const px = sk.X(l.x), py = sk.Y(l.y), tx = px + dx * 0.8, ty = py + l.dy * 0.8, h = !!l.key && sk.isHl(l.key);
        sk.lineP(px, py, tx, ty + (l.dy < 0 ? 3 : -10), h ? "lead hl" : "lead", true);
        sk.text(tx, ty, l.t, h ? "tx lb hl" : "tx lb", dx < 0 ? "end" : dx > 0 ? "start" : "middle");
      }
      return sk.svg(side === "L" ? "D\xE9tail rive gauche" : "D\xE9tail rive droite", "D\xE9tail de la rive avec \xE9quipements");
    }
    for (const l of opt.clean ? [] : labels) {
      const px = sk.X(l.x), py = sk.Y(l.y), tx = px + l.dx, ty = py + l.dy;
      const h = !!l.key && sk.isHl(l.key);
      sk.lineP(px, py, tx, ty + (l.dy < 0 ? 3 : -10), h ? "lead hl" : "lead", true);
      sk.text(tx, ty, l.t, h ? "tx lb hl" : "tx lb", l.dx < 0 ? "end" : l.dx > 0 ? "start" : "middle");
    }
    const yT = Math.max(ys(0), ys(W)) + (opt.bare ? 0.3 : 1.62);
    let x = 0;
    let lifted = false;
    for (const [k, w] of [["ETROTG", bd.ETROTG], ["EGAU", bd.EGAU], ["ESURCH", bd.ESURCH], ["EDROI", bd.EDROI], ["ETROTD", bd.ETROTD]]) {
      const lbl = w < 1 ? num(w, 2) : `${k} ${num(w, 2)}`, shown = sk.lab(lbl, k), fits = Math.abs(sk.X(x + w) - sk.X(x)) > shown.length * 6.9 + 6;
      const up = (k === "EGAU" || k === "EDROI") && !fits && w > 0;
      if (up) lifted = true;
      sk.dimH(x, x + w, yT, up ? -28 : -10, lbl, k, yT, k === "EGAU" ? "r" : k === "EDROI" ? "l" : k === "ETROTG" ? "l" : k === "ETROTD" ? "r" : void 0);
      x += w;
    }
    sk.dimH(0, W, yT, lifted ? -48 : -30, `largeur totale ${num(W, 2)} m`, "W");
    for (const b of D.beams) {
      const on = mode === "calc" && bd.poutresACalculer.includes(b.ip);
      sk.circleP(sk.X(b.x), sk.Y(ymin) + 16, 10, on ? "bn on" : "bn");
      sk.text(sk.X(b.x), sk.Y(ymin) + 20, String(b.ip), on ? "tx bnt on" : "tx bnt");
    }
    if (!nb) {
      sk.text(sk.X(W / 2), sk.Y(ymin) + 30, "Les poutres appara\xEEtront avec NPOUT, ENTRAPOUT, DPOUT1 et la hauteur de poutre (\xE9tape Poutre).", "tx sm mute");
      return sk.svg("Coupe transversale g\xE9n\xE9rale", "Coupe transversale du tablier en cours de saisie");
    }
    if (sk.schema) {
      const xm = sk.X((D.beams[0].x + D.beams[D.beams.length - 1].x) / 2), c = sk.isHl("DPOUT1") ? "tx def hl" : "tx def";
      sk.text(xm, sk.Y(ymin) + 90, "DPOUT1 : distance, en valeur absolue, de l'axe de la poutre de gauche", c, "middle");
      sk.text(xm, sk.Y(ymin) + 107, "num\xE9rot\xE9e 1 \xE0 l'axe de la chauss\xE9e proprement dite", c, "middle");
    }
    const b0 = D.beams[0], bn = D.beams[D.beams.length - 1];
    if (opt.clean && D.beams.length) for (const [b, sg] of [[b0, -1], [bn, 1]]) {
      const xt = b.x + sg * b.s.ETAB / 2, xe = sg < 0 ? b.xl : b.xr, d = Math.abs(xe - xt);
      if (d > 0.01) {
        const yS = b.dy + b.s.HPOUT;
        sk.dimH(Math.min(xe, xt), Math.max(xe, xt), yS, 12, `d\xE9bord ${num(d, 2)}`, sg < 0 ? "slabG.EEXT" : "slabD.EEXT", yS, sg < 0 ? "l" : "r");
      }
    }
    sk.dimH(b0.xl, b0.x, ymin, 46, `EEXT ${num(bd.slabG.EEXT, 2)}`, "slabG.EEXT|EEXT", ymin, "l");
    {
      const full = `ENTRAPOUT ${num(bd.ENTRAPOUT, 2)}`, shown = sk.lab(full, "ENTRAPOUT"), nb2 = D.beams.length;
      const fits = nb2 > 1 && Math.abs(sk.X(D.beams[1].x) - sk.X(D.beams[0].x)) > shown.length * 6.9 + 6;
      for (let i = 0; i + 1 < nb2; i++) sk.dimH(D.beams[i].x, D.beams[i + 1].x, ymin, 46, fits ? i === 0 || sk.schema ? full : num(bd.ENTRAPOUT, 2) : "", "ENTRAPOUT");
      if (!fits && nb2 > 1) sk.text((sk.X(D.beams[0].x) + sk.X(D.beams[nb2 - 1].x)) / 2, sk.Y(ymin) + 42, nb2 > 2 ? `${shown} (\xD7${nb2 - 1})` : shown, sk.isHl("ENTRAPOUT") ? "tx dl hl" : "tx dl");
    }
    sk.dimH(bn.x, bn.xr, ymin, 46, `EEXT ${num(bd.slabD.EEXT, 2)}`, "slabD.EEXT|EEXT", ymin, "r");
    sk.dimH(b0.x, xa2, ymin, 70, `DPOUT1 ${num(bd.DPOUT1, 3)}`, "DPOUT1");
    sk.dimV(bn.dy, bn.s.HPOUT + bn.dy, bn.xr + 0.2, opt.clean ? 46 : 16, `HPOUT ${num(bn.s.HPOUT, 2)}`, "beam.HPOUT|HPOUT");
    sk.dimV(bn.s.HPOUT + bn.dy, bn.s.HPOUT + bn.dy + bd.slabD.HHOUR, bn.xr + 0.2, opt.clean ? 46 : 16, `HHOUR ${num(bd.slabD.HHOUR, 2)}`, "slabD.HHOUR|HHOUR");
    return sk.svg("Coupe transversale g\xE9n\xE9rale", "Coupe transversale du tablier avec \xE9quipements, cot\xE9e");
  }
  function generalWithDetails(bd, hl, eq, mode = "geo") {
    return generalSection(bd, hl, eq, mode) + `<div class="sk-pair">${generalSection(bd, hl, eq, mode, "L")}${generalSection(bd, hl, eq, mode, "R")}</div>`;
  }
  function schemaBd(bd) {
    const b = JSON.parse(JSON.stringify(bd));
    Object.assign(b, {
      NPOUT: 4,
      NVOIE: 2,
      ETROTG: 1.5,
      EGAU: 0.5,
      ESURCH: 7,
      EDROI: 0.5,
      ETROTD: 1,
      ENTRAPOUT: 2.667,
      DPOUT1: 4.25,
      PORTEE: 30,
      ABOUT: 0.5,
      NE: 3,
      ENTINT: 0.25,
      ENTAPP: 0.3,
      HENTA: 1.25,
      HENTI: 1,
      BIAIS: 80,
      TYPOURI: [1, 1],
      DBAG: 0.9,
      PBAGMAX: 1,
      PBAGMIN: 0.9,
      DBAD: 0.6,
      PBADMAX: 1,
      PBADMIN: 0.9,
      PSTROT: 0.15
    });
    b.beam = { ...b.beam, HPOUT: 1.7, HPIED: 0.25, H1: 0.3, H2: 0.8, H3D: 0.15, H3G: 0.15, HTAB: 0.12, ETAB: 1.4, ETALON: 0.7, E1: 0.2, E2: 0.2, D3D: 0.45, D3G: 0.45, PENTPOUT: 0.02, GDA: 1, LIN: 1, EPAM: 0.16, LONGOUS: 7, PLA: 1, HPLA: 1 };
    b.slab = { HHOUR: 0.22, HAXE: 0.2, PENTSUP: 0.025, PENTINF: 0.06 };
    const cr = { AMEN: 1, H5D: 0.25, H5G: 0.25, H7D: 0.2, H7G: 0.2, H9D: 0.45, H9G: 0.45, AMORD: 0.9, AMORG: 0.9 };
    b.cross = { ...cr };
    b.slabG = { HHOUR: 0.22, HEXT: 0.18, EEXT: 1.25, PENTSUP: 0.025, PENTINF: 0, cross: { ...cr } };
    b.slabD = { HHOUR: 0.22, HEXT: 0.18, EEXT: 1.25, PENTSUP: 0.025, PENTINF: 0, cross: { ...cr } };
    return b;
  }
  function cableSchema(hl, hlPath = "") {
    const col = (hlPath.match(/cables\.\d+\.(\w+)$/) ?? [])[1] ?? "";
    const on = (c) => col === c;
    const L = 12, H = 3;
    const cs = Math.max(34, Math.min(62, (DW + 100) / (L + 1))), sk = new Sk(-0.6, L + 0.4, -0.2, H + 0.9, cs, cs, { l: 20, r: 70, t: 34, b: 74 }, "");
    sk.schema = true;
    sk.poly([[0, 0], [L, 0], [L, H], [0, H]], "beam");
    sk.poly([[0, H], [L, H], [L, H + 0.35], [0, H + 0.35]], "slab");
    sk.line(L, -0.2, L, H + 0.6, "axis");
    sk.text(sk.X(L) - 4, sk.Y(H + 0.6) - 4, "mi-trav\xE9e", "tx sm mute", "end");
    const a = { absor: 0.4, abdeco: 1.6, abfico: 7, orf: 0.35, t: 0.3 };
    const yEx = a.orf + a.t * (a.abdeco - a.absor + (a.abfico - a.abdeco) / 2);
    const yA = (x) => x <= a.abdeco ? yEx - a.t * (x - a.absor) : x >= a.abfico ? a.orf : a.orf + a.t * (a.abfico - x) ** 2 / (2 * (a.abfico - a.abdeco));
    const pA = [];
    for (let i = 0; i <= 80; i++) {
      const x = a.absor + (L - a.absor) * i / 80;
      pA.push([x, yA(x)]);
    }
    sk.pline(pA, "cab f1 sel");
    const xsD = [0.9, 3.4, 5.9, L];
    xsD.forEach((x, i) => {
      sk.circleP(sk.X(x), sk.Y(yA(x)), 3.5, "pt f1 hl");
      sk.lineP(sk.X(x), sk.Y(0) + 2, sk.X(x), sk.Y(yA(x)), "ext", true);
      if (i === 1) sk.text(sk.X(x) + 5, sk.Y(yA(x)) - 8, "points du tableau D : abscisse x, ordonn\xE9e y", on("D") ? "tx sm hl" : "tx sm", "start");
    });
    const r = { absor: 4.2, abdeco: 4.9, orf: 0.65, t: 0.42 };
    const rAbfico = r.abdeco + 2 * (H - r.t * (r.abdeco - r.absor) - r.orf) / r.t;
    const yR = (x) => x <= r.abdeco ? H - r.t * (x - r.absor) : x >= rAbfico ? r.orf : r.orf + r.t * (rAbfico - x) ** 2 / (2 * (rAbfico - r.abdeco));
    const pR = [];
    for (let i = 0; i <= 80; i++) {
      const x = r.absor + (L - r.absor) * i / 80;
      pR.push([x, yR(x)]);
    }
    sk.pline(pR, "cab f2");
    sk.poly([[r.absor - 0.35, H + 0.35], [r.absor + 0.25, H + 0.35], [r.absor + 0.25, H - 0.25], [r.absor - 0.05, H - 0.25]], on("YENCO") || on("DENCO") ? "enc hl" : "enc");
    const mk = (x, code, row2) => {
      sk.lineP(sk.X(x), sk.Y(0) + 2, sk.X(x), sk.Y(H + 0.35), on(code) ? "mk hl" : "mk", true);
      sk.dimH(0, x, 0, 16 + row2 * 18, code, on(code) ? code : "", 0, "r");
    };
    mk(a.absor, "ABSOR", 0);
    mk(a.abdeco, "ABDECO", 1);
    mk(a.abfico, "ABFICO", 2);
    sk.dimV(0, a.orf, a.abfico + 1.5, 10, "ORFICO", on("ORFICO") ? "ORFICO" : "");
    const px = sk.X(a.absor), py = sk.Y(yEx), R = 34, th = Math.atan(a.t);
    sk.top.push(`<path class="${on("ANGSOR") ? "dim hl" : "dim"}" fill="none" d="M ${r1(px + R)} ${r1(py)} A ${R} ${R} 0 0 1 ${r1(px + R * Math.cos(th))} ${r1(py + R * Math.sin(th))}"/>`);
    sk.lineP(px, py, px + R + 10, py, "ext", true);
    sk.text(px + R + 12, py + 14, "ANGSOR", on("ANGSOR") ? "tx dl hl" : "tx dl", "start");
    sk.dimH(r.absor - 0.35, r.absor + 0.25, H + 0.35, -10, "DENCO", on("DENCO") ? "DENCO" : "", H + 0.35, "l");
    sk.dimV(H - 0.25, H + 0.35, r.absor - 0.35, -8, "YENCO", on("YENCO") ? "YENCO" : "");
    sk.text(sk.X(r.absor + 0.25) + 60, sk.Y(H + 0.35) - 6, "c\xE2ble relev\xE9, ancr\xE9 dans une encoche", "tx sm", "start");
    sk.text(sk.X(a.absor), sk.Y(yEx) - 8, "c\xE2ble d'about", "tx sm", "start");
    let out = sk.svg("C\xE2ble \u2014 trac\xE9 vertical (tableau D')", "Sch\xE9ma de principe du trac\xE9 vertical d'un c\xE2ble");
    const pl = new Sk(-0.6, L + 0.4, -0.9, 0.9, cs, cs, { l: 20, r: 70, t: 14, b: 56 }, "");
    pl.schema = true;
    pl.poly([[0, -0.6], [L, -0.6], [L, 0.6], [0, 0.6]], "beam");
    pl.line(0, 0, L, 0, "axis");
    const h0 = 3, h1 = 8, E = 0.42;
    const z = (x) => x <= h0 ? 0 : x >= h1 ? E : (() => {
      const u = (x - h0) / (h1 - h0);
      return E * (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
    })();
    const pp = [];
    for (let i = 0; i <= 80; i++) {
      const x = a.absor + (L - a.absor) * i / 80;
      pp.push([x, z(x)]);
    }
    pl.pline(pp, "cab f1 sel");
    for (const [x, c] of [[h0, "ABDEHO"], [h1, "ABFIHO"]]) {
      pl.lineP(pl.X(x), pl.Y(-0.6), pl.X(x), pl.Y(0.6), on(c) ? "mk hl" : "mk", true);
      pl.dimH(0, x, -0.6, c === "ABDEHO" ? 14 : 32, c, on(c) ? c : "", -0.6, "r");
    }
    pl.dimV(0, E, L - 0.6, 8, "EXTRAN", on("EXTRAN") ? "EXTRAN" : "");
    pl.text(pl.X(0.2), pl.Y(0.6) - 4, "axe de l'\xE2me", "tx sm mute", "start");
    out += pl.svg("C\xE2ble \u2014 d\xE9viation en plan dans le talon", "Sch\xE9ma de principe de la d\xE9viation horizontale d'un c\xE2ble");
    return out;
  }

  // src/web/saisie.ts
  var EQ = {
    v: null,
    get(b) {
      if (!this.v) {
        try {
          const s = localStorage.getItem("vipp-equip");
          if (s) this.v = JSON.parse(s);
        } catch {
        }
      }
      return this.v ?? defaultEquip(b);
    },
    set(k, e, b) {
      this.v = { ...this.get(b), [k]: e };
      try {
        localStorage.setItem("vipp-equip", JSON.stringify(this.v));
      } catch {
      }
    }
  };
  var YN = [[0, "non"], [1, "oui"]];
  var shapeFields = (pre) => [
    { g: "Contour", f: [
      { p: pre + "HPOUT", c: "HPOUT", l: "Hauteur de la poutre (dans l'axe)", u: "m" },
      { p: pre + "ETAB", c: "ETAB", l: "Largeur de la table de compression", u: "m" },
      { p: pre + "ETALON", c: "ETALON", l: "Largeur du talon", u: "m" },
      { p: pre + "HPIED", c: "HPIED", l: "Hauteur du pied de talon (partie verticale)", u: "m" },
      { p: pre + "H1", c: "H1", l: "Hauteur du chanfrein du talon", u: "m" },
      { p: pre + "H2", c: "H2", l: "Hauteur de l'\xE2me", u: "m" },
      { p: pre + "E1", c: "E1", l: "\xC9paisseur d'\xE2me en bas (jonction talon)", u: "m" },
      { p: pre + "E2", c: "E2", l: "\xC9paisseur d'\xE2me en haut (sous goussets)", u: "m" },
      { p: pre + "HTAB", c: "HTAB", l: "\xC9paisseur de la table \xE0 son extr\xE9mit\xE9", u: "m" },
      { p: pre + "PENTPOUT", c: "PENTPOUT", l: "Pente du dessus de la table", u: "m/m", h: "Positive vers la droite (0,025 = 2,5 %)." }
    ] },
    { g: "Goussets sup\xE9rieurs", m: { cols: [["gauche", "G"], ["droit", "D"]], rows: [
      [pre + "H3", "H3", "Hauteur du gousset", "m"],
      [pre + "D3", "D3", "D\xE9bord de table au-del\xE0 du gousset", "m"]
    ] } },
    { g: "Sur\xE9paisseur d'\xE2me sur appui", f: [
      { p: pre + "GDA", c: "GOUDAM", l: "\xC9paississement de l'\xE2me", t: "sel", o: [[0, "0 \u2014 aucun"], [1, "1 \u2014 goussets non renforc\xE9s"], [2, "2 \u2014 goussets renforc\xE9s"]], re: true },
      { p: pre + "LIN", c: "LIN", l: "Loi de variation", t: "sel", o: [[0, "0 \u2014 discontinue"], [1, "1 \u2014 lin\xE9aire"]] },
      { p: pre + "EPAM", c: "EPAM", l: "Sur\xE9paisseur totale de l'\xE2me sur appui", u: "m" },
      { p: pre + "LONGOUS", c: "LONGOUS", l: "Longueur de variation, depuis l'axe d'appui", u: "m" }
    ] },
    { g: "Plaque d'about", f: [
      { p: pre + "PLA", c: "PLAB", l: "Plaque d'about pr\xE9fabriqu\xE9e", t: "sel", o: YN },
      { p: pre + "HPLA", c: "HPLA", l: "Hauteur de la plaque d'about", u: "m" }
    ] }
  ];
  var crossRows = (pfx) => [
    [pfx + "AMEN", "AMEN", "Amorces d'entretoises sur la poutre", "", "sel", YN]
  ];
  function deriveGeometry(b, debord = 0.5, fill = false) {
    const r = (x, d = 5e-3) => Math.round(x / d) * d, r3 = (x) => Math.round(x * 1e3) / 1e3;
    const put = (o, k, v) => {
      if (!fill || !(o[k] > 0)) o[k] = v;
    };
    const n = b.NPOUT, H = b.beam.HPOUT, T = b.beam.ETAB, L = b.PORTEE, hh = b.slab.HHOUR;
    if (H > 0) {
      const s = b.beam, small = H < 1.5;
      if (!fill) s.PENTPOUT = 0;
      put(s, "ETALON", small ? 0.6 : 0.8);
      put(s, "E1", small ? 0.2 : 0.22);
      put(s, "E2", small ? 0.2 : 0.22);
      put(s, "HPIED", r(Math.min(0.25, Math.max(0.15, 0.1 * H)), 0.01));
      put(s, "H1", r3(r((s.ETALON - s.E1) / 2 * 1.2, 0.01)));
      put(s, "H3D", 0.12);
      put(s, "H3G", 0.12);
      put(s, "HTAB", 0.12);
      if (T > 0) {
        put(s, "D3D", r3(Math.max(0.1, (T - s.E2) / 2 - 0.13)));
        put(s, "D3G", r3(Math.max(0.1, (T - s.E2) / 2 - 0.13)));
      }
      put(s, "H2", r3(H - s.HPIED - s.H1 - Math.max(s.H3D, s.H3G) - s.HTAB));
      if (!fill || !(s.GDA > 0)) {
        s.GDA = 1;
        s.LIN = 1;
      }
      put(s, "EPAM", 0.16);
      if (L > 0) put(s, "LONGOUS", r(L / 4, 0.25));
      if (!fill) {
        s.PLA = 0;
        s.HPLA = 0;
      }
      b.beamRive = JSON.parse(JSON.stringify(s));
      b.TYPOURI = [1, 1];
      put(b, "HENTA", r3(Math.max(0.5, H - 0.4)));
      if (!fill) {
        b.HENTI = 0;
        b.NE = 2;
        b.ENTINT = 0;
      }
      put(b, "ENTAPP", 0.4);
      const cr = { AMEN: 1, H5D: 0.2, H5G: 0.2, H7D: 0, H7G: 0, H9D: r3(Math.max(0.3, 0.2 * H)), H9G: r3(Math.max(0.3, 0.2 * H)), AMORD: 0.75, AMORG: 0.75 };
      for (const c of [b.cross, b.slabG.cross, b.slabD.cross]) for (const [k, v] of Object.entries(cr)) put(c, k, v);
    }
    if (hh > 0) {
      put(b.slab, "HAXE", hh);
      if (!fill) {
        b.slab.PENTSUP = 0.025;
        b.slab.PENTINF = 0.025;
      } else {
        put(b.slab, "PENTSUP", 0.025);
      }
      for (const e of [b.slabG, b.slabD]) {
        put(e, "HHOUR", hh);
        put(e, "HEXT", r3(Math.max(0.16, hh - 0.04)));
        if (!fill) {
          e.PENTSUP = 0.025;
          e.PENTINF = 0;
        } else put(e, "PENTSUP", 0.025);
      }
    }
    if (n >= 2 && T > 0) {
      const W = b.ETROTG + b.EGAU + b.ESURCH + b.EDROI + b.ETROTD, e = r3(T / 2 + Math.max(0, debord));
      put(b.slabG, "EEXT", e);
      put(b.slabD, "EEXT", e);
      const eg = b.slabG.EEXT, ed = b.slabD.EEXT;
      if (W - eg - ed > 0) {
        b.ENTRAPOUT = r3((W - eg - ed) / (n - 1));
        b.DPOUT1 = r3(b.ETROTG + b.EGAU + b.ESURCH / 2 - eg);
      }
    }
    if (!(b.PORTEE > 0) && !fill) {
    }
  }
  var hConseil = (L) => L > 0 ? Math.round(L / 17.5 / 0.05) * 0.05 : 0;
  var STEPS = [
    {
      id: "principal",
      t: "Dimensions principales",
      lines: "travers \xB7 poutre \xB7 hourdis",
      custom: "principal",
      intro: "Profil en travers, poutre et hourdis de l'ouvrage. Les dimensions non saisies (position des poutres, entretoises, sur\xE9paisseur d'\xE2me\u2026) sont compl\xE9t\xE9es dans les proportions courantes des VIPP et restent modifiables aux \xE9tapes suivantes.",
      sk: (b, hl) => generalSection(b, hl, EQ.get(b), "geo"),
      gs: [
        { g: "Profil en travers (de gauche \xE0 droite)", f: [
          { p: "ETROTG", c: "ETROTG", l: "Trottoir G", u: "m", h: "Largeur du trottoir gauche." },
          { p: "EGAU", c: "EGAU", l: "Bande G", u: "m", h: "Bande d\xE9ras\xE9e gauche." },
          { p: "ESURCH", c: "ESURCH", l: "Chargeable", u: "m", h: "Largeur chargeable de la chauss\xE9e." },
          { p: "EDROI", c: "EDROI", l: "Bande D", u: "m", h: "Bande d\xE9ras\xE9e droite." },
          { p: "ETROTD", c: "ETROTD", l: "Trottoir D", u: "m", h: "Largeur du trottoir droit." },
          { p: "NPOUT", c: "NPOUT", l: "Nb poutres", t: "i", min: 2, h: "Nombre de poutres." }
        ] },
        { g: "Poutre", f: [
          ...(shapeFields("beam.")[0].f ?? []).map((f2) => ({ ...f2, l: { HPOUT: "Hauteur", ETAB: "Table", ETALON: "Talon", HPIED: "Pied talon", H1: "Chanfrein", H2: "\xC2me", E1: "\xC2me bas", E2: "\xC2me haut", HTAB: "Bout table", PENTPOUT: "Pente table" }[f2.c] ?? f2.l, h: f2.l + (f2.h ? ". " + f2.h : "") })),
          { p: "beam.H3G", c: "H3G", l: "Gousset G", u: "m", h: "Hauteur du gousset gauche." },
          { p: "beam.D3G", c: "D3G", l: "D\xE9bord G", u: "m", h: "D\xE9bord de table au-del\xE0 du gousset gauche." },
          { p: "beam.H3D", c: "H3D", l: "Gousset D", u: "m", h: "Hauteur du gousset droit." },
          { p: "beam.D3D", c: "D3D", l: "D\xE9bord D", u: "m", h: "D\xE9bord de table au-del\xE0 du gousset droit." }
        ] },
        { g: "Hourdis", m: { cols: [["enc. gauche", "slabG."], ["courant", "slab."], ["enc. droit", "slabD."]], rows: [
          ["HHOUR", "HHOUR", "\xC9paisseur dans l'axe de la poutre", "m"],
          ["", "HAXE / HEXT", "\xC9paisseur \xE0 mi-distance (courant) ou en bout d'encorbellement", "m"],
          ["EEXT", "EEXT", "Largeur de l'encorbellement depuis l'axe de la poutre de rive", "m"],
          ["PENTSUP", "PENTSUP", "Pente du dessus", "m/m"],
          ["PENTINF", "PENTINF", "Pente du dessous", "m/m"]
        ] } }
      ]
    },
    {
      id: "ouvrage",
      t: "Ouvrage",
      lines: "Titre \xB7 ligne 4",
      top: true,
      intro: "Identification du calcul et choix des poutres \xE0 justifier. Les poutres retenues sont rep\xE9r\xE9es en or sur la coupe.",
      sk: (b) => generalSection(b, "", EQ.get(b), "calc"),
      gs: [{ g: "Identification", f: [
        { p: "titre.0", c: "TITRE 1", l: "Ma\xEEtre d'ouvrage / bureau d'\xE9tudes", t: "s" },
        { p: "titre.1", c: "TITRE 2", l: "Ouvrage", t: "s" },
        { p: "titre.2", c: "TITRE 3", l: "Pr\xE9cision (trav\xE9e, variante\u2026)", t: "s" },
        { p: "numero", c: "NO", l: "Num\xE9ro du calcul", t: "s" },
        { p: "date", c: "DATE", l: "Date (jj.mm.aa)", t: "s" },
        { p: "poutresACalculer", c: "POUTRES", l: "Poutres \xE0 calculer (ex. 1 2 3)", t: "list", h: "Num\xE9rot\xE9es de gauche \xE0 droite, de 1 \xE0 NPOUT. Chaque poutre doit appartenir \xE0 un c\xE2blage (\xE9tape C\xE2blages)." },
        { p: "SYMTAB", c: "SYMTAB", l: "Tablier sym\xE9trique", t: "sel", o: [[0, "0 \u2014 non"], [1, "1 \u2014 oui"]] }
      ] }]
    },
    {
      id: "travers",
      t: "Profil en travers",
      lines: "A1",
      top: true,
      custom: "equip",
      intro: "R\xE9partition de la largeur et position des poutres. L'axe de la chauss\xE9e (tiret\xE9) sert d'origine \xE0 DPOUT1. La coupe g\xE9n\xE9rale se met \xE0 jour \xE0 chaque saisie ; les dispositifs de retenue dessin\xE9s se choisissent plus bas.",
      sk: (b, hl) => generalWithDetails(b, hl, EQ.get(b), "geo"),
      gs: [
        { g: "Largeurs (de gauche \xE0 droite)", f: [
          { p: "ETROTG", c: "ETROTG", l: "Trottoir gauche", u: "m" },
          { p: "EGAU", c: "EGAU", l: "Bande d\xE9ras\xE9e gauche", u: "m" },
          { p: "ESURCH", c: "ESURCH", l: "Largeur chargeable", u: "m" },
          { p: "EDROI", c: "EDROI", l: "Bande d\xE9ras\xE9e droite", u: "m" },
          { p: "ETROTD", c: "ETROTD", l: "Trottoir droit", u: "m" },
          { p: "NVOIE", c: "NVOIE", l: "Nombre de voies (0 = r\xE8gle du fascicule 61)", t: "i" }
        ] },
        { g: "Poutres", f: [
          { p: "NPOUT", c: "NPOUT", l: "Nombre de poutres", t: "i", min: 2, re: true },
          { p: "ENTRAPOUT", c: "ENTRAPOUT", l: "Entraxe des poutres", u: "m" },
          { p: "DPOUT1", c: "DPOUT1", l: "Distance de l'axe de la chauss\xE9e \xE0 l'axe de la poutre 1", u: "m", h: "Distance, en valeur absolue, de l'axe de la poutre de gauche num\xE9rot\xE9e 1 \xE0 l'axe de la chauss\xE9e proprement dite." }
        ] }
      ]
    },
    {
      id: "travee",
      t: "Trav\xE9e",
      lines: "A1 \xB7 A3",
      top: true,
      intro: "Port\xE9e, about, biais et entretoises. L'\xE9l\xE9vation est dessin\xE9e avec une \xE9chelle verticale dilat\xE9e.",
      sk: (b, hl) => spanViews(b, hl),
      gs: [
        { g: "Trav\xE9e", f: [
          { p: "PORTEE", c: "PORTEE", l: "Port\xE9e entre axes d'appui", u: "m" },
          { p: "ABOUT", c: "ABOUT", l: "About (extr\xE9mit\xE9 de poutre \u2014 axe d'appui)", u: "m" },
          { p: "BIAIS", c: "BIAIS", l: "Biais (100 = ouvrage droit)", u: "gr" },
          { p: "NT", c: "NT", l: "NT", t: "i" }
        ] },
        { g: "Entretoises", f: [
          { p: "NE", c: "NE", l: "Nombre d'entretoises (2 = abouts seuls)", t: "i" },
          { p: "ENTAPP", c: "ENTAPP", l: "\xC9paisseur des entretoises d'about", u: "m" },
          { p: "HENTA", c: "HENTA", l: "Retomb\xE9e des entretoises d'about sous le hourdis", u: "m" },
          { p: "ENTINT", c: "ENTINT", l: "\xC9paisseur des entretoises interm\xE9diaires", u: "m" },
          { p: "HENTI", c: "HENTI", l: "Retomb\xE9e des entretoises interm\xE9diaires", u: "m" }
        ] }
      ]
    },
    {
      id: "poutre",
      t: "Poutre",
      lines: "A2 \xB7 A4",
      intro: "Contour de la poutre pr\xE9fabriqu\xE9e courante. La sur\xE9paisseur d'\xE2me sur appui est trac\xE9e en tiret\xE9.",
      sk: (b, hl, path) => beamSection(b, hl, /^beamRive\./.test(path)),
      gs: [
        ...shapeFields("beam."),
        { g: "Poutres de rive", f: [
          { p: "TYPOURI.0", c: "TYPOURI G", l: "Poutre de rive gauche", t: "sel", o: [[1, "1 \u2014 identique"], [0, "0 \u2014 g\xE9om\xE9trie propre"]], re: true },
          { p: "TYPOURI.1", c: "TYPOURI D", l: "Poutre de rive droite", t: "sel", o: [[1, "1 \u2014 identique"], [0, "0 \u2014 g\xE9om\xE9trie propre"]], re: true }
        ] },
        ...shapeFields("beamRive.").map((g) => ({ ...g, g: "Rive \xB7 " + g.g, when: (b) => b.TYPOURI[0] === 0 || b.TYPOURI[1] === 0 }))
      ]
    },
    {
      id: "hourdis",
      t: "Hourdis",
      lines: "A3 \xB7 A5 \xB7 A6",
      intro: "Hourdis coul\xE9 en place et encorbellements. Le croquis montre le c\xF4t\xE9 de la donn\xE9e en cours de saisie.",
      sk: (b, hl, path) => slabZoom(b, hl, path),
      gs: [
        { g: "\xC9paisseurs et pentes", m: { cols: [["enc. gauche", "slabG."], ["courant", "slab."], ["enc. droit", "slabD."]], rows: [
          ["HHOUR", "HHOUR", "\xC9paisseur dans l'axe de la poutre", "m"],
          ["", "HAXE / HEXT", "\xC9paisseur \xE0 mi-distance (courant) ou en bout d'encorbellement", "m"],
          ["EEXT", "EEXT", "Largeur de l'encorbellement depuis l'axe de la poutre de rive", "m"],
          ["PENTSUP", "PENTSUP", "Pente du dessus", "m/m"],
          ["PENTINF", "PENTINF", "Pente du dessous", "m/m"]
        ] } }
      ]
    },
    {
      id: "entretoises",
      t: "Amorces",
      lines: "A3 \xB7 A5 \xB7 A6",
      intro: "Amorces d'entretoises d'about port\xE9es par les poutres pr\xE9fabriqu\xE9es, et partie coul\xE9e en place.",
      sk: (b, hl, path) => crossBeamView(b, hl, path),
      gs: [
        { g: "Amorces d'entretoises d'about", m: { cols: [["poutre de rive G", "slabG.cross."], ["poutres courantes", "cross."], ["poutre de rive D", "slabD.cross."]], rows: [
          ...crossRows(""),
          ["AMORG", "AMORG", "Longueur de l'amorce c\xF4t\xE9 gauche (depuis l'axe)", "m"],
          ["AMORD", "AMORD", "Longueur de l'amorce c\xF4t\xE9 droit (depuis l'axe)", "m"],
          ["H5G", "H5G", "Cote de la sous-face au nu de l'\xE2me, c\xF4t\xE9 gauche", "m"],
          ["H5D", "H5D", "Cote de la sous-face au nu de l'\xE2me, c\xF4t\xE9 droit", "m"],
          ["H7G", "H7G", "Remont\xE9e de la sous-face jusqu'au bout de l'amorce, gauche", "m"],
          ["H7D", "H7D", "Remont\xE9e de la sous-face jusqu'au bout de l'amorce, droite", "m"],
          ["H9G", "H9G", "Cote de la sous-face en bout d'amorce, gauche", "m"],
          ["H9D", "H9D", "Cote de la sous-face en bout d'amorce, droite", "m"]
        ] }, note: "Cotes mesur\xE9es depuis la sous-face de la poutre. La retomb\xE9e HENTA de la partie coul\xE9e en place se saisit \xE0 l'\xE9tape Trav\xE9e." }
      ]
    },
    {
      id: "charges",
      t: "Charges",
      lines: "B1 \xB7 B2 \xB7 B3",
      intro: "Poids propres, \xE9quipements et charges d'exploitation du fascicule 61 titre II.",
      sk: (b, hl) => crossSection(b, hl, "charges"),
      custom: "qsup",
      gs: [
        { g: "Poids propres", f: [
          { p: "MASVOL", c: "MASVOL", l: "Masse volumique du b\xE9ton", u: "t/m\xB3" },
          { p: "OSSAMAXP", c: "OSSAMAX P", l: "Coefficient max. sur le poids des poutres", t: "n" },
          { p: "OSSAMINP", c: "OSSAMIN P", l: "Coefficient min. sur le poids des poutres", t: "n" },
          { p: "OSSAMAXH", c: "OSSAMAX H", l: "Coefficient max. sur le poids du hourdis", t: "n" },
          { p: "OSSAMINH", c: "OSSAMIN H", l: "Coefficient min. sur le poids du hourdis", t: "n" },
          { p: "PDALMAX", c: "PREDALMAX", l: "Pr\xE9dalles, valeur max. par intervalle", u: "t/m" },
          { p: "PDALMIN", c: "PREDALMIN", l: "Pr\xE9dalles, valeur min. par intervalle", u: "t/m" }
        ] },
        { g: "Barri\xE8res et corniches", m: { cols: [["gauche", "G"], ["droite", "D"]], rows: [
          ["DBA", "DBAG / DBAD", "Distance au bord de la largeur chargeable", "m"],
          ["PBA\xB7MAX", "PBAMAX", "Poids lin\xE9ique max.", "t/m"],
          ["PBA\xB7MIN", "PBAMIN", "Poids lin\xE9ique min.", "t/m"]
        ] } },
        { g: "Charges d'exploitation", f: [
          { p: "CLASSE", c: "CLASSE", l: "Classe du pont", t: "sel", o: [[1, "1re classe"], [2, "2e classe"], [3, "3e classe"]] },
          { p: "A", c: "A", l: "Charge A(l)", t: "sel", o: YN },
          { p: "B", c: "B", l: "Syst\xE8me B (Bc, Bt)", t: "sel", o: YN },
          { p: "CM", c: "CM", l: "Charges militaires", t: "sel", o: [[0, "0 \u2014 aucune"], [4, "4 \u2014 Mc 120 / Me 120"]] },
          { p: "CE", c: "CE", l: "Convoi exceptionnel", t: "sel", o: [[0, "0 \u2014 aucun"], [1, "1 \u2014 convoi D"], [2, "2 \u2014 convoi E"]] },
          { p: "PSTROT", c: "PSTROT", l: "Charge des trottoirs", u: "t/m\xB2" },
          { p: "A1", c: "A1", l: "A(l) = A1 + A2 / (A3 + L) \u2014 A1 (0 = 0,23)", u: "t/m\xB2" },
          { p: "A2", c: "A2", l: "A2 (0 = 36)", t: "n" },
          { p: "A3", c: "A3", l: "A3 (0 = 12)", u: "m" }
        ] }
      ]
    },
    {
      id: "materiaux",
      t: "Mat\xE9riaux",
      lines: "C1 \xB7 C2",
      intro: "B\xE9tons de la poutre et du hourdis, aciers passifs et coefficients d'\xE9quivalence.",
      sk: (b, hl) => materialsView(b, hl),
      gs: [
        { g: "B\xE9tons", f: [
          { p: "CLASSEBP", c: "CL BP", l: "Classe de v\xE9rification BPEL", t: "sel", o: [[1, "classe I"], [2, "classe II"], [3, "classe III"]] },
          { p: "POISSON", c: "POIS", l: "Coefficient de Poisson", t: "n" },
          { p: "FC11", c: "FC1", l: "Poutre : fcj \xE0 la 1re mise en tension", u: "MPa" },
          { p: "FC12", c: "FC2", l: "Poutre : fcj \xE0 la 2e partie de la 1re famille", u: "MPa" },
          { p: "FC28", c: "FC28", l: "Poutre : fc28", u: "MPa" },
          { p: "FC4H", c: "FC4H", l: "Hourdis : fcj \xE0 la tension de la 2e famille", u: "MPa" },
          { p: "FC5H", c: "FC5H", l: "Hourdis : fcj \xE0 la pose des superstructures", u: "MPa" },
          { p: "FC28H", c: "FC28H", l: "Hourdis : fc28", u: "MPa" },
          { p: "EPSR", c: "EPS R", l: "Retrait final \u03B5r", u: "\xD710\u207B\u2074" }
        ] },
        { g: "Aciers passifs", f: [
          { p: "FE1", c: "FE1", l: "Limite \xE9lastique des aciers longitudinaux", u: "MPa" },
          { p: "SIGS", c: "SIGS", l: "Contrainte limite en service", u: "MPa" },
          { p: "TYPEAP", c: "TYPE", l: "Type d'aciers (1 = haute adh\xE9rence)", t: "i" },
          { p: "DAP", c: "D", l: "Distance de l'axe des aciers au parement", u: "m" },
          { p: "ES", c: "ES", l: "Module d'\xE9lasticit\xE9", u: "MPa" },
          { p: "FE2", c: "FE2", l: "Limite \xE9lastique des armatures d'effort tranchant", u: "MPa" }
        ] },
        { g: "Coefficients d'\xE9quivalence et relaxation", f: [
          { p: "NH", c: "NH", l: "NH", t: "n" },
          { p: "NS3", c: "NS3", l: "NS3", t: "n" },
          { p: "NP3", c: "NP3", l: "NP3", t: "n" },
          { p: "NP0", c: "NP0", l: "Coefficient d'\xE9quivalence acier de pr\xE9contrainte / b\xE9ton (instantan\xE9)", t: "n" },
          { p: "RO", c: "RO", l: "RO (0 = relaxation par \u03C11000)", t: "n" },
          { p: "SPSI1", c: "S.PSI1", l: "S.PSI1", t: "n" },
          { p: "DFPRG", c: "D.FPRG", l: "D.FPRG", t: "n" },
          { p: "KTABF", c: "KF", l: "KF", t: "i" }
        ] }
      ]
    },
    {
      id: "precontrainte",
      t: "Pr\xE9contrainte",
      lines: "C3 \xB7 C4 \xB7 C5",
      intro: "Syst\xE8mes de pr\xE9contrainte (deux au plus) et dates du phasage, compt\xE9es en \xE2ge du b\xE9ton de la poutre.",
      sk: (b, hl) => phasingView(b, hl),
      gs: [
        { g: "Syst\xE8mes", m: { cols: [["syst\xE8me 1", "systems.0."], ["syst\xE8me 2", "systems.1."]], rows: [
          ["ARMA", "ARMA", "R\xE9f\xE9rence de l'armature (rappel\xE9e en D')", "", "i"],
          ["FPRG", "FPRG", "Contrainte de rupture garantie", "MPa"],
          ["FPEG", "FPEG", "Limite \xE9lastique garantie", "MPa"],
          ["SIGP0", "SIGPO", "Tension \xE0 l'origine", "MPa"],
          ["EP", "EP", "Module d'\xE9lasticit\xE9", "MPa"],
          ["SECAB", "SECAB", "Section d'un c\xE2ble", "mm\xB2"],
          ["DGAINE", "DGAINE", "Diam\xE8tre ext\xE9rieur de la gaine", "m"],
          ["ENROB", "ENROB", "Enrobage de la gaine", "m"],
          ["DECAL", "DECAL", "D\xE9calage du c\xE2ble dans la gaine", "m"],
          ["F", "F", "Coefficient de frottement en courbe f", "/rad"],
          ["PHI", "PHI", "Coefficient de perte en ligne \u03C6", "/m"],
          ["RECUL", "RECUL", "Recul \xE0 l'ancrage", "m"],
          ["R1000", "R1000", "Relaxation \xE0 1000 h \u03C11000", "%"],
          ["NGA", "NG", "Nombre de gaines par lit", "", "i"],
          ["TYPE", "TYPE", "Loi de l'acier (1 \xE9lasto-plastique, 2 BPEL)", "", "i"],
          ["AV", "AV", "AV", "m"],
          ["AH", "AH", "AH", "m"]
        ] } },
        { g: "Phasage (jours)", f: [
          { p: "J.J1", c: "J1", l: "Mise en tension de la 1re famille", t: "i" },
          { p: "J.J2", c: "J2", l: "Tension de la 2e partie de la 1re famille", t: "i" },
          { p: "J.J3", c: "J3", l: "B\xE9tonnage du hourdis", t: "i" },
          { p: "J.J4", c: "J4", l: "Mise en tension de la 2e famille", t: "i" },
          { p: "J.J5", c: "J5", l: "Mise en place des superstructures", t: "i" },
          { p: "J.J6", c: "J6", l: "Mise en service", t: "i" },
          { p: "J.J999", c: "J7", l: "J7", t: "i" },
          { p: "J.JSUP", c: "JSUP", l: "JSUP", t: "i" }
        ] }
      ]
    },
    {
      id: "cables",
      t: "C\xE2blages",
      lines: "C6 \xB7 D \xB7 D'",
      intro: "Trac\xE9 des c\xE2bles par c\xE2blage : abscisses de d\xE9finition, ordonn\xE9es des axes de gaine (tableau D) et caract\xE9ristiques compl\xE9mentaires (tableau D').",
      sk: () => "",
      custom: "cables",
      gs: []
    }
  ];
  var DCOLS = [
    ["num", "NUM", "Num\xE9ro du c\xE2ble", "i"],
    ["ARMA", "ARMA", "R\xE9f\xE9rence de l'armature (syst\xE8me C3/C4)", "i"],
    ["SECAB", "SECAB", "Section du c\xE2ble (mm\xB2)", "n"],
    ["SIGP0", "SIGPO", "Tension \xE0 l'origine (MPa)", "n"],
    ["ANPA", "MODE", "Mise en tension : 1 par une extr\xE9mit\xE9, 2 par les deux", "i"],
    ["SYM", "NCASY", "Num\xE9ro du c\xE2ble sym\xE9trique", "i"],
    ["ABDECO", "ABDECO", "Abscisse du d\xE9but de la courbe verticale (m)", "n"],
    ["ORFICO", "ORFICO", "Ordonn\xE9e de l'axe de gaine en fin de courbe (m)", "n"],
    ["ABFICO", "ABFICO", "Abscisse de fin de la courbe verticale (m)", "n"],
    ["ABSOR", "ABSOR", "Abscisse de sortie du c\xE2ble (m)", "n"],
    ["ANGSOR", "ANGSOR", "Angle vertical de sortie (gr)", "n"],
    ["EXTRAN", "EXTRAN", "D\xE9placement transversal du c\xE2ble (m)", "n"],
    ["ABDEHO", "ABDEHO", "Abscisse du d\xE9but de la courbe horizontale (m)", "n"],
    ["ABFIHO", "ABFIHO", "Abscisse de fin de la courbe horizontale (m)", "n"],
    ["YENCO", "YENCO", "Profondeur de l'encoche d'ancrage (m)", "n"],
    ["DENCO", "DENCO", "Largeur de l'encoche d'ancrage (m)", "n"]
  ];
  var get = (o, p) => p.split(".").reduce((a, k) => a == null ? a : a[k], o);
  function set(o, p, v) {
    const ks = p.split(".");
    const last = ks.pop();
    const t = ks.reduce((a, k) => a[k], o);
    t[last] = v;
  }
  var fmt = (v, t = "n") => t === "list" ? (v ?? []).join(" ") : t === "s" ? v ?? "" : v == null || !isFinite(v) ? "" : String(+(+v).toFixed(6));
  var esc2 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  function matrixCell(col, row2, code) {
    if (col === "G" || col === "D") {
      if (row2 === "DBA") return { p: "DBA" + col, c: "DBA" + col };
      if (row2.startsWith("PBA\xB7")) return { p: "PBA" + col + row2.slice(4), c: "PBA" + col + row2.slice(4) };
      return { p: row2 + col, c: code + col };
    }
    if (code === "HAXE / HEXT") return col === "slab." ? { p: "slab.HAXE", c: "HAXE" } : { p: col + "HEXT", c: "HEXT" };
    if (row2 === "EEXT" && col === "slab.") return null;
    if (col.startsWith("systems.")) return { p: col + row2, c: code };
    return { p: col + row2, c: code };
  }
  var CODEMAP = null;
  function codeMap() {
    if (CODEMAP) return CODEMAP;
    const m = /* @__PURE__ */ new Map(), add2 = (c, p) => {
      if (!/^[A-Z][A-Z0-9.]*$/.test(c)) return;
      const l = m.get(c) ?? [];
      if (!l.includes(p)) l.push(p);
      m.set(c, l);
    };
    for (const st of STEPS) for (const g of st.gs) {
      g.f?.forEach((f2) => add2(f2.c, f2.p));
      if (g.m) for (const [row2, code] of g.m.rows) for (const [, col] of g.m.cols) {
        const cell = matrixCell(col, row2, code);
        if (cell) add2(cell.c, cell.p);
      }
    }
    return CODEMAP = m;
  }
  var fv = (v) => {
    if (typeof v === "number" && isFinite(v)) return String(Math.round(v * 1e3) / 1e3).replace(".", ",");
    if (Array.isArray(v) && v.every((x) => typeof x === "number")) return v.join(" ");
    return void 0;
  };
  function checks(b) {
    const out = [];
    const E = (step, msg, p) => out.push({ step, level: "err", msg, p });
    const W = (step, msg, p) => out.push({ step, level: "warn", msg, p });
    const n = b.NPOUT;
    if (b.PORTEE > 0 && b.beam.HPOUT > 0) {
      const k = b.PORTEE / b.beam.HPOUT;
      if (k > 22 || k < 14) W("principal", `\xC9lancement L/HPOUT = ${k.toFixed(1)} : inhabituel pour une VIPP (couramment 16 \xE0 19).`, "beam.HPOUT");
    }
    if (n >= 2 && b.ENTRAPOUT > 0 && b.beam.ETAB >= b.ENTRAPOUT) E("principal", `La table des poutres (ETAB = ${b.beam.ETAB}) est plus large que l'entraxe (${b.ENTRAPOUT.toFixed(3)} m) : r\xE9duire ETAB ou le nombre de poutres.`, "beam.ETAB");
    if (n >= 2 && b.ENTRAPOUT > 0 && b.ENTRAPOUT - b.beam.ETAB < 0.3 && b.beam.ETAB < b.ENTRAPOUT) W("principal", `Espace entre tables ${(b.ENTRAPOUT - b.beam.ETAB).toFixed(2)} m : faible pour les pr\xE9dalles.`, "beam.ETAB");
    if (b.PORTEE > 0 && !(n >= 2)) E("principal", "Il faut au moins 2 poutres.", "NPOUT");
    if (!(n >= 2)) E("travers", "Il faut au moins 2 poutres.", "NPOUT");
    if (!(b.ESURCH > 0)) E("travers", "La largeur chargeable ESURCH doit \xEAtre positive.", "ESURCH");
    try {
      const L = layout(b);
      const left = L.xBeam[0] - b.slabG.EEXT, right = L.xBeam[n - 1] + b.slabD.EEXT;
      if (Math.abs(left) > 0.01) W("travers", `Le bord gauche du hourdis (poutre 1 \u2212 EEXT) tombe \xE0 ${left.toFixed(3)} m du bord du tablier : v\xE9rifier DPOUT1, ENTRAPOUT et EEXT gauche.`, "DPOUT1");
      if (Math.abs(right - L.width) > 0.01) W("travers", `Le bord droit du hourdis tombe \xE0 ${(right - L.width).toFixed(3)} m du bord du tablier : v\xE9rifier ENTRAPOUT et EEXT droit.`, "ENTRAPOUT");
    } catch {
    }
    if (!b.poutresACalculer.length) E("ouvrage", "Indiquer au moins une poutre \xE0 calculer.", "poutresACalculer");
    for (const [sd, sl, lab] of [["G", b.slabG, "gauche"], ["D", b.slabD, "droite"]]) {
      const tab = ((sd === "G" ? b.TYPOURI[0] : b.TYPOURI[1]) === 0 && b.beamRive ? b.beamRive : b.beam).ETAB / 2;
      if (sl.EEXT - tab < 0.05) W("travers", `Poutre de rive ${lab} au nu du tablier : le hourdis n'a pas d'encorbellement (EEXT ${sl.EEXT.toFixed(2)} m \u2264 demi-table ${tab.toFixed(2)} m). Utiliser \xAB Mettre les poutres de rive en retrait \xBB pour cr\xE9er un d\xE9bord.`, `slab${sd}.EEXT`);
    }
    for (const p of b.poutresACalculer) if (p < 1 || p > n) E("ouvrage", `La poutre ${p} n'existe pas (1 \xE0 ${n}).`, "poutresACalculer");
    if (!(b.PORTEE > 0)) E("travee", "La port\xE9e doit \xEAtre positive.", "PORTEE");
    if (b.BIAIS <= 0 || b.BIAIS > 100) E("travee", "Le biais doit \xEAtre compris entre 0 et 100 gr (100 = droit).", "BIAIS");
    if (b.NE < 2) W("travee", "NE < 2 : pas d'entretoise d'about.", "NE");
    const shp = (s, pre, step) => {
      const yT = s.HPIED + s.H1, yW = yT + s.H2;
      if (!(s.HPOUT > 0)) {
        E(step, "Hauteur de poutre nulle.", pre + "HPOUT");
        return;
      }
      if (yW + Math.max(s.H3D, s.H3G) > s.HPOUT - s.HTAB + 1e-6) E(step, `HPIED + H1 + H2 + H3 = ${(yW + Math.max(s.H3D, s.H3G)).toFixed(3)} m d\xE9passe HPOUT \u2212 HTAB = ${(s.HPOUT - s.HTAB).toFixed(3)} m.`, pre + "H2");
      if (s.E1 > s.ETALON) E(step, "L'\xE2me (E1) est plus large que le talon.", pre + "E1");
      if (s.E2 / 2 > s.ETAB / 2 - Math.max(s.D3D, s.D3G)) E(step, "Le gousset est plus large que la table : r\xE9duire D3 ou E2.", pre + "D3D");
      if (s.GDA > 0 && s.EPAM <= 0) W(step, "\xC9paississement d'\xE2me demand\xE9 (GOUDAM > 0) sans sur\xE9paisseur EPAM.", pre + "EPAM");
    };
    shp(b.beam, "beam.", "poutre");
    if ((b.TYPOURI[0] === 0 || b.TYPOURI[1] === 0) && b.beamRive) shp(b.beamRive, "beamRive.", "poutre");
    if (b.slab.HAXE <= 0 || b.slab.HHOUR <= 0) E("hourdis", "\xC9paisseurs du hourdis nulles.", "slab.HHOUR");
    for (const [s, side] of [[b.slabG, "gauche"], [b.slabD, "droit"]]) if (s.EEXT < b.beam.ETAB / 2) W("hourdis", `Encorbellement ${side} plus court que la demi-table de la poutre.`, (side === "gauche" ? "slabG" : "slabD") + ".EEXT");
    const Js = [b.J.J1, b.J.J3, b.J.J4, b.J.J5, b.J.J6];
    for (let i = 1; i < Js.length; i++) if (Js[i] < Js[i - 1]) E("precontrainte", "Les dates du phasage doivent cro\xEEtre : J1 \u2264 J3 \u2264 J4 \u2264 J5 \u2264 J6.", "J.J1");
    if (b.J.J2 < b.J.J1) W("precontrainte", "J2 est ant\xE9rieur \xE0 J1.", "J.J2");
    const covered = /* @__PURE__ */ new Set();
    const mid = b.ABOUT + b.PORTEE / 2;
    b.cablings.forEach((c, ic) => {
      const tag = `C\xE2blage ${ic + 1} : `, pc = `cablings.${ic}.`;
      c.poutres.forEach((p) => covered.add(p));
      const nc = c.NCAB11 + c.NCAB12 + c.NCAB2;
      if (nc !== c.cables.length) E("cables", tag + `NCAB11 + NCAB12 + NCAB2 = ${nc} mais ${c.cables.length} c\xE2ble(s) d\xE9crit(s) en D'.`, pc + "NCAB11");
      if (c.ordonnees.length !== c.cables.length) E("cables", tag + `le tableau D compte ${c.ordonnees.length} ligne(s) d'ordonn\xE9es pour ${c.cables.length} c\xE2ble(s).`);
      for (let i = 1; i < c.abscisses.length; i++) if (!(c.abscisses[i] > c.abscisses[i - 1])) E("cables", tag + "les abscisses de d\xE9finition doivent \xEAtre croissantes.", pc + "abscisses." + i);
      const last = c.abscisses[c.abscisses.length - 1];
      if (last !== void 0 && Math.abs(last - mid) > 5e-3) W("cables", tag + `la derni\xE8re abscisse (${last}) devrait \xEAtre la mi-trav\xE9e (ABOUT + PORTEE/2 = ${mid.toFixed(3)}).`, pc + "abscisses." + (c.abscisses.length - 1));
      c.cables.forEach((d, k) => {
        const p = pc + "cables." + k + ".";
        if (!b.systems.some((s) => s.ARMA === d.ARMA)) E("cables", tag + `c\xE2ble ${d.num} : ARMA ${d.ARMA} ne correspond \xE0 aucun syst\xE8me (C3/C4).`, p + "ARMA");
        if (!(d.ABDECO < d.ABFICO)) E("cables", tag + `c\xE2ble ${d.num} : ABDECO doit pr\xE9c\xE9der ABFICO.`, p + "ABDECO");
        if (d.ABSOR > d.ABDECO + 1e-9) E("cables", tag + `c\xE2ble ${d.num} : la sortie (ABSOR) doit pr\xE9c\xE9der le d\xE9but de courbe (ABDECO).`, p + "ABSOR");
        if (d.ABFICO > mid + 1e-6) E("cables", tag + `c\xE2ble ${d.num} : la fin de courbe d\xE9passe la mi-trav\xE9e.`, p + "ABFICO");
        if (d.ORFICO <= 0 || d.ORFICO >= b.beam.HPOUT) E("cables", tag + `c\xE2ble ${d.num} : ORFICO hors de la poutre.`, p + "ORFICO");
        const o = c.ordonnees[k] ?? [];
        if (!o.some((y, i) => y > 0 && c.abscisses[i] >= d.ABSOR - 1e-9)) E("cables", tag + `c\xE2ble ${d.num} : aucune ordonn\xE9e d\xE9finie au-del\xE0 de la sortie.`, `${pc}ordonnees.${k}.0`);
      });
    });
    for (const p of b.poutresACalculer) if (!covered.has(p)) E("cables", `La poutre ${p} n'est rattach\xE9e \xE0 aucun c\xE2blage.`);
    try {
      for (const w of checkBordereau(b)) W("cables", `C\xE2blage ${w.cablage}, c\xE2ble ${w.cable} : ${w.message}.`);
    } catch {
    }
    return out;
  }
  function mount(root, init, opts = {}) {
    const dopt = { angleRel: 22, angleTop: 20, absorAbout: 0.15, debord: 0.5 };
    let dstate = { running: false, msg: "", k: 0, n: 1 };
    let bd = JSON.parse(JSON.stringify(init));
    let cur = 0, ic = 0, hlPath = "", hlCode = "";
    const isBlank = (b) => !(b.PORTEE > 0) && !(b.NPOUT > 0) && !(b.beam.HPOUT > 0);
    let auto = isBlank(bd);
    const ensure = () => {
      if (!bd.beamRive) bd.beamRive = JSON.parse(JSON.stringify(bd.beam));
      while (bd.systems.length < 2) bd.systems.push(JSON.parse(JSON.stringify(bd.systems[0])));
    };
    ensure();
    root.innerHTML = `<div class="sg-top"><button class="sg-arw" data-nav="-1" title="\xC9tape pr\xE9c\xE9dente" aria-label="\xC9tape pr\xE9c\xE9dente">\u2039</button><div class="sg-steps" role="tablist"></div><button class="sg-arw" data-nav="1" title="\xC9tape suivante" aria-label="\xC9tape suivante">\u203A</button></div>
    <div class="sg-panels">
      <section class="sg-pan sg-schp" aria-label="Sch\xE9ma de principe"><div class="sg-pan-h"><b>Sch\xE9ma de principe</b><div class="sg-ftabs" data-pan="s"></div></div><div class="sg-pv sg-schc"></div></section>
      <aside class="sg-pan sg-win" aria-label="Vues de l'ouvrage"><div class="sg-pan-h"><b>Votre ouvrage</b><div class="sg-wtabs" role="tablist"></div></div><div class="sg-ftabs sub" data-pan="w"></div><div class="sg-pv sg-skc"></div></aside>
    </div>
    <div class="sg-info"></div><div class="sg-leg"></div><div class="sg-form"></div><div class="sg-nav"><span class="sg-pos"></span></div>`;
    const $ = (s) => root.querySelector(s);
    const stepsEl = $(".sg-steps"), formEl = $(".sg-form"), skEl = $(".sg-skc"), schEl = $(".sg-schc"), infoEl = $(".sg-info"), tabsEl = $(".sg-wtabs"), legEl = $(".sg-leg");
    const fig = { s: 0, w: 0, focus: "" };
    let legOpen = false;
    legEl.addEventListener("click", () => {
      legOpen = false;
      renderSketch();
    });
    let win = "";
    const meta = /* @__PURE__ */ new Map();
    const fieldHtml = (f2) => {
      meta.set(f2.p, { c: f2.c, l: f2.l, u: f2.u, h: f2.h });
      const v = get(bd, f2.p), t = f2.t ?? "n";
      const input = t === "sel" ? `<select data-p="${f2.p}" data-t="sel"${f2.re ? ' data-re="1"' : ""}>${(f2.o ?? []).map(([k, l]) => `<option value="${k}"${+v === k ? " selected" : ""}>${esc2(l)}</option>`).join("")}${(f2.o ?? []).some(([k]) => k === +v) ? "" : `<option value="${v}" selected>${v}</option>`}</select>` : `<input data-p="${f2.p}" data-t="${t}"${f2.re ? ' data-re="1"' : ""} value="${esc2(fmt(v, t))}" ${t === "s" || t === "list" ? "" : 'inputmode="decimal"'} spellcheck="false" autocomplete="off">`;
      return `<label class="sf${t === "s" ? " wide" : ""}" title="${esc2(f2.l)}${f2.u ? ` (${esc2(f2.u)})` : ""}"><span class="sf-h"><code>${esc2(f2.c)}</code>${f2.u ? `<em>${esc2(f2.u)}</em>` : ""}</span>${input}<span class="sf-l">${esc2(f2.l)}</span></label>`;
    };
    const cellInput = (p, t, extra = "", o) => {
      const v = get(bd, p);
      if (t === "sel" && o) return `<select data-p="${p}" data-t="sel"${extra}>${o.map(([k, l]) => `<option value="${k}"${+v === k ? " selected" : ""}>${esc2(l)}</option>`).join("")}</select>`;
      return `<input data-p="${p}" data-t="${t}" value="${esc2(fmt(v, t))}" inputmode="decimal" spellcheck="false" autocomplete="off"${extra}>`;
    };
    const matrixHtml = (m) => {
      const head = `<thead><tr><th></th>${m.cols.map(([l]) => `<th>${esc2(l)}</th>`).join("")}</tr></thead>`;
      const rows = [];
      for (const [row2, code, lbl, unit, t, o] of m.rows) {
        let h = `<tr><th title="${esc2(code)} \u2014 ${esc2(lbl)}${unit ? ` (${esc2(unit)})` : ""}"><code>${esc2(code)}</code><span>${esc2(lbl)}${unit ? ` <em>(${esc2(unit)})</em>` : ""}</span></th>`;
        for (const [, col] of m.cols) {
          const cell = matrixCell(col, row2, code);
          if (!cell || get(bd, cell.p) === void 0) {
            h += '<td class="na">\u2014</td>';
            continue;
          }
          meta.set(cell.p, { c: cell.c, l: lbl, u: unit || void 0 });
          h += `<td>${cellInput(cell.p, t ?? "n", "", o)}</td>`;
        }
        rows.push(h + "</tr>");
      }
      const table = (rs) => `<div class="sg-mx"><table>${head}<tbody>${rs.join("")}</tbody></table></div>`;
      if (rows.length > 6 && m.cols.length <= 3) {
        const n = rows.length > 8 ? 3 : 2, k = Math.ceil(rows.length / n);
        return `<div class="sg-mx2 n${n}">${Array.from({ length: n }, (_, i) => table(rows.slice(i * k, (i + 1) * k))).join("")}</div>`;
      }
      return table(rows);
    };
    function qsupHtml() {
      const rows = bd.qsup.map((q, i) => `<tr><td>${cellInput(`qsup.${i}.de`, "i")}</td><td>${cellInput(`qsup.${i}.a`, "i")}</td><td>${cellInput(`qsup.${i}.max`, "n")}</td><td>${cellInput(`qsup.${i}.min`, "n")}</td><td><button class="sg-x" data-act="qdel" data-i="${i}" title="Supprimer">\xD7</button></td></tr>`).join("");
      bd.qsup.forEach((_, i) => {
        meta.set(`qsup.${i}.de`, { c: "NUM POUT", l: "Premi\xE8re poutre du groupe" });
        meta.set(`qsup.${i}.a`, { c: "NUM POUT", l: "Derni\xE8re poutre du groupe" });
        meta.set(`qsup.${i}.max`, { c: "QSUP MAX", l: "Superstructures, valeur max. par poutre", u: "t/m" });
        meta.set(`qsup.${i}.min`, { c: "QSUP MIN", l: "Superstructures, valeur min. par poutre", u: "t/m" });
      });
      return `<fieldset class="sg-g" style="grid-column:span 4"><legend>Superstructures par groupe de poutres <small>B2</small></legend><div class="sg-mx"><table class="sg-t"><thead><tr><th>de la poutre</th><th>\xE0 la poutre</th><th>QSUP max (t/m)</th><th>QSUP min (t/m)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><button class="btn-secondary sm" data-act="qadd">+ groupe</button></fieldset>`;
    }
    function designHtml() {
      const inp = (k, code, l, u, h) => {
        meta.set("@" + k, { c: code, l, u, h });
        return `<label class="sf"><span class="sf-h"><code>${code}</code><em>${u}</em></span><input data-p="@${k}" data-t="n" value="${dopt[k]}" inputmode="decimal"><span class="sf-l">${l}</span></label>`;
      };
      const L = dstate.log;
      let log = "";
      if (dstate.running) log = `<div class="sg-prog"><div style="width:${Math.min(100, 100 * dstate.k / Math.max(1, dstate.n)).toFixed(0)}%"></div></div><p class="sg-note">${esc2(dstate.msg)}</p>`;
      else if (L) {
        if (L.error) log = `<div class="sg-ck err">Erreur du projeteur \u2014 ${esc2(L.error)}</div>`;
        else log = `<div class="sg-ck ${L.ok ? "ok" : "warn"}">${L.ok ? "C\xE2blage trouv\xE9 : toutes les justifications sont satisfaites." : "Le projeteur n'a pas trouv\xE9 de c\xE2blage satisfaisant."}${L.seconds ? ` (${L.seconds.toFixed(0)} s)` : ""}</div>
        <div class="sg-mx"><table class="sg-t log"><thead><tr><th>essai (poutre ${L.critical})</th><th>1re fam.</th><th>2e fam.</th><th>r\xE9sultat</th></tr></thead><tbody>${L.steps.map((st, i) => `<tr><td>${i + 1}</td><td>${st.n1}</td><td>${st.n2}</td><td class="${st.ok ? "okc" : "koc"}">${st.ok ? "v\xE9rifi\xE9" : esc2(st.reasons.join(" ; ") || "non v\xE9rifi\xE9")}</td></tr>`).join("")}</tbody></table></div>
        <p class="sg-note">C\xE2bles retenus par poutre : ${L.perBeam.map((p) => `poutre ${p.beam} : ${p.n1} + ${p.n2}`).join(" \xB7 ")}</p>
        ${L.advice.length ? `<ul class="sg-adv">${L.advice.map((a) => `<li>${esc2(a)}</li>`).join("")}</ul>` : ""}`;
      }
      return `<fieldset class="sg-g sg-proj"><legend>Projeteur \u2014 g\xE9n\xE9ration du c\xE2blage</legend>
      <p class="sg-note" style="margin-top:0">Le projeteur cherche le nombre de c\xE2bles de chaque famille et leur trac\xE9 selon la m\xE9thode du programme VIPP du SETRA : 1re famille (syst\xE8me C3) ancr\xE9e \xE0 l'about, 2e famille (syst\xE8me C4) relev\xE9e en trav\xE9e. Chaque essai est justifi\xE9 par le calcul complet, en classe ${["I", "II", "III"][(bd.CLASSEBP || 2) - 1]}. Le c\xE2blage obtenu remplace les tableaux ci-dessous et reste modifiable.</p>
      <div class="sg-fs">${inp("angleRel", "ANGSOR", "Angle de sortie des c\xE2bles relev\xE9s", "gr", "M\xEAme angle pour tous les c\xE2bles relev\xE9s ; voisin de 22 gr (20\xB0) selon le guide VIPP.")}${inp("angleTop", "ANG. HAUT", "Angle du c\xE2ble d'about le plus haut", "gr", "Les autres c\xE2bles d'about ont la m\xEAme fin de parabole ; leur angle d\xE9cro\xEEt jusqu'\xE0 1 \xE0 2 gr pour le c\xE2ble le plus bas.")}${inp("absorAbout", "ABSOR", "Sortie des c\xE2bles d'about depuis l'extr\xE9mit\xE9", "m", "Abscisse de la face d'ancrage des c\xE2bles de 1re famille.")}</div>
      <div class="actions" style="margin-top:12px"><button class="btn-primary" data-act="design"${dstate.running || !opts.onDesign ? " disabled" : ""}>${dstate.running ? "Calcul en cours\u2026" : "G\xE9n\xE9rer le c\xE2blage"}</button></div>
      <div class="sg-dlog">${log}</div></fieldset>`;
    }
    function cablesHtml() {
      const c = bd.cablings[ic];
      const tabs = bd.cablings.map((_, i) => `<button class="sg-tab${i === ic ? " active" : ""}" data-act="cab" data-i="${i}">C\xE2blage ${i + 1} \xB7 poutres ${bd.cablings[i].poutres.join(", ") || "\u2014"}</button>`).join("") + `<button class="sg-tab add" data-act="cabadd">+ c\xE2blage</button>`;
      if (!c) return `<div class="sg-tabs">${tabs}</div>`;
      const pc = `cablings.${ic}.`;
      meta.set(pc + "poutres", { c: "POUTRES", l: "Poutres justifi\xE9es avec ce c\xE2blage" });
      meta.set(pc + "NCAB11", { c: "NCAB11", l: "1re famille : c\xE2bles tendus \xE0 J1", h: "Les c\xE2bles sont pris dans l'ordre du tableau D' : d'abord NCAB11, puis NCAB12, puis NCAB2." });
      meta.set(pc + "NCAB12", { c: "NCAB12", l: "1re famille : c\xE2bles tendus \xE0 J2" });
      meta.set(pc + "NCAB2", { c: "NCAB2", l: "2e famille : c\xE2bles tendus \xE0 J4, apr\xE8s le b\xE9tonnage du hourdis" });
      const top = `<div class="sg-row">
      <label class="sf"><span class="sf-h"><code>POUTRES</code></span><input data-p="${pc}poutres" data-t="list" value="${esc2(c.poutres.join(" "))}" spellcheck="false"><span class="sf-l">Poutres justifi\xE9es avec ce c\xE2blage</span></label>
      <label class="sf"><span class="sf-h"><code>NCAB11</code></span>${cellInput(pc + "NCAB11", "i")}<span class="sf-l">1re famille \xE0 J1</span></label>
      <label class="sf"><span class="sf-h"><code>NCAB12</code></span>${cellInput(pc + "NCAB12", "i")}<span class="sf-l">1re famille \xE0 J2</span></label>
      <label class="sf"><span class="sf-h"><code>NCAB2</code></span>${cellInput(pc + "NCAB2", "i")}<span class="sf-l">2e famille \xE0 J4</span></label></div>`;
      const n1 = c.NCAB11 + c.NCAB12;
      c.abscisses.forEach((_, i) => meta.set(`${pc}abscisses.${i}`, { c: "ABSCISSE", l: `Abscisse de d\xE9finition n\xB0 ${i + 1}, depuis l'extr\xE9mit\xE9 de la poutre`, u: "m" }));
      const dRows = c.ordonnees.map((o, k) => {
        o.forEach((_, i) => meta.set(`${pc}ordonnees.${k}.${i}`, { c: `ORDONNEE`, l: `C\xE2ble ${c.cables[k]?.num ?? k + 1} : ordonn\xE9e de l'axe de gaine \xE0 x = ${c.abscisses[i]} m (vide = non d\xE9fini)`, u: "m" }));
        return `<tr><th class="${k < n1 ? "f1" : "f2"}">${c.cables[k]?.num ?? k + 1}</th>${c.abscisses.map((_, i) => `<td><input data-p="${pc}ordonnees.${k}.${i}" data-t="z" value="${o[i] ? fmt(o[i]) : ""}" placeholder="\u2014" inputmode="decimal"></td>`).join("")}</tr>`;
      }).join("");
      const tD = `<fieldset class="sg-g"><legend>Tableau D \u2014 abscisses de d\xE9finition et ordonn\xE9es des axes de gaine <small>m</small></legend>
      <div class="sg-mx"><table class="sg-t"><thead><tr><th>x</th>${c.abscisses.map((_, i) => `<th>${cellInput(`${pc}abscisses.${i}`, "n")}</th>`).join("")}</tr></thead><tbody>${dRows}</tbody></table></div>
      <div class="actions"><button class="btn-secondary sm" data-act="xadd">+ abscisse</button><button class="btn-secondary sm" data-act="xdel">\u2212 abscisse</button></div></fieldset>`;
      const dpRows = c.cables.map((d, k) => {
        DCOLS.forEach(([key, code, lbl]) => meta.set(`${pc}cables.${k}.${key}`, { c: code, l: `C\xE2ble ${d.num} \u2014 ${lbl}` }));
        return `<tr><th class="${k < n1 ? "f1" : "f2"}">${k < n1 ? k < c.NCAB11 ? "F1" : "F1\xB72" : "F2"}</th>${DCOLS.map(([key, , , t]) => `<td>${cellInput(`${pc}cables.${k}.${key}`, t)}</td>`).join("")}</tr>`;
      }).join("");
      const tDp = `<fieldset class="sg-g"><legend>Tableau D' \u2014 caract\xE9ristiques compl\xE9mentaires des c\xE2bles</legend>
      <div class="sg-mx"><table class="sg-t dp"><thead><tr><th></th>${DCOLS.map(([, code, lbl]) => `<th title="${esc2(lbl)}">${code}</th>`).join("")}</tr></thead><tbody>${dpRows}</tbody></table></div>
      <div class="actions"><button class="btn-secondary sm" data-act="kadd">+ c\xE2ble</button><button class="btn-secondary sm" data-act="kdel">\u2212 dernier c\xE2ble</button>${bd.cablings.length > 1 ? '<button class="btn-secondary sm" data-act="cabdel">Supprimer ce c\xE2blage</button>' : ""}</div></fieldset>`;
      return `<div class="sg-tabs">${tabs}</div>${top}<!--blk-->${tD}<!--blk-->${tDp}`;
    }
    function renderSteps() {
      const ch = checks(bd);
      stepsEl.innerHTML = STEPS.map((s, i) => {
        const e = ch.filter((c) => c.step === s.id), err = e.some((c) => c.level === "err"), warn = e.length > 0;
        return `<button role="tab" aria-selected="${i === cur}" class="sg-st${i === cur ? " on" : ""}" data-step="${i}"><b>${i + 1}</b><span>${s.t}</span><small>${s.lines}</small>${err ? '<i class="e"></i>' : warn ? '<i class="w"></i>' : ""}</button>`;
      }).join("");
      $(".sg-pos").textContent = `${cur + 1} / ${STEPS.length}`;
      root.querySelector('[data-nav="-1"]').disabled = cur === 0;
      root.querySelector('[data-nav="1"]').disabled = cur === STEPS.length - 1;
    }
    function renderPInfo() {
      const el = root.querySelector(".sg-pinfo");
      if (!el) return;
      const W = bd.ETROTG + bd.EGAU + bd.ESURCH + bd.EDROI + bd.ETROTD, hc = hConseil(bd.PORTEE), f2 = (x, d = 2) => x.toFixed(d).replace(".", ",");
      el.innerHTML = `<p class="sg-note">Largeur totale : <b>${f2(W)} m</b>${bd.NPOUT >= 2 && bd.ENTRAPOUT > 0 ? ` \xB7 entraxe des poutres : <b>${f2(bd.ENTRAPOUT, 3)} m</b> \xB7 encorbellements EEXT : <b>${f2(bd.slabG.EEXT, 3)} m</b>` : ""}${hc > 0 ? ` \xB7 hauteur de poutre conseill\xE9e \u2248 <b>${f2(hc)} m</b> (L/17,5)` : ""}</p>`;
    }
    function renderChecks() {
      renderPInfo();
      const ch = checks(bd).filter((c) => c.step === STEPS[cur].id).sort((a, b) => a.level === b.level ? 0 : a.level === "err" ? -1 : 1);
      const el = root.querySelector(".sg-checks");
      if (el) el.innerHTML = ch.length ? ch.map((c) => `<div class="sg-ck ${c.level}">${c.level === "err" ? "Erreur" : "\xC0 v\xE9rifier"} \u2014 ${esc2(c.msg)}</div>`).join("") : '<div class="sg-ck ok">Donn\xE9es coh\xE9rentes pour cette \xE9tape.</div>';
      root.querySelectorAll("[data-p]").forEach((e) => e.classList.toggle("bad", ch.some((c) => c.level === "err" && c.p === e.dataset.p)));
    }
    function legendFor(svg) {
      const words = /* @__PURE__ */ new Set();
      for (const m of svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) for (const w of m[1].split(/[\s/×,:()]+/)) if (w) words.add(w);
      const seen = /* @__PURE__ */ new Set(), items = [];
      for (const [p, m] of meta) {
        const codes = m.c.split(/\s*\/\s*|\s+/).filter(Boolean);
        const key = m.c;
        if (seen.has(key)) continue;
        seen.add(key);
        if (p.startsWith("@") || /^cablings\.\d+\.(ordonnees|abscisses)/.test(p) || /^qsup\./.test(p)) continue;
        if (codes.some((c) => words.has(c))) continue;
        const on = hlPath === p || hlPath && meta.get(hlPath)?.c === m.c;
        const v = fv(get(bd, p));
        items.push(`<span class="${on ? "on" : ""}"><code>${esc2(m.c)}</code>${v !== void 0 ? ` <b>= ${esc2(v)}</b>` : ""} ${esc2(m.l)}${m.u ? ` <em>(${esc2(m.u)})</em>` : ""}</span>`);
      }
      {
        const cw = /* @__PURE__ */ new Set();
        for (const m of svg.matchAll(/<text class="[^"]*\bcote\b[^"]*"[^>]*>([^<]*)<\/text>/g)) for (const w of m[1].split(/[\s/×,:()]+/)) if (w) cw.add(w);
        const miss = [];
        for (const [p, m] of meta) {
          if (!(m.u === "m" || /\(m\)|Profondeur|Largeur de l'encoche/.test(m.l)) || /^(A3|RECUL)$/.test(m.c) || p.startsWith("@") || /^cablings\.\d+\.(ordonnees|abscisses)/.test(p)) continue;
          const codes = m.c.split(/\s*\/\s*|\s+/).filter(Boolean);
          if (!codes.some((c) => cw.has(c))) miss.push(m.c);
        }
        if (miss.length) console.warn("DIMMISS", STEPS[cur].id, miss.join(", "));
      }
      return items.length ? `<div class="sk-legend"><b>Autres donn\xE9es de l'\xE9tape (non repr\xE9sent\xE9es sur le sch\xE9ma)</b>${items.join("")}</div>` : "";
    }
    function valOf(key) {
      const hp = hlPath.split(".")[0];
      const cm = hlPath.match(/^cablings\.(\d+)\.cables\.(\d+)\./);
      for (const seg of key.split("|")) {
        if (!seg) continue;
        if (seg.includes(".") && !/^[A-Z]+\.[A-Z]/.test(seg)) {
          const v2 = fv(get(bd, seg));
          if (v2 !== void 0) return v2;
          continue;
        }
        const dc = DCOLS.find((d) => d[1] === seg);
        if (dc) {
          const c = bd.cablings[ic];
          if (!c?.cables.length) return void 0;
          const k = cm && +cm[1] === ic ? +cm[2] : Math.max(0, c.cables.findIndex((x) => +x[dc[0]] !== 0));
          return fv(c.cables[k]?.[dc[0]]);
        }
        const local = [...meta].filter(([, m]) => m.c === seg).map(([p2]) => p2);
        const ps = seg.length === 1 ? local : [...local, ...codeMap().get(seg) ?? []];
        if (!ps.length) continue;
        const p = ps.find((x) => x.split(".")[0] === hp) ?? ps[0];
        const v = fv(get(bd, p));
        if (v !== void 0) return v;
      }
      return void 0;
    }
    function schemaFor(id) {
      const sb = schemaBd(bd), hc = hlCode, hp = hlPath, V = void 0;
      switch (id) {
        case "principal":
          return asSchema(() => generalSection(sb, hc, { L: "AUCUN", R: "AUCUN" }, "geo", void 0, { bare: true }) + beamSection(sb, hc, false).split(/(?=<figure)/).slice(0, 1).join("") + slabZoom(sb, hc, hp), V);
        case "travers":
          return asSchema(() => generalSection(sb, hc, { L: "BN4", R: "BN4", corL: true, corR: true }, "geo"), V);
        case "travee":
          return asSchema(() => spanViews(sb, hc), V);
        case "poutre":
          return asSchema(() => beamSection(sb, hc, false), V);
        case "hourdis":
          return asSchema(() => slabZoom(sb, hc, hp), V);
        case "entretoises":
          return asSchema(() => crossBeamView(sb, hc, hp), V);
        case "charges":
          return asSchema(() => crossSection(sb, hc, "charges"), V);
        case "precontrainte":
          return asSchema(() => phasingView(sb, hc), V);
        case "materiaux":
          return asSchema(() => materialsView(sb, hc), V);
        case "cables":
          return asSchema(() => cableSchema(hc, hp), V);
        default:
          return "";
      }
    }
    const DETAIL = { principal: "Hourdis", travers: "Rives", hourdis: "Hourdis", entretoises: "Entretoises", charges: "Charges", materiaux: "Section composite", precontrainte: "Phasage" };
    const DEFAULT_VIEW = { principal: "coupe", ouvrage: "coupe", travers: "coupe", travee: "elev", poutre: "poutre", cables: "cables" };
    function winTabs() {
      if (STEPS[cur].id === "principal") return [["coupe", "Coupe"]];
      const t = [["coupe", "Coupe"], ["elev", "\xC9l\xE9vation et plan"], ["poutre", "Poutre"], ["cables", "C\xE2blage"]];
      const d = DETAIL[STEPS[cur].id];
      if (d) t.push(["detail", d]);
      return t;
    }
    function winView(v) {
      const s = STEPS[cur], hl = hlCode;
      switch (v) {
        case "coupe":
          return s.id === "ouvrage" ? generalSection(bd, "", EQ.get(bd), "calc", void 0, { clean: true }) : generalSection(bd, hl, EQ.get(bd), "geo", void 0, { clean: true });
        case "elev":
          return spanViews(bd, hl);
        case "poutre":
          return beamSection(bd, hl, false) + (bd.TYPOURI.some((t) => t === 0) ? beamSection(bd, hl, true) : "");
        case "cables":
          return bd.cablings.length ? cablesView(bd, Math.min(ic, bd.cablings.length - 1), hl, hlPath) : `<div class="sk-empty">Aucun c\xE2blage saisi pour l'instant.</div>`;
        default:
          return s.id === "principal" ? slabZoom(bd, hl, hlPath) : s.sk(bd, hl, hlPath);
      }
    }
    function splitFigs(html) {
      const parts = html.split(/(?=<figure)/), out = [];
      for (const p of parts) {
        if (!p.startsWith("<figure")) {
          if (out.length) out[out.length - 1].h += p;
          else if (p.trim()) out.push({ t: "", h: p });
          continue;
        }
        let t = (p.match(/<figcaption>([^<]*)<\/figcaption>/)?.[1] ?? "").replace(/^Schéma de principe — /, "");
        const k = t.indexOf(" \u2014 ");
        if (k > 0 && t.length > 34) t = t.slice(k + 3);
        out.push({ t: t.replace(/&#39;|&apos;/g, "'"), h: p });
      }
      return out;
    }
    function showFigs(el, tabs, html, key, newFocus) {
      const figs = splitFigs(html);
      if (newFocus) {
        const k = figs.findIndex((f2) => /class="[^"]*\bhl\b/.test(f2.h));
        if (k >= 0) fig[key] = k;
      }
      if (fig[key] >= figs.length) fig[key] = 0;
      tabs.innerHTML = figs.length > 1 ? figs.map((f2, i) => `<button data-fig="${key}${i}" class="${i === fig[key] ? "on" : ""}" title="${esc2(f2.t)}">${esc2(f2.t || `vue ${i + 1}`)}</button>`).join("") : "";
      el.classList.toggle("multi", figs.length > 1);
      const h = figs.length ? figs[fig[key]].h : html;
      el.innerHTML = key === "s" && STEPS[cur].id === "principal" && fig.s === 0 && figs.length ? `<div class="sg-edgewrap">${edgeTiles("L")}<div class="sg-edgefig">${h}</div>${edgeTiles("R")}</div>` : h;
    }
    function edgeTiles(side) {
      const e = EQ.get(bd), w = side === "L" ? bd.ETROTG : bd.ETROTD;
      const on = { BN4: e[side] === "BN4" || e[side] === "GC", TR: w > 0 && hasTrottoir(e, side), GBA: e[side] === "GBA" };
      const t = (k, l, tip) => `<button type="button" class="sg-tile${on[k] ? " on" : ""}" data-edge="${side}:${k}" role="checkbox" aria-checked="${on[k]}" title="${tip}">${edgeIcon(k, side)}<span><i aria-hidden="true"></i>${l}</span></button>`;
      return `<div class="sg-edge" role="group" aria-label="\xC9quipements de la rive ${side === "L" ? "gauche" : "droite"}"><b>Rive ${side === "L" ? "G" : "D"}</b>${t("BN4", "GC / BN4", "Garde-corps ou barri\xE8re BN4")}${t("TR", "Trottoir", "Trottoir sur\xE9lev\xE9 (largeur " + (side === "L" ? "ETROTG" : "ETROTD") + ")")}${t("GBA", "GBA", "Glissi\xE8re en b\xE9ton adh\xE9rent")}</div>`;
    }
    function fitFigs(el, tabs, gen, key, newFocus, empty) {
      let k = 1, html = "";
      for (let it = 0; it < 4; it++) {
        setDrawScale(k);
        try {
          html = gen();
        } catch {
          html = "";
        }
        showFigs(el, tabs, html || empty, key, newFocus && it === 0);
        const svg = el.querySelector("svg");
        if (!svg) break;
        const vb = svg.viewBox.baseVal, w = svg.getBoundingClientRect().width;
        if (!vb || !vb.width || !w) break;
        const r = w / vb.width;
        if (r >= 0.97) break;
        k = Math.max(0.8, k * r * 0.99);
        if (k === 0.8) {
          setDrawScale(k);
          try {
            html = gen();
          } catch {
            html = "";
          }
          showFigs(el, tabs, html || empty, key, false);
          break;
        }
      }
      setDrawScale(1);
      return html;
    }
    function renderInline() {
      root.querySelectorAll(".sg-figcell[data-inl]").forEach((el) => {
        const sb = schemaBd(bd), kind = el.dataset.inl;
        setDrawWidth(Math.max(260, el.clientWidth - 150));
        let k = 1;
        for (let it = 0; it < 4; it++) {
          setDrawScale(k);
          const h = asSchema(() => kind === "poutre" ? beamSection(sb, hlCode, false) : slabZoom(sb, hlCode, hlPath));
          el.innerHTML = h.split(/(?=<figure)/).filter((x) => x.startsWith("<figure"))[0] ?? "";
          const svg = el.querySelector("svg");
          const vb = svg?.viewBox.baseVal;
          if (!svg || !vb?.width) break;
          const r = svg.getBoundingClientRect().width / vb.width;
          if (r >= 0.97) break;
          k = Math.max(0.3, k * r * 0.99);
        }
        setDrawScale(1);
      });
    }
    function renderSketch() {
      renderInline();
      const s = STEPS[cur], newFocus = fig.focus !== hlPath;
      fig.focus = hlPath;
      root.classList.toggle("sg-wide-s", s.id === "principal");
      const fit = (el, extra = 0) => setDrawWidth((el.clientWidth || 640) - 190 - extra);
      fit(schEl, s.id === "principal" && fig.s === 0 ? 130 : 0);
      const sch = fitFigs(schEl, $('.sg-ftabs[data-pan="s"]'), () => schemaFor(s.id), "s", newFocus, '<div class="sk-empty">Pas de sch\xE9ma pour cette \xE9tape.</div>');
      legEl.innerHTML = sch ? legendFor(sch) : "";
      legEl.classList.toggle("open", legOpen);
      const auto0 = DEFAULT_VIEW[s.id];
      const tabs = winTabs(), v = tabs.some(([k]) => k === win) ? win : auto0 ?? "detail";
      tabsEl.innerHTML = tabs.map(([k, l]) => `<button role="tab" data-win="${k}" class="${k === v ? "on" : ""}" aria-selected="${k === v}">${esc2(l)}</button>`).join("");
      fit(skEl);
      fitFigs(skEl, $('.sg-ftabs[data-pan="w"]'), () => asValues(() => winView(v)), "w", newFocus, '<div class="sk-empty">La vue appara\xEEtra d\xE8s que les donn\xE9es n\xE9cessaires seront saisies.</div>');
      const m = meta.get(hlPath), val = m ? fv(get(bd, hlPath)) : void 0;
      const nLeg = (legEl.innerHTML.match(/<span/g) ?? []).length;
      infoEl.innerHTML = `<div class="sg-info-t">` + (m ? `<code>${esc2(m.c)}</code>${val !== void 0 ? ` <b>= ${esc2(val)}</b>` : ""} <span>${esc2(m.l)}</span>${m.u ? ` <em>(${esc2(m.u)})</em>` : ""}${m.h ? ` <i>\u2014 ${esc2(m.h)}</i>` : ""}` : `<span class="mute">${esc2(s.intro)}</span>`) + `</div>` + (nLeg ? `<button type="button" class="sg-legbtn${legOpen ? " on" : ""}" data-leg="1" title="Donn\xE9es de l'\xE9tape qui ne sont pas cot\xE9es sur le sch\xE9ma">Autres donn\xE9es (${nLeg}) ${legOpen ? "\u25B4" : "\u25BE"}</button>` : "");
    }
    let fpage = 0;
    function layoutForm(blocks, act) {
      const CK = '<div class="sg-checks"></div>';
      const put = (bs) => {
        formEl.innerHTML = bs.join("") + CK;
        renderChecks();
        return formEl.scrollHeight;
      };
      const avail = () => window.innerHeight - (formEl.getBoundingClientRect().top + window.scrollY) - 28;
      const ph0 = Math.round(Math.min(640, Math.max(250, window.innerHeight - 394 - (STEPS[cur].id === "principal" ? 50 : 0))));
      root.style.setProperty("--ph", ph0 + "px");
      let pages = [blocks];
      if (window.innerWidth >= 1100 && window.innerHeight >= 560) {
        let need = put(blocks);
        if (need > avail()) {
          root.style.setProperty("--ph", Math.max(250, ph0 - 40) + "px");
          need = put(blocks);
          if (need > avail()) {
            root.style.setProperty("--ph", ph0 + "px");
            const lim = avail() - 38;
            pages = [];
            let pg = [];
            for (const b of blocks) {
              if (pg.length && put([...pg, b]) > lim) {
                pages.push(pg);
                pg = [b];
              } else pg.push(b);
            }
            if (pg.length) pages.push(pg);
          }
        }
      }
      if (act && pages.length > 1) {
        const k = pages.findIndex((p) => p.join("").includes(`data-p="${act}"`));
        if (k >= 0) fpage = k;
      }
      if (fpage >= pages.length) fpage = 0;
      const title = (p) => {
        const t = p.join("").match(/<legend>([^<]*)/)?.[1] ?? (p.join("").includes("sg-tabs") ? "C\xE2blage" : "");
        return t.replace(/ — .*| \(.*/, "");
      };
      const tabs = pages.length > 1 ? `<div class="sg-pages" role="tablist">${pages.map((p, i) => `<button role="tab" data-fpage="${i}" class="${i === fpage ? "on" : ""}" aria-selected="${i === fpage}"><b>${i + 1}</b>${esc2(title(p))}</button>`).join("")}<span class="sg-pg-n">page ${fpage + 1} / ${pages.length}</span></div>` : "";
      formEl.innerHTML = tabs + pages[fpage].join("") + CK;
      if (window.innerWidth >= 1100) {
        renderChecks();
        const over = formEl.scrollHeight - avail();
        if (over > 0) {
          const ph = parseFloat(root.style.getPropertyValue("--ph")) || ph0;
          root.style.setProperty("--ph", Math.max(190, ph - over) + "px");
        }
      }
    }
    function renderForm() {
      const act = document.activeElement?.dataset?.p;
      meta.clear();
      const s = STEPS[cur];
      const blocks = [];
      if (s.custom === "cables") blocks.push(designHtml(), ...cablesHtml().split("<!--blk-->"));
      for (const g of s.gs) {
        if (g.when && !g.when(bd)) continue;
        const sp = g.m ? g.m.rows.length > 6 && g.m.cols.length <= 3 ? 6 : g.m.cols.length <= 2 ? 3 : 4 : Math.min(6, Math.max(2, Math.ceil((g.f?.length ?? 2) / 1.6)));
        const inl = s.id === "principal" && (g.g === "Poutre" || g.g === "Hourdis") ? g.g === "Poutre" ? "poutre" : "hourdis" : "";
        let h = (inl ? `<div class="sg-figcell" data-inl="${inl}" style="grid-column:span 2"></div>` : "") + `<fieldset class="sg-g" style="grid-column:span ${inl ? 4 : sp}"><legend>${esc2(g.g)}</legend>`;
        if (g.f) h += `<div class="sg-fs">${g.f.map(fieldHtml).join("")}</div>`;
        if (g.m) h += matrixHtml(g.m);
        if (g.note) h += `<p class="sg-note">${esc2(g.note)}</p>`;
        blocks.push(h + "</fieldset>");
      }
      if (s.custom === "qsup") blocks.push(qsupHtml());
      if (s.custom === "principal") blocks[0] += `<fieldset class="sg-g sg-proj sg-pcomp" style="grid-column:span 6"><legend>Compl\xE9ter la g\xE9om\xE9trie</legend><div class="sg-pin">
        <label class="sf" title="Encorbellement du hourdis au-del\xE0 de la table des poutres de rive (m)"><span class="sf-h"><code>D\xC9BORD</code><em>m</em></span><input data-p="@debord" data-t="n" value="${dopt.debord}" inputmode="decimal"><span class="sf-l">encorbellement</span></label>
        <label class="sf" title="Compl\xE9ter automatiquement les autres dimensions \xE0 chaque saisie"><span class="sf-h"><code>AUTO</code></span><select data-auto="1"><option value="1"${auto ? " selected" : ""}>oui, \xE0 chaque saisie</option><option value="0"${auto ? "" : " selected"}>non</option></select><span class="sf-l">compl\xE9ment</span></label>
        <button class="btn-secondary sm" data-act="derive" title="Remplace la g\xE9om\xE9trie d\xE9taill\xE9e (poutre, hourdis, amorces d'entretoises, entraxe, DPOUT1) par des valeurs courantes calcul\xE9es \xE0 partir des dimensions principales.">Compl\xE9ter maintenant</button>
        <div class="sg-pinfo"></div></div></fieldset>`;
      if (s.custom === "equip") {
        const e = EQ.get(bd), opt = (side) => Object.keys(EQUIP_LABEL).map((k) => `<option value="${k}"${e[side] === k ? " selected" : ""}>${esc2(EQUIP_LABEL[k])}</option>`).join("");
        blocks.push(`<fieldset class="sg-g" style="grid-column:span 3"><legend>\xC9quipements dessin\xE9s sur la coupe</legend><div class="sg-fs">
        <label class="sf"><span class="sf-h"><code>GAUCHE</code></span><select data-eq="L">${opt("L")}</select><span class="sf-l">Dispositif de retenue en rive gauche</span></label>
        <label class="sf"><span class="sf-h"><code>DROITE</code></span><select data-eq="R">${opt("R")}</select><span class="sf-l">Dispositif de retenue en rive droite</span></label>
        <label class="sf"><span class="sf-h"><code>CORNICHE G</code></span><select data-eq="corL"><option value="1"${hasCorniche(e, "L") ? " selected" : ""}>oui</option><option value="0"${hasCorniche(e, "L") ? "" : " selected"}>non</option></select><span class="sf-l">Corniche en rive gauche</span></label>
        <label class="sf"><span class="sf-h"><code>CORNICHE D</code></span><select data-eq="corR"><option value="1"${hasCorniche(e, "R") ? " selected" : ""}>oui</option><option value="0"${hasCorniche(e, "R") ? "" : " selected"}>non</option></select><span class="sf-l">Corniche en rive droite</span></label></div>
        <p class="sg-note">Choix de dessin uniquement : les charges correspondantes se saisissent \xE0 l'\xE9tape Charges (DBAG, PBAG, DBAD, PBAD).</p></fieldset>`, `<fieldset class="sg-g" style="grid-column:span 3"><legend>Poutres de rive en retrait</legend><div class="sg-fs">
        <label class="sf"><span class="sf-h"><code>D\xC9BORD</code><em>m</em></span><input data-p="@debord" data-t="n" value="${dopt.debord}" inputmode="decimal"><span class="sf-l">Encorbellement du hourdis au-del\xE0 de la table des poutres de rive</span></label></div>
        <p class="sg-note">Recalcule EEXT (gauche et droite), l'entraxe ENTRAPOUT et DPOUT1 en conservant la largeur totale du tablier et la sym\xE9trie.</p>
        <div class="actions" style="margin-top:10px"><button class="btn-secondary" data-act="retrait">Mettre les poutres de rive en retrait</button></div></fieldset>`);
      }
      renderSteps();
      renderSketch();
      layoutForm(blocks, act);
      renderInline();
      renderChecks();
      if (act) formEl.querySelector(`[data-p="${act}"]`)?.focus({ preventScroll: true });
    }
    function syncInputs(except) {
      root.querySelectorAll("input[data-p]").forEach((i) => {
        if (i === except || (i.dataset.p ?? "").startsWith("@")) return;
        const v = get(bd, i.dataset.p);
        if (typeof v === "number") i.value = fmt(v, i.dataset.t || "n");
      });
    }
    let tmr;
    const changed = (structural = false) => {
      clearTimeout(tmr);
      if (structural) {
        renderForm();
        opts.onChange?.(bd);
        return;
      }
      tmr = setTimeout(() => {
        renderSketch();
        renderChecks();
        renderSteps();
        opts.onChange?.(bd);
      }, 90);
    };
    root.addEventListener("input", (ev) => {
      const el = ev.target;
      const p = el.dataset.p;
      if (!p) return;
      const t = el.dataset.t;
      let v;
      if (t === "s") v = el.value;
      else if (t === "list") v = (el.value.match(/\d+/g) ?? []).map(Number);
      else {
        const s = el.value.trim().replace(",", ".");
        if (t === "z" && s === "") v = 0;
        else {
          v = Number(s);
          if (s === "" || !isFinite(v) || (t === "i" || t === "sel") && !Number.isInteger(v)) {
            el.classList.add("bad");
            return;
          }
        }
      }
      el.classList.remove("bad");
      if (p.startsWith("@")) {
        dopt[p.slice(1)] = v;
        if (p === "@debord" && STEPS[cur].custom === "principal" && bd.beam.ETAB > 0) {
          const e = Math.round((bd.beam.ETAB / 2 + Math.max(0, v)) * 1e3) / 1e3;
          bd.slabG.EEXT = e;
          bd.slabD.EEXT = e;
          deriveGeometry(bd, dopt.debord, true);
          renderForm();
          opts.onChange?.(bd);
        }
        return;
      }
      set(bd, p, v);
      if (auto && STEPS[cur].custom === "principal") {
        deriveGeometry(bd, dopt.debord, true);
        syncInputs(el);
      }
      changed(!!el.dataset.re && ev.type === "change");
    });
    root.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.dataset.auto) {
        auto = el.value === "1";
        if (auto) {
          deriveGeometry(bd, dopt.debord, true);
          changed();
        }
        return;
      }
      if (el.dataset.eq) {
        const k = el.dataset.eq, v = el.value;
        EQ.set(k, k.startsWith("cor") ? v === "1" : v, bd);
        renderSketch();
        return;
      }
      if (el.dataset.re || /\.(NCAB11|NCAB12|NCAB2|poutres)$/.test(el.dataset.p ?? "")) setTimeout(renderForm, 0);
    });
    root.addEventListener("focusin", (ev) => {
      const el = ev.target;
      const p = el.dataset?.p;
      if (!p) return;
      hlPath = p;
      hlCode = p;
      if (STEPS[cur].id === "principal") win = "";
      renderSketch();
    });
    root.addEventListener("click", (ev) => {
      const b = ev.target.closest("button");
      if (!b || !root.contains(b)) return;
      if (b.dataset.win) {
        win = b.dataset.win;
        fig.w = 0;
        renderSketch();
        return;
      }
      if (b.dataset.edge) {
        const [side, k] = b.dataset.edge.split(":"), e = EQ.get(bd);
        if (k === "TR") {
          const wk = side === "L" ? "ETROTG" : "ETROTD", now = bd[wk] > 0 && hasTrottoir(e, side);
          EQ.set(side === "L" ? "trL" : "trR", !now, bd);
          if (!now && !(bd[wk] > 0)) {
            bd[wk] = 1;
            if (auto) deriveGeometry(bd, dopt.debord, true);
            renderForm();
            opts.onChange?.(bd);
            return;
          }
        } else {
          const isOn = k === "GBA" ? e[side] === "GBA" : e[side] === "BN4" || e[side] === "GC";
          EQ.set(side, isOn ? "AUCUN" : k, bd);
          if (!isOn) EQ.set(side === "L" ? "corL" : "corR", k !== "GBA", bd);
        }
        renderSketch();
        return;
      }
      if (b.dataset.leg) {
        legOpen = !legOpen;
        renderSketch();
        return;
      }
      if (b.dataset.fpage) {
        fpage = +b.dataset.fpage;
        renderForm();
        return;
      }
      if (b.dataset.fig) {
        const k = b.dataset.fig[0];
        fig[k] = +b.dataset.fig.slice(1);
        renderSketch();
        return;
      }
      if (b.dataset.step) {
        go(+b.dataset.step);
        return;
      }
      if (b.dataset.nav) {
        go(cur + +b.dataset.nav);
        return;
      }
      const c = bd.cablings[ic], a = b.dataset.act;
      if (!a) return;
      if (a === "design") {
        if (opts.onDesign && !dstate.running) {
          dstate = { running: true, msg: "Pr\xE9-dimensionnement\u2026", k: 0, n: 1 };
          renderForm();
          opts.onDesign(JSON.parse(JSON.stringify(bd)), { ...dopt });
        }
        return;
      }
      if (a === "derive") {
        deriveGeometry(bd, dopt.debord);
        renderForm();
        opts.onChange?.(bd);
        return;
      }
      if (a === "retrait") {
        const L = layout(bd), n = bd.NPOUT, tab = bd.beam.ETAB / 2, e = Math.round((tab + Math.max(0, dopt.debord)) * 1e3) / 1e3;
        if (n >= 2 && L.width - 2 * e > 0) {
          bd.slabG.EEXT = e;
          bd.slabD.EEXT = e;
          bd.ENTRAPOUT = Math.round((L.width - 2 * e) / (n - 1) * 1e3) / 1e3;
          bd.DPOUT1 = Math.round((L.X3 + bd.ESURCH / 2 - e) * 1e3) / 1e3;
        }
      }
      if (a === "cab") ic = +b.dataset.i;
      if (a === "cabadd") {
        const src = c ?? bd.cablings[0];
        bd.cablings.push(src ? JSON.parse(JSON.stringify(src)) : { poutres: [...bd.poutresACalculer], NCAB11: 0, NCAB12: 0, NCAB2: 0, abscisses: [bd.ABOUT, bd.ABOUT + bd.PORTEE / 2], ordonnees: [], cables: [] });
        if (src) bd.cablings[bd.cablings.length - 1].poutres = [];
        ic = bd.cablings.length - 1;
      }
      if (a === "cabdel" && bd.cablings.length > 1) {
        bd.cablings.splice(ic, 1);
        ic = 0;
      }
      if (a === "qadd") bd.qsup.push({ de: 1, a: bd.NPOUT, max: 0, min: 0 });
      if (a === "qdel") bd.qsup.splice(+b.dataset.i, 1);
      if (c && a === "xadd") {
        c.abscisses.push(+((c.abscisses[c.abscisses.length - 1] ?? 0) + 1).toFixed(3));
        c.ordonnees.forEach((o) => o.push(0));
      }
      if (c && a === "xdel" && c.abscisses.length > 1) {
        c.abscisses.pop();
        c.ordonnees.forEach((o) => o.pop());
      }
      if (c && a === "kadd") {
        const last = c.cables[c.cables.length - 1];
        c.cables.push({ ...last, num: (last?.num ?? 0) + 1, SYM: (last?.num ?? 0) + 1 });
        c.ordonnees.push([...c.ordonnees[c.ordonnees.length - 1] ?? c.abscisses.map(() => 0)]);
        c.NCAB2 += 1;
      }
      if (c && a === "kdel" && c.cables.length > 1) {
        c.cables.pop();
        c.ordonnees.pop();
        if (c.NCAB2 > 0) c.NCAB2--;
        else if (c.NCAB12 > 0) c.NCAB12--;
        else if (c.NCAB11 > 0) c.NCAB11--;
      }
      renderForm();
      opts.onChange?.(bd);
    });
    function go(i) {
      cur = Math.max(0, Math.min(STEPS.length - 1, i));
      hlPath = "";
      hlCode = "";
      win = "";
      fig.s = 0;
      fig.w = 0;
      fpage = 0;
      legOpen = false;
      renderForm();
      if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    renderForm();
    let rz;
    let lastW = window.innerWidth;
    window.addEventListener("resize", () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(rz);
      rz = setTimeout(renderForm, 150);
    });
    return {
      get: () => bd,
      set: (b) => {
        bd = JSON.parse(JSON.stringify(b));
        ensure();
        ic = 0;
        auto = isBlank(bd);
        if (auto) {
          cur = 0;
          win = "";
        }
        renderForm();
      },
      designProgress: (msg, k, n) => {
        dstate = { ...dstate, running: true, msg, k, n };
        if (STEPS[cur].custom === "cables") {
          const el = root.querySelector(".sg-dlog");
          if (el) el.innerHTML = `<div class="sg-prog"><div style="width:${Math.min(100, 100 * k / Math.max(1, n)).toFixed(0)}%"></div></div><p class="sg-note">${esc2(msg)}</p>`;
        }
      },
      designDone: (log, b) => {
        dstate = { running: false, msg: "", k: 0, n: 1, log };
        if (b) {
          bd = JSON.parse(JSON.stringify(b));
          ensure();
          ic = 0;
          opts.onChange?.(bd);
        }
        renderForm();
      },
      text: () => formatBordereau(bd),
      errors: () => checks(bd),
      go: (id) => go(STEPS.findIndex((s) => s.id === id))
    };
  }
  function blankBordereau(ref) {
    const b = JSON.parse(JSON.stringify(ref));
    const z = (o) => {
      for (const k of Object.keys(o)) if (typeof o[k] === "number") o[k] = 0;
      return o;
    };
    const d = /* @__PURE__ */ new Date(), p2 = (n) => String(n).padStart(2, "0");
    Object.assign(b, {
      titre: ["", "", ""],
      numero: "0001",
      date: `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`,
      poutresACalculer: [],
      SYMTAB: 0,
      NVOIE: 0,
      ETROTG: 0,
      EGAU: 0,
      ESURCH: 0,
      EDROI: 0,
      ETROTD: 0,
      NPOUT: 0,
      ENTRAPOUT: 0,
      DPOUT1: 0,
      PORTEE: 0,
      ABOUT: 0,
      NE: 2,
      ENTINT: 0,
      ENTAPP: 0,
      NT: 1,
      BIAIS: 100,
      HENTA: 0,
      HENTI: 0,
      TYPOURI: [1, 1],
      DBAG: 0,
      PBAGMAX: 0,
      PBAGMIN: 0,
      DBAD: 0,
      PBADMAX: 0,
      PBADMIN: 0,
      PDALMAX: 0,
      PDALMIN: 0,
      qsup: [],
      cablings: []
    });
    z(b.beam);
    z(b.slab);
    z(b.cross);
    if (b.beamRive) z(b.beamRive);
    for (const e of [b.slabG, b.slabD]) {
      z(e);
      z(e.cross);
    }
    return b;
  }
  globalThis.VIPPSaisie = { mount, parseBordereau, formatBordereau, checks, blankBordereau };
})();
