import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { PRIVACY_POLICY_VERSION } from '../features/consent/types';
import { colors, font, space } from '../lib/theme';

/**
 * BOZZA di informativa: da far verificare a un consulente privacy/DPO prima della pubblicazione
 * e da completare con i dati del titolare. Il testo definitivo va pubblicato anche sul sito
 * (link richiesto dal Play Store).
 */
const SECTIONS: { title: string; text: string }[] = [
  {
    title: 'Chi tratta i dati',
    text: 'Titolare del trattamento: Gian Maria Colotto. Contatto per la privacy: postmaster@creaitivity.it. Informativa completa: www.creaitivity.it/privacy-conto-spesa',
  },
  {
    title: 'Cosa resta sul tuo telefono',
    text: 'Carrello, buoni, codici dei buoni e storico delle spese restano solo sul telefono. Le foto dei cartellini vengono lette sul telefono e non vengono né inviate né conservate.',
  },
  {
    title: 'Statistiche d\'acquisto (solo con il tuo consenso)',
    text: 'Se accetti, a fine spesa l\'app invia: giorno e giorno della settimana, tipo di negozio, insegna (se scelta dall\'elenco), nome letto, reparto, prezzo e quantità dei prodotti, «marca del negozio», totale, sconto e numero di buoni usati. I dati sono collegati a un codice casuale creato sul telefono al momento del consenso: serve a capire le abitudini nel tempo senza sapere chi sei. Non raccogliamo nome, telefono, email, posizione, foto o identificativi del dispositivo. Il codice è un dato pseudonimo e quindi un dato personale protetto dal GDPR. Base giuridica: consenso (art. 6.1.a GDPR), facoltativo: l\'app funziona completamente anche senza.',
  },
  {
    title: 'Negozi partner (secondo consenso, separato)',
    text: 'Solo se lo accetti, le statistiche possono essere usate per report ai negozi partner, anche a pagamento. I partner ricevono solo dati aggregati (per insegna e reparto) che riguardano almeno 10 persone diverse: mai il codice, mai le singole spese. In cambio puoi ricevere nell\'app le loro offerte riservate.',
  },
  {
    title: 'Dove e per quanto',
    text: 'Sul server del titolare in Italia, per 24 mesi, poi cancellazione automatica. Il fornitore di hosting è responsabile del trattamento. Come ogni sito, il server può annotare l\'indirizzo di rete nei registri tecnici del fornitore; il sistema di raccolta non lo salva.',
  },
  {
    title: 'Offerte riservate',
    text: 'Con il consenso ai partner, all\'apertura l\'app scarica l\'elenco delle offerte da un file pubblico su GitHub, collegandosi a quel servizio come a un normale sito. Lo stato di «Socio fondatore» resta sul telefono.',
  },
  {
    title: 'I tuoi diritti',
    text: 'Da Profilo puoi in ogni momento: revocare i consensi (il codice viene eliminato e chiediamo al server di cancellare i dati collegati), scaricare i tuoi dati, cancellare tutto. Puoi esercitare i diritti di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione scrivendo al titolare, e proporre reclamo al Garante per la protezione dei dati personali. Il servizio di condivisione è riservato a chi ha almeno 14 anni.',
  },
];

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ padding: space(5), paddingBottom: space(12) + insets.bottom }}>
      <Text style={styles.draft}>Versione {PRIVACY_POLICY_VERSION}</Text>
      {SECTIONS.map((s) => (
        <React.Fragment key={s.title}>
          <Text style={styles.h}>{s.title}</Text>
          <Text style={styles.p}>{s.text}</Text>
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  draft: { fontSize: font.small, color: colors.muted, fontWeight: '700' },
  h: { fontSize: font.big, fontWeight: '800', color: colors.text, marginTop: space(5) },
  p: { fontSize: font.body, color: colors.text, marginTop: space(2), lineHeight: 25 },
});
