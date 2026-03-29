"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote, FileText } from "lucide-react";
import { formatCurrencyFull, formatFechaRelativa, formatMesGrupo } from "@/lib/format";
import { CodigosCRMForm } from "@/components/pagos/codigos-crm-form";
import { SoportePreview } from "@/components/pagos/soporte-preview";
import type { PagoResumen } from "@/lib/queries/pagos-server";
import type { AppRole } from "@/lib/auth/types";
import Link from "next/link";

// --- Agrupar pagos por mes ---

interface GrupoPagos {
  label: string;
  pagos: PagoResumen[];
}

function agruparPorMes(pagos: PagoResumen[]): GrupoPagos[] {
  const mesesMap = new Map<string, PagoResumen[]>();

  for (const pago of pagos) {
    const key = formatMesGrupo(pago.fecha_consignacion + "T00:00:00");
    const grupo = mesesMap.get(key);
    if (grupo) {
      grupo.push(pago);
    } else {
      mesesMap.set(key, [pago]);
    }
  }

  return Array.from(mesesMap, ([label, pagos]) => ({ label, pagos }));
}

// --- Componente principal ---

interface PagosTimelineProps {
  pagos: PagoResumen[];
  codigoCliente: string;
  userRole: AppRole;
}

export function PagosTimeline({
  pagos,
  codigoCliente,
  userRole,
}: PagosTimelineProps) {
  const canEdit = userRole === "admin" || userRole === "super_admin";
  const grupos = agruparPorMes(pagos);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-base">Pagos</CardTitle>
            {pagos.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {pagos.length}
              </Badge>
            )}
          </div>
          {pagos.length > 10 && (
            <Link
              href={`/pagos?q=${codigoCliente}`}
              className="text-xs text-blue-600 hover:underline"
            >
              Ver todos
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {pagos.length === 0 ? (
          <p className="text-center py-8 text-sm text-slate-500">
            No hay pagos registrados para este cliente
          </p>
        ) : (
          <div className="space-y-6">
            {grupos.map((grupo) => (
              <div key={grupo.label}>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                  {grupo.label}
                </p>
                <div className="space-y-3 border-l-2 border-emerald-100 pl-4">
                  {grupo.pagos.map((pago) => (
                    <PagoItem
                      key={pago.id}
                      pago={pago}
                      canEdit={canEdit}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Pago individual ---

function PagoItem({
  pago,
  canEdit,
}: {
  pago: PagoResumen;
  canEdit: boolean;
}) {
  const esPendiente = pago.estado === "registrado";

  return (
    <div className="relative">
      <div className="absolute -left-[1.28rem] top-1 h-2 w-2 rounded-full bg-emerald-400" />

      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrencyFull(pago.monto_total)}
          </span>

          {pago.medio_pago && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {pago.medio_pago}
            </Badge>
          )}

          {esPendiente ? (
            <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0 hover:bg-amber-100">
              Pendiente CRM
            </Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0 hover:bg-emerald-100">
              Verificado
            </Badge>
          )}

          {pago.soporte_key && (
            <SoportePreview soporteKey={pago.soporte_key} />
          )}

          <span className="text-[10px] text-slate-400">
            {formatFechaRelativa(pago.fecha_consignacion + "T00:00:00")}
          </span>

          {pago.created_by_name && (
            <span className="text-[10px] text-slate-400">
              · {pago.created_by_name}
            </span>
          )}
        </div>

        {/* Facturas cubiertas */}
        {pago.facturas.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <FileText className="h-3 w-3 text-slate-400" />
            {pago.facturas.map((f) => (
              <span
                key={f.id}
                className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5"
              >
                {f.no_factura}
              </span>
            ))}
          </div>
        )}

        {/* Vouchers */}
        {pago.vouchers.length > 0 && (
          <p className="text-[10px] text-slate-400">
            Voucher: {pago.vouchers.join(", ")}
          </p>
        )}

        {/* Codigos CRM */}
        {!esPendiente && (
          <p className="text-[10px] text-slate-400">
            Recaudo: {pago.numero_recaudo} · Recibo: {pago.numero_recibo}
          </p>
        )}

        {/* Form inline para completar CRM */}
        {esPendiente && canEdit && (
          <CodigosCRMForm
            pagoId={pago.id}
            currentRecaudo={pago.numero_recaudo}
            currentRecibo={pago.numero_recibo}
          />
        )}
      </div>
    </div>
  );
}
