/* BridgeAI Studios — Bridge Composer : lecture d'un rapport géotechnique (fonction serveur Vercel)
 * POST /api/composer-geo  { nom, lot, lots, parts: [{ type: 'text', page, text } | { type: 'image', page, data (JPEG base64) }], connus }
 *   →  { sondages: [{ sondage, type, appui, pk, x, y, z, nappe, fin, lithologie: [{ z, desc, nature }], essais: [{ z, pl, pf, em }], plNet }], recommandations }
 * Le navigateur découpe le PDF en lots (texte des pages + images des pages scannées ou des tableaux) ; chaque lot est lu par le modèle
 * avec un outil imposé (sortie structurée). Clé ANTHROPIC_API_KEY côté serveur ; ANTHROPIC_MODEL facultatif. */
'use strict';

const MODEL = process.env.ANTHROPIC_GEO_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const RATE_HOUR = +process.env.AI_GEO_RATE_HOUR || 40;
const hits = new Map();
function limited(ip) {
  const now = Date.now(), a = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (a.length >= RATE_HOUR) return 'Trop de lectures en une heure. Patientez quelques minutes.';
  a.push(now); hits.set(ip, a);
  return null;
}

const n = (d) => ({ type: 'number', description: d });
const TOOL = {
  name: 'enregistrer_sondages',
  description: 'Enregistre les sondages et essais géotechniques lus dans les pages fournies. Ne renseigner que des valeurs réellement lues dans le document.',
  input_schema: {
    type: 'object',
    required: ['sondages'],
    properties: {
      sondages: {
        type: 'array',
        description: 'Un élément par sondage présent (même partiellement) dans ces pages.',
        items: {
          type: 'object',
          required: ['sondage'],
          properties: {
            sondage: { type: 'string', description: 'désignation exacte (ex. SP1, SC2, PR3)' },
            type: { type: 'string', description: 'pressiométrique, carotté, pénétromètre, puits…' },
            appui: { type: 'string', description: 'appui ou zone indiqué (C0, P1, culée rive gauche…) si mentionné' },
            pk: n('PK ou abscisse si indiqué, m'),
            x: n('coordonnée X si indiquée'), y: n('coordonnée Y si indiquée'),
            z: n('cote (altitude) de la tête du sondage, m'),
            nappe: n('profondeur de la nappe sous la tête, m (0 si non rencontrée ou non indiquée)'),
            fin: n('profondeur finale du sondage, m'),
            lithologie: {
              type: 'array', description: 'coupe : profondeur du TOIT de chaque formation sous la tête',
              items: { type: 'object', required: ['z', 'desc'], properties: {
                z: n('profondeur du toit de la formation, m'), desc: { type: 'string', description: 'description courte' },
                nature: { type: 'string', enum: ['A', 'L', 'S', 'G', 'C', 'M', 'R', 'T'], description: 'A argile, L limon, S sable, G grave, C craie, M marne/marno-calcaire, R roche (calcaire, schiste, grès…), T tourbe' },
              } },
            },
            essais: {
              type: 'array', description: 'essais pressiométriques Ménard',
              items: { type: 'object', required: ['z', 'pl', 'em'], properties: {
                z: n('profondeur de l’essai, m'), em: n('module pressiométrique EM, MPa'), pf: n('pression de fluage, MPa (0 si absente)'),
                pl: n('pression limite, MPa — nette pl* si le rapport la donne, sinon pl'),
              } },
            },
            plNet: { type: 'boolean', description: 'true si les pl fournies sont des pressions limites nettes pl*' },
          },
        },
      },
      recommandations: { type: 'string', description: 'synthèse courte des recommandations de fondation du rapport (type, niveau d’ancrage, contraintes, tassements, agressivité), si présentes dans ces pages' },
    },
  },
};

