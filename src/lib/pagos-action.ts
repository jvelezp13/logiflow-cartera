"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { revalidatePath } from "next/cache";
import { generarUrlSubida, generarUrlLectura, eliminarObjeto } from "@/lib/r2";
import { extraerDatosSoporte, type DatosSoporte } from "@/lib/ai-extraction";
import { logError } from "@/lib/logger";
import { syncFetch } from "@/lib/sync-client";
import { formatCurrencyFull } from "@/lib/format";
import { UMBRAL_REDONDEO_PAGO } from "@/lib/constants";

// --- Helpers ---

function parseVouchers(csv: string): string[] {
  return csv.split(",").map((v) => v.trim()).filter(Boolean).slice(0, 4);
}

function validarFechaConsignacion(fecha: string): string | null {
  const hoy = new Date().toISOString().slice(0, 10);
  const haceUnAno = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  if (fecha > hoy) return "La fecha de consignación no puede ser futura";
  if (fecha < haceUnAno) return "La fecha de consignación no puede ser mayor a 1 año";
  return null;
}

// --- Types ---

export interface VoucherDuplicadoInfo {
  pago_id: string;
  codigo_cliente: string;
  fecha_consignacion: string;
  monto_total: number;
}

export interface PagoActionState {
  error?: string;
  success?: boolean;
  pagoId?: string;
  voucher_duplicado?: {
    duplicados: VoucherDuplicadoInfo[];
    totalYaAplicado: number;
    montoNuevoPago: number;
    montoSoporte: number | null;
  };
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
    if (!data.extraccion_exitosa) {
      return {
        error:
          data.observaciones ||
          "No se pudieron extraer datos del soporte. Ingresalos manualmente.",
        raw,
      };
    }
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
 * Elimina un soporte huérfano de R2 (subido pero nunca guardado como pago).
 */
export async function limpiarSoporteHuerfano(
  objectKey: string
): Promise<void> {
  try {
    const profile = await getUserProfile();
    if (!objectKey.startsWith(`${profile.tenant_id}/`)) return;
    await eliminarObjeto(objectKey);
  } catch (e) {
    logError("limpiarSoporteHuerfano", e);
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

  const fechaError = validarFechaConsignacion(fechaConsignacion);
  if (fechaError) return { error: fechaError };

  const montoTotal = parseInt(montoTotalStr, 10);
  if (!montoTotal || montoTotal <= 0) {
    return { error: "Monto debe ser mayor a 0" };
  }

  const esRetroactivo = formData.get("retroactivo") === "true";

  let facturas: FacturaInput[] = [];
  try {
    facturas = JSON.parse(facturasStr || "[]");
  } catch {
    return { error: "Formato de facturas invalido" };
  }

  // Pago retroactivo: factura ya no existe en cartera (fue liquidada en CRM)
  // Solo requiere monto — facturas son referencia, no se validan contra cartera
  if (!esRetroactivo) {
    if (facturas.length === 0) {
      return { error: "Debe seleccionar al menos una factura" };
    }

    const sumaAplicada = facturas.reduce((sum, f) => sum + f.valor_aplicado, 0);
    const diferenciaMonto = Math.abs(montoTotal - sumaAplicada);

    if (diferenciaMonto > UMBRAL_REDONDEO_PAGO) {
      return {
        error: `La suma aplicada (${formatCurrencyFull(sumaAplicada)}) difiere del monto total (${formatCurrencyFull(montoTotal)}) por más de $1.000`,
      };
    }
  }

  const supabase = await createClient();

  if (!esRetroactivo && facturas.length > 0) {
    const facturasNos = facturas.map((f) => f.no_factura);
    const { data: facturasValidas } = await supabase
      .from("cartera")
      .select("no_factura, total")
      .eq("tenant_id", profile.tenant_id)
      .eq("codigo_cliente", codigoCliente)
      .in("no_factura", facturasNos);

    const carteraMap = new Map(
      (facturasValidas || []).map((f) => [f.no_factura, Number(f.total)])
    );
    const invalidas = facturasNos.filter((n) => !carteraMap.has(n));
    if (invalidas.length > 0) {
      return {
        error: `Facturas no pertenecen a este cliente: ${invalidas.join(", ")}`,
      };
    }

    const sobreAplicadas = facturas.filter((f) => {
      const totalFactura = carteraMap.get(f.no_factura);
      return totalFactura !== undefined && f.valor_aplicado > totalFactura;
    });
    if (sobreAplicadas.length > 0) {
      return {
        error: `Valor aplicado excede el saldo de: ${sobreAplicadas.map((f) => f.no_factura).join(", ")}`,
      };
    }
  }

  const vouchers = parseVouchers(vouchersStr);

  // Parse optional numbers
  const recaudo = numeroRecaudo ? parseInt(numeroRecaudo, 10) : null;
  const recibo = numeroRecibo ? parseInt(numeroRecibo, 10) : null;
  const valorNotaCredito = valorNotaCreditoStr
    ? parseInt(valorNotaCreditoStr, 10)
    : null;

  // Parse AI extraction JSON
  let aiExtraction: Record<string, unknown> | null = null;
  if (aiExtractionStr) {
    try {
      aiExtraction = JSON.parse(aiExtractionStr) as Record<string, unknown>;
    } catch {
      // no-op, campo opcional
    }
  }

  // Enriquecer con datos de auditoría: qué sugirió la IA vs qué ingresó el usuario
  if (aiExtraction && typeof aiExtraction === "object") {
    const datos = aiExtraction.datos as Record<string, unknown> | undefined;
    const aiMonto =
      datos?.valor_pagado !== undefined && datos.valor_pagado !== null
        ? Number(datos.valor_pagado)
        : null;

    const aiVoucher =
      datos?.numero_voucher !== undefined && datos.numero_voucher !== null
        ? String(datos.numero_voucher)
        : null;

    const audit: Record<string, unknown> = {
      data_origin: "ai_assisted" as const,
    };

    if (aiMonto !== null && !Number.isNaN(aiMonto) && aiMonto > 0) {
      audit.monto_ia = aiMonto;
      audit.monto_usuario = montoTotal;
      audit.monto_modificado = Math.abs(montoTotal - aiMonto) / aiMonto > 0.05;
    }

    if (aiVoucher) {
      const userVoucher = vouchers[0] || null;
      audit.voucher_ia = aiVoucher;
      audit.voucher_usuario = userVoucher;
      audit.voucher_modificado = userVoucher !== null && userVoucher !== aiVoucher;
    }

    const aiFecha = datos?.fecha_consignacion ? String(datos.fecha_consignacion) : null;
    if (aiFecha) {
      audit.fecha_ia = aiFecha;
      audit.fecha_usuario = fechaConsignacion;
      audit.fecha_modificada = fechaConsignacion !== aiFecha;
    }

    const aiMedio = datos?.medio_de_pago ? String(datos.medio_de_pago) : null;
    if (aiMedio) {
      audit.medio_pago_ia = aiMedio;
      audit.medio_pago_usuario = medioPago;
      audit.medio_pago_modificado = medioPago !== null && medioPago !== aiMedio;
    }

    if (esRetroactivo) audit.pago_retroactivo = true;
    aiExtraction = { ...aiExtraction, _audit: audit };
  } else {
    const manualAudit: Record<string, unknown> = { data_origin: "manual" };
    if (esRetroactivo) manualAudit.pago_retroactivo = true;
    aiExtraction = { _audit: manualAudit };
  }

  // Voucher duplicado: detectar si algún voucher ya fue usado en otro pago
  if (vouchers.length > 0) {
    const voucherAceptado = formData.get("voucher_duplicado_aceptado") === "true";

    const { data: duplicados } = await supabase.rpc(
      "detectar_vouchers_duplicados",
      { p_tenant_id: profile.tenant_id, p_vouchers: vouchers }
    );

    if (duplicados && duplicados.length > 0) {
      if (!voucherAceptado) {
        const totalYaAplicado = (duplicados as { monto_total: number }[]).reduce(
          (sum, d) => sum + Number(d.monto_total), 0
        );
        // Monto del soporte según IA (del pago actual)
        const datos = (aiExtraction as Record<string, unknown> | null)?.datos as
          | Record<string, unknown>
          | undefined;
        const montoSoporte =
          datos?.valor_pagado !== undefined && datos.valor_pagado !== null
            ? Number(datos.valor_pagado)
            : null;

        return {
          voucher_duplicado: {
            duplicados: (duplicados as VoucherDuplicadoInfo[]).map((d) => ({
              pago_id: d.pago_id,
              codigo_cliente: d.codigo_cliente,
              fecha_consignacion: String(d.fecha_consignacion),
              monto_total: Number(d.monto_total),
            })),
            totalYaAplicado,
            montoNuevoPago: montoTotal,
            montoSoporte: montoSoporte && !Number.isNaN(montoSoporte) ? montoSoporte : null,
          },
        };
      }
      // Usuario aceptó — marcar en auditoría
      const audit = (aiExtraction as Record<string, unknown>)?._audit as
        | Record<string, unknown>
        | undefined;
      if (audit) {
        audit.voucher_compartido = true;
        audit.pagos_relacionados = (duplicados as { pago_id: string }[]).map(
          (d) => d.pago_id
        );
      }
    }
  }

  // Determinar estado
  const estado = recaudo !== null && recibo !== null ? "verificado" : "registrado";

  async function cleanupR2() {
    if (!soporteKey) return;
    try {
      await eliminarObjeto(soporteKey);
    } catch (e) {
      logError("crearPago:cleanup_r2", e);
    }
  }

  // --- Insert pago ---
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
    await cleanupR2();
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
    // Cleanup: eliminar pago huérfano + soporte de R2 en paralelo
    await Promise.all([
      supabase
        .from("pagos")
        .delete()
        .eq("id", pago.id)
        .eq("tenant_id", profile.tenant_id),
      cleanupR2(),
    ]);
    return { error: "Error al vincular facturas — pago no fue creado" };
  }

  revalidatePath(`/clientes/${codigoCliente}`);
  revalidatePath("/pagos");

  // Fire-and-forget: disparar sync de cartera post-pago
  if (process.env.SYNC_API_URL) {
    syncFetch("/api/jobs/eforce-cartera/trigger", {
      method: "POST",
      body: JSON.stringify({ tenantId: profile.tenant_id }),
    }).catch((e) => logError("crearPago:sync_cartera", e));
  }

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

// --- Campos editables y helpers de historial ---

const CAMPOS_EDITABLES = [
  "fecha_consignacion",
  "monto_total",
  "medio_pago",
  "vouchers",
  "observaciones",
  "nota_credito",
  "valor_nota_credito",
] as const;

type CampoEditable = (typeof CAMPOS_EDITABLES)[number];

function serializarCampo(campo: CampoEditable, valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (campo === "vouchers" && Array.isArray(valor)) return valor.join(",");
  return String(valor);
}

/**
 * Edita campos de un pago existente con registro de auditoría.
 */
export async function editarPago(
  pagoId: string,
  cambios: Partial<Record<CampoEditable, unknown>>
): Promise<PagoActionState> {
  const profile = await getUserProfile();
  if (profile.role === "viewer") {
    return { error: "No tienes permiso para editar pagos" };
  }

  const supabase = await createClient();

  const { data: actual, error: readError } = await supabase
    .from("pagos")
    .select("codigo_cliente, fecha_consignacion, monto_total, medio_pago, vouchers, observaciones, nota_credito, valor_nota_credito")
    .eq("id", pagoId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (readError || !actual) {
    return { error: "Pago no encontrado" };
  }

  if (cambios.fecha_consignacion) {
    const fechaErr = validarFechaConsignacion(String(cambios.fecha_consignacion));
    if (fechaErr) return { error: fechaErr };
  }

  if (cambios.monto_total !== undefined) {
    const monto = Number(cambios.monto_total);
    if (!monto || monto <= 0) return { error: "Monto debe ser mayor a 0" };
  }

  // Detectar campos que realmente cambiaron
  const historialInserts: {
    pago_id: string;
    campo: string;
    valor_anterior: string;
    valor_nuevo: string;
    modificado_por: string;
  }[] = [];

  const updateData: Record<string, unknown> = {};

  for (const campo of CAMPOS_EDITABLES) {
    if (!(campo in cambios)) continue;
    const anterior = serializarCampo(campo, actual[campo]);
    const nuevo = serializarCampo(campo, cambios[campo]);
    if (anterior === nuevo) continue;

    historialInserts.push({
      pago_id: pagoId,
      campo,
      valor_anterior: anterior,
      valor_nuevo: nuevo,
      modificado_por: profile.id,
    });

    if (campo === "vouchers") {
      updateData[campo] = parseVouchers(String(cambios[campo] || ""));
    } else {
      updateData[campo] = cambios[campo] ?? null;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true };
  }

  const { error: updateError } = await supabase
    .from("pagos")
    .update({ ...updateData, editado: true })
    .eq("id", pagoId)
    .eq("tenant_id", profile.tenant_id);

  if (updateError) {
    logError("editarPago:update", updateError);
    return { error: "Error al actualizar el pago" };
  }

  // Insert historial
  if (historialInserts.length > 0) {
    const { error: histError } = await supabase
      .from("pagos_historial")
      .insert(historialInserts);
    if (histError) logError("editarPago:historial", histError);
  }

  revalidatePath(`/clientes/${actual.codigo_cliente}`);
  revalidatePath("/pagos");
  return { success: true };
}

/**
 * Reemplaza el soporte de un pago existente.
 * El cliente ya subió el nuevo archivo a R2 — solo actualiza el pago.
 */
export async function reemplazarSoporte(
  pagoId: string,
  nuevoSoporteKey: string,
  nuevoSoporteNombre: string
): Promise<PagoActionState> {
  const profile = await getUserProfile();
  if (profile.role === "viewer") {
    return { error: "No tienes permiso" };
  }

  if (!nuevoSoporteKey.startsWith(`${profile.tenant_id}/`)) {
    return { error: "No tienes acceso a este recurso" };
  }

  const supabase = await createClient();

  const { data: actual, error: readError } = await supabase
    .from("pagos")
    .select("soporte_key, codigo_cliente")
    .eq("id", pagoId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (readError || !actual) {
    return { error: "Pago no encontrado" };
  }

  const viejoKey = actual.soporte_key;

  // Update con nuevo soporte
  const { error: updateError } = await supabase
    .from("pagos")
    .update({
      soporte_key: nuevoSoporteKey,
      soporte_url: `r2://${nuevoSoporteKey}`,
      soporte_nombre: nuevoSoporteNombre,
      editado: true,
    })
    .eq("id", pagoId)
    .eq("tenant_id", profile.tenant_id);

  if (updateError) {
    logError("reemplazarSoporte:update", updateError);
    return { error: "Error al actualizar soporte" };
  }

  // Historial
  await supabase.from("pagos_historial").insert({
    pago_id: pagoId,
    campo: "soporte",
    valor_anterior: viejoKey || "",
    valor_nuevo: nuevoSoporteKey,
    modificado_por: profile.id,
  });

  // Borrar viejo de R2 (best-effort)
  if (viejoKey) {
    try {
      await eliminarObjeto(viejoKey);
    } catch (e) {
      logError("reemplazarSoporte:r2_cleanup", e);
    }
  }

  revalidatePath(`/clientes/${actual.codigo_cliente}`);
  revalidatePath("/pagos");
  return { success: true };
}
