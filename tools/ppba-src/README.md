# PPBA — sources du module (ppba.html)

Moteur TypeScript du calcul des tabliers à poutres préfabriquées en béton armé.

- `src/engine/` : Guyon-Massonnet (`guyon.ts`), surcharges du fascicule 61 (`fasc61.ts`), sollicitations (`sollicitations.ts`), modules aval (`modules.ts` : superstructures, ferraillage et épure, contre-flèche, hourdis Thénoz, dallette, entretoises, levage, frettes), note de calcul (`note.ts`).
- `src/web/` : interface (`app.ts`) et worker (`worker.ts`).

Construction :

```
npm i -D typescript tsx esbuild
npx esbuild src/web/app.ts --bundle --minify --format=iife --outfile=../../ppba/ppba-app.js
npx esbuild src/web/worker.ts --bundle --minify --format=iife --outfile=../../ppba/ppba-worker.js
```

Calage : `EX=G npx tsx test/t_compare.ts` (grandes travées) et `EX=P …` (petites travées) comparent le moteur aux sorties .LIR du programme de référence ; ces fichiers de projet ne sont pas versionnés (dossier `ref/`).
