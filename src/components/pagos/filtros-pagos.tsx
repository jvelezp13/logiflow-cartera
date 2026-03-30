"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface FiltrosPagosProps {
  total: number;
  sinCRM: number;
}

export function FiltrosPagos({ total, sinCRM }: FiltrosPagosProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const q = searchParams.get("q") || "";
  const estado = searchParams.get("estado") || "all";
  const desde = searchParams.get("desde") || "";
  const hasta = searchParams.get("hasta") || "";

  const pushFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value && value !== "all" && value !== "") {
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

        <Select
          value={estado}
          onValueChange={(v) => pushFilters({ estado: v })}
        >
          <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
            <SelectValue placeholder="Estado CRM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente CRM</SelectItem>
            <SelectItem value="verificado">Verificado</SelectItem>
          </SelectContent>
        </Select>

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

      {sinCRM > 0 && (
        <button
          onClick={() =>
            pushFilters({ estado: estado === "pendiente" ? "all" : "pendiente" })
          }
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
            estado === "pendiente"
              ? "bg-amber-100 text-amber-800 border-amber-300"
              : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
          }`}
        >
          {sinCRM} sin codigos CRM
        </button>
      )}
    </div>
  );
}
