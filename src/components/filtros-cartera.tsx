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
import { SEVERIDADES, RANGOS } from "@/lib/severity";

interface FiltrosCarteraProps {
  rutaBase: string;
  placeholder: string;
  etiquetaConteo: string;
  ciudades: string[];
  total: number;
}

export function FiltrosCartera({ rutaBase, placeholder, etiquetaConteo, ciudades, total }: FiltrosCarteraProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const q = searchParams.get("q") || "";
  const ciudad = searchParams.get("ciudad") || "all";
  const severidad = searchParams.get("severidad") || "";
  const rangosActivos = new Set((searchParams.get("rango") || "").split(",").filter(Boolean));

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
      router.push(`${rutaBase}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, rutaBase]
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

  const toggleSeveridad = useCallback(
    (value: string) => {
      pushFilters({ severidad: severidad === value ? "" : value });
    },
    [pushFilters, severidad]
  );

  const toggleRango = useCallback(
    (value: string) => {
      const current = new Set(
        (searchParams.get("rango") || "").split(",").filter(Boolean)
      );
      if (current.has(value)) current.delete(value);
      else current.add(value);
      pushFilters({ rango: [...current].join(",") });
    },
    [pushFilters, searchParams]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={placeholder}
            defaultValue={q}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select
          value={ciudad}
          onValueChange={(v) => pushFilters({ ciudad: v })}
        >
          <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
            <SelectValue placeholder="Ciudad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ciudades</SelectItem>
            {ciudades.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums">
          {total} {etiquetaConteo}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 mr-1">Estado:</span>
        {SEVERIDADES.map((s) => (
          <button
            key={s.value}
            onClick={() => toggleSeveridad(s.value)}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              severidad === s.value ? s.activeBg : s.bg
            }`}
          >
            {s.label}
          </button>
        ))}
        {severidad && (
          <button
            onClick={() => pushFilters({ severidad: "" })}
            className="text-xs text-slate-400 hover:text-slate-600 ml-1 cursor-pointer"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 mr-1">Envejecimiento:</span>
        {RANGOS.map((r) => (
          <button
            key={r.value}
            onClick={() => toggleRango(r.value)}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              rangosActivos.has(r.value)
                ? "bg-slate-700 text-white border-slate-700"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            {r.label}
          </button>
        ))}
        {rangosActivos.size > 0 && (
          <button
            onClick={() => pushFilters({ rango: "" })}
            className="text-xs text-slate-400 hover:text-slate-600 ml-1 cursor-pointer"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
