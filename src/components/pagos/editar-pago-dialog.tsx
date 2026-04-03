"use client";

import { useState, useTransition, useRef, useEffect } from "react";
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
import { Pencil, CheckCircle2, AlertCircle, Upload, ImageIcon, History } from "lucide-react";
import { editarPago, reemplazarSoporte, obtenerHistorialPago } from "@/lib/pagos-action";
import { uploadSoporte } from "@/lib/upload-soporte";
import { formatCurrencyFull, formatFechaRelativa } from "@/lib/format";
import { MEDIOS_DE_PAGO } from "@/lib/ai-extraction";
import type { PagoResumen, HistorialEntry } from "@/lib/queries/pagos-server";

interface EditarPagoDialogProps {
  pago: PagoResumen;
}

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
  const [soporteUploading, setSoporteUploading] = useState(false);
  const [soporteResult, setSoporteResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setSoporteResult(null);
    setSoporteUploading(false);
  }

  async function handleSoporteChange(file: File) {
    if (!pago.codigo_cliente) return;
    setSoporteUploading(true);
    setSoporteResult(null);
    try {
      const { objectKey, fileName } = await uploadSoporte(pago.codigo_cliente, file);
      const res = await reemplazarSoporte(pago.id, objectKey, fileName);
      setSoporteResult(res);
    } catch (e) {
      setSoporteResult({ error: e instanceof Error ? e.message : "Error al reemplazar soporte" });
    } finally {
      setSoporteUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    if (!open || !pago.editado) return;
    let cancelled = false;
    obtenerHistorialPago(pago.id)
      .then((h) => { if (!cancelled) setHistorial(h); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, pago.id, pago.editado]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetForm();
      setHistorial([]);
    }
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
                {MEDIOS_DE_PAGO.map((medio) => (
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

          {/* Reemplazar soporte */}
          <div className="space-y-2 border-t pt-4">
            <label className="text-xs text-slate-500">Soporte</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 truncate flex-1">
                {pago.soporte_key ? (
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Soporte actual
                  </span>
                ) : (
                  "Sin soporte"
                )}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSoporteChange(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={soporteUploading || isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {soporteUploading ? (
                  "Subiendo..."
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    {pago.soporte_key ? "Reemplazar" : "Adjuntar"}
                  </span>
                )}
              </Button>
            </div>
            {soporteResult?.error && (
              <p className="text-xs text-red-600">{soporteResult.error}</p>
            )}
            {soporteResult?.success && (
              <p className="text-xs text-emerald-600">Soporte actualizado</p>
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

          {/* Historial de cambios */}
          {pago.editado && historial.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Historial de cambios
              </p>
              <div className="space-y-1.5">
                {historial.map((h) => (
                  <div
                    key={h.id}
                    className="text-xs text-slate-600 bg-slate-50 rounded-md px-3 py-2"
                  >
                    <span className="font-medium">
                      {h.campo === "soporte"
                        ? "Soporte reemplazado"
                        : `${h.campo.replace(/_/g, " ")}: ${h.valor_anterior || "(vacío)"} → ${h.valor_nuevo || "(vacío)"}`}
                    </span>
                    <span className="text-slate-400 ml-2">
                      {h.modificado_por_nombre || "Sistema"} · {formatFechaRelativa(h.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
