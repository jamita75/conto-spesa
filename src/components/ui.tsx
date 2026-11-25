import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type ViewStyle } from 'react-native';
import { colors, font, radius, space } from '../lib/theme';

/** Pulsante grande, facile da toccare. */
export function BigButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

const VARIANTS = {
  primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
  soft: { bg: colors.primarySoft, fg: colors.primaryDark, border: colors.primarySoft },
  ghost: { bg: colors.card, fg: colors.text, border: colors.border },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
};

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

/** Riga con titolo, spiegazione e interruttore. */
export function SwitchRow({
  title,
  help,
  value,
  onChange,
}: {
  title: string;
  help?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.switchRow} onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchTitle}>{title}</Text>
        {help ? <Text style={styles.help}>{help}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </Pressable>
  );
}

/** Scelta tra poche opzioni con pulsanti grandi (al posto dei menu a tendina). */
export function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.choiceWrap}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.choice, active && styles.choiceActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    paddingVertical: space(4),
    paddingHorizontal: space(4),
    alignItems: 'center',
    borderWidth: 1,
  },
  btnText: { fontSize: font.big - 2, fontWeight: '800' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space(4),
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space(3),
  },
  section: {
    fontSize: font.small,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: space(4),
    marginBottom: space(2),
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2) },
  switchTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  help: { fontSize: font.small, color: colors.muted, marginTop: 2, lineHeight: 20 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  choice: {
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  choiceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceText: { fontSize: font.body, fontWeight: '700', color: colors.text },
  choiceTextActive: { color: colors.primaryDark },
});
