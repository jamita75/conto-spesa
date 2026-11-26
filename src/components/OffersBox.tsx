import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { consentAction } from '../store/actions';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { describeCoupon, describeScope } from '../features/coupons/couponLogic';
import { visibleOffers } from '../features/offers/feed';
import { formatEuro } from '../lib/money';
import { colors, font, radius, space } from '../lib/theme';
import { useStore } from '../store/AppStore';

/**
 * Sezione «Scopri buoni che non conosci»: chiusa finché l'utente non dà l'autorizzazione
 * con i negozi partner. Le offerte arrivano dal file online, senza aggiornare l'app.
 */
export function OffersBox() {
  const { state, dispatch } = useStore();
  const unlocked = state.consent.partners;
  const isFounder = state.founderSince != null;

  if (!unlocked) {
    return (
      <Pressable
        style={[styles.box, styles.locked]}
        onPress={() =>
          Alert.alert(
            'Ricevi i buoni nuovi?',
            'Ci autorizzi a usare in forma anonima cosa compri (mai nome, telefono o posizione) e ti mandiamo qui i buoni dei negozi partner. Revochi quando vuoi dal Profilo. Confermi di avere almeno 14 anni.',
            [
              { text: 'Non ora', style: 'cancel' },
              {
                text: 'Sì, autorizzo',
                onPress: () => {
                  dispatch(consentAction({ stats: true, partners: true }));
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                },
              },
            ],
          )
        }
      >
        <Text style={styles.lock}>🎁</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ci sono buoni sconto che non conosci</Text>
          <Text style={styles.text}>Li ricevi qui, prima di fare la spesa. Serve solo la tua autorizzazione.</Text>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>✓ Autorizzo: voglio i buoni</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  const offers = visibleOffers(state.offers, isFounder);
  const claimed = new Set(state.coupons.map((c) => c.offerId).filter(Boolean));

  return (
    <View style={[styles.box, styles.open]}>
      <View style={styles.head}>
        <Text style={styles.title}>🎁 I tuoi buoni nuovi</Text>
      </View>

      {offers.length === 0 ? (
        <Text style={styles.text}>
          Quando un negozio attiva un buono nuovo, compare qui. Guarda prima di ogni spesa.
        </Text>
      ) : (
        offers.map((o) => {
          const taken = claimed.has(o.id);
          return (
            <View key={o.id} style={styles.offer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.offerTitle}>
                  {o.title}
                  {o.chain ? ` · ${o.chain}` : ''}
                </Text>
                <Text style={styles.offerSub}>
                  {describeCoupon(o)} su {describeScope(o.scope)}
                  {o.minSpend ? ` da ${formatEuro(o.minSpend)}` : ''}
                  {o.expiresOn ? ` · fino al ${o.expiresOn.split('-').reverse().join('/')}` : ''}
                </Text>
                {o.description ? <Text style={styles.offerSub}>{o.description}</Text> : null}
              </View>
              <Pressable
                disabled={taken}
                style={[styles.take, taken && styles.taken]}
                onPress={() => {
                  dispatch({ type: 'offer/claim', offer: o });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <Text style={[styles.takeText, taken && { color: colors.primaryDark }]}>{taken ? '✓ Tuo' : 'Prendilo'}</Text>
              </Pressable>
            </View>
          );
        })
      )}
      <Text style={styles.manage} onPress={() => router.push('/(tabs)/profile')}>
        Gestisci la condivisione
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, padding: space(4), marginBottom: space(4), borderWidth: 1.5 },
  locked: { flexDirection: 'row', gap: space(3), alignItems: 'center', backgroundColor: colors.accentSoft, borderColor: colors.accent, borderStyle: 'dashed' },
  open: { backgroundColor: colors.card, borderColor: colors.accent },
  lock: { fontSize: 36 },
  cta: { alignSelf: 'flex-start', marginTop: space(3), backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(4) },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: font.body },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2), flexWrap: 'wrap' },
  title: { fontSize: font.big, fontWeight: '800', color: colors.text },
  badge: { fontSize: 13, fontWeight: '800', color: colors.text, backgroundColor: colors.accentSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  text: { fontSize: font.body - 1, color: colors.muted, marginTop: 4, lineHeight: 22 },
  offer: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(3), paddingTop: space(3), borderTopWidth: 1, borderTopColor: colors.border },
  offerTitle: { fontSize: font.body, fontWeight: '800', color: colors.text },
  offerSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  take: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: space(3), paddingHorizontal: space(4) },
  taken: { backgroundColor: colors.primarySoft },
  takeText: { color: '#fff', fontWeight: '800', fontSize: font.body - 1 },
  manage: { fontSize: 13, color: colors.primaryDark, fontWeight: '700', marginTop: space(3), textDecorationLine: 'underline' },
});
