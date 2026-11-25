import Constants from 'expo-constants';
import { router } from 'expo-router';
import { consentAction } from '../../store/actions';
import React from 'react';
import { Alert, ScrollView, Share, Text } from 'react-native';
import { exportFromServer } from '../../features/analytics/uploader';
import { BigButton, Card, SectionTitle, SwitchRow, styles as ui } from '../../components/ui';
import { colors, font, space } from '../../lib/theme';
import { useStore } from '../../store/AppStore';

export default function ProfileScreen() {
  const { state, dispatch } = useStore();
  const consentDate = state.consent.updatedAt ? new Date(state.consent.updatedAt).toLocaleDateString('it-IT') : null;

  const wipe = () =>
    Alert.alert(
      'Cancellare tutti i dati?',
      'Verranno eliminati carrello, buoni, storico delle spese e statistiche in attesa, e chiederemo al server di cancellare i dati collegati al tuo codice. Non si può annullare.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Cancella tutto', style: 'destructive', onPress: () => dispatch({ type: 'data/wipe' }) },
      ],
    );

  return (
    <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(10) }}>
      {state.founderSince ? (
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
          <Text style={{ fontSize: font.big, fontWeight: '800', color: colors.text }}>⭐ Socio fondatore</Text>
          <Text style={ui.help}>
            Dal {new Date(state.founderSince).toLocaleDateString('it-IT')}: hai accesso anticipato alle offerte dei negozi partner.
          </Text>
        </Card>
      ) : null}

      <SectionTitle>Fotocamera</SectionTitle>
      <Card>
        <SwitchRow
          title="Lettura automatica"
          help="Punti il cartellino e il prezzo si aggiunge da solo quando è chiaro. Se è dubbio, scatti e scegli tu."
          value={state.settings.autoScan}
          onChange={(v) => dispatch({ type: 'settings/update', patch: { autoScan: v } })}
        />
      </Card>

      <SectionTitle>Buoni sconto</SectionTitle>
      <Card>
        <SwitchRow
          title="Usa più buoni insieme"
          help="Se spento, uso solo il buono che ti fa risparmiare di più."
          value={state.settings.stackCoupons}
          onChange={(v) => dispatch({ type: 'settings/update', patch: { stackCoupons: v } })}
        />
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card>
        <SwitchRow
          title="Statistiche anonime"
          help="Prodotti, prezzi e tipo di negozio, senza dati che ti identificano. Ci aiutano a migliorare l'app."
          value={state.consent.stats}
          onChange={(v) => dispatch(consentAction({ stats: v }))}
        />
      </Card>
      <Card>
        <SwitchRow
          title="Condividi con i negozi partner"
          help="Statistiche anonime e aggregate condivise con catene della distribuzione, anche a pagamento."
          value={state.consent.partners}
          onChange={(v) => dispatch(consentAction({ partners: v }))}
        />
      </Card>
      <Text style={ui.help}>
        {consentDate ? `Ultima modifica: ${consentDate}. ` : ''}Puoi cambiare idea quando vuoi: se spegni tutto, i dati non ancora inviati vengono cancellati subito.
      </Text>
      {state.pid ? (
        <Card>
          <Text style={{ fontSize: font.body, fontWeight: '800', color: colors.text }}>Il tuo codice anonimo</Text>
          <Text style={ui.help}>
            {state.pid.slice(0, 8)}… · creato a caso sul telefono, non dice chi sei. Se revochi i consensi viene eliminato insieme ai dati sul server.
          </Text>
          <BigButton
            label="Scarica i miei dati"
            variant="ghost"
            style={{ marginTop: space(3) }}
            onPress={async () => {
              const data = await exportFromServer(state.pid!);
              if (!data) {
                Alert.alert('Non disponibile', 'Il server non risponde. Riprova più tardi.');
                return;
              }
              await Share.share({ title: 'I miei dati Conto Spesa', message: JSON.stringify(data, null, 2) });
            }}
          />
        </Card>
      ) : null}
      <BigButton label="Leggi l'informativa privacy" variant="ghost" onPress={() => router.push('/privacy')} style={{ marginTop: space(3) }} />
      <BigButton label="Cancella tutti i miei dati" variant="danger" onPress={wipe} style={{ marginTop: space(3) }} />

      <Text style={{ fontSize: font.small, color: colors.muted, textAlign: 'center', marginTop: space(8) }}>
        Conto Spesa · versione {Constants.expoConfig?.version ?? '—'}
      </Text>
    </ScrollView>
  );
}
