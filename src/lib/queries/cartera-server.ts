/**
 * Queries server-side que usan el server client de Supabase.
 * Todas las funciones obtienen el tenant_id del usuario autenticado.
 */
import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";

// Re-exportar interfaces para uso en componentes
export type {
  DashboardKPIs,
  ClienteEnriquecido,
  FacturaEnriquecida,
  PedidoEnriquecido,
  EnvejecimientoRango,
  AlertaCompleta,
  CiudadResumen,
} from "./cartera";

import type {
  DashboardKPIs,
  ClienteEnriquecido,
  EnvejecimientoRango,
  AlertaCompleta,
  PedidoEnriquecido,
  CiudadResumen,
} from "./cartera";

// Sanitizar input para evitar inyeccion en filtros PostgREST
function sanitizeSearchInput(input: string): string {
  return input.replace(/[%_.*,()\\\n\r]/g, "");
}

// --- Dashboard ---

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const tenantId = await getTenantId();
  const incluirCastigada = await getIncluirCastigada();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_dashboard_kpis", {
    p_tenant_id: tenantId,
    p_incluir_castigada: incluirCastigada,
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
  const incluirCastigada = await getIncluirCastigada();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_envejecimiento", {
    p_tenant_id: tenantId,
    p_incluir_castigada: incluirCastigada,
  });

  if (error) throw error;
  return (data as EnvejecimientoRango[]) || [];
}

export interface GrupoSeveridad {
  severidad: "tolerable" | "atencion" | "critico";
  total: number;
  cantidad_facturas: number;
  cantidad_clientes: number;
}

export interface ResumenSeveridad {
  total_clientes: number;
  total_facturas: number;
  gran_total: number;
  grupos: GrupoSeveridad[];
}

export async function getResumenSeveridad(): Promise<ResumenSeveridad> {
  const tenantId = await getTenantId();
  const incluirCastigada = await getIncluirCastigada();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_resumen_severidad", {
    p_tenant_id: tenantId,
    p_incluir_castigada: incluirCastigada,
  });

  if (error) throw error;
  return (data as ResumenSeveridad) || { total_clientes: 0, total_facturas: 0, gran_total: 0, grupos: [] };
}

export async function getTopClientesDeuda(limit = 10): Promise<ClienteEnriquecido[]> {
  const tenantId = await getTenantId();
  const incluirCastigada = await getIncluirCastigada();
  const supabase = await createClient();

  let query = supabase
    .from("vista_cliente_resumen")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("total_deuda", { ascending: false })
    .limit(limit);

  // Filtrar clientes cuya mora maxima supera 90 dias
  if (!incluirCastigada) {
    query = query.lte("maxima_mora", 90);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data as ClienteEnriquecido[]) || [];
}

export async function getTopCiudadesDeuda(limit = 10): Promise<CiudadResumen[]> {
  const tenantId = await getTenantId();
  const incluirCastigada = await getIncluirCastigada();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_top_ciudades_deuda", {
    p_tenant_id: tenantId,
    p_incluir_castigada: incluirCastigada,
    p_limit: limit,
  });

  if (error) throw error;
  return (data as CiudadResumen[]) || [];
}

export async function getAlertasCompletas(): Promise<AlertaCompleta[]> {
  const tenantId = await getTenantId();
  const incluirCastigada = await getIncluirCastigada();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_alertas_completas", {
    p_tenant_id: tenantId,
    p_incluir_castigada: incluirCastigada,
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

// Rangos de envejecimiento con sus limites de mora
const RANGOS_MORA: Record<string, [number, number]> = {
  "al_dia":  [  -Infinity, 0  ],
  "1-5":     [  1,         5  ],
  "6-10":    [  6,        10  ],
  "11-15":   [ 11,        15  ],
  "16-20":   [ 16,        20  ],
  "21-30":   [ 21,        30  ],
  "31-60":   [ 31,        60  ],
  "61-90":   [ 61,        90  ],
  "90+":     [ 91,  Infinity  ],
};

export async function getClientesConSaldo(options?: {
  busqueda?: string;
  ciudad?: string;
  severidad?: "tolerable" | "atencion" | "critico";
  rango?: string;
  limit?: number;
  offset?: number;
}): Promise<{ clientes: ClienteEnriquecido[]; total: number }> {
  const tenantId = await getTenantId();
  const incluirCastigada = await getIncluirCastigada();
  const supabase = await createClient();

  let query = supabase
    .from("vista_cliente_resumen")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (!incluirCastigada) {
    query = query.lte("maxima_mora", 90);
  }

  if (options?.busqueda) {
    const sanitized = sanitizeSearchInput(options.busqueda);
    if (sanitized) {
      query = query.or(
        `razon_social.ilike.%${sanitized}%,codigo_cliente.ilike.%${sanitized}%,nombre_negocio.ilike.%${sanitized}%`
      );
    }
  }

  if (options?.ciudad) {
    query = query.eq("ciudad", options.ciudad);
  }

  // Filtro por severidad basado en maxima_mora
  if (options?.severidad === "tolerable") {
    query = query.lte("maxima_mora", 5);
  } else if (options?.severidad === "atencion") {
    query = query.gt("maxima_mora", 5).lte("maxima_mora", 20);
  } else if (options?.severidad === "critico") {
    query = query.gt("maxima_mora", 20);
  }

  // Filtro por rango de envejecimiento
  if (options?.rango && RANGOS_MORA[options.rango]) {
    const [min, max] = RANGOS_MORA[options.rango];
    if (min === -Infinity) {
      query = query.lte("maxima_mora", max);
    } else if (max === Infinity) {
      query = query.gt("maxima_mora", 90);
    } else {
      query = query.gte("maxima_mora", min).lte("maxima_mora", max);
    }
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
      .eq("tipo", "PEDIDO")
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
