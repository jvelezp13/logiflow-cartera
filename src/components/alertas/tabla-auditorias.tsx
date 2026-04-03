"use client";

import { useState, useTransition } from "react";
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
import { ShieldCheck } from "lucide-react";
import { aprobarAuditoria } from "@/lib/auditoria-action";
import { formatFechaRelativa, formatCurrencyFull } from "@/lib/format";
import Link from "next/link";

import type { AuditoriaPendiente } from "@/lib/queries/auditoria-server";
import { AUDITORIA_TIPO, type AuditoriaTipo } from "@/lib/pagos-constants";

const TIPO_BADGE: Record<AuditoriaTipo, { label: string; classes: string }> = {
  [AUDITORIA_TIPO.VOUCHER_COMPARTIDO]: {
    label: "Voucher",
    classes: "bg-red-100 text-red-700 border-red-200",
  },
  [AUDITORIA_TIPO.MONTO_DIFF_SYNC]: {
    label: "Monto Sync",
    classes: "bg-red-100 text-red-700 border-red-200",
  },
  [AUDITORIA_TIPO.MONTO_EDITADO]: {
    label: "Monto Edit",
    classes: "bg-red-100 text-red-700 border-red-200",
  },
  [AUDITORIA_TIPO.MONTO_DIFF_IA]: {
    label: "Monto IA",
    classes: "bg-amber-100 text-amber-700 border-amber-200",
  },
  [AUDITORIA_TIPO.PAGO_SIN_SOPORTE]: {
    label: "Sin soporte",
    classes: "bg-amber-100 text-amber-700 border-amber-200",
  },
};

function getTipoBadge(tipo: AuditoriaTipo) {
  return TIPO_BADGE[tipo] ?? { label: tipo, classes: "bg-slate-100 text-slate-600" };
}

interface AuditoriaRowProps {
  a: AuditoriaPendiente;
  userId: string;
  userRole: string;
}

function AuditoriaRow({ a, userId, userRole }: AuditoriaRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const badge = getTipoBadge(a.tipo);

  const canApprove =
    (userRole === "admin" || userRole === "super_admin") &&
    a.created_by !== userId &&
    a.aprobacion_1 !== userId &&
    a.aprobacion_2 === null;

  const tieneAprobacion1 = a.aprobacion_1 !== null;

  function handleAprobar() {
    setError(null);
    startTransition(async () => {
      const result = await aprobarAuditoria(a.id);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <TableRow className="hover:bg-slate-100/60">
        <TableCell className="text-xs text-slate-500 tabular-nums py-1.5">
          {formatFechaRelativa(a.created_at)}
        </TableCell>
        <TableCell className="py-1.5">
          <Badge variant="outline" className={badge.classes}>
            {badge.label}
          </Badge>
        </TableCell>
        <TableCell className="text-sm py-1.5">
          <div>{a.descripcion}</div>
          <div className="flex items-center gap-3 mt-0.5">
            {a.codigo_cliente && (
              <Link
                href={`/clientes/${a.codigo_cliente}`}
                className="text-xs text-blue-600 hover:underline"
              >
                {a.codigo_cliente}
                {a.nombre_negocio && (
                  <span className="text-slate-400 ml-1">
                    — {a.nombre_negocio}
                  </span>
                )}
              </Link>
            )}
            {a.datos?.monto_pago != null && (
              <span className="text-xs text-slate-500">
                {formatCurrencyFull(Number(a.datos.monto_pago))}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-center py-1.5">
          {!tieneAprobacion1 ? (
            <span className="text-xs text-slate-400">Pendiente</span>
          ) : (
            <span className="text-xs text-amber-500">
              1 de 2
              {a.aprobacion_1_nombre && (
                <span className="block text-slate-400 text-xs">
                  {a.aprobacion_1_nombre}
                </span>
              )}
            </span>
          )}
        </TableCell>
        <TableCell className="py-1.5 text-right">
          {canApprove && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              onClick={handleAprobar}
              disabled={isPending}
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              Aprobar
            </Button>
          )}
        </TableCell>
      </TableRow>
      {error && (
        <TableRow>
          <TableCell colSpan={5} className="py-1 px-2">
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              {error}
            </p>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

interface TablaAuditoriasProps {
  auditorias: AuditoriaPendiente[];
  userId: string;
  userRole: string;
}

export function TablaAuditorias({
  auditorias,
  userId,
  userRole,
}: TablaAuditoriasProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs py-2 w-28">Fecha</TableHead>
          <TableHead className="text-xs py-2 w-28">Tipo</TableHead>
          <TableHead className="text-xs py-2">Descripcion</TableHead>
          <TableHead className="text-xs py-2 w-36 text-center">Estado</TableHead>
          <TableHead className="text-xs py-2 w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {auditorias.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-slate-500">
              No hay auditorias pendientes
            </TableCell>
          </TableRow>
        ) : (
          auditorias.map((a) => (
            <AuditoriaRow key={a.id} a={a} userId={userId} userRole={userRole} />
          ))
        )}
      </TableBody>
    </Table>
  );
}
