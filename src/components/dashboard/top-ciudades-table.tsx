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
import type { CiudadResumen } from "@/lib/queries/cartera-server";

function getPctColor(pct: number): string {
  if (pct <= 20) return "text-green-600";
  if (pct <= 50) return "text-yellow-600";
  return "text-red-600";
}

interface TopCiudadesTableProps {
  ciudades: CiudadResumen[];
}

export function TopCiudadesTable({ ciudades }: TopCiudadesTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Deuda por Ciudad</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs py-2">Ciudad</TableHead>
              <TableHead className="text-xs py-2 text-right">Clientes</TableHead>
              <TableHead className="text-xs py-2 text-right">Deuda</TableHead>
              <TableHead className="text-xs py-2 text-right">% Vencido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ciudades.map((ciudad) => {
              const pctVencido = ciudad.total_deuda > 0
                ? (ciudad.total_vencido / ciudad.total_deuda) * 100
                : 0;
              return (
                <TableRow key={ciudad.ciudad}>
                  <TableCell className="text-sm font-medium py-1.5">
                    {ciudad.ciudad}
                  </TableCell>
                  <TableCell className="text-right text-xs text-slate-500 py-1.5">
                    {ciudad.num_clientes}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                    {formatCurrencyShort(ciudad.total_deuda)}
                  </TableCell>
                  <TableCell className="text-right py-1.5">
                    {pctVencido > 0 ? (
                      <span className={`text-sm font-medium tabular-nums ${getPctColor(pctVencido)}`}>
                        {pctVencido.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-green-600 text-sm font-medium">Al dia</span>
                    )}
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
