"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUDITORIA_TIPO } from "@/lib/pagos-constants";

const TIPO_LABELS: Record<string, string> = {
  [AUDITORIA_TIPO.VOUCHER_COMPARTIDO]: "Voucher compartido",
  [AUDITORIA_TIPO.MONTO_DIFF_SYNC]: "Monto difiere ERP",
  [AUDITORIA_TIPO.MONTO_EDITADO]: "Monto editado",
  [AUDITORIA_TIPO.MONTO_DIFF_IA]: "Monto difiere IA",
  [AUDITORIA_TIPO.PAGO_SIN_SOPORTE]: "Sin soporte",
  [AUDITORIA_TIPO.CONFIANZA_BAJA]: "Confianza baja",
  [AUDITORIA_TIPO.VOUCHER_MODIFICADO]: "Voucher modificado",
};

interface FiltrosHistoricoProps {
  total: number;
}

export function FiltrosHistorico({ total }: FiltrosHistoricoProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const desde = searchParams.get("desde") || "";
  const hasta = searchParams.get("hasta") || "";
  const tipo = searchParams.get("tipo") || "";
  const estado = searchParams.get("estado") || "";

  const pushFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value && value !== "" && value !== "todos") {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.set("page", "1");
      router.push(`/alertas/historico?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 whitespace-nowrap">Cierre desde:</span>
        <Input
          type="date"
          value={desde}
          onChange={(e) => pushFilters({ desde: e.target.value })}
          className="w-full sm:w-36 h-9 text-sm"
        />
        <Input
          type="date"
          value={hasta}
          onChange={(e) => pushFilters({ hasta: e.target.value })}
          className="w-full sm:w-36 h-9 text-sm"
        />
      </div>

      <Select
        value={tipo || "todos"}
        onValueChange={(value) => pushFilters({ tipo: value })}
      >
        <SelectTrigger className="w-44 h-9 text-sm">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los tipos</SelectItem>
          {Object.entries(TIPO_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={estado || "todos"}
        onValueChange={(value) => pushFilters({ estado: value })}
      >
        <SelectTrigger className="w-40 h-9 text-sm">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas (cerradas)</SelectItem>
          <SelectItem value="aprobada">Aprobadas</SelectItem>
          <SelectItem value="rechazada">Rechazadas</SelectItem>
        </SelectContent>
      </Select>

      <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums">
        {total} cerradas
      </span>
    </div>
  );
}
