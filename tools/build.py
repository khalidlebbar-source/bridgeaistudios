#!/usr/bin/env python3
"""
Étape 2 de l'indexation : meta.jsonl + vignettes  ->  catalogue de la Bibliothèque.

Usage : python3 build.py <dossier_extraction> <dossier_site/library> [--password MOTDEPASSE]

- nettoie les titres (métadonnées PDF souvent fausses → nom de fichier),
- classe chaque document (thème, type d'ouvrage, normes, éditeur, année, langue),
- distingue « Bibliothèque » et « Archives projets »,
- regroupe les dossiers de fragments (chapitres numérotés, fiches) en collections,
- chiffre le catalogue et les vignettes (AES-256-GCM, clé PBKDF2) pour que
  rien ne soit lisible sans le mot de passe de l'équipe, même si le dépôt est public.
"""
import argparse, base64, collections, hashlib, io, json, os, re, secrets, sys, unicodedata
from datetime import datetime, timezone

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--password", required=True)
ap.add_argument("--dropbox-root", default="04-LOGICIELS ET DOCS")
ap.add_argument("--plain", action="store_true", help="écrire aussi catalog.json en clair (tests locaux)")
a = ap.parse_args()

def norm(s): return unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()

# ─── 1. Lecture ─────────────────────────────────────────────
recs = [json.loads(l) for l in open(os.path.join(a.src, "meta.jsonl"), encoding="utf-8")]
seen, R = set(), []
for r in recs:
    if r["path"] in seen: continue
    seen.add(r["path"]); R.append(r)

# ─── 2. Titres ──────────────────────────────────────────────
BAD_TITLE = re.compile(r"(^untitled|^microsoft (word|powerpoint|excel)|\.(doc|docx|indd|dwg|xls|pdf|ps|qxd|tif|jpg)\b|^document\d*$|cpy document|^titre|^title|^sans titre|^diapositive|^pr[ée]sentation powerpoint|^\W*$|^[a-z]:\\|^\d+$|^untitled|^layout|^print|^page \d|^untitled-\d|^\(?anonymous\)?|^untitled document|^new document|^adobe|^acrobat|^untitled\s*\d|^p\d{2}-\d{3})", re.I)

def clean_filename(fn):
    t = os.path.splitext(fn)[0]
    if re.search(r"_C3_[89AB][0-9A-F]|_20[A-Za-z]", t):          # nom de fichier « URL-encodé » (%20 → _20)
        from urllib.parse import unquote
        t = unquote(re.sub(r"_([0-9A-F]{2})", r"%\1", t))
        t = re.sub(r"[\x00-\x1f]", "", t)
    t = re.sub(r"_cle[0-9a-f]{5,}$", "", t, flags=re.I)              # suffixes SETRA/Cerema
    t = re.sub(r"\s*\(\d+\)$|\[\d+\]$", "", t)
    t = re.sub(r"_\d{6}_\d{6}$", "", t)
    t = t.replace("_", " ").replace("  ", " ")
    t = re.sub(r"\s+", " ", t).strip(" -.")
    if t.isupper() and len(t) > 6:
        t = t.capitalize() if len(t.split()) > 2 else t
    return t

def good_meta_title(t, fn):
    if not t: return False
    t = t.strip()
    if len(t) < 6 or len(t) > 180: return False
    if BAD_TITLE.search(t): return False
    if sum(c.isalpha() for c in t) < len(t) * .5: return False
    if re.fullmatch(r"[\w\-]{1,12}", t): return False                # codes internes
    return True

def title_of(r):
    fn = os.path.basename(r["path"])
    fname = clean_filename(fn)
    mt = (r.get("title") or "").strip()
    # le nom de fichier est explicite (≥ 3 mots) → on le garde, sauf si la méta est plus riche
    if good_meta_title(mt, fn):
        if len(fname.split()) >= 4 and norm(mt) in norm(fname): return fname
        if re.fullmatch(r"[A-Za-z]{0,4}[\d\-\. ]+[A-Za-z]?", fname) or len(fname.split()) <= 2:
            return mt
        return fname if len(fname) >= len(mt) * .8 else mt
    if is_code(fname):                       # « ARRTDU~1 », « GRS », « 8 » → 1re ligne lisible du texte
        t = readable(r.get("text", ""))
        if t:
            head = re.split(r"(?<=[a-zà-ÿ])\.\s|\s{2,}", t[:200])[0]
            words = head.split()[:12]
            cand = " ".join(words).strip(" -.,:;")
            if len(cand) >= 12: return (fname + " — " if not re.fullmatch(r"\d+", fname) else "") + cand[:90]
    return fname

