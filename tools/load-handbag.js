/* Charge HandBag complet sous Node (calcs, figures, modules listés dans handbag.html). */
const fs = require("fs"), path = require("path");
const HB = require("../handbag/calcs.js"); globalThis.HANDBAG = HB;
Object.assign(HB, require("../handbag/figures.js"));
const html = fs.readFileSync(path.join(__dirname, "../handbag.html"), "utf8");
for (const m of html.matchAll(/<script src="(handbag\/lib\/[^"]+)"/g)) require(path.join(__dirname, "..", m[1]));
module.exports = HB;
