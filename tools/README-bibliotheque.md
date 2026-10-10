# Bibliothèque — mise à jour de l'index

La page `bibliotheque.html` lit `library/` :

| Fichier | Contenu |
|---|---|
| `library/lock.json` | sel + paramètres PBKDF2 + valeur de contrôle (aucune donnée) |
| `library/catalog.bin` | catalogue complet (titres, classement, sommaires, extraits) — gzip puis AES-256-GCM |
| `library/p/NNN.bin` | vignettes de couverture, ~120 par paquet, chiffrées |

Les PDF ne sont **pas** sur le site : chaque fiche ouvre le fichier dans Dropbox
(`dropbox.com/home/04-LOGICIELS ET DOCS/...`). Seules les personnes ayant accès
au dossier Dropbox peuvent le lire.

## Réindexer après ajout de documents

1. Lister les PDF (hors `02-LOGICIELS`) :
   `find "<racine>" -type f -iname '*.pdf' -printf '%s\t%T@\t%P\n' > list.tsv`
2. Extraire (reprend là où il s'est arrêté ; seuls les nouveaux fichiers sont traités) :
   `python3 tools/extract.py "<racine>" list.tsv extraction/ 600`
   (outils : poppler-utils — `pdfinfo`, `pdftotext`, `pdftoppm` — et `pypdf` en option)
3. Construire le catalogue chiffré :
   `python3 tools/build.py extraction/ library/ --password "<mot de passe équipe>"`
4. Commit + push → Vercel redéploie.

Changer le mot de passe = relancer l'étape 3 avec le nouveau mot de passe
(un nouveau sel est tiré à chaque fois ; les sessions « rester connecté » sont invalidées).

Le classement (thèmes, types d'ouvrage, normes, éditeurs) se règle dans
`build.py` : `PATH_FIRST` (règles par dossier, prioritaires), `THEME_RULES`,
`STRUCT`, `STD`, `PUBL`.
