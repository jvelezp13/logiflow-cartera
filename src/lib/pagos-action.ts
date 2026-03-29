"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { revalidatePath } from "next/cache";
import { generarUrlSubida, generarUrlLectura, eliminarObjeto } from "@/lib/r2";
import { extraerDatosSoporte, type DatosSoporte } from "@/lib/ai-extraction";
import { logError } from "@/lib/logger";

// --- Types ---

export interface PagoActionState {
  error?: string;
  success?: boolean;
  pagoId?: string;
}

export interface UrlSubidaResult {
  error?: string;
  uploadUrl?: string;
  objectKey?: string;
}

export interface ExtraccionResult {
  error?: string;
  data?: DatosSoporte;
  raw?: unknown;
}

export interface UrlVisualizacionResult {
  error?: string;
  url?: string;
}

interface FacturaInput {
  no_factura: string;
  valor_factura: number | null;
  valor_aplicado: number;
}

// --- Actions ---

/**
 * Genera presigned URL para subir soporte a R2.
 */
export async function obtenerUrlSubida(
  codigoCliente: string,
  nombreArchivo: string
): Promise<UrlSubidaResult> {
  try {
    const profile = await getUserProfile();
    if (profile.role === "viewer") {
      return { error: "No tienes permiso para subir soportes" };
    }

    const { uploadUrl, objectKey } = await generarUrlSubida(
      profile.tenant_id,
      codigoCliente,
      nombreArchivo
    );

    return { uploadUrl, objectKey };
  } catch (e) {
    logError("obtenerUrlSubida", e);
    return { error: "Error al generar URL de subida" };
  }
}

/**
 * Extrae datos de un soporte subido a R2 usando IA.
 */
export async function extraerDatos(
  objectKey: string
): Promise<ExtraccionResult> {
  try {
    const profile = await getUserProfile();
    if (profile.role === "viewer") {
      return { error: "No tienes permiso" };
    }

    if (!objectKey.startsWith(`${profile.tenant_id}/`)) {
      return { error: "No tienes acceso a este recurso" };
    }

    const { data, raw } = await extraerDatosSoporte(objectKey);
    return { data, raw };
  } catch (e) {
    logError("extraerDatos", e);
    return {
      error:
        "No pudimos leer los datos del soporte. Podes ingresarlos manualmente.",
    };
  }
}

/**
 * Genera presigned GET URL para visualizar un soporte.
 */
export async function obtenerUrlVisualizacion(
  soporteKey: string
): Promise<UrlVisualizacionResult> {
  try {
    const profile = await getUserProfile();

    if (!soporteKey.startsWith(`${profile.tenant_id}/`)) {
      return { error: "No tienes acceso a este recurso" };
    }

    const url = await generarUrlLectura(soporteKey);
    return { url };
  } catch (e) {
    logError("obtenerUrlVisualizacion", e);
    return { error: "Error al generar URL de visualizacion" };
  }
}

/**
 * Registra un pago con sus facturas vinculadas.
 * Compatible con useActionState.
 */
