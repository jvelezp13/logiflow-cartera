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

// --- Tipos Pre-facturacion ---

export interface PedidoPreFacturacion {
  num_pedido: string;
  fecha: string;
  codigo_cliente: string;
  nombre_negocio: string | null;
  nombre_asesor: string | null;
  pedido_total: number | null;
  maxima_mora: number;
  total_vencido: number;
  severidad: "atencion" | "critico";
  // Campos de cupo (modo cupo)
  cupo_asignado: number | null;
  total_deuda: number;
  cupo_disponible: number | null;
}

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

// --- Facturas ---

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

export async function getFacturasConFiltros(options?: {
  busqueda?: string;
  ciudad?: string;
  severidad?: "tolerable" | "atencion" | "critico";
  rango?: string;
  limit?: number;
  offset?: number;
}): Promise<{ facturas: import("./cartera").FacturaEnriquecida[]; total: number }> {
  const tenantId = await getTenantId();
  const incluirCastigada = await getIncluirCastigada();
  const supabase = await createClient();

  let query = supabase
    .from("vista_cartera_enriquecida")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId);

  // Filtrar castigada (mora > 90)
  if (!incluirCastigada) {
    query = query.eq("es_castigada", false);
  }

  // Busqueda por factura o cliente
  if (options?.busqueda) {
    const sanitized = sanitizeSearchInput(options.busqueda);
    if (sanitized) {
      query = query.or(
        `no_factura.ilike.%${sanitized}%,razon_social.ilike.%${sanitized}%,nombre_negocio.ilike.%${sanitized}%,codigo_cliente.ilike.%${sanitized}%`
      );
    }
  }

  if (options?.ciudad) {
    query = query.eq("ciudad", options.ciudad);
  }

  // Filtro por severidad basado en mora de la factura
  if (options?.severidad === "tolerable") {
    query = query.lte("mora", 5);
  } else if (options?.severidad === "atencion") {
    query = query.gt("mora", 5).lte("mora", 20);
  } else if (options?.severidad === "critico") {
    query = query.gt("mora", 20);
  }

  // Filtro por rango de envejecimiento
  if (options?.rango && RANGOS_MORA[options.rango]) {
    const [min, max] = RANGOS_MORA[options.rango];
    if (min === -Infinity) {
      query = query.lte("mora", max);
    } else if (max === Infinity) {
      query = query.gt("mora", 90);
    } else {
      query = query.gte("mora", min).lte("mora", max);
    }
  }

  const { data, error, count } = await query
    .order("mora", { ascending: false })
    .range(
      options?.offset || 0,
      (options?.offset || 0) + (options?.limit || 50) - 1
    );

  if (error) throw error;
  return {
    facturas: (data as import("./cartera").FacturaEnriquecida[]) || [],
    total: count || 0,
  };
}

// --- Clientes ---

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
      .gte("fecha", new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0])
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

// --- Pre-facturacion ---

/**
 * Pedidos sin descargar de clientes con mora > 5 dias.
 * Estrategia: 2 queries secuenciales para evitar N+1.
 */
export async function getPedidosPreFacturacion(): Promise<PedidoPreFacturacion[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  // Ultimos 7 dias fijo
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 7);

  // Query 1: pedidos sin descargar en los ultimos 7 dias
  const { data: pedidosRaw, error: errorPedidos } = await supabase
    .from("vista_pedidos_enriquecida")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("estado", "Sin Descargar")
    .eq("tipo", "PEDIDO")
    .gte("fecha", fechaLimite.toISOString().split("T")[0])
    .order("fecha", { ascending: false });

  if (errorPedidos) throw errorPedidos;
  if (!pedidosRaw || pedidosRaw.length === 0) return [];

  // Extraer codigos unicos de clientes
  const codigosUnicos = [...new Set(pedidosRaw.map((p) => p.codigo_cliente as string))];

  // Query 2: solo clientes con mora > 5 (atencion o critico)
  const { data: clientesRaw, error: errorClientes } = await supabase
    .from("vista_cliente_resumen")
    .select("codigo_cliente, nombre_negocio, maxima_mora, total_vencido, cupo_asignado, total_deuda")
    .eq("tenant_id", tenantId)
    .in("codigo_cliente", codigosUnicos)
    .gt("maxima_mora", 5);

  if (errorClientes) throw errorClientes;

  // Map para lookup rapido
  const clientesMap = new Map(
    (clientesRaw || []).map((c) => [c.codigo_cliente, c])
  );

  // Filtrar y enriquecer pedidos
  const pedidos: PedidoPreFacturacion[] = [];
  for (const p of pedidosRaw) {
    const cliente = clientesMap.get(p.codigo_cliente);
    if (!cliente) continue;

    const pedidoTotal = Number(p.pedido_total || 0);
    const cupoAsignado = cliente.cupo_asignado != null ? Number(cliente.cupo_asignado) : null;
    const totalDeuda = Number(cliente.total_deuda || 0);
    const cupoDisponible = cupoAsignado != null
      ? cupoAsignado - totalDeuda - pedidoTotal
      : null;

    const severidad: "atencion" | "critico" = cliente.maxima_mora > 20 ? "critico" : "atencion";
    pedidos.push({
      num_pedido: p.num_pedido,
      fecha: p.fecha,
      codigo_cliente: p.codigo_cliente,
      nombre_negocio: cliente.nombre_negocio,
      nombre_asesor: p.nombre_asesor,
      pedido_total: p.pedido_total,
      maxima_mora: cliente.maxima_mora,
      total_vencido: cliente.total_vencido,
      severidad,
      cupo_asignado: cupoAsignado,
      total_deuda: totalDeuda,
      cupo_disponible: cupoDisponible,
    });
  }

  pedidos.sort((a, b) => b.maxima_mora - a.maxima_mora);
  return pedidos;
}

