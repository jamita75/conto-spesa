import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PriceCandidate } from '../features/ocr/priceParser';
import { centsToInput, formatEuro, parseEuroInput, type Cents } from '../lib/money';
import { colors, radius, space } from '../lib/theme';

type Props = {
  initialPrice?: Cents;
  /** nome letto dal cartellino (modificabile) */
  initialLabel?: string;
  candidates?: PriceCandidate[];
  confirmLabel?: string;
  onConfirm: (data: { price: Cents; qty: number; label?: string }) => void;
  onCancel?: () => void;
};

/** Pannello per confermare/modificare prezzo, quantità e nome prodotto. */
export function ItemEditor({ initialPrice, initialLabel, candidates = [], confirmLabel = 'Aggiungi', onConfirm, onCancel }: Props) {
  const first = initialPrice ?? candidates.find((c) => !c.isUnitPrice)?.cents ?? candidates[0]?.cents;
  const [priceText, setPriceText] = useState(first != null ? centsToInput(first) : '');
  const [qty, setQty] = useState(1);
  const [label, setLabel] = useState(initialLabel ?? '');
  const price = parseEuroInput(priceText);
  const valid = price != null && price > 0;

  return (
    <View style={styles.wrap}>
      {candidates.length > 0 ? (
        <>
          <Text style={styles.label}>Prezzi trovati: tocca quello giusto</Text>
          <View style={styles.chips}>
            {candidates.map((c) => {
              const active = price === c.cents;
              return (
                <Pressable
                  key={c.cents}
                  onPress={() => setPriceText(centsToInput(c.cents))}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{formatEuro(c.cents)}</Text>
                  {c.isUnitPrice ? <Text style={styles.chipSub}>al kg/l?</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={styles.label}>Prezzo</Text>
      <View style={styles.priceRow}>
        <Text style={styles.euro}>€</Text>
        <TextInput
          value={priceText}
          onChangeText={setPriceText}
          keyboardType="decimal-pad"
          placeholder="0,00"
          style={styles.priceInput}
          autoFocus={candidates.length === 0}
          selectTextOnFocus
        />
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Quantità</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
              <Text style={styles.stepTxt}>−</Text>
            </Pressable>
            <Text style={styles.qty}>{qty}</Text>
            <Pressable style={styles.stepBtn} onPress={() => setQty((q) => q + 1)}>
              <Text style={styles.stepTxt}>+</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flex: 1.4 }}>
          <Text style={styles.label}>{initialLabel ? 'Nome letto (correggi se serve)' : 'Nome (facoltativo)'}</Text>
          <TextInput value={label} onChangeText={setLabel} placeholder="es. Latte" style={styles.input} />
        </View>
      </View>

      {valid ? <Text style={styles.lineTotal}>Totale riga: {formatEuro(price! * qty)}</Text> : null}

      <View style={styles.actions}>
        {onCancel ? (
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
            <Text style={[styles.btnText, { color: colors.text }]}>Annulla</Text>
          </Pressable>
        ) : null}
        <Pressable
          disabled={!valid}
          style={[styles.btn, !valid && { opacity: 0.4 }]}
          onPress={() => valid && onConfirm({ price: price!, qty, label: label.trim() || undefined })}
        >
          <Text style={styles.btnText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(2) },
  label: { fontSize: 13, color: colors.muted, fontWeight: '600', marginTop: space(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: {
    paddingVertical: space(2),
    paddingHorizontal: space(3),
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 17, fontWeight: '700', color: colors.text },
  chipTextActive: { color: colors.primaryDark },
  chipSub: { fontSize: 10, color: colors.muted },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    backgroundColor: colors.card,
  },
  euro: { fontSize: 28, fontWeight: '700', color: colors.muted, marginRight: space(2) },
  priceInput: { flex: 1, fontSize: 34, fontWeight: '800', color: colors.text, paddingVertical: space(2) },
  row: { flexDirection: 'row', gap: space(3) },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  stepBtn: { paddingHorizontal: space(4), paddingVertical: space(2) },
  stepTxt: { fontSize: 24, fontWeight: '700', color: colors.primary },
  qty: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(3),
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
  lineTotal: { fontSize: 14, color: colors.muted, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: space(3), marginTop: space(3) },
  btn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
  },
  btnGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
