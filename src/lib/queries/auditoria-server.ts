import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/get-tenant";
import { logError } from "@/lib/logger";
import type { AuditoriaTipo } from "@/lib/pagos-constants";
import { extractAiMetadata, type AiMetadata } from "@/lib/queries/pagos-server";

const AUDITORIA_VENTANA_DIAS = 90;

export interface AuditoriaPendiente {
  id: string;
  pago_id: string;
  tipo: AuditoriaTipo;
  descripcion: string;
  datos: Record<string, unknown> | null;
  created_at: string;
  created_by: string;
  created_by_nombre: string | null;
  codigo_cliente: string;
  nombre_negocio: string | null;
  aprobacion_1: string | null;
  aprobacion_1_nombre: string | null;
  aprobacion_1_at: string | null;
  aprobacion_2: string | null;
  aprobacion_2_nombre: string | null;
  aprobacion_2_at: string | null;
  soporte_key: string | null;
  monto_total: number;
  ai_metadata: AiMetadata | null;
  facturas: string[];
}

export interface PagoAuditoriaStatus {
  total: number;
  aprobadas: number;
}

export type AuditoriaEstadoCierre = "aprobada" | "rechazada";

export interface AuditoriaHistorica {
  id: string;
  pago_id: string;
  tipo: AuditoriaTipo;
  descripcion: string;
  datos: Record<string, unknown> | null;
  created_at: string;
  created_by: string;
  created_by_nombre: string | null;
  codigo_cliente: string;
  nombre_negocio: string | null;
  estado_cierre: AuditoriaEstadoCierre;
  // Cerrada por aprobacion
  aprobacion_1_nombre: string | null;
  aprobacion_1_at: string | null;
  aprobacion_2_nombre: string | null;
  aprobacion_2_at: string | null;
  // Cerrada por rechazo
  rechazada_por_nombre: string | null;
  rechazada_at: string | null;
  motivo_cierre: string | null;
  // Pago
  monto_total: number;
}

export interface HistoricoFilters {
  desde?: string;
  hasta?: string;
  tipo?: AuditoriaTipo;
  estado?: AuditoriaEstadoCierre;
}

export const HISTORICO_PAGE_SIZE = 30;

/**
 * Auditorias pendientes de doble aprobacion (aprobacion_2 IS NULL),
 * ultimos 90 dias, ordenadas por created_at DESC.
 * Resuelve nombres de profiles y nombre_negocio del cliente.
 */
