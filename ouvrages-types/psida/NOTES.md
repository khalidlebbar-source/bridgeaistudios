# PSIDA-EL — méthodes reconstituées

Sources : listings SETRA/CEREMA du corpus ; _NOTICE_PSIDA.txt et PONT_DALLE_EN_BETON_ARME.txt (même document
SETRA, OCR différent — le second est un peu plus lisible, aucune information supplémentaire sur les points ouverts).
PSIDA-PSIDP_ocr.txt était vide au moment du travail. (recalage sur listings SETRA uniquement)

Commande de test : `node test/roundtrip.js` (bordereau) ; `node test/compare.js [n°…]` → `test/report.md`
(`V=3 node test/compare.js 3826` affiche les pires lignes). Jeu de contrôle réservé : 3608, 3637, 3835, 4015.

## Bordereau (parse.js)
- Lignes A3–A13, C1 (B1–B4, C2–C3 conservées brutes). Lecture par jetons (tolère les espacements des
  listings 2007–2008 et les artefacts « 0. 000 », « .00 0 ») ; écriture au format colonnes SETRA 2010+.
- Variante 2006 détectée (A6 : EDROI F6.3 / HCHAU F8.3). Option `conserverMiseEnPage` : réémet la ligne
  source si elle relit les mêmes valeurs → aller-retour caractère pour caractère sur 19/19 passages.

## Caractéristiques
- Section : polygone nervure E1 / flancs obliques E3 (hauteur H3) / encorbellements E2 (épaisseur bout H2),
  extrados plat. Inertie exacte ; largeur équivalente Eeq = 12 I / H³ ; ossature = A × MASVOL (2,5 si 0).
- Ei = 242318,34 fcj^(1/3) t/m², Ev = Ei/3 (EV imprimé tronqué). (≈ 80773 fcj^1/3 de la notice.)
- σs ELS (fissuration préjudiciable) = max(0,5 fe ; 110√(η ftj)) borné à 2/3 fe ; C1 si GENRE = i01.
- Espacement des appareils d'appui = trunc₂(EDALLE1/(NAP−0,6)/sin(biais)).

## Poutre continue
- LI des moments sur appuis : équation des trois moments, inertie constante, cubiques A x³+Bx²+Cx exactes.
- LI en travée, efforts tranchants, réactions : superposition isostatique + moments d'appui.
- Aires des réactions : l'about (porte-à-faux) n'est compté qu'aux appuis d'extrémité.
- Foyers : zéro du diagramme pour une force tendant vers l'appui opposé (dérivées des LI aux extrémités).
- Dénivellations 1 cm avec Ei ; tassements effectifs avec Ei/YOUNG ; en section : |Σ probables| + deux plus
  grands effets aléatoires (vérifié sur 3826).
- Portée équivalente (Guyon) : L·(f_continu/f_iso)^(1/4), flèche à mi-travée sous charge uniforme de la seule travée.

## Majoration dynamique (travées)
- δ = 1 + 0,4/(1+0,2L) + 0,6/(1+4G/S), G = g_moyen·L ; S_Bc = bc·nfiles·poids max des camions Bc sur L ;
  S_Mc120 = 110 t (100 t pour STATUT 000 / F61 1960) ; convois D/E : 1,000. Bt = même δ que Bc.
- Sur appuis (v21) : appuis intermédiaires = max des travées contiguës ; CULÉES = max(δ1, (δ1 + 1,5)/2) pour Bc/Bt,
  max(δ1, (δ1 + 1,2)/2) pour Mc120, (1 + 1,2)/2 = 1,100 pour les convois (δ1 = travée de rive ; notice PSIDP-EL).

## Guyon-Massonnet (coefficients K)
- Plaque isotrope (α = 1), bande de largeur Eeq, bords libres, Poisson 0, 1re harmonique, portée = portée
  équivalente : solution analytique exacte (Lévy) ; LI de K par réciprocité, prolongement analytique hors
  de la dalle équivalente (trottoirs/encorbellements). Reproduit les LI imprimées à 1e-4.
- Fibres : −b (bord de la dalle équivalente), max(−b, bord de chaussée), axe.
- Trottoirs : moyenne des deux trottoirs chargés ; A : max sur voies adjacentes de a1·k/nv·K̄ ; Bc : files de
  2,5 m (roues à 2 m, 0,25 m du bord), bc(nf)·ΣK/(2·nfmax) ; Bt : tandems 3 m, 0,5 m du bord, /(2·2) ;
  Mc120 : chenilles 1 m, entraxe 3,30 m, contre le bord ; convois D/E (v15, règle PSIDP v29) : bande de 3,30 m, axe libre
  dans [bord roulable + 3,50 ; bord opposé − 3,50], maximum de la moyenne de la LI interpolée au pas 0,125 (remplace le calage
  « ±0,50 m », qui en était le cas particulier Lr = 8 m ; écart résiduel ±0,001–0,002).

## Moments longitudinaux
- CP : g × aire ; A(l) = 0,23+36/(l+12), largeur chargeable × a2 (= v0/v) × K_A, longueurs = toute
  combinaison de travées de même signe (exact sur 3826) ; trottoirs : PSTROT × largeur × K × aires de même signe.
- Bc (DG : avant à gauche ; GD), 2 camions par file, nfiles × K_Bc × δ travée ; Bt 2 tandems ; Mc120
  2 chars espacés ≥ 30,5 m bord à bord ; D/E 2 remorques. Positions sur une grille 0,05 L.
- ELS = G + T + trottoirs + max(1,2A ; 1,2B ; C) ; ELU = 1,125[1,2G|0,9G + 1,2T + 1,42Tr + max(1,42A ; 1,42B ; 1,2C)].

## Efforts tranchants sur appuis / réactions
- V : LI d'effort tranchant juste à droite (côté gauche de travée) / à gauche de l'appui ; δ et K des travées
  chargées (comme les moments) ; combinaisons ELS/ELU sans tassements.
- Réactions : largeur totale, K = 1 (Bc : bc(nf) par file), sans majoration dynamique ; la LI est prolongée
  sur l'about (porte-à-faux) et la charge A peut charger l'about (aire 0,512 sur 3826) ; grille de placement
  complétée par les extrémités d'about.

