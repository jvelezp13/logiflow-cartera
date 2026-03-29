"use client";

import { useReducer, useActionState, useRef, useEffect, useCallback } from "react";
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
import { Upload, Loader2, AlertCircle, Check, Plus, X } from "lucide-react";
import { comprimirImagen } from "@/lib/image-compression";
import { obtenerUrlSubida, extraerDatos, crearPago } from "@/lib/pagos-action";
import { SelectorFacturas } from "@/components/pagos/selector-facturas";
import type { FacturaAbierta } from "@/lib/queries/pagos-server";
import type { DatosSoporte } from "@/lib/ai-extraction";

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
          action.data.fecha || state.fechaConsignacion,
        montoTotal:
          action.data.monto?.toString() || state.montoTotal,
        vouchers: action.data.referencia
          ? [action.data.referencia]
          : state.vouchers,
        medioPago:
          action.data.tipo_operacion || state.medioPago,
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
}

export function FormularioPago({
  codigoCliente,
  facturas,
  onSuccess,
}: FormularioPagoProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [actionState, formAction, isSubmitting] = useActionState(
    crearPago,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (actionState?.success) {
      dispatch({ type: "SET_STEP", step: "done" });
      onSuccess?.();
    }
  }, [actionState, onSuccess]);

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

      try {
        // Comprimir
        const compressed = await comprimirImagen(file);

        // Obtener URL de subida
        const urlResult = await obtenerUrlSubida(codigoCliente, file.name);
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
    <form ref={formRef} action={formAction} className="space-y-4">
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

      {/* Error/warning banner */}
      {state.error && (
        <div className="flex items-center gap-2 bg-amber-50 text-amber-800 text-xs px-3 py-2 rounded-md border border-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* AI badge */}
      {state.aiData && (
        <div className="flex items-center gap-2 bg-blue-50 text-blue-800 text-xs px-3 py-2 rounded-md border border-blue-200">
          <Check className="h-3 w-3" />
          Datos pre-llenados por IA — revisa y ajusta si es necesario
        </div>
      )}

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
              <SelectItem value="transferencia">Transferencia</SelectItem>
              <SelectItem value="datafono">Datafono</SelectItem>
              <SelectItem value="pse">PSE</SelectItem>
              <SelectItem value="consignacion">Consignacion</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
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

      {/* Selector de facturas */}
      <SelectorFacturas
        facturas={facturas}
        montoDisponible={parseFloat(state.montoTotal) || 0}
        selected={state.facturasSeleccionadas}
        onChange={(f) => dispatch({ type: "SET_FACTURAS", facturas: f })}
      />

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