def is_code(t):
    return bool(re.fullmatch(r"[\d _.\-]+", t) or re.fullmatch(r"[\w~\-. ]{0,9}", t) or "~" in t or re.fullmatch(r"[A-Z0-9 \-_.]{1,14}", t))

# ─── 3. Classification ─────────────────────────────────────
STRUCT = [
    ("VIPP", r"\bvipp"), ("PRAD", r"\bprad\b"), ("PSIDA", r"\bpsi[- ]?da\b|psida"), ("PSIDN", r"\bpsi[- ]?dn\b|psidn"),
    ("PSIDP", r"\bpsi[- ]?dp\b|psidp"), ("PSIBA", r"\bpsi[- ]?ba\b|psiba"), ("PICF", r"\bpicf"), ("PIPO", r"\bpipo"),
    ("POD", r"\bpod\b"), ("PSBQ", r"\bpsbq"), ("MCP", r"\bmcp\b|mcp ?70|mcp_70"), ("PPBA", r"\bppba\b"),
    ("Pont-dalle", r"pont[s]?[- ]dalle|ponts dalles|\bpdba\b"), ("Pont-cadre", r"\bcadre"),
    ("Passerelle", r"passerelle"), ("Pont mixte", r"\bmixte|bipoutre|bi-poutre|combri"),
    ("Pont métallique", r"pont[s]? m[ée]tallique|charpente m[ée]tallique|caisson m[ée]tallique|orthotrope"),
    ("Pont à haubans", r"hauban"), ("Pont suspendu", r"suspendu"), ("Arc", r"\barcs?\b|pont en arc"),
    ("Encorbellement", r"encorbellement|voussoir|caisson|box girder"), ("Pont poussé", r"pouss[ée]|lancement|incremental"),
    ("Viaduc", r"viaduc"), ("Dalot / buse", r"\bdalots?\b|\bbuses?\b|ouvrages? hydraulique"),
    ("Mur de soutènement", r"soutenement|soutènement|\bmurs?\b|terre arm"), ("Culée", r"cul[ée]e"), ("Pile", r"\bpiles?\b"),
    ("Pieux", r"\bpieux|\bpieu\b|fondations? profonde"), ("Tunnel", r"tunnel|aftes|cetu|souterrain"),
    ("Tablier", r"tablier"), ("Hourdis", r"hourdis"), ("Appareils d'appui", r"appareils? d.appui|elastom"),
    ("Joints de chaussée", r"joints? de chauss"), ("Garde-corps / retenue", r"garde[- ]corps|barri[eè]re|dispositifs? de retenue|glissi[eè]re"),
    ("Ouvrage maritime", r"maritime|portuaire|\bquai|digue|jet[ée]e"), ("Réservoir", r"r[ée]servoir|ch[aâ]teau d.eau"),
]
STRUCT = [(n, re.compile(p, re.I)) for n, p in STRUCT]

