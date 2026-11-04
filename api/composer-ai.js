/* BridgeAI Studios — Bridge Composer : assistant IA (fonction serveur Vercel)
 * POST /api/composer-ai  { text, state, ctx, history }  →  { message, changes, state }
 * La clé ANTHROPIC_API_KEY reste côté serveur (réglages Vercel → Environment Variables).
 * Variables facultatives : ANTHROPIC_MODEL (défaut claude-sonnet-5-5), AI_RATE_HOUR (défaut 30 requêtes/h/IP),
 * AI_DAILY_CAP (défaut 1500 requêtes/jour/instance). */
'use strict';
const C = require('../composer/calc.js');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const RATE_HOUR = +process.env.AI_RATE_HOUR || 30;
const DAILY_CAP = +process.env.AI_DAILY_CAP || 1500;
const hits = new Map();
let day = '', dayCount = 0;

function limited(ip) {
  const now = Date.now(), d = new Date().toISOString().slice(0, 10);
  if (d !== day) { day = d; dayCount = 0; hits.clear(); }
  if (++dayCount > DAILY_CAP) return 'Quota journalier de l’assistant atteint. Réessayez demain.';
  const a = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (a.length >= RATE_HOUR) return 'Trop de demandes en une heure. Patientez quelques minutes.';
  a.push(now); hits.set(ip, a);
  return null;
}

/* ── schéma des modifications autorisées (outil imposé au modèle) ── */
const num = (d) => ({ type: 'number', description: d });
const BETON = { type: 'string', enum: C.CLASSES_BETON };
const TOOL = {
  name: 'modifier_ouvrage',
  description: 'Répond à l’ingénieur et, si sa demande le justifie, modifie la composition du pont. Ne renseigner dans `changes` que les champs à changer.',
  input_schema: {
    type: 'object',
    required: ['message', 'changes'],
    properties: {
      message: { type: 'string', description: 'Réponse en français, concise (1 à 4 phrases) : ce qui a été fait, ou la réponse à la question, avec la justification technique utile.' },
      changes: {
        type: 'object',
        description: 'Modifications partielles de la composition. Objet vide si rien ne change.',
        properties: {
          projet: { type: 'object', properties: { nom: { type: 'string' }, ouvrage: { type: 'string' }, lieu: { type: 'string' }, moa: { type: 'string' }, ref: { type: 'string' } } },
          usage: { type: 'string', enum: ['route', 'rail'] },
          reglement: { type: 'string', enum: ['EC', 'F61'], description: 'EC = Eurocodes EN 1991-2 ; F61 = Fascicule 61 titre II (route) ou UIC 71 (rail)' },
          classe: { type: 'integer', enum: [1, 2, 3], description: 'classe du pont-route' },
          alpha: num('coefficient α du LM71 (0,75 à 1,46)'),
          profil: {
            type: 'object', properties: {
              roulable: num('largeur roulable, m (route)'), trottoirG: num('trottoir gauche, m'), trottoirD: num('trottoir droit, m'),
              nbVoiesFer: { type: 'integer', minimum: 1, maximum: 4 }, entraxe: num('entraxe des voies ferrées, m'), demiLarg: num('demi-largeur hors voie extrême, m'),
              largeurForcee: num('largeur totale imposée du tablier, m ; 0 = calculée'),
            },
          },
          tablier: {
            type: 'object', properties: {
              type: { type: 'string', enum: C.TYPE_KEYS },
              h: num('hauteur imposée du tablier, m ; 0 = prédimensionnement automatique'),
              continu: { type: 'boolean' }, dalleContinuite: { type: 'boolean', description: 'hourdis continu (poutres)' },
            },
          },
          travees: { type: 'array', items: { type: 'number' }, minItems: 1, maxItems: 12, description: 'portées en m, de C0 vers Cn' },
          biais: num('biais en grades (100 = droit)'),
          piles: { type: 'object', properties: { type: { type: 'string', enum: Object.keys(C.PILES) }, hauteurs: { type: 'array', items: { type: 'number' }, description: 'une hauteur par pile (nombre de travées − 1), m' } } },
          culees: { type: 'object', properties: { type: { type: 'string', enum: Object.keys(C.CULEES) }, hauteurs: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, dalleTransition: { type: 'boolean' } } },
          fond: {
            type: 'object', properties: {
              piles: { type: 'string', enum: ['superficielle', 'pieux'] }, culees: { type: 'string', enum: ['superficielle', 'pieux'] },
              sigma: num('contrainte admissible du sol ELS, MPa'), diam: { type: 'number', enum: [0.6, 0.8, 1.0, 1.2, 1.5] },
              long: num('longueur des pieux, m'), qadm: num('charge admissible par pieu, MN'),
            },
          },
          trace: {
            type: 'object', description: 'tracé simple ; actif = true pour caler les hauteurs d’appuis et le biais sur le tracé',
            properties: {
              actif: { type: 'boolean' }, pk0: num('PK de la culée C0, m'), R: num('rayon en plan, m (0 = alignement droit, + = virage à droite)'),
              G0: num('gisement de l’axe, grades'), X0: num('X au PK de C0'), Y0: num('Y au PK de C0'), versG: { type: 'string' }, versD: { type: 'string' },
              z0: num('ligne rouge (profil en long projet) au PK de C0, m'), p1: num('pente, % (− descendante)'), pkS: num('PK du sommet du raccordement'), p2: num('pente après le sommet, %'), Rv: num('rayon du raccordement parabolique, m (0 = aucun)'),
              typeDevers: { type: 'string', enum: ['toit', 'unique'] }, devers: num('%'),
              tnTxt: { type: 'string', description: 'points du terrain naturel « PK;Z PK;Z … »' }, couv: num('couverture de terre au-dessus des fondations, m'),
              obstacle: { type: 'object', properties: {
                type: { type: 'string', enum: ['aucun', 'oued', 'voie', 'route'] }, nom: { type: 'string' }, gis: num('gisement de l’obstacle, grades'),
                zFond: num('cote du fond du lit'), phe: num('cote des plus hautes eaux'), aff: num('profondeur d’affouillement, m'), revanche: num('revanche minimale sous intrados, m'),
                pk: num('PK de l’axe de la voie ou route franchie'), zVoie: num('cote du rail ou de la chaussée franchie'), gabarit: num('gabarit vertical à respecter, m'),
              } },
            },
          },
          equip: { type: 'object', properties: { retenue: { type: 'string', enum: ['BN4', 'GBA', 'GC'] }, corniches: { type: 'boolean' }, etancheite: { type: 'boolean' }, gargouilles: { type: 'boolean' }, revetement: num('épaisseur de revêtement, m') } },
          hyp: {
            type: 'object', properties: {
              betonTab: BETON, betonApp: BETON, betonFond: BETON, betonPieux: BETON,
              charpente: { type: 'string', enum: ['S235', 'S275', 'S355', 'S420', 'S460'] },
              enrobTab: num('cm'), enrobApp: num('cm'), enrobFond: num('cm'),
              gammaB: num('kN/m³'), gammaEnrobes: num('kN/m³'), gammaRemblai: num('kN/m³'),
              qTrottoir: num('kN/m², 0 = réglementaire'), dT: num('±°C'), retrait: num('‰ ×0,1'),
              majCulees: num('%'), seismeA: num('accélération de calcul, g'), seismeClasse: { type: 'string', enum: ['strategique', 'important', 'courant'] },
              dureeVie: num('ans'), exposition: { type: 'string' }, notes: { type: 'string', description: 'hypothèses particulières (texte libre)' },
            },
          },
        },
      },
    },
  },
};

