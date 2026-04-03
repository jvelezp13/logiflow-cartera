import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/get-tenant";
import { logError } from "@/lib/logger";
import type { AuditoriaTipo } from "@/lib/pagos-constants";

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
}

export interface PagoAuditoriaStatus {
  total: number;
  aprobadas: number;
}

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
      "id, pago_id, tipo, descripcion, datos, created_at, created_by, aprobacion_1, aprobacion_1_at, aprobacion_2, aprobacion_2_at, pagos!inner(codigo_cliente)"
    )
    .eq("tenant_id", tenantId)
    .is("aprobacion_2", null)
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
  type PagosJoin = { codigo_cliente: string };
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
    const codigoCliente =
      (row.pagos as unknown as PagosJoin | null)?.codigo_cliente ?? "";
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
    .select("pago_id, aprobacion_2")
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
    if (row.aprobacion_2 !== null) current.aprobadas++;
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
    .gte("created_at", fechaLimite.toISOString());

  if (error) {
    logError("getAuditoriasPendientesCount", error);
    return 0;
  }

  return count ?? 0;
}
