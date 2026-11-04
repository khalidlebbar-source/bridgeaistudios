// PICF-EL (PICF91 v1.06) — point d'entrée. Utilisable sous Node (require) et dans un navigateur
// (charger parse.js, compute.js, note.js puis index.js : expose globalThis.PICF).
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const Pa = node ? require('./parse.js') : root.PICF_PARSE;
  const Co = node ? require('./compute.js') : root.PICF_COMPUTE;
  const No = node ? require('./note.js') : root.PICF_NOTE;
  const PICF = {
    parseBordereau: Pa.parseBordereau, formatBordereau: Pa.formatBordereau, data: Pa.data,
    compute: Co.compute, renderNote: No.renderNote,
    run(text, opt) { const m = Pa.parseBordereau(text); const r = Co.compute(m); return { model: m, results: r, note: No.renderNote(m, r, opt || {}) }; },
  };
  if (node) module.exports = PICF;
  root.PICF = PICF;
})(typeof globalThis !== 'undefined' ? globalThis : this);
