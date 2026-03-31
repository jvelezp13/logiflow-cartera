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
import { Check, CheckCheck } from "lucide-react";
import { marcarAlertaLeida, marcarTodasLeidas } from "@/lib/alertas-action";
import { formatFechaCorta } from "@/lib/format";
import Link from "next/link";

interface NovedadSync {
  id: string;
  tipo: string;
  referencia: string | null;
  mensaje: string | null;
  datos: Record<string, unknown> | null;
  created_at: string;
  leida: boolean;
}

const TIPO_BADGE: Record<string, { label: string; classes: string }> = {
  cartera_factura_pagada: { label: "Pago", classes: "bg-green-100 text-green-700" },
  cupo_cambio: { label: "Cupo", classes: "bg-blue-100 text-blue-700" },
  credito_activado: { label: "Credito", classes: "bg-blue-100 text-blue-700" },
  plazo_cambio: { label: "Plazo", classes: "bg-amber-100 text-amber-700" },
  cartera_deuda_creciente: { label: "Deuda", classes: "bg-red-100 text-red-700" },
  cartera_cliente_nuevo: { label: "Nuevo", classes: "bg-slate-100 text-slate-700" },
};

function getTipoBadge(tipo: string) {
  return TIPO_BADGE[tipo] || { label: tipo, classes: "bg-slate-100 text-slate-600" };
}

export function TablaNovedades({ novedades }: { novedades: NovedadSync[] }) {
  const [isPending, startTransition] = useTransition();
  const sinLeer = novedades.filter((n) => !n.leida).length;

  function handleMarcarLeida(id: string) {
    startTransition(async () => { await marcarAlertaLeida(id); });
  }

  function handleMarcarTodas() {
    startTransition(async () => { await marcarTodasLeidas(); });
  }

  return (
    <div className="space-y-2">
      {sinLeer > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarcarTodas}
            disabled={isPending}
            className="text-xs text-slate-500 h-7"
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            Marcar todas como leidas ({sinLeer})
          </Button>
        </div>
      )}
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
                    {formatFechaCorta(n.created_at)}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.classes}`}
                    >
                      {badge.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm py-1.5">
                    <div>{n.mensaje || "-"}</div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {n.referencia && (
                        <Link
                          href={`/clientes/${n.referencia}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {n.referencia}
                        </Link>
                      )}
                      {esFacturaPagada && n.referencia && (
                        <Link
                          href={`/clientes/${n.referencia}?registrar_pago=retroactivo&factura=${n.datos?.no_factura || ""}&monto=${n.datos?.total || ""}`}
                          className="text-xs text-emerald-600 hover:underline font-medium"
                        >
                          Registrar pago
                        </Link>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5">
                    {!n.leida && (
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
