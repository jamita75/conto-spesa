# Conto Spesa – checklist privacy (da rivedere con il consulente privacy / DPO)

Bozza tecnica preparata durante lo sviluppo: non è un parere legale.

## Già fatto nell'app e nel server
| Requisito | Come è realizzato |
|---|---|
| Consenso libero, specifico, non preselezionato | Due consensi separati (statistiche / partner), spenti di default; «Continua senza condividere» con la stessa evidenza; app completa anche senza consenso |
| Informativa chiara | Schermata Privacy nell'app + pagina pubblica con shortcode `[contospesa_informativa]` |
| Età minima 14 anni (art. 2-quinquies Codice privacy) | Dichiarazione sotto il pulsante di consenso e nell'informativa |
| Minimizzazione | Nessun nome, telefono, email, posizione, foto, identificativo del dispositivo; solo giorno (non ora); insegna solo se dall'elenco |
| Pseudonimizzazione | Codice casuale (UUID v4) creato al consenso, non collegato ad altri dati |
| Riconferma dopo cambio di trattamento | Chi aveva acconsentito prima del codice pseudonimo deve riconfermare (consensi azzerati all'aggiornamento) |
| Revoca facile | Interruttori in Profilo; revoca totale = codice eliminato + cancellazione sul server; revoca partner = spese tolte dai report partner |
| Diritto di accesso / portabilità | «Scarica i miei dati» in Profilo (export dal server) |
| Diritto alla cancellazione | Revoca o «Cancella tutti i miei dati» → richiesta automatica al server, ritentata finché non va a buon fine |
| Conservazione limitata | 24 mesi, cancellazione automatica giornaliera |
| Dati ai partner solo anonimi | Report CSV aggregato insegna × reparto, solo righe con almeno 10 utenti diversi, solo da chi ha il consenso partner |
| Nessun IP salvato | Il plugin non registra IP (il limite di chiamate usa il codice) |
| Dati in UE | Server WordPress del titolare (hosting in Italia) |

## Da fare (titolare / consulente)
1. ✅ **Titolare**: Gian Maria Colotto, P.IVA IT02498820444, postmaster@creaitivity.it.
2. ✅ **Pagina informativa pubblica**: https://www.creaitivity.it/privacy-conto-spesa/ — da inserire nella scheda Play Store.
3. **Registro dei trattamenti** (art. 30 GDPR): aggiungere «Statistiche d'acquisto app Conto Spesa».
4. **Valutazione d'impatto (DPIA, art. 35)**: le abitudini d'acquisto analizzate nel tempo possono rientrare nei casi che la richiedono; farla valutare.
5. **Hosting**: verificare che il contratto con il fornitore includa l'accordo sul trattamento dei dati (art. 28) e quanto conserva i log; ricordare che i backup contengono le tabelle `cs_records` e `cs_items`.
6. **Contratti con i partner**: solo dati aggregati, divieto di re-identificazione, nessuna cessione a terzi.
7. **Play Store – Sicurezza dei dati**: dichiarare la raccolta facoltativa di «cronologia acquisti» per analisi, cifratura in transito, possibilità di cancellazione.
8. **Premi e concorsi**: buoni a estrazione = concorso a premio (DPR 430/2001), da organizzare con l'insegna promotrice.
9. **Chiave dell'app**: la chiave nel codice è un filtro anti-spam, non una protezione forte (il repository è pubblico). Se servisse più sicurezza, firmare le richieste o rendere privato il repository.
