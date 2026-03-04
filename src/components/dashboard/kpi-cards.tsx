"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyShort } from "@/lib/format";
import type { ResumenSeveridad } from "@/lib/queries/cartera-server";

const ESTILOS: Record<string, { label: string; accent: string; textColor: string }> = {
  tolerable: { label: "Tolerable", accent: "border-l-green-500", textColor: "text-green-600" },
  atencion: { label: "Atencion", accent: "border-l-yellow-500", textColor: "text-yellow-600" },
  critico: { label: "Critico", accent: "border-l-red-500", textColor: "text-red-600" },
};

interface KpiCardsProps {
  severidad: ResumenSeveridad[];
  totalClientes: number;
}

export function KpiCards({ severidad, totalClientes }: KpiCardsProps) {
  const granTotal = severidad.reduce((sum, s) => sum + s.total, 0);
  const totalFacturas = severidad.reduce((sum, s) => sum + s.cantidad_facturas, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="py-3 px-4">
          <p className="text-xs font-medium text-blue-600">Cartera Total</p>
          <p className="text-xl font-semibold text-slate-900 tabular-nums">
            {formatCurrencyShort(granTotal)}
          </p>
          <p className="text-xs text-slate-400">
            {totalFacturas} facturas  ·  {totalClientes} clientes
          </p>
        </CardContent>
      </Card>
      {severidad.map((s) => {
        const estilo = ESTILOS[s.severidad];
        if (!estilo) return null;
        return (
          <Card key={s.severidad} className={`border-l-4 ${estilo.accent}`}>
            <CardContent className="py-3 px-4">
              <p className={`text-xs font-medium ${estilo.textColor}`}>{estilo.label}</p>
              <p className="text-xl font-semibold text-slate-900 tabular-nums">
                {formatCurrencyShort(s.total)}
              </p>
              <p className="text-xs text-slate-400">
                {s.cantidad_facturas} facturas  ·  {s.cantidad_clientes} clientes
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
