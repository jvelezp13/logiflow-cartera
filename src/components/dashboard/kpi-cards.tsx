"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyShort } from "@/lib/format";
import type { DashboardKPIs } from "@/lib/queries/cartera-server";

interface KpiCardsProps {
  kpis: DashboardKPIs;
}

export function KpiCards({ kpis }: KpiCardsProps) {
  const pctVencida = kpis.cartera_total > 0
    ? ((kpis.cartera_vencida / kpis.cartera_total) * 100).toFixed(1)
    : "0";

  const items = [
    {
      label: "Cartera Total",
      value: formatCurrencyShort(kpis.cartera_total),
      detail: `${kpis.clientes_con_deuda} clientes`,
      accent: "border-l-blue-500",
    },
    {
      label: "Cartera Vencida",
      value: formatCurrencyShort(kpis.cartera_vencida),
      detail: `${kpis.facturas_vencidas} facturas`,
      accent: "border-l-red-500",
    },
    {
      label: "Por Vencer",
      value: formatCurrencyShort(kpis.cartera_por_vencer),
      detail: `${kpis.facturas_por_vencer} facturas`,
      accent: "border-l-emerald-500",
    },
    {
      label: "% Vencida",
      value: `${pctVencida}%`,
      detail: "del total de cartera",
      accent: "border-l-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card key={item.label} className={`border-l-4 ${item.accent}`}>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-slate-500 font-medium">{item.label}</p>
            <p className="text-xl font-semibold text-slate-900 tabular-nums">{item.value}</p>
            <p className="text-xs text-slate-400">{item.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
