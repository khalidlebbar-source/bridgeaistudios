import { runProjet, Projet } from "../engine/project";
import { noteHTML } from "../engine/note";
import { LOAD_LABEL, LoadKey } from "../engine/sollicitations";
const lab = (e: any) => ({ M: e.M.map((m: any) => ({ v: m.v, comb: m.v > 0 ? LOAD_LABEL[m.comb as LoadKey] : "—" })), T: e.T.map((m: any) => ({ v: m.v, comb: LOAD_LABEL[m.comb as LoadKey] })) });
self.onmessage = (ev: MessageEvent) => {
  const t0 = Date.now();
  try {
    const p: Projet = ev.data.projet;
    const r = runProjet(p);
    const synth = {
      ms: 0,
      sup: r.sup.total,
      travees: r.travees.map(t => ({
        nom: t.def.nom, L: t.R.input.L, theta: t.R.theta, alpha: t.R.alpha,
        Mu: Math.max(...t.R.ELU.M.map(m => m.v)), MuComb: LOAD_LABEL[t.R.ELU.M[5].comb as LoadKey],
        Ms: Math.max(...t.R.ELS.M.map(m => m.v)), MsComb: LOAD_LABEL[t.R.ELS.M[5].comb as LoadKey],
        Vu: t.R.ELU.T[0].v, VuComb: LOAD_LABEL[t.R.ELU.T[0].comb as LoadKey], Vs: t.R.ELS.T[0].v,
        lits: t.F.lits, diam: t.c.poutre.diam, As: t.F.As, cumul: t.F.cumul, ssl: t.F.ssl, okF: t.F.ok, couvert: t.E.couvert,
        cis: t.C.rows.map(c => ({ f: c.f, req: c.req, pose: c.pose, ok: c.ok })), cf: t.CF.Fg, cfRetenu: t.CF.retenu,
        ELU: lab(t.R.ELU), ELS: lab(t.R.ELS), cp: Object.fromEntries(Object.entries(t.R.moy).map(([k, v]) => [k, (v as any).cp])),
      })),
      hourdis: { trInf: r.H.fer.trInf, trSup: r.H.fer.trSup, loInf: r.H.fer.loInf, loSup: r.H.fer.loSup, poinc: r.H.roues.every(w => w.ok) },
      dallette: { ...r.DC.tot, ssl: r.DC.ssl, sbl: r.DC.sbl },
      entretoise: { Msup: r.EN.Msup, Minf: r.EN.Minf, AsSup: r.EN.AsSup, AsInf: r.EN.AsInf, AtSt: r.EN.AtSt, reac: r.EN.reac },
      alertes: r.alertes,
    };
    synth.ms = Date.now() - t0;
    (self as any).postMessage({ ok: true, synth, note: noteHTML(r) });
  } catch (e: any) {
    (self as any).postMessage({ ok: false, error: String(e && e.stack || e) });
  }
};
