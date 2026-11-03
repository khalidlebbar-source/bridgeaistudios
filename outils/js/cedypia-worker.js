/* CEDYPIA — Web Worker : exécute BA.cedypia.calcul hors du fil principal et signale l'avancement. */
/* global importScripts, self */
importScripts('cedypia.js');
self.onmessage = function (e) {
  const { id, inp } = e.data;
  try {
    let last = 0;
    const res = self.BA.cedypia.calcul(inp, (p) => { if (p - last >= 0.01 || p === 1) { last = p; self.postMessage({ id, progress: p }); } });
    self.postMessage({ id, res });
  } catch (err) {
    self.postMessage({ id, error: err.message || String(err) });
  }
};
