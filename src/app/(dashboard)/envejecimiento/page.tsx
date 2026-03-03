"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getEnvejecimiento } from "@/lib/queries/cartera";
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
  Legend,
} from "recharts";

const COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444", "#991b1b"];

export default function EnvejecimientoPage() {
  const [data, setData] = useState<
    { label: string; total: number; porcentaje: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Rangos configurables - en el futuro vendrán de la DB
  const [rangos, setRangos] = useState([
    { label: "0-30 días", min: 0, max: 30 },
    { label: "31-60 días", min: 31, max: 60 },
    { label: "61-90 días", min: 61, max: 90 },
    { label: "90+ días", min: 91, max: null },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getEnvejecimiento(undefined, rangos);
        setData(result);
      } catch (error) {
        console.error("Error loading envejecimiento:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [rangos]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const total = data.reduce((sum, item) => sum + item.total, 0);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header titulo="Envejecimiento" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header titulo="Envejecimiento" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de barras */}
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Antigüedad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} layout="vertical">
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "Total",
                      ]}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {data.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico circular */}
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
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "Total",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla detallada */}
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
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                      <span className="font-medium">{rango.label}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatCurrency(rango.total)}
                      </div>
                      <div className="text-sm text-slate-500">
                        {rango.porcentaje.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${rango.porcentaje}%`,
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}

              <Separator className="my-4" />

              <div className="flex justify-between items-center pt-2">
                <span className="font-semibold text-lg">Total Cartera</span>
                <span className="font-bold text-xl">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nota de configuración */}
        <Card className="bg-slate-50">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">
              Los rangos de envejecimiento son configurables. Actualmente: 0-30,
              31-60, 61-90, 90+ días.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
