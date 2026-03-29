/**
 * Compresion client-side de imagenes antes de subir a R2.
 * Resize a max 1200px + conversion a WebP.
 * SOLO para uso en client components — no importar en server components.
 */

const MAX_WIDTH = 1200;
const WEBP_QUALITY = 0.8;

export async function comprimirImagen(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = bitmap.width > MAX_WIDTH ? MAX_WIDTH / bitmap.width : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY });
}
