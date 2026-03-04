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
import { getDetalleCliente } from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { formatCurrencyFull } from "@/lib/format";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

// Severidad del cliente basada en maxima mora (misma logica que dashboard y pagina clientes)
function getSeveridad(maxMora: number): {
  label: string;
  color: string;
  border: string;
  bg: string;
} {
  if (maxMora <= 5)
    return {
      label: "Tolerable",
      color: "text-green-600",
      border: "border-l-green-500",
      bg: "bg-green-50",
    };
  if (maxMora <= 20)
    return {
      label: "Atencion",
      color: "text-yellow-600",
      border: "border-l-yellow-500",
      bg: "bg-yellow-50",
    };
  return {
    label: "Critico",
    color: "text-red-600",
    border: "border-l-red-500",
    bg: "bg-red-50",
  };
}

// Badge de mora por factura (misma escala de severidad del sistema)
function getMoraBadge(mora: number | null, rangoMora?: string | null) {
  const label = rangoMora || (mora && mora > 0 ? `${mora}d` : "Al dia");

  if (!mora || mora <= 0)
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
        Al dia
      </Badge>
    );
  if (mora <= 5)
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
        {mora}d
      </Badge>
    );
  if (mora <= 20)
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-xs">
        {mora}d
      </Badge>
    );
  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
      {mora}d
    </Badge>
  );
}

export default async function DetalleClientePage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const profile = await getUserProfile();
  const incluirCastigada = await getIncluirCastigada();
  const { info, facturas: todasFacturas, pedidos } =
    await getDetalleCliente(codigo);

  if (!info) {
    notFound();
  }

  // Filtrar facturas castigadas (mora > 90) si el toggle esta desactivado
  const facturas = incluirCastigada
    ? todasFacturas
    : todasFacturas.filter((f) => (f.mora || 0) <= 90);

  const nombreDisplay = info.nombre_negocio || info.razon_social || codigo;
  const severidad = getSeveridad(info.maxima_mora);

  // Calculo de cupo utilizado
  const cupo = info.cupo_asignado || 0;
  const porcentajeCupo = cupo > 0 ? (info.total_deuda / cupo) * 100 : null;

  return (
    <>
      <Header
        titulo={nombreDisplay}
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="bg-slate-50 min-h-screen p-6 space-y-6">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>

        {/* Seccion superior: Identidad + Financiero */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Columna izquierda: Identidad */}
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

          {/* Columna derecha: Resumen financiero */}
          <Card className={`border-l-4 ${severidad.border}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Resumen Financiero</CardTitle>
                <Badge
                  variant="outline"
                  className={`${severidad.bg} ${severidad.color} text-xs`}
                >
                  {severidad.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Deuda total */}
              <div>
                <p className="text-xs text-slate-400">Deuda Total</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {formatCurrencyFull(info.total_deuda)}
                </p>
              </div>

              {/* Vencido / Por vencer */}
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

              {/* Cupo asignado */}
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
                      className={`h-full rounded-full transition-all ${
                        porcentajeCupo! > 100
                          ? "bg-red-500"
                          : porcentajeCupo! > 80
                            ? "bg-yellow-500"
                            : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(porcentajeCupo!, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Facturas y mora */}
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

        {/* Tabla de facturas */}
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
                  facturas.map((factura) => (
                    <TableRow key={factura.no_factura}>
                      <TableCell className="py-1.5 text-sm font-medium">
                        {factura.no_factura}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-slate-500">
                        {factura.vendedor || "-"}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {factura.fecha_factura
                          ? format(new Date(factura.fecha_factura), "dd MMM yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {factura.fecha_vencimiento
                          ? format(
                              new Date(factura.fecha_vencimiento),
                              "dd MMM yyyy"
                            )
                          : "-"}
                      </TableCell>
                      <TableCell className="py-1.5">
                        {getMoraBadge(factura.mora, factura.rango_mora)}
                      </TableCell>
                      <TableCell className="py-1.5 text-sm font-medium tabular-nums text-right">
                        {formatCurrencyFull(factura.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Tabla de pedidos */}
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
                        {format(new Date(pedido.fecha), "dd MMM yyyy")}
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
      </div>
    </>
  );
}
