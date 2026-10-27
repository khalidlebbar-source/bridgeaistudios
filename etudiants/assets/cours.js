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
      const txt = h.textContent.replace(/^\s*\d+(\.\d+)*\s*/, "").trim();
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


  /* ── découpage en pages courtes (≈ 2 écrans) ── */
  function paginate() {
    const art = $("article");
    if (!art || document.body.dataset.paged === "no") return;
    const secs = $$(":scope > section", art);
    if (secs.length < 2) return;
    const target = Math.max(1100, Math.min(1700, innerHeight * 1.9));
    // 1. morceaux : chaque h2 et chaque h3 « de premier niveau » ouvre un morceau
    const chunks = [];
    secs.forEach((sec, si) => {
      let cur = null;
      Array.from(sec.children).forEach(ch => {
        const isQuiz = ch.matches(".quiz");
        const head = ch.tagName === "H2" || ch.tagName === "H3" || isQuiz;
        if (!cur || (head && cur.els.length)) {
          cur = { sec: si, els: [], h2: ch.tagName === "H2", title: head && !isQuiz ? ch : null, force: isQuiz, quiz: isQuiz };
          chunks.push(cur);
        }
        cur.els.push(ch);
      });
    });
    chunks.forEach(c => {
      c.h = c.els.reduce((a, e) => a + e.offsetHeight + 16, 0);
      if (!c.title) c.title = c.els[0].closest("section").querySelector("h2");
    });
    // 2. regroupement : nouvelle page à chaque section, et à un h3 si la page devient trop longue
    const pages = [];
    let pg = null;
    chunks.forEach(c => {
      const newSec = !pg || c.sec !== pg.sec;
      const small = pg && pg.h < 420;
      if (!pg || c.force || (newSec && !small) || (!newSec && pg.h + c.h > target && pg.h > 380)) {
        pg = { sec: c.sec, h: 0, chunks: [], title: c.title, quiz: c.quiz };
        pages.push(pg);
      }
      if (newSec) pg.sec = c.sec;
      pg.chunks.push(c); pg.h += c.h;
    });
    if (pages.length < 2) return;
    pages.forEach((p, k) => p.chunks.forEach(c => c.els.forEach(e => { e.dataset.pg = k; })));
    const N = pages.length;
    const label = p => {
      const h = p.title;
      if (!h) return "Introduction";
      if (h.closest(".keys")) return "À retenir";
      return h.textContent.replace(/^\s*\d+(\.\d+)*\s*/, "").trim();
    };
    pages.forEach((p, k) => {
      const e0 = p.chunks[0].els[0];
      p.label = p.quiz ? "Quiz : testez-vous" : e0.matches(".keys") ? "À retenir" : (k === 0 && !e0.matches("h2,h3")) ? "Introduction" : label(p);
    });

    // 3. interface : bandeau de progression + boutons
    document.body.classList.add("paged");
    const top = el("div", { class: "pager-top" });
    top.innerHTML = `<div class="pg-info"><span class="pg-count"></span><span class="pg-title"></span></div>
      <div class="pg-dots">${pages.map((p, k) => `<button type="button" title="${(k + 1) + ". " + p.label.replace(/"/g, "&quot;")}" aria-label="Page ${k + 1}"></button>`).join("")}</div>`;
    art.prepend(top);
    const bottom = el("div", { class: "pager-bottom" });
    bottom.innerHTML = `<button type="button" class="pg-prev">← <span></span></button><span class="pg-mid"></span><button type="button" class="pg-next"><span></span> →</button>`;
    const chNav = $(".ch-nav", art);
    art.insertBefore(bottom, chNav || null);
    const dots = $$(".pg-dots button", top);
    let k = 0;
    function show(n, scrollTo) {
      k = Math.max(0, Math.min(N - 1, n));
      $$("[data-pg]", art).forEach(e => e.classList.toggle("pg-hide", +e.dataset.pg !== k));
      secs.forEach(sec => sec.classList.toggle("pg-hide", !$$(":scope > [data-pg]", sec).some(e => +e.dataset.pg === k)));
      dots.forEach((d, i) => { d.classList.toggle("on", i === k); d.classList.toggle("done", i < k); });
      $(".pg-count", top).textContent = `Page ${k + 1} / ${N}`;
      $(".pg-title", top).textContent = pages[k].label;
      const pv = $(".pg-prev", bottom), nx = $(".pg-next", bottom);
      pv.style.visibility = k ? "visible" : "hidden";
      nx.style.display = k < N - 1 ? "" : "none";
      if (k) $("span", pv).textContent = pages[k - 1].label;
      if (k < N - 1) $("span", nx).textContent = pages[k + 1].label;
      $(".pg-mid", bottom).textContent = `${k + 1} / ${N}`;
      if (chNav) chNav.classList.toggle("pg-hide", k < N - 1);
      const bar = $(".reading-bar");
      if (bar) bar.style.width = ((k + 1) / N * 100) + "%";
      // sommaire latéral
      $$(".side .toc a").forEach(a => {
        const t = document.getElementById(a.getAttribute("href").slice(1));
        a.classList.toggle("on", !!t && +((t.closest("[data-pg]") || {}).dataset || {}).pg === k);
      });
      try { history.replaceState(null, "", "#p" + (k + 1)); } catch (e) {}
      if (scrollTo) {
        const y = art.getBoundingClientRect().top + scrollY - 70;
        if (scrollY > y) window.scrollTo({ top: y, behavior: "auto" });
      }
      window.dispatchEvent(new Event("resize"));
      document.dispatchEvent(new CustomEvent("cours:page", { detail: k }));
    }
    const go = n => { show(n, true); };
    $(".pg-prev", bottom).addEventListener("click", () => go(k - 1));
    $(".pg-next", bottom).addEventListener("click", () => go(k + 1));
    dots.forEach((d, i) => d.addEventListener("click", () => go(i)));
    addEventListener("keydown", e => {
      if (e.target.closest && e.target.closest("input,select,textarea")) return;
      if (e.key === "ArrowRight") go(k + 1);
      if (e.key === "ArrowLeft") go(k - 1);
    });
    // liens internes (sommaire, renvois) : ouvrir la bonne page
    document.addEventListener("click", e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = decodeURIComponent(a.getAttribute("href").slice(1));
      const t = id && document.getElementById(id);
      const host = t && t.closest("[data-pg]");
      if (!host) return;
      e.preventDefault();
      show(+host.dataset.pg);
      requestAnimationFrame(() => window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 80, behavior: "smooth" }));
      document.body.classList.remove("side-open");
    });
    // page de départ
    let start = 0;
    const h = location.hash.slice(1);
    if (/^p\d+$/.test(h)) start = +h.slice(1) - 1;
    else if (h && document.getElementById(h)) { const host = document.getElementById(h).closest("[data-pg]"); if (host) start = +host.dataset.pg; }
    show(start);
    window.Cours.page = { show, count: N };
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
          });
        });
      });
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
