import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/get-tenant";
import { generarUrlLectura } from "@/lib/r2";
import { logError } from "@/lib/logger";

// --- Tipos ---

export interface PagoFactura {
  id: string;
  no_factura: string;
  valor_factura: number | null;
  valor_aplicado: number;
}

export interface PagoResumen {
  id: string;
  fecha_consignacion: string;
  monto_total: number;
  medio_pago: string | null;
  vouchers: string[];
  numero_recaudo: number | null;
  numero_recibo: number | null;
  estado: string;
  soporte_key: string | null;
  created_at: string | null;
  created_by_name: string | null;
  codigo_cliente: string | null;
  nombre_cliente: string | null;
  observaciones: string | null;
  nota_credito: string | null;
  valor_nota_credito: number | null;
  editado: boolean;
  confianza_nivel: string | null;
  tipo_documento: string | null;
  origen: string | null;
  ai_metadata: AiMetadata | null;
  facturas: PagoFactura[];
}

export interface PagoDetalle extends PagoResumen {
  codigo_cliente: string;
  soporte_url_firmada: string | null;
  ai_extraction: unknown;
  importado_historico: boolean;
}

export type FiltroAuditoria =
  | "sin_crm"
  | "verificado"
  | "monto_modificado"
  | "manual"
  | "sin_conciliar"
  | "discrepancia"
  | "voucher_compartido"
  | "voucher_modificado"
  | "editado"
  | "confianza_baja";

export interface PagosFilters {
  busqueda?: string;
  filtro?: FiltroAuditoria;
  desde?: string;
  hasta?: string;
}

export interface PagosAuditCounts {
  sinCRM: number;
  montoModificado: number;
  ingresoManual: number;
  sinConciliar: number;
  conDiscrepancia: number;
  voucherCompartido: number;
  voucherModificado: number;
  editado: number;
  confianzaBaja: number;
}

export interface HistorialEntry {
  id: string;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  modificado_por_nombre: string | null;
  created_at: string;
}

export type ConfianzaNivel = "alto" | "medio" | "bajo";

export interface AiMetadata {
  confianza_nivel: ConfianzaNivel | null;
  confianza_notas: string | null;
  tipo_documento: string | null;
  origen: string | null;
  observaciones: string | null;
  datos: Record<string, unknown> | null;
  audit: Record<string, unknown> | null;
}

export interface FacturaAbierta {
  no_factura: string;
  fecha_vencimiento: string | null;
  mora: number;
  total: number;
}

// --- Helpers ---

function extractAiMeta(aiExtraction: unknown): {
  confianza_nivel: string | null;
  tipo_documento: string | null;
  origen: string | null;
} {
  if (!aiExtraction || typeof aiExtraction !== "object") {
    return { confianza_nivel: null, tipo_documento: null, origen: null };
  }
  const ai = aiExtraction as Record<string, unknown>;
  const confianza = ai.confianza as Record<string, unknown> | undefined;
  return {
    confianza_nivel: (confianza?.nivel as string) ?? null,
    tipo_documento: (ai.tipo_documento as string) ?? null,
    origen: (ai.origen as string) ?? null,
  };
}

function extractAiMetadata(aiExtraction: unknown): AiMetadata | null {
  if (!aiExtraction || typeof aiExtraction !== "object") return null;
  const ai = aiExtraction as Record<string, unknown>;
  const confianza = ai.confianza as Record<string, unknown> | undefined;
  return {
    confianza_nivel: (confianza?.nivel as ConfianzaNivel) ?? null,
    confianza_notas: (confianza?.notas as string) ?? null,
    tipo_documento: (ai.tipo_documento as string) ?? null,
    origen: (ai.origen as string) ?? null,
    observaciones: (ai.observaciones as string) ?? null,
    datos: (ai.datos as Record<string, unknown>) ?? null,
    audit: (ai._audit as Record<string, unknown>) ?? null,
  };
}

type ProfilesJoin =
  | { full_name: string | null }[]
  | { full_name: string | null }
  | null;

function extractProfileName(profiles: ProfilesJoin): string | null {
  const profile = Array.isArray(profiles) ? profiles[0] : profiles;
  return profile?.full_name ?? null;
}

// --- Queries ---

function sanitizeSearchInput(input: string): string {
  return input.replace(/[%_.*,()\\\n\r]/g, "");
}

/**
 * Pagos de un cliente con sus facturas vinculadas.
 * Para la seccion de pagos en detalle de cliente.
 */
