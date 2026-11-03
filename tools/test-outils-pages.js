/* Outils de calculs des ponts — ouverture de chaque page dans Chromium (Playwright) : aucune erreur JS, pas de NaN/undefined dans les résultats.
 * node tools/test-outils-pages.js [outils/xxx.html …] */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
let fails = 0;
const root = path.resolve(__dirname, '..');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); r.end(d); }); }).listen(8765);
(async () => {
  const b = await chromium.launch();
  const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['outils-ponts.html', ...fs.readdirSync(root + '/outils').filter((f) => f.endsWith('.html')).map((f) => 'outils/' + f)];
  for (const pg of pages) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push('JS: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/fonts|insights|favicon|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto('http://localhost:8765/' + pg, { waitUntil: 'load' }).catch((e) => errs.push('nav ' + e.message));
    await p.waitForTimeout(4000);
    const info = await p.evaluate(() => ({ cards: document.querySelectorAll('.card,.tile').length, nan: /\bNaN\b|undefined/.test(document.querySelector('.col-out,#hub,main,.wrap')?.innerText || '') }));
    if (errs.length || info.nan) fails++;
    console.log((errs.length || info.nan ? '✗ ' : '✓ ') + pg + ' cartes=' + info.cards + (info.nan ? ' NaN/undefined!' : '') + (errs.length ? ' ' + errs.slice(0, 3).join(' | ') : ''));
    await p.close();
  }
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