STD = [
    ("EN 1990", r"en[ _.-]?1990\b|eurocode ?0\b"), ("EN 1991", r"en[ _.-]?1991|eurocode ?1\b|\bec ?1\b"), ("EN 1991-2", r"en[ _.-]?1991[ _.-]2\b"),
    ("EN 1992", r"en[ _.-]?1992|eurocode ?2\b|\bec ?2\b"), ("EN 1992-2", r"en[ _.-]?1992[ _.-]2\b"),
    ("EN 1993", r"en[ _.-]?1993|eurocode ?3\b|\bec ?3\b"), ("EN 1994", r"en[ _.-]?1994|eurocode ?4\b|\bec ?4\b"),
    ("EN 1997", r"en[ _.-]?1997|eurocode ?7\b|\bec ?7\b"), ("EN 1998", r"en[ _.-]?1998|eurocode ?8\b|\bec ?8\b"),
    ("EN 1337", r"1337"), ("EN 206", r"en[ _.-]?206\b"), ("EN 1090", r"en[ _.-]?1090"),
    ("BAEL", r"\bbael"), ("BPEL", r"\bbpel"), ("Fascicule 61", r"fascicule[ _]?61|fasc[ ._]?61|\bf61\b"),
    ("Fascicule 62", r"fascicule[ _]?62|fasc[ ._]?62|\bf62\b"), ("Fascicule 65", r"fascicule[ _]?65|fasc[ ._]?65"),
    ("CCTG", r"\bcctg"), ("RPS 2000", r"\brps ?2000|\brpoa"), ("UIC", r"\buic\b|fiche uic"), ("PS 92", r"\bps ?92\b"),
    ("AASHTO", r"aashto"), ("CM 66", r"\bcm ?66\b"), ("DTU", r"\bdtu\b"), ("NF P", r"\bnf ?p ?\d{2}"),
]
STD = [(n, re.compile(p, re.I)) for n, p in STD]

PUBL = [
    ("SETRA", r"setra|s[ée]tra\b|_cle[0-9a-f]{5}|\bdtrf\b|bulletin ouvrages d.art|\bboa\b"), ("Cerema", r"cerema|cete\b"),
    ("SNCF", r"\bsncf|r[ée]seau ferr[ée]|\brff\b|\bin ?\d{4}\b"), ("ONCF", r"\boncf"), ("ADM", r"\badm\b|autoroutes du maroc"),
    ("LCPC / IFSTTAR", r"lcpc|ifsttar|\blcpc"), ("AFNOR", r"afnor|\bnf ?en\b|\bnf ?p\b"), ("CEN", r"\ben ?19\d\d"),
    ("CETU", r"\bcetu"), ("AFTES", r"aftes"), ("OPPBTP", r"oppbtp"), ("Techniques de l'Ingénieur", r"techniques de l.ing|tech d.ing"),
    ("ENPC", r"\benpc|ponts et chauss[ée]es"), ("EHTP", r"\behtp"), ("SCI", r"\bsci[ _]p\d"), ("CTICM", r"cticm"),
    ("Freyssinet", r"freyssinet"), ("VSL", r"\bvsl\b"), ("Soletanche", r"soletanche"), ("Hilti", r"hilti"),
    ("MTMO Maroc", r"minist[eè]re de l.[ée]quipement|\bmet\b maroc|\bdrcr\b|\bdrcr|\blpee\b"),
    ("Ontario MTO", r"ontario"), ("FHWA", r"fhwa"), ("Eurocodes (JRC)", r"\bjrc\b"),
]
PUBL = [(n, re.compile(p, re.I)) for n, p in PUBL]

