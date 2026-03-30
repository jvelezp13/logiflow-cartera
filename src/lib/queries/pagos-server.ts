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
  facturas: PagoFactura[];
}

export interface PagoDetalle extends PagoResumen {
  codigo_cliente: string;
  nota_credito: string | null;
  valor_nota_credito: number | null;
  soporte_url_firmada: string | null;
  ai_extraction: unknown;
  importado_historico: boolean;
}

export type FiltroAuditoria =
  | "sin_crm"
  | "verificado"
  | "monto_modificado"
  | "manual"
  | "sin_conciliar";

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
}

export interface FacturaAbierta {
  no_factura: string;
  fecha_vencimiento: string | null;
  mora: number;
  total: number;
}

// --- Helpers ---

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
      "id, fecha_consignacion, monto_total, medio_pago, vouchers, numero_recaudo, numero_recibo, estado, soporte_key, created_at, profiles!created_by(full_name), pago_facturas(id, no_factura, valor_factura, valor_aplicado)"
    )
    .eq("tenant_id", tenantId)
    .eq("codigo_cliente", codigoCliente)
    .order("fecha_consignacion", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row) => ({
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
      observaciones: null,
      facturas: (
        (row.pago_facturas as PagoFactura[] | null) || []
      ).map((f) => ({
        id: f.id,
        no_factura: f.no_factura,
        valor_factura: f.valor_factura ? Number(f.valor_factura) : null,
        valor_aplicado: Number(f.valor_aplicado),
      })),
    }));
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

  // Buscar por factura solo si el término parece uno (alfanumérico 4+ chars)
  let pagoIdsByFactura: string[] | null = null;
  if (sanitized && sanitized.length >= 4) {
    const { data: matchedFacturas } = await supabase
      .from("pago_facturas")
      .select("pago_id")
      .ilike("no_factura", `%${sanitized}%`)
      .limit(100);
    if (matchedFacturas && matchedFacturas.length > 0) {
      pagoIdsByFactura = [...new Set(matchedFacturas.map((f) => f.pago_id))].slice(0, 50);
    }
  }

  // Filtro de conciliacion: obtener IDs via RPC antes de armar la query principal
  let sinConciliarIds: string[] | null = null;
  if (filters.filtro === "sin_conciliar") {
    const { data: idRows } = await supabase.rpc("get_pago_ids_sin_conciliar", {
      p_tenant_id: tenantId,
    });
    sinConciliarIds = (idRows as string[] | null) ?? [];
  }

  let query = supabase
    .from("pagos")
    .select(
      "id, fecha_consignacion, monto_total, medio_pago, vouchers, numero_recaudo, numero_recibo, observaciones, estado, soporte_key, created_at, codigo_cliente, profiles!created_by(full_name), pago_facturas(id, no_factura, valor_factura, valor_aplicado)",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId);

  if (sanitized) {
    if (pagoIdsByFactura) {
      query = query.or(`codigo_cliente.ilike.%${sanitized}%,id.in.(${pagoIdsByFactura.join(",")})`);
    } else {
      query = query.ilike("codigo_cliente", `%${sanitized}%`);
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
  } else if (filters.filtro === "sin_conciliar" && sinConciliarIds !== null) {
    if (sinConciliarIds.length === 0) {
      // No hay pagos sin conciliar — forzar resultado vacío
      return { pagos: [], total: 0 };
    }
    query = query.in("id", sinConciliarIds);
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
        (c.razon_social as string | null) ||
          (c.nombre_negocio as string | null) ||
          "",
      ])
    );
  }

  const pagos: PagoResumen[] = (data || []).map((row) => ({
      id: row.id,
      fecha_consignacion: row.fecha_consignacion,
      monto_total: Number(row.monto_total),
      medio_pago: row.medio_pago,
      vouchers: row.vouchers || [],
      numero_recaudo: row.numero_recaudo,
      numero_recibo: row.numero_recibo,
      observaciones: row.observaciones as string | null,
      estado: row.estado,
      soporte_key: row.soporte_key,
      created_at: row.created_at,
      created_by_name: extractProfileName(row.profiles as ProfilesJoin),
      codigo_cliente: row.codigo_cliente,
      nombre_cliente: row.codigo_cliente
        ? (nombresPorCodigo.get(row.codigo_cliente) || null)
        : null,
      facturas: (
        (row.pago_facturas as PagoFactura[] | null) || []
      ).map((f) => ({
        id: f.id,
        no_factura: f.no_factura,
        valor_factura: f.valor_factura ? Number(f.valor_factura) : null,
        valor_aplicado: Number(f.valor_aplicado),
      })),
    }));

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

  const [sinCRMResult, montoModResult, manualResult, sinConciliarResult] =
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

      supabase.rpc("get_pagos_sin_conciliar", { p_tenant_id: tenantId }),
    ]);

  if (sinCRMResult.error) throw sinCRMResult.error;
  if (montoModResult.error) throw montoModResult.error;
  if (manualResult.error) throw manualResult.error;
  // Fallback a 0 solo si la RPC no existe aún (PGRST202); otros errores deben propagarse
  if (sinConciliarResult.error && sinConciliarResult.error.code !== "PGRST202") {
    throw sinConciliarResult.error;
  }
  const sinConciliarCount = sinConciliarResult.error
    ? 0
    : Number(sinConciliarResult.data ?? 0);

  return {
    sinCRM: sinCRMResult.count || 0,
    montoModificado: montoModResult.count || 0,
    ingresoManual: manualResult.count || 0,
    sinConciliar: sinConciliarCount,
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
