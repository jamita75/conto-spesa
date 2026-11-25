import * as Brightness from 'expo-brightness';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarcodeView } from '../components/BarcodeView';
import { BigButton } from '../components/ui';
import { describeCoupon } from '../features/coupons/couponLogic';
import { formatEuro } from '../lib/money';
import { font, space } from '../lib/theme';
import { useStore } from '../store/AppStore';

/** Schermo bianco con il codice a barre grande e luminosità al massimo, da mostrare in cassa. */
export default function CouponShow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  const coupon = state.coupons.find((c) => c.id === id);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let previous: number | undefined;
    Brightness.getBrightnessAsync()
      .then((b) => {
        previous = b;
        return Brightness.setBrightnessAsync(1);
      })
      .catch(() => {});
    return () => {
      if (previous != null) Brightness.setBrightnessAsync(previous).catch(() => {});
    };
  }, []);

  if (!coupon?.code) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + space(10) }]}>
        <Text style={styles.name}>Questo buono non ha un codice</Text>
        <BigButton label="Chiudi" onPress={() => router.back()} style={{ marginTop: space(6), alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space(8), paddingBottom: insets.bottom + space(6) }]}>
      <Text style={styles.name}>{coupon.name}</Text>
      <Text style={styles.rule}>
        {describeCoupon(coupon)} · spesa minima {formatEuro(coupon.minSpend)}
        {coupon.chain ? ` · ${coupon.chain}` : ''}
      </Text>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <BarcodeView code={coupon.code} width={width - space(8)} height={160} />
      </View>
      <Text style={styles.hint}>Fai leggere il codice al cassiere</Text>
      <BigButton label="Chiudi" variant="ghost" onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: space(4) }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff', alignItems: 'center', paddingHorizontal: space(4) },
  name: { fontSize: font.title, fontWeight: '800', color: '#000', textAlign: 'center' },
  rule: { fontSize: font.body, color: '#333', marginTop: space(2), textAlign: 'center' },
  hint: { fontSize: font.body, color: '#555' },
});
