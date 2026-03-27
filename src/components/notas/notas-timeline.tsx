"use client";

import { useActionState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LucideIcon } from "lucide-react";
import { MessageSquare, Phone, Handshake, Info, Send } from "lucide-react";
import { crearNota } from "@/lib/notas-action";
import type { NotaCliente, TipoNota } from "@/lib/queries/notas-server";
import type { AppRole } from "@/lib/auth/types";
import { formatFechaRelativa, formatMesGrupo } from "@/lib/format";

// --- Config de tipos ---

const TIPO_CONFIG: Record<
  TipoNota,
  { label: string; icon: LucideIcon; badgeClass: string }
> = {
  gestion: {
    label: "Gestion",
    icon: Phone,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  compromiso: {
    label: "Compromiso",
    icon: Handshake,
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  novedad: {
    label: "Novedad",
    icon: Info,
    badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
  },
};

// --- Agrupar notas por mes ---

interface GrupoNotas {
  label: string;
  notas: NotaCliente[];
}

function agruparPorMes(notas: NotaCliente[]): GrupoNotas[] {
  const grupos: GrupoNotas[] = [];
  const conFecha: NotaCliente[] = [];
  const sinFecha: NotaCliente[] = [];

  for (const nota of notas) {
    if (nota.created_at) {
      conFecha.push(nota);
    } else {
      sinFecha.push(nota);
    }
  }

  // Agrupar las que tienen fecha por mes
  const mesesMap = new Map<string, NotaCliente[]>();
  for (const nota of conFecha) {
    const key = formatMesGrupo(nota.created_at!);
    const grupo = mesesMap.get(key);
    if (grupo) {
      grupo.push(nota);
    } else {
      mesesMap.set(key, [nota]);
    }
  }

  for (const [label, notasGrupo] of mesesMap) {
    grupos.push({ label, notas: notasGrupo });
  }

  // Historicas al final
  if (sinFecha.length > 0) {
    grupos.push({ label: "Importado desde historico", notas: sinFecha });
  }

  return grupos;
}

// --- Componente principal ---

interface NotasTimelineProps {
  notas: NotaCliente[];
  codigoCliente: string;
  userRole: AppRole;
}

export function NotasTimeline({
  notas,
  codigoCliente,
  userRole,
}: NotasTimelineProps) {
  const canCreate = userRole === "admin" || userRole === "super_admin";
  const grupos = agruparPorMes(notas);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <CardTitle className="text-base">Notas y Seguimiento</CardTitle>
          {notas.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {notas.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canCreate && <FormNota codigoCliente={codigoCliente} />}

        {notas.length === 0 ? (
          <p className="text-center py-8 text-sm text-slate-500">
            No hay notas para este cliente
          </p>
        ) : (
          <div className="space-y-6">
            {grupos.map((grupo) => (
              <div key={grupo.label}>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                  {grupo.label}
                </p>
                <div className="space-y-3 border-l-2 border-slate-100 pl-4">
                  {grupo.notas.map((nota) => (
                    <NotaItem key={nota.id} nota={nota} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Form ---

function FormNota({ codigoCliente }: { codigoCliente: string }) {
  const [state, formAction, isPending] = useActionState(crearNota, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="codigo_cliente" value={codigoCliente} />

      <Textarea
        name="contenido"
        placeholder="Agregar una nota..."
        className="resize-none text-sm"
        rows={3}
        required
      />

      <div className="flex items-center gap-2">
        <Select name="tipo" defaultValue="novedad">
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPO_CONFIG).map(([value, config]) => {
              const Icon = config.icon;
              return (
                <SelectItem key={value} value={value}>
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3 w-3" /> {config.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Button type="submit" size="sm" disabled={isPending} className="h-8">
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {isPending ? "Guardando..." : "Guardar"}
        </Button>

        {state?.error && (
          <p className="text-xs text-red-600">{state.error}</p>
        )}
      </div>
    </form>
  );
}

// --- Nota individual ---

function NotaItem({ nota }: { nota: NotaCliente }) {
  const config = TIPO_CONFIG[nota.tipo];
  const Icon = config.icon;

  return (
    <div className="relative">
      <div className="absolute -left-[1.28rem] top-1 h-2 w-2 rounded-full bg-slate-300" />

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.badgeClass}`}>
            <Icon className="h-2.5 w-2.5 mr-0.5" />
            {config.label}
          </Badge>

          {nota.created_at && (
            <span className="text-[10px] text-slate-400">
              {formatFechaRelativa(nota.created_at)}
            </span>
          )}

          {nota.created_by_name && (
            <span className="text-[10px] text-slate-400">
              · {nota.created_by_name}
            </span>
          )}
        </div>

        <p className="text-sm text-slate-700 whitespace-pre-wrap">
          {nota.contenido}
        </p>
      </div>
    </div>
  );
}
