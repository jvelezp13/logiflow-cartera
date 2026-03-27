"use client";

import Link from "next/link";
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
import { getSeveridad, SEVERIDAD_CONFIG } from "@/lib/severity";
import type { ClienteEnriquecido } from "@/lib/queries/cartera-server";

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
              const sevConfig = SEVERIDAD_CONFIG[getSeveridad(cliente.maxima_mora)];
              return (
                <TableRow key={cliente.codigo_cliente}>
                  <TableCell className="py-1.5">
                    <Link
                      href={`/clientes/${cliente.codigo_cliente}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {cliente.nombre_negocio || cliente.razon_social || cliente.codigo_cliente}
                    </Link>
                    <div className="text-xs text-slate-400">{cliente.codigo_cliente}</div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 py-1.5">
                    {cliente.ciudad || "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                    {formatCurrencyShort(Number(cliente.total_deuda))}
                  </TableCell>
                  <TableCell className={`text-right text-xs font-medium py-1.5 ${sevConfig.text}`}>
                    {sevConfig.label}
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
