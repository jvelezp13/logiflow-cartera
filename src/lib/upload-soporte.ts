/**
 * Utilidad client-side para subir soportes a R2.
 * Comprime la imagen y la sube en paralelo con la generacion de URL.
 * SOLO para uso en client components.
 */
import { comprimirImagen } from "@/lib/image-compression";
import { obtenerUrlSubida } from "@/lib/pagos-action";

export interface UploadSoporteResult {
  objectKey: string;
  fileName: string;
}

export async function uploadSoporte(
  codigoCliente: string,
  file: File,
  signal?: AbortSignal
): Promise<UploadSoporteResult> {
  const [compressed, { uploadUrl, objectKey, error }] = await Promise.all([
    comprimirImagen(file),
    obtenerUrlSubida(codigoCliente, file.name),
  ]);

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (error || !uploadUrl || !objectKey) {
    throw new Error(error || "Error al generar URL de subida");
  }

  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: compressed,
    headers: { "Content-Type": "image/webp" },
    signal,
  });

  if (!res.ok) throw new Error("Error al subir archivo");

  return { objectKey, fileName: file.name };
}
