/* ═══════════════════════════════════════════════════════════════
   BridgeAI Studios — Cours de ponts : moteur de diaporama
   - diapositives <section class="slide"> dans <div class="deck">
   - data-a : animation automatique à l'arrivée (data-d = délai en s)
   - data-b="1,2…" : apparition au clic (comme PowerPoint)
   - data-fx : up | down | left | right | zoom | fade | pop | grow | growx | draw
   - window.SLIDE_HOOK[id](step, slide) : animation sur mesure
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const CHAPTERS = [
    ["ch1", "1", "Les ponts : histoire, rôles et acteurs"],
    ["ch2", "2", "Anatomie d'un pont"],
    ["ch3", "3", "Les familles de ponts"],
    ["ch4", "4", "Concevoir un pont"],
    ["ch5", "5", "Construire un pont"],
    ["ch6", "6", "Prédimensionner"],
    ["ch7", "7", "Charges et règlements"],
    ["ch8", "8", "Calculer le tablier"],
    ["ch9", "9", "Appuis et fondations"],
    ["ch10", "10", "Séisme, dimensionnement et durabilité"]
  ];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const W = 1280, H = 720;
  const deck = $(".deck");
  if (!deck) return;
  const slides = $$(".slide", deck);
  const N = slides.length;
  const cur = document.body.dataset.ch || "";
  const ci = CHAPTERS.findIndex(c => c[0] === cur);
  const chap = CHAPTERS[ci] || ["", "", document.title];

  /* scène */
  const stage = document.createElement("div"); stage.className = "stage";
  const frame = document.createElement("div"); frame.className = "frame";
  deck.parentNode.insertBefore(stage, deck);
  stage.append(frame); frame.append(deck);
  function fit() {
    const m = innerWidth < 700 ? 0 : 18;
    const s = Math.min((innerWidth - 2 * m) / W, (innerHeight - 2 * m) / H);
    deck.style.transform = `scale(${s})`;
    frame.style.width = W * s + "px"; frame.style.height = H * s + "px";
  }
  addEventListener("resize", fit); fit();

  /* préparation des diapositives */
  slides.forEach((sl, i) => {
    sl.dataset.i = i;
    if (!$(".foot", sl)) {
      const f = document.createElement("div"); f.className = "foot";
      f.innerHTML = `<span>Cours de ponts · Chapitre ${chap[1]} — ${chap[2]}</span><span class="n">${i + 1} / ${N}</span>`;
      sl.append(f);
    }
    $$("[data-d]", sl).forEach(e => e.style.setProperty("--dl", e.dataset.d + "s"));
    // tout s'affiche d'un coup : les éléments « au clic » apparaissent en cascade rapide
    $$("[data-b]", sl).forEach(e => {
      const m = Math.min(...e.dataset.b.split(",").map(Number));
      e.style.setProperty("--dl", ((m - 1) * 0.12 + 0.1 + (+e.dataset.d || 0)).toFixed(2) + "s");
    });
    // nombre d'étapes au clic
    let max = 0;
    $$("[data-b]", sl).forEach(e => e.dataset.b.split(",").forEach(v => { max = Math.max(max, +v); }));
    sl.dataset.steps = max;
  });
  // longueur des tracés à dessiner
  function prepDraw(root) {
    $$('[data-fx="draw"]', root).forEach(g => {
      const items = g.matches("path,line,polyline") ? [g] : $$("path,line,polyline,circle,rect", g);
      items.forEach(p => { try { const L = Math.ceil(p.getTotalLength ? p.getTotalLength() : 1000) + 2; p.style.setProperty("--len", L); } catch (e) {} });
    });
  }

  /* formules */
  function tex(root) {
    if (!window.katex) return;
    $$(".tex,.texd", root).forEach(e => {
      if (e.dataset.done) return;
      const src = e.textContent; e.dataset.src = src;
      try { e.innerHTML = katex.renderToString(src, { throwOnError: false, strict: "ignore", displayMode: e.classList.contains("texd") }); e.dataset.done = 1; } catch (err) {}
    });
  }

  /* 3D à la demande */
  const ASSETS = "../assets/";
  let threeP = null;
  function load(src) { return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.append(s); }); }
  function three() {
    if (!threeP) threeP = load(ASSETS + "vendor/three.min.js").then(() => load(ASSETS + "vendor/OrbitControls.js")).then(() => load(ASSETS + "bridge3d.js"));
    return threeP;
  }
  function mount3d(sl) {
    $$(".v3d[data-model]", sl).forEach(v => {
      if (v.dataset.mounted) return; v.dataset.mounted = 1;
      three().then(() => window.Bridge3D && window.Bridge3D.mount(v)).catch(() => {});
    });
  }

  /* navigation */
  let k = -1, step = 0;
  const hooks = window.SLIDE_HOOK = window.SLIDE_HOOK || {};
  function apply(sl, st) {
    $$("[data-b]", sl).forEach(e => {
      const set = e.dataset.b.split(",").map(Number);
      const minS = Math.min(...set);
      const only = e.hasAttribute("data-only");
      const vis = only ? set.includes(st) : st >= minS;
      if (vis && !e.classList.contains("go")) { e.classList.remove("go"); void e.offsetWidth; e.classList.add("go"); }
      if (!vis) e.classList.remove("go");
    });
    const hk = hooks[sl.id];
    if (hk) try { hk(st, sl); } catch (e) { console.warn(e); }
  }
  function show(n, st, dir) {
    n = Math.max(0, Math.min(N - 1, n));
    const changed = n !== k;
    if (changed) {
      if (k >= 0) { slides[k].classList.remove("on", "enter-next", "enter-prev"); $$(".go", slides[k]).forEach(e => e.classList.remove("go")); }
      k = n;
      const sl = slides[k];
      sl.classList.add("on");
      if (dir) sl.classList.add(dir > 0 ? "enter-next" : "enter-prev");
      tex(sl); prepDraw(sl); mount3d(sl);
      $$("[data-a]", sl).forEach(e => { e.classList.remove("go"); void e.offsetWidth; e.classList.add("go"); });
      try { history.replaceState(null, "", "#" + (k + 1)); } catch (e) {}
      $$(".toc .sl a").forEach((a, i) => a.classList.toggle("on", i === k));
      window.dispatchEvent(new Event("resize"));
    }
    step = st === "end" ? +slides[k].dataset.steps : (st || 0);
    apply(slides[k], step);
    $(".cnt").textContent = `${k + 1} / ${N}`;
    $(".progress").style.width = ((k + (slides[k].dataset.steps > 0 ? step / slides[k].dataset.steps : 1)) / N * 100) + "%";
    $(".prev").disabled = k === 0;
    $(".next").disabled = k === N - 1 && !(ci >= 0 && ci < CHAPTERS.length - 1);
    $(".replay").style.visibility = +slides[k].dataset.steps > 0 ? "visible" : "hidden";
  }
  let replayT = null;
  function stopReplay() { clearInterval(replayT); replayT = null; slides.forEach(x => x.classList.remove("replaying")); }
  function next() {
    stopReplay();
    if (k < N - 1) show(k + 1, "end", 1);
    else if (ci >= 0 && ci < CHAPTERS.length - 1) location.href = CHAPTERS[ci + 1][0] + ".html";
  }
  function prev() {
    stopReplay();
    if (k > 0) show(k - 1, "end", -1);
  }
  // « Rejouer » : refait l'animation pas à pas de la diapositive
  function replay() {
    stopReplay();
    const n = +slides[k].dataset.steps;
    if (!n) return;
    let s = 0; slides[k].classList.add("replaying"); show(k, 0);
    replayT = setInterval(() => { s++; show(k, s); if (s >= n) { clearInterval(replayT); replayT = null; setTimeout(() => slides.forEach(x => x.classList.remove("replaying")), 900); } }, 1100);
  }

  /* interface */
  const ui1 = document.createElement("div"); ui1.className = "ui top";
  ui1.innerHTML = `<button type="button" class="menu" title="Sommaire (S)">☰</button>
    <a class="logo" href="../../etudiants.html" title="Espace étudiants">Bridge<span>AI</span></a>
    <span class="chap ui-chip" style="height:26px;padding:0 10px;border-radius:7px;display:inline-flex;align-items:center;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#14171f;background:#e2c070">Chapitre ${chap[1]}</span>`;
  const ui2 = document.createElement("div"); ui2.className = "ui bot";
  ui2.innerHTML = `<button type="button" class="prev" title="Précédent (←)">‹</button><span class="cnt"></span><button type="button" class="next" title="Suivant (→ ou espace)">›</button>
    <button type="button" class="replay" title="Rejouer l'animation pas à pas (R)">↻ Animer</button><button type="button" class="full" title="Plein écran (F)">⛶</button><button type="button" class="pdf" title="Télécharger en PDF">PDF</button>`;
  const prog = document.createElement("div"); prog.className = "progress";
  const toc = document.createElement("nav"); toc.className = "toc";
  let th = `<h4>Chapitre ${chap[1]} — ${chap[2]}</h4><div class="sl">`;
  slides.forEach((sl, i) => {
    const t = sl.dataset.title || ($("h2", sl) || $("h1", sl) || { textContent: "Diapositive " + (i + 1) }).textContent.trim();
    th += `<a href="#${i + 1}" data-i="${i}"><i>${i + 1}</i><span>${t}</span></a>`;
  });
  th += `</div><hr><h4>Tous les chapitres</h4><div class="chs">` + CHAPTERS.map(c => `<a href="${c[0]}.html"${c[0] === cur ? ' class="on"' : ""}><i>${c[1]}</i><span>${c[2]}</span></a>`).join("") + `</div><hr><div class="chs"><a href="../../etudiants.html"><i>←</i><span>Espace étudiants</span></a></div>`;
  toc.innerHTML = th;
  const hint = document.createElement("div"); hint.className = "hint";
  hint.textContent = "→ / espace : diapositive suivante · ← : précédente · R : rejouer l'animation · F : plein écran · S : sommaire";
  document.body.append(ui1, ui2, prog, toc, hint);
  setTimeout(() => { hint.style.opacity = 0; }, 5000);

  $(".next", ui2).addEventListener("click", next);
  $(".prev", ui2).addEventListener("click", prev);
  $(".full", ui2).addEventListener("click", full);
  $(".replay", ui2).addEventListener("click", replay);
  $(".pdf", ui2).addEventListener("click", printAll);
  $(".menu", ui1).addEventListener("click", () => document.body.classList.toggle("toc-open"));
  toc.addEventListener("click", e => {
    const a = e.target.closest("a[data-i]"); if (!a) return;
    e.preventDefault(); stopReplay(); show(+a.dataset.i, "end", 1); document.body.classList.remove("toc-open");
  });
  function full() { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) {} }
  addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest("input,select,textarea")) return;
    const key = e.key;
    if (["ArrowRight", "PageDown", " ", "Enter", "ArrowDown"].includes(key)) { e.preventDefault(); next(); }
    else if (["ArrowLeft", "PageUp", "ArrowUp", "Backspace"].includes(key)) { e.preventDefault(); prev(); }
    else if (key === "Home") { stopReplay(); show(0, "end"); }
    else if (key === "End") { stopReplay(); show(N - 1, "end"); }
    else if (key === "r" || key === "R") replay();
    else if (key === "f" || key === "F") full();
    else if (key === "s" || key === "S") document.body.classList.toggle("toc-open");
    else if (key === "Escape") document.body.classList.remove("toc-open");
  });
  // clic sur la diapositive = avancer (sauf éléments interactifs)
  deck.addEventListener("click", e => {
    if (e.target.closest("a,button,input,select,label,.v3d,.interactive,[data-tip]")) return;
    if (document.body.classList.contains("toc-open")) { document.body.classList.remove("toc-open"); return; }
    const r = deck.getBoundingClientRect();
    if (e.clientX < r.left + r.width * .18) prev(); else next();
  });
  // balayage tactile
  let tx = null, ty = null;
  deck.addEventListener("touchstart", e => { if (e.target.closest(".v3d,.interactive,input,select")) { tx = null; return; } tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  deck.addEventListener("touchend", e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) { e.preventDefault(); dx < 0 ? next() : prev(); }
    tx = null;
  });
  // commandes masquées après inactivité
  let idleT = null;
  const wake = () => { document.body.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add("idle"), 3000); };
  ["mousemove", "touchstart", "keydown"].forEach(ev => addEventListener(ev, wake, { passive: true })); wake();

  /* info-bulles data-tip="Titre|texte" */
  const tip = document.createElement("div"); tip.className = "tipbox"; document.body.append(tip);
  document.addEventListener("mousemove", e => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { tip.classList.remove("on"); return; }
    const [a, b] = t.dataset.tip.split("|");
    tip.innerHTML = b ? `<b>${a}</b>${b}` : a;
    tip.classList.add("on");
    tip.style.left = Math.min(innerWidth - tip.offsetWidth - 10, e.clientX + 14) + "px";
    tip.style.top = Math.min(innerHeight - tip.offsetHeight - 10, e.clientY + 14) + "px";
  });

  /* PDF : toutes les diapositives, toutes les animations visibles */
  function printAll() {
    slides.forEach(sl => { tex(sl); });
    setTimeout(() => window.print(), 80);
  }
  addEventListener("beforeprint", () => slides.forEach(sl => tex(sl)));

  window.Slides = { show, next, prev, get index() { return k; }, get step() { return step; }, count: N };

  let start = parseInt(location.hash.slice(1), 10);
  show(isNaN(start) ? 0 : start - 1, "end");
  if (/[?&]pdf=1\b/.test(location.search)) addEventListener("load", () => setTimeout(printAll, 700));
})();
