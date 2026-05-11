import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { formatFechaRelativa, formatCurrencyFull } from "@/lib/format";
import Link from "next/link";

import type { AuditoriaHistorica } from "@/lib/queries/auditoria-server";
import { AUDITORIA_TIPO_BADGE } from "@/lib/pagos-constants";

interface TablaHistoricoProps {
  auditorias: AuditoriaHistorica[];
}

export function TablaHistorico({ auditorias }: TablaHistoricoProps) {
  if (auditorias.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        No hay auditorías cerradas con los filtros aplicados.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs py-2">Creada</TableHead>
          <TableHead className="text-xs py-2">Tipo</TableHead>
          <TableHead className="text-xs py-2">Pago</TableHead>
          <TableHead className="text-xs py-2">Estado</TableHead>
          <TableHead className="text-xs py-2">Cerrada por</TableHead>
          <TableHead className="text-xs py-2">Motivo / Notas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {auditorias.map((a) => {
          const badge = AUDITORIA_TIPO_BADGE[a.tipo] ?? { label: a.tipo, classes: "bg-slate-100 text-slate-600" };
          const esRechazada = a.estado_cierre === "rechazada";
          const fechaCierre = esRechazada ? a.rechazada_at : a.aprobacion_2_at;
          return (
            <TableRow key={a.id} className="hover:bg-slate-100/60">
              <TableCell className="text-xs text-slate-500 tabular-nums py-1.5 whitespace-nowrap">
                {formatFechaRelativa(a.created_at)}
              </TableCell>
              <TableCell className="py-1.5">
                <Badge variant="outline" className={badge.classes}>
                  {badge.label}
                </Badge>
              </TableCell>
              <TableCell className="text-sm py-1.5 max-w-xs">
                {a.codigo_cliente && (
                  <Link
                    href={`/clientes/${a.codigo_cliente}`}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    {a.nombre_negocio || a.codigo_cliente}
                  </Link>
                )}
                <div className="text-xs text-slate-400 tabular-nums">
                  {formatCurrencyFull(a.monto_total)}
                </div>
              </TableCell>
              <TableCell className="py-1.5">
                {esRechazada ? (
                  <span className="inline-flex items-center gap-1 text-xs text-red-700 font-medium">
                    <XCircle className="h-3.5 w-3.5" />
                    Rechazada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Aprobada
                  </span>
                )}
                {fechaCierre && (
                  <div className="text-xs text-slate-400 tabular-nums">
                    {formatFechaRelativa(fechaCierre)}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs text-slate-600 py-1.5">
                {esRechazada ? (
                  <span>{a.rechazada_por_nombre || "—"}</span>
                ) : (
                  <div className="space-y-0.5">
                    {a.aprobacion_1_nombre && (
                      <div className="text-slate-500">1: {a.aprobacion_1_nombre}</div>
                    )}
                    {a.aprobacion_2_nombre && (
                      <div className="text-slate-500">2: {a.aprobacion_2_nombre}</div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs text-slate-600 py-1.5 max-w-sm">
                {esRechazada && a.motivo_cierre ? (
                  <span className="italic">&ldquo;{a.motivo_cierre}&rdquo;</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
