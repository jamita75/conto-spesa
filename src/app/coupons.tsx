import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { describeCoupon, isExpired } from '../features/coupons/couponLogic';
import type { CouponKind } from '../features/coupons/types';
import { formatEuro, parseEuroInput } from '../lib/money';
import { colors, radius, space } from '../lib/theme';
import { useStore } from '../store/AppStore';

/** "31/12/2026" -> "2026-12-31" */
function parseItDate(text: string): string | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(year, Number(m[2]) - 1, Number(m[1]));
  if (d.getDate() !== Number(m[1])) return null;
  return `${year}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

const itDate = (iso: string) => iso.split('-').reverse().join('/');

export default function CouponsScreen() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [minSpend, setMinSpend] = useState('');
  const [kind, setKind] = useState<CouponKind>('amount');
  const [value, setValue] = useState('');
  const [expires, setExpires] = useState('');

  const save = () => {
    const min = parseEuroInput(minSpend);
    if (min == null || min <= 0) return Alert.alert('Manca la spesa minima', 'Indica da quale importo vale il coupon.');
    let v = 0;
    if (value.trim()) {
      if (kind === 'amount') {
        const c = parseEuroInput(value);
        if (c == null) return Alert.alert('Sconto non valido');
        v = c;
      } else {
        v = Math.round(Number(value.replace(',', '.')));
        if (!Number.isFinite(v) || v < 0 || v > 100) return Alert.alert('Percentuale non valida');
      }
    }
    const exp = parseItDate(expires);
    if (exp === null) return Alert.alert('Data non valida', 'Usa il formato gg/mm/aaaa');
    dispatch({
      type: 'coupon/add',
      coupon: {
        name: name.trim() || (v ? `Buono ${describeCoupon({ kind, value: v } as any)}` : `Obiettivo ${formatEuro(min)}`),
        code: code.trim() || undefined,
        minSpend: min,
        kind,
        value: v,
        active: true,
        expiresOn: exp,
      },
    });
    setName('');
    setCode('');
    setMinSpend('');
    setValue('');
    setExpires('');
  };

  const sorted = [...state.coupons].sort((a, b) => a.minSpend - b.minSpend);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: space(16) }} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nuovo coupon o obiettivo</Text>
          <Text style={styles.help}>
            Senza sconto diventa un semplice obiettivo di spesa (es. «arrivare a 50 €»).
          </Text>

          <Text style={styles.label}>Spesa minima per sbloccarlo *</Text>
          <TextInput style={styles.input} value={minSpend} onChangeText={setMinSpend} keyboardType="decimal-pad" placeholder="es. 50" />

          <Text style={styles.label}>Sconto</Text>
          <View style={styles.row}>
            <View style={styles.segment}>
              {(['amount', 'percent'] as const).map((k) => (
                <Pressable key={k} onPress={() => setKind(k)} style={[styles.segBtn, kind === k && styles.segActive]}>
                  <Text style={[styles.segTxt, kind === k && styles.segTxtActive]}>{k === 'amount' ? '€' : '%'}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder={kind === 'amount' ? 'es. 5' : 'es. 10'}
            />
          </View>

          <Text style={styles.label}>Nome</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="es. Buono volantino" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Codice</Text>
              <TextInput style={styles.input} value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="es. SCONTO5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Scadenza</Text>
              <TextInput style={styles.input} value={expires} onChangeText={setExpires} placeholder="gg/mm/aaaa" keyboardType="numbers-and-punctuation" />
            </View>
          </View>

          <Pressable style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveTxt}>Salva</Text>
          </Pressable>
        </View>

        <View style={[styles.card, styles.settingRow]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Coupon cumulabili</Text>
            <Text style={styles.help}>Se spento, applico solo il coupon più conveniente.</Text>
          </View>
          <Switch
            value={state.settings.stackCoupons}
            onValueChange={(v) => dispatch({ type: 'settings/update', patch: { stackCoupons: v } })}
            trackColor={{ true: colors.primary }}
          />
        </View>

        <View style={[styles.card, styles.settingRow]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Scansione automatica</Text>
            <Text style={styles.help}>
              Inquadri il cartellino e il prezzo si aggiunge da solo quando è chiaro. Se è dubbio, scatti e scegli tu.
            </Text>
          </View>
          <Switch
            value={state.settings.autoScan}
            onValueChange={(v) => dispatch({ type: 'settings/update', patch: { autoScan: v } })}
            trackColor={{ true: colors.primary }}
          />
        </View>

        <Text style={styles.section}>I tuoi coupon ({sorted.length})</Text>
        {sorted.length === 0 ? <Text style={styles.help}>Nessun coupon salvato.</Text> : null}
        {sorted.map((c) => {
          const expired = isExpired(c);
          return (
            <View key={c.id} style={[styles.coupon, (!c.active || expired) && { opacity: 0.55 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.couponName}>{c.name}</Text>
                <Text style={styles.couponSub}>
                  {describeCoupon(c)} da {formatEuro(c.minSpend)}
                  {c.code ? ` · ${c.code}` : ''}
                  {c.expiresOn ? ` · ${expired ? 'scaduto' : 'scade'} ${itDate(c.expiresOn)}` : ''}
                </Text>
              </View>
              <Switch
                value={c.active}
                onValueChange={(v) => dispatch({ type: 'coupon/update', id: c.id, patch: { active: v } })}
                trackColor={{ true: colors.primary }}
              />
              <Pressable
                hitSlop={10}
                onPress={() =>
                  Alert.alert('Eliminare il coupon?', c.name, [
                    { text: 'No', style: 'cancel' },
                    { text: 'Elimina', style: 'destructive', onPress: () => dispatch({ type: 'coupon/remove', id: c.id }) },
                  ])
                }
              >
                <Text style={styles.delete}>🗑️</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4), borderWidth: 1, borderColor: colors.border, marginBottom: space(3) },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  help: { fontSize: 13, color: colors.muted, marginTop: 2 },
  label: { fontSize: 13, color: colors.muted, fontWeight: '600', marginTop: space(3), marginBottom: space(1) },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(3), fontSize: 16, color: colors.text, backgroundColor: colors.bg },
  row: { flexDirection: 'row', gap: space(3), alignItems: 'flex-end' },
  segment: { flexDirection: 'row', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  segBtn: { paddingVertical: space(3), paddingHorizontal: space(4), backgroundColor: colors.bg },
  segActive: { backgroundColor: colors.primary },
  segTxt: { fontSize: 16, fontWeight: '800', color: colors.text },
  segTxtActive: { color: '#fff' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: space(3), alignItems: 'center', marginTop: space(4) },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  section: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: space(3), marginBottom: space(2) },
  coupon: { flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.card, borderRadius: radius.md, padding: space(3), borderWidth: 1, borderColor: colors.border, marginBottom: space(2) },
  couponName: { fontSize: 15, fontWeight: '700', color: colors.text },
  couponSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  delete: { fontSize: 20 },
});
