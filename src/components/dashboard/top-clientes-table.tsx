"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// Clasificacion por maxima_mora (mismos rangos que la torta)
function getSeveridad(maxMora: number): { label: string; color: string } {
  if (maxMora <= 5) return { label: "Tolerable", color: "text-green-600" };
  if (maxMora <= 20) return { label: "Atencion", color: "text-yellow-600" };
  return { label: "Critico", color: "text-red-600" };
}

interface TopClientesTableProps {
  clientes: ClienteEnriquecido[];
}

export function TopClientesTable({ clientes }: TopClientesTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top 10 - Mayor Deuda</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs py-2">Negocio</TableHead>
              <TableHead className="text-xs py-2">Ciudad</TableHead>
              <TableHead className="text-xs py-2 text-right">Deuda</TableHead>
              <TableHead className="text-xs py-2 text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((cliente) => {
              const severidad = getSeveridad(cliente.maxima_mora);
              return (
                <TableRow key={cliente.codigo_cliente}>
                  <TableCell className="py-1.5">
                    <span className="text-sm font-medium">
                      {cliente.nombre_negocio || cliente.razon_social || cliente.codigo_cliente}
                    </span>
                    <div className="text-xs text-slate-400">{cliente.codigo_cliente}</div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 py-1.5">
                    {cliente.ciudad || "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                    {formatCurrencyShort(Number(cliente.total_deuda))}
                  </TableCell>
                  <TableCell className={`text-right text-xs font-medium py-1.5 ${severidad.color}`}>
                    {severidad.label}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
