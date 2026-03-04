import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";

export default async function ConfiguracionPage() {
  const profile = await getUserProfile();
  const incluirCastigada = await getIncluirCastigada();

  return (
    <>
      <Header
        titulo="Configuracion"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuracion de Cartera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Rangos de Envejecimiento</h3>
              <p className="text-sm text-slate-500 mb-4">
                Configura los rangos de dias para el envejecimiento de cartera.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Rango 1:</span> 0-30 dias
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Rango 2:</span> 31-60 dias
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Rango 3:</span> 61-90 dias
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Rango 4:</span> 90+ dias
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                (Configuracion editable en futuras versiones)
              </p>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-2">Configuracion de Alertas</h3>
              <p className="text-sm text-slate-500">
                Las alertas se generan automaticamente para clientes con pedidos
                recientes y facturas vencidas.
              </p>
              <div className="mt-2 text-sm">
                <div>
                  Dias para buscar pedidos: <strong>3 dias</strong>
                </div>
                <div>
                  Rango de mora: <strong>1-30 dias</strong>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                (Configuracion editable en futuras versiones)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
