"use client";

import { useReducer, useActionState, useRef, useEffect, useCallback, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Loader2, AlertCircle, Check, Plus, X } from "lucide-react";
import { comprimirImagen } from "@/lib/image-compression";
import {
  obtenerUrlSubida,
  extraerDatos,
  crearPago,
  limpiarSoporteHuerfano,
  type PagoActionState,
} from "@/lib/pagos-action";
import { formatCurrencyFull, formatFechaCorta } from "@/lib/format";
import { SelectorFacturas } from "@/components/pagos/selector-facturas";
import type { FacturaAbierta } from "@/lib/queries/pagos-server";
import type { RetroactivoData } from "@/lib/pagos-action";
import { type DatosSoporte, MEDIOS_DE_PAGO } from "@/lib/ai-extraction";

function AIExtractionBadge({ aiData }: { aiData: DatosSoporte }) {
  const nivel = aiData.confianza.nivel;
  const Icon = nivel === "alto" ? Check : AlertCircle;
  const obs = aiData.observaciones?.toLowerCase() ?? "";
  const multipleVouchers =
    obs.includes("múltiple") ||
    obs.includes("multiple") ||
    obs.includes("varios") ||
    obs.includes("más de un") ||
    obs.includes("dos comprobante") ||
    obs.includes("2 comprobante");

  return (
    <>
      <div
        className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md border ${
          nivel === "alto"
            ? "bg-blue-50 text-blue-800 border-blue-200"
            : nivel === "medio"
              ? "bg-amber-50 text-amber-800 border-amber-200"
              : "bg-red-50 text-red-800 border-red-200"
        }`}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span>
          {nivel === "alto"
            ? "Datos extraidos por IA — revisa y ajusta si es necesario"
            : `Confianza ${nivel}: ${aiData.confianza.notas || "revisa los datos con cuidado"}`}
          {aiData.observaciones && <> · {aiData.observaciones}</>}
        </span>
      </div>
      {multipleVouchers && (
        <div className="flex items-center gap-2 bg-orange-50 text-orange-800 text-xs px-3 py-2 rounded-md border border-orange-200">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>
            La IA detectó múltiples comprobantes en la imagen — solo se extrajo el principal. Verificá que el monto y voucher correspondan al pago correcto.
          </span>
        </div>
      )}
    </>
  );
}

// --- State Machine ---

type Step = "idle" | "uploading" | "extracting" | "reviewing" | "done";

interface FormState {
  step: Step;
  error: string | null;
  objectKey: string | null;
  soporteNombre: string | null;
  aiData: DatosSoporte | null;
  aiRaw: unknown;
  // Form fields
  fechaConsignacion: string;
  montoTotal: string;
  medioPago: string;
  vouchers: string[];
  numeroRecaudo: string;
  numeroRecibo: string;
  observaciones: string;
  notaCredito: string;
  valorNotaCredito: string;
  facturasSeleccionadas: {
    no_factura: string;
    valor_factura: number;
    valor_aplicado: number;
  }[];
}

type FormAction =
  | { type: "SET_STEP"; step: Step }
  | { type: "SET_ERROR"; error: string }
  | { type: "UPLOAD_DONE"; objectKey: string; soporteNombre: string }
  | { type: "EXTRACTION_DONE"; data: DatosSoporte; raw: unknown }
  | { type: "EXTRACTION_FAILED"; error: string }
  | { type: "SKIP_TO_REVIEW" }
  | { type: "SET_FIELD"; field: string; value: string }
  | { type: "SET_VOUCHERS"; vouchers: string[] }
  | {
      type: "SET_FACTURAS";
      facturas: {
        no_factura: string;
        valor_factura: number;
        valor_aplicado: number;
      }[];
    }
  | { type: "RESET" };

const initialState: FormState = {
  step: "idle",
  error: null,
  objectKey: null,
  soporteNombre: null,
  aiData: null,
  aiRaw: null,
  fechaConsignacion: new Date().toISOString().split("T")[0],
  montoTotal: "",
  medioPago: "",
  vouchers: [""],
  numeroRecaudo: "",
  numeroRecibo: "",
  observaciones: "",
  notaCredito: "",
  valorNotaCredito: "",
  facturasSeleccionadas: [],
};

function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step, error: null };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "UPLOAD_DONE":
      return {
        ...state,
        step: "extracting",
        objectKey: action.objectKey,
        soporteNombre: action.soporteNombre,
      };
    case "EXTRACTION_DONE":
      return {
        ...state,
        step: "reviewing",
        aiData: action.data,
        aiRaw: action.raw,
        fechaConsignacion:
          action.data.datos.fecha_consignacion || state.fechaConsignacion,
        montoTotal:
          action.data.datos.valor_pagado?.toString() || state.montoTotal,
        vouchers: action.data.datos.numero_voucher
          ? [action.data.datos.numero_voucher]
          : state.vouchers,
        medioPago:
          action.data.datos.medio_de_pago || state.medioPago,
      };
    case "EXTRACTION_FAILED":
      return { ...state, step: "reviewing", error: action.error };
    case "SKIP_TO_REVIEW":
      return { ...state, step: "reviewing", error: null };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_VOUCHERS":
      return { ...state, vouchers: action.vouchers };
    case "SET_FACTURAS":
      return { ...state, facturasSeleccionadas: action.facturas };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// --- Componente ---

interface FormularioPagoProps {
  codigoCliente: string;
  facturas: FacturaAbierta[];
  onSuccess?: () => void;
  retroactivo?: RetroactivoData;
}

export function FormularioPago({
  codigoCliente,
  facturas,
  onSuccess,
  retroactivo,
}: FormularioPagoProps) {
  const [state, dispatch] = useReducer(reducer, retroactivo, (retro) => ({
    ...initialState,
    ...(retro?.monto ? { montoTotal: retro.monto } : {}),
    ...(retro ? {
      step: "reviewing" as Step,
      facturasSeleccionadas: [{
        no_factura: retro.factura,
        valor_factura: parseInt(retro.monto, 10) || 0,
        valor_aplicado: parseInt(retro.monto, 10) || 0,
      }],
    } : {}),
  }));
  const [actionState, formAction, isSubmitting] = useActionState(
    crearPago,
    null
  );
  const [voucherWarning, setVoucherWarning] = useState<
    PagoActionState["voucher_duplicado"] | null
  >(null);
  const formRef = useRef<HTMLFormElement>(null);
  const savedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Cancelar upload en curso si el componente se desmonta
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (actionState?.success) {
      dispatch({ type: "SET_STEP", step: "done" });
      onSuccess?.();
    } else if (actionState && !actionState.success) {
      savedRef.current = false;
    }
    if (actionState?.voucher_duplicado) {
      setVoucherWarning(actionState.voucher_duplicado);
    }
  }, [actionState, onSuccess]);

  // Cleanup: borrar soporte de R2 si el form se desmonta sin guardar
  useEffect(() => {
    return () => {
      if (state.objectKey && !savedRef.current) {
        limpiarSoporteHuerfano(state.objectKey);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.objectKey]);

  // Warning: prevenir cierre accidental si hay datos sin guardar
  const hasUnsavedData =
    state.step === "reviewing" && (state.objectKey || state.montoTotal);
  useEffect(() => {
    if (!hasUnsavedData) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedData]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        dispatch({
          type: "SET_ERROR",
          error: "El archivo supera el limite de 10MB",
        });
        return;
      }

      dispatch({ type: "SET_STEP", step: "uploading" });
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      try {
        // Comprimir
        const compressed = await comprimirImagen(file);

        // Obtener URL de subida
        const urlResult = await obtenerUrlSubida(codigoCliente, file.name);
        if (signal.aborted) return;
        if (urlResult.error || !urlResult.uploadUrl || !urlResult.objectKey) {
          dispatch({
            type: "SET_ERROR",
            error: urlResult.error || "Error al generar URL",
          });
          dispatch({ type: "SKIP_TO_REVIEW" });
          return;
        }

        // Subir a R2
        const uploadRes = await fetch(urlResult.uploadUrl, {
          method: "PUT",
          body: compressed,
          headers: { "Content-Type": "image/webp" },
          signal,
        });

        if (!uploadRes.ok) {
          dispatch({
            type: "SET_ERROR",
            error: `Error al subir soporte (HTTP ${uploadRes.status})`,
          });
          dispatch({ type: "SKIP_TO_REVIEW" });
          return;
        }

        dispatch({
          type: "UPLOAD_DONE",
          objectKey: urlResult.objectKey,
          soporteNombre: file.name,
        });

        // Extraccion IA
        const extraction = await extraerDatos(urlResult.objectKey);
        if (extraction.error || !extraction.data) {
          dispatch({
            type: "EXTRACTION_FAILED",
            error:
              extraction.error ||
              "No pudimos leer los datos. Ingresalos manualmente.",
          });
        } else {
          dispatch({
            type: "EXTRACTION_DONE",
            data: extraction.data,
            raw: extraction.raw,
          });
        }
      } catch {
        dispatch({
          type: "EXTRACTION_FAILED",
          error: "Error procesando el soporte. Podes ingresar los datos manualmente.",
        });
      }
    },
    [codigoCliente]
  );

  // --- Render por step ---

  if (state.step === "done") {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-medium">Pago registrado</p>
          {actionState?.error && (
            <p className="text-xs text-amber-600 mt-1">{actionState.error}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: "RESET" })}
        >
          Registrar otro
        </Button>
      </div>
    );
  }

  if (state.step === "idle") {
    return (
      <div className="space-y-4">
        <DropZone onFileSelect={handleFileSelect} />
        <div className="text-center">
          <button
            type="button"
            onClick={() => dispatch({ type: "SKIP_TO_REVIEW" })}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Ingresar manualmente sin soporte
          </button>
        </div>
      </div>
    );
  }

  if (state.step === "uploading" || state.step === "extracting") {
    return (
      <div className="text-center py-8 space-y-3">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
        <p className="text-sm text-slate-500">
          {state.step === "uploading"
            ? "Subiendo soporte..."
            : "Extrayendo datos con IA..."}
        </p>
      </div>
    );
  }

  // step === "reviewing"
  return (
    <form ref={formRef} action={formAction} onSubmit={() => { savedRef.current = true; }} className="space-y-4">
      {/* Hidden fields */}
      <input type="hidden" name="codigo_cliente" value={codigoCliente} />
      <input
        type="hidden"
        name="soporte_key"
        value={state.objectKey || ""}
      />
      <input
        type="hidden"
        name="soporte_nombre"
        value={state.soporteNombre || ""}
      />
      <input
        type="hidden"
        name="ai_extraction"
        value={state.aiRaw ? JSON.stringify(state.aiRaw) : ""}
      />
      <input
        type="hidden"
        name="facturas"
        value={JSON.stringify(state.facturasSeleccionadas)}
      />
      <input
        type="hidden"
        name="vouchers"
        value={state.vouchers.filter(Boolean).join(",")}
      />
      <input
        type="hidden"
        name="voucher_duplicado_aceptado"
        value={voucherWarning ? "true" : ""}
      />
      {retroactivo && (
        <>
          <input type="hidden" name="retroactivo" value="true" />
          <input type="hidden" name="sync_factura" value={retroactivo.factura} />
          <input type="hidden" name="sync_monto" value={retroactivo.monto} />
        </>
      )}

      {/* Error/warning banner */}
      {state.error && (
        <div className="flex items-center gap-2 bg-amber-50 text-amber-800 text-xs px-3 py-2 rounded-md border border-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      {state.aiData && <AIExtractionBadge aiData={state.aiData} />}

      {/* Form fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">
            Fecha consignacion *
          </label>
          <Input
            type="date"
            name="fecha_consignacion"
            value={state.fechaConsignacion}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "fechaConsignacion",
                value: e.target.value,
              })
            }
            className="h-8 text-sm"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Monto total *</label>
          <input type="hidden" name="monto_total" value={state.montoTotal} />
          <Input
            type="text"
            inputMode="numeric"
            value={
              state.montoTotal
                ? Number(state.montoTotal).toLocaleString("es-CO")
                : ""
            }
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              dispatch({
                type: "SET_FIELD",
                field: "montoTotal",
                value: raw,
              });
            }}
            className="h-8 text-sm"
            placeholder="$0"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">Medio de pago</label>
          <Select
            name="medio_pago"
            value={state.medioPago}
            onValueChange={(v) =>
              dispatch({
                type: "SET_FIELD",
                field: "medioPago",
                value: v,
              })
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Seleccionar" />
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
        <div>
          <label className="text-xs text-slate-500">Vouchers</label>
          <div className="space-y-1">
            {state.vouchers.map((v, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  value={v}
                  onChange={(e) => {
                    const updated = [...state.vouchers];
                    updated[i] = e.target.value;
                    dispatch({ type: "SET_VOUCHERS", vouchers: updated });
                  }}
                  className="h-8 text-sm"
                  placeholder={`Voucher ${i + 1}`}
                />
                {state.vouchers.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "SET_VOUCHERS",
                        vouchers: state.vouchers.filter((_, idx) => idx !== i),
                      })
                    }
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            {state.vouchers.length < 4 && (
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: "SET_VOUCHERS",
                    vouchers: [...state.vouchers, ""],
                  })
                }
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Agregar voucher
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">
            No. Recaudo (CRM)
          </label>
          <Input
            type="number"
            name="numero_recaudo"
            value={state.numeroRecaudo}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "numeroRecaudo",
                value: e.target.value,
              })
            }
            className="h-8 text-sm"
            placeholder="Opcional"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">
            No. Recibo (CRM)
          </label>
          <Input
            type="number"
            name="numero_recibo"
            value={state.numeroRecibo}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "numeroRecibo",
                value: e.target.value,
              })
            }
            className="h-8 text-sm"
            placeholder="Opcional"
          />
        </div>
      </div>

      {/* Nota credito / Rte Fuente */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">
            Nota credito / Rte Fuente
          </label>
          <Input
            name="nota_credito"
            value={state.notaCredito}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "notaCredito",
                value: e.target.value,
              })
            }
            className="h-8 text-sm"
            placeholder="Referencia NC"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Valor NC / RteFte</label>
          <Input
            type="number"
            name="valor_nota_credito"
            value={state.valorNotaCredito}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "valorNotaCredito",
                value: e.target.value,
              })
            }
            className="h-8 text-sm"
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500">Observaciones</label>
        <Textarea
          name="observaciones"
          value={state.observaciones}
          onChange={(e) =>
            dispatch({
              type: "SET_FIELD",
              field: "observaciones",
              value: e.target.value,
            })
          }
          className="resize-none text-sm"
          rows={2}
          placeholder="Notas adicionales..."
        />
      </div>

      {/* Selector de facturas (no aplica en modo retroactivo) */}
      {retroactivo ? (
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Factura referencia</label>
          <Input
            value={retroactivo.factura}
            readOnly
            className="h-8 text-sm bg-slate-50"
          />
          <p className="text-[10px] text-slate-400">
            Pago retroactivo — factura liquidada en CRM sin pasar por cartera
          </p>
        </div>
      ) : (
        <SelectorFacturas
          facturas={facturas}
          montoDisponible={parseInt(state.montoTotal, 10) || 0}
          selected={state.facturasSeleccionadas}
          onChange={(f) => dispatch({ type: "SET_FACTURAS", facturas: f })}
        />
      )}

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Registrando...
            </>
          ) : (
            "Registrar pago"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => dispatch({ type: "RESET" })}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
      </div>

      {actionState?.error && !actionState.success && (
        <p className="text-xs text-red-600">{actionState.error}</p>
      )}

      {/* Voucher duplicado warning dialog */}
      <Dialog
        open={!!voucherWarning}
        onOpenChange={(open) => {
          if (!open) setVoucherWarning(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-5 w-5" />
              Voucher ya utilizado
            </DialogTitle>
            <DialogDescription>
              {state.vouchers.filter(Boolean).length === 1
                ? `El voucher ${state.vouchers.filter(Boolean)[0]} ya fue utilizado en otro pago.`
                : `Los vouchers ingresados ya fueron utilizados en otro pago.`}
            </DialogDescription>
          </DialogHeader>

          {voucherWarning && (() => {
            const nuevoTotal = voucherWarning.totalYaAplicado + voucherWarning.montoNuevoPago;
            const excede = voucherWarning.montoSoporte !== null && nuevoTotal > voucherWarning.montoSoporte;
            return (
              <div className="space-y-3">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                  {voucherWarning.duplicados.map((d) => (
                    <div
                      key={d.pago_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-700">
                        {formatFechaCorta(d.fecha_consignacion)} — Cliente{" "}
                        {d.codigo_cliente}
                      </span>
                      <span className="font-medium text-slate-900">
                        {formatCurrencyFull(d.monto_total)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-xs">
                  {voucherWarning.montoSoporte !== null && (
                    <p className="text-slate-500">
                      Valor del soporte:{" "}
                      <span className="font-medium text-slate-700">
                        {formatCurrencyFull(voucherWarning.montoSoporte)}
                      </span>
                    </p>
                  )}
                  <p className="text-slate-500">
                    Ya aplicado:{" "}
                    <span className="font-medium text-slate-700">
                      {formatCurrencyFull(voucherWarning.totalYaAplicado)}
                    </span>
                    {" + "}Este pago:{" "}
                    <span className="font-medium text-slate-700">
                      {formatCurrencyFull(voucherWarning.montoNuevoPago)}
                    </span>
                    {" = "}
                    <span className={`font-semibold ${excede ? "text-red-600" : "text-slate-900"}`}>
                      {formatCurrencyFull(nuevoTotal)}
                    </span>
                  </p>
                  {excede && (
                    <p className="text-red-600 font-medium">
                      La suma total excede el valor del soporte por{" "}
                      {formatCurrencyFull(nuevoTotal - (voucherWarning.montoSoporte ?? 0))}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setVoucherWarning(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                // voucherWarning stays truthy so the hidden input sends "true"
                // requestSubmit triggers the form action with the flag set
                formRef.current?.requestSubmit();
              }}
            >
              Continuar de todos modos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

// --- DropZone ---

function DropZone({
  onFileSelect,
}: {
  onFileSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  }

  return (
    <Card
      className="border-dashed border-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center py-8 gap-2">
        <Upload className="h-8 w-8 text-slate-400" />
        <p className="text-sm text-slate-600">
          Subir soporte de pago
        </p>
        <p className="text-xs text-slate-400">
          Arrastra o haz click — JPEG, PNG, HEIC, WebP (max 10MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp"
          className="hidden"
          onChange={handleChange}
        />
      </CardContent>
    </Card>
  );
}
