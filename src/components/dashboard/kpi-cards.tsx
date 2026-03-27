"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyShort } from "@/lib/format";
import { SEVERIDAD_CONFIG, type Severidad } from "@/lib/severity";
import type { ResumenSeveridad } from "@/lib/queries/cartera-server";

interface KpiCardsProps {
  resumen: ResumenSeveridad;
}

export function KpiCards({ resumen }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="py-3 px-4">
          <p className="text-xs font-medium text-blue-600">Cartera Total</p>
          <p className="text-xl font-semibold text-slate-900 tabular-nums">
            {formatCurrencyShort(resumen.gran_total)}
          </p>
          <p className="text-xs text-slate-400">
            {resumen.total_facturas} facturas  ·  {resumen.total_clientes} clientes
          </p>
        </CardContent>
      </Card>
      {resumen.grupos.map((g) => {
        const config = SEVERIDAD_CONFIG[g.severidad as Severidad];
        if (!config) return null;
        return (
          <Card key={g.severidad} className={`border-l-4 ${config.border}`}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-1.5">
                <p className={`text-xs font-medium ${config.text}`}>{config.label}</p>
                <span className="text-[10px] text-slate-400">
                  ({config.rango})
                </span>
              </div>
              <p className="text-xl font-semibold text-slate-900 tabular-nums">
                {formatCurrencyShort(g.total)}
              </p>
              <p className="text-xs text-slate-400">
                {g.cantidad_facturas} facturas  ·  {g.cantidad_clientes} clientes
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
