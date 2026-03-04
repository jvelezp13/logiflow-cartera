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
import type { ClienteEnriquecido } from "@/lib/queries/cartera-server";

interface TopClientesTableProps {
  clientes: ClienteEnriquecido[];
}

export function TopClientesTable({ clientes }: TopClientesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 - Clientes con Mayor Deuda</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead className="text-right">Deuda Total</TableHead>
              <TableHead className="text-right">Vencido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((cliente) => (
              <TableRow key={cliente.codigo_cliente}>
                <TableCell>
                  <div className="font-medium">{cliente.razon_social || cliente.codigo_cliente}</div>
                  <div className="text-xs text-slate-500">{cliente.codigo_cliente}</div>
                </TableCell>
                <TableCell className="text-sm">{cliente.ciudad || "-"}</TableCell>
                <TableCell className="text-sm">
                  <Badge variant="outline" className="text-xs">
                    {cliente.segmento?.split(" - ")[0] || "-"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrencyShort(Number(cliente.total_deuda))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(cliente.total_vencido) > 0 ? (
                    <span className="text-red-600 font-medium">
                      {formatCurrencyShort(Number(cliente.total_vencido))}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