export async function getAuditoriasPendientes(): Promise<AuditoriaPendiente[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - AUDITORIA_VENTANA_DIAS);

  const { data, error } = await supabase
    .from("auditoria_pagos")
    .select(
      "id, pago_id, tipo, descripcion, datos, created_at, created_by, aprobacion_1, aprobacion_1_at, aprobacion_2, aprobacion_2_at, pagos!inner(codigo_cliente, soporte_key, monto_total, ai_extraction, pago_facturas(no_factura))"
    )
    .eq("tenant_id", tenantId)
    .is("aprobacion_2", null)
    .is("rechazada_por", null)
    .gte("created_at", fechaLimite.toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    logError("getAuditoriasPendientes", error);
    return [];
  }

  // Tipar rows con cast a unknown para trabajar con el join de pagos
  type RawRow = {
    id: string;
    pago_id: string;
    tipo: string;
    descripcion: string;
    datos: Record<string, unknown> | null;
    created_at: string;
    created_by: string;
    aprobacion_1: string | null;
    aprobacion_1_at: string | null;
    aprobacion_2: string | null;
    aprobacion_2_at: string | null;
    pagos: unknown;
  };
  const rows = (data as unknown as RawRow[]) || [];

  // Recolectar IDs de profiles unicos para resolver nombres
  const profileIds = new Set<string>();
  for (const row of rows) {
    if (row.created_by) profileIds.add(row.created_by);
    if (row.aprobacion_1) profileIds.add(row.aprobacion_1);
    if (row.aprobacion_2) profileIds.add(row.aprobacion_2);
  }

  // Recolectar codigos de cliente unicos para resolver nombres de negocio
  // pagos!inner devuelve un objeto (relacion FK to-one), no un array
  type PagosJoin = {
    codigo_cliente: string;
    soporte_key: string | null;
    monto_total: number;
    ai_extraction: unknown;
    pago_facturas: { no_factura: string }[] | null;
  };
  const codigos = [
    ...new Set(
      rows
        .map((r) => (r.pagos as unknown as PagosJoin | null)?.codigo_cliente)
        .filter(Boolean) as string[]
    ),
  ];

  // Batch queries en paralelo
  const [profilesRes, clientesRes] = await Promise.all([
    profileIds.size > 0
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [...profileIds])
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    codigos.length > 0
      ? supabase
          .from("vista_cliente_resumen")
          .select("codigo_cliente, nombre_negocio")
          .eq("tenant_id", tenantId)
          .in("codigo_cliente", codigos)
      : Promise.resolve({
          data: [] as { codigo_cliente: string; nombre_negocio: string | null }[],
        }),
  ]);

  const nombresProfile = new Map(
    (profilesRes.data || []).map((p) => [p.id, p.full_name])
  );
  const nombresCliente = new Map(
    (clientesRes.data || []).map((c) => [c.codigo_cliente, c.nombre_negocio])
  );

  return rows.map((row) => {
    const pago = row.pagos as unknown as PagosJoin | null;
    const codigoCliente = pago?.codigo_cliente ?? "";
    return {
      id: row.id,
      pago_id: row.pago_id,
      tipo: row.tipo as AuditoriaTipo,
      descripcion: row.descripcion,
      datos: row.datos as Record<string, unknown> | null,
      created_at: row.created_at,
      created_by: row.created_by,
      created_by_nombre: row.created_by
        ? (nombresProfile.get(row.created_by) ?? null)
        : null,
      codigo_cliente: codigoCliente,
      nombre_negocio: nombresCliente.get(codigoCliente) ?? null,
      aprobacion_1: row.aprobacion_1,
      aprobacion_1_nombre: row.aprobacion_1
        ? (nombresProfile.get(row.aprobacion_1) ?? null)
        : null,
      aprobacion_1_at: row.aprobacion_1_at,
      aprobacion_2: row.aprobacion_2,
      aprobacion_2_nombre: row.aprobacion_2
        ? (nombresProfile.get(row.aprobacion_2) ?? null)
        : null,
      aprobacion_2_at: row.aprobacion_2_at,
      soporte_key: pago?.soporte_key ?? null,
      monto_total: Number(pago?.monto_total ?? 0),
      ai_metadata: extractAiMetadata(pago?.ai_extraction),
      facturas: (pago?.pago_facturas || []).map((f) => f.no_factura),
    };
  });
}

/**
 * Dado un conjunto de pago_ids, retorna cuantas auditorias tiene cada uno
 * y cuantas ya estan completamente aprobadas (aprobacion_2 NOT NULL).
 */
export async function getPagosAuditados(
  pagoIds: string[]
): Promise<Map<string, PagoAuditoriaStatus>> {
  if (pagoIds.length === 0) return new Map();

  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("auditoria_pagos")
    .select("pago_id, aprobacion_2, rechazada_por")
    .eq("tenant_id", tenantId)
    .in("pago_id", pagoIds);

  if (error) {
    logError("getPagosAuditados", error);
    return new Map();
  }

  const map = new Map<string, PagoAuditoriaStatus>();
  for (const row of data || []) {
    const current = map.get(row.pago_id) || { total: 0, aprobadas: 0 };
    current.total++;
    // Aprobada o rechazada cuentan ambas como "cerrada" para el contador
    if (row.aprobacion_2 !== null || row.rechazada_por !== null) current.aprobadas++;
    map.set(row.pago_id, current);
  }

  return map;
}

/**
 * Count-only: cuantas auditorias pendientes hay (para badge sin cargar datos completos).
 */
