import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDetalleCliente, getVentasResumenClientes } from "@/lib/queries/cartera-server";
import { getNotasCliente } from "@/lib/queries/notas-server";
import { getPagosCliente, getFacturasAbiertas } from "@/lib/queries/pagos-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { formatCurrencyFull, formatCurrencyShort, formatFechaLarga, formatMesCorto } from "@/lib/format";
import { notFound } from "next/navigation";
import { getSeveridad, getMoraBadgeStyles, SEVERIDAD_CONFIG, getCupoBarColor } from "@/lib/severity";
import { BotonVolver } from "@/components/boton-volver";
import { NotasTimeline } from "@/components/notas/notas-timeline";
import { PagosTimeline } from "@/components/pagos/pagos-timeline";
import { RegistrarPagoSheet } from "@/components/pagos/registrar-pago-sheet";

export default async function DetalleClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { codigo } = await params;
  const sp = await searchParams;
  const esRetroactivo = sp.registrar_pago === "retroactivo";
  const retroactivoData = esRetroactivo
    ? { factura: String(sp.factura || ""), monto: String(sp.monto || "") }
    : undefined;
  const profile = await getUserProfile();
  const incluirCastigada = await getIncluirCastigada();
  const [{ info, facturas: todasFacturas, pedidos }, notas, pagos, facturasAbiertas, ventasMap] =
    await Promise.all([
      getDetalleCliente(codigo),
      getNotasCliente(codigo),
      getPagosCliente(codigo),
      getFacturasAbiertas(codigo),
      getVentasResumenClientes(codigo),
    ]);

  if (!info) {
    notFound();
  }

  const facturas = (incluirCastigada
    ? todasFacturas
    : todasFacturas.filter((f) => (f.mora || 0) <= 90)
  )
    .slice()
    .sort((a, b) => {
      const fa = a.fecha_vencimiento ? new Date(a.fecha_vencimiento).getTime() : Infinity;
      const fb = b.fecha_vencimiento ? new Date(b.fecha_vencimiento).getTime() : Infinity;
      return fa - fb;
    });

  const nombreDisplay = info.nombre_negocio || info.razon_social || codigo;
  const severidad = SEVERIDAD_CONFIG[getSeveridad(info.maxima_mora)];

  const cupo = info.cupo_asignado || 0;
  const porcentajeCupo = cupo > 0 ? (info.total_deuda / cupo) * 100 : null;
  const ventas = ventasMap.get(codigo);

  return (
    <>
      <Header
        titulo={nombreDisplay}
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="bg-slate-50 min-h-screen p-6 space-y-6">
        <BotonVolver fallbackHref="/clientes" label="Volver a clientes" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Informacion del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {info.nombre_negocio || info.razon_social}
                </p>
                {info.nombre_negocio &&
                  info.razon_social &&
                  info.nombre_negocio !== info.razon_social && (
                    <p className="text-sm text-slate-500">{info.razon_social}</p>
                  )}
                <p className="text-xs text-slate-400 mt-0.5">{info.codigo_cliente}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <p className="text-xs text-slate-400">Documento</p>
                  <p className="text-sm font-medium">{info.documento || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Ciudad</p>
                  <p className="text-sm font-medium">{info.ciudad || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Canal</p>
                  <p className="text-sm font-medium">{info.canal || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Tipologia</p>
                  <p className="text-sm font-medium">{info.tipologia || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Telefono</p>
                  <p className="text-sm font-medium">{info.telefono || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Correo</p>
                  <p className="text-sm font-medium">{info.correo || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Estado cliente</p>
                  <p className="text-sm font-medium">{info.estado || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Estado credito</p>
                  <p className="text-sm font-medium">
                    {info.estado_credito || "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${severidad.border}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Resumen Financiero</CardTitle>
                <Badge
                  variant="outline"
                  className={`${severidad.bg} ${severidad.text} text-xs`}
                >
                  {severidad.label} ({severidad.rango})
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-slate-400">Deuda Total</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {formatCurrencyFull(info.total_deuda)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Vencido</p>
                  <p className="text-sm font-semibold text-red-600 tabular-nums">
                    {formatCurrencyFull(info.total_vencido)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Por vencer</p>
                  <p className="text-sm font-semibold text-slate-700 tabular-nums">
                    {formatCurrencyFull(info.total_por_vencer)}
                  </p>
                </div>
              </div>

              {cupo > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-slate-400">Cupo asignado</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {formatCurrencyFull(cupo)} ({porcentajeCupo!.toFixed(0)}%
                      usado)
                    </p>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getCupoBarColor(porcentajeCupo!)}`}
                      style={{ width: `${Math.min(porcentajeCupo!, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {ventas && ventas.ventaPorMes.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Ventas recientes</p>
                  <div className="flex items-baseline gap-4">
                    {ventas.ventaPorMes.map((m) => (
                      <div key={m.mes}>
                        <p className="text-xs text-slate-400 capitalize">{formatMesCorto(m.mes)}</p>
                        <p className="text-sm font-medium tabular-nums">
                          {formatCurrencyShort(m.venta)}
                        </p>
                      </div>
                    ))}
                    <div className="border-l pl-4">
                      <p className="text-xs text-slate-400">Promedio</p>
                      <p className="text-sm font-semibold tabular-nums text-slate-700">
                        {formatCurrencyShort(ventas.ventaPromedio)}/mes
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t">
                <span>
                  <span className="font-medium text-slate-700">
                    {facturas.length}
                  </span>{" "}
                  facturas
                </span>
                <span>
                  Max. mora:{" "}
                  <span className="font-medium text-slate-700">
                    {info.maxima_mora}
                  </span>{" "}
                  dias
                </span>
                {info.pedidos_pendientes > 0 && (
                  <span>
                    <span className="font-medium text-slate-700">
                      {info.pedidos_pendientes}
                    </span>{" "}
                    pedidos pend.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Facturas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Factura</TableHead>
                  <TableHead className="text-xs">Vendedor</TableHead>
                  <TableHead className="text-xs">F. Factura</TableHead>
                  <TableHead className="text-xs">F. Vencimiento</TableHead>
                  <TableHead className="text-xs">Mora</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-slate-500"
                    >
                      No hay facturas
                    </TableCell>
                  </TableRow>
                ) : (
                  facturas.map((factura) => {
                    const moraBadge = getMoraBadgeStyles(factura.mora ?? 0);
                    return (
                    <TableRow key={factura.no_factura}>
                      <TableCell className="py-1.5 text-sm font-medium">
                        {factura.no_factura}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-slate-500">
                        {factura.vendedor || "-"}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {formatFechaLarga(factura.fecha_factura)}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {formatFechaLarga(factura.fecha_vencimiento)}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant="outline" className={`${moraBadge.classes} text-xs`}>
                          {factura.rango_mora || moraBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 text-sm font-medium tabular-nums text-right">
                        {formatCurrencyFull(factura.total)}
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
                {facturas.length > 0 && (
                  <TableRow className="bg-slate-50 font-semibold">
                    <TableCell colSpan={5} className="py-2 text-sm text-right text-slate-600">
                      Subtotal
                    </TableCell>
                    <TableCell className="py-2 text-sm tabular-nums text-right">
                      {formatCurrencyFull(facturas.reduce((sum, f) => sum + f.total, 0))}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pedidos Recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Pedido</TableHead>
                  <TableHead className="text-xs">Fecha</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs">Asesor</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-slate-500"
                    >
                      No hay pedidos
                    </TableCell>
                  </TableRow>
                ) : (
                  pedidos.map((pedido) => (
                    <TableRow key={pedido.num_pedido}>
                      <TableCell className="py-1.5 text-sm font-medium">
                        {pedido.num_pedido}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {formatFechaLarga(pedido.fecha)}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {pedido.estado || "-"}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-slate-500">
                        {pedido.nombre_asesor || "-"}
                      </TableCell>
                      <TableCell className="py-1.5 text-sm font-medium tabular-nums text-right">
                        {formatCurrencyFull(pedido.pedido_total || 0)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="space-y-2">
          {(profile.role === "admin" || profile.role === "super_admin") && (
            <div className="flex justify-end">
              <RegistrarPagoSheet
                codigoCliente={codigo}
                facturas={facturasAbiertas}
                defaultOpen={esRetroactivo}
                retroactivo={retroactivoData}
              />
            </div>
          )}
          <PagosTimeline
            pagos={pagos}
            codigoCliente={codigo}
            userRole={profile.role}
          />
        </div>

        <NotasTimeline
          notas={notas}
          codigoCliente={codigo}
          userRole={profile.role}
        />
      </div>
    </>
  );
}
