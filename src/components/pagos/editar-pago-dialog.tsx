"use client";

import { useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, CheckCircle2, AlertCircle } from "lucide-react";
import { editarPago } from "@/lib/pagos-action";
import { formatCurrencyFull } from "@/lib/format";
import type { PagoResumen } from "@/lib/queries/pagos-server";

interface EditarPagoDialogProps {
  pago: PagoResumen;
}

const MEDIOS_PAGO = [
  "Tarjeta de recaudo",
  "Bancolombia Nexo",
  "Davivienda Nexo",
] as const;

export function EditarPagoDialog({ pago }: EditarPagoDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [fechaConsignacion, setFechaConsignacion] = useState(pago.fecha_consignacion);
  const [montoTotal, setMontoTotal] = useState(String(pago.monto_total));
  const [medioPago, setMedioPago] = useState(pago.medio_pago || "");
  const [vouchers, setVouchers] = useState(pago.vouchers.join(", "));
  const [observaciones, setObservaciones] = useState(pago.observaciones || "");
  const [notaCredito, setNotaCredito] = useState(pago.nota_credito || "");
  const [valorNotaCredito, setValorNotaCredito] = useState(
    pago.valor_nota_credito != null ? String(pago.valor_nota_credito) : ""
  );

  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  function resetForm() {
    setFechaConsignacion(pago.fecha_consignacion);
    setMontoTotal(String(pago.monto_total));
    setMedioPago(pago.medio_pago || "");
    setVouchers(pago.vouchers.join(", "));
    setObservaciones(pago.observaciones || "");
    setNotaCredito(pago.nota_credito || "");
    setValorNotaCredito(
      pago.valor_nota_credito != null ? String(pago.valor_nota_credito) : ""
    );
    setResult(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) resetForm();
  }

  function handleGuardar() {
    const cambios: Record<string, unknown> = {};

    if (fechaConsignacion !== pago.fecha_consignacion) {
      cambios.fecha_consignacion = fechaConsignacion;
    }
    const montoNum = parseInt(montoTotal, 10);
    if (!Number.isNaN(montoNum) && montoNum !== pago.monto_total) {
      cambios.monto_total = montoNum;
    }
    const medioPagoVal = medioPago || null;
    if (medioPagoVal !== (pago.medio_pago || null)) {
      cambios.medio_pago = medioPagoVal;
    }
    if (vouchers !== pago.vouchers.join(", ")) {
      cambios.vouchers = vouchers;
    }
    const obsVal = observaciones.trim() || null;
    if (obsVal !== (pago.observaciones || null)) {
      cambios.observaciones = obsVal;
    }
    const ncVal = notaCredito.trim() || null;
    if (ncVal !== (pago.nota_credito || null)) {
      cambios.nota_credito = ncVal;
    }
    const vncNum = valorNotaCredito ? parseInt(valorNotaCredito, 10) : null;
    if (vncNum !== (pago.valor_nota_credito ?? null)) {
      cambios.valor_nota_credito = vncNum;
    }

    if (Object.keys(cambios).length === 0) {
      setOpen(false);
      return;
    }

    startTransition(async () => {
      const res = await editarPago(pago.id, cambios);
      setResult(res);
      if (res.success) {
        setTimeout(() => setOpen(false), 1200);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-400 hover:text-slate-700"
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">Editar pago</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar pago</SheetTitle>
          {pago.nombre_cliente && (
            <p className="text-sm text-slate-500">{pago.nombre_cliente}</p>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-4 px-4 pb-6">
          {/* Fecha de consignacion */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500">
              Fecha de consignacion
            </label>
            <Input
              type="date"
              value={fechaConsignacion}
              onChange={(e) => setFechaConsignacion(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Monto total */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Monto total</label>
            <Input
              type="number"
              value={montoTotal}
              onChange={(e) => setMontoTotal(e.target.value)}
              min={1}
              step={1}
              disabled={isPending}
            />
            {montoTotal && !Number.isNaN(parseInt(montoTotal, 10)) && (
              <p className="text-xs text-slate-400">
                {formatCurrencyFull(parseInt(montoTotal, 10))}
              </p>
            )}
          </div>

          {/* Medio de pago */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Medio de pago</label>
            <Select
              value={medioPago}
              onValueChange={setMedioPago}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {MEDIOS_PAGO.map((medio) => (
                  <SelectItem key={medio} value={medio}>
                    {medio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vouchers */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Vouchers</label>
            <Input
              value={vouchers}
              onChange={(e) => setVouchers(e.target.value)}
              placeholder="Separados por coma"
              disabled={isPending}
            />
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Observaciones</label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              disabled={isPending}
            />
          </div>

          {/* Nota credito */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Nota credito</label>
            <Input
              value={notaCredito}
              onChange={(e) => setNotaCredito(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Valor nota credito */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500">
              Valor nota credito
            </label>
            <Input
              type="number"
              value={valorNotaCredito}
              onChange={(e) => setValorNotaCredito(e.target.value)}
              min={0}
              step={1}
              disabled={isPending}
            />
            {valorNotaCredito &&
              !Number.isNaN(parseInt(valorNotaCredito, 10)) && (
                <p className="text-xs text-slate-400">
                  {formatCurrencyFull(parseInt(valorNotaCredito, 10))}
                </p>
              )}
          </div>

          {/* Resultado */}
          {result?.error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {result.error}
            </div>
          )}
          {result?.success && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-md p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Pago actualizado
            </div>
          )}

          {/* Guardar */}
          <Button
            onClick={handleGuardar}
            disabled={isPending || result?.success === true}
            className="w-full"
          >
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
