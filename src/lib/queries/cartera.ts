import { createClient } from "@/lib/supabase/client";

const client = createClient();

export const DEFAULT_TENANT_ID = "0bd44961-e36a-4fc1-8fbd-6577b09e6139";

// Sanitizar input para evitar inyeccion en filtros PostgREST
function sanitizeSearchInput(input: string): string {
  return input.replace(/[%_.*,()\\\n\r]/g, "");
}

export interface DashboardKPIs {
  cartera_total: number;
  cartera_vencida: number;
  cartera_por_vencer: number;
  clientes_con_deuda: number;
  facturas_vencidas: number;
  facturas_por_vencer: number;
}

export interface ClienteEnriquecido {
  codigo_cliente: string;
  razon_social: string | null;
  nombre_negocio: string | null;
  nombre_completo: string | null;
  documento: string | null;
  ciudad: string | null;
  departamento: string | null;
  barrio: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  segmento: string | null;
  tipologia: string | null;
  canal: string | null;
  subcanal: string | null;
  estado: string | null;
  total_deuda: number;
  total_vencido: number;
  total_por_vencer: number;
  num_facturas: number;
  maxima_mora: number;
  pedidos_pendientes: number;
  estado_credito: string | null;
  cupo_asignado: number | null;
  ultimo_pedido_fecha: string | null;
}

export interface FacturaEnriquecida {
  codigo_cliente: string;
  razon_social: string | null;
  nombre_negocio: string | null;
  ciudad: string | null;
  segmento: string | null;
  no_factura: string;
  fecha_factura: string | null;
  fecha_vencimiento: string | null;
  mora: number;
  total: number;
  vendedor: string | null;
  estado_factura: string;
  rango_mora: string;
}

export interface PedidoEnriquecido {
  num_pedido: string;
  estado: string;
  fecha: string;
  codigo_cliente: string;
  razon_social: string | null;
  ciudad: string | null;
  total: number;
  nombre_asesor: string | null;
  deuda_total_cliente: number | null;
  facturas_vencidas_cliente: number | null;
}

export interface EnvejecimientoRango {
  label: string;
  total: number;
  cantidad_facturas: number;
  cantidad_clientes: number;
  porcentaje: number;
}

export interface CiudadResumen {
  ciudad: string;
  num_clientes: number;
  total_deuda: number;
  total_vencido: number;
}

export interface AlertaCompleta {
  tipo: "PEDIDOS_PENDIENTES" | "DEUDA_VENCIDA" | "CUPO_EXCEDIDO" | "CLIENTE_INACTIVO" | "SIN_CREDITO";
  severidad: "critica" | "alta" | "media" | "baja";
  titulo: string;
  descripcion: string;
  codigo_cliente: string;
  razon_social: string | null;
  ciudad: string | null;
  valor: number;
  factura?: string;
  dias_mora?: number;
  porcentaje_utilizado?: number;
  dias_sin_pedido?: number;
}

// Dashboard KPIs usando vista enriquecida
export async function getDashboardKPIs(tenantId: string = DEFAULT_TENANT_ID): Promise<DashboardKPIs> {
  const { data, error } = await client
    .from("vista_cliente_resumen")
    .select("*")
    .eq("tenant_id", tenantId);

  if (error) throw error;

  const kpis = data?.reduce(
    (acc, cliente) => {
      acc.cartera_total += Number(cliente.total_deuda) || 0;
      acc.cartera_vencida += Number(cliente.total_vencido) || 0;
      acc.cartera_por_vencer += Number(cliente.total_por_vencer) || 0;
      acc.clientes_con_deuda += 1;
      return acc;
    },
    {
      cartera_total: 0,
      cartera_vencida: 0,
      cartera_por_vencer: 0,
      clientes_con_deuda: 0,
      facturas_vencidas: 0,
      facturas_por_vencer: 0,
    } as DashboardKPIs
  ) || {
    cartera_total: 0,
    cartera_vencida: 0,
    cartera_por_vencer: 0,
    clientes_con_deuda: 0,
    facturas_vencidas: 0,
    facturas_por_vencer: 0,
  };

  // Obtener conteo de facturas
  const { data: facturasData } = await client
    .from("vista_cartera_enriquecida")
    .select("mora")
    .eq("tenant_id", tenantId);

  if (facturasData) {
    kpis.facturas_vencidas = facturasData.filter(f => (f.mora || 0) > 0).length;
    kpis.facturas_por_vencer = facturasData.filter(f => (f.mora || 0) <= 0).length;
  }

  return kpis;
}