THEME_RULES = [  # (thème, regex sur chemin+titre) – premier qui gagne
    ("archives", r"^13-plans confreres|^18-verbatim/01-non encore pris/lgv|/ao adm|^30-dce|livrable|\bdce\b|\bexe\b|wetransfer|consultation|appel d.offres|^ao |\bplans?\b.*\bao\b"),
    ("ferroviaire", r"ferroviaire|ferr[ée]|\bsncf|\boncf|\buic\b|\blgv\b|\bvoie ferr|\brail|tram|\bin ?\d{4}\b|caténaire|catenaire"),
    ("dynamique", r"seisme|s[ée]isme|sismique|parasismique|\bps ?92|\brps|en[ _.-]?1998|dynamique|vibration|eurocode ?8"),
    ("geotech", r"fondation|g[ée]otech|pieu|\bsols?\b|m[ée]canique des sols|sanglerat|soutenement|soutènement|terre arm|culee|cul[ée]e|tirant|paroi|fond ?72|en[ _.-]?1997|eurocode ?7|soletanche|massif"),
    ("precontrainte", r"pr[ée]contrain|\bbpel|cable|câble|encorbellement|voussoir|freyssinet|\bvsl\b|post-tension"),
    ("metal", r"m[ée]tal|acier|mixte|charpente|bipoutre|soudure|boulon|connecteur|goujon|en[ _.-]?199[34]|eurocode ?[34]|\bcm ?66|combri|orthotrope|corrosion|sci[ _]p|cticm"),
    ("eurocodes", r"eurocode|\bnf ?en\b|\ben ?19\d\d|\ben ?\d{3,5}\b|b_eurocodes|\bnormes?\b|afnor|\bnf ?p ?\d"),
    ("reglements", r"\bbael|fascicule|\bcctg|\bccag|\bcctp|\bcps\b|r[ée]glement|r[eè]gles? |\bdtu\b|circulaire|instruction|cahier des (clauses|charges)|march[ée]s publics|15-reglementation"),
    ("ouvrages", r"vipp|prad|psi[- ]?d|psi[- ]?ba|picf|pipo|psbq|\bmcp\b|\bpod\b|ppba|pont[s]?[- ]dalle|pont[s]?[- ]cadre|passerelle|dossiers? pilote|ponts courants|pouss[ée]|autoripage|v[ée]rinage|hauban|suspendu|\barc\b"),
    ("setra", r"setra|cerema|\bcete\b|dtrf|bulletin|\bboa\b|12-documentation setra|13-bulletins|_cle[0-9a-f]{5}"),
    ("hydro", r"hydro|hydraul|assainissement|crue|\boued|dalot|buse|affouillement|drainage|bag hydro|maritime|portuaire|houle|\bquai"),
    ("routes", r"chauss[ée]e|trac[ée]|\broute|routier|giratoire|carrefour|signalisation|[ée]quipements de la route|dispositifs de retenue|glissi[eè]re|terrassement|g[ée]om[ée]trie"),
    ("tunnels", r"tunnel|aftes|cetu|souterrain"),
    ("chantier", r"chantier|ex[ée]cution|inspection|auscultation|instrument|pathologie|r[ée]paration|renforcement|d[ée]molition|entretien|s[ée]curit[ée]|oppbtp|qualit[ée]|contr[ôo]le|iqoa|maintenance|rex\b"),
    ("calcul", r"note[s]? de calcul|exemple|tutorial|tutoriel|programme de calcul|logiciel|\bmidas|robot|effel|sap ?2000|\bst1\b|pcp|calcul automatique|feuille|m[ée]thodolog"),
    ("beton", r"b[ée]ton|ferraillage|armature|\bba\b|ciment|granulat|enrobage|fissur"),
    ("cours", r"cours|chapitre|chap\d|master|enpc|ehtp|\bth[eè]se|polycop|tome|le[cç]on|formation|module|techniques de l.ing|tech d.ing|livre|manuel|guide|trait[ée]"),
]
THEME_RULES = [(t, re.compile(p, re.I)) for t, p in THEME_RULES]

DIR_THEME = {  # dossiers racines dont le thème est évident
    "14-seisme": "dynamique", "11-tunnels-naim-charbel": "tunnels", "24-construction metallique": "metal",
    "05-construction mixte": "metal", "17-beton precontraint": "precontrainte", "23-bag hydrologie & hydraulique": "hydro",
    "31-maritime": "hydro", "32-ponts pousses": "ouvrages", "29-autoripage": "ouvrages", "16-verinage": "chantier",
    "12-documentation setra": "setra", "13-bulletins oa setra": "setra", "25-dossiers pilote drcr": "ouvrages",
    "22-cours enpc ismail": "cours", "27-tech d'ing geniecivil": "cours", "tutorials_civil": "calcul",
    "13-plans confreres": "archives", "rex demolition": "chantier", "26-equipements": "routes", "01-trace et hydro": "routes",
    "barres verre": "beton", "20-notes methodologiques": "calcul",
}

