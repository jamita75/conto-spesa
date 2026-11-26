import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, space } from '../lib/theme';
import { useRemoteConfig } from '../store/RemoteConfig';
import { BigButton } from './ui';

/**
 * Se la versione installata è più vecchia di minVersionCode (config/app.json)
 * l'app mostra solo questa schermata finché non si aggiorna. I dati sul telefono restano.
 */
export function UpdateGate({ children }: { children: React.ReactNode }) {
  const { config, need } = useRemoteConfig();
  const insets = useSafeAreaInsets();
  if (need !== 'force') return <>{children}</>;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space(10), paddingBottom: insets.bottom + space(6) }]}>
      <Text style={styles.emoji}>⬆️</Text>
      <Text style={styles.title}>C'è una versione nuova</Text>
      <Text style={styles.text}>
        {config.updateMessage || 'Per continuare a usare Conto Spesa scarica la versione nuova. Le tue spese e i tuoi buoni restano sul telefono.'}
      </Text>
      <BigButton label="Scarica l'aggiornamento" onPress={() => Linking.openURL(config.updateUrl)} />
      <Text style={styles.help}>
        Dopo il download apri il file e tocca «Aggiorna». Se il telefono lo chiede, consenti l'installazione dal browser.
      </Text>
    </View>
  );
}

/** Invito non bloccante (latestVersionCode): una riga nella Spesa, chiudibile. */
export function UpdateBanner() {
  const { config, need } = useRemoteConfig();
  const [hidden, setHidden] = useState(false);
  if (need !== 'suggest' || hidden) return null;
  return (
    <View style={styles.banner}>
      <Pressable style={{ flex: 1 }} onPress={() => Linking.openURL(config.updateUrl)} accessibilityRole="button">
        <Text style={styles.bannerTitle}>⬆️ È uscita una versione nuova</Text>
        <Text style={styles.bannerText}>Tocca qui per scaricarla.</Text>
      </Pressable>
      <Pressable onPress={() => setHidden(true)} hitSlop={10} accessibilityLabel="Chiudi">
        <Text style={styles.close}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space(6), justifyContent: 'center', gap: space(4) },
  emoji: { fontSize: 64, textAlign: 'center' },
  title: { fontSize: font.title + 4, fontWeight: '800', color: colors.text, textAlign: 'center' },
  text: { fontSize: font.body + 1, color: colors.text, textAlign: 'center', lineHeight: 26 },
  help: { fontSize: font.small, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    marginHorizontal: space(4),
    marginTop: space(3),
    padding: space(4),
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  bannerTitle: { fontSize: font.body, fontWeight: '800', color: colors.primaryDark },
  bannerText: { fontSize: font.small, color: colors.text, marginTop: 2 },
  close: { fontSize: 20, color: colors.muted, fontWeight: '700' },
});
