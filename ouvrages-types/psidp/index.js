// PSIDP-EL — point d'entrée. Navigateur : charger parse.js, compute.js, note.js puis index.js -> globalThis.PSIDP.
// Node : require('./index.js').
(function (root) {
  'use strict';
  var P, C, N;
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    P = require('./parse.js'); C = require('./compute.js'); N = require('./note.js');
  } else { P = root.PSIDP_PARSE; C = root.PSIDP_COMPUTE; N = root.PSIDP_NOTE; }
  var api = {
    parseBordereau: P.parseBordereau, formatBordereau: P.formatBordereau, normalizeBordereauText: P.normalizeBordereauText,
    compute: C.compute, renderNote: N.renderNote,
    run: function (texte, opts) { var m = P.parseBordereau(texte); var r = C.compute(m); return { model: m, results: r, note: N.renderNote(m, r, opts || { numero: m.numeroRaw2, date: m.date }) }; }
  };
  root.PSIDP = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