export async function crearPago(
  _prevState: PagoActionState | null,
  formData: FormData
): Promise<PagoActionState> {
  const profile = await getUserProfile();

  if (profile.role === "viewer") {
    return { error: "No tienes permiso para registrar pagos" };
  }

  // --- Parse FormData ---
  const codigoCliente = formData.get("codigo_cliente") as string;
  const fechaConsignacion = formData.get("fecha_consignacion") as string;
  const montoTotalStr = formData.get("monto_total") as string;
  const medioPago = (formData.get("medio_pago") as string) || null;
  const vouchersStr = (formData.get("vouchers") as string) || "";
  const numeroRecaudo = formData.get("numero_recaudo") as string;
  const numeroRecibo = formData.get("numero_recibo") as string;
  const observaciones =
    (formData.get("observaciones") as string)?.trim() || null;
  const notaCredito =
    (formData.get("nota_credito") as string)?.trim() || null;
  const valorNotaCreditoStr = formData.get("valor_nota_credito") as string;
  const soporteKey = (formData.get("soporte_key") as string) || null;
  const soporteNombre =
    (formData.get("soporte_nombre") as string) || null;
  const aiExtractionStr =
    (formData.get("ai_extraction") as string) || null;
  const facturasStr = formData.get("facturas") as string;

  // --- Validation ---
  if (!codigoCliente) return { error: "Cliente es requerido" };
  if (!fechaConsignacion) return { error: "Fecha de consignacion es requerida" };

  const montoTotal = parseFloat(montoTotalStr);
  if (!montoTotal || montoTotal <= 0) {
    return { error: "Monto debe ser mayor a 0" };
  }

  let facturas: FacturaInput[] = [];
  try {
    facturas = JSON.parse(facturasStr || "[]");
  } catch {
    return { error: "Formato de facturas invalido" };
  }

  if (facturas.length === 0) {
    return { error: "Debe seleccionar al menos una factura" };
  }

  // Parse vouchers (CSV) — max 4
  const vouchers = vouchersStr
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 4);

  // Parse optional numbers
  const recaudo = numeroRecaudo ? parseInt(numeroRecaudo, 10) : null;
  const recibo = numeroRecibo ? parseInt(numeroRecibo, 10) : null;
  const valorNotaCredito = valorNotaCreditoStr
    ? parseFloat(valorNotaCreditoStr)
    : null;

  // Parse AI extraction JSON
  let aiExtraction: unknown = null;
  if (aiExtractionStr) {
    try {
      aiExtraction = JSON.parse(aiExtractionStr);
    } catch {
      // no-op, campo opcional
    }
  }

  // Determinar estado
  const estado = recaudo !== null && recibo !== null ? "verificado" : "registrado";

  // --- Insert pago ---
  const supabase = await createClient();

  const { data: pago, error: pagoError } = await supabase
    .from("pagos")
    .insert({
      tenant_id: profile.tenant_id,
      codigo_cliente: codigoCliente,
      fecha_consignacion: fechaConsignacion,
      monto_total: montoTotal,
      medio_pago: medioPago,
      vouchers,
      numero_recaudo: recaudo,
      numero_recibo: recibo,
      observaciones,
      nota_credito: notaCredito,
      valor_nota_credito: valorNotaCredito,
      soporte_url: soporteKey
        ? `r2://${soporteKey}`
        : null,
      soporte_key: soporteKey,
      soporte_nombre: soporteNombre,
      estado,
      ai_extraction: aiExtraction,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (pagoError) {
    logError("crearPago:insert_pago", pagoError);
    return { error: "Error al registrar el pago" };
  }

  // --- Insert pago_facturas ---
  const facturasInsert = facturas.map((f) => ({
    pago_id: pago.id,
    no_factura: f.no_factura,
    valor_factura: f.valor_factura,
    valor_aplicado: f.valor_aplicado,
  }));

  const { error: facturasError } = await supabase
    .from("pago_facturas")
    .insert(facturasInsert);

  if (facturasError) {
    logError("crearPago:insert_facturas", facturasError);
    // Cleanup: eliminar pago huérfano para evitar inconsistencia
    await supabase
      .from("pagos")
      .delete()
      .eq("id", pago.id)
      .eq("tenant_id", profile.tenant_id);
    return { error: "Error al vincular facturas — pago no fue creado" };
  }

  revalidatePath(`/clientes/${codigoCliente}`);
  revalidatePath("/pagos");
  return { success: true, pagoId: pago.id };
}

/**
 * Completa los codigos CRM de un pago existente.
 */
export async function completarCodigosCRM(
  pagoId: string,
  data: { numero_recaudo?: number; numero_recibo?: number }
): Promise<PagoActionState> {
  const profile = await getUserProfile();

  if (profile.role === "viewer") {
    return { error: "No tienes permiso" };
  }

  const supabase = await createClient();

  // Leer pago actual para merge
  const { data: pagoActual, error: readError } = await supabase
    .from("pagos")
    .select("numero_recaudo, numero_recibo, codigo_cliente")
    .eq("id", pagoId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (readError || !pagoActual) {
    return { error: "Pago no encontrado" };
  }

  const nuevoRecaudo = data.numero_recaudo ?? pagoActual.numero_recaudo;
  const nuevoRecibo = data.numero_recibo ?? pagoActual.numero_recibo;
  const nuevoEstado =
    nuevoRecaudo !== null && nuevoRecibo !== null ? "verificado" : "registrado";

  const { error: updateError } = await supabase
    .from("pagos")
    .update({
      numero_recaudo: nuevoRecaudo,
      numero_recibo: nuevoRecibo,
      estado: nuevoEstado,
    })
    .eq("id", pagoId)
    .eq("tenant_id", profile.tenant_id);

  if (updateError) {
    logError("completarCodigosCRM", updateError);
    return { error: "Error al actualizar codigos CRM" };
  }

  revalidatePath(`/clientes/${pagoActual.codigo_cliente}`);
  revalidatePath("/pagos");
  return { success: true };
}

/**
 * Elimina un pago y su soporte de R2.
 * CASCADE en pago_facturas se encarga de las facturas vinculadas.
 */
export async function eliminarPago(
  pagoId: string
): Promise<PagoActionState> {
  const profile = await getUserProfile();

  if (profile.role === "viewer") {
    return { error: "No tienes permiso" };
  }

  const supabase = await createClient();

  // Leer pago para obtener soporte_key y codigo_cliente
  const { data: pago, error: readError } = await supabase
    .from("pagos")
    .select("soporte_key, codigo_cliente")
    .eq("id", pagoId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (readError || !pago) {
    return { error: "Pago no encontrado" };
  }

  // Borrar de DB (CASCADE borra pago_facturas)
  const { error: deleteError } = await supabase
    .from("pagos")
    .delete()
    .eq("id", pagoId)
    .eq("tenant_id", profile.tenant_id);

  if (deleteError) {
    logError("eliminarPago", deleteError);
    return { error: "Error al eliminar el pago" };
  }

  // Borrar soporte de R2 (best-effort, no falla si R2 tiene error)
  if (pago.soporte_key) {
    try {
      await eliminarObjeto(pago.soporte_key);
    } catch (e) {
      logError("eliminarPago:r2", e);
    }
  }

  revalidatePath(`/clientes/${pago.codigo_cliente}`);
  revalidatePath("/pagos");
  return { success: true };
}
