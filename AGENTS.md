This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Progetto: Conto Spesa

App per calcolare il totale della spesa inquadrando il cartellino (prezzo + nome prodotto), con
"linea coupon" che mostra quanto manca a ogni buono, buoni con codice a barre da mostrare in cassa,
storico delle spese e consensi privacy per statistiche anonime. Pubblico: anche utenti poco pratici
→ testi semplici in italiano, caratteri grandi, pulsanti grandi, niente menu nascosti.

### Struttura
- `src/app/(tabs)/` — schede: `index` Spesa, `coupons` Buoni, `history` Storico, `profile` Impostazioni/privacy.
- `src/app/` — schermate modali: `scan` (fotocamera, OCR, modalità AUTO), `add` (manuale), `store` (negozio),
  `coupon-edit` (buono guidato: calendario, scansione codice), `coupon-show` (codice a barre in cassa),
  `onboarding` (primo avvio + consensi), `privacy` (informativa BOZZA).
- `src/features/<funzione>/` — logica pura testabile: `cart`, `coupons`, `ocr` (prezzo + nome), `barcode`
  (EAN-13/Code128 verificati contro JsBarcode), `store` (tipologia GDO + insegne), `history`, `consent`, `analytics`,
  `catalog` (reparti con parole chiave, marchi del distributore/private label: elenchi da ampliare).
- `src/store/reducer.ts` — stato e reducer (senza React Native, testabile). `AppStore.tsx` — provider + salvataggio.
  Nuovi dati: campo in `AppState`, azione nel reducer, alzare `SCHEMA_VERSION` (ora 4) e gestire `migrate()`.
- `src/components/` — `ui.tsx` (BigButton, Card, SwitchRow, Choice), `CouponLine`, `ItemEditor`, `BarcodeView`.
- `tests/run.ts` — test della logica (`npm test`).
- `.github/workflows/build-apk.yml` — ogni push su main crea l'APK nelle Release del repo GitHub.

### Regole
- Importi SEMPRE in centesimi interi (`Cents`), formattazione con `formatEuro`.
- OCR solo tramite `src/features/ocr/recognizer.ts` (on-device): legge anche un ritaglio ingrandito del riquadro
  (`centerCrop`, expo-image-manipulator) per i cartellini a basso contrasto; nello scatto manuale si vede «Cosa ha letto il telefono». Deve restare opzionale (Expo Go → inserimento manuale).
- Privacy: due consensi separati, spenti di default, revocabili. Al primo consenso nasce un codice casuale
  (`pid`, pseudonimo = dato personale). Revoca totale / «Cancella tutto» → `pendingOps` forget verso il server.
  Ogni modifica ai consensi passa da `consentAction()` (store/actions.ts). Invio: `store/useServerSync.ts` +
  `features/analytics/uploader.ts` → plugin WordPress in `server/wordpress/conto-spesa-stats/` (test in `server/wordpress/tests/`:
  `api-harness.php` senza database, `analisi-mariadb.php` con MariaDB locale; `php -l` obbligatorio). Pagina admin
  «Analisi dettagliata» in `analisi.php`: ogni sezione = funzione che dà colonne+righe (tabella e CSV). Se cambia cosa si raccoglie: nuova versione informativa + riconferma.
  Checklist legale: `docs/PRIVACY-CHECKLIST.md`.
- Buoni: ambito `scope` (tutta la spesa / marca del negozio / altre marche / reparti), `startsOn` + `expiresOn`.
  La spesa minima di un buono con ambito conta solo i prodotti del suo ambito (`eligibleSubtotal`).
- Limite di spesa: `settings.budget` (centesimi, resta tra una spesa e l'altra), logica in `features/budget/`,
  confronto con `toPay` (totale meno buoni). Barra `BudgetBar` nella Spesa, modale `budget`, avvisi una sola volta
  al peggioramento in `store/useBudgetAlerts.ts` (montato nel layout delle schede, vale anche durante la scansione).
- Buoni della spesa in corso: `cartCoupons(state)` (reducer.ts) = buoni del negozio meno `skipCoupons` («Non oggi»,
  azzerato a fine spesa). Usare SEMPRE `cartCoupons` per totale/limite/avvisi. `CouponPicker` nella Spesa; avviso
  «buono sbloccato» in `store/useCouponAlerts.ts`; a fine spesa `markUsed` spegne i buoni applicati e salva `usedOn`.
  Scheda Buoni a sezioni (`sortCoupons`/`couponState`): da usare, più avanti, spenti, scaduti, già usati.
- Prezzi: il parser gestisce cartellini da scaffale, etichette del fresco pesato (peso, €/kg, «da pagare») e cartellini
  elettronici a segmenti (Conad/Hanshow: «279», «2»+«79», cifre lette come lettere). Controllo incrociato prezzo =
  €/kg (o €/l) × confezione letta dal nome (`extractQuantities`: G240, CL33X6, 1,5 L): conferma il prezzo giusto o lo calcola.
- Offerte riservate: `offers/offerte.json` nel repo (letto da `OFFERS_URL` all'apertura, solo con consenso partner).
  Si pubblicano offerte modificando quel file, senza aggiornare l'app. `founderSince` (consenso partner entro `FOUNDER_UNTIL`)
  resta solo interno: NON mostrare «Socio fondatore» né «offerte riservate». Linguaggio: invito all'azione, «Ci sono buoni
  sconto che non conosci», pulsante che dice chiaramente che serve l'autorizzazione («✓ Autorizzo: voglio i buoni»).
  Testi secondo i principi di Oren Klaff: brevi, concreti, novità/curiosità, mai supplicare; ma niente falsa scarsità e
  rifiuto sempre con la stessa evidenza (consenso libero, GDPR).
- Configurazione a distanza: `config/app.json` (letto da `CONFIG_URL` all'apertura e al ritorno in primo piano,
  `store/RemoteConfig.tsx`). `minVersionCode` > versionCode installato → `UpdateGate` blocca l'app con «Scarica
  l'aggiornamento»; `latestVersionCode` → `UpdateBanner` chiudibile. A ogni nuova versione alzare `android.versionCode`.
  Spazi sponsorizzati: `ads.enabled` + `ads.items` → `SponsoredCard` (uno solo, in fondo alla Spesa, «Sponsorizzato · …»,
  nessun tracciamento). Modifiche a `config/`, `offers/`, `server/` non rifanno l'APK.
- Regola generale: funzionalità e facilità d'uso prima di tutto, qualsiasi utente deve riuscire a usare l'app.
- Icona: sorgenti SVG in `assets/source/` (lampadina bicolore Creaitivity arancio/blu con carrello e €).
- Ogni nuova funzione: cartella in `src/features/`, logica pura + test in `tests/run.ts`, poi la schermata.
- Prima di chiudere un lavoro: `npm run typecheck` e `npm test`.

### Idee per il futuro (non ancora fatte)
- Lettura codice EAN del prodotto per nome/categoria automatici
- Lista della spesa condivisa
- Versione per il Play Store: AAB firmato con chiave propria
