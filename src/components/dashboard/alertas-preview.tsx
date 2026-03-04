"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyShort } from "@/lib/format";
import type { AlertaCompleta } from "@/lib/queries/cartera-server";

interface AlertasPreviewProps {
  alertas: AlertaCompleta[];
}

export function AlertasPreview({ alertas }: AlertasPreviewProps) {
  const [filtro, setFiltro] = useState("todas");

  const alertasFiltradas =
    filtro === "todas" ? alertas : alertas.filter((a) => a.severidad === filtro);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Alertas</CardTitle>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-32" aria-label="Filtrar alertas por severidad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="critica">Criticas</SelectItem>
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
                      {alerta.dias_mora && <span>{alerta.dias_mora} dias mora</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrencyShort(alerta.valor)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