function systemPrompt() {
  const dom = C.TYPE_KEYS.map((k) => { const T = C.TYPES[k]; return `- ${k} (${T.nom}, ${T.titre}) : domaine route ${T.dom.route.join('–')} m, rail ${T.dom.rail.join('–')} m ; ${T.iso ? 'isostatique possible' : ''}${T.cont ? (T.iso ? ', continu possible' : 'continu') : ''}${T.contDef ? ' (continu par défaut)' : ''}`; }).join('\n');
  return `Tu es l’assistant de Bridge Composer (BridgeAI Studios), un outil de conception préliminaire de ponts routiers et ferroviaires utilisé par des ingénieurs de bureau d’études (Maroc, France ; guides SETRA, Eurocodes, Fascicule 61).
L’ingénieur décrit un ouvrage ou demande une modification, ou pose une question. Tu réponds TOUJOURS par l’outil modifier_ouvrage.

Règles :
- Ne modifie que ce que la demande implique. Pour la description d’un nouvel ouvrage, renseigne tout ce qui est décrit et laisse le reste.
- Si les portées changent, fournis "travees" complet et "piles.hauteurs" avec exactement (nombre de travées − 1) valeurs (reprends les hauteurs existantes si rien n’est dit).
- Choisis le type de tablier dans son domaine d’emploi ; si l’ingénieur impose un type hors domaine, applique-le et signale-le dans le message.
- « dalle » sans précision : PSIDA jusqu’à 18 m de portée, PSIDP au-delà. « poutres » : PRAD sous 30 m, VIPP au-delà. Pont-rail à une travée courte : PRP courant.
- Pour une longueur totale sans portées, propose une répartition équilibrée (rives ≈ 0,8 × centrale en continu) et dis-le.
- Unités : m, MPa (1 bar = 0,1 MPa), MN par pieu, grades pour le biais.
- Tracé : si l’ingénieur donne un PK, une pente, une ligne rouge, des cotes de TN, une PHE, un gabarit ou l’obstacle franchi, renseigne "trace" avec actif = true ; les hauteurs d’appuis sont alors déduites du tracé (inutile de les fournir).
- Pour une question (« pourquoi… ? », « combien… ? »), réponds dans "message" à partir des résultats fournis, avec "changes" vide, sauf si elle demande explicitement un changement.
- Pour une demande d’optimisation (« réduis le coût »), propose une modification réaliste et explique le gain attendu sans inventer de chiffres absents des résultats.
- Message en français, précis, sans formule de politesse, 1 à 4 phrases. N’invente jamais de valeur de calcul.

Types de tablier :
${dom}
Piles : ${Object.entries(C.PILES).map(([k, v]) => k + ' (' + v.desc + ')').join(' ; ')}.
Culées : ${Object.entries(C.CULEES).map(([k, v]) => k + ' (' + v.desc + ')').join(' ; ')}.`;
}

