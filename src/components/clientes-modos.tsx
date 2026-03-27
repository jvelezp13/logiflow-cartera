"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const MODOS = [
  { value: "con_saldo", label: "Con saldo" },
  { value: "cupo_sin_uso", label: "Cupo sin uso" },
  { value: "credito_anulado", label: "Credito anulado" },
] as const;

type ModoClientes = typeof MODOS[number]["value"];

interface ClientesModosProps {
  conteos: Record<ModoClientes, number>;
}

export function ClientesModos({ conteos }: ClientesModosProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modoActual = searchParams.get("modo") || "con_saldo";

  const setModo = useCallback(
    (modo: string) => {
      const params = new URLSearchParams();
      if (modo !== "con_saldo") params.set("modo", modo);
      router.push(`/clientes?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  return (
    <div className="flex items-center gap-2">
      {MODOS.map((m) => (
        <button
          key={m.value}
          onClick={() => setModo(m.value)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
            modoActual === m.value
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          {m.label}
          <span className={`text-xs tabular-nums rounded-full px-1.5 py-0.5 ${
            modoActual === m.value
              ? "bg-white/20 text-white"
              : "bg-slate-100 text-slate-500"
          }`}>
            {conteos[m.value] ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}
