/* Bridge Composer — Web Worker de la chaîne de justification (OUVRAGES TYPES et ses modules).
 * Messages : { id, op: 'map' | 'run', S, Ml, base } → { id, map, sum? } ou { id, error }. */
/* global importScripts */
'use strict';
let loaded = false;
self.onmessage = (ev) => {
  const { id, op, S, Ml, base } = ev.data || {};
  try {
    if (!loaded) {
      importScripts(base + 'composer/justif.js');
      self.COMP.JUSTIF_LIBS.forEach((f) => importScripts(base + f));
      loaded = true;
    }
    const OT = self.BA.ouvragesTypes, C = self.COMP;
    const map = C.justifMap(S, Ml, OT);
    if (op === 'map' || !map.ok) { self.postMessage({ id, map }); return; }
    const t0 = Date.now();
    const R = OT.calcul(map.s);
    const sum = C.justifSummary(R);
    sum.ms = Date.now() - t0;
    self.postMessage({ id, map, sum });
  } catch (err) {
    self.postMessage({ id, error: err && err.message ? err.message : String(err) });
  }
};
