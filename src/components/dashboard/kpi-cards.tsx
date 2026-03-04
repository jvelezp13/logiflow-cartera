"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyShort } from "@/lib/format";
import type { DashboardKPIs } from "@/lib/queries/cartera-server";

interface KpiCardsProps {
  kpis: DashboardKPIs;
  alertasCount: number;
}

export function KpiCards({ kpis, alertasCount }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-blue-100">Cartera Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatCurrencyShort(kpis.cartera_total)}</div>
          <p className="text-xs text-blue-200 mt-1">{kpis.clientes_con_deuda} clientes</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-red-100">Cartera Vencida</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatCurrencyShort(kpis.cartera_vencida)}</div>
          <p className="text-xs text-red-200 mt-1">{kpis.facturas_vencidas} facturas</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-emerald-100">Por Vencer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatCurrencyShort(kpis.cartera_por_vencer)}</div>
          <p className="text-xs text-emerald-200 mt-1">{kpis.facturas_por_vencer} facturas</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-amber-100">Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{alertasCount}</div>
          <p className="text-xs text-amber-200 mt-1">requieren atencion</p>
        </CardContent>
      </Card>
    </div>
  );
}
