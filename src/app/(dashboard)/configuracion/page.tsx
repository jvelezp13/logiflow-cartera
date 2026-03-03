"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConfiguracionPage() {
  return (
    <>
      <Header titulo="Configuración" />

      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuración de Cartera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Rangos de Envejecimiento</h3>
              <p className="text-sm text-slate-500 mb-4">
                Configura los rangos de días para el envejecimiento de cartera.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Rango 1:</span> 0-30 días
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Rango 2:</span> 31-60 días
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Rango 3:</span> 61-90 días
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Rango 4:</span> 90+ días
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                (Configuración editable en futuras versiones)
              </p>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-2">Configuración de Alertas</h3>
              <p className="text-sm text-slate-500">
                Las alertas se generan automáticamente para clientes con pedidos
                recientes y facturas vencidas.
              </p>
              <div className="mt-2 text-sm">
                <div>
                  Días para buscar pedidos: <strong>3 días</strong>
                </div>
                <div>
                  Rango de mora: <strong>1-30 días</strong>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                (Configuración editable en futuras versiones)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