def year_of(r, title):
    for src in (title, os.path.basename(r["path"])):
        m = re.findall(r"(?<!\d)(19[5-9]\d|20[0-3]\d)(?!\d)", src)
        if m: return int(m[-1])
    m = re.findall(r"(?:edition|[ée]dition|version|mise à jour|copyright|©|\bjuin|\bjuillet|\bjanvier|\bf[ée]vrier|\bmars|\bavril|\bmai|\bao[uû]t|\bseptembre|\boctobre|\bnovembre|\bd[ée]cembre)\D{0,12}(19[5-9]\d|20[0-3]\d)", r.get("text", "")[:2500], re.I)
    if m: return int(m[0])
    cd = r.get("creationdate") or ""
    m = re.search(r"(19[89]\d|20[0-3]\d)", cd)
    if m and int(m.group(1)) <= datetime.now().year - 2: return int(m.group(1))   # plus récent = date de scan
    return None

FR = set("le la les des du de et en un une pour par sur dans est sont avec aux ces cette ouvrage pont ponts calcul".split())
EN = set("the and of for with to is are on by this bridge bridges design steel concrete".split())
def lang_of(text, title):
    w = re.findall(r"[a-zà-ÿ]+", (title + " " + text[:1500]).lower())
    if re.search(r"[؀-ۿ]{4}", text[:1500]): return "ar"
    fr = sum(x in FR for x in w); en = sum(x in EN for x in w)
    if fr == en == 0: return None
    return "fr" if fr >= en else "en"

def readable(text):
    if not text: return ""
    letters = sum(c.isalpha() for c in text)
    if letters < len(text) * .55: return ""
    words = re.findall(r"[A-Za-zÀ-ÿ]{3,}", text)
    vowel = sum(1 for w in words if re.search(r"[aeiouyàâéèêëîïôûù]", w, re.I))
    if not words or vowel < len(words) * .8: return ""
    return text

def summary_of(text, title):
    t = readable(text)
    if not t: return ""
    t = re.sub(r"(?i)\b(sommaire|table des mati[eè]res|contents)\b.*", "", t)  # coupe avant la TOC
    sents = re.split(r"(?<=[.!?])\s+", t)
    out = ""
    for s in sents:
        if len(s) < 40 or len(re.findall(r"\d", s)) > len(s) * .2: continue
        if norm(title)[:30] and norm(title)[:30] in norm(s) and len(out) == 0 and len(s) < 90: continue
        out += s + " "
        if len(out) > 260: break
    return out.strip()[:420]

def clean_toc(toc):
    junk = re.compile(r"^(accueil|aide|retour|imprimer|sommaire|suite|pr[ée]c[ée]dent|page suivante|bookmark|untitled)\b", re.I)
    res = [t for t in toc if not junk.match(t["title"]) and len(t["title"]) > 2]
    return res if len(res) >= 3 else []

STOP = set(norm(w) for w in """le la les des du de et en un une pour par sur dans au aux avec sans ou d l a à est sont ce ces cette
the and of for to in on with by an at from pdf version ver rev v00 v01 v02 v1 v2 doc documentation documents document fr en
partie part chapitre chap tome annexe annexes guide note notes final def""".split())

def keywords_of(title, path, toc):
    words = re.findall(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\-]{3,}", title)
    folder = path.split("/")[-2] if "/" in path else ""
    kws = []
    for w in words:
        n = norm(w)
        if n in STOP or len(n) < 4: continue
        if w.lower() not in [k.lower() for k in kws]: kws.append(w.lower())
    if folder and not re.match(r"^(\d+|a organiser|documentations?|divers|pdf|docs?)$", norm(folder)):
        f = re.sub(r"^\d+[-_. ]*", "", folder).strip()
        if 3 < len(f) < 40: kws.append(f.lower())
    return kws[:8]

def hits(rules, s):
    return [n for n, rx in rules if rx.search(s)]

