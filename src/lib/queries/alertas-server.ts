/**
 * Queries server-side para la pagina de Alertas.
 * Separado de cartera-server.ts para mantener archivos pequenos.
 */
import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";

// --- Tipos ---

export interface ClienteCupoAlerta {
  codigo_cliente: string;
  nombre_negocio: string | null;
  ciudad: string | null;
  cupo_asignado: number;
  total_deuda: number;
  uso_porcentaje: number;
  nivel: "critica" | "alta" | "media";
}

export interface ClienteCupoOcioso {
  codigo_cliente: string;
  nombre_negocio: string | null;
  ciudad: string | null;
  cupo_asignado: number;
  total_deuda: number;
  uso_porcentaje: number;
}

export interface ClienteInactivo {
  codigo_cliente: string;
  nombre_negocio: string | null;
  ciudad: string | null;
  total_deuda: number;
  total_vencido: number;
  dias_sin_pedido: number;
  ultimo_pedido_fecha: string | null;
}

export interface NovedadSync {
  id: string;
  tipo: string;
  referencia: string | null;
  mensaje: string | null;
  datos: Record<string, unknown> | null;
  created_at: string;
  leida: boolean;
}

// Tipos de novedades de cartera relevantes
const TIPOS_CARTERA = [
  "cartera_factura_pagada",
  "cartera_factura_vencida",
  "cartera_mora_critica",
  "cupo_cambio",
  "credito_activado",
  "cartera_deuda_creciente",
  "cartera_cliente_nuevo",
];

// --- Queries ---

/**
 * Clientes con cupo activo cuyo uso de deuda vs cupo supera el 80%.
 * Se trae todos los activos con cupo > 0 y filtra en JS
 * (PostgREST no soporta WHERE con columnas calculadas).
 */
export async function getClientesCupoExcedidoAlertas(): Promise<ClienteCupoAlerta[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vista_cliente_resumen")
    .select("codigo_cliente, nombre_negocio, ciudad, cupo_asignado, total_deuda, estado_credito")
    .eq("tenant_id", tenantId)
    .eq("estado_credito", "Activo")
    .gt("cupo_asignado", 0);

  if (error) throw error;

  const resultado: ClienteCupoAlerta[] = [];
  for (const c of data || []) {
    const cupo = Number(c.cupo_asignado || 0);
    const deuda = Number(c.total_deuda || 0);
    if (cupo <= 0) continue;

    const uso = (deuda / cupo) * 100;
    if (uso < 80) continue;

    // Nivel segun porcentaje
    const nivel: ClienteCupoAlerta["nivel"] =
      uso > 95 ? "critica" : uso > 90 ? "alta" : "media";

    resultado.push({
      codigo_cliente: c.codigo_cliente,
      nombre_negocio: c.nombre_negocio,
      ciudad: c.ciudad,
      cupo_asignado: cupo,
      total_deuda: deuda,
      uso_porcentaje: uso,
      nivel,
    });
  }

  // Mayor uso primero
  resultado.sort((a, b) => b.uso_porcentaje - a.uso_porcentaje);
  return resultado;
}

/**
 * Clientes activos usando menos del 50% de su cupo (cupo ocioso).
 */
export async function getClientesCupoOcioso(): Promise<ClienteCupoOcioso[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vista_cliente_resumen")
    .select("codigo_cliente, nombre_negocio, ciudad, cupo_asignado, total_deuda, estado_credito")
    .eq("tenant_id", tenantId)
    .eq("estado_credito", "Activo")
    .gt("cupo_asignado", 0);

  if (error) throw error;

  const resultado: ClienteCupoOcioso[] = [];
  for (const c of data || []) {
    const cupo = Number(c.cupo_asignado || 0);
    const deuda = Number(c.total_deuda || 0);
    if (cupo <= 0) continue;

    const uso = (deuda / cupo) * 100;
    if (uso >= 50) continue;

    resultado.push({
      codigo_cliente: c.codigo_cliente,
      nombre_negocio: c.nombre_negocio,
      ciudad: c.ciudad,
      cupo_asignado: cupo,
      total_deuda: deuda,
      uso_porcentaje: uso,
    });
  }

  // Menor uso primero
  resultado.sort((a, b) => a.uso_porcentaje - b.uso_porcentaje);
  return resultado;
}

/**
 * Clientes con deuda vencida pero sin pedidos en 30+ dias.
 * Respeta filtro de cartera castigada.
 */
export async function getClientesInactivos(): Promise<ClienteInactivo[]> {
  const tenantId = await getTenantId();
  const incluirCastigada = await getIncluirCastigada();
  const supabase = await createClient();

  let query = supabase
    .from("vista_cliente_resumen")
    .select("codigo_cliente, nombre_negocio, ciudad, total_deuda, total_vencido, maxima_mora, ultimo_pedido_fecha")
    .eq("tenant_id", tenantId)
    .gt("total_vencido", 0);

  if (!incluirCastigada) {
    query = query.lte("maxima_mora", 90);
  }

  const { data, error } = await query;
  if (error) throw error;

  const ahora = Date.now();
  const limite30d = 30 * 86400000; // 30 dias en ms

  const resultado: ClienteInactivo[] = [];
  for (const c of data || []) {
    if (!c.ultimo_pedido_fecha) continue;

    const fechaUltimo = new Date(c.ultimo_pedido_fecha + "T00:00:00");
    const diff = ahora - fechaUltimo.getTime();
    if (diff < limite30d) continue;

    const diasSinPedido = Math.floor(diff / 86400000);

    resultado.push({
      codigo_cliente: c.codigo_cliente,
      nombre_negocio: c.nombre_negocio,
      ciudad: c.ciudad,
      total_deuda: Number(c.total_deuda || 0),
      total_vencido: Number(c.total_vencido || 0),
      dias_sin_pedido: diasSinPedido,
      ultimo_pedido_fecha: c.ultimo_pedido_fecha,
    });
  }

  // Mayor deuda primero
  resultado.sort((a, b) => b.total_deuda - a.total_deuda);
  return resultado;
}

/**
 * Novedades de sync_alertas (7 tipos cartera-relevantes, ultimos 30 dias).
 * Retorna array vacio si la tabla no existe.
 */
export async function getNovedadesSync(): Promise<NovedadSync[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 30);

  const { data, error } = await supabase
    .from("sync_alertas")
    .select("id, tipo, referencia, mensaje, datos, created_at, leida")
    .eq("tenant_id", tenantId)
    .in("tipo", TIPOS_CARTERA)
    .gte("created_at", fechaLimite.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  // Si la tabla no existe, retornar vacio sin romper la pagina
  if (error) {
    console.warn("sync_alertas no disponible:", error.message);
    return [];
  }

  return (data as NovedadSync[]) || [];
}
