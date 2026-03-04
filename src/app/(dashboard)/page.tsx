import { Header } from "@/components/layout/header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { EnvejecimientoChart } from "@/components/dashboard/envejecimiento-chart";
import { PedidosPendientesTable } from "@/components/dashboard/pedidos-pendientes-table";
import { TopClientesTable } from "@/components/dashboard/top-clientes-table";
import { AlertasPreview } from "@/components/dashboard/alertas-preview";
import {
  getDashboardKPIs,
  getEnvejecimiento,
  getTopClientesDeuda,
  getAlertasCompletas,
  getPedidosPendientes,
} from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";

export default async function DashboardPage() {
  const profile = await getUserProfile();

  const [kpis, envejecimiento, topClientes, alertas, pedidosPendientes] =
    await Promise.all([
      getDashboardKPIs(),
      getEnvejecimiento(),
      getTopClientesDeuda(),
      getAlertasCompletas(),
      getPedidosPendientes(),
    ]);

  return (
    <>
      <Header
        titulo="Dashboard"
        alertasCount={alertas.length}
        userName={profile.full_name}
        userRole={profile.role}
      />

      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <KpiCards kpis={kpis} alertasCount={alertas.length} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnvejecimientoChart data={envejecimiento} />
          <PedidosPendientesTable pedidos={pedidosPendientes} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopClientesTable clientes={topClientes} />
          <AlertasPreview alertas={alertas} />
        </div>
      </div>
    </>
  );
}
