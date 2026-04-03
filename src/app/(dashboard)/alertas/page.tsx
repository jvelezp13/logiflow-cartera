import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getClientesCupo,
  getClientesInactivos,
  getNovedadesSync,
} from "@/lib/queries/alertas-server";
import type {
  ClienteCupoAlerta,
  ClienteCupoOcioso,
  ClienteInactivo,
} from "@/lib/queries/alertas-server";
import { getVentasResumenClientes } from "@/lib/queries/cartera-server";
import type { VentaResumenCliente } from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { formatCurrencyFull, formatCurrencyShort } from "@/lib/format";
import { AlertasFiltros } from "@/components/alertas/alertas-filtros";
import { TablaNovedades } from "@/components/alertas/tabla-novedades";
import Link from "next/link";

// Modos validos
const MODOS_VALIDOS = ["cupo_excedido", "cupo_ocioso", "inactivos", "novedades"] as const;
type Modo = (typeof MODOS_VALIDOS)[number];

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const modo: Modo = MODOS_VALIDOS.includes(params.modo as Modo)
    ? (params.modo as Modo)
    : "cupo_excedido";

  const necesitaVentas = modo === "cupo_excedido" || modo === "cupo_ocioso";

  // Queries en paralelo — cupo excedido y ocioso comparten UNA sola query
  const [profile, incluirCastigada, cupo, inactivos, novedades, ventasMap] =
    await Promise.all([
      getUserProfile(),
      getIncluirCastigada(),
      getClientesCupo(),
      getClientesInactivos(),
      getNovedadesSync(),
      necesitaVentas ? getVentasResumenClientes() : Promise.resolve(new Map<string, VentaResumenCliente>()),
    ]);

  const conteos = {
    cupo_excedido: cupo.excedido.length,
    cupo_ocioso: cupo.ocioso.length,
    inactivos: inactivos.length,
    novedades: novedades.length,
  };

  return (
    <>
      <Header
        titulo="Alertas"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-4 bg-slate-50 min-h-screen">
        <AlertasFiltros conteos={conteos} />

        <Card>
          <CardContent className="p-0">
            {modo === "cupo_excedido" && <TablaCupoExcedido clientes={cupo.excedido} ventasMap={ventasMap} />}
            {modo === "cupo_ocioso" && <TablaCupoOcioso clientes={cupo.ocioso} ventasMap={ventasMap} />}
            {modo === "inactivos" && <TablaInactivos clientes={inactivos} />}
            {modo === "novedades" && <TablaNovedades novedades={novedades} />}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// --- Helpers ---

// Color de barra segun porcentaje de uso de cupo
function getBarColorExcedido(pct: number): string {
  if (pct > 95) return "bg-red-500";
  if (pct > 90) return "bg-yellow-500";
  return "bg-orange-400";
}

// Color de barra para cupo ocioso (invertido: bajo uso = azul)
function getBarColorOcioso(pct: number): string {
  if (pct < 10) return "bg-blue-300";
  if (pct < 30) return "bg-blue-400";
  return "bg-blue-500";
}

// Badge de nivel para cupo excedido
function getNivelBadge(nivel: ClienteCupoAlerta["nivel"]) {
  const estilos = {
    critica: "bg-red-100 text-red-700",
    alta: "bg-orange-100 text-orange-700",
    media: "bg-yellow-100 text-yellow-700",
  };
  const labels = { critica: "Critica", alta: "Alta", media: "Media" };
  return { classes: estilos[nivel], label: labels[nivel] };
}

// Badge de dias sin pedido para inactivos (null = pedidos podados, sin registro reciente)
function getDiasBadge(dias: number | null) {
  if (dias === null) return { classes: "bg-red-100 text-red-700", label: ">30d" };
  if (dias > 60) return { classes: "bg-red-100 text-red-700", label: `${dias}d` };
  if (dias > 45) return { classes: "bg-yellow-100 text-yellow-700", label: `${dias}d` };
  return { classes: "bg-slate-100 text-slate-700", label: `${dias}d` };
}


// Formato fecha solo dia (dd/mm/aa)
function formatFechaDia(fecha: string | null): string {
  if (!fecha) return "-";
  const d = new Date(fecha + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// Mensaje vacio reutilizable
function MensajeVacio({ texto, colSpan }: { texto: string; colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-8 text-slate-500">
        {texto}
      </TableCell>
    </TableRow>
  );
}

// --- Tablas ---

function TablaCupoExcedido({ clientes, ventasMap }: { clientes: ClienteCupoAlerta[]; ventasMap: Map<string, VentaResumenCliente> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs py-2">Cliente</TableHead>
          <TableHead className="text-xs py-2">Ciudad</TableHead>
          <TableHead className="text-xs py-2 text-right">Cupo</TableHead>
          <TableHead className="text-xs py-2 text-right">Deuda</TableHead>
          <TableHead className="text-xs py-2 text-right">Vta. prom. 3m</TableHead>
          <TableHead className="text-xs py-2 w-44">Uso cupo</TableHead>
          <TableHead className="text-xs py-2 text-center">Nivel</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clientes.length === 0 ? (
          <MensajeVacio texto="No hay clientes con cupo excedido (>80%)" colSpan={7} />
        ) : (
          clientes.map((c) => {
            const badge = getNivelBadge(c.nivel);
            const ventas = ventasMap.get(c.codigo_cliente);
            return (
              <TableRow key={c.codigo_cliente} className="hover:bg-slate-100/60">
                <TableCell className="py-1.5">
                  <Link
                    href={`/clientes/${c.codigo_cliente}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {c.nombre_negocio || c.codigo_cliente}
                  </Link>
                  <div className="text-xs text-slate-400">{c.codigo_cliente}</div>
                </TableCell>
                <TableCell className="text-xs text-slate-500 py-1.5">
                  {c.ciudad || "-"}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums py-1.5">
                  {formatCurrencyFull(c.cupo_asignado)}
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                  {formatCurrencyFull(c.total_deuda)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums py-1.5 text-slate-600">
                  {ventas ? formatCurrencyShort(ventas.ventaPromedio) : "-"}
                </TableCell>
                <TableCell className="py-1.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {c.uso_porcentaje.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getBarColorExcedido(c.uso_porcentaje)}`}
                        style={{ width: `${Math.min(c.uso_porcentaje, 100)}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center py-1.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.classes}`}
                  >
                    {badge.label}
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

function TablaCupoOcioso({ clientes, ventasMap }: { clientes: ClienteCupoOcioso[]; ventasMap: Map<string, VentaResumenCliente> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs py-2">Cliente</TableHead>
          <TableHead className="text-xs py-2">Ciudad</TableHead>
          <TableHead className="text-xs py-2 text-right">Cupo</TableHead>
          <TableHead className="text-xs py-2 text-right">Deuda</TableHead>
          <TableHead className="text-xs py-2 text-right">Vta. prom. 3m</TableHead>
          <TableHead className="text-xs py-2 w-44">Uso cupo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clientes.length === 0 ? (
          <MensajeVacio texto="No hay clientes con cupo subutilizado (<50%)" colSpan={6} />
        ) : (
          clientes.map((c) => {
            const ventas = ventasMap.get(c.codigo_cliente);
            return (
              <TableRow key={c.codigo_cliente} className="hover:bg-slate-100/60">
                <TableCell className="py-1.5">
                  <Link
                    href={`/clientes/${c.codigo_cliente}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {c.nombre_negocio || c.codigo_cliente}
                  </Link>
                  <div className="text-xs text-slate-400">{c.codigo_cliente}</div>
                </TableCell>
                <TableCell className="text-xs text-slate-500 py-1.5">
                  {c.ciudad || "-"}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums py-1.5">
                  {formatCurrencyFull(c.cupo_asignado)}
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                  {formatCurrencyFull(c.total_deuda)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums py-1.5 text-slate-600">
                  {ventas ? formatCurrencyShort(ventas.ventaPromedio) : "-"}
                </TableCell>
                <TableCell className="py-1.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {c.uso_porcentaje.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getBarColorOcioso(c.uso_porcentaje)}`}
                        style={{ width: `${Math.max(c.uso_porcentaje, 2)}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

function TablaInactivos({ clientes }: { clientes: ClienteInactivo[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs py-2">Cliente</TableHead>
          <TableHead className="text-xs py-2">Ciudad</TableHead>
          <TableHead className="text-xs py-2 text-right">Deuda total</TableHead>
          <TableHead className="text-xs py-2 text-right">Vencido</TableHead>
          <TableHead className="text-xs py-2 text-center">Dias sin pedido</TableHead>
          <TableHead className="text-xs py-2 text-center">Ultimo pedido</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clientes.length === 0 ? (
          <MensajeVacio texto="No hay clientes inactivos con deuda vencida" colSpan={6} />
        ) : (
          clientes.map((c) => {
            const diasBadge = getDiasBadge(c.dias_sin_pedido);
            return (
              <TableRow key={c.codigo_cliente} className="hover:bg-slate-100/60">
                <TableCell className="py-1.5">
                  <Link
                    href={`/clientes/${c.codigo_cliente}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {c.nombre_negocio || c.codigo_cliente}
                  </Link>
                  <div className="text-xs text-slate-400">{c.codigo_cliente}</div>
                </TableCell>
                <TableCell className="text-xs text-slate-500 py-1.5">
                  {c.ciudad || "-"}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums py-1.5">
                  {formatCurrencyFull(c.total_deuda)}
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums py-1.5 text-red-600">
                  {formatCurrencyFull(c.total_vencido)}
                </TableCell>
                <TableCell className="text-center py-1.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${diasBadge.classes}`}
                  >
                    {diasBadge.label}
                  </span>
                </TableCell>
                <TableCell className="text-center text-xs text-slate-500 py-1.5">
                  {formatFechaDia(c.ultimo_pedido_fecha)}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

