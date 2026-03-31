"use client";

import { Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AiMetadata } from "@/lib/queries/pagos-server";

function formatValue(value: unknown, indent = 0): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => formatValue(v)).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${"  ".repeat(indent)}${k}: ${formatValue(v, indent + 1)}`)
      .join("\n");
  }
  return String(value);
}

import type { ConfianzaNivel } from "@/lib/queries/pagos-server";

const CONFIANZA_COLORS: Record<ConfianzaNivel, { icon: string; hover: string; label: string }> = {
  alto:  { icon: "text-emerald-500", hover: "hover:text-emerald-700", label: "Confianza alta" },
  medio: { icon: "text-amber-500",   hover: "hover:text-amber-700",   label: "Confianza media" },
  bajo:  { icon: "text-rose-500",    hover: "hover:text-rose-700",    label: "Confianza baja" },
};

const DEFAULT_COLOR = { icon: "text-slate-400", hover: "hover:text-slate-600", label: "Metadata IA" };

export function AiMetadataPopover({ data }: { data: AiMetadata }) {
  const color = (data.confianza_nivel && CONFIANZA_COLORS[data.confianza_nivel]) ?? DEFAULT_COLOR;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${color.icon} ${color.hover} transition-colors`}
          title={color.label}
        >
          <Sparkles className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs space-y-3" align="start">
        <p className="font-medium text-slate-700 flex items-center gap-1.5">
          <Sparkles className={`h-3.5 w-3.5 ${color.icon}`} />
          {color.label}
        </p>

        {data.confianza_nivel && (
          <div>
            <p className="text-slate-400 mb-0.5">Confianza</p>
            <p className="text-slate-600">
              {data.confianza_nivel}
              {data.confianza_notas && (
                <span className="text-slate-400"> — {data.confianza_notas}</span>
              )}
            </p>
          </div>
        )}

        {data.tipo_documento && (
          <div>
            <p className="text-slate-400 mb-0.5">Tipo documento</p>
            <p className="text-slate-600">
              {data.tipo_documento}
              {data.origen && <span className="text-slate-400"> — {data.origen}</span>}
            </p>
          </div>
        )}

        {data.observaciones && (
          <div>
            <p className="text-slate-400 mb-0.5">Observaciones IA</p>
            <p className="text-slate-600">{data.observaciones}</p>
          </div>
        )}

        {data.datos && (
          <div>
            <p className="text-slate-400 mb-0.5">Datos extraidos</p>
            <pre className="text-slate-600 bg-slate-50 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
              {formatValue(data.datos)}
            </pre>
          </div>
        )}

        {data.audit && (
          <div>
            <p className="text-slate-400 mb-0.5">Auditoria</p>
            <pre className="text-slate-600 bg-slate-50 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
              {formatValue(data.audit)}
            </pre>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