// --- Pre-facturacion: Cupo excedido (agrupado por cliente) ---

export interface ClienteCupoExcedido {
  codigo_cliente: string;
  nombre_negocio: string | null;
  cantidad_pedidos: number;
  total_pedidos: number;
  cupo_asignado: number;
  total_deuda: number;
  excede_por: number;
}

/**
 * Clientes cuya deuda + suma de pedidos pendientes excede su cupo.
 * Agrupa todos los pedidos del mismo cliente para un calculo correcto.
 */
export async function getClientesCupoExcedido(): Promise<ClienteCupoExcedido[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 7);

  // Query 1: pedidos sin descargar ultimos 7 dias
  const { data: pedidosRaw, error: errorPedidos } = await supabase
    .from("vista_pedidos_enriquecida")
    .select("codigo_cliente, pedido_total")
    .eq("tenant_id", tenantId)
    .eq("estado", "Sin Descargar")
    .eq("tipo", "PEDIDO")
    .gte("fecha", fechaLimite.toISOString().split("T")[0]);

  if (errorPedidos) throw errorPedidos;
  if (!pedidosRaw || pedidosRaw.length === 0) return [];

  // Agrupar pedidos por cliente: sumar totales y contar
  const pedidosPorCliente = new Map<string, { total: number; cantidad: number }>();
  for (const p of pedidosRaw) {
    const codigo = p.codigo_cliente as string;
    const monto = Number(p.pedido_total || 0);
    const existing = pedidosPorCliente.get(codigo);
    if (existing) {
      existing.total += monto;
      existing.cantidad += 1;
    } else {
      pedidosPorCliente.set(codigo, { total: monto, cantidad: 1 });
    }
  }

  const codigosUnicos = [...pedidosPorCliente.keys()];

  // Query 2: datos de clientes con cupo asignado
  const { data: clientesRaw, error: errorClientes } = await supabase
    .from("vista_cliente_resumen")
    .select("codigo_cliente, nombre_negocio, cupo_asignado, total_deuda")
    .eq("tenant_id", tenantId)
    .in("codigo_cliente", codigosUnicos)
    .not("cupo_asignado", "is", null);

  if (errorClientes) throw errorClientes;

  const resultado: ClienteCupoExcedido[] = [];
  for (const cliente of clientesRaw || []) {
    const cupo = Number(cliente.cupo_asignado || 0);
    if (cupo <= 0) continue;

    const deuda = Number(cliente.total_deuda || 0);
    const pedidosInfo = pedidosPorCliente.get(cliente.codigo_cliente)!;
    const totalConPedidos = deuda + pedidosInfo.total;

    // Solo incluir si (deuda + todos los pedidos) excede el cupo
    if (totalConPedidos <= cupo) continue;

    resultado.push({
      codigo_cliente: cliente.codigo_cliente,
      nombre_negocio: cliente.nombre_negocio,
      cantidad_pedidos: pedidosInfo.cantidad,
      total_pedidos: pedidosInfo.total,
      cupo_asignado: cupo,
      total_deuda: deuda,
      excede_por: totalConPedidos - cupo,
    });
  }

  // Mas excedido primero
  resultado.sort((a, b) => b.excede_por - a.excede_por);
  return resultado;
}
