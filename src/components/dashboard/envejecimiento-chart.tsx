"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyShort } from "@/lib/format";
import { CHART_COLORS } from "@/lib/constants";
import type { EnvejecimientoRango } from "@/lib/queries/cartera-server";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface EnvejecimientoChartProps {
  data: EnvejecimientoRango[];
}

export function EnvejecimientoChart({ data }: EnvejecimientoChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Envejecimiento de Cartera</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <XAxis type="number" tickFormatter={(v) => formatCurrencyShort(v as number)} />
              <YAxis type="category" dataKey="label" width={80} />
              <Tooltip formatter={(v) => formatCurrencyShort(Number(v))} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {data.map((rango, index) => (
            <div key={rango.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[index] }}
                />
                <span>{rango.label}</span>
              </div>
              <span className="font-medium">{rango.porcentaje.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
