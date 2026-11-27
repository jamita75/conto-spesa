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
const manipulatorAvailable = requireOptionalNativeModule('ExpoImageManipulator') != null;

export function isOcrAvailable(): boolean {
  return nativeAvailable;
}

async function extract(uri: string): Promise<string[]> {
  const { extractTextFromImage } = await import('expo-text-extractor');
  const lines = await extractTextFromImage(uri);
  // alcuni motori restituiscono blocchi multiriga: li spezziamo in righe singole
  return lines.flatMap((l) => l.split(/\r?\n/)).filter((l) => l.trim());
}

/**
 * Ritaglio della zona del riquadro bianco (centro dell'inquadratura), ingrandito.
 * Sui cartellini elettronici le cifre grigie su fondo grigio hanno poco contrasto:
 * togliendo scaffale, prodotti e riflessi attorno l'OCR si concentra sul cartellino.
 */
export function centerCrop(width: number, height: number) {
  const w = Math.round(width * 0.9);
  const h = Math.min(height, Math.round((w / 1.7) * 1.5));
  return { originX: Math.round((width - w) / 2), originY: Math.round((height - h) / 2), width: w, height: h };
}

/**
 * PROVA: ritaglio + bianco e nero + contrasto aumentato con Skia (libreria grafica).
 * Matrice colore: grigio = luminanza, poi contrasto ×CONTRAST attorno al grigio medio.
 */
const CONTRAST = 2.2;
async function extractEnhanced(uri: string, width: number, height: number): Promise<string[]> {
  const { Skia, ImageFormat } = await import('@shopify/react-native-skia');
  const { File, Paths } = await import('expo-file-system');
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) return [];
  const c = centerCrop(image.width() || width, image.height() || height);
  const outW = 1600;
  const outH = Math.round((c.height / c.width) * outW);
  const surface = Skia.Surface.Make(outW, outH);
  if (!surface) return [];
  const k = CONTRAST;
  const off = (1 - k) * 0.5;
  const row = [0.299 * k, 0.587 * k, 0.114 * k, 0, off];
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix([...row, ...row, ...row, 0, 0, 0, 1, 0]));
  const canvas = surface.getCanvas();
  canvas.drawImageRect(
    image,
    Skia.XYWHRect(c.originX, c.originY, c.width, c.height),
    Skia.XYWHRect(0, 0, outW, outH),
    paint,
  );
  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 92);
  const file = new File(Paths.cache, `ocr-contrasto-${Date.now()}.jpg`);
  await file.write(bytes);
  try {
    return await extract(file.uri);
  } finally {
    try {
      file.delete();
    } catch {
      // file temporaneo: nessun problema se resta in cache
    }
  }
}

async function extractCropped(uri: string, width: number, height: number): Promise<string[]> {
  try {
    const enhanced = await extractEnhanced(uri, width, height);
    if (enhanced.length) return enhanced;
  } catch {
    // Skia non disponibile o errore: si usa il ritaglio semplice
  }
  if (!manipulatorAvailable || !width || !height) return [];
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const ctx = ImageManipulator.manipulate(uri);
  ctx.crop(centerCrop(width, height));
  ctx.resize({ width: 1600 });
  const img = await ctx.renderAsync();
  const saved = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return extract(saved.uri);
}

/**
 * Legge il cartellino. `thorough`: due letture, la foto intera e il ritaglio ingrandito
 * del riquadro (per lo scatto manuale). Senza: solo il ritaglio, più veloce (modalità AUTO),
 * con la foto intera come ripiego se il ritaglio non dà nulla.
 */
export async function recognizeText(
  imageUri: string,
  size?: { width: number; height: number },
  thorough = true,
): Promise<string[]> {
  if (!nativeAvailable) return [];
  let cropped: string[] = [];
  try {
    if (size) cropped = await extractCropped(imageUri, size.width, size.height);
  } catch {
    cropped = [];
  }
  if (!thorough && cropped.length) return cropped;
  const full = await extract(imageUri);
  return [...cropped, ...full];
}
