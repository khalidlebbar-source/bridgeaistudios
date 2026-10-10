#!/usr/bin/env python3
"""
Extraction des métadonnées PDF — étape 1 de l'indexation de la Bibliothèque.

Usage :  python3 extract.py <racine_bibliotheque> <liste.tsv> <dossier_sortie> [budget_secondes]

<liste.tsv> : lignes "taille<TAB>mtime<TAB>chemin_relatif" (sortie de find -printf).
Pour chaque PDF : infos (pdfinfo), texte des 1res pages (pdftotext), signets
(pypdf, si dispo), vignette de la 1re page (pdftoppm, JPEG ~240 px).
Reprend là où il s'était arrêté (fichiers déjà traités ignorés) et s'arrête
proprement quand le budget de temps est consommé.
"""
import hashlib, json, os, subprocess, sys, time

root, listing, out = sys.argv[1], sys.argv[2], sys.argv[3]
budget = float(sys.argv[4]) if len(sys.argv) > 4 else 150
t0 = time.time()
os.makedirs(os.path.join(out, "covers"), exist_ok=True)
meta_path = os.path.join(out, "meta.jsonl")

done = set()
if os.path.exists(meta_path):
    with open(meta_path, encoding="utf-8") as f:
        for line in f:
            try: done.add(json.loads(line)["path"])
            except Exception: pass

try:
    import pypdf
    import logging; logging.getLogger("pypdf").setLevel(logging.ERROR)
except Exception:
    pypdf = None

def run(cmd, timeout):
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=timeout)
        return r.stdout.decode("utf-8", "replace")
    except Exception:
        return ""

def outline(path, size):
    if not pypdf or size > 60_000_000: return []
    res = []
    try:
        rd = pypdf.PdfReader(path, strict=False)
        def walk(items, lvl):
            for it in items:
                if len(res) >= 60: return
                if isinstance(it, list): walk(it, lvl + 1); continue
                try: pg = rd.get_destination_page_number(it) + 1
                except Exception: pg = None
                t = str(getattr(it, "title", "") or "").strip()
                if t: res.append({"title": t[:160], "level": min(lvl, 2), "page": pg})
        walk(rd.outline, 1)
    except Exception:
        pass
    return res

rows = []
with open(listing, encoding="utf-8", errors="replace") as f:
    for line in f:
        p = line.rstrip("\n").split("\t")
        if len(p) == 3: rows.append(p)

n_new = 0
with open(meta_path, "a", encoding="utf-8") as mf:
    for size, mtime, rel in rows:
        if rel in done: continue
        if time.time() - t0 > budget: break
        full = os.path.join(root, rel)
        size = int(size)
        h = hashlib.sha1(rel.encode("utf-8")).hexdigest()[:16]
        rec = {"path": rel, "id": h, "size": size, "mtime": float(mtime)}
        info = run(["pdfinfo", full], 15)
        for ln in info.splitlines():
            if ":" not in ln: continue
            k, v = ln.split(":", 1); v = v.strip()
            if k in ("Title", "Author", "Subject", "Keywords", "Creator", "Producer", "CreationDate", "Pages"):
                rec[k.lower()] = v
        text = run(["pdftotext", "-f", "1", "-l", "4", "-enc", "UTF-8", full, "-"], 20)
        rec["text"] = " ".join(text.split())[:2500]
        rec["toc"] = outline(full, size)
        cov = os.path.join(out, "covers", h)
        run(["pdftoppm", "-f", "1", "-l", "1", "-singlefile", "-scale-to", "260", "-jpeg", "-jpegopt", "quality=72", full, cov], 25)
        rec["cover"] = os.path.exists(cov + ".jpg")
        mf.write(json.dumps(rec, ensure_ascii=False) + "\n"); mf.flush()
        n_new += 1

total = len(rows); nd = len(done) + n_new
print(f"traités cette passe : {n_new} — total {nd}/{total} — {time.time()-t0:.0f} s")
