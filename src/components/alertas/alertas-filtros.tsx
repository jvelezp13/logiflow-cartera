"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

// Chips de modo con colores semanticos
const MODOS = [
  {
    value: "cupo_excedido",
    label: "Cupo excedido",
    bg: "bg-red-50 border-red-200 text-red-700",
    activeBg: "bg-red-500 text-white border-red-500",
  },
  {
    value: "cupo_ocioso",
    label: "Cupo ocioso",
    bg: "bg-blue-50 border-blue-200 text-blue-700",
    activeBg: "bg-blue-600 text-white border-blue-600",
  },
  {
    value: "inactivos",
    label: "Inactivos",
    bg: "bg-amber-50 border-amber-200 text-amber-700",
    activeBg: "bg-amber-500 text-white border-amber-500",
  },
  {
    value: "novedades",
    label: "Novedades",
    bg: "bg-slate-50 border-slate-200 text-slate-700",
    activeBg: "bg-slate-600 text-white border-slate-600",
  },
] as const;

interface AlertasFiltrosProps {
  conteos: {
    cupo_excedido: number;
    cupo_ocioso: number;
    inactivos: number;
    novedades: number;
  };
}

export function AlertasFiltros({ conteos }: AlertasFiltrosProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modo = searchParams.get("modo") || "cupo_excedido";

  const setModo = useCallback(
    (value: string) => {
      if (value === modo) return;
      const params = new URLSearchParams();
      params.set("modo", value);
      router.push(`/alertas?${params.toString()}`, { scroll: false });
    },
    [router, modo]
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {MODOS.map((m) => (
        <button
          key={m.value}
          onClick={() => setModo(m.value)}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
            modo === m.value ? m.activeBg : m.bg
          }`}
        >
          {m.label} ({conteos[m.value as keyof typeof conteos]})
        </button>
      ))}
    </div>
  );
}
