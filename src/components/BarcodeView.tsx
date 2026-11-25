import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { makeBarcode } from '../features/barcode/encode';
import { colors } from '../lib/theme';

type Props = { code: string; width: number; height?: number; showText?: boolean };

/** Disegna il codice a barre del buono (EAN-13 o Code 128) con margini bianchi per la lettura in cassa. */
export function BarcodeView({ code, width, height = 110, showText = true }: Props) {
  const barcode = useMemo(() => makeBarcode(code), [code]);
  if (!barcode) {
    return <Text style={{ color: colors.danger }}>Codice non valido per il codice a barre</Text>;
  }

  const quiet = 10; // zona di rispetto a sinistra e a destra, in moduli
  const totalModules = barcode.modules.length + quiet * 2;
  const unit = width / totalModules;

  const bars: { x: number; w: number }[] = [];
  let i = 0;
  while (i < barcode.modules.length) {
    if (barcode.modules[i] === '1') {
      let j = i;
      while (j < barcode.modules.length && barcode.modules[j] === '1') j++;
      bars.push({ x: (quiet + i) * unit, w: (j - i) * unit });
      i = j;
    } else i++;
  }

  return (
    <View style={{ alignItems: 'center', backgroundColor: '#fff', paddingVertical: 8 }}>
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill="#fff" />
        {bars.map((b, k) => (
          <Rect key={k} x={b.x} y={0} width={b.w} height={height} fill="#000" />
        ))}
      </Svg>
      {showText ? (
        <Text style={{ fontSize: 18, letterSpacing: 3, marginTop: 6, color: '#000', fontWeight: '600' }}>{barcode.text}</Text>
      ) : null}
    </View>
  );
}