const SYSTEM = `Tu lis des rapports géotechniques (Maroc, France) pour un logiciel de conception de ponts.
Extrais fidèlement les sondages et les essais pressiométriques présents dans les pages fournies, via l’outil enregistrer_sondages.
Règles :
- Unités de sortie : m et MPa. Conversions : 1 bar = 0,1 MPa ; 1 kPa = 0,001 MPa ; 1 kg/cm² ≈ 0,098 MPa. Les modules EM sont souvent en MPa ou en bars : vérifie l’unité de l’en-tête.
- Les profondeurs sont comptées depuis la tête du sondage. Si le document donne des cotes, convertis en profondeurs (profondeur = cote de tête − cote).
- Lis les tableaux et les pressiogrammes (graphiques EM, pl en fonction de la profondeur) : relève chaque essai.
- N’invente aucune valeur : un champ inconnu est omis. Ne recopie pas deux fois le même essai.
- Un sondage peut s’étendre sur plusieurs lots de pages ; renvoie ce que contiennent ces pages, avec la même désignation.
- Si ces pages ne contiennent aucun sondage, renvoie une liste vide.`;

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

function content(b) {
  const parts = (Array.isArray(b.parts) ? b.parts : []).slice(0, 40);
  const out = [{ type: 'text', text: `Document : « ${String(b.nom || 'rapport').slice(0, 120)} » — lot ${+b.lot || 1} / ${+b.lots || 1}.`
    + (Array.isArray(b.connus) && b.connus.length ? ' Sondages déjà relevés dans les lots précédents : ' + b.connus.slice(0, 40).map(String).join(', ') + '.' : '') }];
  let img = 0;
  parts.forEach((p) => {
    if (!p || typeof p !== 'object') return;
    if (p.type === 'text' && typeof p.text === 'string') out.push({ type: 'text', text: `--- page ${+p.page || '?'} (texte) ---\n` + p.text.slice(0, 15000) });
    else if (p.type === 'image' && typeof p.data === 'string' && img < 10 && /^[A-Za-z0-9+/=]+$/.test(p.data.slice(0, 200))) {
      img++;
      out.push({ type: 'text', text: `--- page ${+p.page || '?'} (image) ---` });
      out.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.data } });
    }
  });
  return out;
}

const num = (v) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : null);
function clean(inp) {
  const S = (Array.isArray(inp && inp.sondages) ? inp.sondages : []).slice(0, 60).map((d) => ({
    sondage: String(d.sondage || '').slice(0, 30), type: String(d.type || '').slice(0, 40), appui: String(d.appui || '').slice(0, 30),
    pk: num(d.pk), x: num(d.x), y: num(d.y), z: num(d.z), nappe: num(d.nappe), fin: num(d.fin), plNet: !!d.plNet,
    lithologie: (Array.isArray(d.lithologie) ? d.lithologie : []).slice(0, 60).filter((c) => num(c.z) !== null).map((c) => ({ z: +c.z, desc: String(c.desc || '').slice(0, 80), nature: String(c.nature || '').slice(0, 1) })),
    essais: (Array.isArray(d.essais) ? d.essais : []).slice(0, 200).filter((e) => num(e.z) !== null && num(e.pl) > 0 && num(e.em) > 0)
      .map((e) => ({ z: +e.z, pl: +e.pl, pf: num(e.pf) || 0, em: +e.em })),
  })).filter((d) => d.sondage);
  return { sondages: S, recommandations: String(inp && inp.recommandations || '').slice(0, 2000) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ ok: true, ready: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Assistant IA non configuré (clé ANTHROPIC_API_KEY absente sur le serveur)', code: 'nokey' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || !Array.isArray(b.parts) || !b.parts.length) return res.status(400).json({ error: 'Requête invalide' });
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '?').split(',')[0].trim();
  const lim = limited(ip);
  if (lim) return res.status(429).json({ error: lim });
  try {
    const j = await callClaude({
      model: MODEL, max_tokens: 12000, system: SYSTEM,
      messages: [{ role: 'user', content: content(b) }],
      tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name },
    });
    const tu = (j.content || []).find((c) => c.type === 'tool_use');
    if (!tu) return res.status(502).json({ error: 'Réponse inattendue de l’assistant' });
    return res.status(200).json(Object.assign(clean(tu.input), { model: MODEL, usage: j.usage }));
  } catch (e) {
    console.error('composer-geo', e.status, e.message);
    return res.status(e.status === 429 ? 429 : 502).json({ error: e.status === 429 ? 'Assistant momentanément saturé, réessayez.' : 'Lecture indisponible : ' + String(e.message).slice(0, 160) });
  }
};
module.exports._test = { TOOL, SYSTEM, clean, content };
