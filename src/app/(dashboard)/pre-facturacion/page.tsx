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
import { formatCurrencyFull, formatCurrencyShort } from "@/lib/format";
import {
  getClientesMoraConPedidos,
  getClientesCupoExcedido,
} from "@/lib/queries/cartera-server";
import type {
  ClientePreFacturacionMora,
  ClienteCupoExcedido,
} from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { getNotasIndicador } from "@/lib/queries/notas-server";
import { PreFacturacionFiltros } from "@/components/pre-facturacion/pre-facturacion-filtros";
import { CopiarResumen } from "@/components/pre-facturacion/copiar-resumen";
import { getMoraBadgeStyles, SEVERIDAD_CONFIG, getCupoBarColor } from "@/lib/severity";
import { ArrowDownWideNarrow } from "lucide-react";
import { MessageSquare } from "lucide-react";
import Link from "next/link";

export default async function PreFacturacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const modo = params.modo === "cupo" ? "cupo" : "mora";

  const [profile, incluirCastigada, clientesMora, clientesCupo] = await Promise.all([
    getUserProfile(),
    getIncluirCastigada(),
    modo === "mora" ? getClientesMoraConPedidos() : Promise.resolve([]),
    modo === "cupo" ? getClientesCupoExcedido() : Promise.resolve([]),
  ]);

  // Datos para KPI y notas
  const clientesActivos = modo === "mora" ? clientesMora : clientesCupo;
  const codigosClientes = clientesActivos.map((c) => c.codigo_cliente);
  const notasIndicador = await getNotasIndicador(codigosClientes);

  const totalClientes = clientesActivos.length;
  const totalPedidos = clientesActivos.reduce((acc, c) => acc + c.cantidad_pedidos, 0);
  const montoRiesgo = modo === "mora"
    ? clientesMora.reduce((acc, c) => acc + c.total_vencido, 0)
    : clientesCupo.reduce((acc, c) => acc + c.excede_por, 0);

  const resumenWhatsApp = generarResumenWhatsApp(modo, clientesActivos, totalClientes, totalPedidos, montoRiesgo);

  return (
    <>
      <Header
        titulo="Pre-facturacion"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
        <div className="flex items-center justify-between">
          <PreFacturacionFiltros total={totalClientes} etiquetaConteo="clientes" />
          {totalClientes > 0 && <CopiarResumen texto={resumenWhatsApp} />}
        </div>

        {totalClientes > 0 && (
          <div className="text-sm text-slate-600">
            <span className="font-medium">{totalClientes} clientes</span>
            {" · "}
            <span className="tabular-nums">{totalPedidos} pedidos</span>
            {" · "}
            <span className="font-medium tabular-nums">
              {modo === "mora" ? "Vencido: " : "Exceso: "}
              {formatCurrencyShort(montoRiesgo)}
            </span>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {modo === "mora" ? (
              <TablaMora clientes={clientesMora} notasIndicador={notasIndicador} />
            ) : (
              <TablaCupo clientes={clientesCupo} notasIndicador={notasIndicador} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// --- Indicador de notas ---
function NotasBadge({ indicador }: { indicador: { total: number; recientes: number } | undefined }) {
  if (!indicador || indicador.total === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-slate-400" title={`${indicador.total} notas (${indicador.recientes} recientes)`}>
      <MessageSquare className="h-3.5 w-3.5" />
      {indicador.recientes > 0 && (
        <span className="text-[10px] font-medium tabular-nums">{indicador.recientes}</span>
      )}
    </span>
  );
}

// --- Tabla modo MORA (agrupada por cliente) ---
function TablaMora({
  clientes,
  notasIndicador,
}: {
  clientes: ClientePreFacturacionMora[];
  notasIndicador: Map<string, { total: number; recientes: number }>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs py-2">Cliente</TableHead>
          <TableHead className="text-xs py-2 text-center">Pedidos</TableHead>
          <TableHead className="text-xs py-2 text-right">Total pedidos</TableHead>
          <TableHead className="text-xs py-2 text-center">Severidad</TableHead>
          <TableHead className="text-xs py-2 text-center">
            <span className="inline-flex items-center gap-1">
              Mora <ArrowDownWideNarrow className="h-3 w-3 text-slate-400" />
            </span>
          </TableHead>
          <TableHead className="text-xs py-2 text-right">Deuda vencida</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clientes.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-slate-500">
              No hay pedidos pendientes de clientes con mora &gt; 5 dias
            </TableCell>
          </TableRow>
        ) : (
          clientes.map((cliente) => {
            const sevCfg = SEVERIDAD_CONFIG[cliente.severidad];
            const moraBadge = getMoraBadgeStyles(cliente.maxima_mora);
            return (
              <TableRow key={cliente.codigo_cliente} className="hover:bg-slate-100/60">
                <TableCell className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/clientes/${cliente.codigo_cliente}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {cliente.nombre_negocio || cliente.codigo_cliente}
                    </Link>
                    <NotasBadge indicador={notasIndicador.get(cliente.codigo_cliente)} />
                  </div>
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
                <TableCell className="text-center py-1.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sevCfg.badge}`}>
                    {sevCfg.label}
                  </span>
                </TableCell>
                <TableCell className="text-center py-1.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${moraBadge.classes}`}>
                    {moraBadge.label}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums py-1.5 text-red-600">
                  {formatCurrencyFull(cliente.total_vencido)}
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
function TablaCupo({
  clientes,
  notasIndicador,
}: {
  clientes: ClienteCupoExcedido[];
  notasIndicador: Map<string, { total: number; recientes: number }>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs py-2">Cliente</TableHead>
          <TableHead className="text-xs py-2 text-center">Pedidos</TableHead>
          <TableHead className="text-xs py-2 text-right">Total pedidos</TableHead>
          <TableHead className="text-xs py-2 w-48">Uso del cupo</TableHead>
          <TableHead className="text-xs py-2 text-right">Deuda actual</TableHead>
          <TableHead className="text-xs py-2 text-right">
            <span className="inline-flex items-center gap-1 justify-end">
              Excede por <ArrowDownWideNarrow className="h-3 w-3 text-slate-400" />
            </span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clientes.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-slate-500">
              No hay clientes que excedan su cupo con pedidos pendientes
            </TableCell>
          </TableRow>
        ) : (
          clientes.map((cliente) => {
            const usoActualPct = (cliente.total_deuda / cliente.cupo_asignado) * 100;
            const totalPct = ((cliente.total_deuda + cliente.total_pedidos) / cliente.cupo_asignado) * 100;

            return (
              <TableRow key={cliente.codigo_cliente} className="hover:bg-slate-100/60">
                <TableCell className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/clientes/${cliente.codigo_cliente}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {cliente.nombre_negocio || cliente.codigo_cliente}
                    </Link>
                    <NotasBadge indicador={notasIndicador.get(cliente.codigo_cliente)} />
                  </div>
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
                        className={`h-full rounded-full transition-all ${getCupoBarColor(usoActualPct)}`}
                        style={{ width: `${Math.min(usoActualPct, 100)}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums py-1.5">
                  {formatCurrencyFull(cliente.total_deuda)}
                </TableCell>
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

// --- Generador de texto para WhatsApp ---
function generarResumenWhatsApp(
  modo: "mora" | "cupo",
  clientes: (ClientePreFacturacionMora | ClienteCupoExcedido)[],
  totalClientes: number,
  totalPedidos: number,
  montoRiesgo: number,
): string {
  const hoy = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const titulo = modo === "mora" ? "Mora" : "Cupo";
  const lineas: string[] = [`*Pre-facturación — ${titulo} — ${hoy}*`, ""];

  for (const c of clientes) {
    const nombre = c.nombre_negocio || c.codigo_cliente;
    const pedidos = `${c.cantidad_pedidos} pedido${c.cantidad_pedidos > 1 ? "s" : ""}`;

    if (modo === "mora") {
      const cm = c as ClientePreFacturacionMora;
      lineas.push(`${cm.codigo_cliente} — ${nombre} — ${pedidos} — Mora ${cm.maxima_mora} dias — Vencido ${formatCurrencyShort(cm.total_vencido)}`);
    } else {
      const cc = c as ClienteCupoExcedido;
      const pct = ((cc.total_deuda + cc.total_pedidos) / cc.cupo_asignado * 100).toFixed(0);
      lineas.push(`${cc.codigo_cliente} — ${nombre} — ${pedidos} — Excede ${formatCurrencyShort(cc.excede_por)} (${pct}%)`);
    }
  }

  const etiquetaMonto = modo === "mora" ? "Vencido" : "Exceso";
  lineas.push("", `${totalClientes} clientes | ${totalPedidos} pedidos | ${etiquetaMonto}: ${formatCurrencyShort(montoRiesgo)}`);

  return lineas.join("\n");
}
