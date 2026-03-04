"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { getDashboardKPIs, getEnvejecimiento, getTopClientesDeuda, getAlertasCompletas, getPedidosPendientes, DashboardKPIs, ClienteEnriquecido, EnvejecimientoRango, AlertaCompleta, PedidoEnriquecido } from "@/lib/queries/cartera";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const COLORS = {
  critico: "#dc2626",
  alta: "#f97316",
  media: "#eab308",
  baja: "#22c55e",
  categorias: ["#22c55e", "#eab308", "#f97316", "#dc2626"],
};

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
};

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [envejecimiento, setEnvejecimiento] = useState<EnvejecimientoRango[]>([]);
  const [topClientes, setTopClientes] = useState<ClienteEnriquecido[]>([]);
  const [alertas, setAlertas] = useState<AlertaCompleta[]>([]);
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoEnriquecido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroAlertas, setFiltroAlertas] = useState<string>("todas");

  useEffect(() => {
    async function loadData() {
      try {
        const [kpisData, envejecimientoData, topData, alertasData, pedidosData] =
          await Promise.all([
            getDashboardKPIs(),
            getEnvejecimiento(),
            getTopClientesDeuda(),
            getAlertasCompletas(),
            getPedidosPendientes(),
          ]);

        setKpis(kpisData);
        setEnvejecimiento(envejecimientoData);
        setTopClientes(topData);
        setAlertas(alertasData);
        setPedidosPendientes(pedidosData);
      } catch (err: any) {
        console.error("Error loading dashboard:", err);
        setError(err?.message || "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const alertasFiltradas = filtroAlertas === "todas" 
    ? alertas 
    : alertas.filter(a => a.severidad === filtroAlertas);

  const formatTooltip = (value: number) => formatCurrency(value);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header titulo="Dashboard" alertasCount={0} />
        <div className="flex-1 flex items-center justify-center" role="status" aria-live="polite">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="sr-only">Cargando…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header titulo="Dashboard" alertasCount={0} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl">
            <h2 className="text-red-800 font-semibold mb-2">Error</h2>
            <pre className="text-red-600 text-sm overflow-auto">{error}</pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header titulo="Dashboard" alertasCount={alertas.length} />

      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        {/* KPIs Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Cartera Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(kpis?.cartera_total || 0)}</div>
              <p className="text-xs text-blue-200 mt-1">{kpis?.clientes_con_deuda} clientes</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-100">Cartera Vencida</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(kpis?.cartera_vencida || 0)}</div>
              <p className="text-xs text-red-200 mt-1">{kpis?.facturas_vencidas} facturas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100">Por Vencer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(kpis?.cartera_por_vencer || 0)}</div>
              <p className="text-xs text-emerald-200 mt-1">{kpis?.facturas_por_vencer} facturas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-100">Alertas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{alertas.length}</div>
              <p className="text-xs text-amber-200 mt-1">requieren atención</p>
            </CardContent>
          </Card>
        </div>

        {/* Segunda fila: Gráficos y Pedidos Pendientes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Envejecimiento */}
          <Card>
            <CardHeader>
              <CardTitle>Envejecimiento de Cartera</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={envejecimiento} layout="vertical">
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v as number)} />
                    <YAxis type="category" dataKey="label" width={80} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {envejecimiento.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS.categorias[index % COLORS.categorias.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Leyenda con porcentajes */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {envejecimiento.map((rango, index) => (
                  <div key={rango.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.categorias[index] }}></div>
                      <span>{rango.label}</span>
                    </div>
                    <span className="font-medium">{rango.porcentaje.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pedidos Pendientes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pedidos Pendientes (7 días)</CardTitle>
              <Badge variant="outline">{pedidosPendientes.length} pedidos</Badge>
            </CardHeader>
            <CardContent>
              {pedidosPendientes.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No hay pedidos pendientes</p>
              ) : (
                <div className="max-h-80 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Ciudad</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Deuda</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidosPendientes.slice(0, 10).map((pedido) => (
                        <TableRow key={pedido.num_pedido}>
                          <TableCell className="font-mono text-xs">{pedido.num_pedido}</TableCell>
                          <TableCell className="text-sm truncate max-w-[150px]">
                            {pedido.razon_social || pedido.codigo_cliente}
                          </TableCell>
                          <TableCell className="text-sm">{pedido.ciudad || "-"}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {formatCurrency(Number(pedido.total))}
                          </TableCell>
                          <TableCell className="text-right">
                            {(pedido.facturas_vencidas_cliente || 0) > 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                {(pedido.facturas_vencidas_cliente || 0)} facturas
                              </Badge>
                            ) : (
                              <span className="text-slate-400 text-xs">Sin deuda</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tercera fila: Top Clientes y Alertas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Clientes con Deuda */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 - Clientes con Mayor Deuda</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="text-right">Deuda Total</TableHead>
                    <TableHead className="text-right">Vencido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClientes.map((cliente) => (
                    <TableRow key={cliente.codigo_cliente}>
                      <TableCell>
                        <div className="font-medium">{cliente.razon_social || cliente.codigo_cliente}</div>
                        <div className="text-xs text-slate-500">{cliente.codigo_cliente}</div>
                      </TableCell>
                      <TableCell className="text-sm">{cliente.ciudad || "-"}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="text-xs">
                          {cliente.segmento?.split(" - ")[0] || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(Number(cliente.total_deuda))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(cliente.total_vencido) > 0 ? (
                          <span className="text-red-600 font-medium">
                            {formatCurrency(Number(cliente.total_vencido))}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Alertas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Alertas</CardTitle>
              <Select value={filtroAlertas} onValueChange={setFiltroAlertas}>
                <SelectTrigger className="w-32" aria-label="Filtrar alertas por severidad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="critica">Críticas</SelectItem>
                  <SelectItem value="alta">Altas</SelectItem>
                  <SelectItem value="media">Medias</SelectItem>
                  <SelectItem value="baja">Bajas</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {alertasFiltradas.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No hay alertas</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-auto">
                  {alertasFiltradas.map((alerta, index) => (
                    <div
                      key={`${alerta.codigo_cliente}-${alerta.tipo}-${index}`}
                      className={`p-4 rounded-lg border-l-4 ${
                        alerta.severidad === "critica"
                          ? "bg-red-50 border-red-500"
                          : alerta.severidad === "alta"
                          ? "bg-orange-50 border-orange-500"
                          : alerta.severidad === "media"
                          ? "bg-amber-50 border-amber-500"
                          : "bg-green-50 border-green-500"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`text-xs ${
                                alerta.severidad === "critica"
                                  ? "bg-red-500"
                                  : alerta.severidad === "alta"
                                  ? "bg-orange-500"
                                  : alerta.severidad === "media"
                                  ? "bg-amber-500"
                                  : "bg-green-500"
                              }`}
                            >
                              {alerta.severidad.toUpperCase()}
                            </Badge>
                            <span className="font-medium text-sm">{alerta.titulo}</span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{alerta.descripcion}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>{alerta.razon_social || alerta.codigo_cliente}</span>
                            {alerta.ciudad && <span>{alerta.ciudad}</span>}
                            {alerta.dias_mora && <span>{alerta.dias_mora} días mora</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(alerta.valor)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
