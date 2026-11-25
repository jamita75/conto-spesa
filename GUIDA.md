# Conto Spesa — guida rapida

## Novità versione 1.3 — offerte riservate
- Al primo avvio: **«Sblocca e diventa Socio fondatore»** (accetta la condivisione anonima con un tocco) oppure «Continua senza condividere».
- Scheda Buoni: sezione **🎁 Offerte riservate**, chiusa col 🔒 per chi non condivide; si sblocca con un tocco.
- **Socio fondatore** ⭐: chi accetta entro il 30/06/2027 (data modificabile) vede per primo le offerte marcate `foundersOnly`.

### Pubblicare un'offerta di un negozio partner (senza aggiornare l'app)
1. Apri su GitHub il file `offers/offerte.json` del repository `conto-spesa` e premi la matita ✏️.
2. Copia il blocco `_esempio` dentro `"offers": [ ... ]` e cambia i valori (importi in centesimi: 300 = 3 €).
3. Premi **Commit changes**. Alla prossima apertura dell'app l'offerta compare a tutti quelli che hanno sbloccato le offerte.

## Novità versione 1.2
- **Icona nuova** (lampadina Creaitivity con carrello) e schermata di avvio.
- Ogni prodotto ha un **reparto** (proposto in automatico dal nome) e l'indicazione **Marca del negozio**. Tocca un prodotto nel carrello per correggerlo.
- **Buoni per segmento**: su tutta la spesa, solo marca del negozio, solo altre marche, o solo alcuni reparti (es. carne, frutta e verdura). La spesa minima conta solo quei prodotti e ogni buono ha la sua barra.
- **Valido dal … / Scade il …**: un buono non ancora iniziato non viene applicato e compare come promemoria.
- **Etichette del fresco**: sulle vaschette pesate legge l'importo «da pagare», ignorando peso e prezzo al kg.
- **Storico per reparto**: quanto spendi in carne, verdura, ecc. e quanto in prodotti a marchio del negozio.

## Novità versione 1.1
- 4 schede in basso: **Spesa**, **Buoni**, **Storico**, **Profilo**. Caratteri e pulsanti più grandi.
- Il cartellino viene letto anche per il **nome del prodotto** (correggibile).
- **Negozio**: in alto nella Spesa scegli Alimentare / Non alimentare e l'insegna. I buoni legati a un'insegna compaiono solo lì.
- **Spesa finita** salva la spesa nello **Storico**: totale del mese, alimentare vs non alimentare, prodotti di ogni spesa.
- **Buoni guidati**: «Sconto di __ se spendi almeno __ €», scelte rapide, scadenza dal **calendario**, codice scritto o **scansionato** → diventa un **codice a barre**. «Mostra in cassa» apre il codice a tutto schermo con luminosità al massimo.
- **Privacy**: al primo avvio due consensi facoltativi (statistiche anonime / condivisione con negozi partner), modificabili dal Profilo. Per ora i dati restano sul telefono: l'invio arriverà con il server.

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
