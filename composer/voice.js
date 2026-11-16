/* BridgeAI Studios — Bridge Composer : commande vocale de l'assistant IA
 * Dictée (Web Speech API : Chrome, Edge, Safari, Android) et lecture à voix haute des réponses (speechSynthesis).
 *   COMP.voice.supported            → la dictée est disponible dans ce navigateur
 *   COMP.voice.start(textarea, opt)  → écoute ; le texte reconnu s'affiche en direct dans la zone de saisie
 *        opt : { lang, onEnd(texte), onError(message), onState(écoute) }  — arrêt automatique après un silence
 *   COMP.voice.stop() / active()
 *   COMP.voice.speak(texte) / hush() / pref(on?)  → réponses lues à voix haute (préférence mémorisée) */
(function (root) {
  'use strict';
  const SR = root.SpeechRecognition || root.webkitSpeechRecognition;
  const TTS = root.speechSynthesis;
  const KEY = 'bas-composer-voix';
  let rec = null, cur = null;

  const MSG = {
    'not-allowed': 'Accès au micro refusé. Autorisez le micro pour ce site (icône à gauche de l’adresse), puis réessayez.',
    'service-not-allowed': 'La dictée n’est pas autorisée dans ce navigateur.',
    'audio-capture': 'Aucun micro détecté.',
    network: 'La dictée nécessite une connexion internet (reconnaissance vocale du navigateur).',
    'language-not-supported': 'Le français n’est pas disponible pour la dictée dans ce navigateur.',
  };

  function stop() { if (rec) { try { rec.stop(); } catch (e) { /* déjà arrêtée */ } } }
  function active() { return !!rec; }

  function start(ta, opt) {
    opt = opt || {};
    if (!SR) { if (opt.onError) opt.onError('La dictée vocale n’est pas disponible dans ce navigateur (essayez Chrome, Edge ou Safari).'); return false; }
    if (rec) { stop(); return false; }
    hush();
    const r = new SR();
    r.lang = opt.lang || 'fr-FR';
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    const base = ta.value.trim() ? ta.value.trim() + ' ' : '';
    let fin = '', timer = null, err = null;
    const silence = () => { clearTimeout(timer); timer = setTimeout(stop, opt.silence || 2200); };
    r.onresult = (ev) => {
      let inter = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) fin += t; else inter += t;
      }
      ta.value = base + (fin + inter).replace(/\s+/g, ' ').trimStart();
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      silence();
    };
    r.onerror = (ev) => { if (ev.error !== 'no-speech' && ev.error !== 'aborted') err = MSG[ev.error] || 'Dictée interrompue (' + ev.error + ').'; };
    r.onend = () => {
      clearTimeout(timer);
      rec = null; cur = null;
      if (opt.onState) opt.onState(false);
      if (err) { if (opt.onError) opt.onError(err); return; }
      const txt = ta.value.trim();
      if (fin.trim() && opt.onEnd) opt.onEnd(txt);
    };
    try { r.start(); } catch (e) { if (opt.onError) opt.onError('Impossible de démarrer la dictée.'); return false; }
    rec = r; cur = ta;
    if (opt.onState) opt.onState(true);
    silence();
    setTimeout(() => { if (rec === r && !fin) silence(); }, 6000);   // laisse le temps de commencer à parler
    return true;
  }

  /* ───── lecture des réponses ───── */
  function pref(v) {
    try {
      if (v === undefined) return localStorage.getItem(KEY) !== '0';
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch (e) { /* stockage indisponible */ }
    return v;
  }
  let voix = null;
  function frVoice() {
    if (voix || !TTS) return voix;
    const V = TTS.getVoices().filter((v) => /^fr/i.test(v.lang));
    voix = V.find((v) => /fr-FR/i.test(v.lang) && /Google|Amélie|Audrey|Thomas|Denise|Henri|Natural/i.test(v.name)) || V.find((v) => /fr-FR/i.test(v.lang)) || V[0] || null;
    return voix;
  }
  if (TTS && TTS.addEventListener) TTS.addEventListener('voiceschanged', () => { voix = null; frVoice(); });
  function speak(txt) {
    if (!TTS || !txt) return;
    hush();
    const t = String(txt).replace(/\s+/g, ' ').replace(/×/g, ' fois ').replace(/Ø\s*/g, 'diamètre ').replace(/\bm²/g, ' mètres carrés').replace(/\bm³/g, ' mètres cubes').trim().slice(0, 700);
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'fr-FR'; u.rate = 1.05;
    const v = frVoice(); if (v) u.voice = v;
    TTS.speak(u);
  }
  function hush() { if (TTS && (TTS.speaking || TTS.pending)) TTS.cancel(); }

  root.COMP = root.COMP || {};
  root.COMP.voice = { supported: !!SR, tts: !!TTS, start, stop, active, speak, hush, pref, target: () => cur };
})(typeof self !== 'undefined' ? self : this);
