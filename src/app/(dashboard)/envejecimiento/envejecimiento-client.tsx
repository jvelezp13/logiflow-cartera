"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  PieChart,
  Pie,
} from "recharts";

interface EnvejecimientoClientProps {
  data: EnvejecimientoRango[];
}

export function EnvejecimientoClient({ data }: EnvejecimientoClientProps) {
  const total = data.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grafico de barras */}
        <Card>
          <CardHeader>
            <CardTitle>Distribucion por Antiguedad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => formatCurrencyShort(v)} />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [formatCurrencyShort(Number(value)), "Total"]}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {data.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Grafico circular */}
        <Card>
          <CardHeader>
            <CardTitle>Porcentaje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="total"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name}: ${(Number(percent) * 100).toFixed(1)}%`
                    }
                    labelLine={false}
                  >
                    {data.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatCurrencyShort(Number(value)), "Total"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalle */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.map((rango, index) => (
              <div key={rango.label} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="font-medium">{rango.label}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrencyShort(rango.total)}</div>
                    <div className="text-sm text-slate-500">{rango.porcentaje.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${rango.porcentaje}%`,
                      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}

            <Separator className="my-4" />

            <div className="flex justify-between items-center pt-2">
              <span className="font-semibold text-lg">Total Cartera</span>
              <span className="font-bold text-xl">{formatCurrencyShort(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50">
        <CardContent className="pt-6">
          <p className="text-sm text-slate-600">
            Los rangos de envejecimiento son configurables. Actualmente: 0-30, 31-60, 61-90, 90+
            dias.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
