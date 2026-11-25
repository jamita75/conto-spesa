import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BigButton, Card, SwitchRow } from '../components/ui';
import { colors, font, space } from '../lib/theme';
import { useStore } from '../store/AppStore';

/** Primo avvio: 2 passaggi. Spiegazione semplice + consensi privacy facoltativi (spenti). */
export default function Onboarding() {
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<0 | 1>(0);
  const [custom, setCustom] = useState(false);

  const finish = () => {
    dispatch({ type: 'onboarding/done' });
    router.replace('/');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(6), paddingTop: insets.top + space(8), paddingBottom: insets.bottom + space(6) }}
    >
      {step === 0 ? (
        <>
          <Text style={styles.logo}>🛒</Text>
          <Text style={styles.title}>Conto Spesa</Text>
          <Text style={styles.subtitle}>Sai sempre quanto stai spendendo, prima di arrivare in cassa.</Text>

          <View style={{ gap: space(4), marginTop: space(8) }}>
            <Step n="1" title="Inquadra il cartellino" text="L'app legge prezzo e nome del prodotto e lo aggiunge al conto." />
            <Step n="2" title="Guarda il totale" text="Il totale si aggiorna da solo. Puoi cambiare le quantità con + e −." />
            <Step n="3" title="Usa i tuoi buoni" text="Inserisci i buoni sconto: ti diciamo quanto manca per usarli e mostri il codice in cassa." />
          </View>

          <BigButton label="Avanti" onPress={() => setStep(1)} style={{ marginTop: space(10) }} />
        </>
      ) : (
        <>
          <Text style={styles.title}>Ci aiuti a migliorare?</Text>
          <Text style={styles.subtitle}>
            Le tue spese restano sul tuo telefono. Se vuoi, puoi condividere in forma anonima cosa compri: ci aiuta a
            migliorare l'app e a lavorare con i negozi partner su offerte e promozioni.
          </Text>

          <Card style={{ marginTop: space(6) }}>
            <Text style={styles.listTitle}>✓ Cosa condividi</Text>
            <Text style={styles.listText}>Prodotti, prezzi, reparto, tipo di negozio e giorno della spesa.</Text>
            <Text style={[styles.listTitle, { marginTop: space(3) }]}>✕ Cosa non condividi mai</Text>
            <Text style={styles.listText}>Nome, numero di telefono, posizione, foto.</Text>
            <Text style={[styles.listText, { marginTop: space(3) }]}>Puoi cambiare idea quando vuoi dal Profilo.</Text>
          </Card>

          {custom ? (
            <>
              <Card>
                <SwitchRow
                  title="Statistiche anonime"
                  help="Ci aiutano a migliorare l'app."
                  value={state.consent.stats}
                  onChange={(v) => dispatch({ type: 'consent/set', patch: { stats: v } })}
                />
              </Card>
              <Card>
                <SwitchRow
                  title="Condividi con i negozi partner"
                  help="Statistiche anonime e aggregate condivise con catene della distribuzione, anche a pagamento, per offerte e promozioni."
                  value={state.consent.partners}
                  onChange={(v) => dispatch({ type: 'consent/set', patch: { partners: v } })}
                />
              </Card>
              <BigButton label="Conferma le mie scelte" onPress={finish} style={{ marginTop: space(3) }} />
            </>
          ) : (
            <>
              {/* «Accetta» e «Rifiuta» con la stessa evidenza: il consenso deve essere libero (GDPR) */}
              <BigButton
                label="Accetta e continua"
                onPress={() => {
                  dispatch({ type: 'consent/set', patch: { stats: true, partners: true } });
                  finish();
                }}
                style={{ marginTop: space(2) }}
              />
              <BigButton
                label="Continua senza condividere"
                variant="ghost"
                onPress={() => {
                  dispatch({ type: 'consent/set', patch: { stats: false, partners: false } });
                  finish();
                }}
                style={{ marginTop: space(3) }}
              />
              <Text style={styles.link} onPress={() => setCustom(true)}>
                Scegli tu cosa condividere
              </Text>
            </>
          )}

          <Text style={styles.link} onPress={() => router.push('/privacy')}>
            Leggi l'informativa privacy
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepN}>
        <Text style={styles.stepNText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { fontSize: 64, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: space(2) },
  subtitle: { fontSize: font.body, color: colors.muted, textAlign: 'center', marginTop: space(3), lineHeight: 24 },
  step: { flexDirection: 'row', gap: space(4), alignItems: 'flex-start' },
  stepN: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNText: { color: '#fff', fontWeight: '800', fontSize: font.big },
  stepTitle: { fontSize: font.big, fontWeight: '800', color: colors.text },
  stepText: { fontSize: font.body, color: colors.muted, marginTop: 2, lineHeight: 23 },
  listTitle: { fontSize: font.body, fontWeight: '800', color: colors.text },
  listText: { fontSize: font.body, color: colors.muted, marginTop: 2, lineHeight: 23 },
  link: { fontSize: font.body, color: colors.primaryDark, fontWeight: '700', textAlign: 'center', marginTop: space(5), textDecorationLine: 'underline' },
});
