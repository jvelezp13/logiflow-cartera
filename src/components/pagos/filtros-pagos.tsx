"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { PagosAuditCounts } from "@/lib/queries/pagos-server";

interface FiltrosPagosProps {
  total: number;
  auditCounts: PagosAuditCounts;
}

interface CapsuleProps {
  count: number;
  label: string;
  active: boolean;
  onClick: () => void;
  colorInactive: string;
  colorActive: string;
}

function AuditCapsule({
  count,
  label,
  active,
  onClick,
  colorInactive,
  colorActive,
}: CapsuleProps) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
        active ? colorActive : colorInactive
      }`}
    >
      {count} {label}
    </button>
  );
}

export function FiltrosPagos({ total, auditCounts }: FiltrosPagosProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const q = searchParams.get("q") || "";
  const filtro = searchParams.get("filtro") || "";
  const desde = searchParams.get("desde") || "";
  const hasta = searchParams.get("hasta") || "";

  const pushFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value && value !== "") {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.set("page", "1");
      router.push(`/pagos?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        pushFilters({ q: value });
      }, 300);
    },
    [pushFilters]
  );

  const toggleFiltro = useCallback(
    (value: string) => {
      pushFilters({ filtro: filtro === value ? "" : value });
    },
    [filtro, pushFilters]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por cliente o factura..."
            defaultValue={q}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Input
          type="date"
          value={desde}
          onChange={(e) => pushFilters({ desde: e.target.value })}
          className="w-full sm:w-40 h-9 text-sm"
          placeholder="Desde"
        />
        <Input
          type="date"
          value={hasta}
          onChange={(e) => pushFilters({ hasta: e.target.value })}
          className="w-full sm:w-40 h-9 text-sm"
          placeholder="Hasta"
        />

        <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums">
          {total} pagos
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <AuditCapsule
          count={auditCounts.sinCRM}
          label="sin CRM"
          active={filtro === "sin_crm"}
          onClick={() => toggleFiltro("sin_crm")}
          colorInactive="bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
          colorActive="bg-amber-100 text-amber-800 border-amber-300"
        />
        <AuditCapsule
          count={auditCounts.montoModificado}
          label="monto modificado"
          active={filtro === "monto_modificado"}
          onClick={() => toggleFiltro("monto_modificado")}
          colorInactive="bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
          colorActive="bg-orange-100 text-orange-800 border-orange-300"
        />
        <AuditCapsule
          count={auditCounts.ingresoManual}
          label="ingreso manual"
          active={filtro === "manual"}
          onClick={() => toggleFiltro("manual")}
          colorInactive="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
          colorActive="bg-slate-200 text-slate-800 border-slate-400"
        />
        <AuditCapsule
          count={auditCounts.sinConciliar}
          label="sin conciliar"
          active={filtro === "sin_conciliar"}
          onClick={() => toggleFiltro("sin_conciliar")}
          colorInactive="bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
          colorActive="bg-red-100 text-red-800 border-red-300"
        />
        <AuditCapsule
          count={auditCounts.conDiscrepancia}
          label="discrepancia"
          active={filtro === "discrepancia"}
          onClick={() => toggleFiltro("discrepancia")}
          colorInactive="bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100"
          colorActive="bg-purple-100 text-purple-800 border-purple-300"
        />
      </div>
    </div>
  );
}