export async function getPagosCliente(
  codigoCliente: string,
  limit = 10
): Promise<PagoResumen[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pagos")
    .select(
      "id, fecha_consignacion, monto_total, medio_pago, vouchers, numero_recaudo, numero_recibo, observaciones, nota_credito, valor_nota_credito, estado, soporte_key, created_at, editado, ai_extraction, profiles!created_by(full_name), pago_facturas(id, no_factura, valor_factura, valor_aplicado)"
    )
    .eq("tenant_id", tenantId)
    .eq("codigo_cliente", codigoCliente)
    .order("fecha_consignacion", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row) => {
    const aiMeta = extractAiMeta(row.ai_extraction);
    return {
      id: row.id,
      fecha_consignacion: row.fecha_consignacion,
      monto_total: Number(row.monto_total),
      medio_pago: row.medio_pago,
      vouchers: row.vouchers || [],
      numero_recaudo: row.numero_recaudo,
      numero_recibo: row.numero_recibo,
      estado: row.estado,
      soporte_key: row.soporte_key,
      created_at: row.created_at,
      created_by_name: extractProfileName(row.profiles as ProfilesJoin),
      codigo_cliente: null,
      nombre_cliente: null,
      observaciones: row.observaciones as string | null,
      nota_credito: (row.nota_credito as string | null) ?? null,
      valor_nota_credito: row.valor_nota_credito != null ? Number(row.valor_nota_credito) : null,
      editado: row.editado ?? false,
      ...aiMeta,
      ai_metadata: extractAiMetadata(row.ai_extraction),
      facturas: (
        (row.pago_facturas as PagoFactura[] | null) || []
      ).map((f) => ({
        id: f.id,
        no_factura: f.no_factura,
        valor_factura: f.valor_factura ? Number(f.valor_factura) : null,
        valor_aplicado: Number(f.valor_aplicado),
      })),
    };
  });
}

/**
 * Lista paginada de pagos con filtros.
 * Para la pagina dedicada /pagos.
 */