/* état et résultats compacts pour le contexte */
function brief(S, ctx) {
  const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));
  const st = {
    projet: pick(S.projet, ['nom', 'ouvrage', 'lieu']), usage: S.usage, reglement: S.reglement, classe: S.classe,
    profil: S.profil, tablier: S.tablier, travees: S.travees, biais: S.biais, piles: S.piles, culees: S.culees, fond: S.fond, equip: S.equip,
    trace: S.trace && S.trace.actif ? Object.fromEntries(Object.entries(S.trace).filter(([k]) => k !== 'tn')) : { actif: false },
    hyp: pick(S.hyp, ['betonTab', 'betonApp', 'betonFond', 'betonPieux', 'charpente', 'gammaB', 'dT', 'seismeA', 'seismeClasse']),
  };
  return 'Composition actuelle (JSON) :\n' + JSON.stringify(st) + (ctx ? '\n\nRésultats actuels :\n' + JSON.stringify(ctx).slice(0, 6000) : '');
}

/* fusion profonde limitée au schéma, puis normalisation par le moteur */
function applyChanges(S, ch) {
  const out = JSON.parse(JSON.stringify(S));
  const allowed = TOOL.input_schema.properties.changes.properties;
  Object.keys(ch || {}).forEach((k) => {
    if (!allowed[k]) return;
    const v = ch[k];
    if (allowed[k].type === 'object' && v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = Object.assign({}, out[k] || {}, Object.fromEntries(Object.entries(v).filter(([kk]) => allowed[k].properties[kk])));
    } else out[k] = v;
  });
  if (ch && ch.tablier && ch.tablier.type && ch.tablier.type !== S.tablier.type) {
    if (ch.tablier.continu === undefined) out.tablier.continu = null;
    if (ch.tablier.h === undefined) out.tablier.h = 0;
    if (!(ch.hyp && ch.hyp.betonTab) && S.hyp && S.hyp.betonTab === C.hypDefaults(S.usage, S.tablier.type).betonTab) out.hyp.betonTab = C.hypDefaults(out.usage, ch.tablier.type).betonTab;
  }
  if (Array.isArray(out.travees)) {
    const np = out.travees.length - 1, hp = Array.isArray(out.piles.hauteurs) ? out.piles.hauteurs.slice() : [];
    while (hp.length < np) hp.push(hp.length ? hp[hp.length - 1] : 6);
    out.piles.hauteurs = hp.slice(0, Math.max(0, np));
  }
  return C.normalize(out);
}

async function callClaude(body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
  return j;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ ok: true, ready: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Assistant IA non configuré', code: 'nokey' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b.text !== 'string' || !b.state) return res.status(400).json({ error: 'Requête invalide' });
  const text = b.text.trim().slice(0, 1500);
  if (!text) return res.status(400).json({ error: 'Texte vide' });
  if (JSON.stringify(b).length > 60000) return res.status(413).json({ error: 'Requête trop volumineuse' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || '?').split(',')[0].trim();
  const lim = limited(ip);
  if (lim) return res.status(429).json({ error: lim });

  let S;
  try { S = C.normalize(b.state); } catch (e) { return res.status(400).json({ error: 'Composition invalide' }); }
  const hist = (Array.isArray(b.history) ? b.history : []).slice(-6)
    .filter((h) => h && typeof h.q === 'string' && typeof h.a === 'string')
    .flatMap((h) => [{ role: 'user', content: h.q.slice(0, 800) }, { role: 'assistant', content: h.a.slice(0, 800) }]);
  const messages = hist.concat([{ role: 'user', content: brief(S, b.ctx) + '\n\nDemande de l’ingénieur :\n' + text }]);

  try {
    const j = await callClaude({
      model: MODEL, max_tokens: 1500, system: systemPrompt(), messages,
      tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name },
    });
    const tu = (j.content || []).find((c) => c.type === 'tool_use');
    if (!tu) return res.status(502).json({ error: 'Réponse inattendue de l’assistant' });
    const { message = '', changes = {} } = tu.input || {};
    const S2 = applyChanges(S, changes);
    return res.status(200).json({ message: String(message).slice(0, 2000), changes, state: S2, model: MODEL, usage: j.usage });
  } catch (e) {
    console.error('composer-ai', e.status, e.message);
    return res.status(e.status === 429 ? 429 : 502).json({ error: e.status === 429 ? 'Assistant momentanément saturé, réessayez.' : 'Assistant IA indisponible' });
  }
};
module.exports._test = { applyChanges, systemPrompt, TOOL, brief };
