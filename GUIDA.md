# Conto Spesa — guida rapida

## Cosa fa
- **Modalità AUTO** (attiva di base): punti il cartellino e basta. Quando il prezzo è chiaro lo aggiunge da solo con una vibrazione; compaiono «+1» (stesso prodotto un'altra volta) e «Annulla». Lo stesso cartellino non viene contato due volte finché non sposti il telefono. Se il prezzo è dubbio non aggiunge nulla: scatti e scegli tu.
- **Inquadra prezzo** (scatto manuale): scatti all'etichetta, l'app legge i prezzi e tu tocchi quello giusto (il prezzo al kg/litro è segnalato e non viene scelto in automatico). Dopo ogni prodotto resta in modalità scansione.
- **A mano**: inserisci prezzo, quantità e nome.
- **Totale** sempre visibile, quantità +/−, tieni premuto un prodotto per eliminarlo.
- **Coupon e obiettivi**: spesa minima, sconto in € o %, codice, scadenza. Senza sconto diventa un obiettivo («arrivare a 50 €»).
- **Linea coupon**: barra con un pallino per ogni coupon → «Mancano 6,20 € per Buono 5 €». Tocca un pallino per vedere il codice e copiarlo.
- Applica il coupon più conveniente (oppure li somma se attivi «cumulabili»). Mostra «Paghi X €».
- Tutto resta salvato sul telefono, funziona senza internet.

## 1. Installare sul PC (una volta)
1. Installa **Node.js LTS** da nodejs.org
2. Scompatta lo zip in `C:\Users\gmcol\Claude\Projects\Creaitivity\conto-spesa`
3. Apri il terminale in quella cartella ed esegui: `npm install`

## 2. Provare subito sul telefono (senza scansione)
1. Installa **Expo Go** dal Play Store
2. Sul PC: `npx expo start`
3. Inquadra il QR code con Expo Go

In Expo Go funziona tutto **tranne la lettura automatica del prezzo** (Expo Go non contiene il motore OCR): l'app ti chiede di scriverlo.

## 3. App completa con scansione (APK Android)
1. Crea un account gratuito su expo.dev
2. `npx eas-cli@latest login`
3. `npm run build:apk`
4. A fine build (in cloud, ~10-15 min) ricevi un link: aprilo dal telefono e installa l'APK.

Per iPhone serve l'account sviluppatore Apple (a pagamento).

## 4. Aggiungere funzioni con Claude Code
Apri Claude Code nella cartella del progetto e chiedi la funzione, es.:
- «Aggiungi uno storico delle spese con il totale del mese»
- «Aggiungi un budget massimo con avviso quando lo supero»
- «Fai leggere anche il codice a barre del coupon»

Il file `AGENTS.md` contiene già struttura e regole del progetto, così Claude Code sa dove mettere le mani.
Controlli prima di ogni build: `npm run typecheck` e `npm test`.
