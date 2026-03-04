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
              <TableHead className="text-xs py-2 text-right">Vencido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ciudades.map((ciudad) => (
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
                <TableCell className="text-right text-sm tabular-nums py-1.5">
                  {ciudad.total_vencido > 0 ? (
                    <span className="text-red-600 font-medium">
                      {formatCurrencyShort(ciudad.total_vencido)}
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
