/* ═══════════════════════════════════════════════════════════════
   BridgeAI Studios — Espace étudiants : script commun des cours
   - menu du site, sommaire du chapitre, barre de lecture
   - formules (KaTeX), info-bulles, quiz, séquences animées
   - chargement différé de la 3D, export PDF
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const COURS = [
    { id: "ch0", n: "0", t: "Introduction au cours des ponts" },
    { id: "ch1", n: "1", t: "Constituants d'un pont & terminologie" },
    { id: "ch2", n: "2", t: "Conception des ponts courants" },
    { id: "ch3", n: "3", t: "Prédimensionnement" },
    { id: "ch4", n: "4", t: "Charges sur les ponts & réglementation" },
    { id: "ch5", n: "5", t: "Méthodes de calcul des tabliers" },
    { id: "ch6", n: "6", t: "Calcul des appuis & fondations" },
    { id: "ch7", n: "7", t: "Analyse sismique des ponts" },
    { id: "ch8", n: "8", t: "Dimensionnement & ferraillage" },
    { id: "formulaire", n: "F", t: "Formulaire de poche" }
  ];
  const ROOT = "../../";            // racine du site depuis /etudiants/ponts/
  const ASSETS = "../assets/";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, attrs = {}, html = "") => {
    const e = document.createElement(tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (html) e.innerHTML = html;
    return e;
  };

  /* format français : 1 234,5 */
  function fmt(x, d = 2) {
    if (x === null || x === undefined || !isFinite(x)) return "—";
    const s = Number(x).toFixed(d);
    const [i, f] = s.split(".");
    const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return f ? ii + "," + f : ii;
  }

  const cur = document.body.dataset.ch || "";
  const idx = COURS.findIndex(c => c.id === cur);

  /* ── menu du site ── */
  function buildNav() {
    if ($(".site-nav")) return;
    const nav = el("nav", { class: "site-nav" }, `
      <div class="in">
        <button class="menu-btn" type="button" aria-label="Sommaire">☰ Sommaire</button>
        <a href="${ROOT}index.html" class="logo">Bridge<span>AI</span> Studios</a>
        <ul>
          <li><a href="${ROOT}ponts-types.html">Ponts types</a></li>
          <li><a href="${ROOT}plans-ferraillage.html">Plans coffrage &amp; ferraillage</a></li>
          <li><a href="${ROOT}handbag.html" style="color:#1ab8a0">HandBag</a></li>
          <li><a href="${ROOT}bibliotheque.html">Bibliothèque</a></li>
          <li><a href="${ROOT}etudiants.html" class="active">Espace étudiants</a></li>
        </ul>
        <a href="${ROOT}etudiants.html" class="back">← Espace étudiants</a>
      </div>`);
    document.body.prepend(nav);
    document.body.insertBefore(el("div", { class: "reading-bar" }), nav.nextSibling);
    $(".menu-btn", nav).addEventListener("click", () => document.body.classList.toggle("side-open"));
  }

  function buildFooter() {
    if ($(".site-foot")) return;
    document.body.append(el("footer", { class: "site-foot" }, `
      <div class="in">
        <p><span class="logo">Bridge<span>AI</span> Studios</span> &nbsp;·&nbsp; Espace étudiants — Cours de ponts</p>
        <p><a href="${ROOT}etudiants.html">Tous les cours</a> &nbsp;·&nbsp; <a href="mailto:contact@bridgeaistudios.com">contact@bridgeaistudios.com</a> &nbsp;·&nbsp; © 2026 BridgeAI Studios</p>
      </div>`));
  }

  /* ── colonne latérale : chapitres + sommaire ── */
  function buildSide() {
    const side = $(".side");
    const art = $("article");
    if (!side || !art) return;
    let html = `<h4>Cours de ponts</h4><ul class="chapters">`;
    COURS.forEach(c => {
      html += `<li><a href="${c.id}.html" class="${c.id === cur ? "cur" : ""}"><small>${c.n === "F" ? c.n : "Chapitre " + c.n}</small>${c.t}</a></li>`;
    });
    html += `</ul><h4>Dans ce chapitre</h4><ul class="toc">`;
    let k = 0;
    $$("h2, h3", art).forEach(h => {
      if (h.closest(".keys,.quiz,.calc,.box,details")) return;
      if (!h.id) h.id = "s" + (++k) + "-" + h.textContent.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const txt = h.textContent.replace(/^\s*F?\d+(\.\d+)*\s*/, "").trim();
      html += `<li><a href="#${h.id}" class="${h.tagName === "H3" ? "sub" : ""}">${txt}</a></li>`;
    });
    html += `</ul>`;
    side.innerHTML = html;
    $$(".toc a", side).forEach(a => a.addEventListener("click", () => document.body.classList.remove("side-open")));

    // suivi de lecture
    const links = $$(".toc a", side);
    const heads = links.map(a => document.getElementById(a.getAttribute("href").slice(1)));
    const bar = $(".reading-bar");
    let ticking = false;
    function onScroll() {
      ticking = false;
      if (document.body.classList.contains("paged")) return;
      const y = window.scrollY + 120;
      let on = 0;
      heads.forEach((h, i) => { if (h && h.offsetTop <= y) on = i; });
      links.forEach((a, i) => a.classList.toggle("on", i === on));
      if (bar) {
        const max = document.documentElement.scrollHeight - innerHeight;
        bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + "%";
      }
    }
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }


  /* ── mode diaporama : diapositives 16:9 à taille fixe, ajustées à l'écran ── */
  function paginate() {
    const art = $("article");
    if (!art || document.body.dataset.paged === "no") return;
    if (!$$(":scope > section", art).length) return;
    const chInfo = COURS[idx] || { n: "", t: document.title };
    const pdfBtn = $("[data-print]");
    const chName = chInfo.n === "F" ? "Formulaire" : "Chapitre " + chInfo.n;

    // diapositive de titre (reprise de l'en-tête)
    const head = $(".ch-head");
    let ts = null;
    if (head) {
      const h1 = $("h1", head), num = $(".ch-num", head), lede = $(":scope > section .lede", art);
      ts = el("div", { class: "title-slide" }, `
        <div class="ts-num">${num ? num.textContent : ""}</div>
        <div class="ts-txt"><div class="ts-kicker">Cours de ponts · ${chName}</div>
        <h1>${h1 ? h1.innerHTML : chInfo.t}</h1>
        ${lede ? `<p>${lede.innerHTML}</p>` : ""}
        <div class="ts-hint">Appuyez sur <b>→</b> ou cliquez sur <b>›</b> pour commencer</div></div>`);
      if (lede) lede.dataset.dup = 1;
      art.prepend(ts);
    }
    const secs = $$(":scope > section", art);

    // structure du diaporama
    document.body.classList.add("paged", "deck-mode");
    const deck = el("div", { class: "deck" });
    deck.innerHTML = `
      <div class="deck-bar">
        <button type="button" class="db-menu" title="Sommaire">☰</button>
        <a class="db-home" href="${ROOT}etudiants.html" title="Espace étudiants">Bridge<span>AI</span></a>
        <span class="db-ch">${chName}</span>
        <span class="db-title"></span>
        <span class="db-count"></span>
        <button type="button" class="db-prev" aria-label="Diapositive précédente">‹</button>
        <button type="button" class="db-next" aria-label="Diapositive suivante">›</button>
        <button type="button" class="db-full" title="Plein écran">⛶</button>
        <button type="button" class="db-pdf" title="Télécharger le chapitre en PDF">PDF</button>
        <div class="db-prog"><i></i></div>
      </div>
      <div class="deck-view">
        <div class="slide-wrap"><div class="slide">
          <div class="slide-head"><span class="sh-sec"></span><span class="sh-ch">${chInfo.t}</span></div>
          <div class="slide-body"></div>
          <div class="slide-foot"><span>BridgeAI Studios · Cours de ponts</span><span class="sf-n"></span></div>
        </div></div>
        <button type="button" class="deck-nav dn-prev" aria-label="Précédente">‹</button>
        <button type="button" class="deck-nav dn-next" aria-label="Suivante">›</button>
      </div>`;
    document.body.append(deck);
    const slide = $(".slide", deck), body = $(".slide-body", deck), wrap = $(".slide-wrap", deck);
    body.append(art);
    const chNav = $(".ch-nav", art);
    $(".db-menu", deck).addEventListener("click", () => document.body.classList.toggle("side-open"));
    $(".db-pdf", deck).addEventListener("click", () => { if (pdfBtn) pdfBtn.click(); else window.print(); });
    $(".db-full", deck).addEventListener("click", () => {
      try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) {}
    });

    // blocs à répartir
    const blocks = [];
    if (ts) blocks.push({ e: ts, si: -1, alone: true });
    secs.forEach((sec, si) => Array.from(sec.children).forEach(e => {
      if (e.dataset.dup) { e.dataset.pgSkip = 1; }
      if (e.matches(".fo-grid, [data-split]")) { e.dataset.pgGrid = 1; Array.from(e.children).forEach(c => blocks.push({ e: c, si, grid: e })); }
      else blocks.push({ e, si });
    }));
    const isHead = e => /^H[234]$/.test(e.tagName);
    const clean = t => t.replace(/^\s*F?\d+(\.\d+)*\s*/, "").trim();
    const secTitle = si => { const h = si >= 0 && $("h2", secs[si]); return h ? clean(h.textContent) : ""; };
    const labelOf = pgBlocks => {
      const e0 = pgBlocks[0].e;
      if (e0 === ts) return "Titre";
      if (e0.matches(".keys")) return "À retenir";
      const h = pgBlocks.map(b => b.e).find(e => /^H[23]$/.test(e.tagName));
      if (h) return clean(h.textContent);
      return secTitle(pgBlocks[0].si) || "Introduction";
    };

    let W = 1280, H = 720, BH = 0, pages = [], N = 0, k = 0;
    function dims() {
      const vw = innerWidth, vh = innerHeight - 44;
      if (vw < 760) { W = 400; H = Math.max(560, Math.round(W * (vh - 10) / (vw - 10))); deck.classList.add("narrow"); }
      else { W = 1280; H = 720; deck.classList.remove("narrow"); }
      slide.style.width = W + "px"; slide.style.height = H + "px";
      BH = H - (deck.classList.contains("narrow") ? 62 : 92);
      body.style.height = BH + "px";
      slide.style.setProperty("--bh", BH + "px");
    }
    function fitScreen() {
      const narrow = deck.classList.contains("narrow");
      const mx = narrow ? 6 : 64, my = narrow ? 6 : 18;
      const s = Math.min((innerWidth - 2 * mx) / W, (innerHeight - 44 - 2 * my) / H, 2);
      slide.style.transform = `scale(${s})`;
      wrap.style.width = W * s + "px"; wrap.style.height = H * s + "px";
    }
    function fitInner() {
      art.style.transform = "";
      const ch = art.offsetHeight;
      if (ch > BH) { const f = BH / ch; art.style.transform = `scale(${f})`; }
    }

    function layout() {
      dims();
      art.style.transform = "";
      const grids = $$("[data-pg-grid]", art);
      blocks.forEach(b => b.e.classList.add("pg-hide"));
      grids.forEach(g => g.classList.add("pg-hide"));
      secs.forEach(sec => sec.classList.add("pg-hide"));
      $$("[data-pg-skip]", art).forEach(e => e.classList.add("pg-hide"));
      if (chNav) chNav.classList.add("pg-hide");
      const fits = () => art.offsetHeight <= BH;
      const vis = b => { b.e.classList.remove("pg-hide"); if (b.grid) b.grid.classList.remove("pg-hide"); if (b.si >= 0) secs[b.si].classList.remove("pg-hide"); };
      const hide = b => b.e.classList.add("pg-hide");
      const close = pg => { pg.blocks.forEach(hide); grids.forEach(g => g.classList.add("pg-hide")); secs.forEach(sec => sec.classList.add("pg-hide")); };
      pages = [];
      let pg = null;
      const open = () => { if (pg) close(pg); pg = { blocks: [], si: -2 }; pages.push(pg); };
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.e.dataset.pgSkip) continue;
        const used = pg ? art.offsetHeight / BH : 0;
        const newSec = pg && pg.blocks.length && b.si !== pg.si;
        if (!pg || b.alone || (pg.blocks[0] && pg.blocks[0].alone) || b.e.matches(".keys") || (newSec && used > .45)) open();
        pg.si = b.si;
        vis(b);
        let ok = fits();
        if (ok && isHead(b.e) && pg.blocks.length && blocks[i + 1] && blocks[i + 1].si === b.si) { vis(blocks[i + 1]); ok = fits(); hide(blocks[i + 1]); }
        if (!ok && pg.blocks.length) {
          hide(b);
          const carry = [];
          while (pg.blocks.length > 1 && isHead(pg.blocks[pg.blocks.length - 1].e)) carry.unshift(pg.blocks.pop());
          open();
          carry.forEach(c => { vis(c); pg.blocks.push(c); });
          pg.si = b.si; vis(b);
        }
        pg.blocks.push(b);
      }
      close(pg);
      // dernière diapositive : liens vers les chapitres voisins
      if (chNav) { pages.push({ blocks: [{ e: chNav, si: -1 }], si: -1, end: true }); }
      pages.forEach((p, n) => { p.label = p.end ? "Suite du cours" : labelOf(p.blocks); p.blocks.forEach(b => { b.e.dataset.pg = n; }); });
      N = pages.length;
      fitScreen();
    }

    function show(n) {
      k = Math.max(0, Math.min(N - 1, n));
      $$("[data-pg]", art).forEach(e => e.classList.toggle("pg-hide", +e.dataset.pg !== k));
      $$("[data-pg-grid]", art).forEach(g => g.classList.toggle("pg-hide", !Array.from(g.children).some(e => +e.dataset.pg === k)));
      secs.forEach(sec => sec.classList.toggle("pg-hide", !$$("[data-pg]", sec).some(e => +e.dataset.pg === k)));
      const p = pages[k];
      slide.classList.toggle("is-title", !!(p.blocks[0] && p.blocks[0].e === ts));
      slide.classList.toggle("is-end", !!p.end);
      const sec = p.blocks[0] ? secTitle(p.blocks[0].si) : "";
      $(".sh-sec", deck).textContent = p.end ? "Fin du chapitre" : (sec || p.label);
      $(".sf-n", deck).textContent = `${k + 1} / ${N}`;
      $(".db-title", deck).textContent = p.label;
      $(".db-count", deck).textContent = `${k + 1} / ${N}`;
      $(".db-prog i", deck).style.width = ((k + 1) / N * 100) + "%";
      $(".db-prev", deck).disabled = $(".dn-prev", deck).disabled = k === 0;
      $(".db-next", deck).disabled = $(".dn-next", deck).disabled = k === N - 1;
      $$(".side .toc a").forEach(a => {
        const t = document.getElementById(a.getAttribute("href").slice(1));
        a.classList.toggle("on", !!t && +((t.closest("[data-pg]") || {}).dataset || {}).pg === k);
      });
      try { history.replaceState(null, "", "#p" + (k + 1)); } catch (e) {}
      fitInner();
      window.dispatchEvent(new Event("resize"));
      document.dispatchEvent(new CustomEvent("cours:page", { detail: k }));
    }
    const go = n => show(n);
    ["db-prev", "dn-prev"].forEach(c => $("." + c, deck).addEventListener("click", () => go(k - 1)));
    ["db-next", "dn-next"].forEach(c => $("." + c, deck).addEventListener("click", () => go(k + 1)));
    addEventListener("keydown", e => {
      if (e.target.closest && e.target.closest("input,select,textarea")) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(k + 1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(k - 1); }
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(N - 1);
      else if (e.key === "f" || e.key === "F") $(".db-full", deck).click();
    });
    let tx = null, ty = null;
    deck.addEventListener("touchstart", e => { if (e.target.closest(".v3d,.calc,input,select,.seq-stage,.hotspots")) { tx = null; return; } tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    deck.addEventListener("touchend", e => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(k + (dx < 0 ? 1 : -1));
      tx = null;
    }, { passive: true });
    document.addEventListener("click", e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = decodeURIComponent(a.getAttribute("href").slice(1));
      const t = id && document.getElementById(id);
      const host = t && (t.closest("[data-pg]") || t.querySelector("[data-pg]"));
      if (!host) return;
      e.preventDefault();
      show(+host.dataset.pg);
      document.body.classList.remove("side-open");
    });
    let lastW = innerWidth, lastH = innerHeight, rt = null;
    addEventListener("resize", () => {
      fitScreen();
      const crossed = (innerWidth < 760) !== (lastW < 760);
      if (!crossed && !(innerWidth < 760 && Math.abs(innerHeight - lastH) > 120)) return;
      clearTimeout(rt);
      rt = setTimeout(() => {
        lastW = innerWidth; lastH = innerHeight;
        const anchor = pages[k] && pages[k].blocks[0] && pages[k].blocks[0].e;
        layout();
        show(anchor && anchor.dataset.pg ? +anchor.dataset.pg : 0);
      }, 300);
    });
    layout();
    let start = 0;
    const h = location.hash.slice(1);
    if (/^p\d+$/.test(h)) start = +h.slice(1) - 1;
    else if (h && document.getElementById(h)) { const host = document.getElementById(h).closest("[data-pg]"); if (host) start = +host.dataset.pg; }
    show(start);
    window.Cours.page = { show, get count() { return N; } };
  }

  /* ── précédent / suivant ── */
  function buildChNav() {
    const art = $("article");
    if (!art || idx < 0 || $(".ch-nav")) return;
    const p = COURS[idx - 1], n = COURS[idx + 1];
    const lab = c => (c.n === "F") ? c.n : "Chapitre " + c.n;
    art.append(el("div", { class: "ch-nav" },
      (p ? `<a href="${p.id}.html" class="prev"><small>← ${lab(p)}</small><span>${p.t}</span></a>` : `<a href="${ROOT}etudiants.html" class="prev"><small>← Retour</small><span>Espace étudiants</span></a>`) +
      (n ? `<a href="${n.id}.html" class="next"><small>${lab(n)} →</small><span>${n.t}</span></a>` : `<a href="${ROOT}etudiants.html" class="next"><small>Fin du cours →</small><span>Espace étudiants</span></a>`)));
  }

  /* ── formules ── */
  function renderTex(root = document) {
    if (!window.katex) return;
    $$(".tex, .texd", root).forEach(e => {
      if (e.dataset.done) return;
      const src = e.dataset.src || e.textContent;
      e.dataset.src = src;
      try {
        e.innerHTML = katex.renderToString(src, { throwOnError: false, strict: "ignore", displayMode: e.classList.contains("texd") });
        e.dataset.done = 1;
      } catch (err) { /* laisse le texte brut */ }
    });
  }

  /* ── info-bulles (data-tip="Titre|texte") ── */
  function tips() {
    const box = el("div", { class: "tipbox" });
    document.body.append(box);
    let pinned = null;
    function show(t, x, y) {
      const [a, b] = t.split("|");
      box.innerHTML = b ? `<b>${a}</b>${b}` : a;
      box.classList.add("on");
      const w = box.offsetWidth, h = box.offsetHeight;
      box.style.left = Math.min(innerWidth - w - 10, Math.max(10, x + 14)) + "px";
      box.style.top = Math.min(innerHeight - h - 10, Math.max(70, y + 14)) + "px";
    }
    document.addEventListener("mousemove", e => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (t) show(t.dataset.tip, e.clientX, e.clientY);
      else if (!pinned) box.classList.remove("on");
    });
    document.addEventListener("click", e => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (t) { pinned = t; show(t.dataset.tip, e.clientX, e.clientY); }
      else { pinned = null; box.classList.remove("on"); }
    });
    addEventListener("scroll", () => { if (!pinned) box.classList.remove("on"); }, { passive: true });
  }

  /* ── quiz ── */
  function quizzes() {
    $$(".quiz").forEach(qz => {
      const qs = $$(".q", qz);
      const head = el("div", { class: "quiz-h" }, `<b>${qz.dataset.title || "Testez-vous"}</b><span class="score">0 / ${qs.length}</span>`);
      qz.prepend(head);
      let score = 0, answered = 0;
      qs.forEach(q => {
        const good = +q.dataset.a;
        const btns = $$(".opts button", q);
        btns.forEach((b, i) => {
          b.type = "button";
          b.addEventListener("click", () => {
            if (q.classList.contains("done")) return;
            q.classList.add("done");
            answered++;
            if (i === good) { b.classList.add("ok"); score++; }
            else { b.classList.add("ko"); btns[good].classList.add("ok"); }
            $(".score", head).textContent = `${score} / ${qs.length}` + (answered === qs.length ? (score === qs.length ? " — parfait !" : score >= qs.length * .6 ? " — bien" : " — à revoir") : "");
            if (nav) upd();
          });
        });
      });
      // une question à la fois
      let nav = null, qi = 0;
      if (qs.length > 2) {
        qz.classList.add("one");
        nav = el("div", { class: "q-nav" }, `<button type="button" class="q-prev">← Précédente</button><span class="q-pos"></span><button type="button" class="q-next">Question suivante →</button>`);
        qz.append(nav);
        $(".q-prev", nav).addEventListener("click", () => { qi = Math.max(0, qi - 1); upd(); });
        $(".q-next", nav).addEventListener("click", () => { qi = Math.min(qs.length - 1, qi + 1); upd(); });
      }
      function upd() {
        qs.forEach((q, i) => q.classList.toggle("q-cur", i === qi));
        $(".q-pos", nav).textContent = `Question ${qi + 1} / ${qs.length}`;
        $(".q-prev", nav).disabled = qi === 0;
        $(".q-next", nav).disabled = qi === qs.length - 1;
      }
      if (nav) upd();
    });
  }

  /* ── séquences animées ── */
  window.SEQ_HOOK = window.SEQ_HOOK || {};
  function sequences() {
    $$(".seq").forEach(seq => {
      const stage = $(".seq-stage", seq);
      const list = $("ol.seq-steps", seq);
      if (!stage || !list) return;
      const steps = $$("li", list);
      list.style.display = "none";
      const N = steps.length;
      const top = el("div", { class: "seq-top" }, `<span class="rec">${seq.dataset.title || "Séquence animée"}</span><span>${N} étapes</span>`);
      const cap = el("div", { class: "seq-cap" });
      const ctl = el("div", { class: "seq-ctl" }, `
        <button type="button" class="prev" aria-label="Étape précédente">◀</button>
        <button type="button" class="play" aria-label="Lecture">▶</button>
        <button type="button" class="next" aria-label="Étape suivante">▶▶</button>
        <div class="seq-prog">${steps.map(() => "<span><i></i></span>").join("")}</div>
        <span class="seq-count"></span>
        <button type="button" class="restart" aria-label="Recommencer">↺</button>`);
      seq.prepend(top);
      seq.append(cap, ctl);
      const segs = $$(".seq-prog span", ctl);
      const hook = window.SEQ_HOOK[seq.dataset.seq];
      let k = 0, timer = null, playing = false;

      function go(n) {
        k = Math.max(1, Math.min(N, n));
        $$("[data-step]", stage).forEach(g => {
          const s = +g.dataset.step;
          g.classList.toggle("on", s === k);
          g.classList.toggle("past", s < k);
        });
        $$("[data-only]", stage).forEach(g => {
          const set = g.dataset.only.split(",").map(v => v.trim());
          const vis = set.some(v => v.includes("-") ? (k >= +v.split("-")[0] && k <= +v.split("-")[1]) : +v === k);
          g.classList.toggle("off", !vis);
        });
        cap.innerHTML = `<b>${k}.</b> ` + steps[k - 1].innerHTML;
        $(".seq-count", ctl).textContent = `${k} / ${N}`;
        segs.forEach((s, i) => {
          s.classList.toggle("done", i < k - 1);
          const bar = s.firstChild;
          bar.style.transition = "none";
          bar.style.width = i < k - 1 ? "100%" : "0";
        });
        if (hook) try { hook(k, stage, seq); } catch (e) { console.warn(e); }
        renderTex(cap);
        if (playing) schedule();
      }
      function schedule() {
        clearTimeout(timer);
        const d = +(steps[k - 1].dataset.dur || seq.dataset.dur || 4600);
        const bar = segs[k - 1].firstChild;
        requestAnimationFrame(() => { bar.style.transition = `width ${d}ms linear`; bar.style.width = "100%"; });
        timer = setTimeout(() => {
          if (k < N) go(k + 1);
          else { playing = false; setBtn(); timer = setTimeout(() => {}, 0); }
        }, d);
      }
      function setBtn() { $(".play", ctl).textContent = playing ? "❚❚" : "▶"; }
      function play() { if (k >= N) go(1); playing = true; setBtn(); schedule(); }
      function pause() { playing = false; setBtn(); clearTimeout(timer); const bar = segs[k - 1].firstChild; bar.style.transition = "none"; bar.style.width = "0"; }
      $(".play", ctl).addEventListener("click", () => playing ? pause() : play());
      $(".next", ctl).addEventListener("click", () => { go(k + 1); });
      $(".prev", ctl).addEventListener("click", () => { go(k - 1); });
      $(".restart", ctl).addEventListener("click", () => { go(1); if (!playing) play(); });
      segs.forEach((s, i) => s.addEventListener("click", () => go(i + 1)));
      stage.addEventListener("click", () => playing ? pause() : play());
      go(1);
      // démarre tout seul quand la séquence apparaît à l'écran
      if ("IntersectionObserver" in window && seq.dataset.autoplay !== "no") {
        let started = false;
        const io = new IntersectionObserver(es => {
          es.forEach(e => {
            if (e.isIntersecting && !started) { started = true; play(); }
            else if (!e.isIntersecting && playing) pause();
          });
        }, { threshold: .55 });
        io.observe(seq);
      }
    });
  }

  /* ── 3D (chargement différé) ── */
  function loadScript(src) {
    return new Promise((ok, ko) => {
      if ($(`script[src="${src}"]`)) { ok(); return; }
      const s = el("script", { src });
      s.onload = ok; s.onerror = ko;
      document.head.append(s);
    });
  }
  let threeP = null;
  function three() {
    if (!threeP) threeP = loadScript(ASSETS + "vendor/three.min.js")
      .then(() => loadScript(ASSETS + "vendor/OrbitControls.js"))
      .then(() => loadScript(ASSETS + "bridge3d.js"));
    return threeP;
  }
  function viewers() {
    const vs = $$(".v3d[data-model]");
    if (!vs.length) return;
    const mount = v => {
      if (v.dataset.mounted) return;
      v.dataset.mounted = 1;
      three().then(() => window.Bridge3D && window.Bridge3D.mount(v)).catch(() => {
        const st = $(".stage", v);
        if (st) st.innerHTML = `<div class="fallback">La vue 3D n'a pas pu être chargée sur cet appareil.</div>`;
      });
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { mount(e.target); io.unobserve(e.target); } }), { rootMargin: "300px" });
      vs.forEach(v => io.observe(v));
    } else vs.forEach(mount);
  }

  /* ── PDF ── */
  function printing() {
    const prep = () => {
      $$("details").forEach(d => { d.dataset.wasOpen = d.open ? 1 : 0; d.open = true; });
    };
    const undo = () => { $$("details").forEach(d => { d.open = d.dataset.wasOpen === "1"; }); };
    addEventListener("beforeprint", prep);
    addEventListener("afterprint", undo);
    $$("[data-print]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); prep(); setTimeout(() => window.print(), 60); }));
    // lien « Télécharger en PDF » depuis l'espace étudiants : page.html?pdf=1
    if (/[?&]pdf=1\b/.test(location.search)) {
      addEventListener("load", () => {
        if (window.katex) renderTex();
        prep();
        setTimeout(() => window.print(), 900);
      });
    }
  }

  /* API pour les scripts des pages */
  window.Cours = { fmt, $, $$, el, renderTex, COURS };

  function init() {
    buildNav();
    buildSide();
    buildChNav();
    buildFooter();
    renderTex();
    tips();
    quizzes();
    sequences();
    paginate();
    viewers();
    printing();
    document.dispatchEvent(new Event("cours:ready"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
