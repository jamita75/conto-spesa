import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { pickSponsored } from '../features/remote/config';
import { colors, font, radius, space } from '../lib/theme';
import { useRemoteConfig } from '../store/RemoteConfig';

/**
 * Spazio sponsorizzato: uno solo, in fondo alla lista, sempre con la scritta «Sponsorizzato da …».
 * Nessun tracciamento: non usa identificativi né invia dati (pubblicità contestuale, niente consenso).
 * Si accende e si cambia da config/app.json.
 */
export function SponsoredCard({ chain }: { chain?: string }) {
  const { config } = useRemoteConfig();
  const ad = pickSponsored(config, chain);
  if (!ad) return null;
  const open = () => ad.url && Linking.openURL(ad.url);
  return (
    <Pressable
      style={styles.card}
      onPress={open}
      disabled={!ad.url}
      accessibilityRole={ad.url ? 'link' : 'text'}
      accessibilityLabel={`Sponsorizzato da ${ad.advertiser}. ${ad.title}`}
    >
      <Text style={styles.label}>Sponsorizzato · {ad.advertiser}</Text>
      <Text style={styles.title}>{ad.title}</Text>
      {ad.text ? <Text style={styles.text}>{ad.text}</Text> : null}
      {ad.url ? (
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{ad.cta || 'Scopri di più'} →</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space(4),
    marginTop: space(4),
    padding: space(4),
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: font.body + 1, fontWeight: '800', color: colors.text, marginTop: space(1) },
  text: { fontSize: font.small, color: colors.muted, marginTop: 2, lineHeight: 20 },
  cta: { alignSelf: 'flex-start', marginTop: space(2) },
  ctaText: { fontSize: font.body, fontWeight: '800', color: colors.primaryDark },
});
