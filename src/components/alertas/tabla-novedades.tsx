"use client";

import { useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { marcarAlertaLeida } from "@/lib/alertas-action";
import { formatFechaRelativa, formatCurrencyFull } from "@/lib/format";
import Link from "next/link";

import type { NovedadSync } from "@/lib/queries/alertas-server";
import { DialogNotaCredito } from "@/components/alertas/dialog-nota-credito";

const TIPO_BADGE: Record<string, { label: string; classes: string }> = {
  cartera_factura_pagada: { label: "Pago", classes: "bg-green-100 text-green-700 border-green-200" },
  cupo_cambio: { label: "Cupo", classes: "bg-blue-100 text-blue-700 border-blue-200" },
  credito_activado: { label: "Credito", classes: "bg-blue-100 text-blue-700 border-blue-200" },
  plazo_cambio: { label: "Plazo", classes: "bg-amber-100 text-amber-700 border-amber-200" },
  cartera_deuda_creciente: { label: "Deuda", classes: "bg-red-100 text-red-700 border-red-200" },
  cartera_cliente_nuevo: { label: "Nuevo", classes: "bg-slate-100 text-slate-700 border-slate-200" },
};

function getTipoBadge(tipo: string) {
  return TIPO_BADGE[tipo] || { label: tipo, classes: "bg-slate-100 text-slate-600" };
}

export function TablaNovedades({ novedades }: { novedades: NovedadSync[] }) {
  const [isPending, startTransition] = useTransition();

  function handleMarcarLeida(id: string) {
    startTransition(async () => { await marcarAlertaLeida(id); });
  }

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs py-2 w-32">Fecha</TableHead>
            <TableHead className="text-xs py-2 w-28">Tipo</TableHead>
            <TableHead className="text-xs py-2">Mensaje</TableHead>
            <TableHead className="text-xs py-2 w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {novedades.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                No hay novedades en los ultimos 30 dias
              </TableCell>
            </TableRow>
          ) : (
            novedades.map((n) => {
              const badge = getTipoBadge(n.tipo);
              const esFacturaPagada = n.tipo === "cartera_factura_pagada";
              return (
                <TableRow
                  key={n.id}
                  className={`hover:bg-slate-100/60 ${n.leida ? "opacity-50" : ""}`}
                >
                  <TableCell className="text-xs text-slate-500 tabular-nums py-1.5">
                    {formatFechaRelativa(n.created_at)}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Badge variant="outline" className={badge.classes}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm py-1.5">
                    {esFacturaPagada ? (
                      <>
                        <div>
                          Factura <span className="font-medium">{String(n.datos?.no_factura || "?")}</span>
                          {" — pagada en ERP sin registro en Cartera"}
                          {n.datos?.total != null && (
                            <span className="text-slate-500"> — {formatCurrencyFull(Number(n.datos.total))}</span>
                          )}
                        </div>
                        {n.referencia && (
                          <div className="flex items-center gap-3 mt-0.5">
                            <Link
                              href={`/clientes/${n.referencia}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {n.referencia}
                              {n.nombre_negocio && (
                                <span className="text-slate-400 ml-1">— {n.nombre_negocio}</span>
                              )}
                            </Link>
                            <Link
                              href={`/clientes/${n.referencia}?registrar_pago=retroactivo&factura=${n.datos?.no_factura || ""}&monto=${n.datos?.total || ""}`}
                              className="text-xs text-amber-600 hover:underline font-medium"
                            >
                              Registrar pago
                            </Link>
                            {n.datos?.no_factura != null && (
                              <DialogNotaCredito
                                codigoCliente={n.referencia}
                                noFactura={String(n.datos.no_factura)}
                                monto={Number(n.datos.total || 0)}
                              />
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div>{n.mensaje || "-"}</div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {n.referencia && (
                            <Link
                              href={`/clientes/${n.referencia}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {n.referencia}
                              {n.nombre_negocio && (
                                <span className="text-slate-400 ml-1">— {n.nombre_negocio}</span>
                              )}
                            </Link>
                          )}
                        </div>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {!n.leida && !esFacturaPagada && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-emerald-600"
                        onClick={() => handleMarcarLeida(n.id)}
                        disabled={isPending}
                        title="Marcar como leida"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
