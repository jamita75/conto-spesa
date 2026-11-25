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
    text: 'Titolare del trattamento: [ragione sociale, indirizzo, email di contatto — da completare].',
  },
  {
    title: 'Cosa resta sul tuo telefono',
    text: 'Carrello, buoni sconto, codici dei buoni e storico delle spese sono salvati solo sul tuo telefono. Le foto dei cartellini vengono lette sul telefono e non vengono inviate né conservate. Puoi cancellare tutto da Profilo → «Cancella tutti i miei dati».',
  },
  {
    title: 'Statistiche anonime (facoltativo)',
    text: 'Solo se attivi il consenso, a fine spesa viene preparato un riepilogo anonimo: giorno, tipo di negozio, insegna (solo se scelta dall\'elenco), nomi e prezzi dei prodotti, totale, sconto. Non contiene nome, numero di telefono, identificativo del dispositivo o posizione. Base giuridica: consenso (art. 6.1.a GDPR).',
  },
  {
    title: 'Condivisione con i negozi partner (facoltativo)',
    text: 'Solo se attivi questo secondo consenso, separato dal primo, le statistiche anonime e aggregate possono essere condivise, anche a titolo oneroso, con aziende della distribuzione organizzata per analisi di mercato e promozioni. Non vengono mai cedute informazioni che ti identificano.',
  },
  {
    title: 'I tuoi diritti',
    text: 'Puoi revocare i consensi in qualsiasi momento da Profilo, senza conseguenze sull\'uso dell\'app: i dati non ancora inviati vengono cancellati subito. Puoi chiedere accesso, rettifica, cancellazione e reclamo al Garante per la protezione dei dati personali.',
  },
];

export default function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: space(5), paddingBottom: space(12) }}>
      <Text style={styles.draft}>Bozza in revisione · versione {PRIVACY_POLICY_VERSION}</Text>
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
  draft: { fontSize: font.small, color: colors.danger, fontWeight: '700' },
  h: { fontSize: font.big, fontWeight: '800', color: colors.text, marginTop: space(5) },
  p: { fontSize: font.body, color: colors.text, marginTop: space(2), lineHeight: 25 },
});
