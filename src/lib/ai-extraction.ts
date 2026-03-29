import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { obtenerImagenParaIA } from "@/lib/r2";

export const soporteSchema = z.object({
  monto: z
    .number()
    .nullable()
    .describe("Monto total de la transaccion en pesos colombianos, sin simbolo $"),
  fecha: z
    .string()
    .nullable()
    .describe("Fecha de la transaccion en formato YYYY-MM-DD"),
  banco_origen: z
    .string()
    .nullable()
    .describe("Banco o entidad financiera de origen"),
  referencia: z
    .string()
    .nullable()
    .describe("Numero de referencia, aprobacion o voucher de la transaccion"),
  tipo_operacion: z
    .string()
    .nullable()
    .describe("Tipo: transferencia, consignacion, datafono, pago_pse, otro"),
});

export type DatosSoporte = z.infer<typeof soporteSchema>;

const SYSTEM_PROMPT = `Sos un asistente especializado en leer comprobantes de pago colombianos.
Extraes datos estructurados de fotos de:
- Pantallazos de transferencias bancarias (Bancolombia, Davivienda, Nequi, etc.)
- Fotos de recibos de datafono
- Comprobantes de PSE

Reglas:
- Montos en pesos colombianos, solo el numero sin simbolo $ ni separadores
- Fechas en formato YYYY-MM-DD
- Si no podes leer un campo con confianza, devolvelo como null
- No inventes datos que no esten visibles en la imagen`;

/**
 * Extrae datos estructurados de una imagen de soporte de pago.
 * Retorna los datos parseados + el JSON crudo para auditoria.
 */
export async function extraerDatosSoporte(
  objectKey: string
): Promise<{ data: DatosSoporte; raw: unknown }> {
  if (process.env.ENABLE_AI_EXTRACTION === "false") {
    throw new Error("Extraccion IA deshabilitada (ENABLE_AI_EXTRACTION=false)");
  }

  const { base64, mimeType } = await obtenerImagenParaIA(objectKey);

  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: soporteSchema,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image" as const,
            image: Buffer.from(base64, "base64"),
          },
          {
            type: "text",
            text: "Extraer los datos de este comprobante de pago.",
          },
        ],
      },
    ],
  });

  return { data: object, raw: object };
}
