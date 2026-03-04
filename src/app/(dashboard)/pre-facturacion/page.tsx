import { Header } from "@/components/layout/header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyFull } from "@/lib/format";
import {
  getPedidosPreFacturacion,
  getClientesCupoExcedido,
} from "@/lib/queries/cartera-server";
import type {
  PedidoPreFacturacion,
  ClienteCupoExcedido,
} from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { PreFacturacionFiltros } from "@/components/pre-facturacion/pre-facturacion-filtros";
import Link from "next/link";

// Badge de severidad del cliente
function getSeveridadBadge(severidad: "atencion" | "critico") {
  if (severidad === "critico") {
    return { label: "Critico", classes: "bg-red-100 text-red-700" };
  }
  return { label: "Atencion", classes: "bg-yellow-100 text-yellow-700" };
}

// Badge de mora
function getMoraBadge(mora: number): { label: string; classes: string } {
  if (mora <= 20) return { label: `${mora}d`, classes: "bg-yellow-100 text-yellow-700" };
  return { label: `${mora}d`, classes: "bg-red-100 text-red-700" };
}

// Formato fecha corta (dd/mm/aa)
function formatFecha(fecha: string | null): string {
  if (!fecha) return "-";
  const d = new Date(fecha + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// Color de la barra segun porcentaje de uso
function getBarColor(pct: number): string {
  if (pct > 100) return "bg-red-500";
  if (pct > 80) return "bg-yellow-500";
  return "bg-green-500";
}

export default async function PreFacturacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const modo = (params.modo === "cupo" ? "cupo" : "mora") as "mora" | "cupo";

  const [profile, incluirCastigada] = await Promise.all([
    getUserProfile(),
    getIncluirCastigada(),
  ]);

  // Solo ejecuta la query del modo activo
  const pedidosMora = modo === "mora" ? await getPedidosPreFacturacion() : [];
  const clientesCupo = modo === "cupo" ? await getClientesCupoExcedido() : [];
  const total = pedidosMora.length + clientesCupo.length;

  return (
    <>
      <Header
        titulo="Pre-facturacion"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
        {/* Filtros */}
        <PreFacturacionFiltros total={total} />

        {/* Tabla segun modo */}
        <Card>
          <CardContent className="p-0">
            {modo === "mora" ? (
              <TablaMora pedidos={pedidosMora} />
            ) : (
              <TablaCupo clientes={clientesCupo} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// --- Tabla modo MORA ---
function TablaMora({ pedidos }: { pedidos: PedidoPreFacturacion[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs py-2">Pedido</TableHead>
          <TableHead className="text-xs py-2">Cliente</TableHead>
          <TableHead className="text-xs py-2">Asesor</TableHead>
          <TableHead className="text-xs py-2 text-right">Valor Pedido</TableHead>
          <TableHead className="text-xs py-2 text-center">Severidad</TableHead>
          <TableHead className="text-xs py-2 text-center">Mora</TableHead>
          <TableHead className="text-xs py-2 text-right">Deuda Vencida</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pedidos.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-slate-500">
              No hay pedidos de clientes con mora {`>`} 5 dias (ultimos 7 dias)
            </TableCell>
          </TableRow>
        ) : (
          pedidos.map((pedido) => {
            const severidadBadge = getSeveridadBadge(pedido.severidad);
            const moraBadge = getMoraBadge(pedido.maxima_mora);
            return (
              <TableRow key={pedido.num_pedido} className="hover:bg-slate-50">
                <TableCell className="py-1.5">
                  <div className="text-sm font-medium">{pedido.num_pedido}</div>
                  <div className="text-xs text-slate-400">{formatFecha(pedido.fecha)}</div>
                </TableCell>
                <TableCell className="py-1.5">
                  <Link
                    href={`/clientes/${pedido.codigo_cliente}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {pedido.nombre_negocio || pedido.codigo_cliente}
                  </Link>
                  <div className="text-xs text-slate-400">{pedido.codigo_cliente}</div>
                </TableCell>
                <TableCell className="text-xs text-slate-500 py-1.5">
                  {pedido.nombre_asesor || "-"}
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                  {formatCurrencyFull(Number(pedido.pedido_total || 0))}
                </TableCell>
                <TableCell className="text-center py-1.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severidadBadge.classes}`}>
                    {severidadBadge.label}
                  </span>
                </TableCell>
                <TableCell className="text-center py-1.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${moraBadge.classes}`}>
                    {moraBadge.label}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums py-1.5 text-red-600">
                  {formatCurrencyFull(Number(pedido.total_vencido || 0))}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

// --- Tabla modo CUPO (agrupado por cliente) ---
function TablaCupo({ clientes }: { clientes: ClienteCupoExcedido[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs py-2">Cliente</TableHead>
          <TableHead className="text-xs py-2 text-center">Pedidos</TableHead>
          <TableHead className="text-xs py-2 text-right">Total pedidos</TableHead>
          <TableHead className="text-xs py-2 w-48">Uso del cupo</TableHead>
          <TableHead className="text-xs py-2 text-right">Deuda actual</TableHead>
          <TableHead className="text-xs py-2 text-right">Excede por</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clientes.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-slate-500">
              No hay clientes que excedan su cupo con pedidos pendientes (ultimos 7 dias)
            </TableCell>
          </TableRow>
        ) : (
          clientes.map((cliente) => {
            // % uso actual (deuda / cupo, ANTES de los pedidos)
            const usoActualPct = (cliente.total_deuda / cliente.cupo_asignado) * 100;

            // % total si se facturan todos los pedidos
            const totalPct = ((cliente.total_deuda + cliente.total_pedidos) / cliente.cupo_asignado) * 100;

            return (
              <TableRow key={cliente.codigo_cliente} className="hover:bg-slate-50">
                <TableCell className="py-1.5">
                  <Link
                    href={`/clientes/${cliente.codigo_cliente}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {cliente.nombre_negocio || cliente.codigo_cliente}
                  </Link>
                  <div className="text-xs text-slate-400">{cliente.codigo_cliente}</div>
                </TableCell>
                <TableCell className="text-center py-1.5">
                  <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-medium tabular-nums">
                    {cliente.cantidad_pedidos}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                  {formatCurrencyFull(cliente.total_pedidos)}
                </TableCell>
                {/* Uso del cupo: barra visual */}
                <TableCell className="py-1.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {formatCurrencyFull(cliente.cupo_asignado)}
                      </span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {usoActualPct.toFixed(0)}% usado
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getBarColor(usoActualPct)}`}
                        style={{ width: `${Math.min(usoActualPct, 100)}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums py-1.5">
                  {formatCurrencyFull(cliente.total_deuda)}
                </TableCell>
                {/* Excede por: valor positivo + badge % */}
                <TableCell className="text-right py-1.5">
                  <div className="text-sm font-medium tabular-nums text-red-600">
                    {formatCurrencyFull(cliente.excede_por)}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-medium tabular-nums mt-0.5">
                    {totalPct.toFixed(0)}%
                  </span>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
