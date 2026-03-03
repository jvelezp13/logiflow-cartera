"use client";

import { useEffect, useState } from "react";
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
import { getAlertas } from "@/lib/queries/cartera";
import type { AlertaCartera } from "@/types/cartera";
import { format } from "date-fns";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<AlertaCartera[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAlertas() {
      try {
        // Configurable: últimos 3 días, mora entre 1-30 días
        const data = await getAlertas(undefined, 3, 1, 30);
        setAlertas(data);
      } catch (error) {
        console.error("Error loading alertas:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAlertas();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getMoraColor = (mora: number) => {
    if (mora <= 7) return "bg-green-100 text-green-800";
    if (mora <= 15) return "bg-yellow-100 text-yellow-800";
    if (mora <= 30) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header titulo="Alertas" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header titulo="Alertas" alertasCount={alertas.length} />

      <div className="p-6 space-y-6">
        {/* Info */}
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Clientes con pedidos recientes y facturas vencidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700">
              Mostrando clientes que hicieron pedidos en los últimos 3 días y
              tienen facturas con 1-30 días de mora.
            </p>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle>{alertas.length} alertas encontradas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Fecha Pedido</TableHead>
                  <TableHead>Valor Pedido</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead>Mora</TableHead>
                  <TableHead className="text-right">Valor Factura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-slate-500"
                    >
                      No hay alertas
                    </TableCell>
                  </TableRow>
                ) : (
                  alertas.map((alerta, index) => (
                    <TableRow
                      key={`${alerta.codigo_cliente}-${alerta.no_factura}-${index}`}
                    >
                      <TableCell>
                        <Link
                          href={`/clientes/${alerta.codigo_cliente}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {alerta.codigo_cliente}
                        </Link>
                        <div className="text-sm text-slate-500">
                          {alerta.razon_social || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {alerta.num_pedido}
                      </TableCell>
                      <TableCell>
                        {format(new Date(alerta.fecha_pedido), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(alerta.valor_pedido)}
                      </TableCell>
                      <TableCell>{alerta.no_factura}</TableCell>
                      <TableCell>
                        <Badge className={getMoraColor(alerta.mora)}>
                          {alerta.mora} días
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(alerta.valor_factura)}
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
