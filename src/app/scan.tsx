import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ItemEditor } from '../components/ItemEditor';
import { cartSubtotal } from '../features/cart/types';
import { extractPriceCandidates, type PriceCandidate } from '../features/ocr/priceParser';
import { isOcrAvailable, recognizeText } from '../features/ocr/recognizer';
import { formatEuro } from '../lib/money';
import { colors, radius, space } from '../lib/theme';
import { useStore } from '../store/AppStore';

type Phase = { kind: 'camera' } | { kind: 'reading' } | { kind: 'confirm'; candidates: PriceCandidate[] };

export default function ScanScreen() {
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'camera' });
  const [toast, setToast] = useState<string | null>(null);
  const ocr = isOcrAvailable();

  if (!permission) return <View style={styles.black} />;

  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.permTitle}>Serve la fotocamera</Text>
        <Text style={styles.permText}>Per leggere il prezzo dall'etichetta del prodotto.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Consenti</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: space(4) }}>
          <Text style={{ color: colors.muted }}>Indietro</Text>
        </Pressable>
      </View>
    );
  }

  const capture = async () => {
    if (!camera.current || !ready || phase.kind !== 'camera') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!ocr) {
      setPhase({ kind: 'confirm', candidates: [] });
      return;
    }
    setPhase({ kind: 'reading' });
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.7, shutterSound: false });
      const lines = await recognizeText(photo.uri);
      setPhase({ kind: 'confirm', candidates: extractPriceCandidates(lines) });
    } catch {
      setPhase({ kind: 'confirm', candidates: [] });
    }
  };

  const added = (price: number, qty: number, label?: string) => {
    dispatch({ type: 'item/add', item: { price, qty, label, source: 'scan' } });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newTotal = cartSubtotal(state.items) + price * qty;
    setToast(`+${formatEuro(price * qty)} · totale ${formatEuro(newTotal)}`);
    setTimeout(() => setToast(null), 2200);
    setPhase({ kind: 'camera' }); // resta in modalità scansione per il prodotto successivo
  };

  return (
    <View style={styles.black}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        onCameraReady={() => setReady(true)}
      />

      {/* mirino */}
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>
          {ocr ? 'Inquadra il prezzo dentro il riquadro' : 'Lettura automatica disponibile nella versione installata (APK)'}
        </Text>
      </View>

      {/* barra superiore */}
      <View style={[styles.topBar, { paddingTop: insets.top + space(2) }]}>
        <Pressable style={styles.roundBtn} onPress={() => router.back()}>
          <Text style={styles.roundTxt}>✕</Text>
        </Pressable>
        <View style={styles.totalPill}>
          <Text style={styles.totalPillText}>{formatEuro(cartSubtotal(state.items))}</Text>
        </View>
        <Pressable style={[styles.roundBtn, torch && { backgroundColor: colors.accent }]} onPress={() => setTorch((t) => !t)}>
          <Text style={styles.roundTxt}>💡</Text>
        </Pressable>
      </View>

      {toast ? (
        <View style={[styles.toast, { top: insets.top + 70 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* scatto */}
      {phase.kind !== 'confirm' ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space(6) }]}>
          <Pressable style={styles.shutter} onPress={capture} disabled={phase.kind === 'reading'}>
            {phase.kind === 'reading' ? <ActivityIndicator color={colors.primary} /> : <View style={styles.shutterInner} />}
          </Pressable>
          <Text style={styles.shutterHint}>{phase.kind === 'reading' ? 'Leggo il prezzo…' : 'Scatta'}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <ScrollView
            style={styles.sheet}
            contentContainerStyle={{ padding: space(4), paddingBottom: insets.bottom + space(4) }}
            keyboardShouldPersistTaps="handled"
          >
            {phase.candidates.length === 0 ? (
              <Text style={styles.noRead}>
                {ocr ? 'Prezzo non letto con sicurezza: scrivilo qui sotto o riprova avvicinandoti.' : 'Scrivi il prezzo:'}
              </Text>
            ) : null}
            <ItemEditor
              key={phase.candidates.map((c) => c.cents).join('-')}
              candidates={phase.candidates}
              confirmLabel="Aggiungi e continua"
              onCancel={() => setPhase({ kind: 'camera' })}
              onConfirm={({ price, qty, label }) => added(price, qty, label)}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(8), backgroundColor: colors.bg },
  permTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  permText: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: space(2) },
  permBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(8), marginTop: space(6) },
  permBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: '78%',
    aspectRatio: 1.7,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  hint: { color: '#fff', marginTop: space(3), fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: space(8) },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(4) },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  roundTxt: { color: '#fff', fontSize: 18 },
  totalPill: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: space(2), paddingHorizontal: space(4) },
  totalPillText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: space(2), paddingHorizontal: space(4) },
  toastText: { fontWeight: '800', color: colors.primaryDark, fontSize: 15 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: colors.primary },
  shutterHint: { color: '#fff', marginTop: space(2), fontWeight: '600' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '75%' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  noRead: { fontSize: 14, color: colors.muted },
});
