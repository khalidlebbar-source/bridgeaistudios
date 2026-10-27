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


  /* ── mode « diapositives » : une page = un écran ── */
  function paginate() {
    const art = $("article");
    if (!art || document.body.dataset.paged === "no") return;
    const secs = $$(":scope > section", art);
    if (secs.length < 2) return;
    document.body.classList.add("paged");
    const chInfo = COURS[idx] || { n: "", t: document.title };
    const pdfBtn = $("[data-print]");

    // barre supérieure : chapitre + page + points + flèches
    const top = el("div", { class: "pager-top" });
    top.innerHTML = `<div class="pg-row">
        <a class="pg-ch" href="${ROOT}etudiants.html" title="Tous les chapitres">${chInfo.n === "F" ? "Formulaire" : "Ch. " + chInfo.n}</a>
        <span class="pg-chname">${chInfo.t}</span>
        <span class="pg-sep">›</span>
        <span class="pg-title"></span>
        <span class="pg-count"></span>
        <button type="button" class="pg-arrow pg-a-prev" aria-label="Page précédente">‹</button>
        <button type="button" class="pg-arrow pg-a-next" aria-label="Page suivante">›</button>
        <button type="button" class="pg-pdf" title="Télécharger le chapitre en PDF">PDF</button>
      </div><div class="pg-dots"></div>`;
    art.prepend(top);
    $(".pg-pdf", top).addEventListener("click", () => { if (pdfBtn) pdfBtn.click(); else window.print(); });
    const bottom = el("div", { class: "pager-bottom" });
    bottom.innerHTML = `<button type="button" class="pg-prev">← <span></span></button><span class="pg-mid"></span><button type="button" class="pg-next"><span></span> →</button>`;
    const chNav = $(".ch-nav", art);
    art.insertBefore(bottom, chNav || null);

    let pages = [], N = 0, k = 0;
    const blocks = [];
    secs.forEach((sec, si) => Array.from(sec.children).forEach(e => {
      // une grille de fiches se découpe fiche par fiche
      if (e.matches(".fo-grid, [data-split]")) { e.dataset.pgGrid = 1; Array.from(e.children).forEach(c => blocks.push({ e: c, si, grid: e })); }
      else blocks.push({ e, si });
    }));
    const hOf = e => {
      const cs = getComputedStyle(e);
      return e.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    };
    const isHead = e => /^H[234]$/.test(e.tagName);
    const labelOf = (pgBlocks) => {
      const e0 = pgBlocks[0].e;
      if (e0.matches(".quiz")) return "Quiz : testez-vous";
      if (e0.matches(".keys")) return "À retenir";
      const h = pgBlocks.map(b => b.e).find(e => /^H[23]$/.test(e.tagName));
      if (h) return h.textContent.replace(/^\s*F?\d+(\.\d+)*\s*/, "").trim();
      const h2 = e0.closest("section").querySelector("h2");
      return h2 ? h2.textContent.replace(/^\s*F?\d+(\.\d+)*\s*/, "").trim() + " (suite)" : "Introduction";
    };

    function layout() {
      // découpage par mesure réelle : on remplit l'écran bloc par bloc
      const grids = $$("[data-pg-grid]", art);
      blocks.forEach(b => b.e.classList.add("pg-hide"));
      grids.forEach(g => g.classList.add("pg-hide"));
      secs.forEach(sec => sec.classList.add("pg-hide"));
      if (chNav) chNav.classList.add("pg-hide");
      bottom.style.display = "";
      $(".pg-title", top).textContent = "…";
      const limit = innerHeight - 12;
      const fits = () => art.getBoundingClientRect().bottom + scrollY <= limit;
      const vis = b => { b.e.classList.remove("pg-hide"); if (b.grid) b.grid.classList.remove("pg-hide"); b.e.closest("section").classList.remove("pg-hide"); };
      const hide = b => b.e.classList.add("pg-hide");
      const close = pg => {
        pg.blocks.forEach(hide);
        grids.forEach(g => g.classList.add("pg-hide"));
        secs.forEach(sec => sec.classList.add("pg-hide"));
      };
      pages = [];
      let pg = null;
      const open = () => { if (pg) close(pg); pg = { blocks: [], si: -1 }; pages.push(pg); };
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const used = pg ? art.getBoundingClientRect().height / innerHeight : 0;
        const newSec = pg && pg.blocks.length && b.si !== pg.si;
        if (!pg || b.e.matches(".quiz,.keys") || (newSec && used > .5)) open();
        pg.si = b.si;
        vis(b);
        let ok = fits();
        // un titre ne reste jamais seul en bas de page
        if (ok && isHead(b.e) && pg.blocks.length && blocks[i + 1] && blocks[i + 1].si === b.si) {
          vis(blocks[i + 1]); ok = fits(); hide(blocks[i + 1]);
        }
        if (!ok && pg.blocks.length) {
          hide(b);
          // si la page se termine par un titre, on l'emporte avec nous
          const carry = [];
          while (pg.blocks.length > 1 && isHead(pg.blocks[pg.blocks.length - 1].e)) carry.unshift(pg.blocks.pop());
          open();
          carry.forEach(c => { vis(c); pg.blocks.push(c); });
          pg.si = b.si;
          vis(b);
        }
        pg.blocks.push(b);
      }
      close(pg);
      pages.forEach((p, n) => { p.label = labelOf(p.blocks); p.blocks.forEach(b => { b.e.dataset.pg = n; }); });
      N = pages.length;
      $(".pg-dots", top).innerHTML = pages.map((p, n) => `<button type="button" title="${(n + 1) + ". " + p.label.replace(/"/g, "&quot;")}" aria-label="Page ${n + 1}"></button>`).join("");
      $$(".pg-dots button", top).forEach((d, i) => d.addEventListener("click", () => go(i)));
    }

    function show(n, scrollTop) {
      k = Math.max(0, Math.min(N - 1, n));
      $$("[data-pg]", art).forEach(e => e.classList.toggle("pg-hide", +e.dataset.pg !== k));
      $$("[data-pg-grid]", art).forEach(g => g.classList.toggle("pg-hide", !Array.from(g.children).some(e => +e.dataset.pg === k)));
      secs.forEach(sec => sec.classList.toggle("pg-hide", !$$("[data-pg]", sec).some(e => +e.dataset.pg === k)));
      $$(".pg-dots button", top).forEach((d, i) => { d.classList.toggle("on", i === k); d.classList.toggle("done", i < k); });
      $(".pg-count", top).textContent = `${k + 1} / ${N}`;
      $(".pg-title", top).textContent = pages[k].label;
      $(".pg-a-prev", top).disabled = k === 0;
      $(".pg-a-next", top).disabled = k === N - 1;
      const pv = $(".pg-prev", bottom), nx = $(".pg-next", bottom);
      pv.style.visibility = k ? "visible" : "hidden";
      nx.style.display = k < N - 1 ? "" : "none";
      if (k) $("span", pv).textContent = pages[k - 1].label;
      if (k < N - 1) $("span", nx).textContent = pages[k + 1].label;
      $(".pg-mid", bottom).textContent = `${k + 1} / ${N}`;
      if (chNav) chNav.classList.toggle("pg-hide", k < N - 1);
      document.body.classList.toggle("pg-last", k === N - 1);
      const bar = $(".reading-bar");
      if (bar) bar.style.width = ((k + 1) / N * 100) + "%";
      $$(".side .toc a").forEach(a => {
        const t = document.getElementById(a.getAttribute("href").slice(1));
        a.classList.toggle("on", !!t && +((t.closest("[data-pg]") || {}).dataset || {}).pg === k);
      });
      try { history.replaceState(null, "", "#p" + (k + 1)); } catch (e) {}
      if (scrollTop) window.scrollTo({ top: 0, behavior: "auto" });
      window.dispatchEvent(new Event("resize"));
      document.dispatchEvent(new CustomEvent("cours:page", { detail: k }));
    }
    function go(n) { show(n, true); }
    $(".pg-prev", bottom).addEventListener("click", () => go(k - 1));
    $(".pg-next", bottom).addEventListener("click", () => go(k + 1));
    $(".pg-a-prev", top).addEventListener("click", () => go(k - 1));
    $(".pg-a-next", top).addEventListener("click", () => go(k + 1));
    addEventListener("keydown", e => {
      if (e.target.closest && e.target.closest("input,select,textarea")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(k + 1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(k - 1); }
    });
    // balayage gauche / droite sur écran tactile
    let tx = null, ty = null;
    art.addEventListener("touchstart", e => { if (e.target.closest(".v3d,.calc,input,.seq-stage,svg")) { tx = null; return; } tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    art.addEventListener("touchend", e => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) go(k + (dx < 0 ? 1 : -1));
      tx = null;
    }, { passive: true });
    // liens internes
    document.addEventListener("click", e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = decodeURIComponent(a.getAttribute("href").slice(1));
      const t = id && document.getElementById(id);
      const host = t && (t.closest("[data-pg]") || t.querySelector("[data-pg]"));
      if (!host) return;
      e.preventDefault();
      show(+host.dataset.pg);
      requestAnimationFrame(() => window.scrollTo({ top: Math.max(0, t.getBoundingClientRect().top + scrollY - 110), behavior: "smooth" }));
      document.body.classList.remove("side-open");
    });
    // relayout si la fenêtre change nettement de taille
    let lastW = innerWidth, lastH = innerHeight, rt = null;
    addEventListener("resize", () => {
      if (Math.abs(innerWidth - lastW) < 80 && Math.abs(innerHeight - lastH) < 120) return;
      clearTimeout(rt);
      rt = setTimeout(() => {
        lastW = innerWidth; lastH = innerHeight;
        const anchor = pages[k] && pages[k].blocks[0].e;
        layout();
        show(anchor ? +anchor.dataset.pg : 0);
      }, 350);
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
