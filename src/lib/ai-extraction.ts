import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { obtenerImagenParaIA } from "@/lib/r2";

export const MEDIOS_DE_PAGO = [
  "Tarjeta de recaudo",
  "Bancolombia Nexo",
  "Davivienda Nexo",
] as const;

export type MedioDePago = (typeof MEDIOS_DE_PAGO)[number];

export const soporteSchema = z.object({
  extraccion_exitosa: z
    .boolean()
    .describe("true si se pudieron extraer datos del soporte, false si no"),
  tipo_documento: z
    .string()
    .nullable()
    .describe(
      "Tipo de documento identificado: Tirilla Redeban, App Bancolombia, Nequi, Davivienda, Banco Agrario, Wompi, Notificacion Bancolombia, etc."
    ),
  origen: z
    .string()
    .nullable()
    .describe(
      "Entidad o plataforma que genero el soporte: Redeban, Wompi, App Bancolombia, Nequi, Banco Davivienda, Banco Agrario, etc."
    ),
  datos: z.object({
    fecha_consignacion: z
      .string()
      .nullable()
      .describe("Fecha de la transaccion en formato YYYY-MM-DD"),
    valor_pagado: z
      .number()
      .nullable()
      .describe(
        "Monto pagado como numero entero sin decimales ni separadores. Ej: 531700"
      ),
    numero_voucher: z
      .string()
      .nullable()
      .describe(
        "Identificador del comprobante (Recibo, Comprobante No, Operacion, Referencia). Preservar ceros a la izquierda."
      ),
    medio_de_pago: z
      .enum(MEDIOS_DE_PAGO)
      .nullable()
      .describe(
        "Medio de pago segun destino: Tarjeta de recaudo (convenio Nutresa), Bancolombia Nexo (cuenta directa), Davivienda Nexo (canal Davivienda)"
      ),
  }),
  documentos_adicionales: z
    .array(
      z.object({
        valor_pagado: z
          .number()
          .nullable()
          .describe("Monto del documento adicional como entero sin decimales"),
        numero_voucher: z
          .string()
          .nullable()
          .describe("Voucher del documento adicional"),
      })
    )
    .nullable()
    .describe(
      "Otros comprobantes de pago encontrados en la MISMA imagen. Solo incluir si hay mas de un soporte visible."
    ),
  datos_adicionales: z
    .record(z.string(), z.string())
    .nullable()
    .describe(
      "Datos extra del documento para auditoria: apro, rrn, referencia, corresponsal, direccion, terminal, oficina, etc."
    ),
  confianza: z.object({
    nivel: z
      .enum(["alto", "medio", "bajo"])
      .describe(
        "alto: todos los campos claros. medio: algun campo requirio interpretacion. bajo: uno o mas campos inciertos."
      ),
    notas: z
      .string()
      .nullable()
      .describe("Explicacion breve si el nivel no es alto"),
  }),
  observaciones: z
    .string()
    .nullable()
    .describe(
      "Texto libre: escritura a mano, calidad de imagen, documentos multiples, anomalias"
    ),
});

export type DatosSoporte = z.infer<typeof soporteSchema>;

/**
 * Suma valor_pagado del documento principal + documentos_adicionales.
 * Retorna null si el principal no tiene monto (no hay datos de IA).
 */
export function calcularMontoExtraido(extraction: {
  datos?: { valor_pagado?: number | null } | null;
  documentos_adicionales?: { valor_pagado?: number | null }[] | null;
}): number | null {
  const principal = extraction.datos?.valor_pagado;
  if (principal == null) return null;
  const adicionales = (extraction.documentos_adicionales ?? []).reduce(
    (sum, d) => sum + (d.valor_pagado != null ? Number(d.valor_pagado) : 0),
    0
  );
  return Number(principal) + adicionales;
}

