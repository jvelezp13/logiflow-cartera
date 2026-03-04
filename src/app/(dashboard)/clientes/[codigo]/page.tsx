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

function getMoraBadge(mora: number | null) {
  if (!mora || mora <= 0)
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700">
        Al dia
      </Badge>
    );
  if (mora <= 30)
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
        {mora} dias
      </Badge>
    );
  if (mora <= 60)
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-700">
        {mora} dias
      </Badge>
    );
  return <Badge variant="destructive">{mora} dias</Badge>;
}

export default async function DetalleClientePage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const profile = await getUserProfile();
  const incluirCastigada = await getIncluirCastigada();
  const { info, facturas, pedidos } = await getDetalleCliente(codigo);

  if (!info) {
    notFound();
  }

  const saldoTotal = facturas.reduce((sum, f) => sum + (f.total || 0), 0);

  return (
    <>
      <Header
        titulo={`Cliente: ${codigo}`}
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-6">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>

        {/* Info del cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Informacion del Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-slate-500">Razon Social</div>
                <div className="font-medium">{info.razon_social}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Documento</div>
                <div className="font-medium">{info.documento || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Ciudad</div>
                <div className="font-medium">{info.ciudad || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Segmento</div>
                <div className="font-medium">{info.segmento || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Estado</div>
                <div className="font-medium">{info.estado || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Canal</div>
                <div className="font-medium">{info.canal || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Telefono</div>
                <div className="font-medium">{info.telefono || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Correo</div>
                <div className="font-medium">{info.correo || "-"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen financiero */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Saldo Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrencyFull(saldoTotal)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500"># Facturas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{facturas.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500"># Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pedidos.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Facturas */}
        <Card>
          <CardHeader>
            <CardTitle>Facturas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Fecha Factura</TableHead>
                  <TableHead>Fecha Vencimiento</TableHead>
                  <TableHead>Dias Mora</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      No hay facturas
                    </TableCell>
                  </TableRow>
                ) : (
                  facturas.map((factura) => (
                    <TableRow key={factura.no_factura}>
                      <TableCell className="font-medium">{factura.no_factura}</TableCell>
                      <TableCell>
                        {factura.fecha_factura
                          ? format(new Date(factura.fecha_factura), "dd MMM yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {factura.fecha_vencimiento
                          ? format(new Date(factura.fecha_vencimiento), "dd MMM yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>{getMoraBadge(factura.mora)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrencyFull(factura.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pedidos */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos Recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      No hay pedidos
                    </TableCell>
                  </TableRow>
                ) : (
                  pedidos.map((pedido) => (
                    <TableRow key={pedido.num_pedido}>
                      <TableCell className="font-medium">{pedido.num_pedido}</TableCell>
                      <TableCell>
                        {format(new Date(pedido.fecha), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>{pedido.estado || "-"}</TableCell>
                      <TableCell>{pedido.ciudad || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrencyFull(pedido.total)}
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
