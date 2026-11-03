# Outils de calculs des ponts — conventions

Page d'accueil : `/outils-ponts.html`. Chaque module a :

| Fichier | Rôle |
|---|---|
| `outils/<slug>.html` | page du module (saisie, résultats, note de calcul) |
| `outils/js/<moteur>.js` | moteur de calcul **pur** (aucun accès au DOM), UMD : `module.exports` pour node, `window.BA.<nom>` dans le navigateur |
| `tools/test-outils-<slug>.js` | tests node : cas analytiques + cas de référence chiffrés |

## Socle partagé (ne pas modifier sans coordination)

- `outils/outils.css` — styles communs (cartes, champs, tableaux `table.res`, indicateurs `.kpis`, impression).
- `outils/js/commun.js` — `BA.chrome({base:'../'})` (menu + pied), `BA.form/read/write` (champs décrits par un schéma),
  `BA.rows` (lignes répétables), `BA.kpis`, `BA.table`, `BA.card`, `BA.chart` (courbes SVG), `BA.note` (note de calcul
  imprimable / PDF), `BA.store` (sauvegarde locale, export/import JSON, lecture de fichiers `.don`/`.sps`), `BA.fmt`, `BA.num`.
- `outils/js/portique.js` — solveur de portiques plans (`BA.portique.prepare(model).run(loads)` réutilisable pour les
  lignes d'influence, `poutreContinue`), relâchements, ressorts, déformations imposées, dénivellations.
- `outils/js/charges.js` — UIC 71, SW/0, SW/2, Φ2/Φ3, LM1 (α de l'AN française), LM2, A(l), Bc, Bt, Br, Mc80, Mc120,
  δ du Fascicule 61, et enveloppes sur lignes d'influence (`mkLI`, `convoi`, `uic71`, `swModel`, `AL`, `Bc`, `chenille`, `lm1Voie`).
- `outils/js/catalogue.js` — liste des modules et statut (`dev`, `beta`, `on`) affichée par la page d'accueil.

## Règles

1. Unités : kN, m, kPa (= kN/m²), MPa seulement pour les matériaux. Préciser l'unité de chaque champ.
2. Le moteur ne lit jamais le DOM ; la page appelle le moteur puis affiche. Tout est testable en node.
3. Formules écrites à partir des textes réglementaires, avec la référence de l'article en commentaire.
4. Un module passe en `beta` quand ses tests analytiques passent, en `on` quand il retrouve les cas de référence
   (anciens fichiers de calcul KLE) à quelques pour mille près.
5. Les fichiers de données d'origine (`.don`, `.res`, `.sps`) ne sont pas versionnés : les tests ne gardent que les valeurs
   chiffrées attendues. L'import de ces fichiers dans les pages est bienvenu quand le format est compris.
6. Note de calcul : hypothèses, données, résultats intermédiaires utiles au contrôle, vérifications avec verdict.
