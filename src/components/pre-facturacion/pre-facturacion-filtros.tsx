"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

// Chips de modo: siempre uno activo
const MODOS = [
  {
    value: "mora",
    label: "Por mora",
    bg: "bg-yellow-50 border-yellow-200 text-yellow-700",
    activeBg: "bg-yellow-500 text-white border-yellow-500",
  },
  {
    value: "cupo",
    label: "Por cupo",
    bg: "bg-blue-50 border-blue-200 text-blue-700",
    activeBg: "bg-blue-600 text-white border-blue-600",
  },
] as const;

interface PreFacturacionFiltrosProps {
  total: number;
}

export function PreFacturacionFiltros({ total }: PreFacturacionFiltrosProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modo = searchParams.get("modo") || "mora";

  // Cambio de modo: siempre debe haber uno activo
  const setModo = useCallback(
    (value: string) => {
      if (value === modo) return;
      const params = new URLSearchParams();
      params.set("modo", value);
      router.push(`/pre-facturacion?${params.toString()}`, { scroll: false });
    },
    [router, modo]
  );

  return (
    <div className="flex items-center gap-3">
      {/* Chips de modo */}
      <div className="flex items-center gap-2">
        {MODOS.map((m) => (
          <button
            key={m.value}
            onClick={() => setModo(m.value)}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              modo === m.value ? m.activeBg : m.bg
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Conteo de resultados */}
      <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums ml-auto">
        {total} pedidos
      </span>
    </div>
  );
}
