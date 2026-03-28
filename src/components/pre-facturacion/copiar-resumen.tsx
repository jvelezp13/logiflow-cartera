"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Check } from "lucide-react";

interface CopiarResumenProps {
  texto: string;
}

export function CopiarResumen({ texto }: CopiarResumenProps) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const id = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(id);
  }, [copiado]);

  const copiar = useCallback(async () => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
  }, [texto]);

  return (
    <button
      onClick={copiar}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
    >
      {copiado ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-500" />
          Copiado
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copiar para WhatsApp
        </>
      )}
    </button>
  );
}
