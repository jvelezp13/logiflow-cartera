"use client";

import { useCallback, useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getMoraBadgeStyles } from "@/lib/severity";
import { formatCurrencyFull } from "@/lib/format";
import type { FacturaAbierta } from "@/lib/queries/pagos-server";
import { UMBRAL_REDONDEO_PAGO } from "@/lib/constants";

interface FacturaSeleccionada {
  no_factura: string;
  valor_factura: number;
  valor_aplicado: number;
}

interface SelectorFacturasProps {
  facturas: FacturaAbierta[];
  montoDisponible: number;
  selected: FacturaSeleccionada[];
  onChange: (selected: FacturaSeleccionada[]) => void;
}

export function SelectorFacturas({
  facturas,
  montoDisponible,
  selected,
  onChange,
}: SelectorFacturasProps) {
  const hasSuggested = useRef(false);
  const selectedMap = new Map(selected.map((s) => [s.no_factura, s]));
  const totalAplicado = selected.reduce((sum, s) => sum + s.valor_aplicado, 0);
  const diferencia = montoDisponible - totalAplicado;

  // Sugerencia FIFO al montar o cuando cambia monto
  const sugerirFIFO = useCallback(() => {
    if (montoDisponible <= 0 || facturas.length === 0) return;

    const sugeridas: FacturaSeleccionada[] = [];
    let restante = montoDisponible;

    for (const f of facturas) {
      if (restante <= UMBRAL_REDONDEO_PAGO) break;
      const aplicar = Math.min(f.total, restante);
      sugeridas.push({
        no_factura: f.no_factura,
        valor_factura: f.total,
        valor_aplicado: aplicar,
      });
      restante -= aplicar;
    }

    onChange(sugeridas);
  }, [montoDisponible, facturas, onChange]);

  // Auto-sugerir solo una vez al montar con monto disponible
  useEffect(() => {
    if (!hasSuggested.current && selected.length === 0 && montoDisponible > 0) {
      hasSuggested.current = true;
      sugerirFIFO();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montoDisponible]);

  function toggleFactura(factura: FacturaAbierta, checked: boolean) {
    if (checked) {
      onChange([
        ...selected,
        {
          no_factura: factura.no_factura,
          valor_factura: factura.total,
          valor_aplicado: factura.total,
        },
      ]);
    } else {
      onChange(selected.filter((s) => s.no_factura !== factura.no_factura));
    }
  }

  function updateValorAplicado(noFactura: string, valor: number) {
    onChange(
      selected.map((s) =>
        s.no_factura === noFactura ? { ...s, valor_aplicado: valor } : s
      )
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">
          Facturas abiertas ({facturas.length})
        </p>
        <button
          type="button"
          onClick={sugerirFIFO}
          className="text-xs text-blue-600 hover:underline"
        >
          Sugerir automatico
        </button>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="w-8 p-2" />
              <th className="text-left p-2">Factura</th>
              <th className="text-center p-2">Mora</th>
              <th className="text-right p-2">Total</th>
              <th className="text-right p-2 w-32">Aplicar</th>
            </tr>
          </thead>
          <tbody>
            {facturas.map((f) => {
              const isSelected = selectedMap.has(f.no_factura);
              const sel = selectedMap.get(f.no_factura);
              const badge = getMoraBadgeStyles(f.mora);

              return (
                <tr
                  key={f.no_factura}
                  className={`border-t ${isSelected ? "bg-emerald-50/50" : ""}`}
                >
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        toggleFactura(f, checked === true)
                      }
                    />
                  </td>
                  <td className="p-2 font-medium text-xs">{f.no_factura}</td>
                  <td className="p-2 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.classes}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="p-2 text-right tabular-nums text-xs">
                    {formatCurrencyFull(f.total)}
                  </td>
                  <td className="p-2 text-right">
                    {isSelected ? (
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={
                          sel!.valor_aplicado
                            ? sel!.valor_aplicado.toLocaleString("es-CO")
                            : ""
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          const valor = parseInt(raw, 10) || 0;
                          updateValorAplicado(
                            f.no_factura,
                            Math.min(valor, f.total)
                          );
                        }}
                        className="h-7 text-xs text-right w-28 ml-auto"
                      />
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: resumen */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-slate-500">
          {selected.length} factura{selected.length !== 1 && "s"} seleccionada
          {selected.length !== 1 && "s"}
        </span>
        <span
          className={`font-medium tabular-nums ${
            diferencia === 0
              ? "text-emerald-600"
              : diferencia > 0
                ? "text-slate-500"
                : "text-red-600"
          }`}
        >
          Aplicado: {formatCurrencyFull(totalAplicado)} de{" "}
          {formatCurrencyFull(montoDisponible)}
          {diferencia !== 0 && (
            <span className="ml-1">
              ({diferencia > 0 ? "+" : ""}
              {formatCurrencyFull(diferencia)} restante)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
