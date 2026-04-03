"use client";

import { useState, useActionState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Loader2, Check } from "lucide-react";
import { limpiarSoporteHuerfano, crearNotaCredito } from "@/lib/pagos-action";
import { uploadSoporte } from "@/lib/upload-soporte";
import { formatCurrencyFull } from "@/lib/format";

interface DialogNotaCreditoProps {
  codigoCliente: string;
  noFactura: string;
  monto: number;
}

export function DialogNotaCredito({ codigoCliente, noFactura, monto }: DialogNotaCreditoProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [upload, setUpload] = useState<{ objectKey: string; fileName: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [actionState, formAction, isSubmitting] = useActionState(crearNotaCredito, null);

  const handleFileSelect = useCallback(async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      setUpload(await uploadSoporte(codigoCliente, file));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error al procesar archivo");
    } finally {
      setUploading(false);
    }
  }, [codigoCliente]);

  function handleOpenChange(next: boolean) {
    if (!next && upload && !actionState?.success) {
      limpiarSoporteHuerfano(upload.objectKey);
    }
    if (!next) {
      setUpload(null);
      setUploadError(null);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button
        className="text-xs text-slate-500 hover:underline font-medium"
        onClick={() => setOpen(true)}
      >
        Adjuntar NC
      </button>
      <DialogContent className="sm:max-w-md">
        {actionState?.success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium">Nota credito registrada</p>
            <p className="text-xs text-slate-500">La novedad sera removida del listado</p>
            <Button size="sm" variant="outline" onClick={() => handleOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Adjuntar nota credito</DialogTitle>
              <DialogDescription>
                Factura <span className="font-medium">{noFactura}</span> — {formatCurrencyFull(monto)}
              </DialogDescription>
            </DialogHeader>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="codigo_cliente" value={codigoCliente} />
              <input type="hidden" name="no_factura" value={noFactura} />
              <input type="hidden" name="monto" value={monto} />
              <input type="hidden" name="soporte_key" value={upload?.objectKey || ""} />
              <input type="hidden" name="soporte_nombre" value={upload?.fileName || ""} />

              <div>
                <label className="text-xs text-slate-500 mb-1 block">Soporte NC (requerido)</label>
                {upload ? (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700 truncate flex-1">{upload.fileName}</span>
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-600"
                      onClick={() => {
                        limpiarSoporteHuerfano(upload.objectKey);
                        setUpload(null);
                      }}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 py-4 text-sm text-slate-500 hover:border-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Seleccionar imagen de la NC
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    e.target.value = "";
                  }}
                />
                {uploadError && (
                  <p className="text-xs text-red-600 mt-1">{uploadError}</p>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1 block">Monto</label>
                <Input
                  value={formatCurrencyFull(monto)}
                  readOnly
                  className="h-8 text-sm bg-slate-50"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1 block">Observaciones</label>
                <Textarea
                  name="observaciones"
                  rows={2}
                  placeholder="Motivo de la nota credito..."
                  className="text-sm"
                />
              </div>

              {actionState?.error && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{actionState.error}</p>
              )}

              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={!upload || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Registrando...
                  </>
                ) : (
                  "Registrar nota credito"
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
