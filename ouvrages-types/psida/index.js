/* PSIDA-EL — point d'entrée. Navigateur : charger parse.js, compute.js, note.js, ferraillage.js puis index.js (globalThis.PSIDA).
 * Node : require('./index.js'). */
(function (G) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    require('./parse.js'); require('./compute.js'); require('./note.js'); require('./ferraillage.js');
  }
  const P = G.PSIDA;
  P.run = function (texteBordereau, opts) {
    const m = P.parseBordereau(texteBordereau); const r = P.compute(m);
    return { modele: m, resultats: r, note: P.renderNote(m, r, opts || {}) };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof globalThis !== 'undefined' ? globalThis : this);