PATH_FIRST = [(t, re.compile(p, re.I)) for t, p in [
    ("archives", r"^13-plans confreres|/lgv/01-lgv-sinohydro|/ao adm/|^30-dce|archivage kle|wetransfer|/dce |/livrable"),
    ("routes", r"equipements de la route|dispositifs de retenue|valise documentaire routes"),
    ("tunnels", r"^11-tunnels|/tunnel"),
    ("dynamique", r"^14-seisme|/seisme/"),
    ("ferroviaire", r"regles_sncf|livrets sncf|/sncf/"),
    ("setra", r"/dtrf/|documents techniques setra|^12-documentation setra|^13-bulletins"),
    ("eurocodes", r"b_eurocodes|/eurocodes?/|normes marocaines|normes fr cd|c_normes"),
    ("reglements", r"f_fascicules|/fascicules?/|d_reglements|/marches?/|module13_march"),
    ("geotech", r"/fondation|sanglerat"),
    ("hydro", r"^31-maritime|^23-bag|hydrolog|intrants abhs"),
    ("calcul", r"^tutorials_civil"),
    ("cours", r"^22-cours enpc|^27-tech d'ing|master  ?ehtp"),
]]

def classify(r):
    path = r["path"]; title = r["title_clean"]; text = readable(r.get("text", ""))[:1500]
    top = norm(path.split("/")[0])
    hay = norm(path) + " " + norm(title)
    theme = None
    for t, rx in PATH_FIRST:
        if rx.search(norm(path)): theme = t; break
    if theme == "cours":   # dans les cours, le sujet prime s'il est clair
        for t, rx in THEME_RULES[1:9]:
            if rx.search(norm(title)): theme = t; break
    if not theme:
        for t, rx in THEME_RULES:
            if rx.search(hay): theme = t; break
    if not theme and top in DIR_THEME: theme = DIR_THEME[top]
    if not theme:
        for t, rx in THEME_RULES[1:]:
            if rx.search(norm(text)): theme = t; break
    theme = theme or "autres"
    big = hay + " " + norm(text[:800])
    structs = hits(STRUCT, hay)[:4]
    stds = sorted(set(hits(STD, big)))[:5]
    if "EN 1991-2" in stds and "EN 1991" in stds: stds.remove("EN 1991")
    if "EN 1992-2" in stds and "EN 1992" in stds: stds.remove("EN 1992")
    pubs = hits(PUBL, big)
    a = (r.get("author") or "").strip()
    publisher = pubs[0] if pubs else None
    if not publisher and re.search(r"setra|cerema|sncf|oncf|lcpc", norm(a)): publisher = a.upper()
    authors = []
    if a and not re.search(r"@|\\|^\w{1,3}\d|user|admin|utilisateur|^pc|^dell|^hp|cpy|document author|^[a-z]{1,10}\d{2,}|^owner|^auteur|^author|^unknown|^ibm|microsoft|^nom", a, re.I) and len(a) < 60 and not re.fullmatch(r"[A-Z]{2,12}", a):
        authors = [x.strip() for x in re.split(r";|,| et | and ", a) if x.strip()][:4]
    return theme, structs, stds, publisher, authors

# ─── 4. Enrichissement ─────────────────────────────────────
for r in R:
    r["title_clean"] = title_of(r)
    r["theme"], r["structures"], r["standards"], r["publisher"], r["authors"] = classify(r)
    r["year"] = year_of(r, r["title_clean"])
    r["language"] = lang_of(readable(r.get("text", "")), r["title_clean"])

# ─── 4b. Doublons (même taille + même nb de pages) ─────────
dup = collections.defaultdict(list)
for r in R: dup[(r["size"], r.get("pages"))].append(r)
drop = set()
for k, L in dup.items():
    if len(L) < 2 or k[0] < 20000: continue
    L.sort(key=lambda x: (x["theme"] == "archives", "a organiser" in norm(x["path"]), "verbatim" in norm(x["path"]), len(x["path"])))
    keep = L[0]; keep["copies"] = [x["path"] for x in L[1:]]
    drop.update(x["path"] for x in L[1:])
R = [r for r in R if r["path"] not in drop]
print(f"{len(drop)} doublons fusionnés")

# ─── 4c. DTRF : une collection par série (DT, TO) ───────────
DTRF = re.compile(r"^(.*?/DTRF)/Data/(DT|TO)/", re.I)
dtrf = collections.defaultdict(list)
for r in R:
    m = DTRF.match(r["path"])
    if m: dtrf[(m.group(1), m.group(2).upper())].append(r)
