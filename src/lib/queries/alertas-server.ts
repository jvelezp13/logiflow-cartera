/**
 * Queries server-side para la pagina de Alertas.
 * Separado de cartera-server.ts para mantener archivos pequenos.
 */
import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { logError } from "@/lib/logger";

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
  dias_sin_pedido: number | null;
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
  nombre_negocio?: string | null;
}

// Tipos de novedades de cartera relevantes
const TIPOS_CARTERA = [
  "cartera_factura_pagada",
  "cupo_cambio",
  "credito_activado",
  "cartera_deuda_creciente",
  "cartera_cliente_nuevo",
  "plazo_cambio",
];

// --- Queries ---

/**
 * Clientes con cupo activo: excedido (>80%) y ocioso (<50%) en UNA sola query.
 * No filtra por castigada — el cupo mide exposicion crediticia total,
 * independiente de la antiguedad de la mora.
 */
export async function getClientesCupo(): Promise<{
  excedido: ClienteCupoAlerta[];
  ocioso: ClienteCupoOcioso[];
}> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vista_cliente_resumen")
    .select("codigo_cliente, nombre_negocio, ciudad, cupo_asignado, total_deuda, estado_credito")
    .eq("tenant_id", tenantId)
    .eq("estado_credito", "Activo")
    .gt("cupo_asignado", 0);

  if (error) throw error;

  const excedido: ClienteCupoAlerta[] = [];
  const ocioso: ClienteCupoOcioso[] = [];

  for (const c of data || []) {
    const cupo = Number(c.cupo_asignado || 0);
    const deuda = Number(c.total_deuda || 0);
    const uso = (deuda / cupo) * 100;

    if (uso >= 80) {
      const nivel: ClienteCupoAlerta["nivel"] =
        uso > 95 ? "critica" : uso > 90 ? "alta" : "media";
      excedido.push({
        codigo_cliente: c.codigo_cliente,
        nombre_negocio: c.nombre_negocio,
        ciudad: c.ciudad,
        cupo_asignado: cupo,
        total_deuda: deuda,
        uso_porcentaje: uso,
        nivel,
      });
    } else if (uso < 50) {
      ocioso.push({
        codigo_cliente: c.codigo_cliente,
        nombre_negocio: c.nombre_negocio,
        ciudad: c.ciudad,
        cupo_asignado: cupo,
        total_deuda: deuda,
        uso_porcentaje: uso,
      });
    }
  }

  excedido.sort((a, b) => b.uso_porcentaje - a.uso_porcentaje);
  ocioso.sort((a, b) => a.uso_porcentaje - b.uso_porcentaje);

  return { excedido, ocioso };
}

/**
 * Clientes con deuda vencida pero sin pedidos en 30+ dias.
 * Incluye clientes sin pedidos registrados (la tabla pedidos se poda a 30 dias,
 * asi que null = sin actividad reciente confirmada).
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

  // Filtrar en DB: sin pedidos o ultimo pedido hace 30+ dias
  const fechaCorte = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  query = query.or(`ultimo_pedido_fecha.is.null,ultimo_pedido_fecha.lte.${fechaCorte}`);

  const { data, error } = await query;
  if (error) throw error;

  const ahora = Date.now();
  const resultado: ClienteInactivo[] = [];
  for (const c of data || []) {
    let diasSinPedido: number | null = null;
    if (c.ultimo_pedido_fecha) {
      const diff = ahora - new Date(c.ultimo_pedido_fecha + "T00:00:00").getTime();
      diasSinPedido = Math.floor(diff / 86400000);
    }

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

  // Sin pedidos primero (mas preocupante), luego por mayor deuda
  resultado.sort((a, b) => {
    if (a.dias_sin_pedido === null && b.dias_sin_pedido !== null) return -1;
    if (a.dias_sin_pedido !== null && b.dias_sin_pedido === null) return 1;
    return b.total_deuda - a.total_deuda;
  });
  return resultado;
}

/**
 * Novedades de sync_alertas (tipos cartera-relevantes, ultimos 30 dias).
 * Retorna array vacio si la tabla no existe (es propiedad de Sync-Logiflow).
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

  if (error) {
    console.warn("[alertas] sync_alertas no disponible:", error.code, error.message);
    return [];
  }

  const novedades = (data as NovedadSync[]) || [];

  // Enriquecer en paralelo: filtrar facturas ya pagadas + resolver nombres de clientes
  const facturasPagadas = novedades
    .filter((n) => n.tipo === "cartera_factura_pagada" && n.datos?.no_factura)
    .map((n) => String(n.datos!.no_factura));
  const codigos = [...new Set(novedades.map((n) => n.referencia).filter(Boolean))] as string[];

  const [pagosRes, clientesRes, carteraRes] = await Promise.all([
    facturasPagadas.length > 0
      ? supabase.from("pago_facturas").select("no_factura").in("no_factura", facturasPagadas)
      : Promise.resolve({ data: [] as { no_factura: string }[] }),
    codigos.length > 0
      ? supabase.from("vista_cliente_resumen").select("codigo_cliente, nombre_negocio").eq("tenant_id", tenantId).in("codigo_cliente", codigos)
      : Promise.resolve({ data: [] as { codigo_cliente: string; nombre_negocio: string | null }[] }),
    facturasPagadas.length > 0
      ? supabase.from("cartera").select("no_factura").eq("tenant_id", tenantId).in("no_factura", facturasPagadas).gt("total", 0)
      : Promise.resolve({ data: [] as { no_factura: string }[] }),
  ]);

  const setConPago = new Set((pagosRes.data || []).map((r) => r.no_factura));
  const setEnCartera = new Set((carteraRes.data || []).map((r) => r.no_factura));
  const nombresMap = new Map((clientesRes.data || []).map((c) => [c.codigo_cliente, c.nombre_negocio]));

  // Facturas que volvieron a cartera (planilla anulada resuelta) — marcar como leidas
  const idsAutoLeidas: string[] = [];
  const resultado: NovedadSync[] = [];

  for (const n of novedades) {
    if (n.tipo === "cartera_factura_pagada" && n.datos?.no_factura) {
      const fac = String(n.datos.no_factura);
      if (setConPago.has(fac)) continue;
      if (setEnCartera.has(fac)) { idsAutoLeidas.push(n.id); continue; }
    }
    resultado.push(n);
  }

  if (idsAutoLeidas.length > 0) {
    supabase
      .from("sync_alertas")
      .update({ leida: true })
      .eq("tenant_id", tenantId)
      .in("id", idsAutoLeidas)
      .then(null, (err) => logError("[alertas] auto-marcar leidas", err));
  }

  for (const n of resultado) {
    if (n.referencia) n.nombre_negocio = nombresMap.get(n.referencia) ?? null;
  }

  return resultado;
}
