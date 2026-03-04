"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyShort } from "@/lib/format";
import type { EnvejecimientoRango } from "@/lib/queries/cartera-server";

// Mismos grupos que la torta de distribucion
const GRUPOS = [
  {
    label: "Tolerable",
    rangos: ["Al dia", "1-5 dias"],
    accent: "border-l-green-500",
    textColor: "text-green-600",
  },
  {
    label: "Atencion",
    rangos: ["6-10 dias", "11-15 dias", "16-20 dias"],
    accent: "border-l-yellow-500",
    textColor: "text-yellow-600",
  },
  {
    label: "Critico",
    rangos: ["21-30 dias", "31-60 dias", "61-90 dias", "90+ dias"],
    accent: "border-l-red-500",
    textColor: "text-red-600",
  },
];

interface KpiCardsProps {
  data: EnvejecimientoRango[];
}

export function KpiCards({ data }: KpiCardsProps) {
  const granTotal = data.reduce((sum, r) => sum + r.total, 0);

  const items = GRUPOS.map((grupo) => {
    const rangos = data.filter((d) => grupo.rangos.includes(d.label));
    const total = rangos.reduce((sum, r) => sum + r.total, 0);
    const facturas = rangos.reduce((sum, r) => sum + r.cantidad_facturas, 0);
    const pct = granTotal > 0 ? ((total / granTotal) * 100).toFixed(1) : "0";
    return { ...grupo, total, facturas, pct };
  });

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <Card key={item.label} className={`border-l-4 ${item.accent}`}>
          <CardContent className="py-3 px-4">
            <p className={`text-xs font-medium ${item.textColor}`}>{item.label}</p>
            <p className="text-xl font-semibold text-slate-900 tabular-nums">
              {formatCurrencyShort(item.total)}
            </p>
            <p className="text-xs text-slate-400">
              {item.facturas} facturas  ·  {item.pct}%
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
