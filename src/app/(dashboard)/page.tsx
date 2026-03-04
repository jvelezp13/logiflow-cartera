import { Header } from "@/components/layout/header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { EnvejecimientoChart } from "@/components/dashboard/envejecimiento-chart";
import { DistribucionPie } from "@/components/dashboard/distribucion-pie";
import { TopClientesTable } from "@/components/dashboard/top-clientes-table";
import { TopCiudadesTable } from "@/components/dashboard/top-ciudades-table";
import {
  getEnvejecimiento,
  getTopClientesDeuda,
  getTopCiudadesDeuda,
} from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";

export default async function DashboardPage() {
  const profile = await getUserProfile();
  const incluirCastigada = await getIncluirCastigada();

  const [envejecimiento, topClientes, topCiudades] = await Promise.all([
    getEnvejecimiento(),
    getTopClientesDeuda(),
    getTopCiudadesDeuda(100),
  ]);

  return (
    <>
      <Header
        titulo="Dashboard"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <KpiCards data={envejecimiento} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnvejecimientoChart data={envejecimiento} />
          <DistribucionPie data={envejecimiento} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopClientesTable clientes={topClientes} />
          <TopCiudadesTable ciudades={topCiudades} />
        </div>
      </div>
    </>
  );
}