export async function getPagosPaginados(
  page: number,
  filters: PagosFilters
): Promise<{ pagos: PagoResumen[]; total: number }> {
  const tenantId = await getTenantId();
  const supabase = await createClient();
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const sanitized = filters.busqueda
    ? sanitizeSearchInput(filters.busqueda)
    : null;
  const hasSearch = !!sanitized && sanitized.length >= 3;
  const needsConciliacion =
    filters.filtro === "sin_conciliar" || filters.filtro === "discrepancia";

  const [searchResult, conciliacionResult] = await Promise.all([
    hasSearch
      ? supabase.rpc("buscar_pago_ids", {
          p_tenant_id: tenantId,
          p_term: sanitized,
        })
      : Promise.resolve({ data: null }),
    needsConciliacion
      ? supabase.rpc("get_pago_ids_conciliacion", {
          p_tenant_id: tenantId,
          p_estado: filters.filtro,
        })
      : Promise.resolve({ data: null }),
  ]);

  const searchPagoIds = hasSearch
    ? (searchResult.data as { pago_id: string }[] | null)?.map((r) => r.pago_id) ?? []
    : null;
  const conciliacionIds = needsConciliacion
    ? (conciliacionResult.data as string[] | null) ?? []
    : null;

  let query = supabase
    .from("pagos")
    .select(
      "id, fecha_consignacion, monto_total, medio_pago, vouchers, numero_recaudo, numero_recibo, observaciones, nota_credito, valor_nota_credito, estado, soporte_key, created_at, codigo_cliente, editado, ai_extraction, profiles!created_by(full_name), pago_facturas(id, no_factura, valor_factura, valor_aplicado)",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId);

  if (hasSearch) {
    if (searchPagoIds && searchPagoIds.length > 0) {
      query = query.in("id", searchPagoIds);
    } else {
      return { pagos: [], total: 0 };
    }
  }
  if (filters.filtro === "sin_crm") {
    query = query.eq("estado", "registrado");
  } else if (filters.filtro === "verificado") {
    query = query.eq("estado", "verificado");
  } else if (filters.filtro === "monto_modificado") {
    query = query.filter("ai_extraction->_audit->>monto_modificado", "eq", "true");
  } else if (filters.filtro === "manual") {
    query = query.filter("ai_extraction->_audit->>data_origin", "eq", "manual");
  } else if (filters.filtro === "voucher_compartido") {
    query = query.filter("ai_extraction->_audit->>voucher_compartido", "eq", "true");
  } else if (filters.filtro === "voucher_modificado") {
    query = query.filter("ai_extraction->_audit->>voucher_modificado", "eq", "true");
  } else if (filters.filtro === "editado") {
    query = query.eq("editado", true);
  } else if (filters.filtro === "confianza_baja") {
    query = query.filter("ai_extraction->confianza->>nivel", "eq", "bajo");
  } else if (needsConciliacion && conciliacionIds !== null) {
    if (conciliacionIds.length === 0) {
      return { pagos: [], total: 0 };
    }
    query = query.in("id", conciliacionIds);
  }
  if (filters.desde) query = query.gte("fecha_consignacion", filters.desde);
  if (filters.hasta) query = query.lte("fecha_consignacion", filters.hasta);

  const { data, error, count } = await query
    .order("fecha_consignacion", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) throw error;

  // Lookup de nombres de clientes desde vista_cliente_resumen
  const codigosUnicos = [
    ...new Set(
      (data || [])
        .map((row) => row.codigo_cliente as string | null)
        .filter((c): c is string => !!c)
    ),
  ];

  let nombresPorCodigo: Map<string, string> = new Map();
  if (codigosUnicos.length > 0) {
    const { data: clientesData } = await supabase
      .from("vista_cliente_resumen")
      .select("codigo_cliente, razon_social, nombre_negocio")
      .eq("tenant_id", tenantId)
      .in("codigo_cliente", codigosUnicos);

    nombresPorCodigo = new Map(
      (clientesData || []).map((c) => [
        c.codigo_cliente as string,
        (c.nombre_negocio as string | null) ||
          (c.razon_social as string | null) ||
          "",
      ])
    );
  }

  const pagos: PagoResumen[] = (data || []).map((row) => {
      const aiMeta = extractAiMeta(row.ai_extraction);
      return {
        id: row.id,
        fecha_consignacion: row.fecha_consignacion,
        monto_total: Number(row.monto_total),
        medio_pago: row.medio_pago,
        vouchers: row.vouchers || [],
        numero_recaudo: row.numero_recaudo,
        numero_recibo: row.numero_recibo,
        observaciones: row.observaciones as string | null,
        nota_credito: (row.nota_credito as string | null) ?? null,
        valor_nota_credito: row.valor_nota_credito != null ? Number(row.valor_nota_credito) : null,
        estado: row.estado,
        soporte_key: row.soporte_key,
        created_at: row.created_at,
        created_by_name: extractProfileName(row.profiles as ProfilesJoin),
        codigo_cliente: row.codigo_cliente,
        nombre_cliente: row.codigo_cliente
          ? (nombresPorCodigo.get(row.codigo_cliente) || null)
          : null,
        editado: row.editado ?? false,
        ...aiMeta,
        ai_metadata: extractAiMetadata(row.ai_extraction),
        facturas: (
          (row.pago_facturas as PagoFactura[] | null) || []
        ).map((f) => ({
          id: f.id,
          no_factura: f.no_factura,
          valor_factura: f.valor_factura ? Number(f.valor_factura) : null,
          valor_aplicado: Number(f.valor_aplicado),
        })),
      };
    });

  return { pagos, total: count || 0 };
}

/**
 * Detalle completo de un pago con URL firmada del soporte.
 */
export async function getPagoDetalle(
  pagoId: string
): Promise<PagoDetalle | null> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pagos")
    .select(
      "*, profiles!created_by(full_name), pago_facturas(id, no_factura, valor_factura, valor_aplicado)"
    )
    .eq("tenant_id", tenantId)
    .eq("id", pagoId)
    .single();

  if (error || !data) return null;

  let soporteUrlFirmada: string | null = null;
  if (data.soporte_key) {
    try {
      soporteUrlFirmada = await generarUrlLectura(data.soporte_key);
    } catch (e) {
      logError("getPagoDetalle:generarUrlLectura", e);
    }
  }

  return {
    id: data.id,
    codigo_cliente: data.codigo_cliente,
    fecha_consignacion: data.fecha_consignacion,
    monto_total: Number(data.monto_total),
    medio_pago: data.medio_pago,
    vouchers: data.vouchers || [],
    numero_recaudo: data.numero_recaudo,
    numero_recibo: data.numero_recibo,
    observaciones: data.observaciones,
    nombre_cliente: null,
    nota_credito: data.nota_credito,
    valor_nota_credito: data.valor_nota_credito
      ? Number(data.valor_nota_credito)
      : null,
    editado: data.editado ?? false,
    ...extractAiMeta(data.ai_extraction),
    ai_metadata: extractAiMetadata(data.ai_extraction),
    estado: data.estado,
    soporte_key: data.soporte_key,
    soporte_url_firmada: soporteUrlFirmada,
    ai_extraction: data.ai_extraction,
    importado_historico: data.importado_historico,
    created_at: data.created_at,
    created_by_name: extractProfileName(data.profiles as ProfilesJoin),
    facturas: (
      (data.pago_facturas as PagoFactura[] | null) || []
    ).map((f) => ({
      id: f.id,
      no_factura: f.no_factura,
      valor_factura: f.valor_factura ? Number(f.valor_factura) : null,
      valor_aplicado: Number(f.valor_aplicado),
    })),
  };
}