## Positions des charges (grille SETRA)
- Grille : points à 0,05 L de chaque travée (+ prolongements, + extrémités d'about).
- Bc : extrémité gauche du camion sur la grille (DG = avant à gauche, essieux +0/+4,5/+6 ; GD = arrière
  à gauche, +0/+1,5/+6) ; 2e camion sur la grille ou exactement à 10,5 m. Bt : 1er essieu sur la grille, DG.
  Mc120 : extrémité gauche sur la grille, 2e véhicule sur la grille, x2 − x1 ≥ 36,60 − h/2 (h = 0,05 L de la travée du 1er char ; v23). Convois D/E (v15, règle PSIDP v29) :
  remorque AVANT sur la grille, remorque arrière au point de grille le plus proche de s1 − 19 m (D) / s1 − 33 m (E) ; avant imprimée
  en premier.
- A : segments de signe constant de la LI (coupure aux zéros, travées partielles) — combinaison optimale.

## Déformations
- CP : g moyen, Ei ; finale = instantanée × Ei/Ev ; A : A(L_j)·largeur chargeable·a2 sur la seule travée j ;
  « 48T » : force de 48 t au milieu de la travée j. ε fibre inférieure = moyenne de M·yg/(Ei·I) (×10⁴),
  finale = 3 × instantanée − retrait. Rotations = pente de la déformée (×10³). Reproduit à ±0,1.

## Flexion transversale (pages « ELEMENTS DE CALCUL »)
- Travée droite équivalente : longueur DB·sin ψ, largeur A1 = Eeq/sin ψ (A2 = A1/DB) ; θ = (A1/2)/(DB sin ψ).
- Termes d'étalement : sin(mπc/2DB)/(mπc/2DB), c = DB (charge répartie), 1,50 + e0 (Bc), 1,35 + e0 (Bt),
  6,10 + e1 (Mc120), e0 = 0,25 + 2·HCHAU + H, e1 = 2·HCHAU + H ; convois D/E : c = plus petite DB (constat).
- LI de μ (harmoniques 1, 3, 5, fibres axe, b'/2, 3b'/4 de la travée droite équivalente, b' = A1/2) : solution
  exacte de la plaque AVEC le coefficient de Poisson (bords libres, My = −D(w'' − ν β² w)), normalisée par b'.
  Abscisses imprimées e perpendiculaires à l'axe ; coordonnée plaque = e / sin ψ ; fibre imprimée = y_plaque · sin ψ.
  Au-delà du bord de l'INTRADOS (|e_plaque| > EDALLE1/(2 sin ψ)) : prolongement linéaire de pente = corde
  [e1, e1 + 0,125] (charge d'encorbellement ramenée au bord de la nervure ; 0,125 = pas d'étude de la LI, guide PSIDP
  annexe 6). Reproduit les LI imprimées à 1e-4 (sauf LIGNINF = 1 : épaisseur optimisée).
- ν ≠ 0 : le programme imprime pour chaque travée ELEMENTS + MOMENTS PRINCIPAUX avec ν, puis de nouveau avec ν = 0.
- Source décisive : /home/claude/ref/notices/Programme_de_calcul_PSIDP_EL.txt (guide de calcul PSIDP, pages 47–48
  commentées et annexe 6 « Méthode de Guyon-Massonnet-Barès ») — même module que PSIDA.

## Moments transversaux My (MOMENTS PRINCIPAUX DE FLEXION TRANSVERSALE, compute.js momentsTransversaux)
- Charges réparties My = p·A1·Σ Bm·Dm (Dm = aire de μm, trapèzes au pas 0,125) ; roulantes My = δ·P·A2·Σ Bm·Σμm.
- CP max = Gmax/Eeq sur ±Eeq/2 (LI tabulée au pas 0,125 depuis le bord d'extrados, interpolée linéairement) ;
  CP min = Gmin/W sur l'extrados (exact). Écart résiduel CP max ≈ 0,005 sur 3639/3603 (valeur petite, non résolu).
- A : voie par voie (largeur chargeable / nv), p = a1(n)·a2·A(L travée), meilleur sous-ensemble de voies (exact).
- Trottoirs : 3 × PSTROT, trottoir par trottoir ; max = Σ positifs, min = Σ négatifs (exact).
- Bc : P = 12 t (file de roues, 2 essieux arrière), roues à 0,25/2,25 m dans une file de 2,5 m ; positions au pas
  0,125 depuis le bord de chaussée ; max = un groupe de files accolées, min = groupe gauche + groupe droit,
  b_c(nombre total), δ travée (exact). Bt : P = 16 t, tandem 3 m, roues à 0,5/2,5 m, δ travée (exact).
- Mc120 : 55 t par chenille (1960 : 50 t, longueur 4,5 m), moyenne de μ sur 1 m, ENTRAXE 3,25 m (= 3,30 arrondi au pas
  0,125), positions au pas 0,125 dans la chaussée (exact). La même règle (entraxe 3,25, pas 0,125) corrige le
  K Mc120 longitudinal (1,237 → 1,240 sur 3826).
- Convois D/E : étalement 2c = longueur remorque (11 / 15 m) + 2 HCHAU + H, plafonné à la portée DB ; densité
  P/longueur sur 3,30 m ; axe décalé de ±0,375 m (calage, idem K) — approximatif (±0,5 %).
- ELS = CP + Tr + max(1,2A ; 1,2B ; C) ; ELU = 1,125[sup(1,2 CPmax ; 0,9 CPmin) + 1,42 Tr + max(1,42A ; 1,42B ; 1,2C)]
  (inf(...) pour le minimum) — notice PSIDA p. 28 commentée + listings.
- Biais mécanique (mise à jour SETRA PSI-DA, pièce 2.1 § 2.2.1, texte PONT_DALLE_EN_BETON_ARME.txt) :
  ψ = φ si λ ≥ 2, sinon ψ = φ + (100 − φ)(1 − 0,5λ)², λ = (Eeq / sin φ) / portée biaise. Exact (3 déc.) sur 3603–3610.

## Résumé / PP73 (partiel)
- QCP1 = ossature × aire LI réaction, QCP2 = g moyen × aire ; PAMAX = A + trottoirs ; PBCMAX = max(Bc, Bt)
  + trottoirs ; PCMMAX = max charges C + trottoirs ; EPSCP = ε finale CP ; EPSSUR = max |ε| sous A et 48 t.
- ε fibre inférieure calculée à H/2 (dalle rectangulaire équivalente).

## Ferraillage transversal (ferraillage.js transversal/renderTransv) — page ELEMENTS DE CALCUL ... EVALUATION
- Moment longitudinal principal = max M travée (ELS/ELU) / Eeq (exact) ; moment transversal = max des fibres de My
  pondéré (avec ν, puis ν = 0 si ν ≠ 0) ; d = H − 0,04 (non arrondi ; imprimé à 2 déc.) ; AS = ELS n = 15, σs(φ3) ;
  AU = ELU fbu = 0,85 fcj/1,3 ; A1 = 1,2 AS(ν), A2 = 1,2 AU(ν), AS/AU avec ν = 0 ; AP = 5·10⁻⁴ H (3639 : 0,000390
  non expliqué) ; ANF = ftj H²/(6 × 0,9 d fe) (±0,3 % : d exact entre H − 0,038 et H − 0,042) ; exact sur 3826.
- Couture des scellements droits = 4 φ1 τs / fe − 5 φ4² (τs = 0,6 × 1,5² ftj) — exact sur 9 passages (constat) ;
  section minimale à mettre en place = max(A, couture).
- Non reconstitués : moments de torsion / cisaillement (ouvrages biais, ≈ M_long × sin θ cos θ à +4 %), section de
  page FERRAILLAGE TRANSVERSAL PROPOSE
  (longueurs W − 2×0,03 et E1 − 2×0,03 ; espacement en travée = aire(φ3)/A tronqué au mm : 0,304 sur 3826 travée 1).

## Fascicule 61 de 1960 (STATUT 000)
- Be : UN essieu de 16 t (étalement transversal imprimé = 0 + e0) — avec 2 essieux le programme retenait BE à tort
  partout (positions 3827 : 6 % → 65 %) ; My : file de roues de 8 t. HYPOTHÈSE (aucune définition dans les notices).
- Char 1960 : UN seul char de 100 t, chenilles de 4,5 m (étalement imprimé 4,5 + 2 HCHAU + H), 50 t par chenille.
- A(l) 1960 pour My : le listing donne ≈ 1,18 × la valeur 1971 (3827) — formule non retrouvée.

## Ferraillage longitudinal (ferraillage.js, compute.js steelGeom/steelSections)
- Sections des pages MOMENTS… SECTIONS D'ACIER : ELU rectangle simplifié avec **fbu = 0,85 fcj / 1,3** (et non 1,5),
  fsu = fe/1,15 ; ELS (seulement si fissuration ≥ 2) σs limite, n = 15. Ligne 1 : aciers inférieurs (M > 0),
  ligne 2 : aciers supérieurs (M < 0).
- Hauteur utile provisoire d = H − ENROB − max(φ1, φ2 + φ1/2) − φ4/2, arrondie au mm (H = épaisseur imprimée, y
  compris épaisseur optimisée LIGNINF = 1 : 0,830 / 0,790 / 0,840).
- Largeurs de calcul : inférieure = largeur totale ; supérieure = E1 + E3·min(0,3 H, H3)/(2 H3) (largeur moyenne
  d'intrados sur 0,3 H) — exact sur tout le corpus de réglage.
- FERRAILLAGE LONGITUDINAL RETENU : hauteur utile supérieure = provisoire ; inférieure = H − ENROBI − φ2 − φ1/2 en
  fissuration préjudiciable hors LIGNINF = 1, sinon provisoire (constat ; 3639 sup 0,457 non expliqué).
  Enveloppes = max(As ELS, As ELU) recalculées avec les hauteurs retenues (moments non arrondis).
- Groupes : grille centrée de pas s, bandes utiles largeur totale − 2×0,10 (nappe sup.) et E1 − 2×0,10 (nappe inf.) ;
  parité retenue = celle qui maximise le nombre de groupes supérieurs (puis inférieurs). s = ESPAC1 diminué par pas de
  5 mm tant que N1·n·aire(φ1) < max de l'enveloppe (sup et inf). Non expliqué : 3488 (0,290 vs 0,295), 3639 (0,305 vs 0,310).
- Poutre élémentaire de 3 groupes : familles A, B, C numérotées depuis le bord gauche de la nappe supérieure ; la nappe
  inférieure (centrée) commence à la famille ((nS − nI)/2) mod 3. Ordre de remplissage A1 B1 C1 C2 B2 A2 A3 B3 C3.
  Gamme : colonnes niveau k (φ1) puis niveau k + position suivante en φ2 ; φ3 = groupes vides ; OMEGA = Σ n·aire.
- Recouvrement ls = φ1 fe / (4 × 0,6 × 1,5² × ftj).

- Épure d'arrêt des barres (APPROXIMATIVE) : structure exacte (blocs LSTi / LSAk / LITi / LIAk, rangs, diamètres,
  nombres, φ2 pour le fer le plus court « au mieux », poids partiels : φ1 sur l'avant-dernière ligne, φ2 sur la
  dernière ; construction : total sur la dernière). Fers de construction : rangs 1–3 avec les familles de leur nappe,
  rangs ≥ 4 calqués sur les fers principaux de la nappe opposée avec les familles INFÉRIEURES (porte-étriers).
  Recouvrements ls : LST rang j ↔ LSA rang j ; LIT 1–3 ↔ LIA 1–3. About : LST commence à −(about − ENROBS) ;
  LIT 1–3 à −(about − ENROBI) − 12 φ1 (retour). Arrêts : franchissement linéaire de l'enveloppe + 0,8 H (hypothèse, REMPLACÉE
  en v7 par l'épure « à rampes », cf. § Session v7) ;
  la vraie règle regroupe les arrêts par paires (ex. LSA2 3826 : gauche (1)(2,3)(4,5)(6,7), droite (1)(2,3)(4,5,6)(7))
  — non reconstituée.

## Étriers (ferraillage.js)
- Section par cours = 2 × nI × aire(φ4) (nI = groupes inférieurs). τ limite = 0,2 fcj/1,5 (fissuration peu
  préjudiciable) ou 0,15 fcj/1,5.
- Effort tranchant maximal (21 abscisses) : max des deux droites joignant (0 ; Vg,max ELU) → (L ; Vd,max ELU) et
  (0 ; −Vg,min) → (L ; −Vd,min) — exact sur 3826 à partir de la page EFFORTS TRANCHANTS SUR APPUIS.
- τ = V / (b·d) avec b·d ≈ E DALLE × d_sup (écart 0,03–0,09 % : diviseur exact non identifié).
- Espacement maximal = min(0,40 ; At fe / (40 t/m² × E DALLE)) (3639 : 0,174 imprimé, non reproduit).
  Épure retenue : n = ⌈L / s⌉ cours, espacement L/n (3639 : 0,158, non reproduit). Poids partiel non reproduit
  (longueur développée d'un étrier non identifiée).

## Coefficients d'inégalité des appareils d'appui — RÈGLE (retrouvée 2026-11-04, commune PSIDA / PSIDP)
Code : `coefInegalite()` (fonction interne ; PSIDA ferraillage.js, PSIDP compute.js — copie identique, sans dépendance).
K = R / Rmoy, Rmoy = réaction totale de la ligne d'appui / Na. **s = espacement IMPRIMÉ (déjà tronqué) × sin(biais géométrique)**.
Notations : Be largeur équivalente droite (12 I / H³), Lch largeur chargeable (ESURCH), nvc nombre de voies, classe du pont,
H = HDALLE1 (HDAL1), hchau = HCHAU.
- **CP** : bandes porteuses sur la dalle rectangulaire équivalente : bande centrale s, bande de rive Be/2 − (Na−2)s/2 ;
  K = max(s ; Be/2 − (Na−2)s/2) / (Be/Na) ; Na = 2 ⇒ 1. Exact (tous règlements).
- **A** : même découpage sur Lch ; R avec a1 (1 voie), Rmoy avec a1 (nvc) : K = Na·max(s ; Lch/2 − (Na−2)s/2)·a1(1) / (a1(nvc)·Lch).
  (Explique K(cl.2)/K(cl.1) = 1/0,9 et K_A > 1 avec 2 appareils.)
- **Bc, Bt, Mc120** : ligne d'influence η(y/s) de la réaction d'un appui intermédiaire d'une poutre continue à une infinité de
  travées égales s (appuis rigides, EI constant ; rapport des moments d'appui successifs −(2 − √3)), convoi placé librement
  (recherche continue + section dorée) au plus défavorable.
  * Bc : files de 2,50 m, roues à 2,00 m (charges ponctuelles), n = 1…nf files (nf = min(nvc, ⌊Lch/2,5⌋)), R = max_n bc(n)·Σ η ;
    K = Na·R / (bc(nf)·2·nf).
  * Bt : tandems de 3,00 m, roues à 2,00 m, n = 1…nt (nt = min(2, nvc, ⌊Lch/3⌋)), K = Na·max_n Σ η / (2·nt) (bt se simplifie).
  * Mc120 (EMPIRIQUE) : 2 chenilles d'entraxe 3,30 m, chacune = 21 charges égales réparties (bornes incluses) sur 1 + H + hchau ;
    K = Na·max Σ η. Exact pour Na = 2 (et 3 sauf 2765 : 1,198 / 1,203) ; **sous-estime de 0,018 à 0,036 pour Na = 4**
    (3488 1,562/1,588 ; 3607–3610 1,576/1,594 ; 3826 1,595/1,614 ; 0063 1,591/1,611 ; PSIDP 0015 1,510/1,546) — NON RÉSOLU.
- Validation (banc scratchpad kineg/test.js, toutes lignes d'appui des passages F61 1971) : CP, A, Bc, Bt exacts à 0,001 sur
  17/17 (PSIDA) et 18/18 (PSIDP) ; Mc120 9/16 et 8/11.
- **Convois D/E : NON RÉSOLUS** — 1,000 imprimé (comportement antérieur conservé). Mc80 : 1,000 conservé (pas de cas observé).
  Valeurs SETRA (D = E partout) : Na = 2 : 0013 1,502 ; 0013A/B 1,494 ; 0014 1,513 ; 2764 1,624 ; 2766 1,626. Na = 3 : 2765 1,812 ;
  3607–3610 culée 2,275–2,278. Na = 4 : 3607–3610 pile 2,392–2,396 ; 3826/3827 2,211 ; 3835 2,210 ; 0015 2,147.
  2482 (PSIDP, 2e bloc du listing) 2,090 / 2,162 culée/pile alors que 3608 (PSIDA, MÊME géométrie : H 0,77, Be 8,834, Lch 8,
  s 2,91/2,05) imprime 2,278 / 2,396 et le même Mc120 (1,521/1,593) ⇒ le traitement des convois DIFFÈRE entre PSIDA et PSIDP.
  (Anciennes valeurs « 2481 1,494 ; 2483 2,666 ; 2486 2,662 » erronées : 2481/2483/2486 n'impriment pas de convoi.)
  Pistes (banc scratchpad kineg2/, session 2026-11-04 v8) :
  * Règle F61 rappelée par le SETRA (correspondance Jaffré 2006-01) : axe des convois D/E à ≥ 3,50 m du bord de la largeur
    roulable (Lr = EGAU + ESURCH + EDROI), encombrement 3,30 m ⇒ e = Lr/2 − 3,50 (0,5 m pour Lr = 8 : cf. « axe à ±0,50 m » du
    Guyon-Massonnet).
  * PSIDA : bande uniforme de largeur w centrée À ±e (positions extrêmes imposées) dans la poutre infinie η : 3607–3610 donne
    w = 3,60 m à la fois culée (Na 3) et pile (Na 4) — cohérent avec la « bande de 3,6 m » constatée en flexion transversale PSIDP ;
    mais 3826 demande w = 3,70 (ou e ≈ 0,40 avec 3,60) : NON EXPLIQUÉ (H 0,723 / 0,77, W 10 / 11,3).
  * PSIDP : aucune bande unique (w, e) ne convient (2482 : e ≈ 0,85 en culée, 0,15 en pile pour w = 3,6) ; avec Lr = 7 ou 6,5
    (e ≤ 0), Na = 2 imprimé 1,50–1,63 > 1,2 (maximum d'un convoi centré entre 2 appuis dans la poutre infinie) ⇒ la règle des
    3,50 m n'est pas appliquée telle quelle en PSIDP ou le modèle de poutre diffère pour les convois.
  * Écartés (erreur max ≥ 0,07) : bande libre w = a + b·H (± limite dans Lch) ; 2 bandes (entraxe e, largeur t0 + k·H) libres ;
    2 à 4 lignes de roues ponctuelles ; bande porteuse (K = Na·s/w) ; s sans sin(biais) ; poutre finie Na appuis ; rapport
    convoi/Mc120 (≈ 1,50 sur 3607–3610 et 2765 seulement).
- Mc120 (pistes v8) : chenilles en bandes CONTINUES de largeur 1 + H + 2·hchau (diffusion 45° jusqu'au feuillet moyen) ≡ modèle
  à 21 points sur 1 + H + hchau pour Na = 2/3 (exact, 2765 −0,004). Na = 4 : manque 0,016 (3607) à 0,031 (0015) ; l'entraxe 3,25
  dégrade Na = 2 (+0,018) ; la seule variante qui recolle Na = 4 PSIDA est un entraxe fictif de 3,40 m (±0,005 ; 0015 −0,023),
  incompatible avec Na ≤ 3 ; partie positive de η, appui de rive en poutre semi-infinie, poutre finie : écartés. NON RÉSOLU.
- Application : CP pour tous règlements ; A, Bc, Bt, Mc120 seulement au F61 1971 (PSIDA : F61 1960 inchangé, 1,000) ;
  PSIDP : Bc/Bt = 1 si le bordereau n'a pas de charge B (2584 : 1,000 imprimé), A = 1 sans charge A.
- Constats antérieurs (poutre rigide, poutre continue sur appuis rigides avec encorbellements, Guyon-Massonnet) : caducs.

## Vérification ELS du résumé (constat 3826)
- Section 0,50 L en travée, section sur appui ; aciers tendus = fers φ1 réellement présents (sans le fer φ2), aciers
  comprimés = fers de construction ; reproduit y et σb à ~0,5 % ; position des aciers comprimés ≈ 0,05 m (non résolu).

## Non résolus (au fil de l'eau)
- Non implémentés : tableaux des moments transversaux My (MOMENTS PRINCIPAUX DE FLEXION TRANSVERSALE), donc
  ferraillage transversal (pages ELEMENTS DE CALCUL DU FERRAILLAGE TRANSVERSAL / FERRAILLAGE TRANSVERSAL PROPOSE),
  vérifications ELS/ELU du résumé, page « armatures de cisaillement aux environs des appuis », cartes PP68
  (chevêtres : implémentés en v4, cf. § Chevêtres).
  Constats ferraillage transversal : moment longitudinal principal = M max travée / E DALLE (exact 3826) ;
  A1 = 1,2 AS, A2 = 1,2 AU ; AP = 5·10⁻⁴ H (6/7 passages, pas 3639) ; ANF ≈ ftj H² / (6 × 0,9 d fe), d ≈ H − 0,04 ;
  A = sup(inf(sup(A1,A2),ANF), AS, AU, AP).
- Ferraillage (ferraillage.js) — restent approximatifs : abscisses d'arrêt de l'épure, coefficients d'inégalité des
  convois D/E (1,000) et Mc120 à 4 appareils, dimensions des appareils, diviseur exact de τ des étriers,
  poids des étriers, aciers transversaux de l'avant-métré (0).
- K charge A classe 2 (3639 0,887) : RÉSOLU — toutes les zones chargées et positions de véhicules sont prises sur la
  grille de la LI (pas 0,125 m depuis le bord d'extrados ; bord de chaussée −3,00 → nœud −2,975). Trottoirs et convois
  restent en moyenne continue (convois : axe à ±0,50 m pour K, ±0,375 m pour My). Résidus : CV 1,021 au lieu de 1,019
  (3826), trottoir 3639 1,138 au lieu de 1,139.
- K Mc120 : RÉSOLU (chenilles d'entraxe 3,25 m, positions au pas 0,125 m).
- Réactions d'appui d'extrémité : convois D/E — RÉSOLU en v15 (placement de la remorque arrière, § Session v15).
- STATUT 000 (F61 1960) : système Be calé (2 véhicules, roues 1,5 m, entraxe 2,5 m) ; largeur nominale
  imprimée 0,000 ; formule A(l) 1960 à vérifier.
- δ sur appuis d'extrémité (ex. 3826 : Bc 1,341 / Mc 1,189 ≠ valeurs de travée) : formule non identifiée.
- LIGNINF = 1 : RÉSOLU en fissuration peu préjudiciable (cf. § Optimisation) ; préjudiciable : arrondi au cm seul (3488).

## Appareils d'appui (ferraillage.js, partiel)
- A VIDE (MAX) = réaction CP max × coefficient d'inégalité CP / NAP ; A VIDE (MIN) = réaction CP min / NAP
  (sans coefficient). Compressions moyennes = réaction par appareil / (largeur × longueur).
- Dimensions : plus petit appareil (pas de 0,05 m, minimum 0,25 × 0,25) tel que réaction max / aire ≤ COMPRENS.
  Le choix largeur/longueur au-delà (0,35 × 0,45 vs 0,25 × 0,65) n'est pas identifié.
- EN CHARGE (exact sur 3826 et 3603 avec les coefficients imprimés) : max = (Gmax·cCP + max(1,2 A cA ; 1,2 δB B cB ;
  δ C cC) + 2 T⁺)/NAP, min = (Gmin + min(…) + 2 T⁻)/NAP ; δ convois = 1,1 sur appui d'extrémité. Compressions
  atteintes = réaction en charge / aire (première colonne au format F7.2 accolé aux admissibles).
- Coefficients d'inégalité : cf. § Coefficients d'inégalité — RÈGLE (convois D/E et Mc120 Na = 4 ouverts).

## Optimisation de l'épaisseur (LIGNINF = 1, compute.js compute)
- H arrondi au cm supérieur puis +0,01 m tant que μ = |Mu,min| / (Eeq (0,9 H)² · 0,85 fcj/1,5) > 0,186 (pivot A/B),
  H DALLE 3 augmenté d'autant (encorbellements inchangés). 3452 : 0,70 → 0,83 ; 3453 : 0,713 → 0,79 ; 3488 : 0,838 → 0,84.
  Tolérance relative 2·10⁻⁴ sur 0,186 (3452 : μ(0,83) = 0,18602 avec nos moments). Fissuration préjudiciable : seul
  l'arrondi au cm est observé (critère ELS non identifié). Le message n'est pas encore imprimé.
- EI imprimé : 3517980,5 (fcj = 3060) imprimé 3517981 par SETRA, 3517980 chez nous → page DEFORMATION non appariée
  par compare.js (le titre contient EI) sur 3452/3453/3488 ; constante 242318,34 à affiner (float32 ?).

## FERRAILLAGE TRANSVERSAL PROPOSE (constats v3 — implémenté en v5, voir § Session v5)
- Longueurs : face sup. = W − 0,06, face inf. = E1 − 0,06 ; poids d'une ligne = n × (Lsup + Linf) × masse linéique.
- Zone courante Ti : plage = portée − zones d'appui ; n = ⌈plage / (aire(φ) / A)⌉, espacement = plage / n (3826 : 0,304 /
  0,274). Zones d'appui 1G/1D/2G/2D : espacements (0,17 ; 0,24 ; 0,11 sur 3826) et diamètres alternés liés au
  ferraillage des chevêtres / appareils d'appui — règle non retrouvée ; d'où TRANSVERSAUX = 0 dans l'avant-métré.

## Torsion des ouvrages biais (page ELEMENTS DE CALCUL DU FERRAILLAGE TRANSVERSAL) — non résolu
- 3603 : Mtors / M_long ≈ 0,1010 (travée 1, ψ = 93,77) et 0,0762 (travée 2, ψ = 95,34), identique ELS/ELU ; proche de
  sin 2(100 − ψ)/2 à +4 % ; moment de calcul 12,34 = My + f(Mtors) (Wood-Armer biais ?) ; contrainte τ = Mtors × 10,66.

## Session 2026-11-04 (v3) — règles retrouvées / constats
- Efforts tranchants sur appuis : un essieu placé EXACTEMENT sur l'appui compte pour la valeur limite côté travée
  (LI juste à droite de l'appui gauche = saut inclus ; juste à gauche de l'appui droit) avec K et δ de la travée étudiée.
  Les aires (CP, A, trottoirs) restent calculées sur la LI d'origine. Ex. 3603 V travée 1 côté gauche B : 61,2 → 65,8
  (imprimé 65,8, Bc GD avec essieu de 12 t sur l'appui). Efforts tranchants 79,5 → 84 % (87 % avec chenille à 120 points, mais moments −1 pt).
- Mc120 : écart minimal entre les extrémités gauches des deux chars sur la grille = 36,2 m (constat : écarts imprimés
  jusqu'à 36,20 sur 3603/3607 ; 36,6 = 30,5 + 6,1 du F61 rejetait ces positions). Règle exacte non retrouvée (36,2 ≈
  plus petit écart observé ; 36,0 et 36,5 dégradent).
- Chenille Mc120 : intégration de la LI sur la longueur de chenille avec 400 points (au lieu de 40) : la discrétisation
  grossière faussait les moments à ±1 unité (moments longitudinaux 76 → 84 %). Convois D/E laissés à 40 points
  (400 dégradait les efforts tranchants près des sauts).
- Ouvrage longitudinalement symétrique (portées en miroir) : SETRA ne calcule que la première moitié des travées /
  appuis ; moments des travées suivantes, efforts tranchants utilisés pour les étriers et réactions des appuis suivants
  = image miroir (V_g,max(i) = −V_d,min(n−1−i)…). Le programme est lui-même asymétrique (Bc DG/GD, grille), d'où des
  écarts si l'on calcule directement la seconde moitié (3826 travée 3 : 129,56 au lieu de 131,63). Étriers 54 → 59 %.
- Bilan v3 : réglage 75,9 → 77,5 % ; contrôle 73,3 → 73,6 % (le contrôle est entièrement en F61 1960, cf. ci-dessous).
- STATUT 000 (F61 1960) — charge A : les 6 passages 1960 (3452, 3453, 3827 en réglage ; 3637, 3835, 4015 en contrôle)
  ont des moments A ≠ ceux de la formule 1971, alors que B, C, K, aires et longueurs chargées imprimées sont identiques.
  En 1960 il n'y a PAS de coefficient a2 (3453 : Lch 8 m, v0/v = 0,875 non appliqué). Densités déduites (t/m², a1 = 1,
  K imprimé 1,000) : l = 1,5 → 1,772 ; 3,44 → 1,768 ; 12,22 → 1,707 ; 13 → 1,6983 ; 13,5 → 1,6922 ; 18 → 1,6286 ;
  combinaisons 31 → 1,374 ; 36 → 1,266. Courbe CONCAVE (≈ 1,773 − 0,000447 l², écart 3·10⁻⁴) : ce n'est pas une
  hyperbole a + b/(l + c) de type règlement ; formule 1960 non retrouvée (aucune source dans le corpus). Levier principal
  restant pour les moments / efforts tranchants / réactions du jeu de contrôle (tous en 1960).

## Sources consultées
- PSIDA-PSIDP OCR (/home/claude/ref/notices/ocr_psida_psidp, 120/143 pages au moment du travail) : c'est le
  guide de CONCEPTION ponts-dalles (élancements PSI.DA 1/20, 1/26, 1/28 ; tassements ; esthétique) ; il ne
  contient ni la majoration dynamique sur appuis, ni la répartition Mc120, ni la règle d'optimisation LIGNINF=1.

## Session 2026-11-04 (v4) — appareils d'appui, chevêtres, ferraillage transversal proposé

### Score publié = passages au F61 de 1971 seulement (décision client, SPEC)
- test/compare.js imprime désormais les synthèses « RÉGLAGE 1971 SEULEMENT » (3488, 3603–3607, 3609, 3610, 3639, 3826,
  0063, OA26), « CONTRÔLE 1971 SEULEMENT » (3608), « TOUS PASSAGES 1971 », puis les synthèses tous règlements.
  Variable PG=<section> : statistiques page par page (diagnostic).
- Bilan v4 : réglage 1971 81,1 → 81,2 % ; contrôle 3608 79,4 → 79,5 % ; appareils d'appui (réglage 1971) 30,7 → 36,3 %.

### Chevêtres (ferraillage.js appareils, RÉSOLU sauf section en fissuration peu préjudiciable)
- Largeur du chevêtre : appui intermédiaire e = 2·esp/3 ; appui d'extrémité e = ABOUT·sin ψ + esp/3 (ψ en grades),
  esp = espacement imprimé des appareils (3603, 3607, 3639, 3826, 3488, 0063 : exact ; 3603 culée 1,5376 → « 1.54 »).
- Moment après pondération = R en charge max (par appareil) × esp / (12 e) (formule du PSIDP « |M| = R ℓ / 12 e »).
  Exact avec les réactions imprimées ; nos moments restent faux tant que R l'est (coefficients d'inégalité).
- Section de calcul : ELS, section rectangulaire fissurée b = 1 m, n = 15, d = H − 0,04, σs = σ̄s. Exact en fissuration
  préjudiciable (3826, 3488, 0063 : d = H − 0,0393…0,0399) ; 3639 donnerait d = H − 0,049 (non expliqué) ; fissuration
  peu préjudiciable (3603, 3607) : ni ELS σs = 33333 (d = H − 0,007…0,014) ni ELU avec 1,35 M (≈ ±1 %) ne collent.

### Dimensions des appareils (constats, non résolu)
- Couples (largeur × longueur) observés : 0,20×0,35 ; 0,25×0,25/0,30/0,40/0,45/0,50 ; 0,30×0,30/0,40/0,45/0,50/0,55 ;
  0,35×0,45/0,50. Pour une même aire requise (R/1500 = 0,1500–0,1565), 3603 (biais 85) prend 0,35×0,45 et 3604–3606
  (biais 90–95) 0,30×0,55 : la largeur est fixée AVANT la longueur par un critère non identifié (rotation ? épaisseur
  d'élastomère ?), puis longueur minimale au pas de 0,05 avec R/aire ≤ COMPRENS (inégalité stricte possible :
  0,1500 → 0,30×0,55 et non 0,30×0,50). SYMAP = 2 → appareils intermédiaires identiques (max des appuis).

### Coefficients d'inégalité (constats v4 — RÉSOLU en v6, cf. § Coefficients d'inégalité — RÈGLE)
- 2 appareils : K indépendant de l'espacement (3603–3606 : esp 3,21–3,30 → A 1,188/1,189, Bc 1,320 constants) ⇒ pas la
  statique 1 + 2e/s (pourtant isostatique avec 2 appareils) ; 3639 (H 0,543, W 9,2) : A 1,452, Bc 1,494 ⇒ dépend de la
  souplesse de la dalle. Les K de Guyon-Massonnet du moteur (≈ 1,05 sur 3603) ne conviennent pas.
- 4 appareils : K(A) ≈ K(CP) (3826 1,060/1,061 ; 3488 1,045/1,050) ; Bc ≈ 1,71–1,81. 3 appareils (culées 3607) : CP 1,006.
- PSIDP (notice, p. 52) : « coefficients δ, γQ non inclus, mais a1, bc inclus » ; « bande porteuse » par appareil ; ligne
  d'appui assimilée à une poutre continue à travées égales ; K = R / Rmoy, Rmoy = réaction totale / Na. La poutre
  continue sur appuis rigides avec encorbellements donne 1,78 pour la CP de 3826 (imprimé 1,061) : il faut un autre
  modèle (appuis élastiques ? dalle 2D ?). Levier principal de la page (réactions en charge, compressions, chevêtres,
  dimensions, cartes PP73 du résumé).

### FERRAILLAGE TRANSVERSAL PROPOSE — règles de zones retrouvées (non implémenté)
- Zones par appui : 1G / 1D = demi-chevêtre (appui intermédiaire : e/2 de chaque côté ; culée : 1G = ABOUT, 1D = e − ABOUT) ;
  2G / 2D = zone d'extension contiguë, longueur = e (largeur du chevêtre) ; travée Ti = portée − zones des deux appuis.
  3826 : culée 1G 3×0,17 (plage imprimée = ABOUT 0,500), 1D 4×0,17 = 0,68 (1,13 − 0,5 = 0,63) ; pile 1G/1D 6×0,11 = 0,66
  (0,625) ; 2G/2D 6×0,24 = 1,44 (1,25) ; T1 = 12,5 − 0,68 − 0,66 − 1,44 = 9,72 ✓.
- Nombre de barres d'une zone = ⌈longueur / espacement⌉, plage = nombre × espacement (sauf 1G de culée : plage = ABOUT).
- Section par zone : 1G/1D = section de calcul du chevêtre ; 2G/2D = section du chevêtre / 3 (3826 : 1,407e-3/3 → φ12
  0,241 → 0,24 ; 3639 : 2,423e-3/3 → φ14/φ10 alternés 0,1438 → 0,140 ✓) ; Ti = section minimale à mettre en place
  (n = ⌈plage / (aire/A)⌉, espacement = plage/n, 3 décimales).
- Espacement des zones de chevêtre = aire de la barre (moyenne si alternées) / A, tronqué au pas de 0,005 m
  (3826 0,1117 → 0,110 ; 3603 0,1655 → 0,165, 0,1583 → 0,155 ; 3639 0,1977 → 0,195 ; 0,2972 → 0,295 ✓).
- Choix du diamètre (ordre PHI3, PHI2/PHI3 ALT, PHI2, PHI1/PHI2 ALT…) : 3826 et 3639 = plus petit diamètre donnant un
  espacement ≥ 0,10 m ; 3603 choisit des diamètres plus gros (culée PHI2 0,26 alors que PHI3 donnerait 0,147) : règle
  exacte non retrouvée (le PSIDP imprime un tableau « espacements maximaux en fonction du diamètre » avec « * » pour
  les espacements trop faibles ou trop grands, max observé 0,335). Ouvrages biais (3603) : 2D aussi en culée,
  dispositions « TB » (tête-bêche) et longueurs différentes en travée (6,31 / 3,97 au lieu de 8,17 / 4,57).
- Poids par appui / travée = Σ nombre × (Lsup + Linf) × masse linéique, réparti par diamètre (alimente l'avant-métré).

## Session 2026-11-04 (v5) — page « FERRAILLAGE TRANSVERSAL PROPOSE » implémentée (ferraillage.js propose / renderPropose)

### Bilan (passages 1971 seulement)
- Réglage 1971 : 81,2 → 82,2 % ; ferraillage transversal 26,2 → 49,5 % ; résumé / avant-métré 35,3 → 35,4 %.
- Contrôle 3608 : 79,5 → 79,8 % ; ferraillage transversal 17,9 → 25,5 %.
- Page par page (valeurs identiques / imprimées) : 3605 88/158, 3610 82/158, 3826 63/123, 0063 50/88, OA26 36/53,
  3603 21/158, 3488 16/88, 3639 12/123. Le levier restant est la SECTION DE CALCUL DU CHEVETRE (dépend des réactions
  en charge × coefficients d'inégalité, non résolus) : avec les sections imprimées, les espacements/diamètres des zones
  d'appui de 3826, 0063, OA26, 3639, 3605, 3606, 3609, 3610 sont retrouvés à la main.

### Règles codées (vérifiées avec les sections imprimées)
- Zones 1G/1D : section = section de calcul du chevêtre ; longueur e/2 (pile), ABOUT (côté about de la culée, plage
  imprimée = ABOUT) et e − ABOUT (côté travée de la culée). n = ⌈longueur / s⌉, plage = n·s.
- Zones 2G/2D : section = max(section du chevêtre / 3 ; section minimale de la travée contiguë) (3609 : 2G 0,420 =
  φ16 / 4,78e-4 de T1, 2D 0,405 = φ16 / 4,96e-4 de T2 ; 3605/3610 culées 0,535/0,520 = φ16 / Amin) ; longueur = e
  sur pile. Culées : pas de zone 2 en fissuration préjudiciable (3826, 0063, OA26, 3639, 3488) ; zone 2D/2G de longueur
  2·esp/3 en fissuration peu préjudiciable (3604–3610 : 2,147 → 5 × 0,535 ; 1,94 → 4 × 0,52), face sup. PHI2/PHI3 ALT.
- Espacement des zones 1 et 2 : aire (moyenne si ALT) / A tronqué au pas de 0,005 ; fissuration préjudiciable :
  plafonné à 0,325 (3488 : 2G 0,366 → 0,325 ; travée 14,79 / 0,325 → 46 barres).
- Travée : plage = portée − (1D + 2D de l'appui gauche, sans la zone ABOUT) − (2G + 1G de l'appui droit) ;
  A = section minimale à mettre en place ; n = ⌈plage / min(aire/A ; plafond)⌉ ; espacement = plage / n (non tronqué).
  Face sup. = PHI3 ; face inf. = diamètre choisi.
- Diamètre : premier de PHI3, PHI2/PHI3 ALT, PHI2, PHI1/PHI2 ALT, PHI1 donnant aire/A ≥ 0,10 m ; en fissuration peu
  préjudiciable (famille 3603–3610) la suite commence à PHI2 (zones 1, zones 2, face inf. des travées).
- Longueurs : face sup. (W − 0,06)/sin ψ, face inf. (E1 − 0,06)/sin ψ (ψ biais géométrique, grades ; 3603 : 8,17 / 4,57).
- Poids : Σ nombre × longueur × aire × 7,85 par face ; barres ALT : nombre/2 par diamètre, même impair (3639 culée :
  7 barres → 3,5 φ32 + 3,5 φ14 = 0,322 / 0,062). Ligne APPUI = somme des zones de l'appui ; TOTAL = Σ ; le total par
  diamètre alimente la colonne TRANSVERSAUX de l'avant-métré (metre()).

### Non résolus
- 3488 : toutes les zones et la face inf. des travées en PHI2/PHI3 ALT alors que PHI3 donnerait s ≥ 0,10 (0,166 ;
  0,263 ; 0,269) ; 3826/0063 acceptent PHI3 à 0,17–0,31. Seule différence notable : H = 0,84 (A travée = AP = 5e-4 H).
- Dispositions TB (fissuration peu préjudiciable) : face inf. des travées toujours « PHI2 TB » de longueur réduite
  (E1 = 4,5 : 3,91 à ψ 100/95, 3,94 à 90, 3,97 à 85 ; E1 = 7 : 6,09 / 6,11 / 6,19 à 100 / 95 / 85) ; ≈ 0,87 E1 mais
  aucune forme a·E1·f(ψ) ne colle à 3605 et 3609 à la fois. Face sup. « PHI3 TB » (6,31 / 9,09) seulement à ψ ≤ 85–90
  (3603, 3607, 3608 ; pas 3604). Non codé : longueurs droites, d'où poids PHI2 des travées faux sur cette famille.
- Face sup. des zones 2 de pile : PHI2/PHI3 ALT sur 3603/3607/3608, PHI2 ailleurs (critère inconnu ; codé PHI2).
- Culée 2D de 3603 (8 barres, 0,315) et 3604 2G (0,445 au lieu de 0,440) : ne suivent pas la règle (torsion des biais ?).
- Épure d'arrêt des barres (regroupement par paires) et tonnages longitudinaux : non repris dans cette session (budget).

## Session 2026-11-04 (v6) — coefficients d'inégalité branchés (ferraillage.js coefInegalite / appareils)

### Bilan (passages 1971 seulement)
- Réglage 1971 : 82,2 → 83,0 % ; appareils d'appui 36,3 → 55,8 % ; ferraillage transversal 49,5 → 56,2 % ; résumé /
  avant-métré 35,4 → 39,3 %. Contrôle 3608 : 79,8 → 80,4 % ; appareils 28,4 → 50,9 % ; ferraillage transversal 25,5 = ;
  résumé 33,2 → 38,3 %. Aucune section en recul. Tous règlements : réglage 78,4 → 79,1 %, contrôle 74,3 → 74,5 %.
- Propagation : réactions à vide (CP) et en charge, compressions, longueur des appareils, moments et sections des chevêtres,
  FERRAILLAGE TRANSVERSAL PROPOSE (zones 1/2), avant-métré (TRANSVERSAUX), cartes PP73 (MAJCP, MAJA, MAJBC, MAJCM).
- Réactions en charge désormais à ~1 % sur 3603, 3639, 3488 (passages sans convois ou où ils ne dimensionnent pas). Là où les
  convois D/E dimensionnent (3826 : 178,28 imprimé, 144,82 calculé, K_CVOI 2,211 imprimé) l'écart reste entier → K convois.

### Dimensions des appareils (constats v6, toujours NON RÉSOLU — non codé)
Aire requise = R en charge max / COMPRENS (réactions imprimées) → dimensions SETRA :
0,0515/0,0530/0,0541/0,0597/0,0605/0,0618 → 0,25×0,25 ; 0,0623 → 0,20×0,35 (OA26, 1 travée) ; 0,0668/0,0671/0,0738 → 0,25×0,30 ;
0,0763 → 0,30×0,30 (3607–3610) ; 0,0975 → 0,25×0,40 ; 0,1037/0,1083 → 0,25×0,45 ; 0,1070/0,1125 → 0,30×0,40 (3453, biais 70) ;
0,1150–0,1227 → 0,25×0,50 ; 0,1285/0,1310 → 0,30×0,45 ; 0,1427/0,1442 → 0,30×0,50 ; 0,1500/0,1507/0,1565 → 0,30×0,55
(3604–3610) mais 0,35×0,45 (3603, biais 85) ; 0,1608/0,1690 → 0,35×0,50 (3452, biais 71,5).
Ni « aire minimale » (3826 0,1189 prend 0,25×0,50 et non 0,30×0,40 ; 3607 culée 0,0763 prend 0,30×0,30 et non 0,25×0,35), ni un
rapport longueur/largeur maximal fixe ne conviennent ; dépend du biais (3603 vs 3604) ⇒ critère de rotation / distorsion
probable (épaisseur d'élastomère). La règle provisoire (largeur 0,25, longueur au pas de 0,05) est conservée.

### Restent ouverts
- K convois D/E (voir § RÈGLE) — principal levier restant de la page appareils (vérifié sur 3826 ; idem pour les autres passages où CVOI.D/E dimensionne).
- K Mc120 pour Na = 4 (−0,018 à −0,036).
- Section du chevêtre en fissuration peu préjudiciable (3603 : 0,000770 imprimé / 0,000802 calculé avec M ≈ exact) et 3639
  (d = H − 0,049) : inchangé.

## Session 2026-11-10 (v7) — résumé PP73, réactions, épure d'arrêt des barres

### Bilan (passages 1971 seulement ; sauvegarde v6 : scratchpad psida_v6/)
- Réglage 1971 : 83,0 → 85,1 % ; contrôle 3608 : 80,4 → 82,5 %. Tous règlements : réglage 79,1 → 81,0 %, contrôle 74,5 → 75,9 %.
- Sections (réglage / contrôle) : résumé / avant-métré 39,3 → 67,3 % / 38,3 → 66,8 % ; ferraillage longitudinal 66,7 → 69,3 % /
  62,6 → 66,4 % ; réactions 76,9 → 82,1 % / 74,0 → 79,5 % ; appareils d'appui 55,8 → 56,0 % ; aucune section en recul.

### Page « RESULTATS UTILISABLES EN DONNEES POUR LE PROGRAMME PP73 (SUITE ET FIN) » (note.js, après la page PP73)
- Était absente (≈ 100 valeurs par passage). Contenu : ROT par appui, cartes PP68 6 (appui 1), 8 (dernier appui),
  « CARTES 10,12,… » (appuis intermédiaires, une carte paire par appui), 26 (biais, portées, ELARGT, ELARGA), 27 (EPSCP à
  3 décimales, EPSSUR, ROT). Colonnes des cartes : N0 TYPAP NAP LAP (= longueur) DAP (= largeur) ESPAP (2 déc.) MAJCP QCP1
  QCP2 MAJA PAMAX PAMIN MAJBC PBCMAX PBCMIN MAJCM PCMMAX PCMMIN : mêmes grandeurs que la page PP73.
- **ROT (règle retrouvée, exacte sur 3826, 0063, 3603, 3639, 3488)** : pour chaque appui, rotation CP FINALE (page DEFORMATION,
  APP G de la travée de droite ou APP D de la dernière) + la plus forte rotation de même signe sous A appliquée à UNE seule
  travée ; ROT = max sur les deux signes de |…| (ni somme des travées, ni 48 t).
- Page PP73 : ajout du titre et de la ligne « VARIATIONS RELATIVES … (X 10**4 ) » (2 nombres comptés par la comparaison).

### Réactions d'appui : seul l'about contigu à l'appui est chargeable (compute.js, réactions)
- OA26 (1 travée) imprime 0,00 pour PBCMIN / PCMMIN / minima de réaction alors que la LI prolongée sur l'about opposé donne
  −1,07 / −0,15. La LI de réaction est désormais nulle sur l'about non contigu (appui d'extrémité opposé ; les deux abouts pour
  un appui intermédiaire). Réactions 76,9 → 82,1 %. Crochet : globalThis.PSIDA_ABOUT_ALL = 1 rétablit l'ancien comportement.

### Épure d'arrêt des barres — modèle « à rampes » (ferraillage.js epure/rampes ; crochet PSIDA_EPURE_LIN = 1 : ancien modèle)
- Constat 3826 LSA2 (à ±0,05 m, 1,39 et 0,97 exacts) : un fer de rang r n'est pleinement efficace qu'à ls de son extrémité
  (résistance linéaire de 0 à l'extrémité jusqu'à 1 à ls, ls = longueur de recouvrement imprimée). La résistance cumulée
  Ω(r0−1) + Σ ΔΩ_q·clamp((u_q − u)/ls) doit couvrir l'enveloppe décalée de 0,8 H (max de l'enveloppe sur ±0,8 H).
  Ω = colonnes de la GAMME (fers de construction φ3 compris ; colonne « alt » si le dernier fer est en φ2).
- Arrêts traités par groupes de rangs, du plus élevé au plus bas, position commune minimale (recherche par dichotomie, pas
  0,01 m). Groupes codés : sup. (1)(2,3)(4,5)(6,7)… ; inf. de travée (1,2,3 filants)(4,5)(6,7)…. Variantes essayées
  (PSIDA_GRP) : dernier rang isolé rattaché au groupe précédent (B) = neutre ; paires depuis le haut (C) −0,1 pt ;
  rangs isolés (S) −0,3 pt.
- Longueur utile côté appui : jusqu'au minimum de l'enveloppe dans la travée (sinon l'enveloppe de l'appui suivant rendait
  la couverture impossible).
- Nombre de rangs sur appui : maximum de l'enveloppe sur les DEMI-travées contiguës (et non sur les travées entières, qui
  incluait l'appui suivant : 3603 LSA2 7 → 6 rangs ✓) ; comparaison aux colonnes de la gamme (Ω avec φ3).
- Fers inférieurs de travée : rangs 1–3 traités comme un groupe filant (base = colonne 0 de la gamme) ; les fers de
  construction inférieurs d'appui LIA 1–3 = arrêt des LIT 1–3 + ls (3826 LIT2 1 : 1,22 → 1,30, réf. 1,34 ; score neutre).
- NON RÉSOLU : le regroupement réel varie (3826 LSA2 droite (1)(2,3)(4,5,6)(7), gauche (1)(2,3)(4,5)(6,7) ; 3603 LSA2 gauche
  (1)(2)(3,4)(5,6) ; 0063 LSA2 (6,7,8) ; 3826 LIT2 (4,5,6)(7)(8)). Un critère d'écart minimal entre arrêts consécutifs
  (fusion si |x_r − x_r+1| < δ) ne reproduit pas 3826 (rang 7 seul à 0,97 à droite mais fusionné à gauche avec des
  positions isolées identiques). Écart résiduel systématique +0,02 à +0,06 m (interpolation de l'enveloppe en section
  d'acier plutôt qu'en moment ? non testé).

### Étriers — diviseur de τ (essai négatif, non codé)
- τ = V / D avec D constant par passage : 3826 5,2542 ; 3603 4,0882 ; 0063 / OA26 5,3689 ; 3488 6,2150 ; 3639 3,2713.
  D / E_DALLE = 0,65619 ; 0,68740 ; 0,67120 ; 0,77319 ; 0,45659 → ≈ hauteur utile supérieure RETENUE non arrondie (3639 :
  0,457 imprimé, notre 0,478 ; autres +0,2 à +0,9 mm au-dessus de la hauteur provisoire arrondie). H − d = 0,0668 (φ1 32,
  φ4 10), 0,0626 (φ1 25), 0,0864 (3639, φ4 6) : ni enrobage + φ4/2 + max(φ1, φ2 + φ1/2), ni paquet de 3 barres
  (centre de gravité 0,79 φ ou 1,08 φ), ni 3 lits superposés ne conviennent. Levier ≈ 1 200 valeurs (colonne τ).

### Restent ouverts (résumé)
- Tableau « VERIFICATION DE L'OUVRAGE AUX SECTIONS LES PLUS SOLLICITEES » (≈ 35–50 valeurs par passage) non implémenté.
- Page « REPARTITION DES ARMATURES DE CISAILLEMENT … AUX ENVIRONS DES POINTS D'APPUI CONCENTRES » (DENCHA, cisaillement
  maximal par appui) absente — formules non recherchées.
- MAJCM des cartes = coefficient convois D/E quand ils dimensionnent (3826 2,211) : dépend du point ouvert des appareils.

## Session 2026-11-10 (v8) — étriers (espacement maximal, épure), constats τ et torsion des biais

### Bilan (passages 1971 seulement ; sauvegarde v7 : scratchpad psida_v7/)
- Réglage 1971 : 85,1 → 85,2 % ; contrôle 3608 : 82,5 % inchangé. Tous règlements : réglage 81,0 → 81,1 %, contrôle 75,9 % inchangé.
- Étriers 3639 : 32,3 → 51,8 % (seul passage 1971 où l'espacement maximal est < 0,40). Aucune section en recul.

### Étriers — RÈGLES retrouvées (ferraillage.js etriers ; crochets PSIDA_TAU40 = 1 / PSIDA_EP_SMAX = 1 : anciens modèles)
- Espacement maximal = min(0,40 ; At fe / (0,4 MPa × E DALLE)) avec **0,4 MPa = 400/9,81 = 40,775 t/m²** (et non 40) :
  3639 0,174 et 4015 0,289 exacts (40 t/m² donnait 0,178 / 0,295 ; rapport 1,0194 identique sur les deux).
- Épure retenue : **espacement de référence = plus grande valeur de la série de Renard R10 (0,40 ; 0,315 ; 0,25 ; 0,20 ;
  0,16 ; 0,125 ; 0,10 …) ≤ espacement maximal**, n = ⌈L / s⌉, espacement imprimé L / n. 3639 : 0,174 → 0,16 → 65 cours
  (10,25 m, 0,158) et 93 cours (14,80 m, 0,159) ✓ ; 4015 : 0,289 → 0,25 → 48 et 68 cours ✓ ; 3826 0,40 ✓.
- POIDS PARTIEL (ligne « NOMBRE DE COURS D'ETRIERS … POIDS PARTIEL ») non imprimé : longueur développée d'un étrier
  ℓ = poids / (n_cours × nI × aire φ4 × 7,85) = 1,475 (3826, ≈ 2(H − 0,06) + 15 φ4), 1,398 (4015, 2(H−0,06) + 11,7 φ4),
  0,967 (3639, = 2(H − 0,06) sans crochets) : règle non trouvée.
- 4015 (1960) : At imprimé 0,00191 = 19 groupes inférieurs, nous 21 (groupes inférieurs, non examiné).

### Étriers — diviseur de τ (constats complémentaires, NON RÉSOLU)
- D = V / τ = E DALLE × (H − c) avec c constant à ±0,05 mm pour un même jeu de diamètres, quelle que soit la géométrie :
  c = 0,0668 (φ1 32, φ2 16, φ3 12 ; φ4 10 OU 8 : 4015 identique à 0063, donc φ4 n'intervient pas) ; 0,06255 (φ1 25, φ2 16) ;
  0,0864 (3639 : φ1 32, φ2 14, φ3 10, φ4 6). La hauteur supérieure RETENUE imprimée est l'arrondi de H − c (4015 : 0,645,
  alors que la provisoire vaut 0,646 avec φ4 = 8 ; 3639 : 0,457).
- Essais négatifs : aucune combinaison linéaire ENROBS + Σ kᵢ φᵢ (kᵢ ∈ {0, ¼, ⅓, ½, ⅔, ¾, 1, 1¼, 1½, 2, √3/2, √3/6,
  0,7887, 1,077, √2/2}, φ1–φ4) ne colle aux trois jeux (écart > 0,4 mm). Pas de facteur constant b/E (1,0003 pour φ1 32,
  1,0007 pour φ1 25). Piste : 3639 est le seul passage dont les aciers transversaux supérieurs sur appui sont en φ1
  (PHI1 PHI2 ALT) — c dépendrait du diamètre transversal supérieur (inférieur retenu = H − ENROBI − φ2 − φ1/2 : lit
  transversal φ2 sous les fers longitudinaux) ; c − ENROBS − φt − φ1/2 = 4,8 / 4,05 / 8,4 mm (φt = 16 / 16 / 32) : non conclu.

### Ferraillage transversal des biais (page ELEMENTS DE CALCUL…) — constats
- **Contrainte de cisaillement par torsion τ = 6 Mtors / H²** (3608 : 10,116 × Mtors avec H = 0,77 ; 3603 : 10,667 avec
  H = 0,75) — exact ; non codé faute de Mtors.
- Moment de torsion : Mtors / M_long (identique ELS/ELU) = 0,10097 / 0,07627 (3603, φ 85, ψ 93,77 / 95,34), 0,06683 / 0,05056
  (3604, φ 90), 0,03329 / 0,02517 (3605, φ 95), 0,14272 / 0,11340 (3607, φ 85, ψ 91,35 / 93,38), 0,04710 / 0,03751 (3609).
  Angle β tel que ½ sin 2β = rapport : β / (100 − ψ) = 1,039 à 1,095 (croît avec la largeur et en travée 2) ; ni
  (M − My), ni (M + My), ni l'angle (ψ − φ), ni (100 − φ)·k (k = 1 − 0,5λ) ne conviennent. Moment de calcul
  = My + 1,126 Mtors (3608, ELS et ELU) : facteur non identifié.

## Session 2026-11-10 (v9) — torsion des biais (page ELEMENTS DE CALCUL DU FERRAILLAGE TRANSVERSAL), convois D/E en My

### Bilan (passages 1971 seulement ; sauvegarde v8 : scratchpad psida_v8/)
- Réglage 1971 : 85,2 → 85,5 % ; contrôle 3608 : 82,5 → 83,0 %. Tous règlements : réglage 81,1 → 81,4 %, contrôle 75,9 → 76,0 %.
- Sections (réglage / contrôle) : ferraillage transversal 56,2 → 64,3 % / 25,5 → 37,3 % ; flexion transversale 95,2 = (exactes
  à l'arrondi 96,3 → 96,4) / 92,9 → 93,2 %. Aucune section en recul.

### Torsion des ouvrages biais — RÈGLE retrouvée (ferraillage.js transversal ; exacte à l'arrondi sur 3603–3610, 24 valeurs × 3)
- Moments principaux : M1 = moment longitudinal principal pondéré (M max travée / E DALLE), direction à γ = 100 − ψ grades de
  l'axe (ψ biais mécanique) ; M2 = moment transversal principal pondéré (même état ELS/ELU, même ν).
- Tenseur dans le repère de l'axe : My = M1 sin²γ + M2 cos²γ ; Mxy = (M1 − M2) sin γ cos γ.
- **MOMENT DE TORSION DANS LE BETON T = Mxy sin φ + My cos φ** (φ biais géométrique : twisting sur la facette des fers
  parallèles aux lignes d'appui) ; **τ = 6 T / H²** (T/m²).
- **MOMEMT de calcul (pages EVALUATION DES SECTIONS) = (My + |T|) / sin² φ** — forme de Wood-Armer pour un réseau oblique
  (x, direction φ) : My/sin²φ + |Mxy + My cot φ|/sin φ. Le « facteur 1,126 » de 3608 n'est pas une constante : il découle
  de cette formule. A1, A2, AS, AU recalculés avec ce moment (φ = 100 : T = 0, moment = M2, inchangé).
- Résidus : 3603 T2 M2 2,33 au lieu de 2,32 (CP max ≈ 0,005, déjà connu) et moment 12,35/12,34 (arrondi à la limite).
- Essais négatifs (avant la règle) : T = M1·½ sin 2(100 − ψ) (−4 à −10 %), (M1 ± M2)·½ sin 2(100 − ψ), angle ψ − φ, T/M1 =
  tan(100 − ψ)/sin φ, moment = My + k T (k non constant) ; un ajustement My·a + T·b + T²/M1·c recollait à 0,006 (indice).

### Convois D/E dans My (compute.js momentsTransversaux)
- Constat : avec l'intégration continue de la LI et l'axe décalé de 0,375 m, l'écart CVOI.E fibre 1 était +0,6 % (W 10 m :
  3826/3827/3835) mais +2,0 % (W 11,3 m : 3607–3610) — le décalage requis différait (0,40 / 0,48), aucune largeur
  (3,30 + k(2 hchau + H)) ni modèle à 2 lignes de roues ne le résorbait.
- **La LI interpolée linéairement au pas IMPRIMÉ 0,500 m (origine bord d'extrados)** rend les deux familles cohérentes
  (même rapport à ±0,4 %) : le pic de la LI à la fibre est « raboté » quand l'axe n'est pas un nœud du pas 0,5 (W = 11,3).
- Retenu : bande 3,30 m, densité P/longueur, axe à ±0,425 m (calage ; écart max 0,27 % sur 3607, 3609, 3826, 3827, 3835 ;
  e = 0,50 m de la règle des 3,50 m donne −1,8 % uniforme ; largeur 3,20 m avec e = 0,50 : 0,57 %). Règle exacte non retrouvée.
  Crochets : PSIDA_CV_V8 = 1 (ancien modèle), PSIDA_CVOFF (décalage), PSIDA_CVPL (pas de la LI), PSIDA_CVWID (largeur).
- Le K longitudinal des convois (Guyon-Massonnet, axe ±0,50 m, moyenne continue) n'a pas été repris (piste : même pas 0,5).

### Étriers — diviseur de τ (toujours NON RÉSOLU, constats v9)
- D / E DALLE = hauteur utile SUPÉRIEURE RETENUE non arrondie ; pour 3826/0063/3488/3603 elle vaut ≈ H − ENROBS − φ2 − 0,65 φ1
  (écart ≤ 0,3 mm ; φ2 = fers transversaux supérieurs des zones d'appui), mais 3639 (0,457 imprimé, H − 0,0864) reste à 21 mm
  de cette forme (φ2 = 14) et à 3,6 mm même avec φt = φ1 = 32 (zones d'appui PHI1 PHI2 ALT). Ni la largeur b (D/d_prov = Eeq
  à 0,03 % sauf 3639 : 0,955 Eeq) ni φ4 n'expliquent 3639. Piste non testée : centre de gravité des fers longitudinaux
  supérieurs réellement en place sur appui (rangs de la gamme), qui ferait aussi la hauteur retenue de 3639.

### Non traités (budget)
- Appareils d'appui (dimensions, K convois D/E, Mc120 Na = 4) : inchangés.

## Session 2026-11-10 (v10) — vérification aux sections les plus sollicitées, dimensions des appareils

### Bilan (passages 1971 seulement ; sauvegarde v9 : scratchpad psida_v9/)
- Réglage 1971 : 85,5 → 85,8 % ; contrôle 3608 : 83,0 → 83,1 %. Tous règlements : réglage 81,4 → 81,6 %, contrôle 76,0 → 76,2 %.
- Sections (réglage / contrôle) : résumé / avant-métré 67,3 → 70,6 % / 66,8 → 68,7 % ; appareils d'appui 56,0 → 58,2 % / 50,9 = .
  Aucune section en recul.

### VERIFICATION DE L'OUVRAGE AUX SECTIONS LES PLUS SOLLICITEES (ferraillage.js verification, note.js résumé) — PARTIEL
- Tableau imprimé dans la page de résumé (avant l'AVANT-METRE) : colonnes TRAVEE1 APPUI2 TRAVEE2 … (2n − 1 sections, image miroir
  comprise) ; ELS : hauteur comprimée y, σb, σ's, σs ; ELU : déformations (‰) béton, acier comprimé, acier tendu.
- Constats exacts : moment = M ELS max de la travée (M min des deux travées contiguës sur appui) — σ proportionnelles au moment
  (3826 T1/T2 : 24637/24396 = 543,52/538,20) ; n = 15 (σs/σb redonne la hauteur utile retenue à 0,5 mm) ; aciers tendus = PREMIÈRE
  COLONNE DE LA GAMME couvrant le maximum de l'enveloppe, φ2 compris (3826 travée 45 φ32 + 6 φ16 = 0,037398 ; appui 73 φ32) ;
  largeur = largeur de calcul de la nappe tendue (W en travée, largeur supérieure sur appui) ; hauteur utile retenue.
- ELU = état-limite de la section réelle : pivot A (εs = 10,00) en travée, pivot B (εb = −3,50) sur appui (OA26 : pivot B en travée).
- NON RÉSOLU — aciers comprimés : la position déduite des rapports ELS σ's/σb vaut d' ≈ 0,0548 m (3603, 3488, OA26, 0063 et 3826 en
  travée ; 0,050 sur appui de 3826/0063 ; 3639 0,073 / 0,047) mais l'ELU en travée (pivot A) demande d' ≈ 0,046–0,049 : incohérent avec
  un acier unique. Section ajustée (ELS) ≈ 1,9 à 3,0 × la colonne 0 de la gamme opposée (fers de construction), non constante ; les
  fers présents dans NOTRE épure à l'abscisse du maximum (approximative) ne collent pas non plus. Retenu (sans calage) : colonne 0 de
  la gamme opposée à H − d_opposée ; ELU parabole-rectangle fbu = 0,85 fcj/1,5, moment autour des aciers tendus. ≈ 13 % des valeurs
  du tableau exactes (surtout 10,00 / −3,50) ; essais : d' = 0,0548 fixe (calé) moins bon ; fers de l'épure (−).
- Ligne « TASSEMENTS PRIS EN COMPTE » (sans nombre) non imprimée.

### Dimensions des appareils (ferraillage.js appareils ; crochet PSIDA_AP_V9 = 1 : ancienne règle)
- Règle retenue (constats v6) : largeur 0,25 ; 0,30 ; 0,35 … ; pour chaque largeur, longueur de « largeur » à « largeur + 0,25 » au
  pas de 0,05 ; premier couple d'aire ≥ R en charge max / COMPRENS. Reproduit 0,25 × 0,25…0,50, 0,30 × 0,45/0,50/0,55 (3604–3610,
  3639, 3488) et 0,35 × 0,50 (0,169). Exceptions connues : 3603 (biais 85 : 0,35 × 0,45 au lieu de 0,30 × 0,55), 3607 culée
  (0,30 × 0,30 au lieu de 0,25 × 0,35), OA26 (0,20 × 0,35), 3453 (0,30 × 0,40), 3452 (0,1608 → 0,35 × 0,50) : critère de
  rotation / biais probable, non identifié. SYMAP non traité ici.

### REPARTITION DES ARMATURES DE CISAILLEMENT … AUX ENVIRONS DES POINTS D'APPUI CONCENTRES — NON IMPLÉMENTÉE
- Contenu : DENCHA (3826 6,747 ; 0063 5,763 ; OA26 6,688 ; 3603 4,805 ; 3639 5,223 ; 3488 5,813 ; 3607 6,423), cisaillement maximal
  par appui, espacement des étriers (0,40 = espacement maximal quand le cisaillement est faible ; 3639 0,13 / 0,06).
- Essais négatifs : cisaillement ≠ R ELS par appareil × k, ≠ V ELU / k constant (3826 : 276,40/69,02 = 4,00 culée, 384,98/110,20 = 3,49
  pile), ≠ R ELU ligne / k ; rapport pile/culée 1,25–1,60 sans lien évident avec réactions ou V. 0063 et OA26 (même section) ont des
  DENCHA différents ⇒ dépend des charges/portées. La notice (PONT_DALLE_EN_BETON_ARME, p. 52–53 du listing commenté) ne donne que le
  tableau « distances au centre de l'appareil en fonction de l'espacement maximal des cours d'étriers ». Page non imprimée plutôt que
  d'imprimer un espacement non justifié.

### Non traités (budget)
- Regroupement des arrêts de barres ; hauteur utile du τ des étriers (piste : centre de gravité des fers sup. en place) : inchangés.

## Session 2026-11-11 (v11) — réactions (a1), appareils d'appui (constats), hauteurs utiles (constats)
Sauvegarde v10 : scratchpad psida_v10/. Réglage 1971 85,8 → 86,0 % ; contrôle 3608 83,1 = (aucune section du contrôle en recul).
Sections (réglage) : réactions 82,1 → 90,7 % ; résumé / avant-métré 70,6 → 72,9 % ; autres inchangées (ferraillage transversal 64,3 =,
appareils 58,2 =).

### Réactions d'appui : coefficient a1 (RÈGLE, compute.js liveEffects, kOne)
- La charge A des réactions (largeur totale, K = 1) inclut a1(classe, nombre de voies) : 3639 (classe 2, 2 voies) imprime
  96,3 / 49,6 = 0,900 × (LI × A(l) × a2 × Lch) ; 3603 (classe 2) : réactions 80,8 → 100 %. Classe 1 à 2 voies (3826…) : a1 = 1,
  inchangé. Crochet PSIDA_REAC_NOA1 = 1 : ancien calcul.

### Appareils d'appui — constats v11 (non codés)
- Épaisseurs / nombre de feuillets, efforts horizontaux (freinage, retrait, température), rotations admissibles, distorsion :
  AUCUN listing du corpus ne les imprime (grep FEUILLET/FREINAGE/DISTORSION : seul PSIDA-PSIDP_ocr.txt) ⇒ non mesurables, non
  reconstituables sur le corpus. Ils peuvent toutefois être le critère caché du choix des dimensions (voir ci-dessous).
- Trottoirs dans EN CHARGE : 3639 (Na 2, culée Mc120, pile Bc) et 3603 pile (Na 2, Bc) sont EXACTS (0,01) avec les trottoirs comptés
  UNE fois, 3826 (Na 4) avec deux fois ⇒ coefficient d'inégalité des trottoirs = Na/2 (chaque trottoir porté par l'appareil de rive).
  Codé derrière le crochet PSIDA_AP_TNA2 = 1 mais NON activé : appareils +0,6 pt, mais ferraillage transversal −0,3 pt (3639 : la
  section du chevêtre en fissuration préjudiciable n'est pas exacte, d ≈ H − 0,049 au lieu de H − 0,04 ⇒ zones d'appui de la page
  PROPOSE décalées) et résumé −0,4 pt ; à réactiver quand la section des chevêtres et δ sur culée seront résolus.
- Majoration dynamique sur appuis d'EXTRÉMITÉ (page « COEFFICIENTS DE MAJORATION DYNAMIQUE SUR APPUIS ») : appuis intermédiaires =
  max des deux travées contiguës (exact) ; culées : Bc 1,341 (3826, 3639), 1,342 (3603), 1,329 (0063), 1,320 (3488) ; Mc120 1,189 /
  1,217 / 1,193 / 1,177 / 1,166 (travée 1 : 1,178 / 1,217 / 1,186 / 1,154 / 1,132). Avec la formule F61 sur la travée 1 (même L) :
  G' (Mc120, S = 110) = 193 / 165 / 174 / 187 / 187 au lieu de G = 231 / 165 / 192 / 279 / 359 ; Bc : G'/S ≈ 0,40–0,46 — aucune loi
  simple (même L', G' = g L' et S(L') ne conviennent pas pour Bc et Mc à la fois). NON RÉSOLU ; c'est le levier principal restant des
  culées (3603 culée 100,70 exact avec Bc × 1,342 et trottoirs × 1).
- Chevêtres : la hauteur utile qui reproduit la section imprimée avec σs et n = 15 vaut H − 0,039/0,040 (φ1 32 / φ2 16 / φ4 10 :
  3488, 3826, 0063, OA26) mais H − 0,049 sur 3639 (φ 32/14/10/6, H 0,543) ; en fissuration peu préjudiciable (σs = 2/3 fe) H − d ≈
  0,007–0,025 variable ⇒ autre règle (ELU ?). NON RÉSOLU.
- Dimensions (biais 85, culée 0,30 × 0,30, OA26) : 3603 et 3607 ont le MÊME biais (85) ; 3607 (besoin 0,1507) prend 0,30 × 0,55,
  3603 (0,1565) prend 0,35 × 0,45 ⇒ aucune règle purement géométrique (rapport L/l fonction du biais) ne sépare les deux ; il faut
  un critère dépendant de l'effort (rotation / distorsion / épaisseur, non imprimés). Les dimensions de 3607–3610 dépendent en
  outre des K convois D/E (non résolus) : pas de gain possible sans eux.

### Étriers — diviseur de τ (constats v11)
- c = H − D/E_DALLE − ENROBS = 0,03681 (φ1 32, φ2 16 ; 3826, 0063, OA26, 3488), 0,03260 (φ1 25 ; 3603), 0,05641 (3639, φ1 32 / φ2 14) ;
  forme φ2 + φ1/2 + f·φ1 avec f = 0,15 / 0,164 / 0,825 : 3639 se comporte comme un 2e lit partiel. Un centre de gravité φ1 + φ2
  longitudinaux sur un même lit donne c < φ2 + φ1/2 (sens contraire). Non codé.
- Aciers comprimés du tableau de vérification, regroupement des arrêts de barres : non repris (budget).

## Session 2026-11-11 (v12) — épure d'arrêt des barres (enveloppe fine, regroupement des fers inférieurs), diagnostics
Sauvegarde v11 : scratchpad psida_v11/. Réglage 1971 86,0 → 86,7 % ; contrôle 3608 83,1 → 84,0 %. Tous règlements : réglage
81,8 → 82,3 %, contrôle 76,2 → 76,4 %. Sections (réglage / contrôle) : ferraillage longitudinal 69,3 → 73,9 % / 66,4 → 73,5 % ;
résumé / avant-métré 72,9 → 74,6 % / 68,7 → 69,5 % (poids) ; aucune section en recul.

### Diagnostic des lignes fausses (outil hors moteur : scratchpad diag/diag.js, catégories par type de ligne et colonne)
- Ferraillage longitudinal (8 382 valeurs) : enveloppes 92,8 %, gammes PHI1/PHI2/PHI3/OMEGA 100 %, hauteurs/largeurs 100 % (sauf
  3639 sup.), rangs/diamètres/nombres 100 % ⇒ TOUTES les erreurs sont des abscisses d'arrêt (origine, extrémité), donc des
  longueurs et des poids. Longueur imprimée = arrondi de (extrémité − origine) non arrondis (± 0,01 ; LSA/LIA : + L travée gauche) ;
  pas de crosse comptée dans la longueur des LIT (contrairement au listing commenté de la notice).
- Étriers (3 806 valeurs) : la colonne τ fait 772 erreurs sur 780 (V exact à 56 %, espacements exacts) ⇒ le seul levier est le
  diviseur de τ (cf. ci-dessous) ; le reste = poids partiel / DENCHA / page des appuis concentrés (non imprimés, absents).

### RÈGLES retrouvées (ferraillage.js epure, compute.js longitudinal ; crochet PSIDA_EPV11 = 1 : modèle v11)
- **Enveloppe interne sur 21 abscisses (pas 0,05 L)** : l'épure utilise des sections intermédiaires 0,15 ; 0,25 … 0,85 L calculées
  comme les sections imprimées (LI, CP, tassements, surcharges, combinaisons ; image miroir des travées pour un ouvrage symétrique),
  non imprimées (r.momentsFin, F.*.envF). Avec l'interpolation linéaire sur les 13 sections imprimées, les fers les plus courts
  (près du maximum) étaient trop courts de 0,05 à 0,12 m (enveloppe concave sous-estimée) : c'était l'« écart systématique
  +0,02 à +0,06 m » de v7. Crochet PSIDA_FIN = 0 : 13 sections.
- **Fers inférieurs de travée (LIT), tous rangs y compris 1–3** : arrêt théorique t_r = franchissement de Ω(r − 1) (colonne de la
  gamme, fers de construction compris) par l'enveloppe décalée de ± 0,8 H, SANS rampe d'ancrage ; puis regroupement côté par côté
  depuis le rang le plus bas : un groupe commence au rang s et englobe les rangs suivants tant que t_s − t_q ≤ ls (longueur de
  recouvrement imprimée) ; tous les fers du groupe s'arrêtent en t_s. Vérifié sur les enveloppes IMPRIMÉES (outil diag/theo.js) :
  3603 LIT1–4 (1,2,3)(4,5)(6,7)(8[,9]) ; 3826 LIT1 gauche (1,2,3,4)(5,6)(7)(8), droite (1,2,3)(4,5,6)(7)(8) ; 0063 LIT1 droite
  (1,2)(3,4,5)(6,7)(8,9), gauche (1,2,3,4)(5,6,7)(8,9) ; 3488 LIT1 droite (1,2)(3,4,5)(6,7)(8,9) ; 3639, OA26, 3827, 3452 idem
  (seule contradiction : 3452 LIT2, passage 1960). Bornes observées : inclus jusqu'à 0,98 ls, exclus dès 1,11 ls.
- Rangs 1–3 côté about (travée d'extrémité) : si l'arrêt du groupe tombe avant l'appui (t < 0), ancrage au bout de dalle
  (−(about − ENROBI) − 12 φ1, astérisque) ; les autres rangs du même groupe s'arrêtent en t_s (3826 LIT1 4 : −0,41 = t1).
- LIA 1–3 : rang par rang, de l'extrémité du LIT de même rang − ls à l'origine du LIT suivant + ls (3488 LIA2 3 : 12,75 / 4,75).
- Hors de la travée l'enveloppe inférieure est nulle (sinon 3607–3610 LIT3 non couverts).

### Essais négatifs / non résolus
- Fers supérieurs sur appuis (LSA) avec la même règle (PSIDA_LSA12 = 1) : groupes corrects ((1)(2,3)(4,5)(6,7,8)(9) sur 3488,
  (1)(2,3)(4,5,6)(7) sur 3826) et extrémités exactes SAUF le dernier groupe (fers les plus courts, souvent le fer « au mieux » en φ2),
  imprimé plus long que t_s : 3488 rang 9 1,61 au lieu de 0,75 ; 3826 (7) 0,97 / 0,74 et (6,7) 1,39 / 1,27 ; 3603 (6) 1,51 / 1,09 ;
  3639 (7) 1,35 / 0,61 — ni ls, ni 0,8 H, ni longueur minimale constante (2,36 / 2,79 / 3,55 / 3,22). Score −0,2 pt ⇒ non activé,
  les LSA gardent les groupes à rampes de v7 (qui profitent quand même de l'enveloppe fine : LSA 26,7 → 45,5 %).
- Seuil de regroupement 40 φ1 (PSIDA_GTH = 40) ou 1,05 ls (PSIDA_GTL) : −0,1 à −0,2 pt ; seuil = ls retenu (constante imprimée).
- Rampes de longueur ls nulle pour les LSA (PSIDA_LSR = 0) : −0,2 pt.
- Rang 1 des LIT côté appui intermédiaire : imprimé ENTRE l'arrêt obtenu par interpolation des sections (13 points) et celui des
  moments / 21 points (0063 LIT2 1,63 entre 1,41 et 1,86 ; 3488 2,17 entre 1,87 et 2,45) ⇒ provoque des regroupements (1,2,3) au lieu
  de (1,2)(3,4,5) (0063, 3488). Non résolu (zone où l'enveloppe positive s'annule : ELS/ELU, valeur nulle tronquée ?).
- Diviseur de τ (étriers) : D/Eeq = hauteur utile non arrondie H − ENROBS − c' avec c' = 0,03671 (φ1 32, φ2 16 : 3826, 0063, OA26,
  3488, 4015 avec φ4 8, 3452), 0,03253 (φ1 25), 0,05636 (3639, φ2 14, φ3 10, aciers transversaux d'appui en φ1). b = D/d_retenue
  vaut Eeq + 0,002 à 0,004 m, dans le bruit de l'arrondi de d ⇒ b = Eeq. Forme c' ≈ 0,6 φ1 + 0,0175 sur les deux premiers jeux, 3639
  à +20 mm : non conclu, non codé (levier ≈ 770 valeurs, ≈ 1,2 pt).
- Crochets de diagnostic ajoutés : PSIDA_ENV (enveloppes imposées, p. ex. celles du listing), PSIDA_DUMP (arrêts théoriques LSA),
  PSIDA_LSR, PSIDA_GTH / PSIDA_GTL, PSIDA_LSA12, PSIDA_FIN, PSIDA_EPV11.

## Session 2026-11-11 (v13) — chevêtres (ELU en fissuration peu préjudiciable, × sin φ), trottoirs Na/2, mention TB
Sauvegarde v12 : scratchpad psida_v12/. Réglage 1971 86,7 → 86,9 % (57 424 → 57 547 valeurs exactes) ; contrôle 3608 84,0 =
(5 689 = ; aucune valeur du contrôle perdue). Tous règlements : réglage 82,3 → 82,5 %, contrôle 76,4 =. Sections (réglage) :
ferraillage transversal 64,3 → 68,9 % ; appareils d'appui 58,2 → 59,5 % ; résumé / avant-métré 74,6 → 74,2 % (dimensions des
appareils recopiées dans le résumé, voir ci-dessous) ; autres inchangées. Outils hors moteur : scratchpad v13/ (cnt.js : comptes exacts
réglage/contrôle par section ; ap.js, dims.js : chevêtres et appareils ; dyn.js : δ sur culées ; sd.js : hauteur utile des chevêtres).

### Section de calcul des chevêtres (ferraillage.js appareils ; crochet PSIDA_CHV12 = 1 : calcul v12)
- **Section imprimée « EN M**2 PAR ML LONGITUDINAL » = section par mètre perpendiculaire × sin φ** (φ biais géométrique) :
  3603/3604/3605/3606 (φ 85/90/95/100, même moment pile 28,13) impriment 0,001215/1234/1246/1250 = 0,001250 × sin φ (0,97237 ;
  0,98769 ; 0,99692) ; cohérent avec l'espacement mesuré suivant l'axe longitudinal.
- **Fissuration peu préjudiciable : section à l'ELU** (et non à l'ELS avec σs = 2/3 fe) : réaction ELU par appareil
  = [1,35 G·K_CP + max(1,5975/1,2 × (1,2 A|1,2 Bc|1,2 Bt)·K ; 1,35 × C·K) + 1,5975 × trottoirs] / Na (combinaison
  1,125[1,2G + 1,42(A|B|Tr) | 1,2 C]), moment = R_u esp / (12 largeur), parabole-rectangle, d = H − 0,04, b = 1. Piles de 3603–3606
  exactes à 1e-6 (0,001250 / 0,001306 sur 3606). Constat : la hauteur utile apparente en ELS était H − 0,026 (pile) / H − 0,028
  (culée), incohérente : c'était l'effet du rapport ELU/ELS (1,331 sur les surcharges, 1,35 sur G).
- Fissuration préjudiciable (ELS, σs, d = H − 0,04) inchangée : exacte sur 3488 / 0063 ; 3639 demande toujours d = H − 0,049.
- Conséquence : les espacements des zones 1G/1D du ferraillage transversal proposé (aire / section du chevêtre, tronqués à 0,005)
  sont exacts sur les piles de 3603–3606 (0,165 ; 0,160 ; 0,155…).

### Trottoirs dans la réaction par appareil : facteur Na/2 (crochet PSIDA_AP_TNA2 = 0 : ancien facteur 2) — ACTIVÉ
- Avec la section des chevêtres ci-dessus, le facteur Na/2 de v11 ne fait plus baisser le ferraillage transversal : EN CHARGE (MAX.)
  des piles exact sur 3488 (Na 4), 3603–3606, 3639, 0063 (Na 4), moments des chevêtres de pile exacts (3603 28,12 / 29,35 ;
  3639 18,13 / 26,75 culée comprise). Gain net +5 valeurs ; le résumé perd 13 valeurs : dimensions des appareils de 3604–3606
  (R = 224,99 au lieu de 225,00 ⇒ besoin 0,149993 m² ≤ 0,30 × 0,50 ; le listing, avec R ≥ 225,00, prend 0,30 × 0,55 : écart
  d'arrondi de la réaction, non corrigé), 3607–3610 et 3826 (réactions encore fausses : convois D/E, 3826 −33 t non expliqué ;
  justes auparavant par compensation).

### Ferraillage transversal proposé : aciers inférieurs de travée « TB » (crochet PSIDA_TB = 0 : sans mention)
- Constat : en fissuration peu préjudiciable, les aciers INFÉRIEURS de travée sont tête-bêche sur 8/8 passages (3603–3610, notice
  O001 aussi), jamais en fissuration préjudiciable (3488, 0063, 3826, OA26, 3639). Codé : mention TB ; la ligne redevient comparable
  (espacement, nombre, plage, poids φ3 exacts quand la plage l'est) : +80 valeurs.
- NON RÉSOLU — longueur TB : 3,97 / 3,94 / 3,91 / 3,91 (E1 4,50 ; φ 85/90/95/100), 6,19 / 6,14 / 6,11 / 6,09 (E1 7,00), notice
  6,82 (E1 7,60, φ 80) ; rapport à la longueur pleine (E1 − 0,06)/sin φ = 0,881 / 0,878 (φ 100) → 0,869 / 0,867 (φ 85) → 0,859 (φ 80),
  ≈ 0,88 √sin φ (ajustement, non retenu) ; 7/8 × pleine (coupure à b'/4 du bord) donne 3,885 / 6,07 (−0,02) et 6,95 sur la notice
  (+0,13) : non. On imprime la longueur pleine (poids φ2 de travée faux sur ces passages).
- NON RÉSOLU — TB en face SUPÉRIEURE (φ3 de travée, 6,31 / 9,09 / 9,00) : 3603 (φ 85), 3607 (85), 3608 (90) mais pas 3604 (90) ni
  3609/3610 : critère inconnu (largeur + biais ?) ; 3603/3607/3608 zone 2D : inférieur TB aussi.
- Zone 2D des culées en FPP : 3604 imprime 0,445 alors que Amin(T1) = 0,000454 donne 0,4429 → 0,440 (troncature, règle des autres
  zones) ; 3603 0,315 (aire φ2 / A ⇒ A ≈ 6,38e-4, Amin 6,52e-4) : section de la zone 2 des culées non identifiée.

### Majoration dynamique sur culées (constat v13, NON RÉSOLU, levier des zones 1G/1D de culée)
- En résolvant δ = 1 + 0,4/(1+0,2L') + 0,6/(1+4 g L'/S(L')) pour la longueur L' : Bc culée ⇒ L' = 3,67 / 3,62 / 3,49 / 3,42 / 3,65
  (3488, 3603, 3639, 3826, 0063 ; S = 2 essieux de 12 t × bc × nfiles) — presque constant, ≈ longueur d'un camion Bc sans les essieux
  avant (4,5 m) ? non conclu ; Mc120 ⇒ L' = 13,12 / 12,41 / 10,24 / 11,58 / 12,56 (= L1 seulement sur 3639). Aucune loi commune.

### Fers de construction LST / LIA (constat v13)
- Rangs ≥ 4 : LST_j = copie du LIT_j et LIA_j = copie du LSA_j (exact sur 0063, 3604 rangs 5–8) ⇒ leurs erreurs sont héritées des
  arrêts LIT/LSA (regroupements). Exception 3604 : LIA2 4 commence en 9,85 (LSA2 4 en 9,37, groupe (3,4)) et LST1 4 s'arrête en
  9,84 (LIT1 4 en 10,31) : les fers de construction du rang 4 suivent l'arrêt PROPRE du rang 4 des LSA, avant regroupement — même
  piste que le dernier groupe des LSA (v12), non codée.
- Hauteur utile du τ des étriers, dernier groupe des LSA : non repris (budget).

## Session 2026-11-11 (v14) — LI en simple précision (règle PSIDP v16 adaptée), essais LSA
Sauvegarde v13 : scratchpad psida_v13/. Réglage 1971 86,869 → 86,891 % (57 547 → 57 562 valeurs exactes) ; contrôle 3608 84,020 →
84,050 % (5 689 → 5 691). Tous règlements : 82,5 / 76,4 % inchangés à 0,1 près. Outils hors moteur : scratchpad v14/ (cnt.js : comptes
exacts + valeurs fausses par section ; dg.sh : diag.js avec crochets PSIDA_* d'environnement ; bench.js : banc des coefficients des LI
sur appuis en REAL*4 ; dump.js : arrêts théoriques des LSA).

### Classement initial des valeurs fausses (réglage 1971, 8 699)
ferraillage longitudinal 2 186 (abscisses d'arrêt / longueurs LIT, LST, LIA, LSA) ; étriers 1 421 (colonne τ 1 113) ; résumé /
avant-métré 1 027 (LST recopiés, gammes) ; ferraillage transversal 827 ; moments longitudinaux 588 ; LI travées 523 ; appareils 461 ;
positions 430 ; flexion transversale 329 ; bordereau 227 ; déformations 206 ; réactions 68 ; LI V et R 91 ; LI appuis 29.

### RÈGLE — LI des moments sur appuis en REAL*4 (compute.js supportLISP ; crochet PSIDA_LISP, défaut 5)
- Les coefficients imprimés des LI sur appuis ne sont pas la valeur exacte arrondie (3603 : exact 1,9720024, imprimé 1,972003 ;
  0063 : 9,000001, aires 14,063 / 3,937 pour 14,0625 / 3,9375) ⇒ calcul REAL*4. Variante retrouvée (banc v14/bench.js, 12 passages
  1971, 276 coefficients) : pour chaque travée chargée s et chaque terme A, C, résolution du système des trois moments
  (2(L_k+L_k+1), L_k, L_k+1) par Gauss SANS pivot (Math.fround à chaque opération) avec le second membre l²·c (c = [1,0,−1] à l'appui
  droit, [−1,3,−2] à l'appui gauche, une résolution par appui, cumul), puis B = −(A + C) : 261/276 (double 239 ; inverse de la
  matrice comme PSIDP v16 : 235 ; Thomas 216–227 ; second membre combiné 243–250 ; B = 3·M(l²) : 254). Restent faux : B de la travée
  dont l'appui gauche est l'appui étudié (3603 17,008520 / 17,008522, 1 ulp).
- Portée : impression des LI sur appuis (LISP = 1 : 29 → 21 faux) et des LI d'efforts tranchants / réactions construites en REAL*4
  à partir de ces coefficients (V = (M_k+1 − M_k)/L, sommes arrondies ; LISP = 5 : LI V et R 91 → 84 faux). Les calculs (aires,
  moments, enveloppes) restent en double. Essais NÉGATIFS : LI des moments en travée imprimées à partir de la base REAL*4 (LISP = 2 :
  LI travées 523 → 797 faux ; LISP = 4, combinaison (1−a)·M_i + a·M_i+1 en REAL*4 : 942) ; tout le calcul en REAL*4 (LISP = 3 :
  très lent, abandonné) ; fround de la valeur exacte (LISP = −1 / −2) : nul / −34. Les 523 valeurs fausses des LI travées sont
  presque toutes à 1 unité du dernier chiffre (REAL*4) mais l'ordre des opérations SETRA pour les sections en travée n'est pas trouvé.
- PSIDP v16 « réactions Bt avec min(2, nv) tandems » : DÉJÀ en place dans PSIDA (compute.js liveEffects, ntMax) ; les 68 réactions
  fausses sont les convois D/E (3607–3610) et Bc de 3826 (non résolus, inchangés). Effort normal sur section nette : sans objet (BA).

### Dernier groupe des LSA (constats v14, NON RÉSOLU)
- Origine et extrémité d'un LSA sont regroupées indépendamment de chaque côté de l'appui (3826 LSA2 : à droite (2,3)(4,5,6)(7), à
  gauche (2,3)(4,5)(6,7)) ; tous les groupes sauf le dernier sont exacts avec t_r sans rampe et le seuil ls (règle LIT v12).
- Dernier groupe : imprimé − t_s = +0,23 (3826 droite, rang 7 φ1), +0,12 (3826 gauche, groupe (6,7)), +0,86 (3488 rang 9 φ2),
  +0,42 (3603) ; essais sur le papier : fin du groupe précédent − ls (3826 1,18 au lieu de 0,97), t_s + ls(φ) (3488 1,36 au lieu de
  1,61), point à 0,05 L + 0,8 H : aucun ne convient. 3639 a en plus un décalage systématique +0,08 à +0,17 sur TOUS les groupes
  (hauteur des fers supérieurs, connu). Non codé.
- Longueur TB, TB en face supérieure, δ sur culées : pas d'idée nouvelle, non repris (budget).

## Session 2026-11-11 (v15) — convois D/E : règles PSIDP v29 (positions, symétrie, K), My, coefficients d'inégalité
Sauvegarde v14 : scratchpad psida_v14/. Bancs hors moteur : scratchpad v15/ (my.js : C des lignes CVOI des moments transversaux
listing / moteur selon les crochets ; kcv.js : K convois depuis les LI imprimées ; ap.js + kin.js : coefficient d'inégalité des
convois en poutre infinie avec les appuis réels).
### Bilan (passages 1971 seulement ; cnt.js v14 : valeurs exactes)
- Réglage 1971 : 86,891 → **87,092 %** (57 562 → 57 695) ; contrôle 3608 : 84,050 → **84,685 %** (5 691 → 5 734). compare.js : 86,9 → 87,1 /
  84,0 → 84,7 ; tous règlements 82,5 → 82,7 / 76,4 → 76,5. Roundtrip 19/19 inchangé.
- Sections (KO réglage / contrôle) : positions des surcharges 430 → 391 / 22 → 9 ; réactions 68 → 38 / 15 → 5 ; efforts tranchants
  42 → 33 / 7 → 4 ; moments longitudinaux 588 → 569 / 146 → 141 ; résumé 1 027 → 1 003 / 113 → 105 ; ferraillage longitudinal
  2 186 → 2 174 / 221 → 217. Aucune section en recul. 3607 : 83,9 → 84,6 % ; 3608 : 84,0 → 84,7 %.
### RÈGLE 1 — positions longitudinales des convois D/E (compute.js vehicleScan, paramètre nearGap ; crochet PSIDA_CVNEAR = 0 : ancien)
- Remorque avant (abscisse la plus grande, imprimée en premier) sur la grille (pas L/20 + prolongements + abouts) ; remorque arrière
  au point de grille le PLUS PROCHE de s1 − 19 m (D) / s1 − 33 m (E), une seule paire par s1, admise si elle touche l'ouvrage.
  Vérifié : 3607 CVOI.E 47,20 / 13,90 (Δ 33,30 ; ancien 49,00 / 13,90), 31,90 / −1,30 (ancien −1,95), CVOI.D 17,50 / −1,30.
  Les réactions et efforts tranchants D/E de 3607–3610 deviennent exacts (les « ±5 % » attribués à l'about en v7 venaient de là).
- Reste 1 position : 3607 CVOI.D 19,30 / 0,00 imprimé, 20,20 / 1,30 calculé (deux paires admissibles de valeurs voisines).
### RÈGLE 2 — symétrie : déjà en place dans PSIDA (moments et réactions de la seconde moitié = image miroir, compute.js longitudinal /
  shearsAndReactions, ouvrage à travées symétriques) ; indispensable avec la règle 1 (recherche orientée). Rien à changer.
### RÈGLE 3 — K des convois D/E (compute.js Guyon, crochet PSIDA_CVK : 1 défaut = bords de la largeur roulable, 2 = largeur
  chargeable (identiques sur le corpus, EGAU = EDROI = 0), 0 = ancien axe ±0,50 ; PSIDA_CVKC = 1 : LI continue au lieu de la LI
  interpolée au pas 0,125)
- Axe libre dans [bord + 3,50 ; bord opposé − 3,50], maximum. Gain +4 valeurs (moments) : le calage ±0,50 était le même point.
- Résidus ±0,001–0,002 inchangés et de SENS OPPOSÉS (3607 : 1,011 calculé / 1,012 imprimé ; 3826 : 1,021 / 1,019) ; essais sur les LI
  imprimées (kcv.js) : moyenne continue, trapèzes sur nœuds, nœuds seuls, largeur 3,25 — aucune ne recolle les deux familles. NON RÉSOLU
  (même résidu dans PSIDP v29).
### Moments transversaux My des convois — le calage ±0,425 N'A PAS pu être remplacé (crochet d'essai PSIDA_CVMY, défaut 0 = calage)
- Les lignes concernées sont à la fibre de l'axe (la plus sollicitée) : un axe libre (règle 3, CVMY = 1) centre le convoi ⇒ +3,6 %
  (3607) / +5,0 % (3826) ; positions extrêmes ±(Lr/2 − 3,5) = ±0,50 (CVMY = 2) ⇒ −1,8 % uniforme ; scores CVMY 1/2 : réglage
  86,91 %, ferraillage transversal −120 valeurs ⇒ rejetés.
- CVMY = 3 (bord gauche du convoi sur la grille 0,125 depuis le bord d'extrados, positions extrêmes admissibles : décalages −0,475 /
  +0,400) : avec la LI au pas 0,125 → 3826/3827/3835 exacts à 0,1–0,3 % mais 3607–3610 à −1,0 % ; au pas 0,5 → −2,4 % / +0,7 %.
  CVMY = 4 (toutes positions de grille) : +3,6 / +5,1 %. Largeur 3,30 × sin(biais) : écartée (3607/3609/3610, biais 85/95/100, ont
  le même rapport ⇒ le biais n'intervient pas). Balayage largeur × pas de LI à e = 0,50 : aucune combinaison uniforme (3,20 / pas 0,25 :
  +1,2 % sur 3607, ±0,1 % sur 3826). La différence entre familles (W 11,3 / 10) reste inexpliquée : le calage ±0,425 (pas 0,5) est
  conservé (écart ≤ 0,27 %).
### Coefficients d'inégalité des convois D/E (bancs kin.js) — NON RÉSOLU, 1,000 conservé
- Règle 3 transposée (bande 3,30, axe libre dans ±(Lr/2 − 3,5), appuis réels y_k = (k − (Na−1)/2)·s, poutre infinie η) : culée Na 3
  2,457 / 2,275 imprimé, pile Na 4 2,537 / 2,393, 3826 2,421 / 2,211. Bande 3,60 libre : pile 3607–3610 exacte à 0,003 (2,396 / 2,393)
  mais culée 2,371 / 2,275 et 3826 2,263 / 2,211. Positions extrêmes seules (±e) avec 3,30 : culée 2,354. Aucun modèle ne reproduit
  les trois familles ; pas codé.
### Majoration dynamique sur culées : aucune des trois règles ne s'y applique (δ convois = 1 imprimé) ; pas d'idée nouvelle, non repris.
### Crochets ajoutés (v15) : PSIDA_CVNEAR, PSIDA_CVK, PSIDA_CVKC, PSIDA_CVMY (essai, 0 par défaut).

## Session v16 (2026-11-11) — K des trottoirs et de A : règles PSIDP v30 transférées
Sauvegarde v15 : scratchpad psida_v15/. Scores « 1971 seulement » : réglage **87.1 → 87.4 %**, contrôle 3608 **84.7 → 86.0 %**
(tous passages 1971 86.9 → 87.2) ; aller-retour 19/19.
### RÈGLE (PSIDP v30) codée, ACTIVE, crochet PSIDA_KTROT = 1 (0 = ancienne moyenne exacte de la LI continue)
K des trottoirs : LI interpolée linéairement entre les nœuds de la grille 0.125 m (depuis le bord gauche d'extrados), bord intérieur
EXACT, bord extérieur = dernier nœud floor(W/h) (à droite) / nœud 0 (à gauche) ; la moyenne des deux trottoirs reste (tg + td)/2.
Sections (réglage, % identiques) : Guyon-Massonnet K 97.8 → 98.1, moments longitudinaux 90.5 → 92.3, efforts tranchants 94.4 → 94.6,
ferraillage transversal 68.9 → 69.1, étriers 62.7 → 64.0 ; contrôle : K 96.1 → 97.1, moments 75.3 → 84.3, étriers 56.9 → 63.7.
Remarque : la colonne « % ±1 » baisse légèrement sur les moments (95.1 → 94.6) et K (99.4 → 99.2) au réglage.
### RÈGLE (PSIDP v30) codée, ACTIVE, crochet PSIDA_KAMODE = 3 (0 = fenêtre unique) : K de A = moyenne des K des voies une à une
(bornes de chaque voie arrondies à la grille). Rapport identique au caractère près sur le corpus PSIDA (aucune voie hors grille) :
gardée par cohérence avec PSIDP.

## Session v17 (2026-11-11) — hauteur utile du cisaillement des étriers, intégration des chenilles / convois par morceaux
Sauvegarde v16 : scratchpad psida_v16/. Outils hors moteur : scratchpad v17/ (tau.js : intervalle de c' = H − ENROBS − V/(τ·Eeq) tiré des
couples (V, τ) imprimés, par passage ; lit1.js : arrêts du rang 1 des LIT listing / moteur). Comptes exacts (v14/cnt.js) :
réglage 1971 57 882 → **58 866 / 66 246 (87,37 → 88,86 %)** ; contrôle 3608 5 822 → **5 927 / 6 771 (85,98 → 87,54 %)**. compare.js :
87,4 → 88,9 % / 86,0 → 87,5 % ; tous passages 1971 88,7 % ; tous règlements 82,9 → 84,1 % / 76,9 → 77,3 %. Aller-retour 19/19.
Classement initial des valeurs fausses (réglage) : ferraillage longitudinal 2 168 ; étriers 1 372 ; résumé 1 003 ; ferraillage transversal
822 ; LI travées 523 ; moments 463 ; appareils 461 ; positions 391 ; flexion transversale 329 ; bordereau 227.
Sections (KO réglage / contrôle) : étriers 1 372 → 466 / 139 → 49 ; efforts tranchants 32 → 3 / 4 → 1 ; réactions 38 → 22 / 5 → 1 ;
résumé 1 003 → 973 / 105 → 99 ; ferraillage longitudinal 2 168 → 2 153 / 215 → 210 ; moments 463 → 475 / 90 → 93 (voir RÈGLE 2).

### RÈGLE 1 — hauteur utile du cisaillement τ des étriers (ferraillage.js etriers ; crochet PSIDA_TAUD = 0 : d_sup arrondi)
- τ = V / (Eeq · d), **d = H − ENROBS − (φ2 + φ1/2) − 0,1 (φ1 + φ2), non arrondi**. Mesure (tau.js, intersection des intervalles
  (V ± 0,005)/(τ ∓ 0,005) sur toutes les lignes) : c' = H − ENROBS − d ∈ [0,03679 ; 0,03680] pour φ1 32 / φ2 16 (0063, 3452, 3453,
  3488, 3637, 3826, 3827, 3835, 4015, OA26 — H de 0,723 à 0,84, de 0 à 91 fers en place, ESPAC1 0,290–0,320, φ4 10 ou 8) et
  [0,03259 ; 0,03261] pour φ1 25 / φ2 16 (3603–3610) ⇒ c' ne dépend NI de la nappe réellement en place (nombre de rangs, centre de
  gravité : écarté, c' identique à 1e-5 m avec 0 et 91 fers), NI de φ4, NI de la géométrie : seulement des diamètres. Les deux familles
  imposent c' = 0,6 φ1 + 1,1 φ2 (pente 0,600 ± 0,002 en φ1) = (φ2 + φ1/2) + 0,1 (φ1 + φ2) — lecture possible : encombrement des HA
  majoré de 10 %. Loi empirique (2 familles de diamètres seulement), non contredite par le contrôle 3608.
- 3639 (φ1 32, φ2 14, φ3 10, φ4 6) : c' = 0,05640 (formule : 0,0346) — NON EXPLIQUÉ ; c'est la même anomalie que la hauteur
  supérieure retenue imprimée 0,457 (aucune combinaison linéaire des φ ne relie les trois familles).
- Essai NÉGATIF : utiliser ce d non arrondi aussi pour les enveloppes du ferraillage longitudinal (crochet PSIDA_DSU = 1) : −54 valeurs
  (les enveloppes utilisent bien la hauteur arrondie au mm).

### RÈGLE 2 — chenilles Mc120 (et convois D/E) intégrées par morceaux entre appuis (compute.js vehVal, ax.dist)
- Constat OA26 (1 travée) : V à droite (−114,70 calculé) / V à gauche (116,29 exact) = 0,98634, SETRA 0,98774 = rapport EXACT des
  intégrales continues (4,8000 / 4,8597). Le point milieu global à 400 points perdait la cellule à cheval sur l'appui (son point tombe
  au-delà du saut de la LI d'effort tranchant : 0,0068 m de chenille comptés à 0). Désormais la charge répartie est découpée aux
  abscisses des appuis et chaque morceau intégré au point milieu (≈ 400 points au total). Efforts tranchants exacts (0063 419,90,
  OA26 353,90…), d'où V et τ des étriers. Crochet PSIDA_MCOLD = 1 : ancien calcul ; PSIDA_MCN : nombre de points global (diagnostic).
- Convois D/E : même découpage avec ≈ 400 points (au lieu de 40) ; crochet PSIDA_CVDIST = 0 : 40 points globaux ; PSIDA_CVDIST = n :
  n points ; PSIDA_CVJ = 1 : découpage seulement pour les LI à saut (V, réactions). Bilan : 400 découpé +36 / +8 (réactions +16, résumé
  +30, mais moments −13 / −3) ; 40 découpé +10 / +2 ; CVJ +34 / +6 (moments 462). Retenu : 400 découpé partout (règle uniforme, meilleur
  total). Les moments convois préfèrent l'ancien point milieu à 40 points : résidu à comprendre (discrétisation SETRA de la remorque ?).

### Constats / non résolus (v17)
- V des étriers 3607/3609/3610 (26 valeurs chacun) : V ELU min côté gauche de la travée 1 = 73,51 calculé, 73,48 déduit du listing
  (pente de la droite) ⇒ CVOI.E −19,61 au lieu de ≈ −19,63 : position de la remorque arrière (règle v15), pas l'intégration.
- V des étriers 3639 (53 valeurs) : extrémités 215,707 / 315,478 contre 215,70 / 315,46 (Mc120 côté droit 0,012 % trop fort) — non résolu.
- Rang 1 (groupe 1-2-3) des LIT, extrémité côté appui intermédiaire des travées de rive : imprimé plus loin que le nôtre de 0,05 à
  0,25 m (3604 11,70 / 11,56 ; 3639 9,18 / 9,04 ; 0063 13,37 / 13,12 ; 3488 15,33 / 15,15). L'abscisse théorique SETRA (− 0,8 H) vaut
  0,838–0,864 L, AU-DELÀ de 0,85 L où notre enveloppe (0,001644 sur 3604) est déjà < Ω(0) (0,002149) : il faudrait un moment ELU à 0,85 L
  ≈ 30 % plus fort que le nôtre (≈ 64 au lieu de 48,9 t·m) ; ni l'interpolation en moment, ni une parabole, ni le zéro du moment ELS
  (11,66) ne conviennent. Piste : moments des sections internes 0,85 / 0,90 L près du changement de signe (cas de charge, ELU).
- LI travées (523, 1 ulp), positions (391), appareils (461) : non repris (pas d'idée nouvelle).

## Session v18 (2026-11-11) — épure d'arrêt des barres : dernier groupe des LSA et des LIT à rampes, seuil du rang 1 des LIT
Sauvegarde v17 : scratchpad psida_v17/. Outils hors moteur : scratchpad v18/ (lsa.js : barres imprimées / moteur par type LIT, LSA, LST,
LIA avec crochets PSIDA_* d'environnement ; need.js : enveloppe requise au point d'arrêt du rang 1 des LIT). Comptes exacts (v14/cnt.js) :
réglage 1971 58 866 → **59 130 / 66 246 (88,86 → 89,26 %)** ; contrôle 3608 5 927 → **5 950 / 6 771 (87,54 → 87,88 %)**. compare.js :
88,9 → 89,3 % / 87,5 → 87,9 %. Aller-retour 19/19. Sections (KO réglage / contrôle) : ferraillage longitudinal 2 153 → 1 915 / 210 → 190 ;
résumé / avant-métré 973 → 947 / 99 → 96 ; aucune autre section ne bouge. Contributions (ablation, mesurées avec PSIDA_CMID encore actif, réglage / contrôle) :
dernier groupe LSA +223 / +26 ; rang 1 des LIT +107 / +12 ; dernier groupe LIT +28 / +2 ; désactiver PSIDA_CMID : +24 / +7.

### RÈGLE 1 — LSA : regroupement v12 + dernier groupe à rampes (ferraillage.js epure ; PSIDA_LSA12 = 0 : groupes à rampes v7 ; PSIDA_LSAL)
- Les arrêts théoriques t_r (sans rampe) et le regroupement par ls (règle LIT v12) sont désormais appliqués aux LSA, de chaque côté de
  l'appui indépendamment. Le DERNIER groupe (rangs les plus élevés, fers les plus courts) est ensuite placé par l'épure à rampes de v7
  (fer pleinement efficace à ls de son extrémité, rangs inférieurs supposés pleinement efficaces), sa position étant max(t_s, rampe).
  Exact : 3826 LSA2 droite (7) 0,97 et gauche (6,7) 1,39 ; 3603 LSA2 droite (6) 1,51, gauche (5,6) 2,04 ; LSA3 (6,7) 1,47 ; 0063 (6,7,8)
  1,71 (= t_s, la rampe ne mord pas) ; 3607. Reste 3488 rang 9 (φ2 = 16) 1,59 au lieu de 1,61 ; 3639 (décalage systématique connu).
- Variantes NÉGATIVES : rampe du seul dernier rang (PSIDA_LSAL = 2, −200) ; rampe de longueur ls(φ2) quand le dernier fer est en φ2
  (PSIDA_LSALR = 1, −61). Pistes de la consigne écartées par les données : longueur minimale L/5 – L/4 (0,97 m imprimé sur une travée de 16 m),
  zéro du moment sur appui + ls (≈ 2 m).

### RÈGLE 2 — LIT : dernier groupe (rangs les plus élevés, près du maximum) à rampes (crochet PSIDA_LITL = 0 : t_s)
- Même traitement que les LSA, des deux côtés du maximum : 3826 LIT1 8 3,58 / 6,88 (imprimé 3,55 / 6,88 ; avant 3,83 / 6,52) ; 3488, 0063.

### RÈGLE 3 (empirique) — seuil du rang 1 des LIT (groupe 1-2-3) : enveloppe « adoucie » aux sections internes (PSIDA_R1AVG, défaut 0,4)
- Le rang 1 (seuil Ω0 = fers de construction) s'arrête côté appui intermédiaire ENTRE l'arrêt calculé sur l'enveloppe à 21 sections et
  celui obtenu avec les 13 sections imprimées (constat v12) : la moyenne des deux arrêts donne 3604 11,68 (imprimé 11,70), 0063 13,36 (13,37),
  3826 11,40 (11,38), 3639 9,19 (9,18), 3488 15,39 (15,33). Codé : pour le SEUL rang 1, l'enveloppe inférieure aux sections internes non
  imprimées (0,15 ; 0,25 … 0,85 L) est remplacée par w·E + (1 − w)·(corde des deux voisines), w = 0,4 (plateau 0,4–0,6 : 59 106 / 59 077 /
  59 079 ; w = 0,25 : 59 024 ; w = 1 : 58 999 — valeurs de l'état avec PSIDA_CMID actif). Les autres rangs gardent l'enveloppe à 21 sections
  (appliquer l'adoucissement à tous les rangs : −200). Les regroupements en découlent : 3488 / 3607 (1,2)(3,4,5) retrouvés.
  Ce n'est PAS la règle SETRA (non identifiée), seulement la meilleure approximation trouvée ; résidu ±0,03–0,09 (0063 13,28 / 13,37).
- Essais NÉGATIFS sur le rang 1 : G réparti par aires positives / négatives de la LI (γ max sur les aires positives) aux 21 sections
  (−756) ; rampe d'ancrage du groupe 1-2-3 (ne mord jamais : ΔΩ des trois rangs trop fort) ; seuil Ω0 × k (k = 0,5 à 0,85 inférieur,
  1,1 – 1,25 supérieur) : aucune valeur commune (0063 voudrait < 0,5, 3826 ≈ 0,85).
- Chiffres v17 recalculés (need.js) : As requise à 0,85 L / As calculée = 1,4 (3604), 1,09 (3826), 6,2 (0063), 2,2 (3639) ; pour 3488 l'arrêt
  tombe entre 0,80 et 0,85 L — aucune grandeur unique (moment ELU, ELS, zéro des moments, décalage en H) ne l'explique.

### Constat — fers de construction de rang ≥ 4 qui se chevauchent (crochet PSIDA_CMID = 1, NON ACTIVÉ)
- 3603 / 3604 : LST1 4 finit en 9,84 et LIA2 4 commence en 9,85 alors que LIT1 4 finit en 10,31 et LSA2 4 commence en 9,37 : milieu exact
  (9,84) ; idem LST4 4 / LIA4 4 (3,16 / 3,15). Règle « milieu du chevauchement quand LIT_j.x > LSA_j.o » codée : exacte sur 3603–3606 mais
  −24 / −7 sur l'ensemble (déclenchée à tort ailleurs, à cause des arrêts LIT encore imprécis) ⇒ laissée en crochet.

### Points non résolus (valeurs fausses restantes, réglage)
- Ferraillage longitudinal 1 915 : surtout les arrêts du rang 1 des LIT (règle 3 approximative) et leurs dérivés (LIA 1–3 = LIT − ls, LST ≥ 4
  copies des LIT, regroupements en cascade : 0063 LIT1 (1,2)(3,4,5)… toujours faux) ; LSA rang 1 côté travée de rive ±0,04–0,05 (3826 gauche
  5,88 / 5,84 ; 3603 droite 5,12 / 5,07, symétrique ailleurs exact) ; 3639 (hauteur des fers supérieurs) ; écarts de ±0,01–0,03 d'arrondi.
- Résumé / avant-métré 947 : poids et longueurs hérités de l'épure.

## Décision de publication (2026-11-11, après v18)
- PSIDA_R1AVG ramené de 0,4 à 0 par défaut : 0,4 était un coefficient ajusté sur le jeu de réglage (interdit par SPEC). Avec 0, l'enveloppe du rang 1 aux sections non imprimées est la corde des sections imprimées voisines (règle simple, non calée). Coût : 89,26 → 89,1 % au réglage, 87,88 → 87,8 % au contrôle. La règle SETRA exacte reste à trouver.

## Session v19 (2026-11-11) — positions des camions accolés, avertissement des appareils, arrondi des égalités (version 2006), LI en travée (constats)
Sauvegarde v18 : scratchpad psida_v18/. Outils hors moteur : scratchpad v19/ (lit.js … lit5.js : banc des coefficients imprimés des LI en
travée, variantes de précision / ordre des opérations, par catégorie ; pg.js : diff ligne à ligne d'une page listing / moteur ; dyn2.js :
δ sur culées). Comptes exacts (v14/cnt.js) : réglage 1971 59 018 → **59 074 / 66 246 (89,09 → 89,17 %)** ; contrôle 3608 5 948 → **5 952 / 6 771
(87,85 → 87,90 %)**. compare.js : 89,1 → 89,2 % / 87,8 → 87,9 % ; tous règlements 84,3 → 84,4 % / 77,4 = . Aller-retour 19/19. Aucune section en recul.
Classement initial (valeurs fausses, réglage / contrôle) : ferraillage transversal 822 / 163 ; LI travées 523 / 57 ; moments 475 / 93 ;
appareils 461 / 57 ; positions 391 / 9. Après : ferraillage transversal 822 = ; LI travées 519 ; moments 475 = ; appareils 437 / 55 ;
positions 369 / 7 ; LI appuis 21 → 19 ; LI V et R 84 → 80.

### RÈGLE 1 — ordre d'impression de deux camions Bc accolés (compute.js vehicleScan ; crochet PSIDA_POSORD = 0 : ancien ordre)
- Quand le 2e camion est à l'entraxe exact (x + 10,5 m, chemin exactGap), SETRA imprime les abscisses dans l'ordre croissant (x, x + 10,5),
  même si le camion de gauche est le moins chargeant (3488 0,40 L GD −3,50 / 7,00 ; 3603 GD −4,55 / 5,95 ; 3639 4,61 / 15,11). Sinon
  (camions non accolés) le plus chargeant reste en premier (3826 DG 29,75 / 5,62). Positions +22 / +2.
### RÈGLE 2 — avertissement de fin du dimensionnement des appareils d'appui (ferraillage.js renderAppareils ; PSIDA_NONOTAAP = 1 : sans)
- « NOTA : LORSQUE LES APPUIS NE SONT PAS EGALEMENT ESPACES … ANNEXE 4 DU DOCUMENT PSIDP-EL EDITION OCTOBRE 85 … » imprimé sur TOUS les
  passages du corpus (page sans en-tête) ; il manquait (2 nombres comptés : 4 et 85). Appareils +24 / +2.
### RÈGLE 3 — arrondi des égalités exactes, listings de la version 2006 (note.js fx ; PSIDA_RNDV = 0 : demi-pair partout)
- Programme version 2006 (bordereau A6 EDROI F6.3 : 0063, OA26) : égalités exactes arrondies en s'éloignant de zéro ; versions ultérieures :
  demi-pair (règle v1 inchangée). +10 (LI travées 4, LI appuis 2, LI V/R 4) sans perte. Constat : 3488 (2008, bordereau V92) arrondit aussi
  les égalités en s'éloignant de zéro (positions 20,125 → 20.13, −2,625 → −2.63, 13,125 → 13.13) mais rien dans le bordereau ne le distingue
  des listings 2010+ (seuls les espacements du texte extrait diffèrent) ⇒ non codé (ce serait un cas particulier par passage).
### Essais NÉGATIFS (non retenus)
- LI en travée (523, 1 unité du 6e chiffre) — banc v19/lit*.js, 5 874 coefficients A, B, C des 12 passages : double exact 634 faux ; fround
  du résultat double (crochet PSIDA_LITF = 1, laissé à 0) 468 au banc mais NEUTRE au compteur (gagne et perd autant : 8,419355 imprimé /
  8,4193544 en REAL*4) ; base REAL*4 des LI d'appui + opérations REAL*4 (lin (1−a)M_i + aM_i+1, interpolation M_i + a(M_i+1 − M_i), ordre
  inversé) 709–946 ; abscisse relative a en REAL*4 (fround, k/20, cumul de 0,1 en REAL*4 : 0,8 → 0,80000007 qui expliquerait 3488
  10,500001) 613 et plus ; B des appuis résolu par Gauss au lieu de −(A + C) : pire. Par catégorie (travée étudiée G/D, travées à gauche /
  à droite, A/B/C) aucune variante ne domine. NON RÉSOLU : la valeur imprimée porte des erreurs REAL*4 (10,500001 sur un calcul exact en
  binaire) mais pas celles d'une combinaison REAL*4 des LI d'appui imprimées — calcul probablement direct (résolution par section ?).
- Longueurs chargées A : ordre des abscisses −42 ; zone de la travée étudiée d'abord −16 ⇒ aire décroissante conservée (3603 0,10 L de
  travée 2 imprime 4,21 / 18,00 alors que l'aire de 18,00 est plus grande : critère non trouvé).
- δ sur culées (dyn2.js) : avec L = L1, G équivalent Mc120 = 9,1 / 11,75 / 10,24 / 10,47 / 10,03 × g (3488, 3603, 3639, 3826, 0063), Bc
  1,7–2,9 × g ; ni longueur commune ni G = g × (L1/2 + about) ; NON RÉSOLU.
### Points non résolus (valeurs fausses restantes, réglage)
- Ferraillage longitudinal 2 017 ; résumé / avant-métré 957 ; ferraillage transversal 822 (zones d'appui de culées : δ culée ; longueurs TB ;
  TB en face supérieure ; MOMEMT de calcul) ; LI travées 519 (REAL*4) ; moments 475 (convois D/E, Mc120 : colonnes 4, 6, 7) ; étriers 466 ;
  appareils 437 (K convois D/E, Mc120 Na = 4, δ culée, dimensions) ; positions 369 (3488 arrondis, Mc120 2e char 39,10 / 38,20 sur 3603–3610,
  ordre des longueurs A) ; flexion transversale 329.

## Session v20 (2026-11-11) — ferraillage transversal proposé (longueur TB), δ sur culées, moments convois (constats)
Sauvegarde v19 : scratchpad psida_v19/. Outils hors moteur : scratchpad v20/ (dyn.js, fitdyn.js : δ sur culées, balayage de formules ;
oracle.js + cnt.js : injection DIAGNOSTIC des δ imprimés sur culées pour mesurer le levier — jamais dans le moteur). Comptes exacts (v13/cnt.js) :
réglage 1971 59 074 → **59 112 / 66 246 (89,17 → 89,23 %)** ; contrôle 3608 5 952 → **5 953 / 6 771 (87,90 → 87,92 %)**. compare.js : 89,2 / 87,9 %
(arrondi inchangé) ; tous règlements 84,4 / 77,4 %. Aller-retour 19/19. Sections : ferraillage transversal 1 836 → 1 873 exactes (KO 822 → 785) ;
résumé +1 / +1 ; aucune section en recul.

### Classement des valeurs fausses (début de session, réglage)
- Ferraillage transversal (822) : lignes de zones d'appui 1G/1D/2G/2D ≈ 450 (espacement ≈ 70, nombre ≈ 55, plage ≈ 55 par côté, poids APPUI ≈ 50) —
  causées par la SECTION DU CHEVÊTRE (page appareils), elle-même fausse par : δ sur culées (Bc imprimé 1,32–1,34, moteur = δ travée), coefficient
  d'inégalité des convois D/E (3826 : 2,211 imprimé, 1,000 moteur ⇒ EN CHARGE pile 144,82 / 178,28 ⇒ espacement 0,135 / 0,110 partout) ; lignes
  TRAVEE TB ≈ 110 (longueur TB, poids φ2) ; face sup. TB absente ≈ 64 (3603/3607/3608 : lignes entières « PHI3 TB ») ; MOMEMT (torsion) 64 (±0,01–0,02,
  hérité des moments longitudinaux : Mc120 3603–3606, convois 3607–3610) ; TOTAL 17.
- Moments longitudinaux (475 lignes de tableau + 147 enveloppe) : par passage 3607/3609/3610 73 chacun (colonne C.E. : position du 2e char Mc120,
  convois D/E), 3639 56 (colonne TROTTOIRS négative −2,55/−2,56… et ELS/ELU dérivés : K trottoir 1,1412 moteur / 1,139 imprimé, 1,0676 / 1,065),
  3826 23, 3603–3606 7 chacun.

### RÈGLE — longueur des aciers inférieurs tête-bêche (ferraillage.js propose ; crochet PSIDA_TBL = 0 : longueur pleine)
- **L_TB = E1 / (2 sin ψ) + 3 E1 / 8 − 0,03** (ψ biais géométrique en grades) : exacte sur les 9 couples connus — E1 4,50 : 3,91 / 3,91 / 3,94 / 3,97
  (ψ 100 / 95 / 90 / 85) ; E1 7,00 : 6,09 / 6,11 / 6,14 / 6,19 ; notice O001 E1 7,60 ψ 80 : 6,82. Lecture : une moitié de la largeur suivant le biais
  + 3/8 de la largeur droite, moins l'enrobage. Le poids φ2 des travées utilise cette longueur (3605 T2 0,130 ✓). +38 / +1.
- La même forme NE s'applique PAS aux aciers supérieurs TB (3603 6,31 ; 3607 9,09 ; 3608 9,00) : le terme W/(2 sin ψ) est confirmé par 3607/3608
  (même W, ψ 85/90 : a = 0,499) mais le reste (≈ 0,328 W − 0,43) n'a pas de forme simple ; critère d'apparition (3603/3607/3608 oui, 3604/3609/3610 non)
  non trouvé. Quand la face sup. de travée est TB, les zones 2 de pile passent en PHI2/PHI3 ALT et leur espacement change (3603 0,315 / 0,305 moteur) ;
  la zone 2D des culées porte alors aussi « PHI2 TB » : non codé.

### δ sur culées (page « COEFFICIENTS DE MAJORATION DYNAMIQUE SUR APPUIS ») — NON RÉSOLU, levier mesuré
- Imprimés (11 passages) : Bc 1,320–1,342 ; Mc120 1,166–1,193 (3639 : = δ travée 1,217 ⇒ max(δ travée, δ culée)) ; convois 1,100 (déjà codé).
  Constat nouveau : **δc(Bc) − δc(Mc120) = 0,147–0,154 sur tous les passages** alors que δ travée Bc − Mc vaut −0,036 à +0,007 ; Bc culée « plafonne »
  à 1,341 pour L1 ≤ 12,5 (3639, 4015, 3826) quel que soit g.
- Balayage (fitdyn.js) δ = 1 + 0,4/(1+0,2L') + 0,6/(1+4G'/S) avec L', G'/g ∈ {L1, L1/2, L1 ± about, about, 2 about, longueur totale, L1+L2,
  largeur, 0} et S = S travée : meilleur écart max 0,040 (Bc) / 0,011 (Mc) — aucune règle. Résolution conjointe (L', G') Bc + Mc avec S travée : pas
  de solution (G' différents) ⇒ S ou G' différent entre Bc et Mc sur culée.
- Levier (oracle diagnostic, valeurs imprimées injectées) : Bc seul +108 / +4 (CP-CMD +48, appareils +25, ferraillage transversal +35) ; Mc120 négligeable.

### Essais NÉGATIFS (crochets laissés à 0)
- PSIDA_CVTRAP = 1 : convois D/E intégrés sur la LI interpolée linéairement entre les points à 0,05 L (aire exacte du polygone entre bornes
  interpolées, découpage aux appuis conservé) : moments 5 531 → 5 523 / 479 → 476 ; appliqué aussi aux LI à saut : −310 (efforts tranchants,
  réactions, étriers). PSIDA_CVTRAP = 2 (aussi Mc120) : −2 826. ⇒ SETRA intègre bien la LI continue ; le résidu convois n'est pas la quadrature.
- Mc120, 2e char (3603–3610) : écarts gauche-gauche imprimés 36,20 accepté (19,30 / 55,50) mais 36,25 refusé (1,95 / 38,20 à 0,30 L de 3607, où
  39,10 est imprimé) ⇒ ni seuil d'écart, ni « point de grille le plus proche de x ± T » (règle convois v15) ne conviennent (intervalles de T
  incompatibles). Non codé.

### Points non résolus (pour la suite)
- Section des chevêtres de culée (δ culée Bc) et de pile 3826 / 3607–3610 (coefficient d'inégalité des convois) : principal levier restant des zones
  1G/1D/2G/2D. Face sup. TB (longueur, critère). 3639 : K trottoir (1,141 / 1,139) ⇒ colonne TROTTOIRS négative et ELS/ELU.

## Session v21 (2026-11-11) — majoration dynamique sur culées : RÈGLE (notice PSIDP-EL)
Sauvegarde v20 : scratchpad psida_v20/. Comptes exacts (v13/cnt.js) : réglage 1971 59 112 → **59 247 / 66 246 (89,23 → 89,44 %)** ;
contrôle 3608 5 953 → **5 959 / 6 771 (87,92 → 88,01 %)**. compare.js : 89,4 / 88,0 %. Aller-retour 19/19. Sections (réglage) : CP et CMD
86,8 → 98,6 % ; appareils d'appui 61,6 → 64,4 % ; ferraillage transversal 70,5 → 71,7 % ; aucune section en recul (réglage, contrôle, tous règlements).

### RÈGLE — δ sur culées (compute.js, r.cmdAppui ; crochet PSIDA_DYNC0 = 1 : δ de la travée de rive, ancien calcul)
- Source : /home/claude/ref/notices/Programme_de_calcul_PSIDP_EL.txt l. 3283–3300 (listing PSIDP 0015 annoté par SETRA, page
  « COEFFICIENTS DE MAJORATION DYNAMIQUE SUR APPUIS ») : « 1,338 = (1,177 + 1,5)/2 », « 1,186 = (1,172 + 1,2)/2 », « (*) valeurs fixées
  arbitrairement par le programme » ; appui 2 : « 1,177 = max(1,177 ; 1,138) ». Constantes du programme documentées, pas de calage.
- **δ culée Bc/Bt = (δ1 + 1,5)/2 ; Mc120 = max(δ1, (δ1 + 1,2)/2)** (δ1 non arrondi de la travée de rive) ; convois D/E (1 + 1,2)/2 = 1,100
  (déjà imprimé). Exact à 0,0005 sur les 19 passages (1960 et 1971), BC et MC.120. 3639 : Mc (1,217 + 1,2)/2 = 1,2085 < 1,217 ⇒ max conservé.
- Explique tous les constats v11/v13/v20 : écart Bc − Mc = 0,15 + (δBc − δMc)/2 ; « plafond » 1,341 = (≈1,182 + 1,5)/2 ; les balayages
  (L', G', S) de la formule F61 étaient voués à l'échec (ce n'est pas une formule F61).
- Gain +135 réglage (> levier oracle v20 +108, qui n'injectait que les valeurs imprimées arrondies) / +6 contrôle.

## Session v22 (2026-11-11) — lecture intégrale de la notice PSIDP-EL et du guide PSIDA-PSIDP : aucune règle nouvelle applicable à PSIDA
Sauvegarde v21 : scratchpad psida_v21/. Bancs : scratchpad v22/ (kcv.js, fit.js, t2.js : K convois D/E en poutre infinie).
Comptes exacts (v13/cnt.js) **inchangés** : réglage 1971 59 247 / 66 246 (89,44 %) ; contrôle 3608 5 959 / 6 771 (88,01 %). Aller-retour 19/19.
Aucune section n'a bougé (deux crochets d'essai ajoutés, inactifs par défaut).

### Ce que contient la notice /home/claude/ref/notices/Programme_de_calcul_PSIDP_EL.txt (listing PSIDP 0015 annoté)
- Seule annotation « fixée arbitrairement par le programme » du document : δ sur culées, l. 3283–3300 (déjà exploitée en v21).
  Les autres annotations manuscrites sont des vérifications de calcul (l. 2921–2925 γQ, 3241 longueur des pontées biaises,
  3447 K Bc = moyenne de 4 positions, 3642/3834–3841 combinaisons ELS/ELU, 5028–5119 ELU de flexion, 5301 2c = H + 2 HCHAU + 1,60
  pour Bt, 5433/5448 My).
- Page 52 (appareils, l. 5831–5925) — rien de nouveau pour PSIDA :
  * l. 5880–5884 : ESPAP = 2b / (Na − 0,1) / sin φ avec 2b = largeur moyenne 9,837 (PSIDP) ; PSIDA reste B/(Na − 0,6)/sin φ (compute.js l. 329).
  * l. 5887–5888 : « 0,25 = largeur dans le sens perpendiculaire aux lignes d'appui ; 0,30 = longueur dans le sens parallèle » —
    définition seulement, AUCUNE règle de choix des dimensions (ni épaisseur, ni nombre de feuillets : NFEUIL = « * », non calculé,
    l. 6680/6717).
  * l. 5889–5891 : réactions par appareil « δ, γQ non inclus, mais a1, bc inclus » / « tous coefficients inclus » (déjà appliqué).
  * l. 5893–5899 : |M| = R ℓ / (12 e) (déjà appliqué).
  * l. 5902–5920 : K = R / Rmoy, bande porteuse, ligne d'appui = poutre continue à travées égales, précontrainte K = 1, dégressivité
    transversale de A et B prise en compte (déjà appliqué). Le listing 0015 n'a ni convoi D/E ni Mc80 : aucune donnée pour K convois.
- Page 53 (ferraillage transversal PSIDP, l. 5930–5955) : format PSIDP différent (tableau des espacements maximaux par diamètre).
  Zones mesurées suivant l'axe longitudinal : CHEV APP culée 1,25 = esp/(3 sin φ), pile 0,93 = e/(2 sin φ), EXT CHEV = 2 × CHEV APP
  (2,50 ; 1,86) ; section EXT CHEV face sup. = section du chevêtre / 3 ; face inf. = section minimale de la travée.
  **Essais transposés à PSIDA (négatifs, non activés)** : crochet PSIDA_Z2SIN = 1 (zone 2 de culée 2·esp/(3 sin ψ)) : −1 réglage ;
  = 2 (aussi zones 2 de pile e/sin ψ) : −1 ; crochet PSIDA_Z1SIN = 1 (zone 1 côté travée des culées = esp/(3 sin ψ) au lieu de e − ABOUT) : 0.
  ⇒ PSIDA ne divise pas ses zones par sin ψ (cohérent avec 3603–3610 déjà exacts).
- l. 5972–5981 (commentaire page 53) : option 1 (fers parallèles aux lignes d'appui, dalles peu biaises) / option 2 (fers perpendiculaires
  aux bords libres, biais prononcé) ; longueurs de fers supplémentaires en zone 2 « 2·e + 40 φ / cos φ » et zone 1 « … + 40 φ » (OCR
  illisible en partie). C'est la seule mention des longueurs ; elle ne concerne pas la mention TB de PSIDA.
- l. 6094–6116 (commentaire page 54) : le seul « tête-bêche » du document concerne les aciers LONGITUDINAUX de face inférieure près des
  appuis intermédiaires (1,5 ‰, sur d = max(ℓi, ℓi+1)/5, longueur d'un fer = (ℓi + ℓi+1)/5), aussi l. 696–700. Rien sur le TB transversal
  de face supérieure de PSIDA (critère d'apparition 3603/3607/3608 toujours inconnu).
- l. 696–697 : ferraillage transversal inférieur minimum = min(2 ‰ ; 1,3 η ‰) × 1/sin φ si parallèle aux lignes d'appui (PSIDP).
- Annexe « Dimensionnement des appareils d'appui et ferraillage des chevêtres incorporés » (l. 8366–9300) : méthode MANUELLE pour appareils
  irréguliers (charges de type 1/2, coefficients t(α), u(α), m = M/(1,5 c) …) ; explicitement hors calcul automatique (l. 8386–8394).
- Annexe Guyon-Massonnet-Barès PSI-DA/PSI-DP (l. 9320–9900) : positions transversales A entre X2 et X3, Bc X2 + 0,25 / X3 − 0,25,
  Bt X2 + 0,50 / X3 − 0,50, chenille X2 + c… ou centrée si X3 − X2 < 6 ; étalement Bc 1,75 + 2 HCHAU + H, Bt 1,6 + 2 HCHAU + H, chenille
  L + 2 HCHAU + H ; harmoniques 1, 3, 5. Tout est déjà conforme dans compute.js (flexion transversale).
- l. 2336–2346 (charges généralisées) : un véhicule « à action répartie » (une remorque D ou E) se décrit comme 2 chenilles avec
  ESCHE = CHELA = demi-largeur d'impact. Transposé aux K convois D/E (banc v22/kcv.js, poutre infinie, appuis réels) :
  2 chenilles d'entraxe 1,65 étalées sur 1,65 + H + HCHAU : culée 3607 2,314 / 2,275, pile 2,486 / 2,393 (axe libre), 3826 2,331 / 2,211 ;
  axe limité à ±0,50 : 2,314 / 2,333 / 2,224 (pile trop faible). Bande unique ajustée (fit.js) : w = 3,74 / 3,70 / 3,67 (3607 culée / pile /
  3826) avec dK/dw ≈ −1 ⇒ ±0,035 sur K : AUCUN modèle à une constante. K convois : NON RÉSOLU, 1,000 conservé.
- Guide /home/claude/ref/notices/PSIDA-PSIDP_ocr.txt § 3.6 (l. 3785–3995) : règles générales d'élastomère fretté (σ ≤ 15 MPa, σ ≥ 2 MPa,
  T ≥ … distorsion, rotation t·T ≥ a³α/3…) et tableau NF T 47.815 (dimensions normalisées ; 0,25 × 0,25, 0,30 × 0,55 n'y figurent pas) ⇒
  ne reproduit pas le choix des dimensions SETRA (3603 0,35 × 0,45 / 3607 0,30 × 0,55). Non résolu.

### Postes PSIDA toujours ouverts (inchangés)
K convois D/E (2,211 ; 2,275 / 2,393) et Mc120 à 4 appareils ; dimensions des appareils (biais 85, culée 0,30 × 0,30, OA26) ; TB de face
supérieure (critère, longueur) ; section des chevêtres 3639 (d = H − 0,049) ; zone 2D des culées 3603/3604 ; diviseur des étriers / page
des appuis concentrés ; poids partiels des étriers. La notice PSIDP n'apporte aucune donnée sur ces postes.

### Règles PSIDP repérées dans la notice (non codées dans PSIDA, à transmettre au moteur PSIDP)
- l. 4144 : « MISE EN TENSION EN UNE SEULE SERIE » ; l. 4172–4182 : déviation parasite 0,01111 rad/m ; pertes instantanées = frottement +
  blocage + raccourcissement élastique ; tension de service approchée avec retrait 3880 t/m² et fluage approché 5779 t/m² ; recul d'ancrage
  jusqu'à SG = 13,171 m / depuis SD = 49,049 m.
- l. 3969–4058 (organigramme BPEL) : (A) frottement σpo[1 − e^(−fα−φx)] ; (B) ancrage ; (C) déformations instantanées = ½ (Ep/Eij) σbj ;
  relaxation Δσρ = 6/100 · ρ1000 · (σpi/fprg − μ0) · σpi, μ0 = 0,43 (TBR), 0,30 (RN), 0,35 (autres) ; retrait Δσr = εr Ep ; fluage
  Δσfl = Kfl (Ep/Ei) σb, d'abord approché puis réajusté avec σb ; terme rectangle −2 Δσρ (Δσr + Δσfl)/σpi (annexe 2 § 5) ;
  (Δσd)MS = r(j) (Δσd)ES.
- l. 4185–4232 (commentaire page 29) : Δσi = (151000 − 148308) + 10575 + 2218 = 15485 (frottement, rentrée d'ancrage, raccourcissement
  élastique) ; Δσρ = 0,06 × 2,5 × (135515/189000 − 0,43) × 135515 = 5834 ; terme rectangle −2 × 5834 × (3880 + 5779)/135515 = −832.
- l. 4366–4368 : pertes à la mise en service = 50 % de celles en service définitif (relaxation finale, retrait final 3880).
- l. 4372–4401 (commentaire page 33) : fluage RÉAJUSTÉ 5978 (approché 5779), terme rectangle −849, Δσd = 3880 + 5978 + 5834 − 849 = 14844 ;
  σp = 151000 − 30329 = 120672 ; σ caractéristique minimale = 0,98 σpo − 1,2 Δσp = 111586.
- l. 4060–4135 : tracé = fuseau limite lissé par paraboles, T = T1 + λ(T2 − T1) concordant (simplexe, N − 1 doubles inéquations) ; si pas de
  solution : décalage vers le haut des points de passage sur appuis, puis +1 câble, au plus 4 câbles supplémentaires ; transformation
  linéaire conservant les ancrages pour centrer le tracé.
- l. ~1353–1356 : CABLAGE = 4 : vérification d'un câblage imposé (nombre de câbles ligne A10, tracé lignes D1–D6).
- l. 2000–2030 : RECULAN, εrto (valeurs conseillées 3·10⁻⁴ quart sud-est …).
- Rien dans la notice sur le raccourcissement élastique par blocs ≥ 2 (seul le cas « une seule série » est commenté).

## Session v23 (2026-11-11) — K des trottoirs (bord extérieur), espacement des chars Mc120, hauteur utile des chevêtres
Sauvegarde v22 : scratchpad psida_v22/. Bancs hors moteur : scratchpad kt.js / kt2.js (variantes de quadrature du K trottoir, 11 passages),
cps.js (levier diagnostique du c' de 3639). Comptes exacts (v13/cnt.js) : réglage 1971 59 247 → **59 529 / 66 246 (89,44 → 89,86 %)** ;
contrôle 3608 5 959 → **5 973 / 6 771 (88,01 → 88,21 %)**. compare.js : 89,9 / 88,2 % ; tous règlements 84,4 → 85,0 % / 77,4 → 77,6 %.
Aller-retour 19/19. Sections (réglage, valeurs exactes) : moments longitudinaux 5 531 → 5 669 ; étriers 3 340 → 3 395 ; ferraillage
longitudinal 6 365 → 6 399 ; positions 2 404 → 2 419 ; appareils 733 → 747 ; ferraillage transversal 1 906 → 1 915 ; résumé 3 030 → 3 039 ;
Guyon K 6 073 → 6 081. Aucune section en recul (réglage, contrôle, tous règlements). Les trois crochets à 1 redonnent exactement 59 247 / 5 959.

### RÈGLE 1 — K des trottoirs : bord extérieur = dernier nœud de la grille de la LI (compute.js Guyon ; crochet PSIDA_KTOUT = 1 : troncature)
- La LI de K est tabulée au pas 0,125 depuis le bord gauche sur N = round(W / 0,125) intervalles (déjà ainsi pour la LI imprimée).
  Le trottoir droit s'étend du bord de chaussée (exact) jusqu'au DERNIER NŒUD de cette grille, arrondi (et non tronqué).
  3639 (W = 9,20 = 73,6 pas) : nœud final 9,25 au lieu de 9,125 ⇒ K trottoir 1,1412 → 1,139, 1,0820 → 1,080, 0,926 → 0,925 (les
  trois fibres, travées 1 et 2 : 1,065, 1,038, 0,964). Banc kt2.js : 60/60 coefficients imprimés exacts sur 11 passages (les autres
  ont W multiple de 0,125 : sans effet). Cause de l'anomalie « colonne trottoirs négative + ELS/ELU » de 3639 (56 valeurs) : ce
  n'était PAS la même cause que la hauteur des fers supérieurs. Effet en cascade : moments, étriers (+55), ferraillage.
- Essai négatif : K avec le coefficient de Poisson du bordereau (3639 ν = 0,2) : LI de K faussées (bord 1,956 → 2,353) ⇒ K à ν = 0.

### RÈGLE 2 — espacement des deux chars Mc120 (compute.js mcGapOk / vehicleScan ; crochet PSIDA_MCGAP0 = 1 : seuil fixe 36,20)
- **x2 − x1 ≥ 6,10 + 30,50 − h/2**, h = 0,05 L de la travée où se trouve le premier char (le plus à gauche) : F61 (30,50 m entre
  points de contact) avec une tolérance d'une demi-maille de la grille des positions. 3607 travée 1 (h = 0,65 ⇒ seuil 36,275) :
  36,25 refusé (1,95 / 38,20 → 39,10 imprimé), 36,35 accepté (4,55 / 40,90) ; travée 2 (h = 0,90 ⇒ 36,15) : 36,05 et 35,90 refusés
  (17,50 / 53,55 ; 15,70 / 51,60), 36,20 accepté (19,30 / 55,50). Explique la contradiction notée en v20 (36,20 accepté, 36,25 refusé).
  Même règle appliquée au Mc80 (30,50 + 4,90 − h/2 ; aucun passage Mc80 au corpus). Essai négatif d'abord : « dernier point de grille
  couvert par la chenille + 30,50 » (exact en travée 1, faux en travée 2 : 51,60 − 21,10 = 30,50 refusé) : −67.
- Gain : moments 3603–3610 (+138 réglage), positions +15, ferraillage +34, contrôle 3608 +14.

### RÈGLE 3 — hauteur utile des chevêtres d = H − ENROBS − 0,6 φt (ferraillage.js appareils achOf + propose ; crochet PSIDA_DCH0 = 1 : H − 0,04)
- φt = plus gros diamètre de l'option retenue pour la zone 1 au FERRAILLAGE TRANSVERSAL PROPOSE (choix fait en essayant les options
  dans l'ordre PHI3, PHI2/PHI3 ALT, PHI2, PHI1/PHI2 ALT, PHI1 avec la section recalculée pour chaque φt ; s ≥ 0,10). φt = 16 : H − 0,0396
  (constat v10 : 0,0393–0,0399) ; 3639 (PHI1/PHI2 ALT, φ 32) : H − 0,0492 (constat « H − 0,049 » expliqué). 0,6 φ = φ/2 majoré de 20 %
  (même facteur que le 0,6 φ1 du c' des étriers v17). La section de zone 2 suit (section du chevêtre / 3). +22 réglage, contrôle =.

### 3639 — hauteur utile supérieure retenue 0,457 (c' = 0,0564) : NON RÉSOLU, levier mesuré
- Levier (diagnostic cps.js, c' imposé 0,0564 pour 3639) : +102 réglage (ferraillage longitudinal LSA +36, étriers +63, résumé +3).
  Crochet de diagnostic ajouté : globalThis.PSIDA_CPS(r) → c' imposé (hauteur retenue supérieure et d des étriers) ; absent par défaut.
- Piste (règle 3) : les fers transversaux de chevêtre (PHI1/PHI2 ALT, φ 32) passent AU-DESSUS des fers longitudinaux supérieurs ;
  c' = 1,1 φt + 0,6 φ1 reproduit les deux familles du corpus (φt = φ2 16 : 0,0368 / 0,0326) mais donne 0,0544 pour 3639 (imprimé
  0,0564 : 2 mm de trop peu ; levier de cette forme +18 seulement). Aucune combinaison linéaire de φ1…φ4 ne relie les trois familles.
  ESPAC1 3639 (0,305 imprimé / 0,310 moteur) en découle (enveloppe plus forte avec d = 0,457). Non codé.

### Postes non traités cette session (inchangés)
- Étriers restants (poids partiels, DENCHA, page « appuis concentrés ») ; positions (ordre des longueurs chargées A, arrondis 3488) ;
  K convois D/E, dimensions des appareils, TB de face supérieure (cf. v22).

## Session v24 (2026-11-11) — bordereau (défaut du comparateur), déformations de 3488 (arrondi de Ei), points de la LI de K imprimée
Sauvegarde v23 : scratchpad psida_v23/. Bancs hors moteur : scratchpad v24/ko.js (valeurs fausses d'une section, CAT=… IDS=…),
v24/cp.js + cpv.js (My CP / trottoirs, variantes d'intégration). Comptes exacts (v13/cnt.js, réglage 1971 / contrôle 3608) :
avant 59 529 / 66 246 (89,86 %) et 5 973 / 6 771 (88,21 %) ;
après correction du comparateur seule 59 529 / 66 019 (90,17 %) et 5 973 / 6 745 (88,55 %) ;
**fin de session 59 799 / 66 019 (90,58 %) et 5 973 / 6 745 (88,55 %)**. compare.js : 90,6 / 88,6 % ; tous règlements
85,0 → 86,7 % / 77,6 → 77,8 %. Aller-retour 19/19. Aucune section en recul (réglage, contrôle).

### Comparateur (test/compare.js et diag/cmp.js) — BORDEREAU : 227 / 26 valeurs « fausses » = page de garde mal classée
- Les 227 (réglage) et 26 (contrôle) valeurs étaient TOUTES celles de la page de garde SETRA (version 92-1, BAEL 91, titre, « CALCUL NO »,
  date et heure de passage, adresse, téléphone…), absente de la note générée, et non des données du bordereau (aller-retour exact).
- Cause : dans les listings qui commencent par une ligne blanche avant le premier « PSIDAEL » (0063, 3603–3610, 3639), cette ligne
  ouvrait une page fictive ; l'en-tête du bordereau devenait la 2e page, et la règle « MINISTERE ⇒ page cartouche » (réservée à la
  première page) ne s'appliquait plus : la page de garde était fusionnée avec le bordereau. Correction : ignorer les lignes blanches
  avant le premier en-tête. La page de garde est alors classée « (cartouche) », comme déjà pour 3488, 3826 et OA26.
  Le dénominateur baisse de 227 / 26 valeurs : ce sont des valeurs de cartouche (adresse, heure), non reproductibles par le moteur.
- Bordereau : 100 % sur tous les passages de 1971. Reste 3453 (1960, hors périmètre) à 49,7 % : non examiné.

### RÈGLE 1 — arrondi selon la génération du programme : passages antérieurs à 2010 (note.js renderNote ; crochet PSIDA_RNDDATE = 0 : sans)
- La date du passage (en-tête du listing, m.date) identifie aussi la génération du programme. Les passages de 2006 à 2008 (0063, OA26
  version 2006 déjà détectés ; 3452, 3453 et 3488 en V92) arrondissent les égalités exactes en s'éloignant de zéro ; à partir de 2010,
  demi-pair. Cela confirme le constat de v19 (3488 : 20,125 → 20.13), alors non codé faute de critère dans le bordereau.
- Entiers suivis d'un point (fdot : EI, EV, limites…) : valeur en simple précision puis même règle d'égalité (crochet PSIDA_FDOT0 = 1 :
  Math.round direct). Ei(3060 T/M2) = 3 517 980,496 → float32 3 517 980,5 → **3517981.** (2007–2008 : 3452, 3453, 3488) /
  **3517980.** (4015, 2022) : les deux impressions du corpus sont reproduites. Le titre des pages DÉFORMATION contient « EI = » : sur 3488,
  l'écart de 1 sur Ei faisait manquer l'appariement des pages et comptait 206 valeurs fausses. **Déformations : 206 → 0** ; positions
  332 (+22, égalités de 3488) ; LI travées, LI V/R, dénivellations, caractéristiques +6. Contrôle 3608 (2010) inchangé.

### RÈGLE 2 — nombre de points de la LI de K imprimée = INT(W / 0,125) + 3 (compute.js Guyon ; crochet PSIDA_LINPR = 1 : round + 3)
- 3639 (W = 9,20 m, soit 73,6 pas) : 76 points imprimés (et non 77). Pour W multiple de 0,125 : inchangé (83 points pour W = 10).
  Le bord extérieur des trottoirs (règle v23) reste le nœud round(W / 0,125) : 74 pas, soit 9,25 m (60/60 K trottoirs exacts conservés).
  **Guyon K 111 → 75** (36 valeurs de 3639).

### Flexion transversale (329 / 45) — classement, NON RÉSOLU
- Classement des valeurs fausses (réglage) : lignes My (≈ 290) = colonnes ELS/ELU (conséquence), My C des convois (calage ±0,425, cf. v15),
  My CP max (petites valeurs par compensation : 3607 −0,009 imprimé / −0,014 calculé ; 3603 −0,007 / −0,005 ; 3826 exact) et
  My trottoir ; LI de μ (≈ 40) : première ordonnée (bord −W/2) à ±1 sur la 4e décimale.
- Essai NÉGATIF (crochet PSIDA_MYTOUT = 0) : trottoir droit jusqu'au nœud round(W / 0,125) comme pour K (v23). 3607 : −1,058 (W/2) →
  −1,037 (nœud), imprimé −1,053, entre les deux. +3 au total mais 3607 s'éloigne : non retenu. PSIDA_MYTRV 1–3 (intégration
  linéaire par morceaux, bornes exactes) : aucune ne donne −1,053. My CP min au nœud : forte dégradation (3607 −3,502 / −3,588).
- My CP max : variantes (intégrale continue, trapèzes au pas 0,125 / 0,5, grille alignée sur −W'/2 ou sur l'axe) : aucune ne recolle
  à la fois 3603, 3607 et 3826.

### Guyon K restant (75 / 20)
- 3607–3610 : K des CVOI.D / CVOI.E à −0,001 (1,011 / 1,012 ; 72 valeurs avec les récapitulations) et 3826 (+0,002) : résidu de sens
  opposé déjà décrit en v15, NON RÉSOLU. Reste : 1 à 2 ordonnées de LI par passage à ±1 sur la 4e décimale.

### Points non traités cette session (inchangés)
- Étriers (411 : poids partiels, DENCHA) ; positions (332 : ordre des longueurs chargées de A) ; ferraillage longitudinal (1 983),
  résumé (946), ferraillage transversal (743), LI travées (517), appareils (392), moments (337).

## Session v25 (2026-11-11) — charges permanentes en REAL*4, ordre des longueurs chargées de A, poids partiels des étriers
Sauvegarde v24 : scratchpad psida_v24/. Outils hors moteur : scratchpad v25/koall.js (valeurs fausses de TOUTES les sections en un
passage → v25/ko_<section>.txt), v25/zz.js (valeur des LI de moment aux appuis, essai zones de longueur nulle). Comptes exacts
(cntko.js, réglage 1971 / contrôle 3608) : avant **59 799 / 66 019 (90,58 %)** et **5 973 / 6 745 (88,55 %)** ;
après **59 904 / 66 019 (90,74 %)** et **5 982 / 6 745 (88,69 %)**. compare.js : 90,7 / 88,7 % ; tous règlements 86,7 → 86,9 % /
77,8 % =. Aller-retour 19/19. Aucune section en recul (réglage, contrôle).

### Classement initial des valeurs fausses (réglage / contrôle, début de session)
ferraillage longitudinal 1 983 / 184 ; résumé 946 / 94 ; ferraillage transversal 743 / 163 ; LI travées 517 / 57 ; étriers 411 / 49 ;
appareils 392 / 55 ; moments 337 / 89 ; positions 332 / 6 ; flexion transversale 329 / 45 ; LI V/R 78 ; Guyon K 75 / 20 ; réactions 22 ;
LI appuis 19 ; charges 16 ; caractéristiques 9 ; CP et CMD 8 ; efforts tranchants 3. Écarts d'une unité (koall) : LI travées 519,
ferraillage longitudinal 632, résumé 275, ferraillage transversal 221, appareils 120, flexion transversale 112, moments 105, Guyon 91.
Gain facile repéré : OSSATURE 11,287 imprimé / 11,288 (3603–3606, égalité 11,2875 en double), 22,329 / 22,330 (3607), 3,802 / 3,803 (3488).

### RÈGLE 1 — charges permanentes en simple précision (compute.js, r.cp ; crochet PSIDA_CPF = 0 : double)
- oss = fl(fl(A) × fl(MASVOL)) ; OSMAX/OSMIN, g = oss + QSUP et les moyennes (x + y)/2 calculés en REAL*4. 3603 : A × 2,5 = 11,2874994
  → 11.287 ✓ ; 3607 17,5295 + 4,8 = 22,3294983 → 22.329 ✓ ; 3488 (QSUPMAX + QSUPMIN)/2 = 3,8024999 → 3.802 ✓.
  Charges 16 → 0, CP et CMD 8 → 0, caractéristiques 9 → 1. +32 / +1.

### RÈGLE 2 — ordre d'impression des longueurs chargées de A = effet individuel A(lᵢ)·|aireᵢ| décroissant (note.js ; crochet PSIDA_AORD)
- Règle PSIDP v9 transférée. Crochet PSIDA_AORD : 0 = aire décroissante (ancien), **1 = A(lᵢ)·|aireᵢ| (défaut)**, 2 = |aire|·K_A de la
  travée, 3 = longueur décroissante, 4 = A(lᵢ)·|aire|·K_A. Mesures (réglage / contrôle) : 1 et 4 +28 / +4 (positions 332 → 304, 6 → 2) ;
  2 : 0 ; 3 : −45 / −6. 1 retenu (plus simple, 4 identique). Résout le cas v19 3603 0,10 L travée 2 (4,21 avant 18,00).
- Reste en positions (304) : **zones de longueur nulle** « 0.00 » imprimées aux sections sur appui (0063 et 3488 T1 1,00 L ligne max ;
  3603–3606 T1 1,00 L ; 3639 T2 0,00 L ; 3826 T2 1,00 L, deux lignes) mais PAS sur des cas de géométrie identique (3607 T1 1,00 L, même
  13/18/18/13 que 3603 ; 3639 T1 1,00 L ; 3826 T1 1,00 L). Lecture : la partie de longueur nulle de la travée étudiée (section sur
  appui) est retenue quand le bruit numérique de la LI à cet appui est > 0 dans le programme ; non prédictible avec nos LI (valeur
  exactement 0 en double et en REAL*4, banc v25/zz.js). NON RÉSOLU. Le comparateur amplifie l'écart : la ligne au nombre de valeurs
  différent s'apparie à une ligne suivante (3639 : 121 valeurs fausses pour une seule ligne ; 3826 : 93) — comparateur NON modifié.

### Étriers — ligne POIDS PARTIEL imprimée (ferraillage.js etriers + rendu ; crochet PSIDA_NOPOIDS = 1 : sans)
- La ligne « NOMBRE DE COURS D'ETRIERS n POIDS PARTIEL p » était tronquée (sans poids) et ne s'appariait pas : n comptait faux.
  Poids = n × nI × (2 (H − ENROBS − ENROBI) + 15 φ4) × aire(φ4) × 7,85 — même longueur développée que l'avant-métré (ferraillage.js
  l. 147), pas de nouvelle constante. Exact sur 0063 (0,706) et OA26 (1,023) ; faux sur 3488, 3603–3610, 3639. +45 / +4 (étriers 411 → 366).
- Longueur développée par étrier déduite des poids imprimés (2 brins) : 2 (H − 0,06) + 0,1507 (0063), 0,1447 (3488), 0,1497 (OA26)
  [φ1 32, φ4 10] ; + 0,159 (3603), 0,158 (3607) [φ1 25, φ4 10] ; + 0,000 (3639, φ4 6, φ1 32). Le terme en plus dépend de φ1 (≈ −0,7 Δφ1)
  et disparaît pour φ4 = 6 : aucune forme simple (crochets 10φ / 6φ, enrobage + 0,6 φ1, rayon de cintrage examinés à la main sur ces 7 points, non codés :
  aucun ne relie φ10 et φ6). NON RÉSOLU.
- Page « APPUIS CONCENTRES » (DENCHA, cisaillement, espacement, distances) : toujours absente (≈ 190 valeurs). Constat 3639 :
  s = k At fe / (DENCHA (τ − x)) admet x ≈ 81,5 = 2 × 0,4 MPa et k ≈ 0,75 mais avec deux points seulement (0,13 / 0,06) : non codé.

### Appareils d'appui (392) — classement, NON RÉSOLU
- K Mc120 à 4 appareils (0063 1,611 / 1,591 ; 3488 1,588 / 1,562 ; 3603–3606) ; « A VIDE » 0063 / 3488 0,03–0,05 % trop forts (31,33 / 31,32 ;
  39,58 / 39,56 ; pile 95,72 / 95,71 ; 122,42 / 122,36) puis EN CHARGE, MINIMALES / MAXIMALES et section des fers ; dimensions en plan
  (0063 pile 0,250 / 0,300) ; 3607–3610 K convois D/E. 3488 : légende « * 0 / 1 / 2 » imprimée sur des lignes séparées (mise en page V92,
  3 valeurs, non reprise).

- Crochets à 0 (PSIDA_CPF=0 PSIDA_AORD=0 PSIDA_NOPOIDS=1) : 59 799 / 5 973 retrouvés exactement.
### Non traités (budget) : moments longitudinaux (K convois D/E ±0,001–0,002), réactions ELU ±0,1 (22), DENCHA.

## Session v26 (2026-11-11) — chaîne des LI en simple précision complète : essais (aucune règle retenue, moteur INCHANGÉ)
Sauvegarde v25 : scratchpad psida_v25/. Outils hors moteur : scratchpad v26/ — t1.js (lecture des coefficients imprimés, écarts
travée 1), gen.js (banc 5 874 coefficients A, B, C des 12 passages : générateurs d'abscisse × base des LI d'appui × forme de
combinaison × isostatique ; crochets d'environnement SPAN, IDS, BASES, BSUM, SHOW, W), mb.js (Müller-Breslau : une résolution par
section), foy.js (méthode des foyers en REAL*4, LI sur appuis, 300 coefficients), x87.js (Gauss avec arrondi aux seuls stockages),
inv.js / ulp.js (intervalles de flottants compatibles avec une valeur imprimée), miss.txt (450 valeurs fausses de F(exact)).
Comptes (cnt.js, inchangés) : réglage **59 904 / 66 019 (90,74 %)**, contrôle 3608 **5 982 / 6 745 (88,69 %)**. Aller-retour 19/19.

### Structure des valeurs fausses des LI en travée (banc v26, référence F(valeur exacte) : 450 / 5 874)
- 3603–3610 = une seule géométrie (13/18/18/13) répétée 7 fois : 7 × 54 = 378 des 450 ; 3826 38 ; 3639 28 ; 0063 3 ; 3488 3.
  Tout gain se joue sur ~5 géométries indépendantes (risque de calage élevé).
- Écart à F(exact) : −1 ulp 246, +1 ulp 138, le reste (±3, ±6) sur des petites valeurs (|v| < 1) : chaîne d'erreurs COURTE.
- Preuve que la valeur de section n'est pas ξ·M_appui (3603 T1, colonne B travée 2) : 0,5 L imprimé 8,504261 exige B₂ ≥ 17,0085211,
  0,6 L (10,205112) exige un ξ effectif < F(0,6) ; aucun flottant B₂ (± 3 ulps) n'est compatible avec un même ξ = F(k/20) ; décalages
  d'ulp exigés sur ξ (B₂ = 17,0085220) : 0,2 [−3,−1], 0,3 [−2,−1], 0,4 [−1,0], 0,5 [0], 0,6 [−2,−1], 0,7 [0], 0,8 [−1], 0,9 [−1],
  0,95 [−2,−1]. Générateurs testés : F(k/20) 3/9, cumul ξ += 0,05 ou 0,1 0–2/9, x cumulé x += F(L/10) puis x/L 4/9, x = F(k·F(L/20))
  puis x/L **7/9** (meilleur, échoue à 0,7 et 0,9), 1 − F(1 − ξ) 4/9.
- Asymétrie miroir (3603 T1 0,6 L −4,318686 / T4 0,4 L 4,318685, même valeur exacte) : compatible avec (1 − ξ) = F(1 − F(0,4))
  = 0,59999996 ; mais les chaînes complètes qui l'utilisent sont globalement pires.
### Variantes testées (valeurs fausses / 5 874, banc gen.js / mb.js)
- double exact 634 ; F(exact) 450–468 (précision étendue x87 avec un seul arrondi final : 450, identique) ;
- base des appuis REAL*4 (Gauss v14, Gauss avec B résolu, foyers) × formes (1−ξ)Mg + ξMd, Mg + ξ(Md − Mg), (Mg(L−x) + Md·x)/L,
  × ξ (F(k/20), cumuls, x/L) × isostatique (L(1−ξ) ou L − x) : 583 à 946 ;
- facteur focal (s > i : Md·(ξ − (1−ξ)φ_i) ; s < i : Mg·((1−ξ) − ξψ_i)) sur base foyers : ≥ 586 ;
- B de section = −(A + C) en REAL*4 : 497 et plus ; Müller-Breslau (une résolution de Gauss REAL*4 par section, second membre
  (1−ξ, ξ)) : 776–915. AUCUNE ne bat F(exact) ⇒ crochet PSIDA_LITF (v19) laissé à 0 (neutre au compteur).
### LI sur appuis (300 coefficients, foy.js / x87.js)
- Gauss sans pivot v14 (moteur) **281/300** ; méthode des foyers REAL*4 (rapports focaux φ_{k+1} = l_{k+1}/(2(l_k+l_{k+1}) − l_k φ_k),
  système 2×2 par travée chargée, det = 1/(φψ) − 1, propagation M_j = −φ_j M_{j+1}) **277/300** ; Gauss « x87 » (arrondi aux
  stockages seulement) 280/300 ; double 259/300. Fautes COMPLÉMENTAIRES : le Gauss rate 3603 B (appui 2, travée 2 : 17,008522 /
  17,008520 imprimé ; appui 4, travée 4), 3639 et 3826 B / A travée centrale ; les foyers ratent 3603 A propagés (1,972003) et la
  travée centrale de 3639 / 3826. Mélanger les deux serait un calage : non codé.
### Zones de longueur nulle « 0.00 » (positions A) — la LI n'en est PAS la cause
- 3603 T1 1,00 L imprime « 18.00 0.00 », 3607 (même géométrie 13/18/18/13, donc mêmes LI) « 18.00 » : le bruit numérique de la LI
  ne peut pas distinguer ces deux passages. La différence vient d'ailleurs (largeur 8 m / 11,30 m, nombre de voies, a1·a2 de A(l),
  K transversal, égalités dans le choix des zones) : piste pour une prochaine session. NON RÉSOLU.
### Points non résolus (inchangés)
LI travées 517 (REAL*4, chaîne SETRA non retrouvée — probablement autre algorithme que tout ce qui précède), LI V/R 78, réactions ±0,1
(22), zones « 0.00 », ferraillage longitudinal, résumé, ferraillage transversal, étriers, appareils (voir v25).

## Session v27 (2026-11-11) — page « APPUIS CONCENTRES » (espacement retrouvé, cisaillement non résolu), TB de face supérieure (constats) — moteur INCHANGÉ
Sauvegarde v26 : scratchpad psida_v26/. Outils hors moteur : scratchpad v27/ — pr.js (lecture des pages APPUIS CONCENTRES et appareils
imprimées, 19 passages), pc.js / d1.js / d2.js (données moteur par appareil), fit1.js (table des distances 3639), fit2.js (moindres carrés
cisaillement = (αG + β(R − G)) / (u·h) sur 14 passages), et.js (efforts tranchants des pages étriers), ko_*.txt (valeurs fausses).
Comptes (cnt.js, inchangés) : réglage **59 904 / 66 019 (90,74 %)**, contrôle 3608 **5 982 / 6 745 (88,69 %)**. Aller-retour 19/19.

### Page « REPARTITION DES ARMATURES DE CISAILLEMENT … APPUIS CONCENTRES » (module POINCON de la notice : « cisaillement de
### poinçonnement aux environs des appuis concentrés ») — RÈGLE PARTIELLE, page toujours NON imprimée
- **Espacement des étriers au voisinage immédiat : s = 0,9 At fe / (γs · DENCHA · (τ − 0,3 ftj)), γs = 1,15, tronqué à 0,01**
  (forme BAEL A.5.1,23 avec b0 = DENCHA, k = 1, τ = CISAILLEMENT MAXIMAL imprimé, ftj du bordereau en t/m²).
  3639 (At 0,001018, fe 50000, ftj 270, DENCHA 5,223) : 138,02 → 0,1376 → 0.13 ✓ ; 207,86 → 0,0609 → 0.06 ✓.
  Notice O001 (At 0,0016, fe 40000 — notice ancienne —, ftj 240 supposé, DENCHA 6,316) : 158,27 → 0,092 → 0.09 ✓ ; 202,04 → 0,061 → 0.06 ✓ ;
  215,73 → 0,0552 → 0.05 ✓. Avec b0 = E DALLE (largeur équivalente) au lieu de DENCHA : incompatible (τ0 différents culée / pile).
- Plafond : 0,40 en général ; 4015 (1960) imprime 0,38 partout (s calculé > 0,5) : At fe / (γs · DENCHA · 40 t/m²) = 0,3823 → 0.38 ;
  avec 0,4 MPa = 40,775 t/m² (étriers v8) : 0,375 → 0.37 tronqué / 0.38 arrondi. Un seul point : non tranché.
- Table « DISTANCES AU CENTRE DE L'APPAREIL » : lignes s ∈ {0,06 ; 0,08 ; 0,10 ; 0,12 ; 0,16 ; 0,20 ; 0,25 ; 0,32 ; 0,40}, imprimées pour
  s ≥ espacement immédiat de l'appui (3639 culée : à partir de 0,16 ; 4015 : seule la ligne 0,40) ; distance longitudinale = a/2 + r,
  transversale = b/2 + r (MÊME r : écart T − L = (b − a)/2 constant sur toutes les lignes, 3639 pile 0,10). Le niveau τs = 0,3 ftj +
  0,9 At fe / (γs DENCHA s) est atteint à r(s) ; 3639 pile : r = 0,28 (τs ≥ τmax) … 0,74 (s = 0,40), r + c ∝ τmax/τs avec c ≈ 0,15 (pile)
  et ≈ 0,30 (culée) : ni périmètre 2(a + b) + 2πr ni 2(a + b) + 8r, ni aire ; 4015 donne r < h/2 (0,175 à la culée) ⇒ τ(r) n'est pas un
  cisaillement de contour à h/2. Loi τ(r) NON RÉSOLUE.
- **Cisaillement maximal τ : NON RÉSOLU.** Constats : 3603 / 3604 (même réaction EN CHARGE pile 224,98 / 225,00, seuls changent le biais et
  l'appareil 0,35 × 0,45 / 0,30 × 0,55) : 128,86 / 126,04 ; culées (appareils identiques) 88,32 / 88,33 ⇒ τ dépend des dimensions de
  l'appareil, pas du biais (3604–3606 identiques). Rapport 1,02237 = (u + 0,1)/u avec u = 2(a + b) + 2,87 (H = 0,75) ou
  (a + x)(b + x) avec x ≈ 1,55. Moindres carrés (fit2.js) τ·u(·h) = αG + β(R − G) (G, R = A VIDE / EN CHARGE imprimés par appareil) pour
  u ∈ {1, P, P + 2H, P + πH, P + 4H, P + 8H, (a + H)(b + H), a + H, b + H} : écart max 23 à 43 % ⇒ AUCUNE forme « réaction par appareil /
  contour ». Rapport τ pile / τ culée sans lien avec R (2,0–2,3) ni V max des étriers (1,39–1,53) : 3826 1,597, 0063 1,436, 3603 1,459,
  3639 1,506, 3488 1,395, 3607 1,247 (nap 3 en culée, 4 sur pile). τ/R par appareil 0,65–0,71 (6 passages) mais pas affine.
- **DENCHA : NON RÉSOLU** (largeur b0 en m d'après la formule de l'espacement). 0063 5,763 / OA26 6,688 pour la même section (E DALLE
  7,999) : dépend des portées ou du nombre de groupes (nI 20 / 29) mais pas proportionnellement ; DENCHA / E DALLE 0,72–0,84 ;
  DENCHA / nI 0,23–0,36. Pistes non testées : largeur de « chaînage » (notice PSIDP p. 56 : chaînage de bord de largeur H à densité
  4 At/St), largeur de diffusion des réactions de la ligne d'appui.
- Page laissée NON imprimée (consigne : formule de τ et DENCHA non reproduites).

### Ferraillage transversal proposé (743 / 163) — reclassement (réglage, passages 1971 hors 3608)
- 3607 167, 3603 160 : face sup. TB absente (lignes T entières), zones 2 de pile PHI2/PHI3 ALT, 2D de culée « PHI2 TB » ; zones 1 / 2
  (espacements 0,240 / 0,175 … ) faussées par la SECTION DU CHEVÊTRE (EN CHARGE culée 3607 114,43 imprimé / 102,43 moteur : K convois D/E).
- 3826 78 : zones 1 / 2 (section de chevêtre : K convois D/E 2,211) ; MOMEMT / A ±1 (amont). 3488 75 : PHI2/PHI3 ALT partout (H = 0,84,
  non résolu, v5) — essai à la main « première option atteignant le plafond 0,325 » : contredit par 3826 (PHI3 0,304 retenu). 3609/3610
  62/66, 3606 34, 3639 21, 0063 17, 3605 12, OA26 2.
- **TB de face supérieure — critère (constat, NON codé)** : apparaît sur TOUTES les travées de 3603, 3607, 3608 et jamais sur 3604–3606,
  3609, 3610 ; il ne dépend ni du biais (3604 / 3608 à 90 gr) ni de la largeur seule, mais de la section A de travée (espacement) :
  TB ⇔ espacement ≤ 0,359 (A ≥ 0,000555) ; sans TB ⇔ espacement ≥ 0,397 (A ≤ 0,000496). Candidats compatibles : AU > 1,2 AP
  (3603 T2 0,000463 > 0,000450, marge 3 %), A > 0,75 ANF : ce sont des SEUILS AJUSTÉS (interdits par la SPEC) ⇒ non codés.
- Longueur TB sup. : W/(2 sin ψ) + reste, reste = 2,197 (W 8,0 ; E1 4,5 ; E2 3,5) / 3,28 (W 11,3 ; E1 7 ; E2 4,3) ; seulement deux largeurs
  indépendantes ⇒ toute forme affine serait un calage. Non codé.
### Points non résolus (classés par valeurs restantes, réglage)
ferraillage longitudinal 2 167* ; résumé 1 040* ; ferraillage transversal 743 ; LI travées 517 ; appareils 392 ; étriers 366 + page APPUIS
CONCENTRES absente (≈ 190 valeurs non comptées) ; moments 337 ; positions 304 ; flexion transversale 329 ; Guyon 75 ; LI V/R 78.
(* koall compte réglage + contrôle.)

## Session v28 (2026-11-16) — caractéristiques de section « recalculées » (piste PSIDP v31), regroupement des LIT, K des convois D/E — moteur INCHANGÉ (crochets d'essai seulement)
Sauvegarde v27 : scratchpad psida_v27/. Outils hors moteur : scratchpad v28/ — gen.js (notes moteur out_<id>.txt), pairs.js (partition des
rangs LIT/LST/LSA par origines et extrémités communes, listing ou moteur), dump.js (arrêts théoriques t_r des LIT via PSIDA_DUMP),
kcv.js (K des convois D/E imprimés / moteur, 39 lignes), ko_*.txt (valeurs fausses, koall).
Comptes (cnt.js) : réglage **59 904 / 66 019 (90,74 %)**, contrôle 3608 **5 982 / 6 745 (88,69 %)** — inchangés. Aller-retour 19/19.

### Piste PSIDP v31 (SETRA recalcule V, S, I depuis la géométrie) — SANS OBJET pour PSIDA, vérifié
- Le bordereau PSIDA ne contient AUCUNE caractéristique dérivée (A7 = HDALLE1–3, EDALLE1–3 seulement) ; le moteur calcule déjà A, yg, I,
  Eeq = 12 I/H³ exactement sur le polygone. La règle PSIDP est donc déjà appliquée.
- Essais inverses (crochet PSIDA_SECRND, bits) — SETRA utiliserait-il les valeurs ARRONDIES imprimées ? NON :
  Eeq au mm (1) −788 / −73 ; I à 1e-6 (2) −20 / 0 ; les deux (3) −795 / −73 ; I arrondi et Eeq = 12 I/H³ (6) −73 / −2 ;
  A, I, Eeq en REAL*4 (8) 0 / 0. E DALLE arrondie dans τ et s_max des étriers seulement (PSIDA_ETEQR = 1) −140 / −18.
- Hauteurs utiles NON arrondies au mm dans les calculs (PSIDA_DNR = 1) : −185 / −11 ⇒ SETRA arrondit bien d au mm (règle v3 confirmée).
- Conclusion : les écarts « inexpliqués » cités (3639 d_sup 0,457, rang 1 des LIT côté pile, LI à 1 ulp, K convois ±0,001) ne viennent
  PAS d'une caractéristique de section lue arrondie.

### Épure des LIT — structure des écarts (pairs.js, constat)
- SETRA forme les groupes d'arrêt (1,2,3)(4,5)(6,7)… ou (1,2)(3,4)… ; le moteur (regroupement v12, seuil ls) retrouve EXACTEMENT les
  mêmes partitions partout SAUF quand le rang 1 est séparé du rang 3 côté pile : 3603 LIT1 X, LIT2 X, LIT3 O, LIT4 O ; 3639 LIT1 X, LIT3 O
  (moteur (1,2)(3,4)… au lieu de (1,2,3)(4,5)…). Toute la suite du bloc est alors décalée d'un rang (et les LST de rang ≥ 4, copiées des
  LIT, aussi) : c'est la principale source des ~210 valeurs fausses par passage 3603–3606.
- Mesure (dump.js) : 3603 LIT1 côté pile t1 = 6,59 (imprimé 6,50 = 11,70 − tp 5,20), t3 = 5,60, ls = 0,96 ⇒ t1 − t3 = 0,99 > ls ; LIT2
  t1 = 7,33 (imprimé 7,25), t3 = 6,27 ⇒ 1,06 > 0,96 ; 3639 LIT1 5,22 / 4,05 (ls 1,10). Le rang 1 du moteur s'arrête 0,08–0,09 m trop loin
  vers la pile ; avec la valeur SETRA le regroupement (1,2,3) est retrouvé.
- Essai NÉGATIF : sections internes (0,15 … 0,85 L) calculées avec la LI MOYENNE des deux sections imprimées voisines (enveloppe
  intermédiaire entre la valeur exacte et la corde) : −599 / −98 (avec ou sans R1AVG). Non codé.

### K des convois D/E (Guyon) — constats (crochets d'essai PSIDA_CVW, PSIDA_CVNOD, PSIDA_CVGRID, PSIDA_CVD ; inactifs par défaut)
- État : 7 / 39 lignes COEFFICIENTS exactes (colonne D) ; 3607–3610 systématiquement −0,001 (1,011 / 1,012 ; 1,036 / 1,037 sur la fibre
  centrale, qui ne dépend pas de la position de l'axe).
- Largeur de bande 3,35–3,40 (plateau, ex. 3,375 = 27 × 0,125) : 18 / 39, compteur +46 / +16 — mais la largeur n'est PAS déterminée
  (3,35, 3,375, 3,40 donnent le même résultat) : c'est un calage ⇒ NON activé (SPEC).
- Intégration trapèzes au pas 0,125 depuis le bord de bande (CVNOD = 4) : corrige la fibre centrale (1,037) mais +0,002 ailleurs ; nœuds de
  grille seuls (2, 3), axe sur la grille (CVGRID 1–3), distance au bord 3,375–3,45 (CVD) : tous ≤ 16 / 39. NON RÉSOLU.
- Les 356 valeurs fausses des moments de 3607–3610 (colonne C.E. min, −0,1 %) en découlent.

### Points non résolus (classés par valeurs restantes, réglage + contrôle, koall)
ferraillage longitudinal 2 167 (regroupement rang 1 des LIT côté pile, cf. ci-dessus) ; résumé 1 040 (aciers comprimés de la vérification
aux sections les plus sollicitées : d' ELS 0,0548 / ELU 0,046 ; recopie de l'épure) ; ferraillage transversal 906 ; LI travées 574 ;
appareils 447 ; moments 426 (K convois 3607–3610) ; étriers 411 ; flexion transversale 374 ; positions 306 ; Guyon K 95 ; LI V/R 83.

## Session v29 (2026-11-16) — rang 1 des LIT côté pile (sections internes), K des convois D/E — moteur INCHANGÉ (crochets d'essai seulement)
Sauvegarde v28 : scratchpad psida_v28/. Outils hors moteur : scratchpad v29/ — env.js (enveloppe et composantes aux sections fines),
need.js (valeur d'enveloppe et moment ELU REQUIS à la section interne pour retrouver l'arrêt imprimé du rang 1), need2.js + spl.js
(interpolations spline), comp.js (composantes G, T, A, B, C aux sections internes), k9.js (K des convois : exact / 9 points GM),
kc.py (K des convois depuis la LI imprimée), c_*.txt (comptes). Comptes (cnt.js) : réglage **59 904 / 66 019 (90,74 %)**, contrôle 3608
**5 982 / 6 745 (88,69 %)** — inchangés. Aller-retour 19/19.

### Rang 1 des LIT côté pile — constats (NON RÉSOLU)
- K de Guyon : déjà calculés PAR TRAVÉE (gmSpan, r.gm[s].coef), identiques pour toutes les sections ⇒ la piste « K de la section
  imprimée voisine » est sans objet dans PSIDA.
- Valeur REQUISE à la section interne (need.js ; e = 0,8 H, interpolation linéaire, sections imprimées exactes) comparée à la valeur
  exacte et à la corde des voisines, w = (requis − corde)/(exact − corde) :
  0063 T1 D 0,35 ; 3488 T1 D 0,45 ; 3603 T1 D 0,36, T2 G 1,29, T2 D 0,59 ; 3607 T1 D 0,33, T2 G 1,01, T2 D 0,47 ; 3639 T1 D 0,47,
  T2 G 0,56. Côté GAUCHE de la travée 2 (vers l'appui 2, travée calculée) la valeur EXACTE convient (3603 tL 7,32 / imprimé 7,31 ;
  3607) ; côté DROIT (vers la pile suivante) et travée de rive côté pile, SETRA a une enveloppe nettement PLUS FORTE que le maximum
  exact : 3488 0,85 L moment ELU exact −41,4, requis ≈ +50,5 t·m ; 0063 11,2 → 68,9 ; 3603 T1 45,8 → 69,2 ; 3639 14,6 → 31,6.
  Le supplément n'est proportionnel ni à G (0,12–0,36 |G|), ni au tassement, ni au moment de la section 0,80 L (0,28–0,43).
- Comme le maximum exact sur toutes les positions est dépassé, AUCUNE variante « positions de convois de la section voisine » ne
  peut convenir (elle donne ≤ exact). Grille plus fine (PSIDA_NFIN = 30, 40, 100 avec R1AVG = 1) : arrêt exact continu 3603 T1 11,55
  (imprimé 11,70), T2 D 16,07 (16,25) ⇒ ce n'est pas un défaut de discrétisation ; une grille « décalée » (sections à a ≠ 0,85)
  demanderait a = 0,829–0,840 selon le passage (non constant).
- Variantes mesurées (crochet d'essai PSIDA_R1MODE, rang 1 seulement, sections internes ; réglage / contrôle, base 59 904 / 5 982) :
  1 = LI moyenne des sections imprimées voisines 59 863 / 5 952 ; 3 = G réparti par aires positives / négatives (γ max sur les aires
  défavorables) 59 882 / 5 962 ; 4 = composantes (G, T, A, B, C, trottoirs) interpolées puis combinées 59 885 / 5 961 ⇒ toutes NÉGATIVES.
- Crochet d'essai PSIDA_DSAMP = 1 (enveloppe décalée de ± 0,8 H échantillonnée aux sections de la grille fine puis interpolée
  linéairement, au lieu du décalage continu) : 59 817 / 5 982 ⇒ NÉGATIF. Interpolation spline cubique naturelle des 13 sections (en As
  ou en moment) : arrêts systématiquement entre l'exact et la corde mais encore trop courts de 0,005–0,01 L ⇒ non retenue.
- Coefficients γ : la page « ETAT-LIMITE D'OUVERTURE DES FISSURES » imprime γF3 1,125, γQL1 1,2, γQL2 0,9 — identiques au moteur.
- Conclusion : la corde (R1AVG = 0, publication v18) reste la meilleure règle non calée ; la règle SETRA (asymétrique gauche / droite
  dans une travée calculée !) reste à trouver. Piste suivante : l'asymétrie G/D suggère un calcul des sections internes qui dépend du
  sens de parcours (p. ex. sections internes calculées avec les moments sur appuis de la section imprimée précédente, a' = a − 0,05,
  pour la partie « appuis » de la LI : renforce le côté droit, affaiblit le côté gauche — à vérifier, non essayé faute de budget).

### K des convois D/E (Guyon) — constats (NON RÉSOLU)
- F61 1971 art. 10.4 : axe « réputé situé à 3,50 m du bord de la largeur chargeable » (position fixe). Sur 3607–3610 / 3826 (EGAU =
  EDROI = 0, chaussée 8 m) la position fixe ±0,50 m coïncide avec la borne de la plage libre actuelle ⇒ même résultat pour les fibres
  de rive ; la fibre centrale (axe) ne peut que baisser avec une position fixe. Largeur chargeable = chaussée − 2 × 0,50 m : axe à 0 ⇒
  fibre de rive 0,948 (imprimé 1,012) ⇒ exclu.
- K moyen sur 3,30 m (k9.js), cibles 3607 T1 1,012 / 1,018 / 1,037, T2 1,017 / 1,019 / 1,018 ; 3826 T1 1,019 / 1,029, T2 1,021 / 1,019 :
  exact 1,0107 / 1,0167 / 1,0364, 1,0163 / 1,0185 / 1,0184 ; 1,0209 / 1,0292, 1,0221 / 1,0186 ;
  K interpolé linéairement entre les 9 points GM (e = k b/4) 1,0128 / 1,0183 / 1,0348, 1,0174 / 1,0193 / 1,0176 ; 1,0225 / 1,0279,
  1,0231 / 1,0178 ; interpolation polynomiale à 9 points = exact. Aucune méthode ne satisfait les deux passages : 3607 veut des K
  de rive PLUS forts que l'exact, 3826 PLUS faibles (axe plus loin du bord) ⇒ la position de l'axe dépend de la géométrie
  (trottoirs 1,65 / 1,00 m ; b = 4,417 / 4,004) d'une façon non identifiée.
- Crochets ajoutés (inactifs) : PSIDA_NFIN (pas de la grille fine L/NF), PSIDA_R1MODE (1, 3, 4), PSIDA_DSAMP (1–3), PSIDA_EXPOSE
  (diagnostic : expose Kline).
- Indice PIPO tour 20 (règle des trapèzes à peu d'intervalles sur le K exact, axe calé à ±0,50 m) testé (scratchpad v29/k9t.js),
  n = 1, 2, 3, 4, 6 intervalles sur 3,30 m : la fibre centrale BAISSE (concavité : 3607 T1 1,0187 / 1,0327 / 1,0347 / 1,0354 / 1,0360,
  imprimé 1,037 > exact 1,0364) et 3826 rive monte (1,0256 → 1,0214, imprimé 1,019) ⇒ NÉGATIF pour PSIDA (aucun n ne convient).

## Session v30 (2026-11-16) — lecture du DOSSIER PILOTE PSIDA 68 (SETRA, MAJ août 1973) — moteur INCHANGÉ (crochets d'essai seulement)
Sauvegarde v29 : scratchpad psida_v29/. Transcription : /home/claude/ref/research/psida68/LECTURE.md. Outils : scratchpad v30/ —
kin.js / kin2.js / fin.js / fin2.js (coefficients d'inégalité : poutre infinie / finie), pc1.js … pc7.js (τ de poinçonnement imprimé
contre réactions). Comptes (cnt.js) : réglage **59 904 / 66 019 (90,74 %)**, contrôle 3608 **5 982 / 6 745 (88,69 %)** — inchangés.
Aller-retour 19/19.

### Contenu du dossier (constat)
- La **pièce 2.1** (méthodes : § 2.1.4, 4.3, 6.1.2, 6.1.5, 6.2.1.2) **n'est pas dans le PDF** ; les passages « épure d'arrêt » du texte
  (p. 64-70, 120-121, 186) concernent PREPUR / MRB-BA (dalles de biais prononcé), pas l'épure longitudinale PSIDA ⇒ rien de
  directement applicable à la priorité 1 (rang 1 des LIT côté pile).
- Carte A10 (p. 29) : N1 = 3 barres par groupe, N2 = 3 groupes « considérés ensemble pour l'épure d'arrêt », ESPAC1 modifiable par le
  programme ⇒ confirme la poutre élémentaire 3 × 3 (déjà codée).

### Poinçonnement (page APPUIS CONCENTRES) — FORME CONFIRMÉE, Qe NON RÉSOLU, page toujours NON imprimée
- Dossier p. 73-74 (pièce 4.1 § 5.2, renvoi au document type SETRA d'août 1966) : Q = Qe − 2,5 S ht − 1,2 P ; τ = 1,5 Q/(pc1 ht),
  pc1 = périmètre de l'appareil + 4 ht ; rectangles concentriques C ; τ tracé en fonction de la distance au centre de l'appareil.
- Listings (pc7.js, PILES, dimensions a × b IMPRIMÉES) : τ = 1,5 (1,33125 R − 1,35·2,5 (a+H)(b+H) H) / ((2(a+b)+4H) H), R = « EN CHARGE
  MAX. » par appareil : 3607-3610 exacts (0,00 à −0,04), 3603-3606 −0,05 à −0,21, 3639 −0,37, 3826 +0,54, 0063 +0,61, 3488 +0,83 ⇒ la
  forme 1968 (P + 4H, facteur 1,5, déduction du poids du rectangle) est la bonne à < 1 % (v27 : 23-43 % avec les dimensions du MOTEUR,
  qui diffèrent des dimensions imprimées) ; Qe exact (ELU par cas de charge ? 1,33125 = 1,125 × 1,42/1,2) non identifié.
  Avec la réaction ELU du moteur (champ chU ajouté à r.fer.appareils, sans effet sur la note) : rapport 0,96-1,00 sur les passages à
  réactions exactes, mais le moteur a de mauvaises dimensions d'appareils ⇒ à refaire une fois les dimensions corrigées.
- 3603 / 3604 (même R, appareils 0,35 × 0,45 / 0,30 × 0,55) : (u + 0,1)/u = 1,02237 ⇒ u = P + 2,87 ≈ P + 4H (H 0,75) ✓.
- CULÉES : contour ouvert coupé par l'about, u = (b + H) + 2(a/2 + H/2 + ABOUT), S = (b + H)(a/2 + H/2 + ABOUT) : X/R = 1,29-1,31 quand
  ABOUT < a/2 + H/2 (3488, 3603-3610) ≈ piles ; quand ABOUT ≥ a/2 + H/2 (3639, 3826, 0063, OA26) le contour fermé donne 1,64-1,72 :
  NON RÉSOLU (« effet de fuite » : le dossier renvoie au calcul manuel de 1966).
- Table des distances (3639 pile) : rectangles concentriques u(r) = P + 8r, distances a/2 + r et b/2 + r, τ(r) = 1,5 (Qe − q S(r))/(u(r) H),
  niveau τs(s) = 0,3 ftj + 0,9 At fe/(γs DENCHA s) : sans déduction (q = 0) r est trop grand de 0,01-0,03 aux grands s ; q ≈ 4 t/m²
  ramène tous les points à ≤ 0,01 m mais l'arrondi devient incohérent (plafond / arrondi) ⇒ NON codé. DENCHA : toujours rien.

### Convois D/E (dossier p. 32 carte B4, p. 182-184 SURCH 71)
- Convoi = « véhicule à action répartie » : 2 chenilles CHELA = ESCHE = 1,65 m, LARGCHA = 7,00 m (axe à 3,50 m du bord chargeable),
  POICHA 140 / 200 t, LOCHE 11 / 15 m ; variante « camion » : 6 essieux, intégration de la LI par 5 trapèzes.
- K de Guyon par la routine du char (crochet d'essai PSIDA_CVCH, compute.js, inactif) : 1 = entraxe 1,65, 2 = entraxe arrondi à la grille
  (1,625), 3 = bords de la largeur roulable. Lignes COEFFICIENTS exactes (kcv.js) : 0 → 7/39, 1 → 7/39, 2 → 16/39 (fibre centrale exacte,
  rives +0,002) ; compteur 1 : 59 874 / 5 972, 2 : 59 902 / 5 979 ⇒ NÉGATIF.
- Coefficients d'inégalité D/E (imprimés 3607 : 2,275 Na = 3 / 2,393 Na = 4 ; 3609 2,277 / 2,395 ; 3610 2,276 / 2,392 ; 3826 2,211 Na = 4),
  Mc120 1,516-1,519 / 1,594 (constant pour 85-100 gr) : poutre infinie (moteur) avec bande de largeur w : w ≈ 3,9 (3607) / 3,8 (3826) ;
  poutre FINIE de Na appuis, entraxe Eeq/(Na − 0,1), débords 0,45 ℓ (notice PSIDP p. 84) : 2,206 / 2,440 / 2,223 sans diffusion — ±3 %,
  aucune variante (largeur chargeable, entraxe imprimé × sin φ, diffusion H/2, H) n'est exacte ⇒ NON RÉSOLU, rien de codé.
  Remarque : le Mc120 imprimé ne varie pas avec le biais alors que l'entraxe × sin φ varie ⇒ l'entraxe utilisé est probablement
  indépendant du biais (ℓ sin φ = largeur/(Na − 0,1)).

### Entraxe non tronqué dans le chevêtre (notice PSIDA-EL p. 49, lecture de l'agent parallèle) — NÉGATIF
- Crochet d'essai PSIDA_ESPU (ferraillage.js, inactif) : largeur et moment de chevêtre avec l'entraxe non tronqué EDALLE1/(NAP − 0,6)/sin :
  59 901 / 5 982 (−3) ⇒ non retenu. NB : la formule de la notice (2b/sin φ)/(Na − 0,1) avec 2b = largeur équivalente ne reproduit PAS les
  entraxes imprimés du corpus (3607 : 2,33 contre 2,11) ; la formule du moteur reste la bonne pour PSIDA-EL.

### Autres éléments transcrits (non codés)
- Moment transversal retenu (MAJ n° 1, p. 185) : M_CR = Sup[Inf(1,2 M_AP ; M_NF/1,5) ; M_APo], M_NF avec σ28 = 3 σ̄b.
- Tassements aléatoires conseillés 1/1500 ou 1/750 de la plus courte portée adjacente (p. 186).

### Points non résolus (inchangés, classés)
ferraillage longitudinal (rang 1 des LIT côté pile) ; résumé ; ferraillage transversal (TB sup., section de chevêtre via K D/E) ; LI travées ;
appareils (dimensions, K D/E et Mc120 Na ≥ 4) ; page APPUIS CONCENTRES (Qe, culées à about large, arrondi des distances, DENCHA).

## Session 2026-11-16 (v31) — MAJCM Mc120 RÉSOLU grâce au dossier PSI-DA 68, pièce 2.5 « Méthode de calcul »
Source : SETRA, PSI-DA 68, pièce 2.5 (61 p., scan Scribd fourni par l'utilisateur ; OCR : ref/research/psida68_methode/methode.txt),
§ 2.4.2 p. 25-28. Chenille étalée transversalement sur λ = 1,00 + 2·HCHAU + HDALLE1 ; deux cas de charge seulement :
(1) une chenille centrée sur l'appareil, (2) les deux chenilles symétriques par rapport à l'appareil ; réaction moyenne par
SIMPSON (3 points). Avec la ligne d'influence de la poutre continue infinie (identique au polynôme du dossier :
1 − 2,196α² + 1,196α³ …), exact à 0,001 sur les 27 lignes d'appui (PSIDA + PSIDP, Na = 2/3/4) au lieu de −0,031.
Code : coefInegalite() (psida/ferraillage.js et psidp/compute.js) ; crochet PSIDA_MCFREE = 1 : ancien modèle.
PSIDA réglage 1971 90,7 → 90,9 %, contrôle 88,7 = ; PSIDP +0,1 sur 0015/0015A/2481/2764/2766.
Autres apports du dossier : MAJEC = même poutre infinie (déjà fait) ; MAJTR = trottoir le plus large sur l'appareil de rive ;
δ d'extrémité ½{δ adjacent + max(δ ; 1,5)} (Bc) et ½{δ + max(δ ; 1,2)} (char) ; poinçonnement : premier périmètre
(a + H)(b + H), DENCHA = densité uniforme charge + surcharge sur tout le tablier (formule exacte non donnée) — non codé.
Convois D/E : absents du dossier de 1968 (F61 1971) — toujours non résolus (essais 2 chenilles/bande + Simpson : erreur ≥ 0,10).
