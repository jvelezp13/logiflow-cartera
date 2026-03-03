"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { Separator } from "@/components/ui/separator";
import { getDetalleCliente } from "@/lib/queries/cartera";
import type { Cartera, Pedido, MaestraTotal } from "@/types/cartera";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DetalleClientePage() {
  const params = useParams();
  const codigo = params.codigo as string;

  const [info, setInfo] = useState<MaestraTotal | null>(null);
  const [facturas, setFacturas] = useState<Cartera[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getDetalleCliente(codigo);
        setInfo(data.info);
        setFacturas(data.facturas);
        setPedidos(data.pedidos);
      } catch (error) {
        console.error("Error loading cliente:", error);
      } finally {
        setLoading(false);
      }
    }

    if (codigo) {
      loadData();
    }
  }, [codigo]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getMoraBadge = (mora: number | null) => {
    if (!mora || mora <= 0)
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700">
          Al día
        </Badge>
      );
    if (mora <= 30)
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
          {mora} días
        </Badge>
      );
    if (mora <= 60)
      return (
        <Badge variant="outline" className="bg-orange-50 text-orange-700">
          {mora} días
        </Badge>
      );
    return <Badge variant="destructive">{mora} días</Badge>;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header titulo="Detalle Cliente" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const saldoTotal = facturas.reduce((sum, f) => sum + (f.total || 0), 0);

  return (
    <>
      <Header titulo={`Cliente: ${codigo}`} />

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
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {info ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-slate-500">Razón Social</div>
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
                  <div className="text-sm text-slate-500">Teléfono</div>
                  <div className="font-medium">{info.telefono || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Correo</div>
                  <div className="font-medium">{info.correo || "-"}</div>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No hay información del cliente</p>
            )}
          </CardContent>
        </Card>

        {/* Resumen financiero */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Saldo Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(saldoTotal)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                # Facturas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{facturas.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                # Pedidos
              </CardTitle>
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
                  <TableHead>Días Mora</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-slate-500"
                    >
                      No hay facturas
                    </TableCell>
                  </TableRow>
                ) : (
                  facturas.map((factura) => (
                    <TableRow key={factura.no_factura}>
                      <TableCell className="font-medium">
                        {factura.no_factura}
                      </TableCell>
                      <TableCell>
                        {factura.fecha_factura
                          ? format(
                              new Date(factura.fecha_factura),
                              "dd MMM yyyy",
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {factura.fecha_vencimiento
                          ? format(
                              new Date(factura.fecha_vencimiento),
                              "dd MMM yyyy",
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>{getMoraBadge(factura.mora)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(factura.total)}
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
                      <TableCell className="font-medium">
                        {pedido.num_pedido}
                      </TableCell>
                      <TableCell>
                        {format(new Date(pedido.fecha), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>{pedido.estado || "-"}</TableCell>
                      <TableCell>{pedido.ciudad || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(pedido.total)}
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
