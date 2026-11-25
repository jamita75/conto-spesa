import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ItemEditor, type ItemDraft } from '../components/ItemEditor';
import { budgetStatus } from '../features/budget/budget';
import { cartSubtotal } from '../features/cart/types';
import { computeCouponProgress, couponsForStore } from '../features/coupons/couponLogic';
import { classifyProduct } from '../features/catalog/classify';
import { extractProductName } from '../features/ocr/nameParser';
import { extractPriceCandidates, pickConfidentPrice, type PriceCandidate } from '../features/ocr/priceParser';
import { isOcrAvailable, recognizeText } from '../features/ocr/recognizer';
import { formatEuro, type Cents } from '../lib/money';
import { colors, radius, space } from '../lib/theme';
import { newId, useStore } from '../store/AppStore';

type Phase = { kind: 'camera' } | { kind: 'reading' } | { kind: 'confirm'; candidates: PriceCandidate[]; name?: string };
type Toast = { id: string; price: Cents; qty: number; label?: string };

/** pausa tra una lettura automatica e la successiva */
const AUTO_INTERVAL_MS = 600;
/** letture uguali consecutive richieste prima di aggiungere da solo */
const AUTO_STABLE_READS = 2;
const TOAST_MS = 4000;

export default function ScanScreen() {
  const { state, dispatch } = useStore();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'camera' });
  const [toast, setToast] = useState<Toast | null>(null);
  const [autoStatus, setAutoStatus] = useState<'idle' | 'looking' | 'found'>('idle');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ocr = isOcrAvailable();
  // limite di spesa: colore del totale e riga nel messaggio di conferma
  const budget = state.settings.budget;
  const toPay = useMemo(
    () => computeCouponProgress(couponsForStore(state.coupons, state.store), state.items, state.settings.stackCoupons).toPay,
    [state.coupons, state.store, state.items, state.settings.stackCoupons],
  );
  const bStatus = budget ? budgetStatus(toPay, budget) : null;
  const pillColor = bStatus?.level === 'over' ? colors.danger : bStatus?.level === 'near' ? colors.accent : colors.primary;
  const auto = state.settings.autoScan && ocr;

  // stato della lettura continua (ref: non deve ridisegnare lo schermo)
  const busy = useRef(false);
  const streak = useRef<{ cents: Cents; count: number } | null>(null);
  /** ultimo prezzo aggiunto in automatico: bloccato finché l'inquadratura non cambia */
  const blocked = useRef<Cents | null>(null);

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const chain = state.store?.chain;
  const addItem = useCallback(
    (d: ItemDraft) => {
      const id = newId();
      dispatch({ type: 'item/add', id, item: { ...d, source: 'scan' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ id, price: d.price, qty: d.qty, label: d.label });
    },
    [dispatch, showToast],
  );

  // ---- lettura automatica continua ----
  useEffect(() => {
    if (!auto || !ready || phase.kind !== 'camera') {
      setAutoStatus('idle');
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!alive) return;
      if (!busy.current && camera.current) {
        busy.current = true;
        try {
          const photo = await camera.current.takePictureAsync({ quality: 0.5, shutterSound: false });
          if (!alive || !photo) return;
          const lines = await recognizeText(photo.uri);
          const pick = pickConfidentPrice(extractPriceCandidates(lines));
          if (!alive) return;

          // l'inquadratura è cambiata: lo stesso prezzo si potrà riaggiungere
          if (!pick || pick.cents !== blocked.current) blocked.current = null;

          if (!pick || pick.cents === blocked.current) {
            streak.current = null;
            setAutoStatus('looking');
          } else {
            const count = streak.current?.cents === pick.cents ? streak.current.count + 1 : 1;
            streak.current = { cents: pick.cents, count };
            setAutoStatus('found');
            if (count >= AUTO_STABLE_READS) {
              const label = extractProductName(lines);
              addItem({ price: pick.cents, qty: 1, label, ...classifyProduct(label, chain) });
              blocked.current = pick.cents;
              streak.current = null;
            }
          }
        } catch {
          // fotogramma non riuscito: si riprova al giro successivo
        } finally {
          busy.current = false;
        }
      }
      if (alive) timer = setTimeout(tick, AUTO_INTERVAL_MS);
    };

    setAutoStatus('looking');
    timer = setTimeout(tick, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [auto, ready, phase.kind, addItem, chain]);

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

  // scatto manuale: mostra sempre i prezzi trovati e chiede conferma
  const capture = async () => {
    if (!camera.current || !ready || phase.kind !== 'camera') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!ocr) {
      setPhase({ kind: 'confirm', candidates: [] });
      return;
    }
    setPhase({ kind: 'reading' });
    // aspetta che l'eventuale lettura automatica in corso finisca
    for (let i = 0; i < 20 && busy.current; i++) await new Promise((r) => setTimeout(r, 100));
    try {
      busy.current = true;
      const photo = await camera.current.takePictureAsync({ quality: 0.7, shutterSound: false });
      const lines = await recognizeText(photo.uri);
      setPhase({ kind: 'confirm', candidates: extractPriceCandidates(lines), name: extractProductName(lines) });
    } catch {
      setPhase({ kind: 'confirm', candidates: [] });
    } finally {
      busy.current = false;
    }
  };

  const toastPlusOne = () => {
    if (!toast) return;
    const qty = toast.qty + 1;
    dispatch({ type: 'item/update', id: toast.id, patch: { qty } });
    Haptics.selectionAsync();
    showToast({ ...toast, qty });
  };

  const toastUndo = () => {
    if (!toast) return;
    dispatch({ type: 'item/remove', id: toast.id });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setToast(null);
  };

  const hint = !ocr
    ? 'Lettura automatica disponibile nella versione installata (APK)'
    : auto
      ? autoStatus === 'found'
        ? 'Prezzo trovato, tieni fermo…'
        : 'Inquadra il cartellino: aggiungo da solo'
      : 'Inquadra il prezzo e scatta';

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
        <View style={[styles.frame, auto && autoStatus === 'found' && { borderColor: colors.accent }]} />
        <Text style={styles.hint}>{hint}</Text>
      </View>

      {/* barra superiore */}
      <View style={[styles.topBar, { paddingTop: insets.top + space(2) }]}>
        <Pressable style={styles.roundBtn} onPress={() => router.back()}>
          <Text style={styles.roundTxt}>✕</Text>
        </Pressable>
        <View style={[styles.totalPill, { backgroundColor: pillColor }]}>
          <Text style={styles.totalPillText}>{formatEuro(cartSubtotal(state.items))}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          {ocr ? (
            <Pressable
              style={[styles.autoBtn, state.settings.autoScan && styles.autoBtnOn]}
              onPress={() => dispatch({ type: 'settings/update', patch: { autoScan: !state.settings.autoScan } })}
            >
              <Text style={styles.autoTxt}>AUTO</Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.roundBtn, torch && { backgroundColor: colors.accent }]} onPress={() => setTorch((t) => !t)}>
            <Text style={styles.roundTxt}>💡</Text>
          </Pressable>
        </View>
      </View>

      {/* conferma aggiunta con annulla / +1 */}
      {toast ? (
        <View style={[styles.toast, { top: insets.top + 70 }]}>
          <View style={{ flex: 1 }}>
            {toast.label ? (
              <Text style={styles.toastName} numberOfLines={1}>
                {toast.label}
              </Text>
            ) : null}
            <Text style={styles.toastText}>
              +{formatEuro(toast.price * toast.qty)}
              {toast.qty > 1 ? ` (${toast.qty}×)` : ''}
            </Text>
            <Text style={styles.toastSub}>totale {formatEuro(cartSubtotal(state.items))}</Text>
            {bStatus ? (
              <Text
                style={[
                  styles.toastSub,
                  { fontWeight: '800', color: bStatus.level === 'over' ? colors.danger : bStatus.level === 'near' ? '#8A5A00' : colors.primaryDark },
                ]}
              >
                {bStatus.level === 'over' ? `⛔ oltre il limite di ${formatEuro(bStatus.over)}` : `restano ${formatEuro(bStatus.left)} del limite`}
              </Text>
            ) : null}
          </View>
          <Pressable style={styles.toastBtn} onPress={toastPlusOne}>
            <Text style={styles.toastBtnTxt}>+1</Text>
          </Pressable>
          <Pressable style={[styles.toastBtn, styles.toastUndo]} onPress={toastUndo}>
            <Text style={[styles.toastBtnTxt, { color: colors.danger }]}>Annulla</Text>
          </Pressable>
        </View>
      ) : null}

      {/* scatto */}
      {phase.kind !== 'confirm' ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space(6) }]}>
          <Pressable style={styles.shutter} onPress={capture} disabled={phase.kind === 'reading'}>
            {phase.kind === 'reading' ? <ActivityIndicator color={colors.primary} /> : <View style={styles.shutterInner} />}
          </Pressable>
          <Text style={styles.shutterHint}>
            {phase.kind === 'reading' ? 'Leggo il prezzo…' : auto ? 'Scatta per scegliere tu il prezzo' : 'Scatta'}
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
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
              key={phase.candidates.map((c) => c.cents).join('-') + (phase.name ?? '')}
              candidates={phase.candidates}
              initial={{ label: phase.name }}
              chain={chain}
              confirmLabel="Aggiungi e continua"
              onCancel={() => setPhase({ kind: 'camera' })}
              onConfirm={(d) => {
                addItem(d);
                setPhase({ kind: 'camera' });
              }}
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
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
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
  autoBtn: { height: 44, paddingHorizontal: space(3), borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  autoBtnOn: { backgroundColor: colors.primary, borderColor: '#fff' },
  autoTxt: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.8 },
  totalPill: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: space(2), paddingHorizontal: space(4) },
  totalPillText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  toast: {
    position: 'absolute',
    left: space(4),
    right: space(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: space(2),
    paddingLeft: space(4),
    paddingRight: space(2),
  },
  toastText: { fontWeight: '800', color: colors.primaryDark, fontSize: 17 },
  toastName: { fontWeight: '700', color: colors.text, fontSize: 14 },
  toastSub: { color: colors.muted, fontSize: 12 },
  toastBtn: { backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingVertical: space(2), paddingHorizontal: space(3) },
  toastUndo: { backgroundColor: '#FBE4E2' },
  toastBtnTxt: { fontWeight: '800', color: colors.primaryDark, fontSize: 15 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: colors.primary },
  shutterHint: { color: '#fff', marginTop: space(2), fontWeight: '600' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '75%' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  noRead: { fontSize: 14, color: colors.muted },
});