DTRF_NAMES = {"DT": "DTRF — Documents techniques SETRA (série DT)", "TO": "DTRF — Textes officiels (série TO)"}

# ─── 5. Collections (dossiers de fragments) ─────────────────
FRAG = re.compile(r"^(\d{1,3}([._-]\d{1,3})*|[A-Za-z]{1,3}[ _-]?\d{1,5}[A-Za-z]?|chap\w{0,5}[ _-]?\d+|partie[ _-]?\d+|p\d+|page[ _-]?\d+|[A-Z]\d[A-Z]\d{4})$", re.I)
by_dir = collections.defaultdict(list)
for r in R:
    m = DTRF.match(r["path"])
    by_dir[(m.group(1) + "/Data/" + m.group(2)) if m else os.path.dirname(r["path"])].append(r)
collections_out, grouped = [], set()
for d, items in by_dir.items():
    if len(items) < 6 or not d: continue
    frag = [x for x in items if FRAG.match(os.path.splitext(os.path.basename(x["path"]))[0].strip())]
    if len(frag) < max(6, len(items) * .6): continue
    frag.sort(key=lambda x: [int(n) if n.isdigit() else n for n in re.split(r"(\d+)", os.path.basename(x["path"]).lower())])
    first = frag[0]
    name = os.path.basename(d)
    parent = os.path.basename(os.path.dirname(d))
    if (re.fullmatch(r"(\d+|data|pdf|pdfs?|secupdf|memopdf|[a-z]{1,3}|\d+00|chap\w*\d+|dossier|divers|partie ?\d+)", norm(name)) or len(name) < 4) and parent:
        name = f"{parent} — {name}"
    title = clean_filename(name)
    mm = re.search(r"/Data/(DT|TO)$", d)
    if mm: title = DTRF_NAMES[mm.group(1).upper()]
    # meilleur titre : méta d'un fragment explicite
    for x in frag:
        mt = x.get("title") or ""
        if good_meta_title(mt, "") and len(mt) > 12: break
    pages = sum(int(x.get("pages") or 0) for x in frag)
    col = dict(first)
    col.update({
        "id": hashlib.sha1(("col:" + d).encode()).hexdigest()[:16],
        "path": first["path"], "folder_only": d, "collection": True,
        "title_clean": title, "pages": str(pages), "size": sum(x["size"] for x in frag),
        "parts": [{"n": os.path.splitext(os.path.basename(x["path"]))[0], "t": (x.get("title") or "").strip()[:90] if good_meta_title(x.get("title"), "") else "", "p": x.get("pages"), "path": x["path"]} for x in frag][:1200],
        "nparts": len(frag), "toc": [],
    })
    col["theme"], col["structures"], col["standards"], col["publisher"], col["authors"] = classify(col)
    col["year"] = year_of(col, title)
    collections_out.append(col)
    grouped.update(x["path"] for x in frag)

docs = [r for r in R if r["path"] not in grouped] + collections_out

# ─── 6. Sortie ──────────────────────────────────────────────
def dbx(path, folder=False):
    full = a.dropbox_root + "/" + path
    from urllib.parse import quote
    if folder: return "https://www.dropbox.com/home/" + quote(full)
    d, f = os.path.split(full)
    return "https://www.dropbox.com/home/" + quote(d) + "?preview=" + quote(f)

