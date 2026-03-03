"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { ResumenCard } from "@/components/cartera/resumen-cards";
import {
  getResumenCartera,
  getEnvejecimiento,
  getAlertas,
} from "@/lib/queries/cartera";
import type { ResumenCartera } from "@/types/cartera";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444"];

export default function DashboardPage() {
  const [resumen, setResumen] = useState<ResumenCartera | null>(null);
  const [envejecimiento, setEnvejecimiento] = useState<
    { label: string; total: number; porcentaje: number }[]
  >([]);
  const [alertasCount, setAlertasCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [resumenData, envejecimientoData, alertasData] =
          await Promise.all([
            getResumenCartera(),
            getEnvejecimiento(),
            getAlertas(),
          ]);

        setResumen(resumenData);
        setEnvejecimiento(envejecimientoData);
        setAlertasCount(alertasData.length);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header titulo="Dashboard" alertasCount={0} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header titulo="Dashboard" alertasCount={alertasCount} />

      <div className="p-6 space-y-6">
        {/* Tarjetas de resumen */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ResumenCard
            titulo="Cartera Total"
            valor={resumen?.total || 0}
            icono="dollar"
            className="bg-white"
          />
          <ResumenCard
            titulo="Por Vencer"
            valor={resumen?.por_vencer || 0}
            icono="trending"
            className="bg-white"
          />
          <ResumenCard
            titulo="Vencido"
            valor={resumen?.vencido || 0}
            icono="clock"
            className="bg-white"
          />
          <ResumenCard
            titulo="Clientes Activos"
            valor={resumen?.clientes_activos || 0}
            icono="users"
            className="bg-white"
          />
        </div>

        {/* Gráfico de envejecimiento */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Envejecimiento</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={envejecimiento} layout="vertical">
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                  />
                  <YAxis type="category" dataKey="label" width={100} />
                  <Tooltip
                    formatter={(value) => [
                      `$${Number(value).toLocaleString()}`,
                      "Total",
                    ]}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {envejecimiento.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribución porcentual */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Distribución</h2>
            <div className="space-y-4">
              {envejecimiento.map((rango, index) => (
                <div key={rango.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{rango.label}</span>
                    <span className="font-medium">
                      ${(rango.total / 1000000).toFixed(1)}M (
                      {rango.porcentaje.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
            </div>
          </div>
        </div>

        {/* Alertas recientes */}
        {alertasCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="font-medium text-amber-800">
                {alertasCount} alertas de cartera
              </span>
              <a
                href="/alertas"
                className="text-amber-600 text-sm hover:underline"
              >
                Ver todas →
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
