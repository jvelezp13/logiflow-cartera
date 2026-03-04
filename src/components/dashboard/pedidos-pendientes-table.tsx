"use client";

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
import { formatCurrencyShort } from "@/lib/format";
import type { PedidoEnriquecido } from "@/lib/queries/cartera-server";

interface PedidosPendientesTableProps {
  pedidos: PedidoEnriquecido[];
}

export function PedidosPendientesTable({ pedidos }: PedidosPendientesTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pedidos Pendientes (7 dias)</CardTitle>
        <Badge variant="outline">{pedidos.length} pedidos</Badge>
      </CardHeader>
      <CardContent>
        {pedidos.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No hay pedidos pendientes</p>
        ) : (
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Deuda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.slice(0, 10).map((pedido) => (
                  <TableRow key={pedido.num_pedido}>
                    <TableCell className="font-mono text-xs">{pedido.num_pedido}</TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]">
                      {pedido.razon_social || pedido.codigo_cliente}
                    </TableCell>
                    <TableCell className="text-sm">{pedido.ciudad || "-"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCurrencyShort(Number(pedido.pedido_total || 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {(pedido.facturas_vencidas_cliente || 0) > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          {pedido.facturas_vencidas_cliente} facturas
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-xs">Sin deuda</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