const SYSTEM_PROMPT = `Eres un sistema especializado en extraer datos estructurados de imágenes de soportes de pago colombianos. Estos soportes son comprobantes de consignaciones, transferencias o recaudos realizados por clientes a favor de **Nexo Distribuciones SAS** o al convenio de **Servicios Nutresa**.

## Paso 1 — Identificar el DESTINO del pago (define medio_de_pago)

Esta es la regla más importante. El medio_de_pago se determina por A DÓNDE fue el pago:

| Destino | Indicadores | medio_de_pago |
|---------|------------|---------------|
| Convenio Servicios Nutresa (Bancolombia) | Convenio: 24389, "SERVICIOS NUTRESA S" | Tarjeta de recaudo |
| Convenio Servicios Nutresa (Banco Agrario) | Convenio: 12431, "SERVICIOS NUTRESA SAS RCB" | Tarjeta de recaudo |
| Convenio Servicios Nutresa (Davivienda) | Código Convenio: 01102375, "SERVICIOS NUTRESA SAS" | Davivienda Nexo |
| Convenio Nexo Distribuciones (Davivienda) | Código Convenio: 1474915, "NEXO DISTRIBUCIONES" | Davivienda Nexo |
| Cuenta Bancolombia de Nexo | Cuenta 34200002735 o 342-000027-35, titular "NEXO DISTRIBUCIONES" | Bancolombia Nexo |
| Pago Proveedores Bancolombia | Nombre contiene "NEXO" o "FEND" | Bancolombia Nexo |

Regla general para combinaciones no listadas:
- Convenio Nutresa/Nexo vía corresponsal o banco (no Davivienda) → Tarjeta de recaudo
- Directo a cuenta Nexo en Bancolombia → Bancolombia Nexo
- Cualquier canal Davivienda → Davivienda Nexo
- No determinable → null en medio_de_pago, explicar en observaciones

## Paso 2 — Extraer numero_voucher según el banco

El campo numero_voucher es el identificador único de la transacción. Cada banco/plataforma lo etiqueta diferente:

| Banco/Plataforma | Campo del voucher | Notas |
|-------------------|------------------|-------|
| Redeban / Corresponsal Bancolombia | RECIBO | No confundir con RRN o APRO |
| Wompi / Corresponsal Bancolombia | Recibo | Puede ser tirilla física o digital |
| App Bancolombia | Comprobante No. | Sin ceros a la izquierda |
| Nequi | Referencia | Código alfanumérico |
| Banco Davivienda | No. Transaccion | Campo numérico |
| Banco Agrario | Operación | Junto a Terminal en el encabezado |
| Notificación Bancolombia (email/web) | — | No tiene voucher, devolver null. Incluir nombre del pago (ej: "NEXOFEND327131") en observaciones |

Si el banco no está en esta tabla, buscar el campo que funcione como identificador único de la transacción (número de referencia, aprobación, comprobante, etc.).

## Paso 3 — Reglas de extracción

1. **Valores monetarios**: En Colombia, punto = separador de miles, coma = decimales. "$1.282.500,00" = 1282500. Siempre devolver número entero sin decimales.
2. **Fechas**: Convertir siempre a YYYY-MM-DD. Meses en español: ENE, FEB, MAR, ABR, MAY, JUN, JUL, AGO, SEP, OCT, NOV, DIC.
3. **Número de voucher**: Extraer como string. PRESERVAR ceros a la izquierda: "008863" se mantiene como "008863".
4. **Imágenes con ruido**: Sombras, reflejos, fondos de escritorio, texto manuscrito — extraer solo datos del soporte impreso.
5. **Documentos rotados**: Leer en orientación correcta sin reportar error.
6. **Texto manuscrito**: Reportar en observaciones, NO mezclar con datos extraídos del documento impreso.
7. **Múltiples documentos**: Extraer el soporte principal (más completo/legible) en \`datos\`. Si hay otros comprobantes de pago visibles en la misma imagen, extraer su valor_pagado y numero_voucher en \`documentos_adicionales\`. El sistema sumará los montos automáticamente.
8. **Soporte junto a factura**: Ignorar la factura, extraer solo el comprobante de pago.

## Fallback para documentos desconocidos

Si el soporte no coincide con ningún banco o formato conocido, NO devolver extraccion_exitosa: false. Intentar extraer los datos con conocimiento general: buscar fecha, monto, y un identificador de transacción. Usar las reglas del Paso 1 para clasificar medio_de_pago si es posible. Establecer confianza nivel "medio" o "bajo" y explicar en observaciones qué tipo de documento parece ser.`;

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

  const { base64 } = await obtenerImagenParaIA(objectKey);

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
