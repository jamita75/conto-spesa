import { requireOptionalNativeModule } from 'expo';

/**
 * Lettura del testo SUL TELEFONO (ML Kit su Android, Vision su iOS): gratis e offline.
 * In Expo Go il modulo nativo non c'è: l'app funziona lo stesso con l'inserimento manuale.
 * Per avere la scansione serve la "development build" o l'APK (vedi GUIDA.md).
 *
 * Per cambiare motore OCR in futuro (es. servizio cloud) basta sostituire questo file
 * mantenendo la stessa firma di recognizeText().
 */
const nativeAvailable = requireOptionalNativeModule('ExpoTextExtractor') != null;

export function isOcrAvailable(): boolean {
  return nativeAvailable;
}

export async function recognizeText(imageUri: string): Promise<string[]> {
  if (!nativeAvailable) return [];
  // import ritardato: in Expo Go il modulo non va caricato
  const { extractTextFromImage } = await import('expo-text-extractor');
  const lines = await extractTextFromImage(imageUri);
  // alcuni motori restituiscono blocchi multiriga: li spezziamo in righe singole
  return lines.flatMap((l) => l.split(/\r?\n/));
}
