/**
 * Queries server-side que usan el server client de Supabase.
 * Todas las funciones obtienen el tenant_id del usuario autenticado.
 */
import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/get-tenant";

// Re-exportar interfaces para uso en componentes
export type {
  DashboardKPIs,
  ClienteEnriquecido,
  FacturaEnriquecida,
  PedidoEnriquecido,
  EnvejecimientoRango,
  AlertaCompleta,
} from "./cartera";

import type {
  DashboardKPIs,
  ClienteEnriquecido,
  EnvejecimientoRango,
  AlertaCompleta,
  PedidoEnriquecido,
} from "./cartera";

// Sanitizar input para evitar inyeccion en filtros PostgREST
function sanitizeSearchInput(input: string): string {
  return input.replace(/[%_.*,()\\\n\r]/g, "");
}

// --- Dashboard ---

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_dashboard_kpis", {
    p_tenant_id: tenantId,
  });

  if (error) throw error;

  // Si la RPC no existe aun, fallback a calculo manual
  if (!data) {
    return {
      cartera_total: 0,
      cartera_vencida: 0,
      cartera_por_vencer: 0,
      clientes_con_deuda: 0,
      facturas_vencidas: 0,
      facturas_por_vencer: 0,
    };
  }

  return data as DashboardKPIs;
}

export async function getEnvejecimiento(): Promise<EnvejecimientoRango[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_envejecimiento", {
    p_tenant_id: tenantId,
  });

  if (error) throw error;
  return (data as EnvejecimientoRango[]) || [];
}

export async function getTopClientesDeuda(limit = 10): Promise<ClienteEnriquecido[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vista_cliente_resumen")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("total_deuda", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as ClienteEnriquecido[]) || [];
}

export async function getAlertasCompletas(): Promise<AlertaCompleta[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_alertas_completas", {
    p_tenant_id: tenantId,
  });

  if (error) throw error;
  return (data as AlertaCompleta[]) || [];
}

export async function getPedidosPendientes(
  dias = 7,
  limit = 50
): Promise<PedidoEnriquecido[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - dias);

  const { data, error } = await supabase
    .from("vista_pedidos_enriquecida")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("estado", "Sin Descargar")
    .gte("fecha", fechaLimite.toISOString().split("T")[0])
    .order("fecha", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as PedidoEnriquecido[]) || [];
}

// --- Clientes ---

export async function getClientesConSaldo(options?: {
  busqueda?: string;
  ciudad?: string;
  segmento?: string;
  solo_vencidos?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ clientes: ClienteEnriquecido[]; total: number }> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  let query = supabase
    .from("vista_cliente_resumen")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (options?.busqueda) {
    const sanitized = sanitizeSearchInput(options.busqueda);
    if (sanitized) {
      query = query.or(
        `razon_social.ilike.%${sanitized}%,codigo_cliente.ilike.%${sanitized}%`
      );
    }
  }

  if (options?.ciudad) {
    query = query.eq("ciudad", options.ciudad);
  }

  if (options?.segmento) {
    query = query.eq("segmento", options.segmento);
  }

  if (options?.solo_vencidos) {
    query = query.gt("total_vencido", 0);
  }

  const { data, error, count } = await query
    .order("total_deuda", { ascending: false })
    .range(
      options?.offset || 0,
      (options?.offset || 0) + (options?.limit || 20) - 1
    );

  if (error) throw error;
  return { clientes: (data as ClienteEnriquecido[]) || [], total: count || 0 };
}

export async function getDetalleCliente(codigoCliente: string): Promise<{
  info: ClienteEnriquecido | null;
  facturas: import("./cartera").FacturaEnriquecida[];
  pedidos: PedidoEnriquecido[];
}> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  // Ejecutar las 3 queries en paralelo
  const [infoResult, facturasResult, pedidosResult] = await Promise.all([
    supabase
      .from("vista_cliente_resumen")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("codigo_cliente", codigoCliente)
      .single(),
    supabase
      .from("vista_cartera_enriquecida")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("codigo_cliente", codigoCliente)
      .order("fecha_vencimiento", { ascending: false }),
    supabase
      .from("vista_pedidos_enriquecida")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("codigo_cliente", codigoCliente)
      .order("fecha", { ascending: false })
      .limit(10),
  ]);

  return {
    info: (infoResult.data as ClienteEnriquecido) || null,
    facturas: (facturasResult.data as import("./cartera").FacturaEnriquecida[]) || [],
    pedidos: (pedidosResult.data as PedidoEnriquecido[]) || [],
  };
}

// --- Filtros ---

export async function getCiudades(): Promise<string[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_ciudades", {
    p_tenant_id: tenantId,
  });

  if (error) throw error;
  return (data as string[]) || [];
}

export async function getSegmentos(): Promise<string[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_segmentos", {
    p_tenant_id: tenantId,
  });

  if (error) throw error;
  return (data as string[]) || [];
}
