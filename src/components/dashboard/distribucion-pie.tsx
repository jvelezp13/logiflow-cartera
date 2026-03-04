"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Pie, PieChart, Cell, Label } from "recharts";
import { formatCurrencyShort } from "@/lib/format";
import type { EnvejecimientoRango } from "@/lib/queries/cartera-server";

// Agrupacion por severidad
const GRUPOS: { key: string; label: string; color: string; rangos: string[] }[] = [
  {
    key: "tolerable",
    label: "Tolerable",
    color: "#22c55e",
    rangos: ["Al dia", "1-5 dias"],
  },
  {
    key: "atencion",
    label: "Atencion",
    color: "#eab308",
    rangos: ["6-10 dias", "11-15 dias", "16-20 dias"],
  },
  {
    key: "critico",
    label: "Critico",
    color: "#ef4444",
    rangos: ["21-30 dias", "31-60 dias", "61-90 dias", "90+ dias"],
  },
];

const chartConfig = {
  tolerable: { label: "Tolerable", color: "#22c55e" },
  atencion: { label: "Atencion", color: "#eab308" },
  critico: { label: "Critico", color: "#ef4444" },
} satisfies ChartConfig;

interface DistribucionPieProps {
  data: EnvejecimientoRango[];
}

export function DistribucionPie({ data }: DistribucionPieProps) {
  // Agrupar rangos en 3 segmentos
  const segmentos = GRUPOS.map((grupo) => {
    const rangosDelGrupo = data.filter((d) => grupo.rangos.includes(d.label));
    const total = rangosDelGrupo.reduce((sum, r) => sum + r.total, 0);
    const facturas = rangosDelGrupo.reduce((sum, r) => sum + r.cantidad_facturas, 0);
    return { ...grupo, total, facturas };
  }).filter((s) => s.total > 0);

  const granTotal = segmentos.reduce((sum, s) => sum + s.total, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Distribucion de Cartera</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => {
                    const pct = granTotal > 0
                      ? ((Number(value) / granTotal) * 100).toFixed(1)
                      : "0";
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{formatCurrencyShort(Number(value))}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.payload.facturas} facturas ({pct}%)
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Pie
              data={segmentos}
              dataKey="total"
              nameKey="label"
              innerRadius={55}
              outerRadius={85}
              strokeWidth={2}
              stroke="#fff"
            >
              {segmentos.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 4}
                          className="fill-slate-900 text-lg font-semibold"
                        >
                          {formatCurrencyShort(granTotal)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 14}
                          className="fill-slate-500 text-xs"
                        >
                          Total
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Leyenda */}
        <div className="flex justify-center gap-6 mt-2">
          {segmentos.map((s) => {
            const pct = granTotal > 0 ? ((s.total / granTotal) * 100).toFixed(1) : "0";
            return (
              <div key={s.key} className="flex items-center gap-1.5 text-xs">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-slate-600">{s.label}</span>
                <span className="font-medium text-slate-900">{pct}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