out_docs = []
for r in docs:
    title = r["title_clean"]
    text = readable(r.get("text", ""))
    folder = os.path.dirname(r.get("folder_only") or r["path"])
    if r.get("collection"): folder = r["folder_only"]
    d = {
        "id": r["id"], "title": title, "theme": r["theme"],
        "kind": "archive" if r["theme"] == "archives" else "doc",
        "structures": r["structures"], "standards": r["standards"],
        "publisher": r["publisher"], "authors": r["authors"], "year": r["year"],
        "language": r["language"], "pages": int(r.get("pages") or 0) or None, "size": r["size"],
        "added": datetime.fromtimestamp(r["mtime"], timezone.utc).strftime("%Y-%m-%d"),
        "folder": folder, "file": None if r.get("collection") else os.path.basename(r["path"]),
        "url": dbx(r["folder_only"], True) if r.get("collection") else dbx(r["path"]),
        "keywords": keywords_of(title, r["path"], r.get("toc") or []),
        "summary": "" if r.get("collection") else summary_of(text, title),
        "toc": clean_toc(r.get("toc") or [])[:40],
        "text": text[:700],
        "cover": r["id"] if r.get("cover") else None,
        "copies": [{"path": c, "url": dbx(c)} for c in r.get("copies", [])][:6],
    }
    if r.get("collection"):
        d["collection"] = True; d["nparts"] = r["nparts"]
        d["parts"] = [{"n": p["n"], "t": p["t"], "p": int(p["p"] or 0) or None, "url": dbx(p["path"])} for p in r["parts"]]
        d["summary"] = f"Collection de {r['nparts']} fichiers regroupés depuis le dossier « {os.path.basename(r['folder_only'])} »."
        d["cover_src"] = hashlib.sha1(r["path"].encode()).hexdigest()[:16]
    if r.get("subject") and good_meta_title(r["subject"], "") and r["subject"] != title:
        d["subtitle"] = r["subject"][:160]
    out_docs.append({k: v for k, v in d.items() if v not in (None, "", [], {})} | {"title": title, "theme": d["theme"]})

out_docs.sort(key=lambda d: (d["kind"] != "doc", d["theme"], norm(d["title"])))

# ─── 7. Vignettes : paquets de ~120, chiffrés ───────────────
os.makedirs(a.dst, exist_ok=True)
cov_dir = os.path.join(a.src, "covers")
salt = secrets.token_bytes(16)
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
ITER = 250_000
key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER).derive(a.password.encode())
aes = AESGCM(key)
def enc(b):
    iv = secrets.token_bytes(12); return iv + aes.encrypt(iv, b, None)

import shutil
pk = os.path.join(a.dst, "p")
shutil.rmtree(pk, ignore_errors=True); os.makedirs(pk)
PACK = 120
pack_i, buf, offs = 0, io.BytesIO(), {}
def flush():
    global pack_i, buf
    if buf.tell() == 0: return
    with open(os.path.join(pk, f"{pack_i:03d}.bin"), "wb") as f: f.write(enc(buf.getvalue()))
    pack_i += 1; buf = io.BytesIO()
n_in = 0
for d in out_docs:
    cid = d.get("cover_src") or d.get("cover")
    d.pop("cover_src", None)
    p = os.path.join(cov_dir, f"{cid}.jpg") if cid else None
    if not p or not os.path.exists(p): d.pop("cover", None); continue
    b = open(p, "rb").read()
    d["cover"] = [pack_i, buf.tell(), len(b)]
    buf.write(b); n_in += 1
    if n_in % PACK == 0: flush()
flush()

catalog = {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "dropbox_root": a.dropbox_root, "packs": pack_i, "documents": out_docs}
raw = json.dumps(catalog, ensure_ascii=False, separators=(",", ":")).encode()
import gzip
blob = enc(gzip.compress(raw, 9))
with open(os.path.join(a.dst, "catalog.bin"), "wb") as f: f.write(blob)
with open(os.path.join(a.dst, "lock.json"), "w") as f:
    json.dump({"v": 1, "kdf": "PBKDF2-SHA256", "iter": ITER, "salt": base64.b64encode(salt).decode(),
               "check": base64.b64encode(enc(b"bridgeai-bibliotheque")).decode()}, f)
if a.plain:
    with open(os.path.join(a.src, "catalog.plain.json"), "wb") as f: f.write(raw)

c = collections.Counter(d["theme"] for d in out_docs)
print(f"{len(out_docs)} entrées ({len(collections_out)} collections regroupant {len(grouped)} fichiers), {n_in} vignettes en {pack_i} paquets")
print(f"catalogue : {len(raw)/1e6:.1f} Mo brut → {len(blob)/1e6:.2f} Mo chiffré")
print(dict(c.most_common()))
