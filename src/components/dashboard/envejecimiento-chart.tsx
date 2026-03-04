"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import { formatCurrencyShort } from "@/lib/format";
import type { EnvejecimientoRango } from "@/lib/queries/cartera-server";

// Colores semanticos: verde (al dia) -> rojo (critico)
// Escala semantica: verde (tolerable) -> amarillo -> naranja -> rojo (critico)
const RANGE_COLORS: Record<string, string> = {
  "Al dia": "#22c55e",
  "1-5 dias": "#4ade80",
  "6-10 dias": "#facc15",
  "11-15 dias": "#eab308",
  "16-20 dias": "#f59e0b",
  "21-30 dias": "#f97316",
  "31-60 dias": "#ef4444",
  "61-90 dias": "#dc2626",
  "90+ dias": "#991b1b",
};

const chartConfig = {
  total: { label: "Total" },
} satisfies ChartConfig;

interface EnvejecimientoChartProps {
  data: EnvejecimientoRango[];
}

export function EnvejecimientoChart({ data }: EnvejecimientoChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Envejecimiento de Cartera</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCurrencyShort(v as number)}
              fontSize={12}
              width={60}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{formatCurrencyShort(Number(value))}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.payload.cantidad_facturas} facturas ({item.payload.porcentaje.toFixed(1)}%)
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={RANGE_COLORS[entry.label] || "#94a3b8"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
