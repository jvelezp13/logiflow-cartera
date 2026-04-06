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
import { SoportePreview } from "@/components/pagos/soporte-preview";
import { AiMetadataPopover } from "@/components/pagos/ai-metadata-popover";

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

  const montoIa = a.datos?.monto_ia != null ? Number(a.datos.monto_ia) : null;
  const montoUsuario = a.datos?.monto_usuario != null ? Number(a.datos.monto_usuario) : null;

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
        <TableCell className="text-sm py-1.5 max-w-xs">
          <div className="space-y-0.5">

            {montoIa != null && montoIa !== 0 && montoUsuario != null && (
              <div className="text-xs tabular-nums">
                <span className="text-slate-400">IA</span> {formatCurrencyFull(montoIa)}
                <span className="text-slate-300 mx-1">→</span>
                <span className="font-medium">{formatCurrencyFull(montoUsuario)}</span>
                <span className="text-amber-600 font-medium ml-1">
                  ({montoUsuario > montoIa ? "+" : ""}{((montoUsuario - montoIa) / montoIa * 100).toFixed(0)}%)
                </span>
              </div>
            )}


            <div className="flex items-center gap-2 flex-wrap text-xs">
              {a.codigo_cliente && (
                <Link
                  href={`/clientes/${a.codigo_cliente}`}
                  className="text-blue-600 hover:underline"
                >
                  {a.nombre_negocio || a.codigo_cliente}
                </Link>
              )}
              {a.facturas.length > 0 && (
                <span className="text-slate-400 truncate max-w-48">
                  {a.facturas.join(", ")}
                </span>
              )}
            </div>


            {a.ai_metadata?.observaciones && (
              <p className="text-xs text-amber-600 truncate max-w-xs" title={a.ai_metadata.observaciones}>
                {a.ai_metadata.observaciones}
              </p>
            )}
          </div>
        </TableCell>
        <TableCell className="py-1.5">
          <div className="flex items-center justify-center gap-2">
            {a.soporte_key && <SoportePreview soporteKey={a.soporte_key} />}
            {a.ai_metadata && <AiMetadataPopover data={a.ai_metadata} />}
          </div>
          {a.created_by_nombre && (
            <p className="text-xs text-slate-400 text-center mt-0.5 truncate">
              {a.created_by_nombre}
            </p>
          )}
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
          <TableCell colSpan={6} className="py-1 px-2">
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
          <TableHead className="text-xs py-2 w-24">Fecha</TableHead>
          <TableHead className="text-xs py-2 w-24">Tipo</TableHead>
          <TableHead className="text-xs py-2">Detalle</TableHead>
          <TableHead className="text-xs py-2 w-20 text-center">Soporte</TableHead>
          <TableHead className="text-xs py-2 w-20 text-center">Estado</TableHead>
          <TableHead className="text-xs py-2 w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {auditorias.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-slate-500">
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