export async function getAuditoriasPendientesCount(): Promise<number> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - AUDITORIA_VENTANA_DIAS);

  const { count, error } = await supabase
    .from("auditoria_pagos")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("aprobacion_2", null)
    .is("rechazada_por", null)
    .gte("created_at", fechaLimite.toISOString());

  if (error) {
    logError("getAuditoriasPendientesCount", error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Auditorias cerradas (aprobadas o rechazadas) — histórico paginado con filtros
 * opcionales: fecha desde/hasta, tipo de auditoría, estado de cierre.
 */
export async function getAuditoriasHistorico(
  page: number,
  filters: HistoricoFilters
): Promise<{ auditorias: AuditoriaHistorica[]; total: number }> {
  const tenantId = await getTenantId();
  const supabase = await createClient();
  const offset = (page - 1) * HISTORICO_PAGE_SIZE;

  let query = supabase
    .from("auditoria_pagos")
    .select(
      "id, pago_id, tipo, descripcion, datos, created_at, created_by, aprobacion_1, aprobacion_1_at, aprobacion_2, aprobacion_2_at, rechazada_por, rechazada_at, motivo_cierre, pagos!inner(codigo_cliente, monto_total)",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId);

  // Filtro estado: aprobada (aprobacion_2 NOT NULL) o rechazada (rechazada_por NOT NULL).
  // Si no se pasa, mostrar AMBAS — cualquier cierre.
  if (filters.estado === "aprobada") {
    query = query.not("aprobacion_2", "is", null);
  } else if (filters.estado === "rechazada") {
    query = query.not("rechazada_por", "is", null);
  } else {
    query = query.or("aprobacion_2.not.is.null,rechazada_por.not.is.null");
  }

  if (filters.tipo) query = query.eq("tipo", filters.tipo);
  if (filters.desde) query = query.gte("created_at", filters.desde);
  if (filters.hasta) query = query.lte("created_at", filters.hasta);

  // Ordenar por fecha de cierre real (la mayor de aprobacion_2_at o rechazada_at).
  // Como no se puede ordenar por expresion COALESCE via PostgREST, usamos created_at
  // descendente como proxy razonable.
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + HISTORICO_PAGE_SIZE - 1);

  if (error) {
    logError("getAuditoriasHistorico", error);
    return { auditorias: [], total: 0 };
  }

  type RawRow = {
    id: string;
    pago_id: string;
    tipo: string;
    descripcion: string;
    datos: Record<string, unknown> | null;
    created_at: string;
    created_by: string;
    aprobacion_1: string | null;
    aprobacion_1_at: string | null;
    aprobacion_2: string | null;
    aprobacion_2_at: string | null;
    rechazada_por: string | null;
    rechazada_at: string | null;
    motivo_cierre: string | null;
    pagos: unknown;
  };
  const rows = (data as unknown as RawRow[]) || [];

  // Resolver nombres de profiles y clientes en batch (mismo patron que getAuditoriasPendientes)
  const profileIds = new Set<string>();
  for (const row of rows) {
    if (row.created_by) profileIds.add(row.created_by);
    if (row.aprobacion_1) profileIds.add(row.aprobacion_1);
    if (row.aprobacion_2) profileIds.add(row.aprobacion_2);
    if (row.rechazada_por) profileIds.add(row.rechazada_por);
  }

  type PagosJoin = { codigo_cliente: string; monto_total: number };
  const codigos = [
    ...new Set(
      rows
        .map((r) => (r.pagos as unknown as PagosJoin | null)?.codigo_cliente)
        .filter(Boolean) as string[]
    ),
  ];

  const [profilesRes, clientesRes] = await Promise.all([
    profileIds.size > 0
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [...profileIds])
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    codigos.length > 0
      ? supabase
          .from("vista_cliente_resumen")
          .select("codigo_cliente, nombre_negocio")
          .eq("tenant_id", tenantId)
          .in("codigo_cliente", codigos)
      : Promise.resolve({
          data: [] as { codigo_cliente: string; nombre_negocio: string | null }[],
        }),
  ]);

  const nombresProfile = new Map(
    (profilesRes.data || []).map((p) => [p.id, p.full_name])
  );
  const nombresCliente = new Map(
    (clientesRes.data || []).map((c) => [c.codigo_cliente, c.nombre_negocio])
  );

  const auditorias: AuditoriaHistorica[] = rows.map((row) => {
    const pago = row.pagos as unknown as PagosJoin | null;
    const codigoCliente = pago?.codigo_cliente ?? "";
    const estado: AuditoriaEstadoCierre = row.rechazada_por ? "rechazada" : "aprobada";
    return {
      id: row.id,
      pago_id: row.pago_id,
      tipo: row.tipo as AuditoriaTipo,
      descripcion: row.descripcion,
      datos: row.datos,
      created_at: row.created_at,
      created_by: row.created_by,
      created_by_nombre: nombresProfile.get(row.created_by) ?? null,
      codigo_cliente: codigoCliente,
      nombre_negocio: nombresCliente.get(codigoCliente) ?? null,
      estado_cierre: estado,
      aprobacion_1_nombre: row.aprobacion_1 ? (nombresProfile.get(row.aprobacion_1) ?? null) : null,
      aprobacion_1_at: row.aprobacion_1_at,
      aprobacion_2_nombre: row.aprobacion_2 ? (nombresProfile.get(row.aprobacion_2) ?? null) : null,
      aprobacion_2_at: row.aprobacion_2_at,
      rechazada_por_nombre: row.rechazada_por ? (nombresProfile.get(row.rechazada_por) ?? null) : null,
      rechazada_at: row.rechazada_at,
      motivo_cierre: row.motivo_cierre,
      monto_total: Number(pago?.monto_total ?? 0),
    };
  });

  return { auditorias, total: count ?? 0 };
}
