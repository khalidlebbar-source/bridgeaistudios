// PIPO-EL — point d'entrée. Navigateur : charger frame.js, gm.js, live.js, parse.js, compute.js, note.js, index.js
// (scripts classiques) puis utiliser globalThis.PIPO. Node : require('./index.js').
(function (root) {
  'use strict';
  const req = (typeof require === 'function' && typeof module !== 'undefined');
  const P = req ? require('./parse.js') : root.PIPO_PARSE;
  const C = req ? require('./compute.js') : root.PIPO_COMPUTE;
  const N = req ? require('./note.js') : root.PIPO_NOTE;
  const api = {
    parseBordereau: P.parseBordereau, formatBordereau: P.formatBordereau,
    compute: C.compute, renderNote: N.renderNote,
    run(texte, opt) { const m = P.parseBordereau(texte); const r = C.compute(m); return { modele: m, resultats: r, note: N.renderNote(m, r, opt || { numero: m.numero, date: m.date }) }; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PIPO = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
