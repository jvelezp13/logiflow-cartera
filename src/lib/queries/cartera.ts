import { createClient } from "@/lib/supabase/client";
import type {
  Cartera,
  Pedido,
  MaestraTotal,
  ClienteConSaldo,
  ResumenCartera,
  AlertaCartera,
} from "@/types/cartera";

const client = createClient();

// Tenant por defecto - Nexo Distribuciones
const DEFAULT_TENANT_ID = "0bd44961-e36a-4fc1-8fbd-6577b09e6139";

export async function getResumenCartera(
  tenantId: string = DEFAULT_TENANT_ID,
): Promise<ResumenCartera> {
  const { data, error } = await client
    .from("cartera")
    .select("total, mora")
    .eq("tenant_id", tenantId);

  if (error) throw error;

  const totales = data.reduce(
    (acc, item) => {
      acc.total += item.total || 0;
      if (item.mora && item.mora > 0) {
        acc.vencido += item.total || 0;
      } else {
        acc.por_vencer += item.total || 0;
      }
      return acc;
    },
    { total: 0, por_vencer: 0, vencido: 0 },
  );

  // Contar clientes únicos
  const { data: clientesData } = await client
    .from("cartera")
    .select("codigo_cliente")
    .eq("tenant_id", tenantId);

  const clientesUnicos = new Set(clientesData?.map((c) => c.codigo_cliente));

  return {
    ...totales,
    clientes_activos: clientesUnicos.size,
  };
}