/**
 * Counts de auditoria para las capsulas de filtro:
 * - sinCRM: pagos sin codigos CRM
 * - montoModificado: pagos donde IA detecto que el monto fue editado manualmente
 * - ingresoManual: pagos ingresados a mano (sin IA)
 * - sinConciliar: pagos verificados donde la factura aun no refleja el pago en cartera
 */
export async function getPagosAuditCounts(): Promise<PagosAuditCounts> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  // get_pagos_conciliacion devuelve ambos conteos en UNA sola llamada
  const [sinCRMResult, montoModResult, manualResult, conciliacionResult, voucherCompResult, voucherModResult, editadoResult, confianzaBajaResult] =
    await Promise.all([
      supabase
        .from("pagos")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("estado", "registrado"),

      supabase
        .from("pagos")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .filter("ai_extraction->_audit->>monto_modificado", "eq", "true"),

      supabase
        .from("pagos")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .filter("ai_extraction->_audit->>data_origin", "eq", "manual"),

      supabase.rpc("get_pagos_conciliacion", { p_tenant_id: tenantId }),

      supabase
        .from("pagos")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .filter("ai_extraction->_audit->>voucher_compartido", "eq", "true"),

      supabase
        .from("pagos")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .filter("ai_extraction->_audit->>voucher_modificado", "eq", "true"),

      supabase
        .from("pagos")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("editado", true),

      supabase
        .from("pagos")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .filter("ai_extraction->confianza->>nivel", "eq", "bajo"),
    ]);

  if (sinCRMResult.error) throw sinCRMResult.error;
  if (montoModResult.error) throw montoModResult.error;
  if (manualResult.error) throw manualResult.error;
  if (voucherCompResult.error) throw voucherCompResult.error;
  if (voucherModResult.error) throw voucherModResult.error;
  // Fallback a 0 solo si la RPC no existe aún (PGRST202); otros errores deben propagarse
  if (conciliacionResult.error && conciliacionResult.error.code !== "PGRST202") {
    throw conciliacionResult.error;
  }

  // TABLE-returning RPCs devuelven un array de filas; tomamos la primera (y única)
  const conciliacionRow = conciliacionResult.error
    ? null
    : Array.isArray(conciliacionResult.data)
      ? (conciliacionResult.data[0] as { sin_conciliar: number; con_discrepancia: number } | undefined)
      : (conciliacionResult.data as { sin_conciliar: number; con_discrepancia: number } | null);

  return {
    sinCRM: sinCRMResult.count || 0,
    montoModificado: montoModResult.count || 0,
    ingresoManual: manualResult.count || 0,
    sinConciliar: Number(conciliacionRow?.sin_conciliar ?? 0),
    conDiscrepancia: Number(conciliacionRow?.con_discrepancia ?? 0),
    voucherCompartido: voucherCompResult.count || 0,
    voucherModificado: voucherModResult.count || 0,
    editado: editadoResult.count || 0,
    confianzaBaja: confianzaBajaResult.count || 0,
  };
}

/**
 * Facturas abiertas de un cliente para el selector de match.
 * Ordenadas por mora descendente (las mas vencidas primero).
 */
export async function getFacturasAbiertas(
  codigoCliente: string
): Promise<FacturaAbierta[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vista_cartera_enriquecida")
    .select("no_factura, fecha_vencimiento, mora, total")
    .eq("tenant_id", tenantId)
    .eq("codigo_cliente", codigoCliente)
    .gt("total", 0)
    .order("mora", { ascending: false });

  if (error) throw error;

  return (data || []).map((f) => ({
    no_factura: f.no_factura,
    fecha_vencimiento: f.fecha_vencimiento,
    mora: Number(f.mora),
    total: Number(f.total),
  }));
}

/**
 * Historial de cambios de un pago (para el Sheet de edicion).
 * RLS filtra por tenant via FK a pagos.
 */
export async function getHistorialPago(
  pagoId: string
): Promise<HistorialEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pagos_historial")
    .select(
      "id, campo, valor_anterior, valor_nuevo, created_at, profiles!modificado_por(full_name)"
    )
    .eq("pago_id", pagoId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    campo: row.campo,
    valor_anterior: row.valor_anterior,
    valor_nuevo: row.valor_nuevo,
    modificado_por_nombre: extractProfileName(row.profiles as ProfilesJoin),
    created_at: row.created_at,
  }));
}
