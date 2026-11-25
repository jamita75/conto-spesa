import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarcodeView } from '../components/BarcodeView';
import { BigButton, Choice, SectionTitle } from '../components/ui';
import { makeBarcode } from '../features/barcode/encode';
import { SEGMENTS, type Segment } from '../features/catalog/segments';
import type { CouponKind, CouponScope } from '../features/coupons/types';
import { CHAINS } from '../features/store/types';
import { centsToInput, formatEuro, parseEuroInput } from '../lib/money';
import { colors, font, radius, space } from '../lib/theme';
import { useStore } from '../store/AppStore';

const PRESETS: { label: string; value: string; kind: CouponKind; min: string }[] = [
  { label: '5 € su 50 €', value: '5', kind: 'amount', min: '50' },
  { label: '10 € su 100 €', value: '10', kind: 'amount', min: '100' },
  { label: '10% su 30 €', value: '10', kind: 'percent', min: '30' },
];

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const itDate = (d: Date) =>
  d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Inserimento guidato di un buono, scritto come una frase: "Sconto di X se spendi almeno Y". */
export default function CouponEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch } = useStore();
  const existing = state.coupons.find((c) => c.id === id);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [value, setValue] = useState(
    existing && existing.value > 0 ? (existing.kind === 'amount' ? centsToInput(existing.value) : String(existing.value)) : '',
  );
  const [kind, setKind] = useState<CouponKind>(existing?.kind ?? 'amount');
  const [minSpend, setMinSpend] = useState(existing ? centsToInput(existing.minSpend) : '');
  const [name, setName] = useState(existing?.name ?? '');
  const [chain, setChain] = useState<string>(existing?.chain ?? '');
  const [expires, setExpires] = useState<Date | undefined>(existing?.expiresOn ? fromIso(existing.expiresOn) : undefined);
  const [starts, setStarts] = useState<Date | undefined>(existing?.startsOn ? fromIso(existing.startsOn) : undefined);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [scopeKind, setScopeKind] = useState<CouponScope['kind']>(existing?.scope?.kind ?? 'all');
  const [segments, setSegments] = useState<Segment[]>(existing?.scope?.kind === 'segments' ? existing.scope.segments : []);
  const [code, setCode] = useState(existing?.code ?? '');
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const chainOptions = [...new Set([...(state.store?.chain ? [state.store.chain] : []), ...CHAINS.food, ...CHAINS.nonfood])];

  const onDate = (e: DateTimePickerEvent, d?: Date) => {
    const which = picker;
    if (Platform.OS !== 'ios') setPicker(null);
    if (e.type === 'set' && d) (which === 'start' ? setStarts : setExpires)(d);
  };
  const toggleSegment = (id: Segment) =>
    setSegments((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const startScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setScanning(true);
  };

  const onScanned = (r: BarcodeScanningResult) => {
    if (!scanning) return;
    setScanning(false);
    setCode(r.data);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const save = () => {
    const min = parseEuroInput(minSpend);
    if (min == null || min <= 0) {
      Alert.alert('Manca un dato', 'Scrivi da quanto devi spendere per usare il buono (es. 50).');
      return;
    }
    let v = 0;
    if (value.trim()) {
      if (kind === 'amount') {
        const c = parseEuroInput(value);
        if (c == null) return Alert.alert('Sconto non valido', 'Scrivi solo il numero, es. 5');
        v = c;
      } else {
        v = Math.round(Number(value.replace(',', '.')));
        if (!Number.isFinite(v) || v <= 0 || v > 100) return Alert.alert('Percentuale non valida', 'Scrivi un numero da 1 a 100');
      }
    }
    if (scopeKind === 'segments' && segments.length === 0) {
      return Alert.alert('Scegli il reparto', 'Tocca almeno un reparto su cui vale il buono (es. Carne).');
    }
    if (starts && expires && starts.getTime() > expires.getTime()) {
      return Alert.alert('Date da controllare', 'La data di inizio è dopo la scadenza.');
    }
    const scope: CouponScope | undefined =
      scopeKind === 'all' ? undefined : scopeKind === 'segments' ? { kind: 'segments', segments } : { kind: scopeKind };
    const cleanCode = code.trim() || undefined;
    if (cleanCode && !makeBarcode(cleanCode)) {
      return Alert.alert('Codice non valido', 'Il codice può contenere solo lettere, numeri e simboli comuni.');
    }
    const autoName = v
      ? kind === 'amount'
        ? `Buono ${formatEuro(v)}`
        : `Sconto ${v}%`
      : `Obiettivo ${formatEuro(min)}`;
    const data = {
      name: name.trim() || (chain ? `${autoName} ${chain}` : autoName),
      code: cleanCode,
      minSpend: min,
      kind,
      value: v,
      active: existing?.active ?? true,
      expiresOn: expires ? toIso(expires) : undefined,
      startsOn: starts ? toIso(starts) : undefined,
      chain: chain || undefined,
      scope,
    };
    if (existing) dispatch({ type: 'coupon/update', id: existing.id, patch: data });
    else dispatch({ type: 'coupon/add', coupon: data });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const remove = () =>
    Alert.alert('Eliminare il buono?', existing?.name, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: () => {
          dispatch({ type: 'coupon/remove', id: existing!.id });
          router.back();
        },
      },
    ]);

  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'upc_a', 'datamatrix'] }}
          onBarcodeScanned={onScanned}
        />
        <View style={styles.scanOverlay} pointerEvents="none">
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>Inquadra il codice a barre del buono</Text>
        </View>
        <View style={[styles.scanBottom, { paddingBottom: insets.bottom + space(4) }]}>
          <BigButton label="Annulla" variant="ghost" onPress={() => setScanning(false)} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(12) + insets.bottom }} keyboardShouldPersistTaps="handled">
        {!existing ? (
          <>
            <SectionTitle>Scelta rapida</SectionTitle>
            <View style={styles.presets}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  style={styles.preset}
                  onPress={() => {
                    setValue(p.value);
                    setKind(p.kind);
                    setMinSpend(p.min);
                  }}
                >
                  <Text style={styles.presetText}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <SectionTitle>Il buono</SectionTitle>
        <View style={styles.sentence}>
          <Text style={styles.word}>Sconto di</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="5"
            style={[styles.inlineInput, { width: 90 }]}
            accessibilityLabel="Valore dello sconto"
          />
          <Choice
            options={[
              { value: 'amount', label: '€' },
              { value: 'percent', label: '%' },
            ]}
            value={kind}
            onChange={setKind}
          />
        </View>
        <View style={[styles.sentence, { marginTop: space(3) }]}>
          <Text style={styles.word}>se spendi almeno</Text>
          <TextInput
            value={minSpend}
            onChangeText={setMinSpend}
            keyboardType="decimal-pad"
            placeholder="50"
            style={[styles.inlineInput, { width: 110 }]}
            accessibilityLabel="Spesa minima"
          />
          <Text style={styles.word}>€</Text>
        </View>
        <Text style={styles.help}>
          {scopeKind === 'all'
            ? 'Lascia vuoto lo sconto se vuoi solo un obiettivo di spesa (es. arrivare a 50 €).'
            : 'La spesa minima conta solo i prodotti scelti qui sotto.'}
        </Text>

        <SectionTitle>Su quali prodotti vale</SectionTitle>
        <Choice
          options={[
            { value: 'all', label: '🛒 Tutta la spesa' },
            { value: 'privateLabel', label: '🏷️ Marca del negozio' },
            { value: 'otherBrands', label: '⭐ Altre marche' },
            { value: 'segments', label: '🥩 Solo alcuni reparti' },
          ]}
          value={scopeKind}
          onChange={setScopeKind}
        />
        {scopeKind === 'segments' ? (
          <View style={[styles.presets, { marginTop: space(3) }]}>
            {SEGMENTS.filter((x) => x.id !== 'altro').map((x) => {
              const on = segments.includes(x.id);
              return (
                <Pressable key={x.id} style={[styles.preset, on && styles.presetActive]} onPress={() => toggleSegment(x.id)}>
                  <Text style={styles.presetText}>
                    {on ? '✓ ' : ''}
                    {x.emoji} {x.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <SectionTitle>Validità</SectionTitle>
        <Text style={styles.dateLabel}>Valido dal</Text>
        <View style={styles.row}>
          <Pressable style={[styles.dateBtn, { flex: 1 }]} onPress={() => setPicker('start')}>
            <Text style={styles.dateText}>📅 {starts ? itDate(starts) : 'Da subito'}</Text>
          </Pressable>
          {starts ? (
            <Pressable style={styles.clearBtn} onPress={() => setStarts(undefined)} accessibilityLabel="Togli data di inizio">
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.dateLabel}>Scade il</Text>
        <View style={styles.row}>
          <Pressable style={[styles.dateBtn, { flex: 1 }]} onPress={() => setPicker('end')}>
            <Text style={styles.dateText}>📅 {expires ? itDate(expires) : 'Nessuna scadenza'}</Text>
          </Pressable>
          {expires ? (
            <Pressable style={styles.clearBtn} onPress={() => setExpires(undefined)} accessibilityLabel="Togli scadenza">
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        {picker ? (
          <DateTimePicker
            value={(picker === 'start' ? starts : expires) ?? starts ?? new Date()}
            mode="date"
            minimumDate={picker === 'end' ? starts ?? new Date() : undefined}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onDate}
            locale="it-IT"
          />
        ) : null}

        <SectionTitle>Codice da mostrare in cassa</SectionTitle>
        <View style={styles.row}>
          <TextInput
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="es. SCONTO5"
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable style={styles.scanBtn} onPress={startScan}>
            <Text style={styles.scanBtnText}>📷{'\n'}Scansiona</Text>
          </Pressable>
        </View>
        {code.trim() ? (
          <View style={styles.preview}>
            <BarcodeView code={code} width={width - space(8) - space(8)} height={80} />
          </View>
        ) : (
          <Text style={styles.help}>Scrivi il codice o inquadra quello stampato: diventa un codice a barre da far leggere in cassa.</Text>
        )}

        <SectionTitle>Dove vale</SectionTitle>
        <View style={styles.presets}>
          <Pressable style={[styles.preset, !chain && styles.presetActive]} onPress={() => setChain('')}>
            <Text style={styles.presetText}>Tutti i negozi</Text>
          </Pressable>
          {chainOptions.slice(0, 12).map((c) => (
            <Pressable key={c} style={[styles.preset, chain === c && styles.presetActive]} onPress={() => setChain(c)}>
              <Text style={styles.presetText}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={chainOptions.slice(0, 12).includes(chain) ? '' : chain}
          onChangeText={setChain}
          placeholder="Altro negozio…"
          style={[styles.input, { marginTop: space(2) }]}
        />

        <SectionTitle>Nome (facoltativo)</SectionTitle>
        <TextInput value={name} onChangeText={setName} placeholder="es. Buono volantino" style={styles.input} />

        <BigButton label={existing ? 'Salva modifiche' : 'Salva buono'} onPress={save} style={{ marginTop: space(6) }} />
        {existing ? <BigButton label="Elimina buono" variant="danger" onPress={remove} style={{ marginTop: space(3) }} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  preset: {
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  presetActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  presetText: { fontSize: font.body, fontWeight: '700', color: colors.text },
  sentence: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(2) },
  word: { fontSize: font.big, fontWeight: '700', color: colors.text },
  inlineInput: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: space(3),
    paddingHorizontal: space(3),
    fontSize: font.title,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: colors.card,
    color: colors.text,
  },
  help: { fontSize: font.small, color: colors.muted, marginTop: space(2), lineHeight: 20 },
  row: { flexDirection: 'row', gap: space(2), alignItems: 'stretch' },
  dateLabel: { fontSize: font.small, fontWeight: '700', color: colors.muted, marginTop: space(2), marginBottom: space(1) },
  dateBtn: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space(4),
  },
  dateText: { fontSize: font.body, fontWeight: '700', color: colors.text },
  clearBtn: { justifyContent: 'center', paddingHorizontal: space(4), backgroundColor: colors.dangerSoft, borderRadius: radius.md },
  clearText: { fontSize: font.big, color: colors.danger, fontWeight: '800' },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space(4),
    fontSize: font.body,
    backgroundColor: colors.card,
    color: colors.text,
  },
  scanBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBtnText: { fontSize: font.small, fontWeight: '800', color: colors.primaryDark, textAlign: 'center' },
  preview: { marginTop: space(3), backgroundColor: '#fff', borderRadius: radius.md, padding: space(4), borderWidth: 1, borderColor: colors.border },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: '80%', height: 160, borderWidth: 3, borderColor: '#fff', borderRadius: radius.md },
  scanHint: { color: '#fff', fontSize: font.body, fontWeight: '700', marginTop: space(3) },
  scanBottom: { position: 'absolute', left: space(4), right: space(4), bottom: 0 },
});