export async function getClientesConSaldo(
  tenantId: string = DEFAULT_TENANT_ID,
  options?: {
    busqueda?: string;
    ciudad?: string;
    segmento?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ clientes: ClienteConSaldo[]; total: number }> {
  let query = client
    .from("cartera")
    .select(
      `
      codigo_cliente,
      no_factura,
      total,
      fecha_vencimiento,
      mora
    `,
    )
    .eq("tenant_id", tenantId);

  if (options?.busqueda) {
    query = query.ilike("codigo_cliente", `%${options.busqueda}%`);
  }

  const { data: carteraData, error: carteraError } = await query;

  if (carteraError) throw carteraError;

  // Agrupar por cliente
  const clientesMap = new Map<string, ClienteConSaldo>();

  for (const item of carteraData || []) {
    const existing = clientesMap.get(item.codigo_cliente);
    if (existing) {
      existing.saldo += item.total || 0;
      existing.num_facturas += 1;
      if (
        item.fecha_vencimiento &&
        (!existing.ultima_fecha ||
          item.fecha_vencimiento > existing.ultima_fecha)
      ) {
        existing.ultima_fecha = item.fecha_vencimiento;
      }
    } else {
      clientesMap.set(item.codigo_cliente, {
        codigo_cliente: item.codigo_cliente,
        razon_social: null,
        documento: null,
        ciudad: null,
        segmento: null,
        estado: null,
        saldo: item.total || 0,
        num_facturas: 1,
        ultima_fecha: item.fecha_vencimiento,
      });
    }
  }

  // Obtener datos de maestra_total
  const codigos = Array.from(clientesMap.keys());
  if (codigos.length > 0) {
    const { data: maestraData } = await client
      .from("maestra_total_v2")
      .select("codigo_ecom, razon_social, documento, ciudad, segmento, estado")
      .eq("tenant_id", tenantId)
      .in("codigo_ecom", codigos);

    for (const m of maestraData || []) {
      const cliente = clientesMap.get(m.codigo_ecom);
      if (cliente) {
        cliente.razon_social = m.razon_social;
        cliente.documento = m.documento;
        cliente.ciudad = m.ciudad;
        cliente.segmento = m.segmento;
        cliente.estado = m.estado;
      }
    }
  }

  // Aplicar filtros adicionales
  let clientes = Array.from(clientesMap.values());

  if (options?.ciudad) {
    clientes = clientes.filter((c) => c.ciudad === options.ciudad);
  }
  if (options?.segmento) {
    clientes = clientes.filter((c) => c.segmento === options.segmento);
  }

  // Ordenar por saldo descendente
  clientes.sort((a, b) => b.saldo - a.saldo);

  const total = clientes.length;

  // Aplicar paginación
  if (options?.limit) {
    clientes = clientes.slice(
      options.offset || 0,
      (options.offset || 0) + options.limit,
    );
  }

  return { clientes, total };
}

export async function getDetalleCliente(
  codigoCliente: string,
  tenantId: string = DEFAULT_TENANT_ID,
): Promise<{
  info: MaestraTotal | null;
  facturas: Cartera[];
  pedidos: Pedido[];
}> {
  // Info del cliente
  const { data: info } = await client
    .from("maestra_total_v2")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("codigo_ecom", codigoCliente)
    .single();

  // Facturas
  const { data: facturas } = await client
    .from("cartera")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("codigo_cliente", codigoCliente)
    .order("fecha_vencimiento", { ascending: false });

  // Pedidos
  const { data: pedidos } = await client
    .from("pedidos")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("codigo_cliente", codigoCliente)
    .order("fecha", { ascending: false })
    .limit(10);

  return {
    info: info || null,
    facturas: facturas || [],
    pedidos: pedidos || [],
  };
}

export async function getEnvejecimiento(
  tenantId: string = DEFAULT_TENANT_ID,
  rangos: { label: string; min: number; max: number | null }[] = [
    { label: "0-30 días", min: 0, max: 30 },
    { label: "31-60 días", min: 31, max: 60 },
    { label: "61-90 días", min: 61, max: 90 },
    { label: "90+ días", min: 91, max: null },
  ],
): Promise<{ label: string; total: number; porcentaje: number }[]> {
  const { data, error } = await client
    .from("cartera")
    .select("mora, total")
    .eq("tenant_id", tenantId);

  if (error) throw error;

  const totalGeneral = data.reduce((sum, item) => sum + (item.total || 0), 0);

  return rangos.map((rango) => {
    const filtered = data.filter((item) => {
      const mora = item.mora || 0;
      if (rango.max === null) {
        return mora >= rango.min;
      }
      return mora >= rango.min && mora <= rango.max;
    });

    const total = filtered.reduce((sum, item) => sum + (item.total || 0), 0);

    return {
      label: rango.label,
      total,
      porcentaje: totalGeneral > 0 ? (total / totalGeneral) * 100 : 0,
    };
  });
}

export async function getAlertas(
  tenantId: string = DEFAULT_TENANT_ID,
  diasPedidos: number = 3,
  rangoMoraMin: number = 1,
  rangoMoraMax: number = 30,
): Promise<AlertaCartera[]> {
  // Clientes con pedidos recientes
  const { data: pedidosData } = await client
    .from("pedidos")
    .select("codigo_cliente, num_pedido, fecha, total")
    .eq("tenant_id", tenantId)
    .gte(
      "fecha",
      new Date(Date.now() - diasPedidos * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    )
    .order("fecha", { ascending: false });

  if (!pedidosData || pedidosData.length === 0) {
    return [];
  }

  const codigosClientes = [
    ...new Set(pedidosData.map((p) => p.codigo_cliente).filter(Boolean)),
  ];

  if (codigosClientes.length === 0) {
    return [];
  }

  // Facturas vencidas de esos clientes
  const { data: carteraData } = await client
    .from("cartera")
    .select("codigo_cliente, no_factura, fecha_vencimiento, total, mora")
    .eq("tenant_id", tenantId)
    .in("codigo_cliente", codigosClientes)
    .gt("mora", rangoMoraMin - 1)
    .lte("mora", rangoMoraMax);

  // Obtener datos de maestra para razón social
  const { data: maestraData } = await client
    .from("maestra_total_v2")
    .select("codigo_ecom, razon_social")
    .eq("tenant_id", tenantId)
    .in("codigo_ecom", codigosClientes);

  const maestraMap = new Map(
    maestraData?.map((m) => [m.codigo_ecom, m.razon_social]) || [],
  );

  // Mapear pedidos a alertas
  const alertas: AlertaCartera[] = [];

  for (const pedido of pedidosData) {
    if (!pedido.codigo_cliente) continue;

    const facturasVencidas =
      carteraData?.filter(
        (c) => c.codigo_cliente === pedido.codigo_cliente && c.mora > 0,
      ) || [];

    for (const factura of facturasVencidas) {
      alertas.push({
        codigo_cliente: pedido.codigo_cliente,
        razon_social: maestraMap.get(pedido.codigo_cliente) || null,
        num_pedido: pedido.num_pedido,
        fecha_pedido: pedido.fecha,
        valor_pedido: pedido.total,
        no_factura: factura.no_factura,
        fecha_vencimiento: factura.fecha_vencimiento,
        valor_factura: factura.total,
        mora: factura.mora,
      });
    }
  }

  return alertas;
}

export async function getCiudades(
  tenantId: string = DEFAULT_TENANT_ID,
): Promise<string[]> {
  const { data, error } = await client
    .from("maestra_total_v2")
    .select("ciudad")
    .eq("tenant_id", tenantId)
    .not("ciudad", "is", null);

  if (error) throw error;

  return [...new Set(data?.map((d) => d.ciudad).filter(Boolean) || [])].sort();
}

export async function getSegmentos(
  tenantId: string = DEFAULT_TENANT_ID,
): Promise<string[]> {
  const { data, error } = await client
    .from("maestra_total_v2")
    .select("segmento")
    .eq("tenant_id", tenantId)
    .not("segmento", "is", null);

  if (error) throw error;

  return [
    ...new Set(data?.map((d) => d.segmento).filter(Boolean) || []),
  ].sort();
}
