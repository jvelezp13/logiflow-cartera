"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MessageSquare } from "lucide-react";
import Link from "next/link";
import { formatCurrencyFull } from "@/lib/format";
import type { ClienteCredito } from "@/lib/queries/cartera-server";

interface FiltrosCreditoProps {
  clientes: ClienteCredito[];
  modo: "cupo_sin_uso" | "credito_anulado";
  codigosConNotas: string[];
}

export function FiltrosCredito({ clientes, modo, codigosConNotas }: FiltrosCreditoProps) {
  const clientesConNotas = useMemo(() => new Set(codigosConNotas), [codigosConNotas]);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<string | null>(null);

  const estados = useMemo(() => {
    const set = new Set(clientes.map((c) => c.estado_cliente).filter(Boolean) as string[]);
    return [...set].sort();
  }, [clientes]);

  const filtrados = useMemo(() => {
    let resultado = clientes;

    if (busqueda) {
      const q = busqueda.toLowerCase();
      resultado = resultado.filter((c) =>
        (c.nombre_negocio?.toLowerCase().includes(q)) ||
        (c.razon_social?.toLowerCase().includes(q)) ||
        c.codigo_cliente.toLowerCase().includes(q)
      );
    }

    if (estadoFiltro) {
      resultado = resultado.filter((c) => c.estado_cliente === estadoFiltro);
    }

    return resultado;
  }, [clientes, busqueda, estadoFiltro]);

  const cupoLabel = modo === "cupo_sin_uso" ? "Cupo asignado" : "Cupo anterior";
  const emptyLabel = modo === "cupo_sin_uso"
    ? "No hay clientes con cupo sin utilizar"
    : "No hay clientes con credito anulado";

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar cliente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Estado:</span>
          {estados.map((estado) => (
            <button
              key={estado}
              onClick={() => setEstadoFiltro(estadoFiltro === estado ? null : estado)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                estadoFiltro === estado
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {estado}
            </button>
          ))}
          {estadoFiltro && (
            <button
              onClick={() => setEstadoFiltro(null)}
              className="text-xs text-slate-400 hover:text-slate-600 ml-1 cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>

        <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums ml-auto">
          {filtrados.length} clientes
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs py-2">Negocio</TableHead>
                <TableHead className="text-xs py-2">Ciudad</TableHead>
                <TableHead className="text-xs py-2">Estado</TableHead>
                <TableHead className="text-xs py-2 text-right">{cupoLabel}</TableHead>
                <TableHead className="text-xs py-2 text-right">Plazo (dias)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    {emptyLabel}
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((cliente) => (
                  <TableRow key={cliente.codigo_cliente} className="hover:bg-slate-50">
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/clientes/${cliente.codigo_cliente}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {cliente.nombre_negocio || cliente.razon_social || cliente.codigo_cliente}
                        </Link>
                        {clientesConNotas.has(cliente.codigo_cliente) && (
                          <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{cliente.codigo_cliente}</div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 py-1.5">
                      {cliente.ciudad || "-"}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <span className={`text-xs font-medium ${
                        cliente.estado_cliente === "Activo" ? "text-green-600" : "text-slate-500"
                      }`}>
                        {cliente.estado_cliente || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums py-1.5">
                      {formatCurrencyFull(cliente.cupo)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-slate-500 py-1.5">
                      {cliente.plazo || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