// Envejecimiento por rangos
export async function getEnvejecimiento(tenantId: string = DEFAULT_TENANT_ID): Promise<EnvejecimientoRango[]> {
  const { data, error } = await client
    .from("vista_cartera_enriquecida")
    .select("rango_mora, total, codigo_cliente")
    .eq("tenant_id", tenantId);

  if (error) throw error;

  const rangos = ["0", "1-30", "31-60", "61-90", "90+"];
  const totalGeneral = data?.reduce((sum, f) => sum + Number(f.total), 0) || 0;

  return rangos.map(rango => {
    const filtered = data?.filter(f => f.rango_mora === rango) || [];
    const total = filtered.reduce((sum, f) => sum + Number(f.total), 0);
    return {
      label: rango === "0" ? "Al día" : `${rango} días`,
      total,
      cantidad_facturas: filtered.length,
      cantidad_clientes: new Set(filtered.map(f => f.codigo_cliente)).size,
      porcentaje: totalGeneral > 0 ? (total / totalGeneral) * 100 : 0,
    };
  });
}

// Top clientes con más deuda
export async function getTopClientesDeuda(
  tenantId: string = DEFAULT_TENANT_ID,
  limit: number = 10
): Promise<ClienteEnriquecido[]> {
  const { data, error } = await client
    .from("vista_cliente_resumen")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("total_deuda", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Lista de clientes con saldo
export async function getClientesConSaldo(
  tenantId: string = DEFAULT_TENANT_ID,
  options?: {
    busqueda?: string;
    ciudad?: string;
    segmento?: string;
    solo_vencidos?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ clientes: ClienteEnriquecido[]; total: number }> {
  let query = client
    .from("vista_cliente_resumen")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (options?.busqueda) {
    const sanitized = sanitizeSearchInput(options.busqueda);
    if (sanitized) {
      query = query.or(`razon_social.ilike.%${sanitized}%,codigo_cliente.ilike.%${sanitized}%`);
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
    .range(options?.offset || 0, (options?.offset || 0) + (options?.limit || 20) - 1);

  if (error) throw error;

  return { clientes: data || [], total: count || 0 };
}

// Detalle de un cliente específico
export async function getDetalleCliente(
  codigoCliente: string,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<{
  info: ClienteEnriquecido | null;
  facturas: FacturaEnriquecida[];
  pedidos: PedidoEnriquecido[];
}> {
  // Info del cliente
  const { data: clienteData } = await client
    .from("vista_cliente_resumen")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("codigo_cliente", codigoCliente)
    .single();

  // Facturas
  const { data: facturasData } = await client
    .from("vista_cartera_enriquecida")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("codigo_cliente", codigoCliente)
    .order("fecha_vencimiento", { ascending: false });

  // Pedidos
  const { data: pedidosData } = await client
    .from("vista_pedidos_enriquecida")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("codigo_cliente", codigoCliente)
    .order("fecha", { ascending: false })
    .limit(10);

  return {
    info: clienteData || null,
    facturas: facturasData || [],
    pedidos: pedidosData || [],
  };
}

// Pedidos pendientes (Sin Descargar) recientes
export async function getPedidosPendientes(
  tenantId: string = DEFAULT_TENANT_ID,
  dias: number = 7,
  limit: number = 50
): Promise<PedidoEnriquecido[]> {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - dias);

  const { data, error } = await client
    .from("vista_pedidos_enriquecida")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("estado", "Sin Descargar")
    .gte("fecha", fechaLimite.toISOString().split("T")[0])
    .order("fecha", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Lista de ciudades disponibles
export async function getCiudades(tenantId: string = DEFAULT_TENANT_ID): Promise<string[]> {
  const { data, error } = await client
    .from("vista_cliente_resumen")
    .select("ciudad")
    .eq("tenant_id", tenantId)
    .not("ciudad", "is", null);

  if (error) throw error;
  return [...new Set(data?.map(d => d.ciudad).filter(Boolean) || [])].sort();
}

// Lista de segmentos disponibles
export async function getSegmentos(tenantId: string = DEFAULT_TENANT_ID): Promise<string[]> {
  const { data, error } = await client
    .from("vista_cliente_resumen")
    .select("segmento")
    .eq("tenant_id", tenantId)
    .not("segmento", "is", null);

  if (error) throw error;
  return [...new Set(data?.map(d => d.segmento).filter(Boolean) || [])].sort();
}

// Sistema completo de alertas
export async function getAlertasCompletas(tenantId: string = DEFAULT_TENANT_ID): Promise<AlertaCompleta[]> {
  const alertas: AlertaCompleta[] = [];

  // 1. Clientes con pedidos pendientes (Sin Descargar)
  const pedidosPendientes = await getPedidosPendientes(tenantId, 3, 100);
  
  for (const pedido of pedidosPendientes) {
    if ((pedido.facturas_vencidas_cliente || 0) > 0) {
      alertas.push({
        tipo: "PEDIDOS_PENDIENTES",
        severidad: "alta",
        titulo: "Pedido pendiente con deuda vencida",
        descripcion: `Cliente con pedido #${pedido.num_pedido} sin descargar y con facturas vencidas`,
        codigo_cliente: pedido.codigo_cliente,
        razon_social: pedido.razon_social,
        ciudad: pedido.ciudad,
        valor: Number(pedido.total),
        dias_mora: undefined,
      });
    }
  }

  // 2. Clientes con deuda vencida significativa
  const { data: clientesConDeuda } = await client
    .from("vista_cliente_resumen")
    .select("*")
    .eq("tenant_id", tenantId)
    .gt("total_vencido", 0)
    .order("total_vencido", { ascending: false })
    .limit(20);

  for (const cliente of clientesConDeuda || []) {
    if (Number(cliente.total_vencido) > 1000000) {
      alertas.push({
        tipo: "DEUDA_VENCIDA",
        severidad: Number(cliente.total_vencido) > 3000000 ? "critica" : "alta",
        titulo: "Deuda vencida significativa",
        descripcion: `Cliente con $${Number(cliente.total_vencido).toLocaleString()} en deuda vencida`,
        codigo_cliente: cliente.codigo_cliente,
        razon_social: cliente.razon_social,
        ciudad: cliente.ciudad,
        valor: Number(cliente.total_vencido),
        dias_mora: Number(cliente.maxima_mora),
      });
    }
  }

  // 3. Clientes cerca del cupo (más de 80%)
  const { data: clientesCredito } = await client
    .from("vista_cliente_resumen")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("estado_credito", "Activo")
    .not("cupo_asignado", "is", null)
    .gt("cupo_asignado", 0);

  for (const cliente of clientesCredito || []) {
    const utilizado = Number(cliente.total_deuda);
    const cupo = Number(cliente.cupo_asignado);
    const porcentaje = (utilizado /cupo) * 100;

    if (porcentaje > 80) {
      alertas.push({
        tipo: "CUPO_EXCEDIDO",
        severidad: porcentaje > 95 ? "critica" : porcentaje > 90 ? "alta" : "media",
        titulo: porcentaje > 100 ? "Cupo excedido" : "Cerca del cupo de crédito",
        descripcion: `Cliente usando ${porcentaje.toFixed(1)}% del cupo ($${utilizado.toLocaleString()} de $${cupo.toLocaleString()})`,
        codigo_cliente: cliente.codigo_cliente,
        razon_social: cliente.razon_social,
        ciudad: cliente.ciudad,
        valor: utilizado,
        porcentaje_utilizado: porcentaje,
      });
    }
  }

  // 4. Clientes con deuda pero sin pedidos recientes (30+ días)
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 30);

  for (const cliente of clientesConDeuda || []) {
    if (cliente.ultimo_pedido_fecha) {
      const fechaUltimo = new Date(cliente.ultimo_pedido_fecha);
      if (fechaUltimo < fechaLimite) {
        const diasSinPedido = Math.floor((Date.now() - fechaUltimo.getTime()) / (1000 * 60 * 60 * 24));
        alertas.push({
          tipo: "CLIENTE_INACTIVO",
          severidad: "media",
          titulo: "Cliente inactivo con deuda",
          descripcion: `${diasSinPedido} días sin pedidos pero con deuda activa`,
          codigo_cliente: cliente.codigo_cliente,
          razon_social: cliente.razon_social,
          ciudad: cliente.ciudad,
          valor: Number(cliente.total_deuda),
          dias_sin_pedido: diasSinPedido,
        });
      }
    }
  }

  // Ordenar por severidad
  const severidadOrden = { critica: 0, alta: 1, media: 2, baja: 3 };
  alertas.sort((a, b) => severidadOrden[a.severidad] - severidadOrden[b.severidad]);

  return alertas;
}

