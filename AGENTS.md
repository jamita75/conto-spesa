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

App per calcolare il totale della spesa inquadrando il prezzo sull'etichetta, con "linea coupon"
che mostra quanto manca a ogni buono sconto / obiettivo. Interfaccia e testi in italiano.

### Struttura
- `src/app/` — schermate (Expo Router): `index` carrello, `scan` fotocamera+OCR, `add` inserimento manuale, `coupons` coupon e impostazioni.
- `src/features/<funzione>/` — logica pura senza UI (testabile): `cart`, `coupons`, `ocr`.
- `src/components/` — componenti riusabili (`CouponLine`, `ItemEditor`).
- `src/store/AppStore.tsx` — stato unico (reducer + AsyncStorage). Nuovi dati: campo in `AppState`, azioni nel reducer, alzare `SCHEMA_VERSION` e gestire `migrate()` se cambia la forma salvata.
- `tests/run.ts` — test della logica (`npm test`).

### Regole
- Importi SEMPRE in centesimi interi (`Cents`), formattazione con `formatEuro`.
- OCR solo tramite `src/features/ocr/recognizer.ts` (on-device, `expo-text-extractor`). Deve restare opzionale: in Expo Go l'app funziona con inserimento manuale.
- Ogni nuova funzione: cartella in `src/features/`, logica pura + test in `tests/run.ts`, poi la schermata.
- Prima di chiudere un lavoro: `npm run typecheck` e `npm test`.

### Idee per il futuro (non ancora fatte)
- Storico spese e statistiche mensili
- Budget massimo con avviso
- Lettura codice a barre e nome prodotto
- Scansione del coupon (codice/QR) dalla fotocamera
- Lista della spesa condivisa
