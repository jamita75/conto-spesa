import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { classifyProduct } from '../features/catalog/classify';
import { SEGMENTS, type Segment } from '../features/catalog/segments';
import type { PriceCandidate } from '../features/ocr/priceParser';
import { centsToInput, formatEuro, parseEuroInput, type Cents } from '../lib/money';
import { colors, font, radius, space } from '../lib/theme';

export type ItemDraft = { price: Cents; qty: number; label?: string; segment?: Segment; privateLabel?: boolean };

type Props = {
  initial?: Partial<ItemDraft>;
  /** insegna del negozio, per riconoscere il marchio del distributore */
  chain?: string;
  candidates?: PriceCandidate[];
  confirmLabel?: string;
  onConfirm: (data: ItemDraft) => void;
  onCancel?: () => void;
};

/** Pannello per confermare/modificare prezzo, quantità, nome, reparto e marca del negozio. */
export function ItemEditor({ initial = {}, chain, candidates = [], confirmLabel = 'Aggiungi', onConfirm, onCancel }: Props) {
  const first = initial.price ?? candidates.find((c) => !c.isUnitPrice)?.cents ?? candidates[0]?.cents;
  const guess = classifyProduct(initial.label, chain);
  const [priceText, setPriceText] = useState(first != null ? centsToInput(first) : '');
  const [qty, setQty] = useState(initial.qty ?? 1);
  const [label, setLabel] = useState(initial.label ?? '');
  const [segment, setSegment] = useState<Segment | undefined>(initial.segment ?? guess.segment);
  const [segmentTouched, setSegmentTouched] = useState(initial.segment != null);
  const [privateLabel, setPrivateLabel] = useState(initial.privateLabel ?? guess.privateLabel ?? false);
  const [plTouched, setPlTouched] = useState(initial.privateLabel != null);
  const price = parseEuroInput(priceText);
  const valid = price != null && price > 0;

  // mentre scrivi il nome, propone reparto e marca (finché non li scegli tu)
  const onLabel = (t: string) => {
    setLabel(t);
    const g = classifyProduct(t, chain);
    if (!segmentTouched && g.segment) setSegment(g.segment);
    if (!plTouched && g.privateLabel) setPrivateLabel(true);
  };

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
          autoFocus={candidates.length === 0 && initial.price == null}
          selectTextOnFocus
        />
      </View>

      <Text style={styles.label}>{initial.label ? 'Nome letto (correggi se serve)' : 'Nome del prodotto (facoltativo)'}</Text>
      <TextInput value={label} onChangeText={onLabel} placeholder="es. Latte intero" style={styles.input} />

      <Text style={styles.label}>Quantità</Text>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => setQty((q) => Math.max(1, q - 1))} accessibilityLabel="Togli uno">
          <Text style={styles.stepTxt}>−</Text>
        </Pressable>
        <Text style={styles.qty}>{qty}</Text>
        <Pressable style={styles.stepBtn} onPress={() => setQty((q) => q + 1)} accessibilityLabel="Aggiungi uno">
          <Text style={styles.stepTxt}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Reparto {segment && !segmentTouched ? '(proposto, tocca per cambiare)' : ''}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
        {SEGMENTS.map((s) => {
          const active = s.id === segment;
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                setSegment(s.id);
                setSegmentTouched(true);
              }}
              style={[styles.seg, active && styles.chipActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
              <Text style={[styles.segText, active && styles.chipTextActive]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        style={styles.plRow}
        onPress={() => {
          setPrivateLabel((v) => !v);
          setPlTouched(true);
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.plTitle}>Marca del negozio</Text>
          <Text style={styles.plHelp}>Prodotto con il marchio del supermercato (es. «Conad», «Coop»)</Text>
        </View>
        <Switch
          value={privateLabel}
          onValueChange={(v) => {
            setPrivateLabel(v);
            setPlTouched(true);
          }}
          trackColor={{ true: colors.primary }}
        />
      </Pressable>

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
          onPress={() =>
            valid &&
            onConfirm({ price: price!, qty, label: label.trim() || undefined, segment, privateLabel: privateLabel || undefined })
          }
        >
          <Text style={styles.btnText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(2) },
  label: { fontSize: font.small, color: colors.muted, fontWeight: '700', marginTop: space(2) },
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
  chipText: { fontSize: 18, fontWeight: '800', color: colors.text },
  chipTextActive: { color: colors.primaryDark },
  chipSub: { fontSize: 11, color: colors.muted },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    backgroundColor: colors.card,
  },
  euro: { fontSize: 28, fontWeight: '700', color: colors.muted, marginRight: space(2) },
  priceInput: { flex: 1, fontSize: 34, fontWeight: '800', color: colors.text, paddingVertical: space(2) },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(3),
    fontSize: font.body,
    backgroundColor: colors.card,
    color: colors.text,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignSelf: 'flex-start',
  },
  stepBtn: { paddingHorizontal: space(6), paddingVertical: space(2) },
  stepTxt: { fontSize: 28, fontWeight: '800', color: colors.primary },
  qty: { minWidth: 40, textAlign: 'center', fontSize: font.big, fontWeight: '800', color: colors.text },
  seg: {
    alignItems: 'center',
    paddingVertical: space(2),
    paddingHorizontal: space(3),
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    minWidth: 92,
  },
  segText: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 2, textAlign: 'center' },
  plRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space(3),
    marginTop: space(2),
  },
  plTitle: { fontSize: font.body, fontWeight: '800', color: colors.text },
  plHelp: { fontSize: 13, color: colors.muted, marginTop: 2 },
  lineTotal: { fontSize: font.small, color: colors.muted, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: space(3), marginTop: space(3) },
  btn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
  },
  btnGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
